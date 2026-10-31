import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptReportData, type ReportRow } from '../src/services/reportAdapter.ts';
const row = (): ReportRow => ({ id: 'r', project_id: 'p', report_version: 1, status: 'completed',
  created_at: '2026-01-01', updated_at: '2026-01-02', scope_totals: { scope_1: 1500, scope_2: 500, scope_3: 0 },
  category_totals: { category_1: 1500, category_2: 500 },
  included_activity_count: 2, excluded_activity_count: 1, pending_activity_count: 0 });
test('report kg totals and category values become tCO2e without inventing chapter completion', () => {
  const result = adaptReportData(row());
  assert.equal(result.statistics?.total_emissions, 2);
  assert.equal(result.statistics?.scope1_emissions, 1.5);
  assert.equal(result.statistics?.scope3_emissions, 0);
  assert.deepEqual(result.statistics?.emission_by_category[0], { category: 'category_1', emissions: 1.5, percentage: 75 });
  assert.equal(result.report.completed_sections, 0);
  assert.equal(result.report.total_sections, 0);
  assert.deepEqual(result.sections, []);
});
test('absent, partial and invalid totals remain unknown instead of turning into zero', () => {
  for (const scopes of [null, {}, { scope_1: 100 }, { scope_1: '100', scope_2: 0, scope_3: 0 }, { scope_1: -1, scope_2: 0, scope_3: 0 }]) {
    assert.equal(adaptReportData({ ...row(), scope_totals: scopes }).statistics, null);
  }
});
test('complete zero totals are valid, missing counts stay unknown', () => {
  const result = adaptReportData({ ...row(), scope_totals: { scope_1: 0, scope_2: 0, scope_3: 0 }, category_totals: {} });
  assert.equal(result.statistics?.total_emissions, 0);
  assert.equal(adaptReportData({ ...row(), included_activity_count: undefined }).statistics, null);
});

test('unclassified emissions are included in gross total and exposed separately', () => {
  const result = adaptReportData({ ...row(), scope_totals: { scope_1: 1500, scope_2: 500, scope_3: 0, unknown: 750 } });
  assert.equal(result.statistics?.total_emissions, 2.75);
  assert.equal(result.statistics?.unclassified_emissions, 0.75);
  assert.equal(result.statistics?.scope1_emissions, 1.5);
  assert.equal(result.statistics?.verified_activities, null);
  for (const unknown of [null, -1, '750', Infinity]) {
    assert.equal(adaptReportData({ ...row(), scope_totals: { scope_1: 0, scope_2: 0, scope_3: 0, unknown } }).statistics, null);
  }
});
