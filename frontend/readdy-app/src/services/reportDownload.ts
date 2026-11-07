import { buildReportExport, type ReportExportFormat, type ReportExportSnapshot } from './reportExport.ts';

export const REPORT_EXPORT_AUTHORIZATION_PENDING = '報告匯出暫不提供：尚缺伺服器匯出授權契約，現有報告讀取權限不能當作匯出核准。';

/** Busy belongs to one captured UI visit and one attempt, independently of export authorization. */
export interface ReportExportAttempt<Context> {context:Context}
export function reportExportIsBusy<Context>(attempt:ReportExportAttempt<Context>|null,context:Context):boolean{return attempt!==null&&attempt.context===context;}
export function releaseReportExportAttempt<Context>(active:ReportExportAttempt<Context>|null,finished:ReportExportAttempt<Context>):ReportExportAttempt<Context>|null{return active===finished?null:active;}
interface ExportVisit {authEpoch:unknown;user?:string;reportId?:string;organizationId?:string;projectId?:string;exportBlock:string|null}
/** Preserve a cancellation across pending -> ready refresh; never carry old-report content. */
export function reportExportVisitNotice(attempt:ReportExportAttempt<ExportVisit>|null,previous:ExportVisit,current:ExportVisit,notice:string):string{
 if(attempt&&attempt.context!==current)return '匯出已取消：'+(current.exportBlock||'報告、範圍或登入狀態已變更。')+' 未下載檔案；請待目前報告與匯出資格核對完成後，重新按匯出。';
 const sameVisit=previous.authEpoch===current.authEpoch&&previous.user===current.user&&previous.reportId===current.reportId&&previous.organizationId===current.organizationId&&previous.projectId===current.projectId;
 return sameVisit?notice:'';
}

/** Fail closed without inventing a role/plan-to-export permission mapping. */
export function reportExportBlockReason(subscription: { loading: boolean; error: string | null; isReadonly: boolean }): string {
  if (subscription.loading) return '正在確認訂閱狀態，暫不可匯出。';
  if (subscription.error) return '無法確認訂閱狀態，暫不可匯出。';
  if (subscription.isReadonly) return '目前訂閱為唯讀，無法匯出。';
  return REPORT_EXPORT_AUTHORIZATION_PENDING;
}

/** Route/session invalidation is rechecked after asynchronous reads, before saving. */
export async function exportCurrentSnapshot(
  load: () => Promise<ReportExportSnapshot>,
  format: ReportExportFormat,
  isCurrent: () => boolean,
  save: (file: ReturnType<typeof buildReportExport>) => void,
): Promise<boolean> {
  if (!isCurrent()) return false;
  const snapshot = await load();
  if (!isCurrent()) return false;
  save(buildReportExport(snapshot, format));
  return true;
}

/** A browser download request, never a claim that the OS saved the file. */
export function saveReportFile(file: ReturnType<typeof buildReportExport>): void {
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Compatibility checks only. The authenticated server endpoint still decides every export. */
export function reportExportPreflight(subscription:{loading:boolean;error:string|null;isReadonly:boolean}):string|null{
 if(subscription.loading)return '正在確認訂閱狀態，暫不可匯出。';
 if(subscription.error)return '無法確認訂閱狀態，暫不可匯出。';
 if(subscription.isReadonly)return '目前訂閱為唯讀，無法匯出。';
 return null;
}
