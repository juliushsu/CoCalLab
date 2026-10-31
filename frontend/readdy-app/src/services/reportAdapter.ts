import type { ReportStatistics, ReportVersion } from '../types/report';

export interface ReportRow {
  id: string; project_id: string; report_version: number;
  status: ReportVersion['report_status']; generated_by_user_id?: string;
  created_at: string; updated_at: string; error_message?: string;
  project?: { name?: string } | null;
  scope_totals?: Record<string, unknown> | null;
  category_totals?: Record<string, unknown> | null;
  included_activity_count?: unknown; excluded_activity_count?: unknown; pending_activity_count?: unknown;
}
const nonnegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Report totals are stored in kgCO2e and presented in tonnes. Unknown is not zero. */
export function adaptReportData(row: ReportRow) {
  const report: ReportVersion = {
    id: row.id, project_id: row.project_id, project_name: row.project?.name || '',
    version_number: row.report_version, report_status: row.status,
    generated_by: row.generated_by_user_id || '', generated_at: row.created_at,
    completed_at: row.status === 'completed' ? row.updated_at : undefined,
    error_message: row.error_message,
    // There is no persisted report_sections implementation to count.
    total_sections: 0, completed_sections: 0,
    created_at: row.created_at, updated_at: row.updated_at,
  };
  const scopes = ['scope_1', 'scope_2', 'scope_3'].map(key => row.scope_totals?.[key]);
  const unknownScope = Object.prototype.hasOwnProperty.call(row.scope_totals || {}, 'unknown')
    ? row.scope_totals?.unknown : 0;
  const counts = [row.included_activity_count, row.excluded_activity_count, row.pending_activity_count];
  let statistics: ReportStatistics | null = null;
  if (scopes.every(nonnegativeNumber) && nonnegativeNumber(unknownScope) && counts.every(value => nonnegativeNumber(value) && Number.isInteger(value))) {
    const [scope1, scope2, scope3] = scopes as number[];
    const [included, excluded, pending] = counts as number[];
    const totalKg = scope1 + scope2 + scope3 + unknownScope;
    if (!Number.isFinite(totalKg)) throw new Error('Invalid report emissions total');
    const categoryRows = Object.entries(row.category_totals || {});
    if (categoryRows.some(([, value]) => !nonnegativeNumber(value))) throw new Error('Invalid report category emissions');
    statistics = {
      total_emissions: totalKg / 1000,
      unclassified_emissions: unknownScope / 1000,
      scope1_emissions: scope1 / 1000, scope2_emissions: scope2 / 1000, scope3_emissions: scope3 / 1000,
      total_activities: included + excluded + pending,
      included_activities: included, excluded_activities: excluded,
      verified_activities: null, // Verification status is unknown in this read path.
      emission_by_category: categoryRows.map(([category, emissions]) => ({
        category, emissions: (emissions as number) / 1000,
        percentage: totalKg ? (emissions as number) / totalKg * 100 : 0,
      })),
    };
  }
  return { report, sections: [], statistics };
}
