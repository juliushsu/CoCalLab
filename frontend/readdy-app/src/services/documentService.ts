import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import { IS_STAGING } from '../utils/staging';
import type { UploadedDocument, ExtractedDocumentDraft } from '../types/document';
import { readDraftReviewRows } from './draftReview';
import { IntakeError, listIntakeProjects, getIntakeAccess, uploadIntake, reconcileIntake, completeIntakeRegistration, type IntakeScope, type IntakeAttempt, type IntakeReceipt, type IntakeStage } from './documentIntake';
import { browserIntakeRecovery } from './intakeRecovery';

/**
 * 取得已上傳文件列表
 * @param projectId 若傳入則只回傳該 project 的文件
 */
export async function getUploadedDocuments(projectId?: string): Promise<UploadedDocument[]> {
  if (!isSupabaseConnected()) {
    console.warn('Supabase not connected, returning empty array');
    return [];
  }

  const supabase = getSupabaseClient();
  let query = supabase
    .from('uploaded_documents')
    .select('*, project:projects(name)')
    .order('created_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch uploaded documents:', error);
    throw error;
  }

  const documents = (data || []).map((doc: any) => ({
    ...doc,
    file_url: doc.storage_path
      ? supabase.storage.from(doc.storage_bucket).getPublicUrl(doc.storage_path).data.publicUrl
      : undefined,
    uploaded_at: doc.created_at,
    project_name: doc.project?.name,
  }));

  return documents as UploadedDocument[];
}

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
export async function deleteDocument(documentId: string): Promise<void> {
  if (!isSupabaseConnected()) {
    throw new Error('Supabase not connected');
  }

  const supabase = getSupabaseClient();

  const { data: document } = await supabase
    .from('uploaded_documents')
    .select('storage_path, storage_bucket')
    .eq('id', documentId)
    .maybeSingle();

  if (document?.storage_path) {
    await supabase.storage.from(document.storage_bucket).remove([document.storage_path]);
  }

  const { error } = await supabase
    .from('uploaded_documents')
    .delete()
    .eq('id', documentId);

  if (error) {
    console.error('Failed to delete document:', error);
    throw error;
  }
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
