import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAdjustmentEvaluationResult } from '../src/services/adjustment-result.js';
const row = { requested: '12.5', eligible: '12.5', disallowed: '0', disallow_reasons: [] };
test('handler SQL response normalization preserves fully eligible zero disallowed', () => {
  const result = normalizeAdjustmentEvaluationResult(row);
  assert.equal(result.requested, 12.5);
  assert.equal(result.eligible, 12.5);
  assert.equal(result.disallowed, 0);
});
test('handler SQL response normalization retains partial and fully disallowed outcomes', () => {
  assert.deepEqual(normalizeAdjustmentEvaluationResult({ ...row, eligible: 2.5, disallowed: 10 }),
    { requested: 12.5, eligible: 2.5, disallowed: 10, disallow_reasons: [] });
  assert.equal(normalizeAdjustmentEvaluationResult({ ...row, eligible: 0, disallowed: 12.5 }).eligible, 0);
});
test('handler SQL response normalization rejects missing, invalid and inconsistent data', () => {
  for (const invalid of [null, {}, { ...row, disallowed: null }, { ...row, requested: '' },
    { ...row, eligible: 'NaN' }, { ...row, disallowed: -1 }, { ...row, disallowed: 12.5 }]) {
    assert.throws(() => normalizeAdjustmentEvaluationResult(invalid));
  }
});
