import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptSnapshotToSummary } from '../src/services/reportSnapshotAdapter.ts';

const row = () => ({
  id: 'report', project_id: 'project', organization_id: 'org',
  reporting_period_start: '2026-01-01', reporting_period_end: '2026-12-31',
  gross_emissions_snapshot: { gross_total_co2e_kg: 12345 },
  adjustment_summary: { eligible_total_tco2e: 2.5 },
  claim_results: { claim_net_co2e_kg: 9845, inventory_impact_mode: 'claim_only' },
  claim_purpose: 'internal_management',
});

test('generated JSON snapshot preserves kg/t units and project period', () => {
  const result = adaptSnapshotToSummary(row());
  assert.equal(result.gross_emissions_tco2e, 12.345);
  assert.equal(result.total_adjustments_tco2e, 2.5);
  assert.equal(result.claimable_result_tco2e, 9.845);
  assert.equal(result.period, '2026-01-01 ~ 2026-12-31');
  assert.deepEqual(result.adjustments_by_type, []);
  assert.equal(result.rule_engine_applied, false);
});
test('valid zero values remain zero; no fixture fallback for absent period', () => {
  const input = row();
  input.gross_emissions_snapshot.gross_total_co2e_kg = 0;
  input.adjustment_summary.eligible_total_tco2e = 0;
  input.claim_results.claim_net_co2e_kg = 0;
  input.reporting_period_start = input.reporting_period_end = null;
  const result = adaptSnapshotToSummary(input);
  assert.equal(result.gross_emissions_tco2e, 0);
  assert.equal(result.claimable_result_tco2e, 0);
  assert.equal(result.period, '');
});
test('partial, legacy, nonnumeric, negative and nonfinite snapshots fail explicitly', () => {
  for (const value of [null, 123, {}, { gross_total_co2e_kg: '123' }, { gross_total_co2e_kg: -1 }, { gross_total_co2e_kg: Infinity }]) {
    assert.throws(() => adaptSnapshotToSummary({ ...row(), gross_emissions_snapshot: value }), /incomplete or invalid/);
  }
  assert.throws(() => adaptSnapshotToSummary({ ...row(), adjustment_summary: null }), /eligible_total/);
  assert.throws(() => adaptSnapshotToSummary({ ...row(), claim_results: null }), /claim_net/);
});
