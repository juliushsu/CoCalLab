import type {ReportSavedSnapshot} from '../types/report.ts';

export type OutlineFieldState='saved'|'empty'|'missing'|'invalid';
export interface OutlineField {label:string;source:string;value:string;state:OutlineFieldState}
export interface OutlineChapter {order:number;key:string;title:string;fields:OutlineField[];notes:string[]}
const record=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const present=(v:unknown)=>v!==null&&v!==undefined;
const text=(v:unknown):v is string=>typeof v==='string'&&Boolean(v.trim());
const amount=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const count=(v:unknown):v is number=>amount(v)&&Number.isSafeInteger(v);
const date=(v:unknown):v is string=>text(v)&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const stringify=(v:unknown)=>JSON.stringify(v,(_key,value)=>typeof value==='number'&&!Number.isFinite(value)?'無效非有限數值':value,2);
const field=(label:string,source:string,value:unknown,valid:(v:unknown)=>boolean=text,format:(v:unknown)=>string=String):OutlineField=>!present(value)?{label,source,value:'未提供',state:'missing'}:!valid(value)?{label,source,value:'保存值無效，無法判定',state:'invalid'}:{label,source,value:format(value),state:'saved'};
const jsonField=(label:string,source:string,value:unknown,kind:'object'|'array'):OutlineField=>{
  if(!present(value))return {label,source,value:'未提供',state:'missing'};
  if(!(kind==='array'?Array.isArray(value):record(value)))return {label,source,value:'保存格式無效，無法判定',state:'invalid'};
  const empty=kind==='array'?(value as unknown[]).length===0:Object.keys(value as object).length===0;
  return {label,source,value:empty?(kind==='array'?'已保存空清單；未附列資料':'已保存空物件；未提供內容'):stringify(value),state:empty?'empty':'saved'};
};
const kg=(v:unknown)=>`${v} kgCO₂e / ${Number(v)/1000} tCO₂e`;
const rawSource=(key:string)=>'report_generations.'+key;

/** A view of saved evidence only: no requests, generated narratives or completion score. */
export function buildReportOutline(snapshot:ReportSavedSnapshot|null|undefined){
  const s=snapshot||{},payload=record(s.payload)?s.payload:{},metadata=record(payload.project_metadata)?payload.project_metadata:{},period=record(payload.reporting_period)?payload.reporting_period:{};
  function stored(column:keyof ReportSavedSnapshot,payloadKey:string){
    return present(s[column])?{value:s[column],source:rawSource(column)}:{value:payload[payloadKey],source:'report_generations.payload.'+payloadKey};
  }
  const boundary=stored('boundary_snapshot','boundary_snapshot'),legal=stored('legal_entity_snapshot','legal_entity_snapshot'),site=stored('site_snapshot','site_snapshot'),factors=stored('factor_sources','factor_sources_used');
  const start=present(s.reporting_period_start)?{value:s.reporting_period_start,source:rawSource('reporting_period_start')}:{value:period.start_date,source:'report_generations.payload.reporting_period.start_date'};
  const end=present(s.reporting_period_end)?{value:s.reporting_period_end,source:rawSource('reporting_period_end')}:{value:period.end_date,source:'report_generations.payload.reporting_period.end_date'};
  const scopeTotals=stored('scope_totals','scope_totals'),categoryTotals=stored('category_totals','category_totals');
  const scopes=record(scopeTotals.value)?scopeTotals.value:{};
  const appendix=payload.appendix_mappings;
  const notes:string[]=[];
  if(present(s.payload)&&!record(s.payload))notes.push('保存 payload 格式無效；不補上範例或推定內容。');
  for(const [key,value]of [['organization_id',s.organization_id],['project_id',s.project_id]] as const){if(text(metadata[key])&&text(value)&&metadata[key].toLowerCase()!==value.toLowerCase())notes.push(`保存 payload.${key} 與資料列識別不一致，需人工核對；不替換目前單位／專案。`);}
  if(date(start.value)&&date(end.value)&&start.value>end.value)notes.push('保存盤查期間起日晚於迄日，需修正來源。');
  for(const [key,value]of [['start_date',s.reporting_period_start],['end_date',s.reporting_period_end]] as const){if(present(value)&&present(period[key])&&value!==period[key])notes.push(`資料列與 payload 的盤查期間 ${key} 不一致，需核對。`);}
  if(Array.isArray(factors.value)&&factors.value.some(value=>!record(value)||!text(value.factor_id)||!text(value.source_name)||!count(value.version)||value.version<1))notes.push('係數清單有缺少來源、識別或有效版本的項目；清單存在不代表係數資料完整。');
  if(present(scopeTotals.value)&&!record(scopeTotals.value))notes.push('保存的 scope_totals 格式無效，排放總量無法判定。');
  if(record(categoryTotals.value)&&Object.values(categoryTotals.value).some(value=>!amount(value)))notes.push('分類總量含無效數值；保留原保存值供核對，不將其轉為零。');
  if(count(s.warning_count)&&Array.isArray(payload.data_gaps_and_warnings)&&s.warning_count!==payload.data_gaps_and_warnings.length)notes.push('保存的 warning_count 與警示清單長度不一致，需核對。');
  const values=['scope_1','scope_2','scope_3','unknown'].map(key=>scopes[key]);
  const gross=record(s.gross_emissions_snapshot)?s.gross_emissions_snapshot.gross_total_co2e_kg:null;
  if(values.every(amount)&&amount(gross)&&Math.abs(values.reduce((sum,value)=>sum+value,0)-gross)>Math.max(1e-8,Math.abs(gross)*1e-12))notes.push('保存的 Scope 合計與 gross_emissions_snapshot 總量不一致；不選一個數字假稱已核對成功。');
  const appendixNotes=['來源 ID 是保存的關聯參考，不代表附件 bytes、SHA 或人工查證已通過。'];
  if(Array.isArray(appendix)){
    if(appendix.some(value=>!record(value)||!text(value.emission_activity_id)))appendixNotes.push('部分追溯項目缺少有效活動識別。');
    if(appendix.some(value=>record(value)&&(!text(value.source_document_id)||!text(value.source_draft_id))))appendixNotes.push('部分活動未連結來源文件或草稿（獨立人工活動亦可能如此）；不得宣稱附件鏈完整。');
    if(appendix.some(value=>record(value)&&!text(value.calculation_result_id)))appendixNotes.push('部分活動未保存計算結果連結。');
  }
  const chapters:OutlineChapter[]=[
    {order:1,key:'basicData',title:'基本資料',fields:[field('報告 ID',rawSource('id'),s.id),field('組織 ID',rawSource('organization_id'),s.organization_id),field('專案 ID',rawSource('project_id'),s.project_id),field('報告版本',rawSource('report_version'),s.report_version,v=>count(v)&&v>0),field('保存時間',rawSource('created_at'),s.created_at,v=>text(v)&&Number.isFinite(Date.parse(v))),field('保存狀態',rawSource('status'),s.status),field('保存的專案名稱','report_generations.payload.project_metadata.name',metadata.name),jsonField('保存的工作區','report_generations.payload.workspace_snapshot',payload.workspace_snapshot,'object'),jsonField('盤查法人快照',legal.source,legal.value,'object'),jsonField('據點快照',site.source,site.value,'object')],notes:['只顯示保存時的資料；目前專案資料不回填為歷史快照。']},
    {order:2,key:'inventoryPurpose',title:'盤查目的',fields:[field('保存的用途代碼',rawSource('claim_purpose'),s.claim_purpose)],notes:['用途代碼不是完整盤查目的敘述；本頁不代寫申報、查證或業務核准聲明。']},
    {order:3,key:'inventoryBoundary',title:'盤查邊界',fields:[jsonField('保存的邊界',boundary.source,boundary.value,'object'),jsonField('納入／排除摘要','report_generations.payload.boundary_summary',payload.boundary_summary,'object')],notes:['邊界快照不代表所有法人、據點與責任歸屬已由人工確認。']},
    {order:4,key:'inventoryPeriod',title:'盤查期間',fields:[field('起日',start.source,start.value,date),field('迄日',end.source,end.value,date)],notes:['未提供或無效日期保持未知，不以目前專案期間或今日補值。']},
    {order:5,key:'emissionSources',title:'排放源鑑別',fields:[field('納入活動數',rawSource('included_activity_count'),s.included_activity_count,count),field('排除活動數',rawSource('excluded_activity_count'),s.excluded_activity_count,count),field('待確認活動數',rawSource('pending_activity_count'),s.pending_activity_count,count),jsonField('保存的納入活動','report_generations.payload.included_activities_summary',payload.included_activities_summary,'array'),jsonField('保存的排除項目','report_generations.payload.excluded_items_summary',payload.excluded_items_summary,'array')],notes:['活動數與摘要不是製程、排放氣體或所有排放源皆已盤點的證明。']},
    {order:6,key:'calculationMethod',title:'排放量計算方法',fields:[...['scope_1','scope_2','scope_3','unknown'].map(key=>field(key==='unknown'?'未分類排放':key.replace('_',' '),scopeTotals.source+'.'+key,present(scopeTotals.value)&&!record(scopeTotals.value)?scopeTotals.value:scopes[key],amount,kg)),jsonField('分類總量（來源單位 kgCO₂e）',categoryTotals.source,categoryTotals.value,'object'),jsonField('保存的總排放快照',rawSource('gross_emissions_snapshot'),s.gross_emissions_snapshot,'object')],notes:['kg 換算 t 僅除以 1000 一次；缺值不補零。保存總量不等於逐筆公式、係數數值及方法章節均已提供。']},
    {order:7,key:'activityDataSources',title:'活動數據來源',fields:[jsonField('文件／草稿／活動／計算關聯','report_generations.payload.appendix_mappings',appendix,'array')],notes:appendixNotes},
    {order:8,key:'emissionFactorSources',title:'排放係數來源',fields:[jsonField('保存的係數識別、來源與版本',factors.source,factors.value,'array')],notes:['只顯示已保存的係數來源，不以目前係數表替換歷史版本。空清單不是已取得係數；正式適用性仍需人工核對。']},
    {order:9,key:'dataQuality',title:'數據品質管理',fields:[field('保存的警示數',rawSource('warning_count'),s.warning_count,count),jsonField('保存的資料缺口／警示','report_generations.payload.data_gaps_and_warnings',payload.data_gaps_and_warnings,'array'),field('計算基準時間',rawSource('based_on_calculated_at'),s.based_on_calculated_at,v=>text(v)&&Number.isFinite(Date.parse(v)))],notes:['零警示或空警示清單不代表完成驗證。AI 摘要 placeholder 不作為已生成內容；正式資料品質表與查證聲明未在此建立。']},
    {order:10,key:'annexEvidence',title:'佐證資料與附件',fields:[field('來源 payload_hash（未重新驗證）',rawSource('payload_hash'),s.payload_hash),jsonField('保存的調整附件清單',rawSource('adjustment_manifest'),s.adjustment_manifest,'array'),jsonField('調整摘要（保留來源欄位單位）',rawSource('adjustment_summary'),s.adjustment_summary,'object'),jsonField('宣告結果（保留來源欄位單位）',rawSource('claim_results'),s.claim_results,'object')],notes:['附件關聯見第七章；未在此嵌入原檔或生成查證聲明。雜湊欄位僅供來源追溯，不是伺服器驗真或防竄改保證。']},
  ];
  return {selected:Boolean(snapshot),provenance:s.is_test===true?'保存資料已標記為測試資料':s.is_test===false?'保存資料未標記為測試（不代表正式驗收）':'未提供測試資料標記',environment:text(s.env)?s.env:'未知',notes,chapters};
}
