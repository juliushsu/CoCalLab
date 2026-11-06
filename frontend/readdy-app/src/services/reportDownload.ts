import { buildReportExport, type ReportExportFormat, type ReportExportSnapshot } from './reportExport.ts';

export const REPORT_EXPORT_AUTHORIZATION_PENDING = '報告匯出暫不提供：尚缺伺服器匯出授權契約，現有報告讀取權限不能當作匯出核准。';

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
