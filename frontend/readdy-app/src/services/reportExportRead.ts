import type { SupabaseClient } from '@supabase/supabase-js';
import { REPORT_EXPORT_FIELDS, prepareReportExportSnapshot } from './reportExport.ts';

/** User-JWT SELECT is a snapshot read, not proof of export entitlement. */
export async function readPersistedReportSnapshot(
  client: Pick<SupabaseClient, 'from'>,
  reportId: string,
  projectId: string,
  organizationId?: string,
) {
  if (!reportId || !projectId) throw new Error('請先載入要匯出的報告與專案。');
  let query = client.from('report_generations').select(REPORT_EXPORT_FIELDS.join(','))
    .eq('id', reportId).eq('project_id', projectId).eq('status', 'completed');
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message || '無法讀取報告匯出快照。');
  if (!data) throw new Error('找不到已完成且可存取的報告快照。');
  return prepareReportExportSnapshot(data, { reportId, projectId, organizationId });
}

/** Server policy A, explicitly approved for the local candidate. Never use ordinary SELECT as entitlement. */
export async function readAuthorizedReportSnapshot(client:Pick<SupabaseClient,'functions'>,reportId:string,projectId:string,organizationId:string){
 if(!reportId||!projectId||!organizationId)throw new Error('請選擇報告與完整單位／專案範圍。');
 const {data,error}=await client.functions.invoke('export-report-snapshot',{body:{report_id:reportId,project_id:projectId,organization_id:organizationId}});
 if(error)throw new Error('伺服器拒絕或無法完成匯出授權：'+error.message);
 if(data?.success!==true||data.data?.policy!=='tenant_write_v1')throw new Error('匯出服務尚未啟用或回覆無效。');
 return prepareReportExportSnapshot(data.data.snapshot,{reportId,projectId,organizationId});
}
