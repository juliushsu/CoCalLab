import { validateFactorCandidates } from '../contracts/contracts.js';
import { t } from '../i18n/messages.js';

const QUALITY_SCORE = {
  official: 40,
  industry: 30,
  proxy: 20,
  custom: 35,
};

function isWithinValidity(activityDate, factor) {
  if (!activityDate) return true;
  const d = new Date(activityDate).getTime();
  if (Number.isNaN(d)) return false;

  const start = new Date(factor.valid_from).getTime();
  if (Number.isNaN(start) || d < start) return false;

  if (!factor.valid_to) return true;
  const end = new Date(factor.valid_to).getTime();
  if (Number.isNaN(end)) return false;
  return d <= end;
}

function scoreFactor(activity, factor) {
  let score = 0;

  if (factor.organization_id && factor.organization_id === activity.organization_id) {
    score += 100;
  }

  if (factor.activity_type === activity.activity_type) {
    score += 40;
  }

  if (factor.category === activity.category) {
    score += 30;
  }

  if (factor.subcategory && factor.subcategory === activity.subcategory) {
    score += 20;
  }

  if (factor.unit === activity.normalized_unit) {
    score += 20;
  }

  score += QUALITY_SCORE[factor.quality_tier] || 0;
  score += Math.min(10, factor.version || 0);

  return score;
}

export function resolve_emission_factor({ activity, factors }) {
  validateFactorCandidates(factors);

  const eligible = factors
    .filter((factor) => factor.status === 'active')
    .filter((factor) => isWithinValidity(activity.activity_date, factor))
    .filter((factor) => !factor.organization_id || factor.organization_id === activity.organization_id)
    .filter((factor) => factor.activity_type === activity.activity_type)
    .filter((factor) => factor.unit === activity.normalized_unit);

  if (eligible.length === 0) {
    return {
      status: 'pending_factor',
      factor: null,
      factor_snapshot: null,
      warning: t('factor_not_found'),
    };
  }

  const best = eligible
    .map((factor) => ({ factor, score: scoreFactor(activity, factor) }))
    .sort((a, b) => b.score - a.score)[0].factor;

  return {
    status: 'resolved',
    factor: best,
    factor_snapshot: {
      factor_id: best.id,
      factor_key: best.factor_key,
      factor_name: best.factor_name,
      source_name: best.source_name,
      source_reference: best.source_reference,
      source_url: best.source_url,
      version: best.version,
      unit: best.unit,
      co2e_kg_per_unit: best.co2e_kg_per_unit,
      co2_kg_per_unit: best.co2_kg_per_unit,
      ch4_kg_per_unit: best.ch4_kg_per_unit,
      n2o_kg_per_unit: best.n2o_kg_per_unit,
      quality_tier: best.quality_tier,
      resolved_at: new Date().toISOString(),
    },
    warning: null,
  };
}
