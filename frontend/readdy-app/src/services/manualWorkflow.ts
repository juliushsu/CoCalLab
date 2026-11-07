import type {SupabaseClient} from '@supabase/supabase-js';
import {canonicalUuid} from './navigationScope.ts';
import type {IntakeScope} from './documentIntake.ts';
import type {EmissionActivity} from '../types/activity.ts';
export interface ManualInput {activity_name:string;category:string;activity_type:string;final_scope:string;quantity:string;unit:string;activity_date:string;notes:string;inclusion_status:string;exclusion_reason:string;subcategory?:string|null;data_quality?:string;status?:string}
export interface ManualProject {id:string;organization_id:string;name:string;project_code:string;reporting_start_date:string;reporting_end_date:string}
const uuid=(value:unknown)=>{const id=canonicalUuid(value);if(!id)throw new Error('組織、專案或紀錄識別無效。');return id;};
const check=(current:()=>boolean)=>{if(!current())throw new Error('登入或專案已切換；舊操作結果不採用，已發送的寫入須重新核對。');};
const date=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
async function identity(client:SupabaseClient,userId:string,current:()=>boolean){check(current);const response=await client.auth.getUser();check(current);if(response.error||uuid(response.data.user?.id)!==uuid(userId))throw new Error('請重新登入。');}
export async function manualProjects(client:SupabaseClient,userId:string,current=()=>true,organizationId?:string):Promise<ManualProject[]>{
 await identity(client,userId,current);
 let query=client.from('projects').select('id,organization_id,name,project_code,reporting_start_date,reporting_end_date',{count:'exact'}).order('name');
 if(organizationId)query=query.eq('organization_id',uuid(organizationId));
 const response=await query;check(current);
 if(response.error||!Array.isArray(response.data)||response.count!==response.data.length)throw new Error('專案讀取失敗或資料不完整。');
 const seen=new Set<string>();return response.data.map(row=>{const id=uuid(row.id),org=uuid(row.organization_id);if(seen.has(id)||(organizationId&&org!==uuid(organizationId))||!date(row.reporting_start_date)||!date(row.reporting_end_date))throw new Error('專案範圍或期間無效。');seen.add(id);return {...row,id,organization_id:org};});
}
export async function manualContext(client:SupabaseClient,scope:IntakeScope,userId:string,current=()=>true,write=true){
 const org=uuid(scope.organizationId),project=uuid(scope.projectId);await identity(client,userId,current);
 const response=await client.from('projects').select('id,organization_id,name,project_code,reporting_start_date,reporting_end_date').eq('id',project).eq('organization_id',org).maybeSingle();check(current);
 if(response.error||!response.data||uuid(response.data.id)!==project||uuid(response.data.organization_id)!==org)throw new Error('專案不存在或不屬於目前組織。');
 if(write){const member=await client.from('organization_members').select('organization_id,user_id,role,status').eq('organization_id',org).eq('user_id',uuid(userId)).maybeSingle();check(current);if(member.error||!member.data||member.data.organization_id!==org||member.data.user_id!==uuid(userId)||member.data.status!=='active'||!['owner','admin','editor'].includes(member.data.role))throw new Error('目前角色無法修改此專案。');}
 return response.data as ManualProject;
}
export function manualPayload(input:ManualInput,scope:IntakeScope,userId:string,attemptId:string,project:ManualProject){
 if(uuid(project.id)!==uuid(scope.projectId)||uuid(project.organization_id)!==uuid(scope.organizationId)||!date(project.reporting_start_date)||!date(project.reporting_end_date)||project.reporting_end_date<project.reporting_start_date)throw new Error('專案範圍或盤查期間無效。');
 const quantity=Number(input.quantity),unit=input.unit.trim(),type=input.activity_type.trim(),name=input.activity_name.trim(),category=input.category.trim();
 if(!name||!category||!input.quantity.trim()||!Number.isFinite(quantity)||quantity<0||quantity>=1e12||Number(quantity.toFixed(8))!==quantity||!unit||!type||unit.length>32||type.length>100)throw new Error('請明確填寫活動名稱、類別、活動類型、非負數量（最多8位小數）與單位；空白不會補成零。');
 if(!date(input.activity_date)||input.activity_date<project.reporting_start_date||input.activity_date>project.reporting_end_date)throw new Error('活動日期必須在專案盤查期間內。');
 if(!['pending','included','excluded'].includes(input.inclusion_status))throw new Error('請確認納入狀態。');
 const finalScope=input.final_scope?Number(input.final_scope):null;
 if((finalScope!==null&&![1,2,3].includes(finalScope))||(input.inclusion_status==='included'&&finalScope===null))throw new Error('納入活動必須明確確認 Scope 1、2 或3；類別建議不是業務核准。');
 if(input.inclusion_status==='excluded'&&!input.exclusion_reason.trim())throw new Error('排除活動必須填寫原因。');
 return {id:uuid(attemptId),organization_id:uuid(scope.organizationId),project_id:uuid(scope.projectId),created_by_user_id:uuid(userId),activity_code:'MANUAL-'+uuid(attemptId),activity_name:name,activity_type:type,category,subcategory:input.subcategory??null,quantity,unit,activity_date:input.activity_date,final_scope:finalScope,suggested_scope:finalScope,data_quality:input.data_quality??'primary',inclusion_status:input.inclusion_status,exclusion_reason:input.inclusion_status==='excluded'?input.exclusion_reason.trim():null,review_note:input.notes.trim()||null,status:input.status??'active'};
}
/** Stable activity and request IDs survive response loss; authority and edits belong to SQL. */
export async function saveManualActivity(client:SupabaseClient,scope:IntakeScope,userId:string,attemptId:string,input:ManualInput,current=()=>true,requestId=attemptId){
 const project=await manualContext(client,scope,userId,current),payload=manualPayload(input,scope,userId,attemptId,project);
 uuid(requestId);
 const editable={activity_name:payload.activity_name,activity_type:payload.activity_type,category:payload.category,subcategory:payload.subcategory,quantity:payload.quantity,unit:payload.unit,activity_date:payload.activity_date,final_scope:payload.final_scope,data_quality:payload.data_quality,inclusion_status:payload.inclusion_status,exclusion_reason:payload.exclusion_reason,review_note:payload.review_note,status:payload.status};
 const result=await invoke(client,'save-manual-activity',{organization_id:payload.organization_id,project_id:payload.project_id,activity_id:payload.id,request_id:requestId,input:editable},current);
 const row=result?.activity;
 if(typeof result?.replayed!=='boolean'||!row||row.id!==payload.id||row.organization_id!==payload.organization_id||row.project_id!==payload.project_id||Object.entries(editable).some(([key,value])=>row[key]!==value))throw new Error('活動保存回應的範圍或內容不一致；保留原請求識別核對，不當作成功。');
 return row as EmissionActivity;
}
export async function readManualActivities(client:SupabaseClient,scope:IntakeScope,userId:string,current=()=>true):Promise<EmissionActivity[]>{
 await manualContext(client,scope,userId,current,false);const all:EmissionActivity[]=[],seen=new Set<string>();let total:number|undefined;
 for(let offset=0;;){const r=await client.from('emission_activities').select('*',{count:'exact'}).eq('organization_id',uuid(scope.organizationId)).eq('project_id',uuid(scope.projectId)).order('activity_date',{ascending:false}).order('id').range(offset,offset+199);check(current);
 if(r.error||!Array.isArray(r.data)||!Number.isSafeInteger(r.count)||r.count!<0||(total!==undefined&&total!==r.count))throw new Error('活動讀取失敗或分頁資料不完整。');total=r.count!;
 for(const row of r.data){const id=uuid(row.id);if(seen.has(id)||uuid(row.organization_id)!==uuid(scope.organizationId)||uuid(row.project_id)!==uuid(scope.projectId))throw new Error('活動範圍不一致。');seen.add(id);all.push(row as EmissionActivity);}
 if(all.length===total)return all;if(!r.data.length||all.length>total)throw new Error('活動清單已變更，請重新讀取。');offset+=r.data.length;}
}
async function invoke(client:SupabaseClient,name:string,payload:Record<string,unknown>,current:()=>boolean){
 check(current);const response=await client.functions.invoke(name,{body:payload});check(current);
 if(response.error||!response.data?.success||response.data.error){
  let body=response.data;
  if(response.error?.context instanceof Response){try{body=await response.error.context.clone().json();}catch{/* preserve transport error */}check(current);}
  const message=body?.error?.message||response.error?.message||'操作未確認，請重新核對保存結果。';
  if(/(?:ACTIVITY_SOURCE|REPORT_SOURCE)_RETAINED/.test(message))throw new Error('此活動已有受保留的來源或報告引用，不能修改；原資料與報告保留。'+message);
  if(/CALCULATION_AUTHORITY_(?:REQUIRED|STALE)/.test(message))throw new Error('目前沒有可用的通用重算紀錄，或輸入／來源已變更；請先重新計算並保存，再建立新報告。歷史報告不會自動補簽。'+message);
  throw new Error(message);
 }
 return response.data.data;
}
export interface CalculationResult {
 project_id:string;request_id:string;replayed:boolean;input_matches_current:boolean;results_are_latest:boolean;
 operation_status:'completed'|'historical'|'not_found'|'pending';calculation_result_ids:string[];
 processed_activities:number|null;calculated_count:number|null;pending_factor_count:number|null;excluded_count:number|null;error_count:number|null;
}
type CompletedCalculation=CalculationResult & {operation_status:'completed';processed_activities:number;calculated_count:number;pending_factor_count:number;excluded_count:number;error_count:number};
const calculationCounters=['processed_activities','calculated_count','pending_factor_count','excluded_count','error_count'] as const;
/** New-client compatibility gate; actual authorization/idempotency remains server/SQL owned. */
async function calculationAccess(client:SupabaseClient,scope:IntakeScope,userId:string,current:()=>boolean){
 await manualContext(client,scope,userId,current);const probe=await client.rpc('recalculation_contract',{p_project_id:uuid(scope.projectId)});check(current);const rows=probe.data;
 if(probe.error||!Array.isArray(rows)||rows.length!==1||rows[0]?.project_id!==scope.projectId||rows[0]?.organization_id!==scope.organizationId||rows[0]?.contract_version!=='20261106.recalc.1'||typeof rows[0]?.can_recalculate!=='boolean')throw new Error('冪等重算服務版本尚未確認，未發出計算；不對舊服務重送。');
 if(!rows[0].can_recalculate)throw new Error('目前權限或訂閱不允許核對／重算。');
}
function calculationResult(value:unknown,scope:IntakeScope,requestId:string):CalculationResult {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('計算回應無效，保留同一請求識別後核對。');const row=value as CalculationResult;
 if(row.project_id!==scope.projectId||row.request_id!==requestId||typeof row.replayed!=='boolean'||typeof row.input_matches_current!=='boolean'||typeof row.results_are_latest!=='boolean'||!['completed','historical','not_found','pending'].includes(row.operation_status)||!Array.isArray(row.calculation_result_ids)||row.calculation_result_ids.some(id=>!canonicalUuid(id))||new Set(row.calculation_result_ids).size!==row.calculation_result_ids.length)throw new Error('計算回應範圍、操作識別或保存ID無效；尚未確認成功。');
 if(row.operation_status==='completed'||row.operation_status==='historical'){
  if(calculationCounters.some(key=>!Number.isSafeInteger(row[key])||row[key]!<0)||row.processed_activities!==row.calculation_result_ids.length||row.processed_activities!==Number(row.calculated_count)+Number(row.pending_factor_count)+Number(row.excluded_count)+Number(row.error_count)||(row.input_matches_current&&row.results_are_latest)!==(row.operation_status==='completed'))throw new Error('計算保存結果不完整或新舊輸入狀態不一致。');
 }else if((row.operation_status==='not_found'&&row.input_matches_current)||row.results_are_latest||row.calculation_result_ids.length||calculationCounters.some(key=>row[key]!==null))throw new Error('計算尚未完成，不得以零值或舊結果表示成功。');
 return row;
}
async function calculationOperation(client:SupabaseClient,scope:IntakeScope,userId:string,requestId:string,action:'calculate'|'lookup',current:()=>boolean){
 uuid(requestId);await calculationAccess(client,scope,userId,current);try{const result=await invoke(client,'recalculate-project',{organization_id:scope.organizationId,project_id:scope.projectId,actor_user_id:userId,force_recalculate:true,formula_version:'v1.0.0',request_id:requestId,action},current);return calculationResult(result,scope,requestId);}catch(cause){if(cause instanceof Error&&/RECALCULATION_(INPUT_CHANGED|RESULT_SUPERSEDED|REQUEST_INTENT_CONFLICT)/.test(cause.message))throw new Error('原計算的輸入、操作意圖或保存版本已改變；未重新計算，也未把舊結果當成新成功。請先核對待確認計算，保留原ID後明確放棄本機參考，再以新操作計算。',{cause});throw cause;}
}
export async function calculateManualProject(client:SupabaseClient,scope:IntakeScope,userId:string,requestId:string,current=()=>true):Promise<CompletedCalculation>{
 const result=await calculationOperation(client,scope,userId,requestId,'calculate',current);if(result.operation_status!=='completed'||!result.input_matches_current||!result.results_are_latest)throw new Error('此計算尚未完成或已是歷史輸入；請核對原操作後再建立新計算。');return result as CompletedCalculation;
}
export async function lookupManualCalculation(client:SupabaseClient,scope:IntakeScope,userId:string,requestId:string,current=()=>true){return calculationOperation(client,scope,userId,requestId,'lookup',current);}
export interface ReportAttempt {requestId:string;version:number}
export async function nextManualReport(client:SupabaseClient,scope:IntakeScope,userId:string,current=()=>true):Promise<ReportAttempt>{
 await manualContext(client,scope,userId,current);const r=await client.from('report_generations').select('report_version').eq('organization_id',uuid(scope.organizationId)).eq('project_id',uuid(scope.projectId)).order('report_version',{ascending:false}).limit(1);check(current);if(r.error||!Array.isArray(r.data))throw new Error('無法核對報告版本。');const version=r.data.length?Number(r.data[0].report_version)+1:1;if(!Number.isSafeInteger(version)||version<1)throw new Error('報告版本無效。');return {requestId:crypto.randomUUID(),version};
}
export async function saveManualReport(client:SupabaseClient,scope:IntakeScope,userId:string,attempt:ReportAttempt,current=()=>true){
 await manualContext(client,scope,userId,current);const result=await invoke(client,'generate-report',{organization_id:scope.organizationId,project_id:scope.projectId,report_version:attempt.version,language:'zh-TW',claim_purpose:'internal_management',request_id:attempt.requestId},current);
 const id=uuid(result?.report_generation_id);const saved=await client.from('report_generations').select('*').eq('id',id).eq('organization_id',scope.organizationId).eq('project_id',scope.projectId).maybeSingle();check(current);
 if(result?.integrity_status!=='server_verified'||saved.error||!saved.data||uuid(saved.data.id)!==id||uuid(saved.data.organization_id)!==uuid(scope.organizationId)||uuid(saved.data.project_id)!==uuid(scope.projectId)||saved.data.integrity_status!=='server_verified'||saved.data.status!=='completed'||saved.data.report_version!==attempt.version||!saved.data.payload||!saved.data.gross_emissions_snapshot)throw new Error('報告尚未核對成功；保留請求識別並重讀，不能當作保存完成。');
 const row=saved.data,payload=row.payload,totals=['scope_1','scope_2','scope_3','unknown'].map(key=>payload.scope_totals?.[key]);
 const gross=row.gross_emissions_snapshot.gross_total_co2e_kg;
 if(totals.some(value=>typeof value!=='number'||!Number.isFinite(value)||value<0)||typeof gross!=='number'||!Number.isFinite(gross)||Math.abs(totals.reduce((a,b)=>a+b,0)-gross)>1e-8||payload.project_metadata?.project_id!==scope.projectId||payload.project_metadata?.organization_id!==scope.organizationId)throw new Error('報告保存的範圍或排放單位不一致，未確認成功。');
 return row;
}
