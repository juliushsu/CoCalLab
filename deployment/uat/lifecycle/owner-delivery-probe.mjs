// Explicit synthetic local probe. It never reads production data, contacts a provider,
// accepts a real UAT ref, or certifies Owner handoff/database restore.
import {randomBytes, createHash} from 'node:crypto';
import {writeFile, readFile, readdir} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {encryptArtifact, decryptArtifact, ArtifactError} from './encrypted-artifact.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function runDeliveryProbe({archiveDirectory, keyDirectory, probeId}) {
  if (typeof probeId !== 'string' || !/^SYNTHETIC-PROBE-\d{8}-[a-f0-9-]{36}$/.test(probeId)) throw new ArtifactError('SYNTHETIC_PROBE_ID_REQUIRED');
  if (resolve(archiveDirectory) === resolve(keyDirectory)) throw new ArtifactError('SEPARATE_KEY_DIRECTORY_REQUIRED');
  if ((await readdir(archiveDirectory)).length || (await readdir(keyDirectory)).length) throw new ArtifactError('NEW_EMPTY_PROBE_DIRECTORIES_REQUIRED');
  const startedAt = new Date().toISOString();
  const fixture = Buffer.concat([Buffer.from('SYNTHETIC LOCAL DELIVERY PROBE — NOT AN ACTUAL UAT BACKUP\n'), randomBytes(150_013)]);
  const source = join(archiveDirectory, 'SYNTHETIC-source.bin');
  const destination = join(archiveDirectory, 'SYNTHETIC-archive.eaf');
  const keyPath = join(keyDirectory, 'SYNTHETIC-key.bin');
  await writeFile(source, fixture, {flag: 'wx', mode: 0o600});
  await writeFile(keyPath, randomBytes(32), {flag: 'wx', mode: 0o600});
  // Deliberately reread the key from the approved separate directory.
  const key = await readFile(keyPath);
  const binding = JSON.stringify({product: 'CoCalLab', tenant: 'SYNTHETIC_ONLY', actualNewUatRef: null, probeId});
  const options = {source, destination, key, binding};
  const artifact = await encryptArtifact(options);
  const restored = join(archiveDirectory, 'SYNTHETIC-readback.bin');
  await decryptArtifact({...options, source: destination, destination: restored, expected: artifact});
  if (!(await readFile(restored)).equals(fixture)) throw new ArtifactError('READBACK_MISMATCH');
  const protectedChecks = [];
  async function rejects(action, code) {
    try { await action(); } catch (error) {
      if (error.code === code) { protectedChecks.push(code); return; }
      throw error;
    }
    throw new ArtifactError('NEGATIVE_CHECK_DID_NOT_REFUSE');
  }
  const before = hash(await readFile(destination));
  await rejects(() => encryptArtifact(options), 'DESTINATION_EXISTS');
  await rejects(() => decryptArtifact({...options, source: destination, destination: restored, expected: artifact}), 'DESTINATION_EXISTS');
  if (hash(await readFile(destination)) !== before) throw new ArtifactError('OVERWRITE_GUARD_FAILED');
  await rejects(() => decryptArtifact({...options, key: randomBytes(32), source: destination, destination: join(archiveDirectory, 'WRONG-KEY-MUST-NOT-EXIST.bin'), expected: artifact}), 'AUTHENTICATION_FAILED');
  const corrupted = Buffer.from(await readFile(destination)); corrupted[20] ^= 1;
  const tamperPath = join(archiveDirectory, 'SYNTHETIC-tampered.eaf');
  await writeFile(tamperPath, corrupted, {flag: 'wx', mode: 0o600});
  await rejects(() => decryptArtifact({...options, source: tamperPath, destination: join(archiveDirectory, 'TAMPERED-MUST-NOT-EXIST.bin'), expected: artifact}), 'AUTHENTICATION_FAILED');
  if ((await readdir(archiveDirectory)).some(name => name.startsWith('.incomplete-') || name.includes('MUST-NOT-EXIST'))) throw new ArtifactError('UNAUTHENTICATED_OUTPUT_PRESENT');
  const manifest = {
    schemaVersion: 1, status: 'SYNTHETIC_LOCAL_FILE_READBACK_VERIFIED',
    probeId, actualNewUatRef: null, startedAt, completedAt: new Date().toISOString(),
    artifact, sourceSha256: hash(fixture), restoredSha256: hash(await readFile(restored)),
    files: {archive: 'SYNTHETIC-archive.eaf', readback: 'SYNTHETIC-readback.bin', key: 'SYNTHETIC-key.bin_IN_SEPARATE_PROTECTED_DIRECTORY'},
    implementationSha256: {
      encryption: hash(await readFile(fileURLToPath(new URL('./encrypted-artifact.mjs', import.meta.url)))),
      probe: hash(await readFile(fileURLToPath(import.meta.url))),
    },
    negativeChecks: protectedChecks,
    sameHost: true, offsiteBackup: false, ownerAcceptedActualBackup: false,
    actualDatabaseRestore: 'NOT_RUN', actualStorageRestore: 'NOT_RUN', cloudDeletion: 'NOT_AUTHORIZED_BY_THIS_PROBE',
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(archiveDirectory, 'manifest.json'), manifestBytes, {flag: 'wx', mode: 0o600});
  return {status: manifest.status, actualNewUatRef: null, manifestSha256: hash(manifestBytes), archiveSha256: artifact.ciphertextSha256, negativeChecks: protectedChecks.length};
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [archiveDirectory, keyDirectory, probeId] = process.argv.slice(2);
    console.log(JSON.stringify(await runDeliveryProbe({archiveDirectory, keyDirectory, probeId})));
  } catch { console.error('SYNTHETIC_LOCAL_DELIVERY_PROBE_FAILED'); process.exitCode = 1; }
}
