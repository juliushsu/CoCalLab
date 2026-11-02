import { REPORT_EXPORT_FIELDS, prepareReportExportSnapshot } from './reportExport';
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
export async function getReportExportSnapshot(reportId:string, projectId:string, organizationId?:string) {
  if (!reportId || !projectId) throw new Error('請先載入要匯出的報告與專案。');
  if (!isSupabaseConnected()) throw new Error('報告資料服務尚未設定，無法匯出。');
  let query = getSupabaseClient().from('report_generations')
    .select(REPORT_EXPORT_FIELDS.join(','))
    .eq('id',reportId).eq('project_id',projectId).eq('status','completed');
  if (organizationId) query = query.eq('organization_id',organizationId);
  const {data,error} = await query.maybeSingle();
  if (error) throw new Error(error.message || '無法讀取報告匯出快照。');
  if (!data) throw new Error('找不到已完成且可存取的報告快照。');
  return prepareReportExportSnapshot(data,{reportId,projectId,organizationId});
}
