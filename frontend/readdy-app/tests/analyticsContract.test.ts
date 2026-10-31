import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyticsQuery, parseAnalyticsResponse } from '../src/services/analyticsContract.ts';

test('GET query uses canonical organization and dimension; missing organization rejects', () => {
  assert.deepEqual(analyticsQuery({ organization_id: 'org-1', project_id: 'project-1', dimension: 'ghg_scope' }), { organization_id: 'org-1', project_id: 'project-1', dimension: 'ghg_scope' });
  assert.throws(() => analyticsQuery({ organization_id: '', dimension: 'ghg_scope' }));
});
test('converts kg to tonnes exactly once and calculates shares', () => {
  const result = parseAnalyticsResponse({ dimension: 'ghg_scope', rows: [{ classification_code: 'scope_1', total_co2e_kg: 1500 }, { classification_code: 'scope_2', total_co2e_kg: 500 }], total_co2e_kg: 2000 }, 'ghg_scope');
  assert.equal(result.total_tco2e, 2);
  assert.deepEqual(result.items.map(x => [x.value_tco2e, x.percentage]), [[1.5, 75], [.5, 25]]);
  assert.equal(result.trend, undefined);
  assert.equal(result.is_mock, false);
});
test('empty and zero data stay empty or zero without manufactured trends', () => {
  assert.deepEqual(parseAnalyticsResponse({ dimension: 'iso_category', rows: [], total_co2e_kg: 0 }, 'iso_category').items, []);
  assert.equal(parseAnalyticsResponse({ dimension: 'iso_category', rows: [{classification_code:'category_1', total_co2e_kg:0}], total_co2e_kg: 0 }, 'iso_category').items[0].percentage, 0);
});
test('malformed, wrong dimension and inconsistent totals reject instead of becoming demo data', () => {
  for (const payload of [null, {dimension:'iso_category',rows:[],total_co2e_kg:0}, {dimension:'ghg_scope',rows:[],total_co2e_kg:1}, {dimension:'ghg_scope',rows:[{classification_code:'scope_1',total_co2e_kg:NaN}],total_co2e_kg:0}]) {
    assert.throws(() => parseAnalyticsResponse(payload, 'ghg_scope'));
  }
});
