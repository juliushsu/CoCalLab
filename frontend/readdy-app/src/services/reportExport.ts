import { canonicalUuid } from './navigationScope.ts';
import {savedReplacementDisclosure} from './replacementDisclosure.ts';

/** Persisted snapshot allowlist: saved correction actors remain in payload; no live joins or internal errors. */
export const REPORT_EXPORT_FIELDS = [
  'id','organization_id','project_id','status','integrity_status','report_version','created_at','payload','payload_hash',
  'reporting_period_start','reporting_period_end','included_activity_count','excluded_activity_count',
  'pending_activity_count','scope_totals','category_totals','factor_sources','warning_count',
  'based_on_calculated_at','is_test','env','legal_entity_snapshot','site_snapshot','boundary_snapshot',
  'gross_emissions_snapshot','adjustment_summary','claim_results','claim_purpose','adjustment_manifest',
] as const;
export type ReportExportSnapshot = Record<typeof REPORT_EXPORT_FIELDS[number], unknown> & {
  id:string;organization_id:string;project_id:string;status:'completed';report_version:number;created_at:string;
  payload:Record<string,unknown>;payload_hash:string;
};
export type ReportExportFormat = 'html'|'json';
const record = (value:unknown):value is Record<string,unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value:unknown) => typeof value === 'string' && value ? value : '未知';
const quantity = (value:unknown):number|null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
/** UUID text is case-insensitive; non-UUID fixture/legacy keys still match exactly. */
export function sameReportExportIdentity(left:unknown,right:unknown):boolean {
  if (typeof left !== 'string' || typeof right !== 'string' || !left || !right) return false;
  const leftUuid = canonicalUuid(left);
  const rightUuid = canonicalUuid(right);
  return leftUuid && rightUuid ? leftUuid === rightUuid : left === right;
}
export function prepareReportExportSnapshot(value:unknown, expected:{reportId:string;projectId:string;organizationId?:string}):ReportExportSnapshot {
  if (!record(value) || !sameReportExportIdentity(value.id, expected.reportId) || !sameReportExportIdentity(value.project_id, expected.projectId) ||
      typeof value.organization_id !== 'string' || !value.organization_id ||
      (expected.organizationId && !sameReportExportIdentity(value.organization_id, expected.organizationId))) throw new Error('找不到符合目前專案與組織範圍的報告快照。');
  if (value.status !== 'completed') throw new Error('僅可匯出已保存且完成的報告。');
  if (!Number.isInteger(value.report_version) || Number(value.report_version) < 1 ||
      typeof value.created_at !== 'string' || !Number.isFinite(Date.parse(value.created_at)) ||
      !record(value.payload) || typeof value.payload_hash !== 'string' || !value.payload_hash) throw new Error('報告快照缺少版本、時間、payload 或來源雜湊。');
  // Copy the allowlist, not the complete database row, even if a caller passes extras.
  return Object.fromEntries(REPORT_EXPORT_FIELDS.map(field => [field,value[field] ?? null])) as ReportExportSnapshot;
}
export function escapeReportHtml(value:unknown):string {
  return String(value).replace(/[&<>"']/g,character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!));
}
function emissions(value:unknown):string {
  const kg = quantity(value);
  return kg === null ? '未知' : `${kg} kgCO₂e / ${kg / 1000} tCO₂e`;
}
function pretty(value:unknown):string { return JSON.stringify(value ?? null,null,2); }
function filenamePart(value:string):string { return value.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80) || 'unknown'; }
export function buildReportExport(snapshot:ReportExportSnapshot,format:ReportExportFormat):{filename:string;mimeType:string;content:string} {
  if (format !== 'html' && format !== 'json') throw new Error('此匯出格式尚未提供。');
  const safe = prepareReportExportSnapshot(snapshot,{reportId:snapshot.id,projectId:snapshot.project_id,organizationId:snapshot.organization_id});
  const filename = `cocallab-report-${filenamePart(safe.id)}-v${safe.report_version}.${format}`;
  const disclosure=savedReplacementDisclosure(safe.payload);
  if (format === 'json') return {filename,mimeType:'application/json;charset=utf-8',content:pretty({export_format_version:'cocallab-report-snapshot-v1',emissions_unit:'kgCO2e (source snapshot; adjustment fields retain their explicit units)',replacement_disclosure:disclosure,snapshot:safe})};
  const scopes = record(safe.scope_totals) ? safe.scope_totals : {};
  const values = ['scope_1','scope_2','scope_3','unknown'].map(key => quantity(scopes[key]));
  const total = values.every(value => value !== null) ? (values as number[]).reduce((sum,value)=>sum+value,0) : null;
  const categories = record(safe.category_totals) ? Object.entries(safe.category_totals) : [];
  const metadata = record(safe.payload.project_metadata) ? safe.payload.project_metadata : {};
  const boundary = record(safe.boundary_snapshot) && Object.keys(safe.boundary_snapshot).length ? safe.boundary_snapshot : safe.payload.boundary_snapshot;
  const row = (name:string,value:unknown) => `<tr><th>${escapeReportHtml(name)}</th><td>${escapeReportHtml(value)}</td></tr>`;
  const content = `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>CoCalLab 報告 v${safe.report_version}</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#17332e;max-width:960px;margin:40px auto;padding:0 24px}h1,h2{color:#086b60}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #d5e3df;padding:10px;text-align:left;overflow-wrap:anywhere}th{background:#edf6f3}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f6f5;padding:16px;font-size:13px}.notice{padding:16px;border-left:4px solid #b67b17;background:#fff6df}@media print{body{margin:0;max-width:none}h2{break-after:avoid}tr{break-inside:avoid}}</style></head><body>
<h1>CoCalLab 已保存報告快照</h1><p class="notice">此檔案為已保存資料的匯出，不代表完整章節、正式查驗、合規認證或申報核准。缺失或無效數值顯示「未知」；總量包含未分類排放。來源 payload_hash 僅供追溯，本次未重新驗證其雜湊。</p>
<h2>來源與版本</h2><table>${row('報告 ID',safe.id)}${row('報告版本',safe.report_version)}${row('保存完整性標記（匯出時由伺服器另驗）',text(safe.integrity_status))}${row('測試資料標記',safe.is_test === true ? '測試資料' : safe.is_test === false ? '未標記為測試（不代表正式驗收）' : '未知')}${row('保存的環境標記',text(safe.env))}${row('保存時間',safe.created_at)}${row('組織 ID',safe.organization_id)}${row('專案 ID',safe.project_id)}${row('保存的專案名稱',text(metadata.name))}${row('報告期間',`${text(safe.reporting_period_start)} ～ ${text(safe.reporting_period_end)}`)}${row('來源 payload_hash',safe.payload_hash)}</table>
<h2>排放摘要</h2><table>${row('總排放量（含未分類）',emissions(total))}${row('Scope 1',emissions(scopes.scope_1))}${row('Scope 2',emissions(scopes.scope_2))}${row('Scope 3',emissions(scopes.scope_3))}${row('未分類排放',emissions(scopes.unknown))}</table>
<h2>分類排放</h2>${categories.length ? `<table>${categories.map(([category,value])=>row(category,emissions(value))).join('')}</table>` : '<p>未知：未提供分類明細。</p>'}
<h2>活動與資料缺口</h2><table>${['included_activity_count','excluded_activity_count','pending_activity_count','warning_count'].map(field=>row(field,Number.isInteger(safe[field]) && quantity(safe[field]) !== null ? safe[field] : '未知')).join('')}</table><p>零排放不代表所有活動均完成計算或驗證。</p>
<h2>保存的邊界資訊</h2><pre>${escapeReportHtml(pretty(boundary))}</pre>
<h2>保存的人工更正／排除揭露</h2><p class="notice">${escapeReportHtml(disclosure.message)}</p>${disclosure.disclosures.map(entry=>`<h3>活動 ${escapeReportHtml(entry.emission_activity_id)}</h3><p>原收據驗證狀態：${escapeReportHtml(entry.replacement_provenance.receipt_verification_status??'未記錄／無原收據')}；原收據僅歷史來源，不佐證更正值。</p>${entry.replacement_provenance.steps.map(step=>`<table>${row('前版',step.predecessor_activity_id)}${row('後繼',step.activity_id)}${row('模式',step.replacement_mode==='correct'?'人工更正':'人工排除')}${row('理由',step.reason)}${row('操作者',step.actor_user_id)}${row('時間',step.occurred_at)}</table><pre>${escapeReportHtml(pretty(step.changes))}</pre>`).join('')}`).join('')}
<h2>原始報告 Payload</h2><p>以下為保存當時的結構化內容，未新增或生成報告章節；數值保留來源欄位單位。</p><pre>${escapeReportHtml(pretty(safe.payload))}</pre>
</body></html>`;
  return {filename,mimeType:'text/html;charset=utf-8',content};
}
