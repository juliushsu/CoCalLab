import {canonicalUuid} from './navigationScope.ts';
export function attachmentVerificationView(row:{hash_verification_status?:unknown;server_verified_at?:unknown;verified_storage_object_id?:unknown;sha256_hash?:unknown;deletion_state?:unknown}){
 if(row.hash_verification_status===undefined||row.hash_verification_status===null||row.hash_verification_status==='legacy_unverified')return {state:'legacy_unverified' as const,label:'未經服務端hash驗證；歷史或前端聲明不視為可信證據。'};
 if(row.hash_verification_status!=='server_verified'||typeof row.server_verified_at!=='string'||!Number.isFinite(Date.parse(row.server_verified_at))||!canonicalUuid(row.verified_storage_object_id)||typeof row.sha256_hash!=='string'||!/^[a-f0-9]{64}$/.test(row.sha256_hash))return {state:'invalid' as const,label:'服務端驗證紀錄不完整，不能宣稱已驗證。'};
 return {state:'server_verified' as const,label:row.deletion_state==='deleted'?'服務端曾驗證原件SHA256；原件已移除，回執僅供稽核。':row.deletion_state==='pending'?'服務端曾驗證原件SHA256；目前刪除待核對，不能視為原件仍可用。':'服務端已讀取原件並保存SHA256驗證；不是內容真實性、安全掃描或合規認證。'};
}
