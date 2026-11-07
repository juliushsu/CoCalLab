import type {SupabaseClient} from '@supabase/supabase-js';
import type {IntakeScope} from './documentIntake.ts';
import {canonicalUuid} from './navigationScope.ts';
import {manualContext,manualPayload,type ManualInput,type ManualProject} from './manualWorkflow.ts';
import type {ReplacementReference} from './activityReplacementRecovery.ts';
export interface ReplacementIntent {mode:'correct'|'exclude';reason:string;input:Record<string,unknown>}
export interface ReplacementResult {organization_id:string;project_id:string;predecessor_activity_id:string;activity_id:string|null;request_id:string;mode:'correct'|'exclude';replayed:boolean;operation_status:'not_found'|'completed'|'historical';is_effective:boolean;recalculation_required:boolean|null;activity?:Record<string,unknown>}
const keys=['activity_name','activity_date','category','subcategory','activity_type','quantity','unit','data_quality','inclusion_status','exclusion_reason','review_note','final_scope','status'];
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const uuid=(value:unknown)=>{const result=canonicalUuid(value);if(!result)throw new Error('活動取代識別無效。');return result;};
export function canonicalReplacementIntent(value:unknown):ReplacementIntent{
 if(!object(value)||Object.keys(value).some(key=>!['mode','reason','input'].includes(key))||!['correct','exclude'].includes(String(value.mode))||typeof value.reason!=='string'||!value.reason.trim()||value.reason.trim().length>2000||!object(value.input))throw new Error('請明確選擇更正／排除並填寫理由。');
 const input=value.input;if(value.mode==='exclude'){if(Object.keys(input).length)throw new Error('排除沿用原數量與單位，不接受歸零或改值。');}
 else{
  if(Object.keys(input).some(key=>!keys.includes(key))||['activity_name','activity_date','category','activity_type','unit'].some(key=>typeof input[key]!=='string'||!String(input[key]).trim())||!/^\d{4}-\d{2}-\d{2}$/.test(String(input.activity_date))||!Number.isFinite(Date.parse(String(input.activity_date)))||new Date(String(input.activity_date)).toISOString().slice(0,10)!==input.activity_date||typeof input.quantity!=='number'||!Number.isFinite(input.quantity)||input.quantity<0||input.quantity>=1e12||Number(input.quantity.toFixed(8))!==input.quantity||!['included','pending'].includes(String(input.inclusion_status))||!(input.final_scope===null||[1,2,3].includes(input.final_scope as number))||input.inclusion_status==='included'&&input.final_scope===null||input.status!=='active')throw new Error('新版更正欄位無效；排除請使用排除模式，不更改原用量。');
 }
 return {mode:value.mode as ReplacementIntent['mode'],reason:value.reason.trim(),input:Object.fromEntries(Object.keys(input).sort().map(key=>[key,input[key]]))};
}
export function replacementFormIntent(mode:'correct'|'exclude',reason:string,input:ManualInput,scope:IntakeScope,user:string,id:string,project:ManualProject):ReplacementIntent{
 if(mode==='exclude')return canonicalReplacementIntent({mode,reason,input:{}});
 const value=manualPayload({...input,status:'active'},scope,user,id,project);
 return canonicalReplacementIntent({mode,reason,input:Object.fromEntries(keys.map(key=>[key,value[key as keyof typeof value]]))});
}
export function replacementReferenceForm(intent:ReplacementIntent,original:ManualInput):ManualInput{
 const value=canonicalReplacementIntent(intent);if(value.mode==='exclude')return original;const input=value.input;
 return {activity_name:String(input.activity_name),activity_date:String(input.activity_date),category:String(input.category),subcategory:input.subcategory as string|null??null,activity_type:String(input.activity_type),quantity:String(input.quantity),unit:String(input.unit),final_scope:input.final_scope===null?'':String(input.final_scope),inclusion_status:String(input.inclusion_status),exclusion_reason:String(input.exclusion_reason??''),notes:String(input.review_note??''),data_quality:String(input.data_quality??'primary'),status:'active'};
}
export function parseReplacementResult(value:unknown,scope:IntakeScope,reference:ReplacementReference):ReplacementResult{
 if(!object(value)||value.organization_id!==uuid(scope.organizationId)||value.project_id!==uuid(scope.projectId)||value.predecessor_activity_id!==uuid(reference.predecessorId)||value.request_id!==reference.requestId||value.mode!==reference.intent.mode||typeof value.replayed!=='boolean'||typeof value.is_effective!=='boolean'||!['not_found','completed','historical'].includes(String(value.operation_status)))throw new Error('取代結果的範圍或請求識別不一致，請保留原參考核對。');
 if(value.operation_status==='not_found'){if(value.activity_id!==null||value.is_effective||value.recalculation_required!==null)throw new Error('未找到取代操作，不得顯示為保存或零排放成功。');}
 else if(!canonicalUuid(value.activity_id)||value.activity_id===reference.predecessorId||typeof value.recalculation_required!=='boolean'||value.is_effective!==(value.operation_status==='completed'))throw new Error('取代保存結果不完整或歷史狀態不一致。');
 return value as unknown as ReplacementResult;
}
export async function replacementOperation(client:SupabaseClient,scope:IntakeScope,user:string,reference:ReplacementReference,action:'lookup'|'replace',isCurrent=()=>true):Promise<ReplacementResult>{
 const intent=canonicalReplacementIntent(reference.intent);uuid(reference.requestId);uuid(reference.predecessorId);await manualContext(client,scope,user,isCurrent);
 if(!isCurrent())throw new Error('登入或專案已切換。');
 const response=await client.functions.invoke('replace-emission-activity',{body:{organization_id:uuid(scope.organizationId),project_id:uuid(scope.projectId),predecessor_activity_id:uuid(reference.predecessorId),request_id:reference.requestId,...intent,action}});
 if(!isCurrent())throw new Error('登入或專案已切換；原取代請求保留以供核對。');
 if(response.error||!response.data?.success||response.data.error){let body=response.data;if(response.error?.context instanceof Response){try{body=await response.error.context.clone().json();}catch{/* preserve transport failure */}}if(!isCurrent())throw new Error('登入或專案已切換。');throw new Error(body?.error?.message||response.error?.message||'取代尚未確認；保留同一ID核對或重試。');}
 const result=parseReplacementResult(response.data.data,scope,reference);if(result.operation_status==='not_found')return result;
 const read=await client.from('emission_activities').select('*').eq('id',result.activity_id!).eq('organization_id',scope.organizationId).eq('project_id',scope.projectId).maybeSingle();if(!isCurrent())throw new Error('登入或專案已切換；舊取代結果不採用。');
 const row=read.data;if(read.error||!object(row)||row.id!==result.activity_id||row.organization_id!==scope.organizationId||row.project_id!==scope.projectId||typeof row.quantity!=='number'||!Number.isFinite(row.quantity)||row.quantity<0||typeof row.unit!=='string'||!row.unit.trim()||intent.mode==='correct'&&Object.entries(intent.input).some(([key,value])=>row[key]!==value)||intent.mode==='exclude'&&(row.inclusion_status!=='excluded'||row.exclusion_reason!==intent.reason))throw new Error('未讀回符合本次取代的新活動；保留原請求，不能當作成功。');
 return {...result,activity:row};
}
