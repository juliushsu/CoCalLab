// Decision simulation only: no provider SDK, network, credentials or scheduler calls.
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const HOUR = 3_600_000;
const instant = value => {
  assert.equal(typeof value, 'string');
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
  const result = Date.parse(value);
  assert.ok(Number.isFinite(result), 'Invalid UTC timestamp');
  return result;
};
const hash = value => createHash('sha256').update(value).digest('hex');

export function simulateLifecycle({lease, observed, backup, lastAttempt, now}) {
  assert.equal(lease.mode, 'DRY_RUN_ONLY');
  assert.match(lease.ref, /^SYNTHETIC-/);
  assert.ok(lease.id && lease.organizationId && lease.projectName);
  assert.match(lease.candidateSHA, /^[a-f0-9]{40}$/);
  assert.equal(lease.retentionDays, 14);
  assert.equal(lease.backupLeadHours, 48);
  assert.equal(lease.cumulativeLimitUSD, 20);
  assert.ok(Array.isArray(lease.protectedRefs));
  const start = instant(lease.createdAt), tick = instant(now);
  const expiry = start + lease.retentionDays * 24 * HOUR;
  const backupDue = expiry - lease.backupLeadHours * HOUR;
  assert.ok(tick >= start, 'Clock precedes lease');
  const operationId = hash(JSON.stringify([lease.id, lease.ref, lease.candidateSHA, expiry, 'expire']));
  const result = {
    mode: 'DRY_RUN_ONLY', productionAuthorized: false, cloudCalls: 0,
    schedulesRegistered: 0, notificationsSent: 0,
    backupDue: new Date(backupDue).toISOString(), expiresAt: new Date(expiry).toISOString(),
    operationId, actions: [], alerts: [], wouldDelete: null, status: 'NOT_DUE',
  };
  const deny = (status, alert) => ({...result, status, alerts: [...result.alerts, alert]});
  if (lease.protectedRefs.includes(lease.ref)) return deny('BLOCKED_TARGET', 'PROTECTED_REF');
  if (observed.lookupRef !== lease.ref || observed.organizationId !== lease.organizationId ||
      (observed.exists && (observed.ref !== lease.ref || observed.projectName !== lease.projectName))) {
    return deny('BLOCKED_TARGET', 'EXACT_REF_OR_SCOPE_MISMATCH');
  }
  if (observed.lastPrimaryHeartbeat && instant(observed.lastPrimaryHeartbeat) > tick) {
    return deny('BLOCKED_CLOCK', 'FUTURE_HEARTBEAT_DO_NOT_TRUST_FRESHNESS');
  }
  if (!observed.lastPrimaryHeartbeat || tick - instant(observed.lastPrimaryHeartbeat) > HOUR) {
    result.alerts.push('PRIMARY_HEARTBEAT_MISSING_WATCHDOG_REQUIRED');
  }
  if (!Number.isFinite(observed.actualUSD) || observed.actualUSD < 0 ||
      !Number.isFinite(observed.estimatedRemainingUSD) || observed.estimatedRemainingUSD < 0) {
    return deny('WAITING_OWNER', 'COST_EVIDENCE_MISSING');
  }
  if (observed.actualUSD + observed.estimatedRemainingUSD > lease.cumulativeLimitUSD) {
    result.actions.push('STOP_TESTS_AND_NEW_PAID_WORK');
    return deny('WAITING_OWNER', 'FORECAST_EXCEEDS_CUMULATIVE_LIMIT');
  }
  if (!observed.exists) {
    result.status = 'ABSENCE_RECONCILIATION_REQUIRED';
    result.actions.push('VERIFY_EXACT_REF_ABSENCE_AND_LATER_BILLING');
    if (!lastAttempt || lastAttempt.operationId !== operationId) result.alerts.push('UNEXPLAINED_ABSENCE');
    return result;
  }
  if (tick < backupDue) return result;
  result.actions.push('STOP_TEST_WRITES');
  const validBackup = backup && backup.status === 'VERIFIED' &&
    backup.leaseId === lease.id && backup.ref === lease.ref &&
    backup.organizationId === lease.organizationId && backup.candidateSHA === lease.candidateSHA &&
    /^[a-f0-9]{64}$/.test(backup.manifestSHA256 ?? '') &&
    backup.manifestSHA256 === backup.restoredManifestSHA256 &&
    backup.requiredComponents?.length === 5 &&
    ['db', 'private-ledgers', 'proofs', 'storage-originals', 'settings'].every(x => backup.requiredComponents.includes(x)) &&
    typeof backup.restoreTarget === 'string' && backup.restoreTarget.startsWith('SYNTHETIC-RESTORE-') &&
    Number.isInteger(backup.objectCount) && backup.objectCount >= 0 &&
    backup.objectCount === backup.restoredObjectCount &&
    instant(backup.checkpointAt) >= start && instant(backup.checkpointAt) <= instant(backup.verifiedAt) &&
    instant(backup.verifiedAt) <= tick && instant(observed.lastMutationAt) <= instant(backup.checkpointAt);
  if (!validBackup) {
    result.status = tick >= expiry ? 'EXPIRED_BACKUP_RECOVERY_REQUIRED' : 'BACKUP_AND_RESTORE_REQUIRED';
    result.actions.push('BACKUP_TO_PRIVATE_STORE', 'RESTORE_TO_LISTED_TARGET_AND_VERIFY');
    if (backup || tick >= expiry) result.alerts.push('NO_VALID_CURRENT_BACKUP_DO_NOT_DELETE');
    return result;
  }
  if (tick < expiry) {
    result.status = 'BACKUP_VERIFIED_IN_SIMULATION';
    return result;
  }
  result.actions.push('STOP_TESTS');
  if (observed.activeOperation) {
    result.status = 'RECONCILE_IN_PROGRESS_OPERATION';
    result.actions.push('READ_EXISTING_OPERATION_DO_NOT_CREATE_ANOTHER');
    return result;
  }
  result.status = 'WOULD_DELETE_EXACT_REF';
  result.wouldDelete = {operationId, ref: lease.ref, organizationId: lease.organizationId};
  result.actions.push('WOULD_DELETE_EXACT_REF_THEN_VERIFY_ABSENCE_AND_BILLING');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.argv[2], '--scenario');
  const {scenario} = await import('./fixtures/lifecycle-scenarios.mjs');
  console.log(JSON.stringify(simulateLifecycle(scenario(process.argv[3])), null, 2));
}
