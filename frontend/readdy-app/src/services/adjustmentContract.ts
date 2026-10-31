import type { RuleResultDTO, InventoryImpactMode } from '../types/carbonAdjustment';

export const adjustmentClaimPurposes = [
  'taiwan_carbon_fee', 'voluntary_claim', 'ifrs_s2_note', 'esg_note', 'internal_management',
] as const;
export type EvaluationClaimPurpose = typeof adjustmentClaimPurposes[number];
export interface AdjustmentEvaluationParams {
  organization_id: string;
  adjustment_item_id: string;
  claim_purpose: EvaluationClaimPurpose;
  requested_quantity_tco2e: number;
  project_id?: string;
  report_generation_id?: string;
}
export function buildAdjustmentQuery(params: AdjustmentEvaluationParams) {
  if (!params.organization_id || !params.adjustment_item_id ||
      !adjustmentClaimPurposes.includes(params.claim_purpose) ||
      !Number.isFinite(params.requested_quantity_tco2e) || params.requested_quantity_tco2e <= 0) {
    throw new Error('Organization, adjustment item, supported claim purpose and positive quantity are required');
  }
  return { ...params };
}
export function mapAdjustmentResult(value: unknown): RuleResultDTO {
  if (!value || typeof value !== 'object') throw new Error('Invalid adjustment evaluation response');
  const row = value as Record<string, unknown>;
  const number = (key: string) => {
    const v = row[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Error(`Invalid adjustment ${key}`);
    return v;
  };
  const requested = number('requested');
  const eligible = number('eligible');
  const disallowed = number('disallowed');
  const modes: InventoryImpactMode[] = ['disclosure_only', 'market_based_adjustment', 'regulatory_deduction', 'claim_only'];
  if (typeof row.adjustment_item_id !== 'string' || !row.adjustment_item_id ||
      !adjustmentClaimPurposes.includes(row.claim_purpose as EvaluationClaimPurpose) ||
      !modes.includes(row.inventory_impact_mode as InventoryImpactMode) ||
      !Array.isArray(row.disallow_reasons) || !row.disallow_reasons.every((v) => typeof v === 'string') ||
      Math.abs(requested - eligible - disallowed) > 0.000001) {
    throw new Error('Invalid adjustment evaluation response');
  }
  return {
    id: `${row.adjustment_item_id}:${row.claim_purpose}`,
    adjustment_id: row.adjustment_item_id,
    claim_purpose: row.claim_purpose as EvaluationClaimPurpose,
    jurisdiction: null,
    inventory_impact_mode: row.inventory_impact_mode as InventoryImpactMode,
    requested_tco2e: requested, eligible_tco2e: eligible, disallowed_tco2e: disallowed,
    rule_hints: row.disallow_reasons as string[],
    rule_engine_version: null, evaluated_at: null,
    is_mock: false, rule_engine_applied: true,
  };
}
