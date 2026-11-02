import type { SupabaseClient } from '@supabase/supabase-js';
import { canonicalUuid } from './navigationScope.ts';
import type { IntakeRecovery } from './intakeRecovery.ts';
export interface IntakeScope {
    organizationId: string;
    projectId: string;
}
export interface IntakeProject {
    id: string;
    organization_id: string;
    name: string;
    project_code: string;
}
export interface IntakeAttempt extends IntakeScope {
    documentId: string;
    storageBucket: string;
    storagePath: string;
    sha256Hash: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    documentType: string;
    environment: 'staging' | 'production';
    isTest: boolean;
    userId: string;
}
export interface IntakeReceipt {
    attempt: IntakeAttempt;
    existing: boolean;
    record: {
        uploadedByUserId: string | null;
        documentType: string;
        ocrStatus: string;
    };
}
export type IntakeStage = 'checking' | 'uploading' | 'recording' | 'reconciling';
export class IntakeError extends Error {
    code: 'auth' | 'scope' | 'read' | 'readonly' | 'file' | 'duplicate' | 'upload' | 'uncertain' | 'context' | 'recovery';
    attempt?: IntakeAttempt;
    constructor(code: IntakeError['code'], attempt?: IntakeAttempt, options?: ErrorOptions) {
        super(code, options);
        this.name = 'IntakeError';
        this.code = code;
        this.attempt = attempt;
    }
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const uuid = (value: unknown) => { const id = canonicalUuid(value); if (!id)
    throw new IntakeError('scope'); return id; };
const types = ['receipt', 'invoice', 'bill', 'utility_bill', 'contract', 'report', 'other'];
function current(isCurrent: () => boolean, attempt?: IntakeAttempt) { if (!isCurrent())
    throw new IntakeError('context', attempt); }
function validateScope(scope: IntakeScope): IntakeScope { return { organizationId: uuid(scope.organizationId), projectId: uuid(scope.projectId) }; }
export async function listIntakeProjects(client: SupabaseClient, organizationId?: string): Promise<IntakeProject[]> {
    let query = client.from('projects').select('id,organization_id,name,project_code', { count: 'exact' }).order('name');
    if (organizationId)
        query = query.eq('organization_id', uuid(organizationId));
    const { data, error, count } = await query;
    if (error || !Array.isArray(data) || count !== data.length)
        throw new IntakeError('read', undefined, { cause: error });
    const seen = new Set<string>();
    return data.map(row => {
        if (!record(row) || typeof row.name !== 'string' || typeof row.project_code !== 'string')
            throw new IntakeError('read');
        const id = uuid(row.id), org = uuid(row.organization_id);
        if (seen.has(id) || (organizationId && uuid(organizationId) !== org))
            throw new IntakeError('scope');
        seen.add(id);
        return { id, organization_id: org, name: row.name, project_code: row.project_code };
    });
}
/** UI preflight only. Storage/receipt RLS remains the authority at each write. */
export async function getIntakeAccess(client: SupabaseClient, input: IntakeScope, expectedUserId: string, isCurrent = () => true): Promise<string> {
    const scope = validateScope(input);
    current(isCurrent);
    const { data: identity, error: authError } = await client.auth.getUser();
    current(isCurrent);
    if (authError || !identity.user?.id)
        throw new IntakeError('auth', undefined, { cause: authError });
    const userId = uuid(identity.user.id);
    if (userId !== uuid(expectedUserId))
        throw new IntakeError('auth');
    // The versioned, membership-scoped handshake does not exist on the older broad
    // Storage policy deployment. Never send bytes there just because a UI flag is set.
    const contract = await client.rpc('upload_intake_contract', { p_project_id: scope.projectId });
    current(isCurrent);
    if (contract.error || !Array.isArray(contract.data) || contract.data.length !== 1)
        throw new IntakeError('read', undefined, { cause: contract.error });
    const row = contract.data[0];
    if (!record(row) || uuid(row.project_id) !== scope.projectId || uuid(row.organization_id) !== scope.organizationId)
        throw new IntakeError('scope');
    if (row.contract_version !== '20261102' || typeof row.can_write !== 'boolean')
        throw new IntakeError('read');
    if (!row.can_write)
        throw new IntakeError('readonly');
    return userId;
}
function compatiblePath(bucket: string, path: string, projectId: string): boolean {
    const parts = path.split('/');
    if (parts.some(part => !part || part === '.' || part === '..' || /[\\%]/.test(part)))
        return false;
    return bucket === 'documents' ? parts.length === 2 && canonicalUuid(parts[0]) === projectId :
        ['staging-receipts', 'staging-attachments'].includes(bucket) && parts.length === 3 && parts[0] === 'staging' && canonicalUuid(parts[1]) === projectId;
}
const receiptColumns = 'id,organization_id,project_id,uploaded_by_user_id,storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,sha256_hash,document_type,ocr_status,status,env,is_test';
function receiptRow(row: unknown, expected: IntakeAttempt, existing = false, recovered = false): IntakeReceipt {
    if (!record(row) || uuid(row.organization_id) !== expected.organizationId || uuid(row.project_id) !== expected.projectId ||
        row.sha256_hash !== expected.sha256Hash || row.status !== 'active' || row.env !== expected.environment || row.is_test !== expected.isTest ||
        typeof row.storage_bucket !== 'string' || typeof row.storage_path !== 'string' || !compatiblePath(row.storage_bucket, row.storage_path, expected.projectId) ||
        (expected.isTest ? !['staging-receipts', 'staging-attachments'].includes(row.storage_bucket) : row.storage_bucket !== 'documents') ||
        typeof row.original_filename !== 'string' || typeof row.mime_type !== 'string' || row.file_size_bytes !== expected.fileSize ||
        typeof row.document_type !== 'string' || !types.includes(row.document_type) || !['pending', 'processing', 'succeeded', 'failed'].includes(String(row.ocr_status)) ||
        (!existing && (uuid(row.id) !== expected.documentId || uuid(row.uploaded_by_user_id) !== expected.userId || row.storage_bucket !== expected.storageBucket || row.storage_path !== expected.storagePath || row.mime_type !== expected.mimeType || row.original_filename !== expected.originalFilename || (!recovered && row.ocr_status !== 'pending') || row.document_type !== expected.documentType)))
        throw new IntakeError('uncertain', expected);
    return { existing, attempt: { ...expected, documentId: uuid(row.id), storageBucket: row.storage_bucket, storagePath: row.storage_path, originalFilename: row.original_filename, mimeType: row.mime_type }, record: { uploadedByUserId: row.uploaded_by_user_id === null ? null : uuid(row.uploaded_by_user_id), documentType: row.document_type, ocrStatus: String(row.ocr_status) } };
}
async function verifyOriginal(client: SupabaseClient, receipt: IntakeReceipt, isCurrent: () => boolean) {
    const attempt = receipt.attempt;
    try {
        const original = await client.storage.from(attempt.storageBucket).download(attempt.storagePath);
        current(isCurrent, attempt);
        if (original.error || !original.data || original.data.size !== attempt.fileSize)
            throw new IntakeError('uncertain', attempt, { cause: original.error });
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await original.data.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
        current(isCurrent, attempt);
        if (hash !== attempt.sha256Hash)
            throw new IntakeError('uncertain', attempt);
    }
    catch (cause) {
        if (cause instanceof IntakeError && cause.code === 'context')
            throw cause;
        throw new IntakeError('uncertain', attempt, { cause });
    }
}
async function fileIdentity(file: File) {
    if (!file.name || file.size <= 0 || file.size > 10 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'].includes(file.type))
        throw new IntakeError('file');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = file.type === 'application/pdf' && /\.pdf$/i.test(file.name) && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
    const png = file.type === 'image/png' && /\.png$/i.test(file.name) && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
    const jpg = ['image/jpeg', 'image/jpg'].includes(file.type) && /\.jpe?g$/i.test(file.name) && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!pdf && !png && !jpg)
        throw new IntakeError('file');
    const sha256Hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    return { sha256Hash, extension: pdf ? 'pdf' : png ? 'png' : 'jpg', mimeType: pdf ? 'application/pdf' : png ? 'image/png' : 'image/jpeg' };
}
/** Read back an uncertain attempt without retrying an upload, inserting or deleting. */
export async function reconcileIntake(client: SupabaseClient, attempt: IntakeAttempt, isCurrent = () => true, journal?: IntakeRecovery): Promise<IntakeReceipt | null> {
    current(isCurrent, attempt);
    const { data, error } = await client.from('uploaded_documents').select(receiptColumns).eq('id', uuid(attempt.documentId)).eq('organization_id', uuid(attempt.organizationId)).eq('project_id', uuid(attempt.projectId)).maybeSingle();
    current(isCurrent, attempt);
    if (error)
        throw new IntakeError('uncertain', attempt, { cause: error });
    if (data === null)
        return null;
    const receipt = receiptRow(data, attempt, false, true);
    await verifyOriginal(client, receipt, isCurrent);
    try {
        journal?.clear(attempt);
    }
    catch { /* Verified server receipt remains valid; retain the local reference if cleanup fails. */ }
    return receipt;
}
export async function uploadIntake(client: SupabaseClient, input: {
    file: File;
    scope: IntakeScope;
    documentType: string;
    staging: boolean;
    expectedUserId: string;
}, journal: IntakeRecovery, isCurrent = () => true, onStage: (stage: IntakeStage) => void = () => { }): Promise<IntakeReceipt> {
    onStage('checking');
    const scope = validateScope(input.scope);
    if (!types.includes(input.documentType))
        throw new IntakeError('file');
    const file = await fileIdentity(input.file);
    current(isCurrent);
    const userId = await getIntakeAccess(client, scope, input.expectedUserId, isCurrent);
    current(isCurrent);
    let previous;
    try {
        previous = journal.list(userId, scope).find(row => row.sha256Hash === file.sha256Hash && row.isTest === input.staging);
    }
    catch (cause) {
        throw new IntakeError('recovery', undefined, { cause });
    }
    if (previous) {
        const recovered = await reconcileIntake(client, previous, isCurrent, journal);
        if (recovered)
            return recovered;
        throw new IntakeError('uncertain', previous);
    }
    const documentId = crypto.randomUUID();
    const storageBucket = input.staging ? (input.documentType === 'receipt' ? 'staging-receipts' : 'staging-attachments') : 'documents';
    const storagePath = `${input.staging ? 'staging/' : ''}${scope.projectId}/${documentId}.${file.extension}`;
    const attempt: IntakeAttempt = { ...scope, documentId, storageBucket, storagePath, sha256Hash: file.sha256Hash, originalFilename: input.file.name, mimeType: file.mimeType, fileSize: input.file.size, documentType: input.documentType, environment: input.staging ? 'staging' : 'production', isTest: input.staging, userId };
    const duplicate = await client.from('uploaded_documents').select(receiptColumns).eq('organization_id', scope.organizationId).eq('project_id', scope.projectId).eq('sha256_hash', attempt.sha256Hash).maybeSingle();
    current(isCurrent);
    if (duplicate.error)
        throw new IntakeError('read', undefined, { cause: duplicate.error });
    if (duplicate.data !== null) {
        try {
            const receipt = receiptRow(duplicate.data, attempt, true);
            await verifyOriginal(client, receipt, isCurrent);
            return receipt;
        }
        catch (cause) {
            if (cause instanceof IntakeError && cause.code === 'context')
                throw cause;
            throw new IntakeError('duplicate', undefined, { cause });
        }
    }
    try {
        journal.save(attempt);
    }
    catch (cause) {
        throw new IntakeError('recovery', undefined, { cause });
    }
    onStage('uploading');
    current(isCurrent);
    let uploaded;
    try {
        uploaded = await client.storage.from(storageBucket).upload(storagePath, input.file, { upsert: false, contentType: file.mimeType });
    }
    catch (cause) {
        throw new IntakeError('uncertain', attempt, { cause });
    }
    current(isCurrent, attempt);
    // A transport/storage error may follow a committed object. Never overwrite or blindly clean it up.
    if (uploaded.error || uploaded.data?.path !== storagePath)
        throw new IntakeError('uncertain', attempt, { cause: uploaded.error });
    onStage('recording');
    current(isCurrent, attempt);
    try {
        const saved = await client.from('uploaded_documents').insert({ id: documentId, organization_id: scope.organizationId, project_id: scope.projectId, uploaded_by_user_id: userId, storage_bucket: storageBucket, storage_path: storagePath, original_filename: input.file.name, mime_type: file.mimeType, file_size_bytes: input.file.size, sha256_hash: attempt.sha256Hash, document_type: input.documentType, ocr_status: 'pending', status: 'active', env: attempt.environment, is_test: attempt.isTest, metadata: { intake_mode: 'upload_only' }, received_date: new Date().toISOString().slice(0, 10) }).select(receiptColumns).single();
        current(isCurrent, attempt);
        if (!saved.error) {
            const receipt = receiptRow(saved.data, attempt);
            try {
                journal.clear(attempt);
            }
            catch { /* Retain recovery reference on local cleanup failure. */ }
            return receipt;
        }
        throw saved.error;
    }
    catch (cause) {
        current(isCurrent, attempt);
        onStage('reconciling');
        try {
            const recovered = await reconcileIntake(client, attempt, isCurrent, journal);
            if (recovered)
                return recovered;
        }
        catch (error) {
            if (error instanceof IntakeError && error.code === 'context')
                throw error;
        }
        throw new IntakeError('uncertain', attempt, { cause });
    }
}
