/**
 * Report Snapshot Service — read path adapter
 * Reads three-layer snapshot fields from `report_generations` table.
 *
 * Codex has extended report_generations with:
 *   - gross_emissions_snapshot  (number | null)
 *   - adjustment_summary        (JSON | null)
 *   - claim_results             (JSON | null)
 *   - adjustment_manifest       (JSON | null)
 *   - claim_purpose             (string | null)
 *
 * This service reads those fields and adapts them to EmissionsSummaryDTO shape.
 * Falls back to mockEmissionsSummary if fields are absent.
 */

import { getSupabaseClient, isSupabaseConnected } from '@/lib/supabase';
import type { EmissionsSummaryDTO } from '@/types/carbonAdjustment';
import { mockEmissionsSummary } from '@/mocks/carbonAdjustments.fixture';

// ─── Codex extended report_generation row ────────────────────────────────────
export interface ReportGenerationSnapshotRow {
  id: string;
  project_id: string;
  reporting_period_start: string | null;
  reporting_period_end: string | null;
  gross_emissions_snapshot: number | null;
  adjustment_summary: {
    total_adjustments_tco2e?: number;
    adjustments_by_type?: EmissionsSummaryDTO['adjustments_by_type'];
    has_pending_adjustments?: boolean;
  } | null;
  claim_results: {
    claimable_result_tco2e?: number;
    claimable_note?: string | null;
    claim_purpose_label?: string | null;
  } | null;
  adjustment_manifest: unknown | null;
  claim_purpose: string | null;
}

// ─── Adapter: row → EmissionsSummaryDTO ──────────────────────────────────────
export function adaptSnapshotToSummary(
  row: ReportGenerationSnapshotRow
): EmissionsSummaryDTO {
  const gross = row.gross_emissions_snapshot ?? mockEmissionsSummary.gross_emissions_tco2e;
  const totalAdj = row.adjustment_summary?.total_adjustments_tco2e
    ?? mockEmissionsSummary.total_adjustments_tco2e;
  const claimable = row.claim_results?.claimable_result_tco2e
    ?? mockEmissionsSummary.claimable_result_tco2e;

  return {
    project_id: row.project_id,
    period: row.reporting_period_start
      ? `${row.reporting_period_start} ~ ${row.reporting_period_end ?? ''}`
      : mockEmissionsSummary.period,
    gross_emissions_tco2e: gross,
    total_adjustments_tco2e: totalAdj,
    adjustments_by_type:
      row.adjustment_summary?.adjustments_by_type
      ?? mockEmissionsSummary.adjustments_by_type,
    claimable_result_tco2e: claimable,
    claimable_note: row.claim_results?.claimable_note ?? mockEmissionsSummary.claimable_note,
    claim_purpose_label:
      row.claim_results?.claim_purpose_label
      ?? row.claim_purpose
      ?? null,
    has_pending_adjustments:
      row.adjustment_summary?.has_pending_adjustments
      ?? mockEmissionsSummary.has_pending_adjustments,
    rule_engine_applied: false,
  };
}

// ─── Fetch latest snapshot for a project ─────────────────────────────────────
export async function fetchLatestReportSnapshot(
  projectId: string
): Promise<{ summary: EmissionsSummaryDTO; isReal: boolean } | null> {
  if (!isSupabaseConnected()) return null;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('report_generations')
      .select(
        'id, project_id, reporting_period_start, reporting_period_end, gross_emissions_snapshot, adjustment_summary, claim_results, adjustment_manifest, claim_purpose'
      )
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as ReportGenerationSnapshotRow;
    const hasRealSnapshot = row.gross_emissions_snapshot != null;

    return {
      summary: adaptSnapshotToSummary(row),
      isReal: hasRealSnapshot,
    };
  } catch {
    return null;
  }
}

// ─── Fetch latest snapshot across all projects (for ReportCenterPage) ────────
export async function fetchLatestGlobalSnapshot(): Promise<{
  summary: EmissionsSummaryDTO;
  isReal: boolean;
} | null> {
  if (!isSupabaseConnected()) return null;

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('report_generations')
      .select(
        'id, project_id, reporting_period_start, reporting_period_end, gross_emissions_snapshot, adjustment_summary, claim_results, adjustment_manifest, claim_purpose'
      )
      .eq('status', 'completed')
      .not('gross_emissions_snapshot', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as ReportGenerationSnapshotRow;
    return {
      summary: adaptSnapshotToSummary(row),
      isReal: true,
    };
  } catch {
    return null;
  }
}
