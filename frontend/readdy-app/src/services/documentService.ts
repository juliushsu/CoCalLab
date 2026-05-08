import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import { IS_STAGING } from '../utils/staging';
import type { UploadedDocument, ExtractedDocumentDraft } from '../types/document';

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

/**
 * 重複文件檢查：以 SHA-256 hash 比對同一 project 內是否已存在相同檔案
 * @returns 若已存在則回傳該文件資訊，否則回傳 null
 */
export async function checkDuplicateDocument(
  sha256Hash: string,
  projectId: string
): Promise<UploadedDocument | null> {
  if (!isSupabaseConnected()) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('uploaded_documents')
    .select('*, project:projects(name)')
    .eq('sha256_hash', sha256Hash)
    .eq('project_id', projectId)
    .maybeSingle();

  if (error) {
    console.error('Failed to check duplicate document:', error);
    return null;
  }

  if (!data) return null;

  return {
    ...data,
    project_name: (data as any).project?.name,
  } as UploadedDocument;
}

/**
 * 上傳文件到 Supabase Storage 並建立記錄
 *
 * Bucket / Path 路由規則：
 *   Production:
 *     bucket: 'documents'
 *     path:   {projectId}/{timestamp}_{original_name}
 *
 *   Staging (IS_STAGING = true):
 *     bucket: 'staging-receipts'   → documentType === 'receipt'
 *             'staging-attachments' → 其他所有類型
 *     path:   staging/{projectId}/TEST_{timestamp}_{original_name}
 *
 * Codex spec aligned: 2026-03-18
 */
export async function uploadDocument(
  file: File,
  projectId: string,
  organizationId: string,
  documentType: string
): Promise<{ documentId: string; storagePath: string }> {
  if (!isSupabaseConnected()) {
    throw new Error('Supabase not connected');
  }

  const supabase = getSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  const uploadedByUserId = user?.id ?? null;

  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sha256Hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const timestamp = Date.now();

  // ── Bucket & Path resolution ──────────────────────────────────────
  let storageBucket: string;
  let storagePath: string;

  if (IS_STAGING) {
    storageBucket =
      documentType === 'receipt' ? 'staging-receipts' : 'staging-attachments';
    const stagingFileName = `TEST_${timestamp}_${file.name}`;
    storagePath = `staging/${projectId}/${stagingFileName}`;
  } else {
    storageBucket = 'documents';
    storagePath = `${projectId}/${timestamp}_${file.name}`;
  }
  // ─────────────────────────────────────────────────────────────────

  const { error: uploadError } = await supabase.storage
    .from(storageBucket)
    .upload(storagePath, file);

  if (uploadError) {
    console.error('Failed to upload file to storage:', uploadError);
    throw uploadError;
  }

  const { data, error: insertError } = await supabase
    .from('uploaded_documents')
    .insert({
      organization_id: organizationId,
      project_id: projectId,
      uploaded_by_user_id: uploadedByUserId,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      sha256_hash: sha256Hash,
      document_type: documentType,
      ocr_status: 'pending',
      status: 'active',
      metadata: {},
      received_date: new Date().toISOString().split('T')[0],
      ...(IS_STAGING ? { is_test: true, env: 'staging' } : {}),
    })
    .select()
    .maybeSingle();

  if (insertError) {
    console.error('Failed to create document record:', insertError);
    throw insertError;
  }

  return {
    documentId: data.id,
    storagePath,
  };
}

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
export async function getExtractedDrafts(projectId?: string): Promise<ExtractedDocumentDraft[]> {
  if (!isSupabaseConnected()) {
    console.warn('Supabase not connected, returning empty array');
    return [];
  }

  const supabase = getSupabaseClient();
  let query = supabase
    .from('extracted_document_drafts')
    .select('*, document:uploaded_documents(original_filename, project:projects(name))')
    .in('status', ['pending_review', 'needs_clarification'])
    .order('created_at', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch extracted drafts:', error);
    throw error;
  }

  return (data || []) as ExtractedDocumentDraft[];
}
