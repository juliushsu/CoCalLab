import { normalizeUnit } from './unit-normalization.js';
import { resolve_emission_factor } from './resolve-emission-factor.js';
import { t } from '../i18n/messages.js';

export function calculate_emission_activity({ activity, factors, formula_version = 'v1.0.0' }) {
  const warnings = [];

  if (activity.inclusion_status === 'excluded') {
    warnings.push(t('activity_excluded'));
    return {
      status: 'superseded',
      is_latest: true,
      co2e_kg: 0,
      co2_kg: 0,
      ch4_kg: 0,
      n2o_kg: 0,
      factor_id: null,
      factor_snapshot: {},
      input_snapshot: {
        inclusion_status: activity.inclusion_status,
        exclusion_reason: activity.exclusion_reason,
      },
      formula_version,
      warnings,
      error_code: null,
      calculated_at: new Date().toISOString(),
    };
  }

  const normalized = normalizeUnit(activity.quantity, activity.unit);
  if (!normalized.ok) {
    warnings.push(normalized.warning);
    return {
      status: 'error',
      is_latest: true,
      co2e_kg: null,
      co2_kg: null,
      ch4_kg: null,
      n2o_kg: null,
      factor_id: null,
      factor_snapshot: {},
      input_snapshot: {
        quantity: activity.quantity,
        unit: activity.unit,
      },
      formula_version,
      warnings,
      error_code: 'UNSUPPORTED_UNIT',
      calculated_at: new Date().toISOString(),
    };
  }

  const activityForFactor = {
    ...activity,
    normalized_quantity: normalized.normalized_quantity,
    normalized_unit: normalized.normalized_unit,
  };

  const resolved = resolve_emission_factor({ activity: activityForFactor, factors });
  if (resolved.status !== 'resolved') {
    warnings.push(resolved.warning);
    return {
      status: 'pending_factor',
      is_latest: true,
      co2e_kg: null,
      co2_kg: null,
      ch4_kg: null,
      n2o_kg: null,
      factor_id: null,
      factor_snapshot: {},
      input_snapshot: {
        quantity: activity.quantity,
        unit: activity.unit,
        normalized_quantity: normalized.normalized_quantity,
        normalized_unit: normalized.normalized_unit,
      },
      formula_version,
      warnings,
      error_code: 'FACTOR_NOT_FOUND',
      calculated_at: new Date().toISOString(),
    };
  }

  const factor = resolved.factor;
  const quantity = normalized.normalized_quantity;

  const co2e_kg = Number((quantity * Number(factor.co2e_kg_per_unit)).toFixed(10));
  const co2_kg = factor.co2_kg_per_unit === null || factor.co2_kg_per_unit === undefined
    ? null
    : Number((quantity * Number(factor.co2_kg_per_unit)).toFixed(10));
  const ch4_kg = factor.ch4_kg_per_unit === null || factor.ch4_kg_per_unit === undefined
    ? null
    : Number((quantity * Number(factor.ch4_kg_per_unit)).toFixed(10));
  const n2o_kg = factor.n2o_kg_per_unit === null || factor.n2o_kg_per_unit === undefined
    ? null
    : Number((quantity * Number(factor.n2o_kg_per_unit)).toFixed(10));

  return {
    status: 'calculated',
    is_latest: true,
    co2e_kg,
    co2_kg,
    ch4_kg,
    n2o_kg,
    factor_id: factor.id,
    factor_snapshot: resolved.factor_snapshot,
    input_snapshot: {
      quantity: activity.quantity,
      unit: activity.unit,
      normalized_quantity: normalized.normalized_quantity,
      normalized_unit: normalized.normalized_unit,
      activity_date: activity.activity_date,
      category: activity.category,
      subcategory: activity.subcategory,
      activity_type: activity.activity_type,
    },
    formula_version,
    warnings,
    error_code: null,
    calculated_at: new Date().toISOString(),
  };
}
