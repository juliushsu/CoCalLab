import test from 'node:test';
import assert from 'node:assert/strict';
import { auditStatus } from './audit.mjs';
const good = { requestedCommit: 'a'.repeat(40), sourceCommit: 'a'.repeat(40), reportedStatus: 'STATIC_PREFLIGHT_PASS_NOT_RUNTIME_ACCEPTANCE', checks: { lock: true, bundles: true, sources: true, tools: true } };
test('offline verification preserves a valid native result, without elevating a blocked compiler', () => {
  assert.deepEqual(auditStatus(good), { status: good.reportedStatus, failures: [] });
  assert.equal(auditStatus({ ...good, reportedStatus: 'BLOCKED_OR_PARTIAL' }).status, 'BLOCKED_OR_PARTIAL');
});
test('modified evidence downgrades the displayed status rather than preserving a stale PASS', () => {
  for (const name of Object.keys(good.checks)) {
    const result = auditStatus({ ...good, checks: { ...good.checks, [name]: false } });
    assert.equal(result.status, 'EVIDENCE_INTEGRITY_FAILED');
    assert.deepEqual(result.failures, [name]);
  }
});
test('an evidence directory with the same short prefix cannot stand in for a different full commit', () => {
  const result = auditStatus({ ...good, sourceCommit: 'a'.repeat(12) + 'b'.repeat(28) });
  assert.equal(result.status, 'EVIDENCE_INTEGRITY_FAILED');
  assert.deepEqual(result.failures, ['sourceCommit']);
});
