import type { IntakeAttempt, IntakeScope } from './documentIntake.ts';
import { canonicalUuid } from './navigationScope.ts';
export interface RecoveryStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    key(index: number): string | null;
    readonly length: number;
}
export interface IntakeRecovery {
    save(attempt: IntakeAttempt): void;
    clear(attempt: IntakeAttempt): void;
    list(userId: string, scope: IntakeScope): IntakeAttempt[];
}
const prefix = 'cocal-intake-recovery:v1:';
function valid(value: unknown, userId: string): value is IntakeAttempt {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const row = value as Record<string, unknown>;
    const project = canonicalUuid(row.projectId), id = canonicalUuid(row.documentId);
    const bucket = row.storageBucket, staging = row.environment === 'staging';
    return canonicalUuid(row.userId) === userId && Boolean(project) && Boolean(id) && Boolean(canonicalUuid(row.organizationId)) &&
        typeof row.storagePath === 'string' && new RegExp(`^${staging ? 'staging/' : ''}${project}/${id}[.](pdf|jpg|jpeg|png)$`).test(row.storagePath) &&
        (staging ? ['staging-receipts', 'staging-attachments'].includes(String(bucket)) : row.environment === 'production' && bucket === 'documents') && row.isTest === staging &&
        typeof row.sha256Hash === 'string' && /^[a-f0-9]{64}$/.test(row.sha256Hash) && typeof row.originalFilename === 'string' &&
        typeof row.mimeType === 'string' && typeof row.documentType === 'string' && typeof row.fileSize === 'number' && Number.isFinite(row.fileSize) && row.fileSize > 0;
}
export function createIntakeRecovery(storage: RecoveryStorage): IntakeRecovery {
    function read(userId: string) {
        const user = canonicalUuid(userId);
        if (!user)
            throw new Error('Invalid recovery identity');
        // Each attempt owns one key. No read/modify/write manifest can overwrite a
        // checkpoint created by another tab, and clear never rewrites other attempts.
        const keys: string[] = [];
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key?.startsWith(prefix + user + ':'))
                keys.push(key);
        }
        const rows: IntakeAttempt[] = [];
        for (const key of keys) {
            const text = storage.getItem(key);
            if (text === null)
                continue; // Concurrently confirmed in another tab.
            const row: unknown = JSON.parse(text);
            if (!valid(row, user) || key !== prefix + user + ':' + row.documentId)
                throw new Error('Invalid recovery records');
            rows.push(row);
        }
        return rows;
    }
    function write(attempt: IntakeAttempt) {
        const key = prefix + attempt.userId + ':' + attempt.documentId, text = JSON.stringify(attempt);
        storage.setItem(key, text);
        if (storage.getItem(key) !== text)
            throw new Error('Recovery checkpoint was not saved');
    }
    return {
        save(attempt) {
            const user = canonicalUuid(attempt.userId);
            if (!user || !valid(attempt, user))
                throw new Error('Invalid recovery attempt');
            if (read(user).length >= 100)
                throw new Error('Reconcile existing recovery records before uploading more');
            write(attempt);
        },
        clear(attempt) { const user = canonicalUuid(attempt.userId), id = canonicalUuid(attempt.documentId); if (!user || !id)
            throw new Error('Invalid recovery identity'); storage.removeItem(prefix + user + ':' + id); },
        list(userId, scope) { return read(userId).filter(row => row.organizationId === canonicalUuid(scope.organizationId) && row.projectId === canonicalUuid(scope.projectId)); },
    };
}
/** No raw file contents or authentication credentials are stored in this journal. */
export function browserIntakeRecovery(): IntakeRecovery { return createIntakeRecovery(window.localStorage); }
