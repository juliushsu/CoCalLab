import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import { IS_STAGING } from '../utils/staging';
import type { ExtractedDocumentDraft } from '../types/document';
import { readDraftReviewRows } from './draftReview';
import { IntakeError, listIntakeProjects, getIntakeAccess, uploadIntake, reconcileIntake, completeIntakeRegistration, type IntakeScope, type IntakeAttempt, type IntakeReceipt, type IntakeStage } from './documentIntake';
import { browserIntakeRecovery } from './intakeRecovery';
import { readDocumentLibrary, readLibraryProjects, readPrivateOriginal, removeScopedDocument, type LibrarySelection } from './documentLibrary';

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
export function deleteDocument(documentId:string,scope:IntakeScope,userId:string,isCurrent=()=>true) {return removeScopedDocument(intakeClient(),documentId,scope,userId,isCurrent);}

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
