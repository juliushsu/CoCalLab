// Portable encrypted-file primitive; not a database/Storage backup or restore driver.
// The caller must enforce protected parent-directory ACLs and retain a trusted manifest.
import {createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID} from 'node:crypto';
import {open, lstat, realpath, link, unlink} from 'node:fs/promises';
import {dirname, resolve, join} from 'node:path';

const MAGIC = Buffer.from('EAF1');
const HEADER_BYTES = 16, TAG_BYTES = 16, CHUNK = 64 * 1024;
export const MAX_PLAINTEXT_BYTES = 1024 * 1024 * 1024;
export class ArtifactError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new ArtifactError(code); };
const digest = value => createHash('sha256').update(value).digest('hex');
function argumentsFor({source, destination, key, binding, maxBytes = MAX_PLAINTEXT_BYTES}) {
  if (typeof source !== 'string' || typeof destination !== 'string' || !source || !destination || resolve(source) === resolve(destination)) fail('INVALID_PATH');
  if (!Buffer.isBuffer(key) || key.length !== 32) fail('INVALID_KEY');
  if (typeof binding !== 'string' || !binding || Buffer.byteLength(binding) > 4096) fail('INVALID_BINDING');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > MAX_PLAINTEXT_BYTES) fail('INVALID_SIZE_LIMIT');
  return {source: resolve(source), destination: resolve(destination), aad: Buffer.from(binding), maxBytes};
}
async function canonicalParent(file) {
  const parent = dirname(file), canonical = await realpath(parent);
  const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
  if (normalize(canonical) !== normalize(parent)) fail('LINKED_PARENT_REFUSED');
  return parent;
}
async function regularSource(source) {
  await canonicalParent(source);
  const before = await lstat(source);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1) fail('NON_REGULAR_SOURCE');
  const file = await open(source, 'r');
  const current = await file.stat();
  if (current.ino !== before.ino || current.dev !== before.dev || !current.isFile() || current.nlink !== 1) {
    await file.close(); fail('SOURCE_CHANGED');
  }
  return {file, stat: current};
}
async function unchanged(file, stat, count) {
  const after = await file.stat();
  if (count !== stat.size || after.size !== stat.size || after.ino !== stat.ino || after.nlink !== 1 || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) fail('SOURCE_CHANGED');
}
async function exactRead(file, length, position) {
  const buffer = Buffer.alloc(length); let offset = 0;
  while (offset < length) {
    const {bytesRead} = await file.read(buffer, offset, length - offset, position + offset);
    if (!bytesRead) fail('TRUNCATED_ARTIFACT');
    offset += bytesRead;
  }
  return buffer;
}
async function publish(temporary, destination) {
  try { await link(temporary, destination); }
  catch (error) { if (error.code === 'EEXIST') fail('DESTINATION_EXISTS'); throw error; }
  // Hard-link publication is create-only; rename could replace an existing backup.
  await unlink(temporary);
}
async function operation(options, decrypt) {
  const {source, destination, aad, maxBytes} = argumentsFor(options);
  const expected = options.expected;
  if (decrypt && (!expected || !Number.isSafeInteger(expected.plaintextBytes) || expected.plaintextBytes < 0 || ![expected.plaintextSha256, expected.ciphertextSha256].every(x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x)))) fail('TRUSTED_MANIFEST_REQUIRED');
  let input, output, temporary;
  try {
    const parent = await canonicalParent(destination);
    const opened = await regularSource(source); input = opened.file;
    const stat = opened.stat;
    const plaintextBytes = decrypt ? stat.size - HEADER_BYTES - TAG_BYTES : stat.size;
    if (plaintextBytes < 0 || plaintextBytes > maxBytes) fail('SIZE_LIMIT_OR_INVALID_ARTIFACT');
    if (decrypt && plaintextBytes !== expected.plaintextBytes) fail('MANIFEST_MISMATCH');
    const candidate = join(parent, `.incomplete-${randomUUID()}`);
    output = await open(candidate, 'wx', 0o600);
    // Only clean up a file this invocation actually created.
    temporary = candidate;
    const plainHash = createHash('sha256'), encryptedHash = createHash('sha256');
    const header = decrypt ? await exactRead(input, HEADER_BYTES, 0) : Buffer.concat([MAGIC, randomBytes(12)]);
    if (!header.subarray(0, 4).equals(MAGIC)) fail('INVALID_ARTIFACT_FORMAT');
    const transform = decrypt ? createDecipheriv('aes-256-gcm', options.key, header.subarray(4)) : createCipheriv('aes-256-gcm', options.key, header.subarray(4));
    transform.setAAD(aad);
    encryptedHash.update(header);
    if (!decrypt) await output.writeFile(header);
    let position = decrypt ? HEADER_BYTES : 0, processed = 0;
    while (processed < plaintextBytes) {
      const chunk = await exactRead(input, Math.min(CHUNK, plaintextBytes - processed), position);
      const transformed = transform.update(chunk);
      plainHash.update(decrypt ? transformed : chunk);
      encryptedHash.update(decrypt ? chunk : transformed);
      await output.writeFile(transformed);
      position += chunk.length; processed += chunk.length;
    }
    if (decrypt) {
      const tag = await exactRead(input, TAG_BYTES, position);
      encryptedHash.update(tag); transform.setAuthTag(tag);
    }
    let final;
    try { final = transform.final(); } catch { fail('AUTHENTICATION_FAILED'); }
    if (decrypt) plainHash.update(final); else encryptedHash.update(final);
    await output.writeFile(final);
    if (!decrypt) {
      const tag = transform.getAuthTag(); encryptedHash.update(tag); await output.writeFile(tag);
    }
    await unchanged(input, stat, decrypt ? processed + HEADER_BYTES + TAG_BYTES : processed);
    const plaintextSha256 = plainHash.digest('hex'), ciphertextSha256 = encryptedHash.digest('hex');
    if (decrypt && (plaintextSha256 !== expected.plaintextSha256 || ciphertextSha256 !== expected.ciphertextSha256)) fail('MANIFEST_MISMATCH');
    await output.sync(); await output.close(); output = null;
    await publish(temporary, destination); temporary = null;
    return {
      format: 'EAF1-AES-256-GCM', bindingSha256: digest(aad),
      plaintextBytes, plaintextSha256, ciphertextSha256,
      verificationScope: 'ENCRYPTED_FILE_ONLY_NOT_DATABASE_OR_STORAGE_RESTORE',
    };
  } catch (error) {
    if (error instanceof ArtifactError) throw error;
    fail('FILE_IO_FAILED');
  } finally {
    await output?.close().catch(() => {});
    await input?.close().catch(() => {});
    if (temporary) await unlink(temporary).catch(() => {});
  }
}
export const encryptArtifact = options => operation(options, false);
export const decryptArtifact = options => operation(options, true);
