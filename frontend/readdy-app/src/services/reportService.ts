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
