import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalize_extracted_document_draft,
  classify_document_draft,
  resolve_emission_factor,
  calculate_emission_activity,
  recalculate_project,
  build_report_payload,
  run_ai_audit,
  enforce_subscription_readonly,
} from '../src/services/index.js';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '51111111-1111-4111-8111-111111111111';

const FACTORS = [
  {
    id: '61111111-1111-4111-8111-111111111111',
    organization_id: null,
    factor_key: 'tw-grid-electricity',
    factor_name: 'Taiwan Grid Electricity',
    source_name: 'MOENV',
    source_reference: 'TW-EF-2026',
    source_url: 'https://www.moenv.gov.tw',
    category: 'energy',
    subcategory: 'purchased_electricity',
    activity_type: 'electricity',
    unit: 'kWh',
    co2e_kg_per_unit: 0.509,
    co2_kg_per_unit: null,
    ch4_kg_per_unit: null,
    n2o_kg_per_unit: null,
    quality_tier: 'official',
    status: 'active',
    version: 1,
    valid_from: '2026-01-01',
    valid_to: null,
  },
];

test('normalize_extracted_document_draft should normalize basic OCR payload', () => {
  const result = normalize_extracted_document_draft({
    ocr_payload: {
      vendor: 'Taiwan Power',
      invoice_date: '2026-02-01',
      quantity: '1000',
      unit: 'kwh',
      total_amount: '5000',
      text_blocks: ['electric bill'],
    },
  });

  assert.equal(result.status, 'pending_review');
  assert.equal(result.normalized_payload.normalized_unit, 'kWh');
  assert.equal(result.normalized_payload.normalized_quantity, 1000);
  assert.equal(result.warnings.length, 0);
});

test('classify_document_draft should classify electricity bill to scope 2', () => {
  const result = classify_document_draft({
    normalized_payload: {
      vendor: 'Taiwan Electric Company',
      raw_text_snippets: ['electric service fee'],
      normalized_quantity: 100,
      activity_date: '2026-02-01',
    },
  });

  assert.equal(result.suggested_category, 'energy');
  assert.equal(result.activity_type, 'electricity');
  assert.equal(result.suggested_scope, 2);
  assert.equal(result.inclusion_status, 'included');
});

test('resolve_emission_factor should resolve best matching factor', () => {
  const result = resolve_emission_factor({
    activity: {
      organization_id: ORGANIZATION_ID,
      activity_date: '2026-03-01',
      category: 'energy',
      subcategory: 'purchased_electricity',
      activity_type: 'electricity',
      normalized_unit: 'kWh',
    },
    factors: FACTORS,
  });

  assert.equal(result.status, 'resolved');
  assert.equal(result.factor_snapshot.factor_key, 'tw-grid-electricity');
});

test('calculate_emission_activity should return pending when factor does not exist', () => {
  const result = calculate_emission_activity({
    activity: {
      id: 'a1',
      organization_id: ORGANIZATION_ID,
      activity_date: '2026-03-01',
      category: 'waste',
      subcategory: 'unknown',
      activity_type: 'waste',
      quantity: 20,
      unit: 'kg',
      inclusion_status: 'included',
    },
    factors: FACTORS,
  });

  assert.equal(result.status, 'pending_factor');
  assert.equal(result.error_code, 'FACTOR_NOT_FOUND');
  assert.ok(result.warnings[0].zh_tw);
  assert.ok(result.warnings[0].en);
  assert.ok(result.warnings[0].ja);
});

test('recalculate_project should aggregate calculation counters', () => {
  const result = recalculate_project({
    organization_id: ORGANIZATION_ID,
    project_id: PROJECT_ID,
    activities: [
      {
        id: 'ea1',
        organization_id: ORGANIZATION_ID,
        activity_date: '2026-03-01',
        category: 'energy',
        subcategory: 'purchased_electricity',
        activity_type: 'electricity',
        quantity: 100,
        unit: 'kWh',
        inclusion_status: 'included',
      },
      {
        id: 'ea2',
        organization_id: ORGANIZATION_ID,
        activity_date: '2026-03-01',
        category: 'energy',
        subcategory: 'purchased_electricity',
        activity_type: 'electricity',
        quantity: 100,
        unit: 'kWh',
        inclusion_status: 'excluded',
        exclusion_reason: 'outside boundary',
      },
    ],
    factors: FACTORS,
  });

  assert.equal(result.processed_activities, 2);
  assert.equal(result.calculated_count, 1);
  assert.equal(result.excluded_count, 1);
  assert.equal(result.pending_factor_count, 0);
});

test('build_report_payload should include required summary sections', () => {
  const payload = build_report_payload({
    project: {
      id: PROJECT_ID,
      organization_id: ORGANIZATION_ID,
      project_code: 'PJT-2026-001',
      name: 'Inventory 2026',
      status: 'active',
      boundary_type: 'operational_control',
      reporting_start_date: '2026-01-01',
      reporting_end_date: '2026-12-31',
    },
    activities: [
      {
        id: 'ea1',
        source_draft_id: 'd1',
        source_document_id: 'doc1',
        activity_code: 'EA-000001',
        activity_name: 'Electricity usage',
        activity_date: '2026-03-01',
        category: 'energy',
        subcategory: 'purchased_electricity',
        inclusion_status: 'included',
        final_scope: 2,
      },
      {
        id: 'ea2',
        source_draft_id: 'd2',
        source_document_id: 'doc2',
        activity_code: 'EA-000002',
        activity_name: 'Taxi',
        activity_date: '2026-03-01',
        category: 'business_travel',
        subcategory: 'transport',
        inclusion_status: 'excluded',
        exclusion_reason: 'personal commute',
      },
    ],
    calculation_results: [
      {
        id: 'cr1',
        emission_activity_id: 'ea1',
        is_latest: true,
        status: 'calculated',
        co2e_kg: 50.9,
        factor_snapshot: {
          factor_id: FACTORS[0].id,
          factor_key: FACTORS[0].factor_key,
          factor_name: FACTORS[0].factor_name,
          source_name: FACTORS[0].source_name,
          source_reference: FACTORS[0].source_reference,
          source_url: FACTORS[0].source_url,
          version: FACTORS[0].version,
          quality_tier: FACTORS[0].quality_tier,
        },
      },
    ],
  });

  assert.ok(payload.project_metadata);
  assert.ok(payload.reporting_period);
  assert.ok(payload.boundary_summary);
  assert.ok(payload.scope_totals);
  assert.ok(payload.category_totals);
  assert.ok(Array.isArray(payload.factor_sources_used));
  assert.ok(Array.isArray(payload.data_gaps_and_warnings));
  assert.ok(payload.ai_summary_placeholder.zh_tw);
  assert.ok(payload.ai_summary_placeholder.en);
  assert.ok(payload.ai_summary_placeholder.ja);
});

test('run_ai_audit should produce structured audit output', () => {
  const report_payload = {
    boundary_summary: {
      included_count: 2,
      excluded_count: 1,
      pending_count: 1,
    },
    included_activities_summary: [
      { emission_activity_id: 'ea1', category: 'energy', co2e_kg: 100 },
      { emission_activity_id: 'ea2', category: 'transport', co2e_kg: 50 },
    ],
    excluded_items_summary: [{ emission_activity_id: 'ea3', exclusion_reason: 'n/a' }],
    category_totals: {
      energy: 100,
      transport: 50,
    },
  };

  const result = run_ai_audit({ report_payload });

  assert.equal(result.status, 'completed');
  assert.ok(Array.isArray(result.completeness_flags));
  assert.ok(Array.isArray(result.anomaly_flags));
  assert.ok(Array.isArray(result.exclusion_review_flags));
  assert.ok(Array.isArray(result.hotspot_ranking));
  assert.ok(result.summary_text.zh_tw);
  assert.ok(result.summary_text.en);
  assert.ok(result.summary_text.ja);
});

test('enforce_subscription_readonly should switch to readonly after grace period', () => {
  const result = enforce_subscription_readonly({
    organization_id: ORGANIZATION_ID,
    as_of: '2026-04-30T00:00:00.000Z',
    subscriptions: [
      {
        status: 'active',
        period_end: '2026-03-31T00:00:00.000Z',
        grace_until: '2026-04-10T00:00:00.000Z',
      },
    ],
  });

  assert.equal(result.effective_status, 'readonly');
  assert.equal(result.can_write_formal_data, false);
  assert.equal(result.can_generate_report, false);
  assert.ok(result.reason.zh_tw);
});
