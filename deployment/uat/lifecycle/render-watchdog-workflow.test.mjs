import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWatchdogWorkflow} from './render-watchdog-workflow.mjs';

test('workflow cannot follow a mutable branch or user-controlled checkout',()=>{
  for(const ref of ['main','codex/source','a'.repeat(39),'a'.repeat(40)+'\n','a'.repeat(40)+'\nextra'])assert.throws(()=>renderWatchdogWorkflow(ref));
  const y=renderWatchdogWorkflow('a'.repeat(40));assert.match(y,/ref: a{40}\n/);assert.doesNotMatch(y,/pull_request|github\.event\.pull_request/);
});
test('both jobs are main-only and live observation requires explicit activation',()=>{
  const y=renderWatchdogWorkflow('a'.repeat(40));assert.equal(y.match(/github.ref == 'refs\/heads\/main'/g).length,2);
  assert.match(y,/vars\.UAT_LIFECYCLE_ENABLED == 'true'/);assert.match(y,/notification-failure-probe/);
  const probe=y.slice(y.indexOf('  notification-probe:'),y.indexOf('  observe:'));assert.doesNotMatch(probe,/secrets\.|checkout|RAILWAY/);assert.match(probe,/exit 1/);
});
test('secrets are individual, only on observer step; no artifacts or write token',()=>{
  const y=renderWatchdogWorkflow('a'.repeat(40));assert.match(y,/permissions:\n  contents: read\n/);assert.match(y,/persist-credentials: false/);
  assert.doesNotMatch(y,/SUPABASE|service_role|upload-artifact|npm |secrets\..*JSON|contents: write|actions: write/);
  assert.equal(y.match(/uses: .*@[a-f0-9]{40}/g).length,2);
  assert.ok(y.indexOf('secrets.UAT_RAILWAY_PROJECT_TOKEN')>y.indexOf('- name: Read the isolated'));
});
