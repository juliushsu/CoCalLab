import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import { adaptReportData, type ReportRow } from './reportAdapter';

/** Empty means absent; configuration, access and query failures remain errors. */
export async function getReportData(reportId: string, scope: {organizationId?:string;projectId?:string} = {}) {
  if (!reportId) throw new Error('A report must be selected.');
  if (!isSupabaseConnected()) throw new Error('Report data service is not configured.');
  const { data, error } = await getSupabaseClient()
    .from('report_generations')
    .select('*, project:projects(name)')
    .eq('id', reportId)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Failed to load report.');
  if (!data) return { report: null, sections: [], statistics: null };
  if((scope.organizationId&&data.organization_id!==scope.organizationId)||(scope.projectId&&data.project_id!==scope.projectId))throw new Error('Report does not belong to the selected organization/project.');
  return {...adaptReportData(data as ReportRow),resolvedScope:{organizationId:data.organization_id as string,projectId:data.project_id as string}};
}
