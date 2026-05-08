// OCR 狀態 — 對齊 DB enum ocr_status
export type OcrStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

// 上傳狀態 — 對齊 DB enum upload_status
export type UploadStatus = 'active' | 'archived';

// 草稿狀態 — 對齊 DB enum draft_status
export type DraftStatus = 'pending_review' | 'needs_clarification' | 'confirmed' | 'rejected';

// 分類狀態 — 對齊 DB enum classification_status
export type ClassificationStatus = 'unclassified' | 'classified';

// 文件類型
export type DocumentType =
  | 'receipt'
  | 'invoice'
  | 'bill'
  | 'utility_bill'
  | 'contract'
  | 'report'
  | 'other';

// 上傳文件 — 對齊 DB schema uploaded_documents
export interface UploadedDocument {
  id: string;
  organization_id: string;
  project_id: string;
  project_name?: string;               // join from projects
  uploaded_by_user_id: string | null;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  file_size_bytes: number;
  sha256_hash: string;
  document_type: DocumentType;
  ocr_status: OcrStatus;
  status: UploadStatus;
  metadata: Record<string, unknown>;
  received_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;

  // 計算欄位（前端使用）
  file_url?: string;                   // 從 storage_path 計算得出
  uploaded_at?: string;                // alias for created_at
}

// OCR 萃取草稿 — 對齊 DB schema extracted_document_drafts
export interface ExtractedDocumentDraft {
  id: string;
  organization_id: string;
  project_id: string;
  uploaded_document_id: string;
  extraction_version: number;
  extraction_provider?: string | null;
  raw_payload: Record<string, unknown>;
  normalized_payload: Record<string, unknown>;
  status: DraftStatus;                 // DB 欄位名稱是 status（非 draft_status）
  classification_status: ClassificationStatus;
  confidence_score?: number | null;
  suggested_activity_date?: string | null;
  suggested_category?: string | null;
  suggested_scope?: number | null;
  parsed_quantity?: number | null;
  parsed_unit?: string | null;
  parsed_vendor?: string | null;
  review_note?: string | null;
  reviewed_by_user_id?: string | null;
  reviewed_at?: string | null;
  is_latest: boolean;
  created_at: string;
  updated_at: string;

  // join 欄位
  document?: {
    original_filename?: string;
    project?: { name?: string };
  };
}

// 上傳文件輸入
export interface UploadDocumentInput {
  project_id: string;
  organization_id: string;
  files: File[];
  document_type?: DocumentType;
}

// 確認草稿輸入
export interface ConfirmDraftInput {
  draft_id: string;
  review_note?: string;
  suggested_category?: string;
  suggested_scope?: number;
}
