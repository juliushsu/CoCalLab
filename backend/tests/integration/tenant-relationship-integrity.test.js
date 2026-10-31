import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

if (!process.env.PGLITE_RUNTIME_ROOT) throw new Error('Set PGLITE_RUNTIME_ROOT to the isolated PGlite npm prefix.');
const require = createRequire(resolve(process.env.PGLITE_RUNTIME_ROOT, 'package.json'));
const { PGlite } = require('@electric-sql/pglite');
const { citext } = require('@electric-sql/pglite/contrib/citext');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const orgA = id(1), orgB = id(2), projectA = id(11), projectB = id(12);
const entityA = id(21), entityB = id(22), siteA = id(31), siteB = id(32);
const documentA = id(41), activityA = id(51), itemA = id(61);
const sourceMigrations = [
  '202603160001_v1_core_schema.sql',
  '202603180001_v1_staging_hardening_columns.sql',
  '202603180002_v1_staging_action_logs.sql',
  '202604070002_v1_analytics_classification_backbone.sql',
  '202604070003_v1_adjustments_and_report_integration.sql',
  '202605080001_phase1_boundary_governance_staging.sql',
  '202610310002_project_identity_guard.sql',
];
const remediation = '202610310004_tenant_relationship_integrity.sql';

// Every existing table with organization_id + project_id; optional project stays optional.
const specs = [
  ['uploaded_documents', false, { storage_bucket: 'synthetic', storage_path: 'synthetic', original_filename: 'synthetic.txt', file_size_bytes: 1, sha256_hash: 'new-hash' }],
  ['extracted_document_drafts', false, { uploaded_document_id: documentA, extraction_version: 2, is_latest: false }],
  ['emission_activities', false, { activity_code: 'new-activity', activity_name: 'Synthetic', activity_date: '2026-01-01', category: 'electricity', activity_type: 'electricity', quantity: 1, unit: 'kWh' }],
  ['calculation_results', false, { emission_activity_id: activityA, calc_version: 2, factor_snapshot: {}, input_snapshot: {}, formula_version: 'synthetic', is_latest: false }],
  ['report_generations', false, { report_version: 2, payload: {}, payload_hash: 'synthetic', reporting_period_start: '2026-01-01', reporting_period_end: '2026-12-31' }],
  ['ai_audit_results', false, { input_snapshot: {} }],
  ['emission_activity_classifications', false, { emission_activity_id: activityA, classification_system_code: 'ghg_scope', classification_code: 'scope_1' }],
  ['audit_logs', true, { actor_type: 'user', action: 'synthetic', entity_type: 'synthetic' }],
  ['action_logs', true, { action: 'synthetic', table_name: 'synthetic', record_id: 'synthetic' }],
  ['carbon_adjustment_items', true, { adjustment_type: 'offset_credit', name: 'Synthetic', quantity_total_tco2e: 1, quantity_available_tco2e: 1 }],
  ['adjustment_certificates', true, { carbon_adjustment_item_id: itemA, program: 'Synthetic', certificate_number: 'new-certificate', retired_quantity_tco2e: 1, retired_quantity_available_tco2e: 1 }],
  ['adjustment_applications', true, { adjustment_item_id: itemA, claim_purpose: 'internal_management', requested_quantity_tco2e: 1 }],
  ['adjustment_audit_logs', true, { action: 'synthetic', table_name: 'synthetic' }],
];

test('tenant relationship constraints enforce new keys without repairing legacy rows', async t => {
  const db = new PGlite({ extensions: { citext, pgcrypto } });
  try {
    await db.exec(`create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create role authenticated nologin nosuperuser nobypassrls;
      create role anon nologin nosuperuser nobypassrls;
      create role service_role nologin nosuperuser bypassrls;`);
    for (const filename of sourceMigrations) await db.exec(await readFile(new URL(`../../supabase/migrations/${filename}`, import.meta.url), 'utf8'));
    // Deliberate synthetic grants isolate RLS/FK behavior; migration adds no grants.
    await db.exec('grant usage on schema public,auth to authenticated,anon,service_role; grant select,insert,update,delete on all tables in schema public to authenticated,anon,service_role;');
    async function insert(table, values) {
      assert.match(table, /^[a-z_]+$/);
      const keys = Object.keys(values);
      for (const key of keys) assert.match(key, /^[a-z_][a-z0-9_]*$/);
      return db.query(`insert into ${table} (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(values));
    }
    async function asRole(role, callback) {
      assert.ok(['authenticated', 'service_role'].includes(role));
      await db.exec(`set role ${role}`);
      try {
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id(100)]);
        return await callback();
      } finally { await db.exec('reset role'); }
    }
    const deniesFk = (callback, constraint) => assert.rejects(callback(), error => error.code === '23503' && error.constraint === constraint);
    for (const [org, project, entity, site] of [[orgA, projectA, entityA, siteA], [orgB, projectB, entityB, siteB]]) {
      await insert('organizations', { id: org, slug: `synthetic-${org}`, legal_name: 'Synthetic', display_name: 'Synthetic' });
      await db.query("insert into subscriptions(organization_id,plan_code,status,period_start,period_end) values($1,'synthetic','active',now()-interval '1 day',now()+interval '1 day')", [org]);
      await insert('organization_members', { organization_id: org, user_id: id(100), role: 'owner', status: 'active' });
      await insert('legal_entities', { id: entity, workspace_id: org, entity_code: `LE-${org}`, registered_name: 'Synthetic', display_name: 'Synthetic' });
      await insert('sites', { id: site, workspace_id: org, legal_entity_id: entity, site_code: `SITE-${org}`, site_name: 'Synthetic' });
      await insert('projects', { id: project, organization_id: org, project_code: `PROJECT-${org}`, name: 'Synthetic', reporting_start_date: '2026-01-01', reporting_end_date: '2026-12-31', legal_entity_id: entity, site_id: site });
    }
    await insert('uploaded_documents', { ...specs[0][2], id: documentA, organization_id: orgA, project_id: projectA, sha256_hash: 'seed-hash' });
    await insert('emission_activities', { ...specs[2][2], id: activityA, organization_id: orgA, project_id: projectA, activity_code: 'seed-activity' });
    await insert('carbon_adjustment_items', { ...specs[9][2], id: itemA, organization_id: orgA, project_id: null });
    await t.test('coverage list exactly matches all loaded source tables with both tenant and project columns', async () => {
      const tables = (await db.query("select table_name from information_schema.columns where table_schema='public' and column_name in ('organization_id','project_id') group by table_name having count(*)=2 order by table_name")).rows.map(row => row.table_name);
      assert.deepEqual(tables, specs.map(([table]) => table).sort());
    });
    let legacyActivity;
    await t.test('pre-fix: permitted RLS writes create cross-tenant boundary and child references', async () => {
      await asRole('authenticated', async () => {
        const role = (await db.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0];
        assert.equal(role.rolsuper, false); assert.equal(role.rolbypassrls, false);
        assert.equal((await db.query('update projects set legal_entity_id=$1,site_id=$2 where id=$3 returning id', [entityB, siteB, projectA])).rows.length, 1);
        legacyActivity = (await insert('emission_activities', { ...specs[2][2], activity_code: 'legacy-mismatch', organization_id: orgA, project_id: projectB })).rows[0].id;
      });
    });
    await db.exec(await readFile(new URL(`../../supabase/migrations/${remediation}`, import.meta.url), 'utf8'));
    await t.test('NOT VALID constraints preserve existing mismatches and do not claim validation', async () => {
      const constraints = (await db.query("select conname,convalidated from pg_constraint where conname like '%_tenant_fk' order by conname")).rows;
      assert.equal(constraints.length, 16);
      assert.ok(constraints.every(row => row.convalidated === false));
      assert.equal((await db.query('select project_id from emission_activities where id=$1', [legacyActivity])).rows[0].project_id, projectB);
      assert.equal((await db.query('select legal_entity_id from projects where id=$1', [projectA])).rows[0].legal_entity_id, entityB);
      // Only a disposable fixture is restored for the following positive tests.
      await db.query('update projects set legal_entity_id=$1,site_id=$2 where id=$3', [entityA, siteA, projectA]);
    });
    for (const [table, optionalProject, values] of specs) await t.test(`${table}: same-tenant keys succeed; mixed keys fail for app and service roles${optionalProject ? '; NULL project preserved' : ''}`, async () => {
      const constraint = `${table}_project_tenant_fk`;
      // The source activity trigger creates both classifications automatically.
      // Clear only its synthetic ghg row to isolate INSERT constraint assertions.
      if (table === 'emission_activity_classifications') await db.query("delete from emission_activity_classifications where emission_activity_id=$1 and classification_system_code='ghg_scope'", [activityA]);
      for (const role of ['authenticated', 'service_role']) {
        await deniesFk(() => asRole(role, () => insert(table, { ...values, organization_id: orgA, project_id: projectB })), constraint);
      }
      const row = (await asRole('authenticated', () => insert(table, { ...values, organization_id: orgA, project_id: projectA }))).rows[0];
      for (const role of ['authenticated', 'service_role']) {
        await deniesFk(() => asRole(role, () => db.query(`update ${table} set project_id=$1 where id=$2`, [projectB, row.id])), constraint);
        await deniesFk(() => asRole(role, () => db.query(`update ${table} set organization_id=$1 where id=$2`, [orgB, row.id])), constraint);
      }
      if (optionalProject) {
        const cleared = (await asRole('authenticated', () => db.query(`update ${table} set project_id=null where id=$1 returning organization_id,project_id`, [row.id]))).rows[0];
        assert.equal(cleared.project_id, null); assert.equal(cleared.organization_id, orgA);
        await asRole('authenticated', () => db.query(`update ${table} set project_id=$1 where id=$2`, [projectA, row.id]));
      }
    });
    await t.test('project boundary rejects cross-workspace inserts/updates, including service-role writes', async () => {
      for (const role of ['authenticated', 'service_role']) {
        await deniesFk(() => asRole(role, () => db.query('update projects set legal_entity_id=$1 where id=$2', [entityB, projectA])), 'projects_legal_entity_tenant_fk');
        await deniesFk(() => asRole(role, () => db.query('update projects set site_id=$1 where id=$2', [siteB, projectA])), 'projects_site_tenant_fk');
        await deniesFk(() => asRole(role, () => insert('projects', { organization_id: orgA, project_code: 'BAD', name: 'Synthetic', reporting_start_date: '2026-01-01', reporting_end_date: '2026-12-31', legal_entity_id: entityB })), 'projects_legal_entity_tenant_fk');
        await deniesFk(() => asRole(role, () => insert('projects', { organization_id: orgA, project_code: 'BAD-SITE', name: 'Synthetic', reporting_start_date: '2026-01-01', reporting_end_date: '2026-12-31', site_id: siteB })), 'projects_site_tenant_fk');
      }
      assert.equal((await asRole('authenticated', () => db.query('update projects set legal_entity_id=null,site_id=null where id=$1 returning id', [projectA]))).rows.length, 1);
      await db.query('update projects set legal_entity_id=$1,site_id=$2 where id=$3', [entityA, siteA, projectA]);
    });
    await t.test('site entity must share workspace but need not equal the project selected entity', async () => {
      for (const role of ['authenticated', 'service_role']) {
        await deniesFk(() => asRole(role, () => insert('sites', { workspace_id: orgA, legal_entity_id: entityB, site_code: 'BAD', site_name: 'Synthetic' })), 'sites_legal_entity_tenant_fk');
        await deniesFk(() => asRole(role, () => db.query('update sites set legal_entity_id=$1 where id=$2', [entityB, siteA])), 'sites_legal_entity_tenant_fk');
      }
      await insert('legal_entities', { id: id(23), workspace_id: orgA, entity_code: 'SECOND', registered_name: 'Synthetic', display_name: 'Synthetic' });
      await insert('sites', { id: id(33), workspace_id: orgA, legal_entity_id: id(23), site_code: 'SECOND', site_name: 'Synthetic' });
      assert.equal((await asRole('authenticated', () => db.query('update projects set site_id=$1 where id=$2 returning id', [id(33), projectA]))).rows.length, 1);
      await db.query('update projects set site_id=$1 where id=$2', [siteA, projectA]);
    });
    await t.test('referenced workspace/project-parent changes cannot invalidate valid references even as service role', async () => {
      await assert.rejects(asRole('service_role', () => db.query('update legal_entities set workspace_id=$1 where id=$2', [orgB, entityA])), error => error.code === '23503');
      await assert.rejects(asRole('service_role', () => db.query('update sites set workspace_id=$1,legal_entity_id=$2 where id=$3', [orgB, entityB, siteA])), error => error.code === '23503');
      await assert.rejects(asRole('service_role', () => db.query('update projects set organization_id=$1,legal_entity_id=null,site_id=null where id=$2', [orgB, projectA])), error => error.code === '23503');
    });
    await t.test('project deletion preserves CASCADE and nullable project-only SET NULL semantics', async () => {
      // Remove the synthetic legacy mismatch, not production data, before deletion assertions.
      await db.query('delete from emission_activities where id=$1', [legacyActivity]);
      await asRole('service_role', () => db.query('delete from projects where id=$1', [projectA]));
      for (const [table, optional] of specs) {
        assert.equal((await db.query(`select id from ${table} where project_id=$1`, [projectA])).rows.length, 0);
        if (optional) {
          const rows = (await db.query(`select organization_id,project_id from ${table} where organization_id=$1`, [orgA])).rows;
          assert.ok(rows.length > 0, `${table} should retain a row`);
          assert.ok(rows.every(row => row.project_id === null));
        }
      }
    });
  } finally { await db.close(); }
});
