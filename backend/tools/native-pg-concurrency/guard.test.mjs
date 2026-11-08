import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { targetGuard, main } from './run.mjs';

test('dedicated target guard rejects foreign hosts ports paths and users', () => {
  const temp=fs.realpathSync(os.tmpdir());
  const root=path.join(temp,'CoCalLab-PG17-20261108-'+crypto.randomUUID().slice(0,8));
  // Exclusive creation proves ownership; never reuse an existing runtime name.
  fs.mkdirSync(root);
  const launch={host:'127.0.0.1',port:55439,user:'cocal_uat_admin',maintenanceDatabase:'postgres',dataPath:path.join(root,'data'),credentialPath:path.join(root,'password.txt')};
  try {
    fs.mkdirSync(path.join(root,'data'));
    assert.doesNotThrow(()=>targetGuard(launch,root));
    for(const patch of [
      {host:'db.example.invalid'}, {host:'localhost'}, {host:'0.0.0.0'},
      {port:5432}, {port:6543}, {user:'postgres'},
      {maintenanceDatabase:'existing_project'},
      {dataPath:temp}, {credentialPath:path.join(temp,'other-password.txt')},
    ]) assert.throws(()=>targetGuard({...launch,...patch},root));
    assert.throws(()=>targetGuard(launch,temp));
    const nested=path.join(root,'CoCalLab-PG17-20261108-'+crypto.randomUUID().slice(0,8));
    assert.throws(()=>targetGuard({...launch,dataPath:path.join(nested,'data'),credentialPath:path.join(nested,'password.txt')},nested));
  } finally {
    // Only this newly generated direct child of the verified temp directory.
    assert.equal(path.dirname(path.resolve(root)),path.resolve(temp));
    assert.match(path.basename(root),/^CoCalLab-PG17-20261108-[0-9a-f]{8}$/);
    // Only empty test directories are removed. Unknown contents fail closed.
    fs.rmdirSync(path.join(root,'data'));
    fs.rmdirSync(root);
  }
});

test('unknown and multi-argument invocations fail before connection setup', async () => {
  await assert.rejects(main(['--run','--probe']));
  await assert.rejects(main(['--reset']));
  await assert.rejects(main(['postgres://not-accepted']));
  await assert.rejects(main(['--candidate','a'.repeat(40)]));
});
