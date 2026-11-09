import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateLifecycle} from './lifecycle-dry-run.mjs';
import {scenario} from './fixtures/lifecycle-scenarios.mjs';

test('before T-48h no backup or delete is proposed', () => {
  const x = scenario();x.now = '2026-11-20T23:59:59Z';x.backup = null;x.observed.lastPrimaryHeartbeat=x.now;
  assert.equal(simulateLifecycle(x).status, 'NOT_DUE');
});
test('T-48h begins backup and explicit restore verification', () => {
  const r = simulateLifecycle(scenario('backup-due'));
  assert.equal(r.status, 'BACKUP_AND_RESTORE_REQUIRED');assert.equal(r.wouldDelete, null);
  assert.ok(r.actions.includes('RESTORE_TO_LISTED_TARGET_AND_VERIFY'));
});
test('expiry with a consistent synthetic receipt targets exactly the new ref', () => {
  const x = scenario(), r = simulateLifecycle(x);
  assert.equal(r.wouldDelete.ref, x.lease.ref);assert.equal(r.cloudCalls, 0);
  assert.equal(r.schedulesRegistered, 0);assert.equal(r.productionAuthorized, false);
});
test('one second before expiry cannot delete even with verified backup', () => {
  const x = scenario();x.now = '2026-11-22T23:59:59Z';x.observed.lastPrimaryHeartbeat=x.now;
  const r=simulateLifecycle(x);assert.equal(r.status,'BACKUP_VERIFIED_IN_SIMULATION');assert.equal(r.wouldDelete, null);
});
test('backup failure, missing backup, and restore mismatch prevent deletion', () => {
  for (const fault of ['missing','failed','restore-mismatch']) {
    const x = scenario();if(fault==='missing')x.backup=null;
    else if(fault==='failed')x.backup.status='FAILED';else x.backup.restoredManifestSHA256='b'.repeat(64);
    const r=simulateLifecycle(x);assert.equal(r.wouldDelete,null);assert.ok(r.alerts.includes('NO_VALID_CURRENT_BACKUP_DO_NOT_DELETE'));
  }
});
test('same name cannot authorize a different ref or organization', () => {
  for (const key of ['ref','lookupRef','organizationId']) {
    const x=scenario();x.observed[key]='SYNTHETIC-OTHER';assert.equal(simulateLifecycle(x).status,'BLOCKED_TARGET');
  }
});
test('protected existing ref cannot become the lease target', () => {
  const x=scenario();x.lease.protectedRefs.push(x.lease.ref);assert.equal(simulateLifecycle(x).wouldDelete,null);
});
test('backup for another lease, ref or candidate cannot authorize deletion', () => {
  for(const key of ['leaseId','ref','organizationId','candidateSHA']) {
    const x=scenario();x.backup[key]='SYNTHETIC-OTHER';assert.equal(simulateLifecycle(x).wouldDelete,null);
  }
});
test('missing private evidence, storage object or restore target blocks deletion', () => {
  for(const fault of ['component','object','target']) {
    const x=scenario();if(fault==='component')x.backup.requiredComponents.pop();
    else if(fault==='object')x.backup.restoredObjectCount=1;else x.backup.restoreTarget=null;
    assert.equal(simulateLifecycle(x).wouldDelete,null);
  }
});
test('post-checkpoint writes or a future verification receipt invalidate backup', () => {
  const x=scenario();x.observed.lastMutationAt='2026-11-22T00:00:00Z';assert.equal(simulateLifecycle(x).wouldDelete,null);
  const y=scenario();y.backup.verifiedAt='2026-11-24T00:00:00Z';assert.equal(simulateLifecycle(y).wouldDelete,null);
});
test('missed primary execution raises cloud-watchdog requirement and catches up after expiry', () => {
  const x=scenario('missed-primary');x.now='2026-11-23T02:00:00Z';const r=simulateLifecycle(x);
  assert.ok(r.alerts.includes('PRIMARY_HEARTBEAT_MISSING_WATCHDOG_REQUIRED'));assert.equal(r.wouldDelete.ref,x.lease.ref);
});
test('missed backup cannot be skipped during delayed expiry catch-up', () => {
  const r=simulateLifecycle(scenario('expired-missing-backup'));
  assert.equal(r.status,'EXPIRED_BACKUP_RECOVERY_REQUIRED');assert.equal(r.wouldDelete,null);
});
test('future heartbeat cannot hide a missed execution', () => {
  const x=scenario();x.observed.lastPrimaryHeartbeat='2026-11-24T00:00:00Z';
  const r=simulateLifecycle(x);assert.equal(r.status,'BLOCKED_CLOCK');assert.equal(r.wouldDelete,null);
});
test('repeat decisions keep the same operation id; in-progress operation is reconciled', () => {
  const x=scenario(), first=simulateLifecycle(x);x.now='2026-11-23T00:15:00Z';
  assert.equal(simulateLifecycle(x).operationId,first.operationId);
  x.observed.activeOperation=first.operationId;assert.equal(simulateLifecycle(x).wouldDelete,null);
});
test('lost delete reply uses exact-ref absence reconciliation, never a name lookup', () => {
  const x=scenario();x.lastAttempt={operationId:simulateLifecycle(x).operationId};x.observed.exists=false;
  const r=simulateLifecycle(x);assert.equal(r.status,'ABSENCE_RECONCILIATION_REQUIRED');assert.equal(r.wouldDelete,null);
  assert.equal(r.alerts.includes('UNEXPLAINED_ABSENCE'),false);
});
test('unknown or over-budget costs stop new paid work and require Owner decision', () => {
  for(const cost of [null,21]){const x=scenario();x.observed.actualUSD=cost;const r=simulateLifecycle(x);assert.equal(r.status,'WAITING_OWNER');assert.equal(r.wouldDelete,null);}
});
test('real refs or execution mode are rejected and input is not mutated', () => {
  const x=scenario(), before=structuredClone(x);simulateLifecycle(x);assert.deepEqual(x,before);
  x.lease.mode='LIVE';assert.throws(()=>simulateLifecycle(x));x.lease.mode='DRY_RUN_ONLY';x.lease.ref='real-ref';assert.throws(()=>simulateLifecycle(x));
});
