import {verifyStoredFile} from '../../../modules/file-verification/index.js';
export const UPLOAD_VERIFICATION_VERSION='20261106.hash.1';
export const VERIFIED_RECEIPT_FIELDS=['id','organization_id','project_id','uploaded_by_user_id','storage_bucket','storage_path','original_filename','mime_type','file_size_bytes','sha256_hash','document_type','ocr_status','status','env','is_test','created_at','received_date','hash_verification_status','server_verified_at','verified_storage_object_id','deletion_state','deleted_at','deletion_request_id'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const error=(code,status=409)=>Object.assign(new Error(code),{code,status});
const uuid=(value,name)=>{if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw error('INVALID_'+name.toUpperCase(),400);return value.toLowerCase();};
export function validateVerificationInput(value){
 const required=['organization_id','project_id','document_id','request_id','storage_bucket','storage_path','original_filename','document_type','file_size_bytes','mime_type'];
 if(!object(value)||required.some(key=>!Object.hasOwn(value,key))||Object.keys(value).some(key=>![...required,'client_sha256'].includes(key)))throw error('VERIFICATION_INPUT_INVALID',400);
 const v={...value,organization_id:uuid(value.organization_id,'organization_id'),project_id:uuid(value.project_id,'project_id'),document_id:uuid(value.document_id,'document_id')};
 if(typeof v.request_id!=='string'||!v.request_id.trim()||v.request_id!==v.request_id.trim()||v.request_id.length>200)throw error('VERIFICATION_REQUEST_INVALID',400);
 if(!['documents','staging-receipts','staging-attachments'].includes(v.storage_bucket)||!['receipt','invoice','bill','utility_bill','contract','report','other'].includes(v.document_type)||!['application/pdf','image/jpeg','image/png'].includes(v.mime_type)||!Number.isSafeInteger(v.file_size_bytes)||v.file_size_bytes<=0||v.file_size_bytes>10485760)throw error('VERIFICATION_FILE_INPUT_INVALID',400);
 if(typeof v.original_filename!=='string'||!v.original_filename.trim()||v.original_filename.length>255||/[\x00-\x1f\\/]/.test(v.original_filename)||typeof v.storage_path!=='string'||v.storage_path!==`${v.storage_bucket==='documents'?'':'staging/'}${v.project_id}/${v.document_id}.`+v.storage_path.split('.').at(-1)||!/^(pdf|jpg|jpeg|png)$/.test(v.storage_path.split('.').at(-1)))throw error('VERIFICATION_PATH_INVALID',400);
 if(v.client_sha256!==undefined&&(typeof v.client_sha256!=='string'||!/^[a-f0-9]{64}$/.test(v.client_sha256)))throw error('VERIFICATION_CLIENT_HINT_INVALID',400);
 return v;
}
function unwrap(response){
 if(response.error){const message=response.error.message||'VERIFICATION_RPC_FAILED';throw error(message.includes('LEGACY_RECEIPT_REQUIRES_OWNER_REVIEW')?'LEGACY_RECEIPT_REQUIRES_OWNER_REVIEW':message,response.error.code==='42501'?403:409);}
 const value=Array.isArray(response.data)?response.data[0]?.verification:response.data?.verification;
 if(!object(value))throw error('VERIFICATION_RESPONSE_INVALID');return value;
}
function savedResult(result,input){
 const receipt=result.receipt,proof=result.server_proof;
 if(!['verified','duplicate'].includes(result.state)||result.document_id!==input.document_id||result.request_id!==input.request_id||!object(receipt)||!object(proof)||receipt.organization_id!==input.organization_id||receipt.project_id!==input.project_id||receipt.hash_verification_status!=='server_verified'||proof.contract_version!==UPLOAD_VERIFICATION_VERSION||proof.sha256_hash!==receipt.sha256_hash||proof.storage_object_id!==receipt.verified_storage_object_id||proof.verified_at!==receipt.server_verified_at||!/^[a-f0-9]{64}$/.test(proof.sha256_hash)||!Number.isFinite(Date.parse(proof.verified_at)))throw error('VERIFICATION_SAVED_PROOF_INVALID');
 return {...result,receipt:Object.fromEntries(VERIFIED_RECEIPT_FIELDS.map(key=>[key,receipt[key]??null]))};
}
export async function verifyUploadReceipt({client,storage,actorUserId,input,signal}){
 const v=validateVerificationInput(input),begun=unwrap(await client.rpc('begin_upload_verification',{p_actor_user_id:actorUserId,p_input:v}));
 if(begun.state!=='reserved')return savedResult(begun,v);
 if(begun.document_id!==v.document_id||begun.actor_user_id!==actorUserId||begun.organization_id!==v.organization_id||begun.project_id!==v.project_id||begun.bucket!==v.storage_bucket||begun.path!==v.storage_path)throw error('VERIFICATION_RESERVATION_INVALID');
 const result=await verifyStoredFile({storage,reference:{bucket:begun.bucket,path:begun.path},expected:{size:Number(begun.file_size_bytes),mimeType:begun.mime_type},maxBytes:10485760,signal});
 const completed=unwrap(await client.rpc('complete_upload_verification',{p_actor_user_id:actorUserId,p_document_id:v.document_id,p_request_id:v.request_id,p_sha256:result.sha256,p_observed_size:result.size,p_observed_mime:result.mimeType}));
 return savedResult(completed,v);
}
