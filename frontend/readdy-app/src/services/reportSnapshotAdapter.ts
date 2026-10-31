import type { EmissionsSummaryDTO } from '../types/carbonAdjustment';

/** The JSON snapshot written by generate-report, not a live inventory total. */
export interface ReportGenerationSnapshotRow {
  id: string;
  project_id: string;
  organization_id: string;
  reporting_period_start: string | null;
  reporting_period_end: string | null;
  gross_emissions_snapshot: { gross_total_co2e_kg?: unknown } | null;
  adjustment_summary: { eligible_total_tco2e?: unknown } | null;
  claim_results: { claim_net_co2e_kg?: unknown; inventory_impact_mode?: string } | null;
  claim_purpose: string | null;
}

function snapshotNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Report snapshot is incomplete or invalid: ${field}`);
  }
  return value;
}

export function adaptSnapshotToSummary(row: ReportGenerationSnapshotRow): EmissionsSummaryDTO {
  const grossKg = snapshotNumber(row.gross_emissions_snapshot?.gross_total_co2e_kg, 'gross_total_co2e_kg');
  const adjustments = snapshotNumber(row.adjustment_summary?.eligible_total_tco2e, 'eligible_total_tco2e');
  const netKg = snapshotNumber(row.claim_results?.claim_net_co2e_kg, 'claim_net_co2e_kg');
  return {
    project_id: row.project_id,
    period: [row.reporting_period_start, row.reporting_period_end].filter(Boolean).join(' ~ '),
    gross_emissions_tco2e: grossKg / 1000,
    total_adjustments_tco2e: adjustments,
    adjustments_by_type: [], // Snapshot does not contain a type breakdown.
    claimable_result_tco2e: netKg / 1000,
    claimable_note: null,
    claim_purpose_label: null,
    has_pending_adjustments: false, // Only approved/applied applications are in this snapshot.
    rule_engine_applied: false, // Persisted eligibility is not proof of a fresh rule evaluation.
  };
}
