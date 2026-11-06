import type {SupabaseClient} from '@supabase/supabase-js';
import {canonicalUuid} from './navigationScope.ts';import type {IntakeScope} from './documentIntake.ts';import type {DeletionAttempt,DeletionTarget} from './documentDeletionRecovery.ts';
export interface DocumentDeletionResult {
 organization_id:string;project_id:string;document_id:string;request_id:string|null;
 operation_status:'not_found'|'pending'|'deleted';phase:'not_found'|'prepared'|'object_absent'|'finalized';replayed:boolean;
 receipt_present:boolean|null;original_missing:boolean|null;storage_absent:boolean|null;
 storage_bucket:string|null;storage_path:string|null;deletion_state:'active'|'pending'|'deleted'|null;deleted_at:string|null;
}
const current=(check:()=>boolean)=>{if(!check())throw new Error('登入或專案已切換；舊刪除結果不採用，已送出的操作請用原ID重新核對。');};
const uuid=(value:unknown)=>{const result=canonicalUuid(value);if(!result)throw new Error('刪除範圍或操作識別無效。');return result;};
function descriptor(bucket:unknown,path:unknown,project:string){if(typeof bucket!=='string'||!['documents','staging-receipts','staging-attachments'].includes(bucket)||typeof path!=='string'||!path||path.endsWith(' ')||/[\\%?#]/.test(path)||Array.from(path).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127))return false;const parts=path.split('/');if(parts.some(part=>!part||part==='.'||part==='..'))return false;return bucket==='documents'?parts.length===2&&canonicalUuid(parts[0])===project:parts.length===3&&parts[0]==='staging'&&canonicalUuid(parts[1])===project;}
async function access(client:SupabaseClient,scope:IntakeScope,userId:string,isCurrent:()=>boolean){
 const org=uuid(scope.organizationId),project=uuid(scope.projectId);current(isCurrent);const auth=await client.auth.getUser();current(isCurrent);if(auth.error||uuid(auth.data.user?.id)!==uuid(userId))throw new Error('請重新登入後核對刪除操作。');
 const response=await client.rpc('document_deletion_contract',{p_project_id:project});current(isCurrent);const rows=response.data;
 if(response.error||!Array.isArray(rows)||rows.length!==1||rows[0]?.project_id!==project||rows[0]?.organization_id!==org||rows[0]?.contract_version!=='20261106.delete.1'||typeof rows[0]?.can_delete!=='boolean')throw new Error('受控刪除服務版本尚未確認；未使用舊Storage／收件兩步刪除。');if(!rows[0].can_delete)throw new Error('目前權限或訂閱不允許此刪除／核對操作。');
}
function parse(value:unknown,scope:IntakeScope,attempt:DeletionTarget & {requestId?:string}):DocumentDeletionResult {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('刪除回覆無效；保留原ID後核對。');const row=value as DocumentDeletionResult;
 if(row.organization_id!==scope.organizationId||row.project_id!==scope.projectId||row.document_id!==attempt.documentId||(attempt.requestId!==undefined?row.request_id!==attempt.requestId:row.operation_status==='not_found'?row.request_id!==null:!canonicalUuid(row.request_id))||typeof row.replayed!=='boolean'||!['not_found','pending','deleted'].includes(row.operation_status))throw new Error('刪除回覆範圍或操作ID不符；未確認成功。');
 if(row.operation_status==='not_found'){
  if(row.phase!=='not_found'||row.receipt_present!==null||row.original_missing!==null||row.storage_absent!==null||row.deletion_state!==null||row.deleted_at!==null)throw new Error('查無操作不能代表檔案已存在或已刪除。');
 }else{
  if(attempt.expectedReceiptAbsent&&row.receipt_present===true)throw new Error('此原件已登記；不得以未登記清理操作刪除回執。');
  if(typeof row.receipt_present!=='boolean'||typeof row.original_missing!=='boolean'||typeof row.storage_absent!=='boolean'||!descriptor(row.storage_bucket,row.storage_path,scope.projectId)||(attempt.storageBucket!==undefined&&row.storage_bucket!==attempt.storageBucket)||(attempt.storagePath!==undefined&&row.storage_path!==attempt.storagePath))throw new Error('刪除原件綁定或保存狀態不完整。');
  if(row.operation_status==='deleted'){
   if(row.phase!=='finalized'||row.storage_absent!==true||row.deletion_state!==(row.receipt_present?'deleted':null)||typeof row.deleted_at!=='string'||!Number.isFinite(Date.parse(row.deleted_at)))throw new Error('跨服務刪除尚未確認完成；保留原ID核對。');
  }else if(!['prepared','object_absent'].includes(row.phase)||row.storage_absent!==(row.phase==='object_absent')||row.deletion_state!==(row.receipt_present?'pending':null)||row.deleted_at!==null)throw new Error('刪除仍待核對，不能以部分結果表示完成。');
 }
 return row;
}
async function performDeletionOperation(client:SupabaseClient,scope:IntakeScope,userId:string,attempt:DeletionTarget & {requestId?:string},action:'delete'|'lookup'|'locate',isCurrent=()=>true):Promise<DocumentDeletionResult>{
 uuid(attempt.documentId);if(action!=='locate')uuid(attempt.requestId);if((attempt.storageBucket!==undefined||attempt.storagePath!==undefined)&&!descriptor(attempt.storageBucket,attempt.storagePath,uuid(scope.projectId)))throw new Error('原件路徑無效；未發出刪除。');
 await access(client,scope,userId,isCurrent);current(isCurrent);
 const response=await client.functions.invoke('delete-uploaded-document',{body:{organization_id:uuid(scope.organizationId),project_id:uuid(scope.projectId),document_id:uuid(attempt.documentId),...(action==='locate'?{}:{request_id:uuid(attempt.requestId)}),action,...(attempt.expectedReceiptAbsent?{expected_receipt_absent:true}:{}),...(attempt.storageBucket?{storage_bucket:attempt.storageBucket,storage_path:attempt.storagePath}:{})}});current(isCurrent);
 if(response.error||response.data?.success!==true){let body=response.data;if(response.error?.context instanceof Response){try{body=await response.error.context.clone().json();}catch{/* retain uncertainty */}current(isCurrent);}throw Object.assign(new Error('刪除未確認；操作／原件 '+(attempt.requestId??attempt.documentId)+'。保留同一操作ID並按核對／重試，不宣稱檔案已復原。'+(body?.error?.message?' '+body.error.message:'')),{code:body?.error?.code});}
 return parse(response.data.data,scope,attempt);
}

export function documentDeletionOperation(client:SupabaseClient,scope:IntakeScope,userId:string,attempt:DeletionAttempt,action:'delete'|'lookup',isCurrent=()=>true){return performDeletionOperation(client,scope,userId,attempt,action,isCurrent);}
/** Discover this authenticated actor's exact original operation; never creates one. */
export function locateDocumentDeletion(client:SupabaseClient,scope:IntakeScope,userId:string,target:DeletionTarget,isCurrent=()=>true){return performDeletionOperation(client,scope,userId,target,'locate',isCurrent);}
