import type { ExtractedDocumentDraft, ConfirmDraftInput } from '../types/document.ts';
import type { ApiResponse, EdgeFunctionOptions } from './types.ts';
import { canonicalUuid, resolveNavigationScope } from './navigationScope.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
export interface DraftReviewScope {
    organizationId?: string;
    projectId?: string;
    documentId?: string;
}
export interface DraftReviewEdits {
    reviewNote?: string;
    category?: string;
    scope?: string;
}
export type DraftDecision = 'confirmed' | 'rejected';
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export const isSyntheticDraft = (draft: ExtractedDocumentDraft) => /^(mock|fixture|synthetic)(-|$)/i.test(draft.extraction_provider || '');
export function draftReviewValues(draft: ExtractedDocumentDraft) {
    const payload = record(draft.normalized_payload) ? draft.normalized_payload : {};
    return { quantity: typeof payload.quantity === 'number' && Number.isFinite(payload.quantity) ? String(payload.quantity) : '未提供', unit: typeof payload.unit === 'string' && payload.unit.trim() ? payload.unit : '未提供', activityDate: typeof payload.activity_date === 'string' && payload.activity_date ? payload.activity_date : '未提供' };
}
// Match the existing backend write contract, including UUID version and variant.
const isWriteUuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const uuid = (value: unknown) => { const id = canonicalUuid(value); if (!id || !isWriteUuid(id))
    throw new Error('草稿或組織／專案識別資料無效。'); return id; };
export function draftReviewScope(search: string): DraftReviewScope {
    const scope = resolveNavigationScope('/admin/documents/drafts', search);
    if (scope.kind === 'invalid')
        throw new Error('組織／專案範圍不明確，請重新選擇。');
    const documents = new URLSearchParams(search).getAll('document');
    if (documents.length > 1) throw new Error('文件範圍不明確，請重新選擇。');
    const documentId = documents.length ? uuid(documents[0]) : undefined;
    return { ...('organizationId' in scope && scope.organizationId ? { organizationId: scope.organizationId } : {}), ...('projectId' in scope && scope.projectId ? { projectId: scope.projectId } : {}), ...(documentId ? {documentId} : {}) };
}
function validateIdentity(draft: ExtractedDocumentDraft, scope: DraftReviewScope) {
    const organization_id = uuid(draft.organization_id), project_id = uuid(draft.project_id), draft_id = uuid(draft.id);
    if ((scope.organizationId && uuid(scope.organizationId) !== organization_id) || (scope.projectId && uuid(scope.projectId) !== project_id))
        throw new Error('草稿不屬於目前選取的組織／專案。');
    if (scope.documentId && uuid(draft.uploaded_document_id) !== uuid(scope.documentId))
        throw new Error('草稿不屬於目前選取的文件。');
    if (!['pending_review', 'needs_clarification'].includes(draft.status) || draft.is_latest !== true)
        throw new Error('此草稿已處理或不是最新版本，請重新讀取。');
    return { organization_id, project_id, draft_id };
}
export function validateDraftReviewRows(value: unknown, scope: DraftReviewScope): ExtractedDocumentDraft[] {
    if (!Array.isArray(value))
        throw new Error('草稿列表回傳格式無效。');
    const seen = new Set<string>();
    for (const item of value) {
        if (!record(item))
            throw new Error('草稿資料無效。');
        const row = validateIdentity(item as unknown as ExtractedDocumentDraft, scope);
        if (seen.has(row.draft_id))
            throw new Error('草稿資料重複，請重新讀取。');
        seen.add(row.draft_id);
    }
    return value as ExtractedDocumentDraft[];
}
export async function readDraftReviewRows(client: SupabaseClient, scope: DraftReviewScope): Promise<ExtractedDocumentDraft[]> {
    let query = client.from('extracted_document_drafts')
        .select('*, document:uploaded_documents(original_filename, project:projects(name))')
        .in('status', ['pending_review', 'needs_clarification'])
        .eq('is_latest', true).order('created_at', { ascending: false });
    if (scope.projectId) query = query.eq('project_id', uuid(scope.projectId));
    if (scope.organizationId) query = query.eq('organization_id', uuid(scope.organizationId));
    if (scope.documentId) query = query.eq('uploaded_document_id', uuid(scope.documentId));
    const { data, error } = await query;
    if (error) throw error;
    return validateDraftReviewRows(data, scope);
}
export function buildDraftDecision(draft: ExtractedDocumentDraft, decision: DraftDecision, scope: DraftReviewScope, edits: DraftReviewEdits = {}): ConfirmDraftInput {
    const identity = validateIdentity(draft, scope);
    if (decision !== 'confirmed' && decision !== 'rejected')
        throw new Error('草稿決策無效。');
    if (decision === 'confirmed') {
        if (isSyntheticDraft(draft)) throw new Error('此草稿來源為 Mock／合成測試，不能確認為正式活動。');
        const payload = draft.normalized_payload;
        if (!record(payload) || typeof payload.quantity !== 'number' || !Number.isFinite(payload.quantity) || payload.quantity < 0 || typeof payload.unit !== 'string' || !payload.unit.trim() || typeof payload.activity_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.activity_date) || !Number.isFinite(Date.parse(payload.activity_date)) || new Date(payload.activity_date).toISOString().slice(0, 10) !== payload.activity_date)
            throw new Error('草稿缺少有效數量、單位或活動日期；請先補齊資料，不以預設零值確認。');
    }
    const overrides: NonNullable<ConfirmDraftInput['overrides']> = {};
    if (edits.reviewNote?.trim())
        overrides.review_note = edits.reviewNote.trim();
    if (decision === 'confirmed' && edits.category?.trim())
        overrides.category = edits.category.trim();
    if (decision === 'confirmed' && edits.scope) {
        const value = Number(edits.scope);
        if (![1, 2, 3].includes(value))
            throw new Error('建議範疇必須為 1、2 或 3。');
        overrides.suggested_scope = value;
    }
    return { ...identity, decision, ...(Object.keys(overrides).length ? { overrides } : {}) };
}
type Invoke = (options: EdgeFunctionOptions) => Promise<ApiResponse>;
export async function submitDraftDecision(invoke: Invoke, draft: ExtractedDocumentDraft, decision: DraftDecision, scope: DraftReviewScope, edits: DraftReviewEdits = {}, isCurrent: () => boolean = () => true): Promise<void> {
    if (!isCurrent())
        throw new Error('畫面或工作階段已變更，請重新操作。');
    const payload = buildDraftDecision(draft, decision, scope, edits);
    const response = await invoke({ functionName: 'confirm-draft', payload: { ...payload } });
    if (!isCurrent())
        throw new Error('畫面或工作階段已變更；請在目前範圍重新讀取結果。');
    if (!response.success || response.error)
        throw new Error(response.error?.message || '草稿決策失敗，請重試。');
    const result = response.data;
    if (!record(result) || uuid(result.draft_id) !== payload.draft_id || result.draft_status !== decision ||
        (decision === 'confirmed' && !isWriteUuid(result.emission_activity_id)) ||
        (decision === 'rejected' && result.emission_activity_id != null))
        throw new Error('伺服器未回傳符合本次草稿與決策的保存結果；請重新讀取。');
}
export async function submitDraftBatch(invoke: Invoke, drafts: ExtractedDocumentDraft[], scope: DraftReviewScope, isCurrent: () => boolean) {
    const succeeded: string[] = [], failed: string[] = [];
    for (const draft of drafts) {
        if (!isCurrent())
            throw new Error('批次範圍或工作階段已變更，已停止後續請求；請重新讀取結果。');
        try {
            await submitDraftDecision(invoke, draft, 'confirmed', scope, {}, isCurrent);
            succeeded.push(draft.id);
        }
        catch (error) {
            if (!isCurrent())
                throw error;
            failed.push(draft.id);
        }
    }
    return { succeeded, failed };
}
