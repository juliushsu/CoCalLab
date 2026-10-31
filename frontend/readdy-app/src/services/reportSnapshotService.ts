import { getSupabaseClient, isSupabaseConnected } from '@/lib/supabase';
import { adaptSnapshotToSummary, type ReportGenerationSnapshotRow } from './reportSnapshotAdapter';
export { adaptSnapshotToSummary, type ReportGenerationSnapshotRow } from './reportSnapshotAdapter';

/** Reads only the explicitly selected tenant/project; errors must remain visible. */
export async function fetchLatestReportSnapshot(organizationId: string, projectId: string) {
  if (!organizationId || !projectId) throw new Error('Select an organization and project first.');
  if (!isSupabaseConnected()) throw new Error('Database connection is not configured.');
  const { data, error } = await getSupabaseClient()
    .from('report_generations')
    .select('id, organization_id, project_id, reporting_period_start, reporting_period_end, gross_emissions_snapshot, adjustment_summary, claim_results, claim_purpose')
    .eq('organization_id', organizationId)
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Failed to load report snapshot.');
  if (!data) return null;
  if (data.organization_id !== organizationId || data.project_id !== projectId) {
    throw new Error('Report snapshot does not match the selected project.');
  }
  return { reportId: data.id, summary: adaptSnapshotToSummary(data as ReportGenerationSnapshotRow) };
}
