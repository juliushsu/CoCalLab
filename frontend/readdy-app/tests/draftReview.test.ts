import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { ExtractedDocumentDraft } from '../src/types/document.ts';
import { draftReviewScope, draftReviewValues, validateDraftReviewRows, readDraftReviewRows, buildDraftDecision, submitDraftDecision, submitDraftBatch } from '../src/services/draftReview.ts';
// Actual backend contract is imported for compatibility; no server or cloud is contacted.
import { validateConfirmDraftInput } from '../../../backend/src/contracts/contracts.js';
const O = '00000000-0000-4000-8000-000000000001', P = '00000000-0000-4000-8000-000000000002', D = '00000000-0000-4000-8000-000000000003', A = '00000000-0000-4000-8000-000000000004', B = '00000000-0000-4000-8000-000000000005';
const scope = { organizationId: O, projectId: P };
const fixture = (id = D) => ({ id, organization_id: O, project_id: P, uploaded_document_id:A, status: 'pending_review', is_latest: true, normalized_payload: { quantity: 0, unit: 'kWh', activity_date: '2026-11-02' } } as ExtractedDocumentDraft);
const saved = (draft_id = D, draft_status = 'confirmed') => ({ success: true, data: { draft_id, draft_status, emission_activity_id: draft_status === 'confirmed' ? A : null } });
const readClient = (fetch: typeof globalThis.fetch) => createClient('https://synthetic-sdk.invalid', 'test-only-key', {
    accessToken: async () => 'test-user-token', auth: {persistSession: false, autoRefreshToken: false}, global: {fetch},
});

test('installed SDK reads canonical scope, pending/latest drafts and user JWT', async () => {
    const client = readClient(async (url, init) => {
        const query = new URL(String(url));
        assert.match(query.pathname, /\/extracted_document_drafts$/);
        assert.equal(query.searchParams.get('organization_id'), `eq.${O}`);
        assert.equal(query.searchParams.get('project_id'), `eq.${P}`);
        assert.equal(query.searchParams.get('is_latest'), 'eq.true');
        assert.equal(query.searchParams.get('status'), 'in.(pending_review,needs_clarification)');
        assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-user-token');
        return new Response(JSON.stringify([fixture()]), {headers: {'Content-Type': 'application/json'}});
    });
    assert.deepEqual(await readDraftReviewRows(client, scope), [fixture()]);
});

test('SDK draft empty is explicit; null/malformed/foreign success bodies reject', async () => {
    for (const body of [[], null, {}, [{...fixture(), organization_id:B}]]) {
        const client = readClient(async () => new Response(JSON.stringify(body), {headers: {'Content-Type':'application/json'}}));
        if (Array.isArray(body) && body.length === 0) assert.deepEqual(await readDraftReviewRows(client, scope), []);
        else await assert.rejects(readDraftReviewRows(client, scope));
    }
});

test('SDK draft 403/503 and network read failures never become empty success', async () => {
    for (const status of [403, 503]) {
        const client = readClient(async () => new Response(JSON.stringify({message:'synthetic read denied', code:'DENIED'}), {status,headers:{'Content-Type':'application/json'}}));
        await assert.rejects(readDraftReviewRows(client, scope));
    }
    await assert.rejects(readDraftReviewRows(readClient(async () => {throw new Error('synthetic network failure');}), scope));
});
test('manual review accepts agreeing legacy/canonical aliases and rejects conflicts before writing', () => {
    assert.deepEqual(draftReviewScope(`organizationId=${O}&project_id=${P}`), scope);
    assert.deepEqual(draftReviewScope(''), {});
    for (const query of [`organizationId=${O}&organization_id=${B}`, 'organization_id=', 'projectId=bad', `projectId=${P}&projectId=${P}`])
        assert.throws(() => draftReviewScope(query));
});

test('document review link filters the exact document and rejects a different returned document', async () => {
    const selected = draftReviewScope(`organization_id=${O}&project_id=${P}&document=${A}`);
    assert.deepEqual(selected,{...scope,documentId:A});
    assert.throws(()=>draftReviewScope('document='));
    assert.throws(()=>draftReviewScope(`document=${A}&document=${A}`));
    const client=readClient(async (url)=>{
        assert.equal(new URL(String(url)).searchParams.get('uploaded_document_id'),`eq.${A}`);
        return new Response(JSON.stringify([fixture()]),{headers:{'Content-Type':'application/json'}});
    });
    assert.equal((await readDraftReviewRows(client,selected)).length,1);
    assert.throws(()=>buildDraftDecision({...fixture(),uploaded_document_id:B},'confirmed',selected));
});
test('confirm payload satisfies actual backend contract and nests supported overrides', () => {
    const payload = buildDraftDecision(fixture(), 'confirmed', scope, { reviewNote: ' human checked ', category: ' electricity ', scope: '2' });
    assert.deepEqual(payload, { organization_id: O, project_id: P, draft_id: D, decision: 'confirmed', overrides: { review_note: 'human checked', category: 'electricity', suggested_scope: 2 } });
    assert.equal(validateConfirmDraftInput(payload), payload);
    assert.equal('suggested_category' in payload, false);
});
test('display reads the same canonical quantity/unit/date as the backend, not legacy conflicting fields', () => {
    const draft = { ...fixture(), parsed_quantity: 900, parsed_unit: 'kg', suggested_activity_date: '2000-01-01' };
    assert.deepEqual(draftReviewValues(draft), { quantity: '0', unit: 'kWh', activityDate: '2026-11-02' });
    assert.deepEqual(draftReviewValues({ ...draft, normalized_payload: {} }), { quantity: '未提供', unit: '未提供', activityDate: '未提供' });
});
test('rejection uses decision and review_note without confirmation-only overrides', () => {
    const payload = buildDraftDecision(fixture(), 'rejected', scope, { reviewNote: ' unreadable ', category: 'ignored', scope: 'invalid' });
    assert.deepEqual(payload, { organization_id: O, project_id: P, draft_id: D, decision: 'rejected', overrides: { review_note: 'unreadable' } });
    assert.equal(validateConfirmDraftInput(payload), payload);
    assert.equal('status' in payload, false);
});
test('cross-tenant/project, handled and non-latest drafts are never submitted', async () => {
    let calls = 0;
    const invoke = async () => { calls++; return saved(); };
    for (const patch of [{ organization_id: B }, { project_id: B }, { id: 'bad' }, { status: 'confirmed' }, { is_latest: false }]) {
        await assert.rejects(submitDraftDecision(invoke, { ...fixture(), ...patch } as ExtractedDocumentDraft, 'confirmed', scope));
    }
    assert.equal(calls, 0);
});
test('missing/invalid quantity, unit and real calendar date cannot fall back to a zero activity', () => {
    for (const patch of [{ quantity: undefined }, { quantity: '0' }, { quantity: -1 }, { unit: '' }, { activity_date: '2026-02-30' }, { activity_date: 'invalid' }]) {
        const draft = { ...fixture(), normalized_payload: { ...fixture().normalized_payload, ...patch } };
        assert.throws(() => buildDraftDecision(draft, 'confirmed', scope), /預設零值/);
        assert.doesNotThrow(() => buildDraftDecision(draft, 'rejected', scope));
    }
    assert.equal(buildDraftDecision(fixture(), 'confirmed', scope).decision, 'confirmed');
    assert.throws(() => buildDraftDecision(fixture(), 'confirmed', scope, { scope: '2oops' }));
});

test('known mock/synthetic extraction cannot become a formal activity through manual confirmation', async () => {
    let calls=0;
    for (const extraction_provider of ['mock-ocr','MOCK','fixture-loader','synthetic-test']) {
        const draft={...fixture(),extraction_provider};
        await assert.rejects(submitDraftDecision(async()=>{calls++;return saved();},draft,'confirmed',scope),/合成測試/);
        assert.doesNotThrow(()=>buildDraftDecision(draft,'rejected',scope));
    }
    assert.equal(calls,0);
});
test('draft read results retain only valid current rows; malformed/foreign/duplicate rows reject', () => {
    assert.equal(validateDraftReviewRows([fixture()], scope).length, 1);
    assert.deepEqual(validateDraftReviewRows([], scope), []);
    for (const rows of [null, [{ ...fixture(), organization_id: B }], [fixture(), fixture()], [{ ...fixture(), is_latest: false }]]) {
        assert.throws(() => validateDraftReviewRows(rows, scope));
    }
});
test('success requires exact draft and decision plus a saved activity for confirmation', async () => {
    for (const data of [{ draft_id: B, draft_status: 'confirmed', emission_activity_id: A }, { draft_id: D, draft_status: 'rejected', emission_activity_id: null }, { draft_id: D, draft_status: 'confirmed', emission_activity_id: null }, null]) {
        await assert.rejects(submitDraftDecision(async () => ({ success: true, data }), fixture(), 'confirmed', scope));
    }
    await submitDraftDecision(async () => saved(), fixture(), 'confirmed', scope);
    await submitDraftDecision(async () => saved(D, 'rejected'), fixture(), 'rejected', scope);
    await assert.rejects(submitDraftDecision(async () => saved(), fixture(), 'rejected', scope));
});
test('empty, denied, failed and contradictory envelopes never count as saved', async () => {
    for (const response of [{ success: false, error: { code: '42501', message: 'permission denied' } }, { success: false, error: { code: '503', message: 'read failed' } }, { success: true, data: undefined }, { ...saved(), error: { code: 'FAILED', message: 'not saved' } }]) {
        await assert.rejects(submitDraftDecision(async () => response, fixture(), 'confirmed', scope));
    }
});
test('actual installed SDK serializes canonical decision JSON and preserves user JWT', async () => {
    let captured: unknown;
    const client = createClient('https://synthetic-sdk.invalid', 'test-only-key', { accessToken: async () => 'test-user-token', auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
                assert.match(String(url), /functions\/v1\/confirm-draft$/);
                assert.equal(init?.method, 'POST');
                assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-user-token');
                captured = JSON.parse(String(init?.body));
                return new Response(JSON.stringify(saved()), { status: 200, headers: { 'Content-Type': 'application/json' } });
            } } });
    await submitDraftDecision(async (options) => { const { data, error } = await client.functions.invoke(options.functionName, { body: options.payload }); if (error)
        throw error; return data; }, fixture(), 'confirmed', scope, { category: 'electricity' });
    assert.equal(validateConfirmDraftInput(captured).decision, 'confirmed');
});
test('batch retains failed drafts and only removes individually verified persisted results', async () => {
    const result = await submitDraftBatch(async (options) => options.payload?.draft_id === D ? saved() : ({ success: false, error: { code: '409', message: 'not saved' } }), [fixture(), fixture(B)], scope, () => true);
    assert.deepEqual(result, { succeeded: [D], failed: [B] });
});
test('scope/session switch during a delayed save discards its UI result and stops subsequent batch writes', async () => {
    let current = true, calls = 0, release: ((value: ReturnType<typeof saved>) => void) | undefined;
    const pending = submitDraftBatch(async () => { calls++; return new Promise(resolve => { release = resolve; }); }, [fixture(), fixture(B)], scope, () => current);
    await Promise.resolve();
    current = false;
    release!(saved());
    await assert.rejects(pending, /畫面或工作階段/);
    assert.equal(calls, 1);
});
