import { readPersistedReportSnapshot } from './reportExportRead';
import { REPORT_EXPORT_AUTHORIZATION_PENDING } from './reportDownload';
import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import { adaptReportData, type ReportRow } from './reportAdapter';

/** Empty means absent; configuration, access and query failures remain errors. */
export async function getReportData(reportId: string) {
  if (!reportId) throw new Error('A report must be selected.');
  if (!isSupabaseConnected()) throw new Error('Report data service is not configured.');
  const { data, error } = await getSupabaseClient()
    .from('report_generations')
    .select('*, project:projects(name)')
    .eq('id', reportId)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Failed to load report.');
  if (!data) return { report: null, sections: [], statistics: null };
  return adaptReportData(data as ReportRow);
}

/** Download only an exact persisted completed snapshot through user JWT + RLS. */
export async function getReportExportSnapshot(reportId:string, projectId:string, _organizationId?:string): ReturnType<typeof readPersistedReportSnapshot> {
  if (!reportId || !projectId) throw new Error('請先載入要匯出的報告與專案。');
  if (!isSupabaseConnected()) throw new Error('報告資料服務尚未設定，無法匯出。');
  // No server export entitlement exists at this pinned candidate. Do not enable
  // downloads from ordinary SELECT access or from a client-controlled flag.
  throw new Error(REPORT_EXPORT_AUTHORIZATION_PENDING);
}

// Preserve the scoped persisted reader for an eventual CTO-approved export
// endpoint; it deliberately does not grant download permission.
export { readPersistedReportSnapshot };
