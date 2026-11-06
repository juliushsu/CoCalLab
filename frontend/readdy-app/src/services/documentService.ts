import {documentDeletionOperation,locateDocumentDeletion} from './documentDeletion';
import {deletionReference,readDeletionReference,clearDeletionReference,rawDeletionReference,abandonDeletionReference,type DeletionTarget} from './documentDeletionRecovery';
import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import { IS_STAGING } from '../utils/staging';
import type { ExtractedDocumentDraft } from '../types/document';
import { readDraftReviewRows } from './draftReview';
import { IntakeError, listIntakeProjects, getIntakeAccess, uploadIntake, reconcileIntake, completeIntakeRegistration, type IntakeScope, type IntakeAttempt, type IntakeReceipt, type IntakeStage } from './documentIntake';
import { browserIntakeRecovery } from './intakeRecovery';
import { readDocumentLibrary, readLibraryProjects, readPrivateOriginal, removeScopedDocument, readScopedDocument, type LibraryDocument, type LibrarySelection } from './documentLibrary';

/**
 * 取得已上傳文件列表
 * @param projectId 若傳入則只回傳該 project 的文件
 */
export function getUploadedDocuments(scope:LibrarySelection,userId:string,isCurrent=()=>true) {return readDocumentLibrary(intakeClient(),scope,userId,isCurrent);}
export function getDocumentProjects(organizationId:string|undefined,userId:string,isCurrent=()=>true) {return readLibraryProjects(intakeClient(),organizationId,userId,isCurrent);}
export function getPrivateDocument(documentId:string,scope:IntakeScope,userId:string,isCurrent=()=>true) {return readPrivateOriginal(intakeClient(),documentId,scope,userId,isCurrent);}

/** Upload-only intake. No OCR/classification invocation or mock fallback. */
function intakeClient() {
  if (!isSupabaseConnected()) throw new IntakeError('read');
  return getSupabaseClient();
}
export function getUploadProjects(organizationId?:string) {
  return listIntakeProjects(intakeClient(),organizationId);
}
export function getUploadAccess(scope:IntakeScope,userId:string,isCurrent=()=>true) {
  return getIntakeAccess(intakeClient(),scope,userId,isCurrent);
}
export function uploadDocument(file:File,projectId:string,organizationId:string,documentType:string,userId:string,isCurrent=()=>true,onStage:(stage:IntakeStage)=>void=()=>{}):Promise<IntakeReceipt> {
  let journal;try{journal=browserIntakeRecovery();}catch(cause){throw new IntakeError('recovery',undefined,{cause});}
  return uploadIntake(intakeClient(),{file,scope:{projectId,organizationId},documentType,staging:IS_STAGING,expectedUserId:userId},journal,isCurrent,onStage);
}
export function recheckUploadReceipt(attempt:IntakeAttempt,isCurrent=()=>true) {
  return reconcileIntake(intakeClient(),attempt,isCurrent,browserIntakeRecovery());
}
export function getIntakeRecovery(userId:string,scope:IntakeScope) {return browserIntakeRecovery().list(userId,scope);}
export function completeUploadReceipt(attempt:IntakeAttempt,userId:string,isCurrent=()=>true) {return completeIntakeRegistration(intakeClient(),attempt,userId,browserIntakeRecovery(),isCurrent);}
export function discardUploadReference(userId:string,scope:IntakeScope,documentId:string) {browserIntakeRecovery().discard(userId,scope,documentId);}
export function intakeQuarantinedCount(userId:string) {return browserIntakeRecovery().quarantinedCount(userId);}

/**
 * 刪除文件
 */
async function deletionRequest(target:DeletionTarget,scope:IntakeScope,userId:string,isCurrent:()=>boolean,action:'delete'|'lookup',serverRequestId?:string){
 if(!isCurrent())throw new Error('登入或專案已切換。');const store=window.localStorage;
 const prior=readDeletionReference(store,scope,userId,target);if(action==='lookup'&&!prior&&!serverRequestId){const found=await locateDocumentDeletion(intakeClient(),scope,userId,target,isCurrent);if(found.operation_status==='not_found')return found;if(!found.request_id)throw new Error('原刪除操作ID未確認。');const recovered=deletionReference(store,scope,userId,target,found.request_id);if(found.operation_status==='deleted')clearDeletionReference(store,scope,userId,recovered);return found;}
 const attempt=deletionReference(store,scope,userId,target,serverRequestId);try{const result=await documentDeletionOperation(intakeClient(),scope,userId,attempt,action,isCurrent);
 if(result.operation_status==='deleted')clearDeletionReference(store,scope,userId,attempt);return result;
 }catch(cause){if(target.expectedReceiptAbsent&&cause&&typeof cause==='object'&&'code' in cause&&cause.code==='RECEIPT_ALREADY_REGISTERED'){
  // A semantic precondition refusal created no server operation. Prove that
  // explicitly before removing only this captured local delete reference.
  try{const status=await documentDeletionOperation(intakeClient(),scope,userId,attempt,'lookup',isCurrent);if(status.operation_status==='not_found')clearDeletionReference(store,scope,userId,attempt);}catch{/* preserve uncertainty/reference */}
 }throw cause;}
}
export async function deleteDocument(documentId:string,scope:IntakeScope,userId:string,isCurrent=()=>true,hint?:LibraryDocument){
 const row=hint??await readScopedDocument(intakeClient(),documentId,scope,userId,isCurrent);if(!isCurrent()||row.id!==documentId||row.organization_id!==scope.organizationId||row.project_id!==scope.projectId)throw new Error('文件範圍已改變。');
 const target={documentId,storageBucket:row.storage_bucket,storagePath:row.storage_path},preferred=row.deletion_state==='pending'||row.deletion_state==='deleted'?row.deletion_request_id??undefined:undefined;
 const attempt=deletionReference(window.localStorage,scope,userId,target,preferred),result=await removeScopedDocument(intakeClient(),documentId,scope,userId,isCurrent,attempt);if(result.operation_status==='deleted')clearDeletionReference(window.localStorage,scope,userId,attempt);return result;
}
export function lookupDocumentDeletion(row:LibraryDocument,userId:string,isCurrent=()=>true){return deletionRequest({documentId:row.id,storageBucket:row.storage_bucket,storagePath:row.storage_path},{organizationId:row.organization_id,projectId:row.project_id},userId,isCurrent,'lookup',row.deletion_request_id??undefined);}
export function forgetLocalDeletionReference(row:LibraryDocument,userId:string){const scope={organizationId:row.organization_id,projectId:row.project_id},raw=rawDeletionReference(window.localStorage,scope,userId,row.id);abandonDeletionReference(window.localStorage,scope,userId,row.id,raw);}
export async function cleanupUploadOriginal(attempt:IntakeAttempt,userId:string,isCurrent=()=>true,lookupOnly=false){
 if(attempt.userId!==userId)throw new Error('不能清理其他使用者的未登記原件。');const scope={organizationId:attempt.organizationId,projectId:attempt.projectId},result=await deletionRequest({documentId:attempt.documentId,storageBucket:attempt.storageBucket,storagePath:attempt.storagePath,expectedReceiptAbsent:true},scope,userId,isCurrent,lookupOnly?'lookup':'delete');
 if(result?.operation_status==='deleted')browserIntakeRecovery().discard(userId,scope,attempt.documentId);return result;
}

/**
 * 取得待審核的草稿列表
 * @param projectId 若傳入則只回傳該 project 的草稿
 */
export async function getExtractedDrafts(projectId?: string, organizationId?: string, documentId?: string): Promise<ExtractedDocumentDraft[]> {
  if (!isSupabaseConnected()) {
    throw new Error('草稿資料服務尚未設定。');
  }

  return readDraftReviewRows(getSupabaseClient(), {projectId, organizationId, documentId});
}

export function forgetUploadDeletionReference(attempt:IntakeAttempt,userId:string){if(attempt.userId!==userId)throw new Error('本機原件參考使用者不符。');const scope={organizationId:attempt.organizationId,projectId:attempt.projectId},raw=rawDeletionReference(window.localStorage,scope,userId,attempt.documentId);abandonDeletionReference(window.localStorage,scope,userId,attempt.documentId,raw);}
