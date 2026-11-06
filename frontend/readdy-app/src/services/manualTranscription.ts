import type {SupabaseClient} from '@supabase/supabase-js';
import {canonicalUuid,resolveNavigationScope} from './navigationScope.ts';
import type {ExtractedDocumentDraft} from '../types/document.ts';
export const MANUAL_PROVIDER='MANUAL_TRANSCRIPTION_NO_OCR';
export interface ManualScope {organizationId:string;projectId:string;documentId:string}
export interface ManualValues {activity_name:string;quantity:number;unit:string;activity_date:string;category:string;subcategory:null;activity_type:string;final_scope:number|null;inclusion_status:'pending'|'included'|'excluded';exclusion_reason:string|null;review_note:string|null;period_start:string|null;period_end:string|null;source_locator:string;source_text:string|null}
export interface ManualAttempt {draftId:string;requestId:string;transcription:ManualValues;confirmation?:{requestId:string;decision:'confirmed'|'rejected';reviewNote:string|null}}
export function manualScope(documentId:string,search:string):ManualScope{
 const scope=resolveNavigationScope('/admin/documents/list',search),doc=canonicalUuid(documentId);
 if(scope.kind==='invalid'||!doc||!('organizationId' in scope)||!scope.organizationId||!('projectId' in scope)||!scope.projectId)throw new Error('請從指定單位／專案的文件清單進入人工轉錄。');
 return {organizationId:scope.organizationId,projectId:scope.projectId,documentId:doc};
}
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
export function manualJournalKey(scope:ManualScope,user:string){return ['cocal-manual-transcription-v1',user,scope.organizationId,scope.projectId,scope.documentId].join(':');}
export function readManualAttempt(storage:Pick<Storage,'getItem'>,scope:ManualScope,user:string):ManualAttempt|null{
 const raw=storage.getItem(manualJournalKey(scope,user));if(!raw)return null;
 let value:unknown;try{value=JSON.parse(raw);}catch{throw new Error('本機恢復參考損壞，請明確放棄該參考後重讀；不會刪除伺服器原件或草稿。');}
 if(!object(value)||!canonicalUuid(value.draftId)||!canonicalUuid(value.requestId)||!object(value.transcription))throw new Error('本機恢復參考無效；請放棄該參考並重讀，不自動換ID重送。');
 return value as unknown as ManualAttempt;
}
export function writeManualAttempt(storage:Pick<Storage,'setItem'>,scope:ManualScope,user:string,value:ManualAttempt){storage.setItem(manualJournalKey(scope,user),JSON.stringify(value));}
export function abandonManualAttempt(storage:Pick<Storage,'removeItem'>,scope:ManualScope,user:string){storage.removeItem(manualJournalKey(scope,user));}
export function manualFormValues(form:Record<string,string>):ManualValues{
 const required=(key:string)=>{const value=form[key]?.trim();if(!value)throw new Error('請明填 '+key+'。');return value;};
 const nullable=(key:string)=>form[key]?.trim()||null;
 const quantityText=required('quantity');if(!/^\d+(?:\.\d{1,8})?$/.test(quantityText))throw new Error('數量須為非負數，最多8位小數，不能以空白代替0。');
 const quantity=Number(quantityText);if(!Number.isFinite(quantity)||quantity>=1e12)throw new Error('數量超出可保存範圍。');
 const inclusion=required('inclusion_status');if(!['included','excluded','pending'].includes(inclusion))throw new Error('納入狀態無效。');
 const scope=nullable('final_scope'),final_scope=scope?Number(scope):null;
 if(final_scope!==null&&![1,2,3].includes(final_scope)||inclusion==='included'&&final_scope===null)throw new Error('納入盤查必須明選Scope 1/2/3。');
 if(inclusion==='excluded'&&!nullable('exclusion_reason'))throw new Error('排除必須填原因。');
 const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!validDate(required('activity_date')))throw new Error('活動日期須為有效YYYY-MM-DD。');
 const start=nullable('period_start'),end=nullable('period_end');if(Boolean(start)!==Boolean(end)||start&&end&&(!validDate(start)||!validDate(end)||start>end))throw new Error('文件期間須完整有序，或兩欄皆留空表示未知。');
 return {activity_name:required('activity_name'),quantity,unit:required('unit'),activity_date:required('activity_date'),category:required('category'),subcategory:null,activity_type:required('activity_type'),final_scope,inclusion_status:inclusion as ManualValues['inclusion_status'],exclusion_reason:nullable('exclusion_reason'),review_note:nullable('review_note'),period_start:start,period_end:end,source_locator:required('source_locator'),source_text:nullable('source_text')};
}
function checkDraft(value:unknown,scope:ManualScope):ExtractedDocumentDraft{
 if(!object(value)||value.organization_id!==scope.organizationId||value.project_id!==scope.projectId||value.uploaded_document_id!==scope.documentId||!canonicalUuid(value.id)||value.extraction_provider!==MANUAL_PROVIDER||value.is_latest!==true||!object(value.normalized_payload)||!object(value.raw_payload))throw new Error('人工草稿不符合目前文件與單位／專案。');
 return value as unknown as ExtractedDocumentDraft;
}
export async function readManualDraft(client:SupabaseClient,scope:ManualScope,isCurrent=()=>true){
 if(!isCurrent())throw new Error('操作範圍已變更。');
 const {data,error}=await client.from('extracted_document_drafts').select('*').eq('organization_id',scope.organizationId).eq('project_id',scope.projectId).eq('uploaded_document_id',scope.documentId).eq('extraction_provider',MANUAL_PROVIDER).eq('is_latest',true).maybeSingle();
 if(!isCurrent())throw new Error('操作範圍已變更。');if(error)throw error;return data?checkDraft(data,scope):null;
}
async function invoke(client:SupabaseClient,name:string,body:unknown,isCurrent:()=>boolean){
 if(!isCurrent())throw new Error('操作範圍已變更。');const {data,error}=await client.functions.invoke(name,{body});
 if(!isCurrent())throw new Error('操作範圍已變更。');
 if(error){let detail=error.message;try{const response=(error as {context?:Response}).context;if(response){const b=await response.clone().json();detail=b.error?.message||detail;}}catch{/* preserve original */}throw new Error(detail);}
 if(data?.success!==true||!object(data.data))throw new Error(data?.error?.message||'未確認伺服器保存，請保留原ID核對。');return data;
}
export async function submitManualTranscription(client:SupabaseClient,scope:ManualScope,attempt:ManualAttempt,isCurrent:()=>boolean){
 const response=await invoke(client,'manual-transcription',{organization_id:scope.organizationId,project_id:scope.projectId,document_id:scope.documentId,draft_id:attempt.draftId,request_id:attempt.requestId,transcription:attempt.transcription},isCurrent);
 if(response.data.draft_id!==attempt.draftId||response.data.document_id!==scope.documentId||response.data.organization_id!==scope.organizationId||response.data.project_id!==scope.projectId||response.data.extraction_provider!==MANUAL_PROVIDER)throw new Error('保存回覆識別不符，不能宣稱完成。');return response.data;
}
export async function confirmManualTranscription(client:SupabaseClient,scope:ManualScope,draft:ExtractedDocumentDraft,intent:NonNullable<ManualAttempt['confirmation']>,isCurrent:()=>boolean){
 checkDraft(draft,scope);
 const response=await invoke(client,'confirm-draft',{organization_id:scope.organizationId,project_id:scope.projectId,draft_id:draft.id,decision:intent.decision,request_id:intent.requestId,overrides:{review_note:intent.reviewNote}},isCurrent);
 if(response.data.draft_id!==draft.id||response.data.draft_status!==intent.decision)throw new Error('確認回覆識別或狀態不符，請核對既有草稿。');return response;
}

export function requireMatchingManualAttempt(attempt:ManualAttempt|null,draft:Pick<ExtractedDocumentDraft,'id'>|null){if(attempt&&draft&&attempt.draftId!==draft.id)throw new Error('本機恢復參考屬於舊草稿版本；請明確放棄該參考後重新核對，不套用舊確認決定。');}
