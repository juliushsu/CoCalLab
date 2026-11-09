import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp, writeFile, readFile, readdir, rm, link, mkdir, symlink, unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, basename, sep} from 'node:path';
import {encryptArtifact, decryptArtifact} from './encrypted-artifact.mjs';

const binding = 'SYNTHETIC:product-A/tenant-A/project-A/ref-A/lease-A/source-A';
async function fixture(t, bytes = randomBytes(150_013)) {
  const root = await mkdtemp(join(tmpdir(), 'encrypted-artifact-test-'));
  t.after(async () => {
    const absolute = resolve(root);
    assert.ok(absolute.startsWith(resolve(tmpdir()) + sep) && basename(absolute).startsWith('encrypted-artifact-test-'));
    await rm(absolute, {recursive: true});
  });
  const source = join(root, 'SYNTHETIC-source.bin'), destination = join(root, 'archive.eaf');
  await writeFile(source, bytes, {flag: 'wx'});
  return {root, source, destination, key: randomBytes(32), binding, bytes};
}
async function encrypted(t, bytes) {
  const f = await fixture(t, bytes), manifest = await encryptArtifact(f);
  return {...f, source: f.destination, destination: join(f.root, 'restored.bin'), expected: manifest};
}
async function denied(f, code) {
  await assert.rejects(decryptArtifact(f), e => e.code === code);
  assert.equal((await readdir(f.root)).filter(x => x.startsWith('.incomplete-')).length, 0);
  assert.equal((await readdir(f.root)).includes('restored.bin'), false);
}

test('real multi-chunk binary round trip binds metadata and returns only non-secret digests', async t => {
  const f = await encrypted(t), result = await decryptArtifact(f);
  assert.deepEqual(await readFile(f.destination), f.bytes);
  assert.deepEqual(result, f.expected);
  assert.equal(result.plaintextBytes, f.bytes.length);
  assert.equal(result.verificationScope, 'ENCRYPTED_FILE_ONLY_NOT_DATABASE_OR_STORAGE_RESTORE');
  assert.ok(!JSON.stringify(result).includes(f.key.toString('hex')));
});
test('empty file is authenticated and readable', async t => {
  const f = await encrypted(t, Buffer.alloc(0)); await decryptArtifact(f);
  assert.equal((await readFile(f.destination)).length, 0);
});
test('wrong key never publishes unauthenticated plaintext', async t => {
  const f = await encrypted(t); await denied({...f, key: randomBytes(32)}, 'AUTHENTICATION_FAILED');
});
test('wrong product, tenant, project, lease or source binding refuses reuse', async t => {
  const f = await encrypted(t);
  for (const component of ['product', 'tenant', 'project', 'ref', 'lease', 'source']) {
    await denied({...f, binding: binding.replace(`${component}-A`, `${component}-B`)}, 'AUTHENTICATION_FAILED');
  }
});
test('tampered header, nonce, ciphertext and tag are refused without final output', async t => {
  const f = await encrypted(t), original = await readFile(f.source);
  for (const index of [0, 4, 16, original.length - 1]) {
    const changed = Buffer.from(original); changed[index] ^= 1;
    await writeFile(f.source, changed);
    await denied(f, index === 0 ? 'INVALID_ARTIFACT_FORMAT' : 'AUTHENTICATION_FAILED');
  }
});
test('truncated or appended archive cannot match trusted manifest', async t => {
  const f = await encrypted(t), original = await readFile(f.source);
  await writeFile(f.source, original.subarray(0, original.length - 1)); await denied(f, 'MANIFEST_MISMATCH');
  await writeFile(f.source, Buffer.concat([original, Buffer.from([0])])); await denied(f, 'MANIFEST_MISMATCH');
});
test('trusted manifest is required and both plaintext and archive digest must match', async t => {
  const f = await encrypted(t);
  await denied({...f, expected: null}, 'TRUSTED_MANIFEST_REQUIRED');
  for (const name of ['plaintextSha256', 'ciphertextSha256']) {
    await denied({...f, expected: {...f.expected, [name]: '0'.repeat(64)}}, 'MANIFEST_MISMATCH');
  }
});
test('encrypt and decrypt preserve existing destination bytes', async t => {
  const f = await fixture(t), sentinel = Buffer.from('EXISTING BACKUP MUST REMAIN');
  await writeFile(f.destination, sentinel, {flag: 'wx'});
  await assert.rejects(encryptArtifact(f), e => e.code === 'DESTINATION_EXISTS');
  assert.deepEqual(await readFile(f.destination), sentinel);
  const d = await encrypted(t); await writeFile(d.destination, sentinel, {flag: 'wx'});
  await assert.rejects(decryptArtifact(d), e => e.code === 'DESTINATION_EXISTS');
  assert.deepEqual(await readFile(d.destination), sentinel);
});
test('concurrent same destination publication has exactly one winner, no overwrite or partial files', async t => {
  const f = await fixture(t), settled = await Promise.allSettled([encryptArtifact(f), encryptArtifact(f)]);
  assert.equal(settled.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(settled.find(x => x.status === 'rejected').reason.code, 'DESTINATION_EXISTS');
  const manifest = settled.find(x => x.status === 'fulfilled').value;
  await decryptArtifact({...f, source: f.destination, destination: join(f.root, 'verified.bin'), expected: manifest});
  assert.deepEqual(await readFile(join(f.root, 'verified.bin')), f.bytes);
  assert.equal((await readdir(f.root)).filter(x => x.startsWith('.incomplete-')).length, 0);
});
test('size limits reject encryption and decryption without publishing', async t => {
  const f = await fixture(t);
  await assert.rejects(encryptArtifact({...f, maxBytes: 1}), e => e.code === 'SIZE_LIMIT_OR_INVALID_ARTIFACT');
  const d = await encrypted(t); await denied({...d, maxBytes: 1}, 'SIZE_LIMIT_OR_INVALID_ARTIFACT');
});
test('invalid key, empty binding and same-path overwrite fail before writing', async t => {
  const f = await fixture(t);
  for (const [patch, code] of [[{key: Buffer.alloc(31)}, 'INVALID_KEY'], [{binding: ''}, 'INVALID_BINDING'], [{destination: f.source}, 'INVALID_PATH'], [{maxBytes: -1}, 'INVALID_SIZE_LIMIT']]) {
    await assert.rejects(encryptArtifact({...f, ...patch}), e => e.code === code);
  }
  assert.deepEqual(await readFile(f.source), f.bytes);
});
test('hard-linked or non-regular sources are refused', async t => {
  const f = await fixture(t); await link(f.source, join(f.root, 'alias.bin'));
  await assert.rejects(encryptArtifact(f), e => e.code === 'NON_REGULAR_SOURCE');
  const directory = join(f.root, 'directory'); await mkdir(directory);
  await assert.rejects(encryptArtifact({...f, source: directory}), e => e.code === 'NON_REGULAR_SOURCE');
});
test('linked parent directories cannot redirect source or destination', async t => {
  const f = await fixture(t), alias = join(f.root, 'redirect');
  await symlink(f.root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  try {
    await assert.rejects(encryptArtifact({...f, source: join(alias, 'SYNTHETIC-source.bin')}), e => e.code === 'LINKED_PARENT_REFUSED');
    await assert.rejects(encryptArtifact({...f, destination: join(alias, 'archive.eaf')}), e => e.code === 'LINKED_PARENT_REFUSED');
    assert.deepEqual(await readFile(f.source), f.bytes);
  } finally { await unlink(alias); }
});
