import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createIntakeRecovery, type IntakeRecovery } from '../src/services/intakeRecovery.ts';
import { getIntakeAccess, listIntakeProjects, uploadIntake as uploadIntakeCore, reconcileIntake, IntakeError, type IntakeAttempt } from '../src/services/documentIntake.ts';
import { cocal as zh } from '../src/i18n/local/zh/cocal.ts';
import { cocal as en } from '../src/i18n/local/en/cocal.ts';
import { cocal as ja } from '../src/i18n/local/ja/cocal.ts';
const O = '00000000-0000-4000-8000-000000000001', P = '00000000-0000-4000-8000-000000000002', U = '00000000-0000-4000-8000-000000000003', D = '00000000-0000-4000-8000-000000000004', X = '00000000-0000-4000-8000-000000000009';
const scope = { organizationId: O, projectId: P };
function recoveryStorage(memory: Map<string, string>) { return { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); }, key: (index: number) => [...memory.keys()][index] ?? null, get length() { return memory.size; } }; }
const journals = new WeakMap<SupabaseClient, IntakeRecovery>();
const runUpload = (client: SupabaseClient, data: Parameters<typeof uploadIntakeCore>[1], isCurrent = () => true, onStage: Parameters<typeof uploadIntakeCore>[4] = () => { }) => uploadIntakeCore(client, data, journals.get(client)!, isCurrent, onStage);
const file = () => new File(['%PDF-1.7\nSYNTHETIC TEST ONLY\n%%EOF'], '測試 receipt.pdf', { type: 'application/pdf' });
const input = (staging = true, documentType = 'receipt') => ({ file: file(), scope, staging, documentType, expectedUserId: U });
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
type Row = Record<string, unknown>;
interface Options {
    deny?: 'auth' | 'contract' | 'duplicate' | 'storage';
    contract?: unknown;
    mode?: 'reject' | 'lost' | 'lostSaved' | 'malformed';
    duplicate?: Row;
    storageHook?: () => Promise<void>;
    projectBody?: unknown;
    projectCount?: number;
    download?: 'missing' | 'corrupt';
    authId?: string;
}
function sdk(options: Options = {}) {
    const calls: {
        url: URL;
        method: string;
        body?: unknown;
    }[] = [];
    const state: {
        saved?: Row;
        uploaded?: File;
        path?: string;
        bucket?: string;
    } = {};
    const user = { id: U, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
    const key = 'synthetic-intake-test-session';
    const memory = new Map([[key, JSON.stringify({ access_token: 'synthetic-user-token', refresh_token: 'synthetic-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user })]]);
    const client = createClient('https://synthetic-intake.invalid', 'test-only-key', {
        auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: key, storage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); }, removeItem: key => { memory.delete(key); } } },
        global: { fetch: async (url, init) => {
                const parsed = new URL(String(url)), method = init?.method || 'GET';
                calls.push({ url: parsed, method, body: init?.body });
                assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-user-token');
                if (parsed.pathname === '/auth/v1/user')
                    return options.deny === 'auth' ? json({ message: 'synthetic invalid JWT' }, 401) : json({ ...user, id: options.authId || U });
                if (parsed.pathname === '/rest/v1/rpc/upload_intake_contract') {
                    assert.equal(method, 'POST');
                    assert.deepEqual(JSON.parse(String(init?.body)), { p_project_id: P });
                    return options.deny === 'contract' ? json({ code: 'PGRST202', message: 'contract not deployed' }, 404) : json(Object.hasOwn(options, 'contract') ? options.contract : [{ project_id: P, organization_id: O, contract_version: '20261102', can_write: true }]);
                }
                if (parsed.pathname === '/rest/v1/projects')
                    return json(Object.hasOwn(options, 'projectBody') ? options.projectBody : [{ id: P, organization_id: O, name: 'Synthetic project', project_code: 'TEST' }], 200, { 'Content-Range': `0-0/${options.projectCount ?? 1}` });
                if (parsed.pathname.startsWith('/storage/v1/object/')) {
                    if (method === 'GET') {
                        if (options.download === 'missing')
                            return json({ message: 'synthetic missing object' }, 404);
                        const blob = options.download === 'corrupt' ? new Blob(['WRONG CONTENT']) : (state.uploaded || file());
                        return new Response(await blob.arrayBuffer(), { headers: { 'Content-Type': 'application/pdf' } });
                    }
                    assert.equal(method, 'POST');
                    assert.equal(new Headers(init?.headers).get('x-upsert'), 'false');
                    const body = init?.body;
                    assert.ok(body instanceof FormData);
                    state.uploaded = body.get('') as File;
                    const parts = parsed.pathname.slice('/storage/v1/object/'.length).split('/');
                    state.bucket = parts.shift();
                    state.path = parts.join('/');
                    if (options.storageHook)
                        await options.storageHook();
                    return options.deny === 'storage' ? json({ message: 'synthetic permission denied' }, 403) : json({ Id: D, Key: `${state.bucket}/${state.path}` });
                }
                if (parsed.pathname === '/rest/v1/uploaded_documents') {
                    assert.equal(parsed.searchParams.get('organization_id') ?? `eq.${O}`, `eq.${O}`);
                    assert.equal(parsed.searchParams.get('project_id') ?? `eq.${P}`, `eq.${P}`);
                    if (method === 'GET') {
                        if (parsed.searchParams.has('id'))
                            return json(state.saved ? [state.saved] : []);
                        if (options.deny === 'duplicate')
                            return json({ code: '42501', message: 'synthetic duplicate read failed' }, 403);
                        return json(options.duplicate ? [options.duplicate] : []);
                    }
                    assert.equal(method, 'POST');
                    const row = JSON.parse(String(init?.body)) as Row;
                    assert.equal(row.storage_path, state.path);
                    assert.equal(row.storage_bucket, state.bucket);
                    assert.equal(row.uploaded_by_user_id, U);
                    assert.equal(row.ocr_status, 'pending');
                    assert.equal(row.status, 'active');
                    assert.deepEqual(row.metadata, { intake_mode: 'upload_only' });
                    if (options.mode === 'reject')
                        return json({ code: '23505', message: 'synthetic row rejected' }, 409);
                    if (options.mode === 'lost')
                        throw new Error('synthetic network response lost');
                    if (options.mode === 'malformed')
                        return json({ ...row, organization_id: X });
                    state.saved = row;
                    if (options.mode === 'lostSaved')
                        throw new Error('synthetic response lost AFTER commit');
                    return json(row, 201);
                }
                throw new Error('Unexpected request: ' + method + ' ' + parsed.pathname);
            } },
    });
    const journal = createIntakeRecovery(recoveryStorage(memory));
    journals.set(client, journal);
    return { client, state, calls, journal, memory };
}
const writes = (calls: ReturnType<typeof sdk>['calls']) => calls.filter(call => (call.method !== 'GET' && call.url.pathname.startsWith('/storage/')) || (call.url.pathname === '/rest/v1/uploaded_documents' && call.method === 'POST'));
test('installed SDK stores original bytes, a unique non-overwriting object, real SHA256 and verified receipt', async () => {
    const { client, state, calls } = sdk();
    const stages: string[] = [];
    const result = await runUpload(client, input(), () => true, stage => stages.push(stage));
    assert.equal(result.existing, false);
    assert.ok(state.saved);
    assert.ok(state.uploaded);
    assert.deepEqual(new Uint8Array(await state.uploaded.arrayBuffer()), new Uint8Array(await file().arrayBuffer()));
    const hash = Buffer.from(await crypto.subtle.digest('SHA-256', await file().arrayBuffer())).toString('hex');
    assert.equal(state.saved.sha256_hash, hash);
    assert.equal(state.saved.file_size_bytes, file().size);
    assert.equal(state.saved.env, 'staging');
    assert.equal(state.saved.is_test, true);
    assert.equal(state.saved.storage_path, `staging/${P}/${state.saved.id}.pdf`);
    assert.equal(state.saved.original_filename, '測試 receipt.pdf');
    assert.deepEqual(stages, ['checking', 'uploading', 'recording']);
    assert.equal(writes(calls).length, 2);
    assert.deepEqual(journals.get(client)!.list(U, scope), []);
    assert.ok(calls.every(call => !call.url.pathname.includes('/functions/')));
});
test('production and staging attachments use the existing prefix and explicitly write both environment flags', async () => {
    for (const [staging, type, bucket] of [[false, 'receipt', 'documents'], [true, 'invoice', 'staging-attachments']] as const) {
        const { client, state } = sdk();
        await runUpload(client, input(staging, type));
        assert.equal(state.saved!.storage_bucket, bucket);
        assert.equal(state.saved!.env, staging ? 'staging' : 'production');
        assert.equal(state.saved!.is_test, staging);
        assert.equal(state.saved!.storage_path, `${staging ? 'staging/' : ''}${P}/${state.saved!.id}.pdf`);
    }
});
test('missing/old/foreign/malformed contract and denied JWT stop before bytes or receipt writes', async () => {
    const configurations: Options[] = [{ deny: 'auth' }, { authId: X }, { deny: 'contract' }, { contract: [] }, { contract: {} }, { contract: [{ project_id: P, organization_id: X, contract_version: '20261102', can_write: true }] }, { contract: [{ project_id: P, organization_id: O, contract_version: 'old', can_write: true }] }, { contract: [{ project_id: P, organization_id: O, contract_version: '20261102', can_write: false }] }];
    for (const config of configurations) {
        const { client, calls } = sdk(config);
        await assert.rejects(runUpload(client, input()), IntakeError);
        assert.equal(writes(calls).length, 0);
    }
});
test('invalid scope or file type/header/extension/size stops before any writes', async () => {
    for (const bad of [new File([], 'empty.pdf', { type: 'application/pdf' }), new File(['not PDF'], 'fake.pdf', { type: 'application/pdf' }), new File(['%PDF-1.7'], 'wrong.png', { type: 'application/pdf' }), new File(['%PDF-1.7'], 'wrong.pdf', { type: 'text/plain' }), new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'huge.pdf', { type: 'application/pdf' })]) {
        const { client, calls } = sdk();
        await assert.rejects(runUpload(client, { ...input(), file: bad }), IntakeError);
        assert.equal(writes(calls).length, 0);
    }
    const { client, calls } = sdk();
    await assert.rejects(runUpload(client, { ...input(), scope: { ...scope, projectId: '../bad' } }), IntakeError);
    assert.equal(calls.length, 0);
});
test('PNG and JPEG file headers are accepted without trusting an original filename as an object path', async () => {
    for (const image of [new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], '../../unsafe.png', { type: 'image/png' }), new File([new Uint8Array([255, 216, 255, 0])], 'image.jpeg', { type: 'image/jpeg' })]) {
        const { client, state } = sdk();
        await runUpload(client, { ...input(), file: image });
        assert.doesNotMatch(String(state.saved!.storage_path), /\.\./);
        assert.equal(state.saved!.original_filename, image.name);
    }
});
test('duplicate lookup failure never means absent and sends no bytes', async () => {
    const { client, calls } = sdk({ deny: 'duplicate' });
    await assert.rejects(runUpload(client, input()), IntakeError);
    assert.equal(writes(calls).length, 0);
});
test('a verified existing same-content receipt is reused without overwrite, but archived/other-environment records are not', async () => {
    const first = sdk();
    await runUpload(first.client, input());
    const existing = { ...first.state.saved!, id: D, storage_path: `staging/${P}/legacy-file.pdf`, uploaded_by_user_id: X, document_type: 'invoice' };
    const reused = sdk({ duplicate: existing });
    const result = await runUpload(reused.client, input());
    assert.equal(result.existing, true);
    assert.equal(result.attempt.documentId, D);
    assert.equal(writes(reused.calls).length, 0);
    assert.deepEqual(result.record, { uploadedByUserId: X, documentType: 'invoice', ocrStatus: 'pending' });
    assert.ok(reused.calls.some(call => call.method === 'GET' && call.url.pathname.startsWith('/storage/v1/object/')));
    for (const download of ['missing', 'corrupt'] as const) {
        const broken = sdk({ duplicate: existing, download });
        await assert.rejects(runUpload(broken.client, input()), IntakeError);
        assert.equal(writes(broken.calls).length, 0);
    }
    for (const patch of [{ status: 'archived' }, { env: 'production', is_test: false }, { organization_id: X }, { project_id: X }]) {
        const denied = sdk({ duplicate: { ...existing, ...patch } });
        await assert.rejects(runUpload(denied.client, input()), IntakeError);
        assert.equal(writes(denied.calls).length, 0);
    }
});
test('file success followed by rejected/lost/malformed row stays uncertain and retains the exact attempt without deletion', async () => {
    for (const mode of ['reject', 'lost', 'malformed'] as const) {
        const { client, state, calls } = sdk({ mode });
        let attempt: IntakeAttempt | undefined;
        await assert.rejects(runUpload(client, input()), error => { assert.ok(error instanceof IntakeError); assert.equal(error.code, 'uncertain'); attempt = error.attempt; return true; });
        assert.ok(attempt);
        assert.equal(attempt.storagePath, state.path);
        assert.match(attempt.documentId, /^[0-9a-f-]+$/);
        assert.equal(await reconcileIntake(client, attempt), null);
        assert.equal(calls.filter(call => call.method === 'DELETE').length, 0);
        assert.equal(calls.filter(call => call.url.pathname.startsWith('/storage/')).length, 1);
    }
});
test('a lost row response after commit is reconciled by fixed ID without another upload/insert', async () => {
    const { client, state, calls } = sdk({ mode: 'lostSaved' });
    const receipt = await runUpload(client, input());
    assert.equal(receipt.attempt.documentId, state.saved!.id);
    assert.equal(writes(calls).length, 2);
    assert.ok(calls.some(call => call.url.searchParams.get('id') === `eq.${state.saved!.id}`));
});
test('storage denial does not insert a receipt or pretend bytes were never saved', async () => {
    const { client, calls } = sdk({ deny: 'storage' });
    await assert.rejects(runUpload(client, input()), error => error instanceof IntakeError && error.code === 'uncertain' && !!error.attempt);
    assert.equal(calls.filter(call => call.method === 'POST' && call.url.pathname === '/rest/v1/uploaded_documents').length, 0);
});
test('context change before upload blocks writes; change during upload stops receipt insertion', async () => {
    const early = sdk();
    await assert.rejects(runUpload(early.client, input(), () => false), IntakeError);
    assert.equal(writes(early.calls).length, 0);
    let active = true;
    const late = sdk({ storageHook: async () => { active = false; } });
    await assert.rejects(runUpload(late.client, input(), () => active), error => error instanceof IntakeError && error.code === 'context' && !!error.attempt);
    assert.equal(writes(late.calls).length, 1);
    const pending = late.journal.list(U, scope);
    assert.equal(pending.length, 1);
    const reloaded = createIntakeRecovery(recoveryStorage(late.memory));
    assert.deepEqual(reloaded.list(U, scope), pending);
    assert.deepEqual(reloaded.list(X, scope), []);
    assert.deepEqual(reloaded.list(U, { ...scope, projectId: X }), []);
});
test('a new selection of the same uncertain content reconciles its saved attempt and never sends a second object', async () => {
    const broken = sdk({ mode: 'reject' });
    await assert.rejects(runUpload(broken.client, input()), IntakeError);
    const first = broken.journal.list(U, scope)[0];
    await assert.rejects(runUpload(broken.client, input()), error => error instanceof IntakeError && error.code === 'uncertain' && error.attempt?.documentId === first.documentId);
    assert.equal(writes(broken.calls).length, 2);
});
test('unavailable or nonpersisting recovery storage stops before sending any bytes', async () => {
    for (const storage of [{ getItem: () => null, setItem: () => { throw new Error('unavailable'); } }, { getItem: () => null, setItem: () => { } }, { getItem: () => '{corrupt recovery data', setItem: () => { } }]) {
        const instance = sdk();
        journals.set(instance.client, createIntakeRecovery({ ...recoveryStorage(new Map()), ...storage }));
        await assert.rejects(runUpload(instance.client, input()), error => error instanceof IntakeError && error.code === 'recovery');
        assert.equal(writes(instance.calls).length, 0);
    }
});
test('recovery reference is durable before bytes are sent and contains no file bytes or authentication token', async () => {
    let instance: ReturnType<typeof sdk>;
    instance = sdk({ mode: 'reject', storageHook: async () => {
            const rows = instance.journal.list(U, scope);
            assert.equal(rows.length, 1);
            assert.equal(rows[0].storagePath, instance.state.path);
            const key = [...instance.memory.keys()].find(key => key.startsWith('cocal-intake-recovery:'))!;
            assert.ok(key);
            assert.doesNotMatch(instance.memory.get(key)!, /access_token|refresh_token|synthetic-user-token|%PDF-/);
        } });
    await assert.rejects(runUpload(instance.client, input()), IntakeError);
});
test('independent attempt checkpoints survive interleaved tabs saving and clearing without a shared manifest', async () => {
    const sample = sdk({ mode: 'reject' });
    await assert.rejects(runUpload(sample.client, input()), IntakeError);
    const first = sample.journal.list(U, scope)[0], second = { ...first, documentId: X, storagePath: `staging/${P}/${X}.pdf` };
    const memory = new Map<string, string>(), base = recoveryStorage(memory);
    const tabB = createIntakeRecovery(base);
    let interleave = true;
    const tabA = createIntakeRecovery({ ...base, get length() { return base.length; }, setItem(key, value) { if (interleave) {
            interleave = false;
            tabB.save(second);
        } base.setItem(key, value); } });
    tabA.save(first);
    assert.deepEqual(new Set(tabA.list(U, scope).map(row => row.documentId)), new Set([first.documentId, second.documentId]));
    const third = { ...first, documentId: D, storagePath: `staging/${P}/${D}.pdf` };
    const clearing = createIntakeRecovery({ ...base, get length() { return base.length; }, removeItem(key) { tabB.save(third); base.removeItem(key); } });
    clearing.clear(first);
    assert.deepEqual(new Set(tabB.list(U, scope).map(row => row.documentId)), new Set([second.documentId, third.documentId]));
});
test('project selection accepts only exact visible results/count and never substitutes a first organization', async () => {
    const valid = sdk();
    assert.deepEqual(await listIntakeProjects(valid.client, O), [{ id: P, organization_id: O, name: 'Synthetic project', project_code: 'TEST' }]);
    assert.equal(valid.calls[0].url.searchParams.get('organization_id'), `eq.${O}`);
    for (const options of [{ projectBody: null }, { projectBody: {} }, { projectCount: 2 }, { projectBody: [{ id: P, organization_id: X, name: 'Wrong tenant', project_code: 'TEST' }] }]) {
        const broken = sdk(options);
        await assert.rejects(listIntakeProjects(broken.client, O), IntakeError);
    }
    assert.deepEqual(await listIntakeProjects(sdk({ projectBody: [], projectCount: 0 }).client, O), []);
});
test('every intake state/error is translated independently in all three supported locales', () => {
    for (const language of [zh, en, ja]) {
        const copy = language.documents.intake;
        for (const key of ['pending', 'working', 'received', 'existing', 'failed', 'unknown', 'checking', 'uploading', 'recording', 'reconciling'])
            assert.ok(copy.states[key as keyof typeof copy.states]);
        for (const key of ['auth', 'scope', 'read', 'readonly', 'file', 'duplicate', 'upload', 'uncertain', 'context', 'unconfirmed', 'recovery'])
            assert.ok(copy.errors[key as keyof typeof copy.errors]);
        assert.match(copy.summary, /\{\{received\}\}/);
        assert.match(copy.summary, /\{\{total\}\}/);
    }
    assert.notEqual(en.documents.intake.errors.uncertain, zh.documents.intake.errors.uncertain);
});
