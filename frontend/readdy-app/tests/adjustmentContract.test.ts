import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdjustmentQuery, mapAdjustmentResult } from '../src/services/adjustmentContract.ts';

const params = {
  organization_id: 'org-a', adjustment_item_id: 'item-a',
  claim_purpose: 'voluntary_claim' as const, requested_quantity_tco2e: 12.5,
};
const row = {
  organization_id: 'org-a', adjustment_item_id: 'item-a', claim_purpose: 'voluntary_claim',
  requested: 12.5, eligible: 12.5, disallowed: 0, disallow_reasons: [], inventory_impact_mode: 'claim_only',
};

test('evaluation query preserves required canonical identifiers and tonnes without aliases', () => {
  assert.deepEqual(buildAdjustmentQuery(params), params);
  assert.throws(() => buildAdjustmentQuery({ ...params, organization_id: '' }));
  assert.throws(() => buildAdjustmentQuery({ ...params, requested_quantity_tco2e: 0 }));
  assert.throws(() => buildAdjustmentQuery({ ...params, requested_quantity_tco2e: NaN }));
  assert.throws(() => buildAdjustmentQuery({ ...params, claim_purpose: 'voluntary_offset' as never }));
});

test('single canonical response adapts to UI and preserves full eligibility zero disallowed', () => {
  const result = mapAdjustmentResult(row);
  assert.equal(result.eligible_tco2e, 12.5);
  assert.equal(result.disallowed_tco2e, 0);
  assert.equal(result.adjustment_id, 'item-a');
  assert.equal(result.is_mock, false);
  assert.equal(result.evaluated_at, null);
});

test('denial reasons and partial eligibility retain backend units and quantities', () => {
  const result = mapAdjustmentResult({ ...row, eligible: 2.5, disallowed: 10, disallow_reasons: ['quantity_limit'] });
  assert.equal(result.requested_tco2e, 12.5);
  assert.deepEqual(result.rule_hints, ['quantity_limit']);
  assert.equal(result.disallowed_tco2e, 10);
});

test('missing, array, invalid and inconsistent responses fail instead of manufacturing eligibility', () => {
  for (const invalid of [null, [], { results: [row] }, { ...row, eligible: '12.5' },
    { ...row, disallowed: 12.5 }, { ...row, eligible: -1 }, { ...row, inventory_impact_mode: 'unknown' }]) {
    assert.throws(() => mapAdjustmentResult(invalid));
  }
});
