import { t } from '../i18n/messages.js';

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function summarizeScopeTotals(activities, calculationByActivityId) {
  const totals = {
    scope_1: 0,
    scope_2: 0,
    scope_3: 0,
    unknown: 0,
  };

  for (const activity of activities) {
    if (activity.inclusion_status !== 'included') continue;

    const scope = activity.final_scope || activity.suggested_scope;
    const calc = calculationByActivityId.get(activity.id);
    const co2e = toNumber(calc?.co2e_kg);

    if (scope === 1) totals.scope_1 += co2e;
    else if (scope === 2) totals.scope_2 += co2e;
    else if (scope === 3) totals.scope_3 += co2e;
    else totals.unknown += co2e;
  }

  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, Number(value.toFixed(10))]),
  );
}

function summarizeCategoryTotals(activities, calculationByActivityId) {
  const totals = {};

  for (const activity of activities) {
    if (activity.inclusion_status !== 'included') continue;

    const category = activity.category || 'uncategorized';
    const calc = calculationByActivityId.get(activity.id);
    const co2e = toNumber(calc?.co2e_kg);

    totals[category] = Number(((totals[category] || 0) + co2e).toFixed(10));
  }

  return totals;
}

function uniqueFactorSources(calculationResults) {
  const map = new Map();

  for (const row of calculationResults) {
    if (!row.factor_snapshot || !row.factor_snapshot.factor_id) continue;
    const snapshot = row.factor_snapshot;
    const key = `${snapshot.factor_id}:${snapshot.version}`;
    if (!map.has(key)) {
      map.set(key, {
        factor_id: snapshot.factor_id,
        factor_key: snapshot.factor_key,
        factor_name: snapshot.factor_name,
        source_name: snapshot.source_name,
        source_reference: snapshot.source_reference,
        source_url: snapshot.source_url,
        version: snapshot.version,
        quality_tier: snapshot.quality_tier,
      });
    }
  }

  return Array.from(map.values());
}

export function build_report_payload({ project, activities, calculation_results }) {
  const calculationByActivityId = new Map(
    calculation_results
      .filter((row) => row.is_latest !== false)
      .map((row) => [row.emission_activity_id, row]),
  );

  const included = activities.filter((a) => a.inclusion_status === 'included');
  const excluded = activities.filter((a) => a.inclusion_status === 'excluded');
  const pending = activities.filter((a) => a.inclusion_status === 'pending');

  const data_gaps = [];
  if (pending.length > 0) {
    data_gaps.push(t('report_has_pending_items'));
  }

  const pendingFactorRows = calculation_results.filter((row) => row.status === 'pending_factor');
  for (const row of pendingFactorRows) {
    if (Array.isArray(row.warnings)) {
      for (const warning of row.warnings) {
        data_gaps.push(warning);
      }
    }
  }

  return {
    project_metadata: {
      project_id: project.id,
      organization_id: project.organization_id,
      project_code: project.project_code,
      name: project.name,
      status: project.status,
    },
    reporting_period: {
      start_date: project.reporting_start_date,
      end_date: project.reporting_end_date,
    },
    boundary_summary: {
      boundary_type: project.boundary_type,
      included_count: included.length,
      excluded_count: excluded.length,
      pending_count: pending.length,
    },
    included_activities_summary: included.map((activity) => ({
      emission_activity_id: activity.id,
      activity_code: activity.activity_code,
      activity_name: activity.activity_name,
      activity_date: activity.activity_date,
      category: activity.category,
      subcategory: activity.subcategory,
      final_scope: activity.final_scope,
      co2e_kg: toNumber(calculationByActivityId.get(activity.id)?.co2e_kg),
    })),
    excluded_items_summary: excluded.map((activity) => ({
      emission_activity_id: activity.id,
      activity_code: activity.activity_code,
      activity_name: activity.activity_name,
      exclusion_reason: activity.exclusion_reason,
      review_note: activity.review_note,
    })),
    scope_totals: summarizeScopeTotals(activities, calculationByActivityId),
    category_totals: summarizeCategoryTotals(activities, calculationByActivityId),
    factor_sources_used: uniqueFactorSources(calculation_results),
    data_gaps_and_warnings: data_gaps,
    ai_summary_placeholder: t('ai_summary_placeholder'),
    appendix_mappings: activities.map((activity) => ({
      emission_activity_id: activity.id,
      source_draft_id: activity.source_draft_id,
      source_document_id: activity.source_document_id,
      calculation_result_id: calculationByActivityId.get(activity.id)?.id || null,
    })),
  };
}
