// Synthetic native chooser fixtures only. No clients, credentials or application fallback.
import {mkdir, writeFile, readFile, lstat} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {syntheticPdf} from '../../backend/tools/product-preview/showcase.js';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function fixtureMode(args) {
  if (args.length === 0) return 'legacy';
  if (args.length === 1 && args[0] === '--candidate') return 'candidate';
  throw new Error('Usage: node deployment/uat/prepare-manual-fixtures.mjs [--candidate]');
}

export async function buildManualFixtureBundle(mode = 'legacy') {
  if (!['legacy', 'candidate'].includes(mode)) throw new Error('Unknown fixture mode');
  const files = [
    {name: 'SYNTHETIC-100kWh.pdf', bytes: syntheticPdf('SYNTHETIC UAT ONLY - electricity 100 kWh - January 2026')},
    {name: 'SYNTHETIC-empty.pdf', bytes: Buffer.alloc(0)},
    {name: 'SYNTHETIC-invalid.pdf', bytes: Buffer.from('SYNTHETIC invalid type: plain text, not PDF')},
  ];
  if (mode === 'candidate') {
    for (const [extension, mimeType] of [['png', 'image/png'], ['jpg', 'image/jpeg']]) {
      files.push({name: `SYNTHETIC-100kWh.${extension}`, mimeType, width: 900, height: 360,
        bytes: await readFile(new URL(`fixtures/SYNTHETIC-100kWh.${extension}`, import.meta.url))});
    }
    files.push({name: 'SYNTHETIC-png-named-pdf.pdf', bytes: files[3].bytes});
    const oversized = Buffer.alloc(10485761, 32);
    files[0].bytes.copy(oversized);
    files.push({name: 'SYNTHETIC-oversize.pdf', bytes: oversized});
  }
  // Keep the legacy manifest byte-for-byte compatible with the original generator.
  const manifest = {synthetic: true, purpose: 'manual native chooser test only; never OCR or business evidence', files: []};
  for (const file of files) {
    const valid = ['SYNTHETIC-100kWh.pdf', 'SYNTHETIC-100kWh.png', 'SYNTHETIC-100kWh.jpg'].includes(file.name);
    const entry = {name: file.name, bytes: file.bytes.length, sha256: sha256(file.bytes),
      expected: valid ? `valid synthetic ${file.name.endsWith('.pdf') ? 'PDF' : file.name.endsWith('.png') ? 'PNG' : 'JPEG'}; actual upload still requires approval` : 'reject; never create successful receipt'};
    if (file.mimeType) Object.assign(entry, {mimeType: file.mimeType, width: file.width, height: file.height});
    manifest.files.push(entry);
  }
  return {files, manifest};
}

async function checkExisting(path, bytes, name) {
  let stat;
  try { stat = await lstat(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink() || !(await readFile(path)).equals(bytes)) {
    throw new Error('Existing fixture differs or is not a regular file; preserved without overwrite: ' + name);
  }
}

export async function materializeFixtureBundle(output, bundle) {
  const entries = [...bundle.files, {name: 'manifest.json', bytes: Buffer.from(JSON.stringify(bundle.manifest, null, 2) + '\n')}];
  for (const entry of entries) {
    if (!/^[A-Za-z0-9.-]+$/.test(entry.name) || !(entry.bytes instanceof Uint8Array)) throw new Error('Invalid fixture entry');
    await checkExisting(new URL(entry.name, output), entry.bytes, entry.name);
  }
  // Preflight ALL entries before writing any. Exclusive writes preserve concurrent files,
  // but this filesystem operation is not an atomic transaction across multiple files.
  await mkdir(output, {recursive: true});
  for (const entry of entries) {
    const path = new URL(entry.name, output);
    try { await writeFile(path, entry.bytes, {flag: 'wx'}); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    await checkExisting(path, entry.bytes, entry.name);
  }
  return {output: fileURLToPath(output), ...bundle.manifest};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const mode = fixtureMode(process.argv.slice(2));
  const output = new URL(mode === 'candidate' ? '../../../tooling/manual-fixtures-20261108/' : '../../../tooling/manual-fixtures-20261107/', import.meta.url);
  console.log(JSON.stringify(await materializeFixtureBundle(output, await buildManualFixtureBundle(mode)), null, 2));
}
