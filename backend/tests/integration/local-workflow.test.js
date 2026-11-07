import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalWorkflow } from '../../tools/local-workflow/engine.js';

// Synthetic, in-memory integration only. The engine uses actual source SQL/RPCs
// and JS services; its Storage catalog/auth subject are explicitly local stubs.
async function persisted(flow) {
  const read = async table => (await flow.db.query(`select * from ${table} order by created_at,id`)).rows;
  return {
    receipts: await read('uploaded_documents'),
    drafts: await read('extracted_document_drafts'),
    activities: await read('emission_activities'),
    calculations: await read('calculation_results'),
    reports: await read('report_generations'),
  };
}
const latest = rows => rows.filter(row => row.is_latest === true);
const injected = point => new Error(`synthetic local workflow fault: ${point}`);
async function faultable() {
  let pending = null;
  const flow = await createLocalWorkflow({ fault: async point => {
    if (point === pending) { pending = null; throw injected(point); }
  } });
  return { flow, failNext(point) { pending = point; } };
}
async function expectFault(operation, point) {
  await assert.rejects(operation, error => error instanceof Error && error.message === injected(point).message);
}
async function ready(flow) { await flow.receive(); await flow.review(); await flow.calculate(); }

test('local full roundtrip persists receipt, explicit manual bridge, 100 kWh -> 50 kg -> 0.05 t report', async () => {
  const flow = await createLocalWorkflow();
  try {
    await ready(flow);
    const snapshot = await flow.snapshot();
    assert.ok(snapshot);
    const rows = await persisted(flow);
    assert.equal(rows.receipts.length, 1);
    assert.equal(rows.receipts[0].ocr_status, 'pending', 'the local manual bridge must not claim OCR succeeded');
    assert.equal(rows.receipts[0].env, 'staging');
    assert.equal(rows.receipts[0].is_test, true);
    assert.equal(rows.drafts.length, 1);
    assert.equal(rows.drafts[0].status, 'confirmed');
    assert.match(rows.drafts[0].extraction_provider, /manual|transcri|bridge/i);
    assert.equal(rows.drafts[0].uploaded_document_id, rows.receipts[0].id);
    assert.equal(rows.activities.length, 1);
    const activity = rows.activities[0];
    assert.equal(activity.source_document_id, rows.receipts[0].id);
    assert.equal(activity.source_draft_id, rows.drafts[0].id);
    assert.equal(Number(activity.quantity), 100);
    assert.equal(activity.unit, 'kWh');
    assert.equal(activity.final_scope, 2);
    assert.equal(activity.inclusion_status, 'included');
    const calculations = latest(rows.calculations);
    assert.equal(calculations.length, 1);
    assert.equal(calculations[0].status, 'calculated');
    assert.equal(Number(calculations[0].co2e_kg), 50);
    assert.equal(calculations[0].emission_activity_id, activity.id);
    assert.equal(rows.reports.length, 1);
    const report = rows.reports[0];
    assert.equal(report.status, 'completed');
    assert.equal(Number(report.scope_totals.scope_2), 50);
    assert.equal(Number(report.payload.scope_totals.scope_2), 50);
    assert.equal(Number(report.payload.scope_totals.scope_2) / 1000, 0.05);
    assert.equal(Number(report.gross_emissions_snapshot.gross_total_co2e_kg), 50);
    assert.equal(Number(report.claim_results.claim_net_co2e_kg), 50);
    assert.equal(report.env, 'staging');
    assert.equal(report.is_test, true);
    assert.equal(report.payload.included_activities_summary.length, 1);
    assert.equal(Number(report.payload.included_activities_summary[0].co2e_kg), 50);
    assert.equal(report.payload.appendix_mappings[0].calculation_result_id, calculations[0].id);
    assert.equal(report.payload.appendix_mappings[0].source_document_id, rows.receipts[0].id);
    assert.ok(report.payload_hash);
    const factors = (await flow.db.query('select * from emission_factors')).rows;
    assert.equal(factors.length, 1);
    assert.match(JSON.stringify(factors[0]), /synthetic/i);
    assert.equal(factors[0].quality_tier, 'custom');
    assert.equal(Number(factors[0].co2e_kg_per_unit), 0.5);
    const scope = rows.receipts[0];
    for (const row of [...rows.drafts, ...rows.activities, ...rows.calculations, ...rows.reports]) {
      assert.equal(row.organization_id, scope.organization_id);
      assert.equal(row.project_id, scope.project_id);
    }
    const inspection = await flow.inspect();
    assert.equal(inspection.metrics.objectWrites, 1);
    assert.ok(inspection.gaps.some(gap => /MISSING.*production.*document.to.draft/i.test(gap)));
    assert.ok(inspection.gaps.some(gap => /NOT_RUN.*Auth.*Storage/i.test(gap)));
    assert.ok(inspection.migrations.some(row => row.file === '202611020002_storage_receipt_review_fixes.sql'));
  } finally { await flow.close(); }
});

test('local report refuses unreviewed or uncalculated work and never stores pending_factor as zero', async () => {
  const flow = await createLocalWorkflow();
  try {
    await assert.rejects(() => flow.snapshot());
    await flow.receive();
    await assert.rejects(() => flow.snapshot());
    await flow.review();
    let rows = await persisted(flow);
    assert.equal(latest(rows.calculations)[0].status, 'pending_factor');
    assert.equal(latest(rows.calculations)[0].co2e_kg, null);
    await assert.rejects(() => flow.snapshot());
    await flow.calculate({ withFactor: false });
    rows = await persisted(flow);
    assert.equal(latest(rows.calculations).length, 1);
    assert.equal(latest(rows.calculations)[0].status, 'pending_factor');
    assert.equal(latest(rows.calculations)[0].co2e_kg, null);
    assert.equal(rows.reports.length, 0);
    await assert.rejects(() => flow.snapshot());
    assert.equal((await persisted(flow)).reports.length, 0);
  } finally { await flow.close(); }
});

test('receipt failure after the object resumes registration with no second object write', async () => {
  const { flow, failNext } = await faultable();
  try {
    failNext('receipt-after-object');
    await expectFault(() => flow.receive(), 'receipt-after-object');
    assert.equal((await persisted(flow)).receipts.length, 0);
    assert.equal((await flow.inspect()).metrics.objectWrites, 1);
    const objectIds = (await flow.db.query('select id,bucket_id,name from storage.objects')).rows;
    assert.equal(objectIds.length, 1);
    await flow.receive();
    assert.equal((await persisted(flow)).receipts.length, 1);
    await flow.receive();
    assert.equal((await persisted(flow)).receipts.length, 1);
    assert.equal((await flow.inspect()).metrics.objectWrites, 1);
    assert.deepEqual((await flow.db.query('select id,bucket_id,name from storage.objects')).rows, objectIds);
  } finally { await flow.close(); }
});

test('an explicitly entered zero is reportable only after a real successful factor calculation', async () => {
  const flow = await createLocalWorkflow();
  try {
    await flow.receive();
    await flow.review({ quantity: 0, unit: 'kWh', activityDate: '2026-01-15', finalScope: 2 });
    assert.equal(latest((await persisted(flow)).calculations)[0].co2e_kg, null);
    await assert.rejects(() => flow.snapshot());
    await flow.calculate();
    await flow.snapshot();
    const rows = await persisted(flow);
    assert.equal(latest(rows.calculations)[0].status, 'calculated');
    assert.equal(Number(latest(rows.calculations)[0].co2e_kg), 0);
    assert.equal(rows.reports.length, 1);
    assert.equal(Number(rows.reports[0].gross_emissions_snapshot.gross_total_co2e_kg), 0);
  } finally { await flow.close(); }
});

test('review RPC transaction failure rolls back confirmation/activity/calculation before a successful retry', async () => {
  const { flow, failNext } = await faultable();
  try {
    await flow.receive();
    failNext('review-after-rpc');
    await expectFault(() => flow.review(), 'review-after-rpc');
    let rows = await persisted(flow);
    assert.equal(rows.activities.length, 0);
    assert.equal(rows.calculations.length, 0);
    assert.ok(rows.drafts.every(row => row.status !== 'confirmed'));
    assert.equal(rows.receipts.length, 1);
    await flow.review();
    rows = await persisted(flow);
    assert.equal(rows.drafts.length, 1);
    assert.equal(rows.drafts[0].status, 'confirmed');
    assert.equal(rows.activities.length, 1);
    assert.equal(rows.calculations.length, 1);
  } finally { await flow.close(); }
});

test('lost review response reconciles committed IDs instead of confirming twice in this one run', async () => {
  const { flow, failNext } = await faultable();
  try {
    await flow.receive();
    failNext('review-response');
    await expectFault(() => flow.review(), 'review-response');
    const committed = await persisted(flow);
    assert.equal(committed.activities.length, 1);
    assert.equal(committed.calculations.length, 1);
    await flow.review();
    await flow.review();
    const recovered = await persisted(flow);
    assert.deepEqual(recovered, committed);
  } finally { await flow.close(); }
});

test('calculation RPC failure restores the prior latest snapshot and rolls back the synthetic factor', async () => {
  const { flow, failNext } = await faultable();
  try {
    await flow.receive();
    await flow.review();
    const before = await persisted(flow);
    assert.equal(latest(before.calculations)[0].status, 'pending_factor');
    failNext('calculate-after-rpc');
    await expectFault(() => flow.calculate(), 'calculate-after-rpc');
    assert.deepEqual(await persisted(flow), before);
    assert.equal((await flow.db.query('select id from emission_factors')).rows.length, 0);
    await flow.calculate();
    const after = await persisted(flow);
    assert.equal(after.calculations.length, 2);
    assert.equal(latest(after.calculations).length, 1);
    assert.equal(latest(after.calculations)[0].status, 'calculated');
    assert.equal(Number(latest(after.calculations)[0].co2e_kg), 50);
    assert.equal(after.calculations.find(row => row.id === before.calculations[0].id).is_latest, false);
  } finally { await flow.close(); }
});

test('explicit invalid manual inputs never fall back to zero quantity, guessed units or invalid dates', async () => {
  const flow = await createLocalWorkflow();
  try {
    await flow.receive();
    for (const patch of [{ quantity: null }, { quantity: NaN }, { quantity: Infinity }, { quantity: -1 }, { quantity: '100' }, { unit: null }, { unit: '' }, { activityDate: '2026-02-30' }, { activityDate: 'invalid' }, { finalScope: null }]) {
      await assert.rejects(() => flow.review({ quantity: 100, unit: 'kWh', activityDate: '2026-01-15', finalScope: 2, ...patch }), error => error.message === 'INVALID_MANUAL_INPUT');
    }
    const rows = await persisted(flow);
    assert.equal(rows.drafts.length, 0);
    assert.equal(rows.activities.length, 0);
    assert.equal(rows.calculations.length, 0);
    assert.equal(rows.reports.length, 0);
    await flow.review();
    assert.equal((await persisted(flow)).activities.length, 1);
  } finally { await flow.close(); }
});

test('real SQL overflow preserves 22003, rolls back review rows, restores postgres and permits a valid retry', async () => {
  const flow = await createLocalWorkflow();
  try {
    await flow.receive();
    let failure;
    // Keep actual schema/views intact. A valid synthetic factor (1e9 kg/kWh)
    // times valid 100kWh overflows calculation_results.numeric(20,10) in the
    // real confirmation INSERT, after activity creation, exercising SQL 22003.
    await flow.db.query("insert into emission_factors(id,organization_id,factor_key,factor_name,source_name,category,subcategory,activity_type,unit,co2e_kg_per_unit,valid_from,version,quality_tier,status,env,is_test,metadata) values($1,$2,'SYNTHETIC-SQL-OVERFLOW','SYNTHETIC OVERFLOW ONLY','LOCAL TEST','energy','purchased_electricity','electricity','kWh',1000000000,'2026-01-01',1,'custom','active','staging',true,'{\"synthetic\":true}')",[flow.scope.factorId,flow.scope.organizationId]);
    try { await flow.review(); }
    catch (error) { failure = error; }
    const rows = await persisted(flow);
    assert.equal(rows.receipts.length, 1);
    assert.equal(rows.drafts.length, 0);
    assert.equal(rows.activities.length, 0);
    assert.equal(rows.calculations.length, 0);
    assert.equal(rows.reports.length, 0);
    assert.equal((await flow.db.query('select current_user as role')).rows[0].role, 'postgres');
    assert.equal(failure?.code, '22003', 'role cleanup must not replace numeric overflow with transaction-aborted 25P02');
    await flow.db.query('delete from emission_factors where id=$1',[flow.scope.factorId]);
    await flow.review();
    assert.equal((await persisted(flow)).activities.length, 1);
  } finally { await flow.close(); }
});

test('recalculation without a factor marks a saved report stale and cannot create another report', async () => {
  const flow = await createLocalWorkflow();
  try {
    await ready(flow);
    await flow.snapshot();
    assert.equal((await flow.inspect()).reportCurrent, true);
    const report = (await persisted(flow)).reports[0];
    await flow.calculate({ withFactor: false });
    assert.equal((await flow.inspect()).reportCurrent, false);
    const rows = await persisted(flow);
    assert.equal(latest(rows.calculations)[0].status, 'pending_factor');
    assert.equal(latest(rows.calculations)[0].co2e_kg, null);
    await assert.rejects(() => flow.snapshot(), error => /REPORT_NOT_READY|SNAPSHOT_STALE/.test(error.message));
    assert.deepEqual((await persisted(flow)).reports, [report]);
  } finally { await flow.close(); }
});

test('two concurrent review calls reconcile the single persisted activity within one serialized local run', async () => {
  const flow = await createLocalWorkflow();
  try {
    await flow.receive();
    await Promise.all([flow.review(), flow.review()]);
    const rows = await persisted(flow);
    assert.equal(rows.drafts.length, 1);
    assert.equal(rows.drafts[0].status, 'confirmed');
    assert.equal(rows.activities.length, 1);
    assert.equal(rows.calculations.length, 1);
    assert.equal(rows.activities[0].source_draft_id, rows.drafts[0].id);
    assert.equal((await flow.inspect()).metrics.objectWrites, 1);
  } finally { await flow.close(); }
});

test('report RPC failure rolls back its saved snapshot; retry and repeated calls reconcile the same saved report', async () => {
  const { flow, failNext } = await faultable();
  try {
    await ready(flow);
    const before = await persisted(flow);
    failNext('report-after-rpc');
    await expectFault(() => flow.snapshot(), 'report-after-rpc');
    assert.deepEqual(await persisted(flow), before);
    await flow.snapshot();
    const saved = await persisted(flow);
    assert.equal(saved.reports.length, 1);
    await flow.snapshot();
    assert.deepEqual(await persisted(flow), saved);
    assert.equal((await flow.inspect()).metrics.objectWrites, 1);
  } finally { await flow.close(); }
});

test('fixed local workflow API rejects external tenant/project/document IDs rather than using them', async () => {
  const flow = await createLocalWorkflow();
  try {
    const foreign = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    for (const [method, allowed] of [['receive', {}], ['review', { quantity: 100, unit: 'kWh', activityDate: '2026-01-15', finalScope: 2 }], ['calculate', { withFactor: true }], ['snapshot', {}]]) {
      for (const key of ['organization_id','project_id','document_id','draft_id','organizationId','projectId','documentId']) {
        await assert.rejects(() => flow[method]({ ...allowed, [key]: foreign }), error => error instanceof Error && /unknown|external|unsupported|not.allowed|reject|forbid|scope|tenant|input|argument|parameter|locked/i.test(error.message));
      }
    }
    const rows = await persisted(flow);
    assert.equal(rows.receipts.length, 0);
    assert.equal(rows.activities.length, 0);
    assert.equal(rows.reports.length, 0);
    assert.equal((await flow.inspect()).metrics.objectWrites, 0);
  } finally { await flow.close(); }
});

test('actual authenticated role cannot directly invoke service-only workflow RPCs', async () => {
  const flow = await createLocalWorkflow();
  try {
    const before = await persisted(flow);
    await flow.db.exec('set role authenticated');
    try {
      const role = (await flow.db.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0];
      assert.deepEqual(role, { rolsuper: false, rolbypassrls: false });
      const signatures = [
        ['confirm_draft_atomic','uuid,uuid,uuid,text,draft_status,text,timestamptz,jsonb,jsonb,uuid,text'],
        ['recalculate_project_atomic','uuid,uuid,uuid,jsonb,text'],
        ['generate_report_atomic','uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text'],
      ];
      for (const [name, types] of signatures) {
        await assert.rejects(() => flow.db.query(`select * from public.${name}(${types.split(',').map(type => `null::${type}`).join(',')})`), error => error.code === '42501' && /permission denied for function/.test(error.message));
      }
    } finally { await flow.db.exec('reset role'); }
    assert.deepEqual(await persisted(flow), before);
  } finally { await flow.close(); }
});
