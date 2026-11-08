import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, writeFile, readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildManualFixtureBundle, materializeFixtureBundle, fixtureMode} from '../../deployment/uat/prepare-manual-fixtures.mjs';
import {verifyStoredFile} from '../../modules/file-verification/index.js';

const bundle = await buildManualFixtureBundle('candidate');
const root = new URL('../../../tooling/fixture-tests/', import.meta.url);
await mkdir(root, {recursive: true});
const temporary = async () => pathToFileURL((await mkdtemp(new URL('run-', root))) + '/');
const check = (file, mimeType) => verifyStoredFile({
  storage: {read: async () => ({body: file.bytes, mimeType, contentLength: file.bytes.length})},
  reference: {synthetic: true}, expected: {size: file.bytes.length, mimeType},
});

test('legacy fixture PDF and manifest preserve existing bytes and expectations', async () => {
  const legacy = await buildManualFixtureBundle();
  assert.equal(legacy.files.length, 3);
  assert.equal(legacy.manifest.files[0].bytes, 740);
  assert.equal(legacy.manifest.files[0].sha256, '0c6a8243d7377da2708a3847e4b1140117fb222d30a18b4ca914ee3ff9bf6d83');
  assert.deepEqual(legacy.manifest.files, bundle.manifest.files.slice(0, 3));
  assert.equal(legacy.manifest.files[0].expected, 'valid synthetic PDF; actual upload still requires approval');
});

test('candidate PDF, PNG and JPEG are verified from their actual bytes', async () => {
  for (const [name, mimeType] of [['SYNTHETIC-100kWh.pdf', 'application/pdf'], ['SYNTHETIC-100kWh.png', 'image/png'], ['SYNTHETIC-100kWh.jpg', 'image/jpeg']]) {
    const file = bundle.files.find(item => item.name === name);
    const result = await check(file, mimeType);
    assert.equal(result.sha256, bundle.manifest.files.find(item => item.name === name).sha256);
    assert.equal(result.size, file.bytes.length);
  }
  const png = bundle.files.find(item => item.name.endsWith('.png')).bytes;
  assert.equal(png.readUInt32BE(16), 900);
  assert.equal(png.readUInt32BE(20), 360);
  const jpeg = bundle.files.find(item => item.name.endsWith('.jpg')).bytes;
  assert.deepEqual([...jpeg.subarray(-2)], [255, 217]);
});

test('negative chooser files are refused by actual size/signature checks', async () => {
  for (const [name, code] of [['SYNTHETIC-empty.pdf', 'FILE_SIZE_INVALID'], ['SYNTHETIC-invalid.pdf', 'FILE_SIGNATURE_INVALID'], ['SYNTHETIC-png-named-pdf.pdf', 'FILE_SIGNATURE_INVALID'], ['SYNTHETIC-oversize.pdf', 'FILE_SIZE_INVALID']]) {
    const file = bundle.files.find(item => item.name === name);
    await assert.rejects(check(file, 'application/pdf'), error => error.code === code);
    assert.equal(bundle.manifest.files.find(item => item.name === name).expected, 'reject; never create successful receipt');
  }
});

test('materialization reads back unchanged bytes and can safely resume', async () => {
  const output = await temporary();
  await materializeFixtureBundle(output, bundle);
  await materializeFixtureBundle(output, bundle);
  for (const file of bundle.files) assert.deepEqual(await readFile(new URL(file.name, output)), file.bytes);
  assert.deepEqual(JSON.parse(await readFile(new URL('manifest.json', output))), bundle.manifest);
});

test('existing different fixture is preserved before any other files are added', async () => {
  const output = await temporary();
  const name = bundle.files.at(-1).name;
  await writeFile(new URL(name, output), 'SYNTHETIC existing content');
  await assert.rejects(materializeFixtureBundle(output, bundle), /preserved without overwrite/);
  assert.deepEqual(await readdir(output), [name]);
  assert.equal(await readFile(new URL(name, output), 'utf8'), 'SYNTHETIC existing content');
});

test('existing different manifest is preserved before any fixture is written', async () => {
  const output = await temporary();
  await writeFile(new URL('manifest.json', output), '{"synthetic":"existing"}');
  await assert.rejects(materializeFixtureBundle(output, bundle), /preserved without overwrite/);
  assert.deepEqual(await readdir(output), ['manifest.json']);
});

test('CLI only accepts its fixed destinations, never a supplied output path', () => {
  assert.equal(fixtureMode([]), 'legacy');
  assert.equal(fixtureMode(['--candidate']), 'candidate');
  for (const args of [['--out', '../elsewhere'], ['--candidate', '../elsewhere'], ['../elsewhere']]) assert.throws(() => fixtureMode(args), /Usage:/);
});
