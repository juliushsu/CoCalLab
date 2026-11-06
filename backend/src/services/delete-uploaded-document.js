export const DOCUMENT_DELETION_VERSION='20261106.delete.1';
const fields=['organization_id','project_id','document_id','request_id','operation_status','phase','replayed','receipt_present','original_missing','storage_absent','storage_bucket','storage_path','deletion_state','deleted_at'];
const fail=(code,status=409)=>Object.assign(new Error(code),{code,status});
export function validateDeletionInput(value){
 const allowed=['organization_id','project_id','document_id','request_id','action','storage_bucket','storage_path','expected_receipt_absent'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw fail('DOCUMENT_DELETE_INPUT_INVALID',400);
 const v={...value};
 for(const key of ['organization_id','project_id','document_id',...(v.action==='locate'?[]:['request_id'])]){if(typeof v[key]!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v[key]))throw fail('DOCUMENT_DELETE_INPUT_INVALID',400);v[key]=v[key].toLowerCase();}
 if(v.expected_receipt_absent!==undefined&&typeof v.expected_receipt_absent!=='boolean')throw fail('DOCUMENT_DELETE_INPUT_INVALID',400);
 if(v.action==='locate'?v.request_id!==undefined:typeof v.request_id!=='string'||v.request_id!==v.request_id.trim()||!v.request_id||v.request_id.length>200)throw fail('DOCUMENT_DELETE_INPUT_INVALID',400);
 if(v.action!==undefined&&!['delete','lookup','locate'].includes(v.action))throw fail('DOCUMENT_DELETE_INPUT_INVALID',400);
 if(('storage_bucket'in v)!==('storage_path'in v)||('storage_bucket'in v&&(!['documents','staging-receipts','staging-attachments'].includes(v.storage_bucket)||typeof v.storage_path!=='string'||!v.storage_path||/[%?#\x00-\x1f\x7f\\]/.test(v.storage_path)||v.storage_path.endsWith(' '))))throw fail('DOCUMENT_DELETE_PATH_INVALID',400);
 return {...v,action:v.action||'delete'};
}
function unwrap(response){
 if(response.error)throw fail(response.error.message||'DOCUMENT_DELETE_RPC_FAILED',response.error.code==='42501'?403:409);
 const value=Array.isArray(response.data)?response.data[0]?.operation:response.data?.operation;
 if(!value||typeof value!=='object')throw fail('DOCUMENT_DELETE_RESPONSE_INVALID');return value;
}
function checked(state,input){
 const requestMatches=input.action==='locate'?(state.operation_status==='not_found'?state.request_id===null:typeof state.request_id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(state.request_id)):state.request_id===input.request_id;
 if(state.organization_id!==input.organization_id||state.project_id!==input.project_id||state.document_id!==input.document_id||!requestMatches||!['not_found','pending','deleted'].includes(state.operation_status))throw fail('DOCUMENT_DELETE_RESPONSE_INVALID');
 if(state.operation_status==='deleted'&&(state.storage_absent!==true||state.phase!=='finalized'||!Number.isFinite(Date.parse(state.deleted_at))))throw fail('DOCUMENT_DELETE_FINALIZATION_UNCONFIRMED');
 return Object.fromEntries(fields.map(key=>[key,state[key]??null]));
}
export async function deleteUploadedDocument({client,actorUserId,input}){
 const v=validateDeletionInput(input),{action,...intent}=v;
 const state=checked(unwrap(await client.rpc('document_deletion_request',{p_actor_user_id:actorUserId,p_input:intent,p_action:action==='delete'?'prepare':action})),v);
 if(action!=='delete'||state.operation_status==='deleted')return state;
 if(state.operation_status!=='pending')throw fail('DOCUMENT_DELETE_PREPARATION_UNCONFIRMED');
 if(!state.storage_absent){
  const removed=await client.storage.from(state.storage_bucket).remove([state.storage_path]);
  if(removed.error)throw fail('DOCUMENT_DELETE_STORAGE_UNCONFIRMED',502);
  // An empty/ambiguous ACK is not proof. A committed response loss is recovered
  // only on the next same-ID call, whose SQL reads authoritative absence.
  if(!Array.isArray(removed.data)||removed.data.length!==1||removed.data[0]?.name!==state.storage_path)throw fail('DOCUMENT_DELETE_STORAGE_ACK_INVALID',502);
 }
 const completed=checked(unwrap(await client.rpc('finalize_document_deletion',{p_actor_user_id:actorUserId,p_input:intent})),v);
 if(completed.operation_status!=='deleted')throw fail('DOCUMENT_DELETE_FINALIZATION_UNCONFIRMED');
 return completed;
}
