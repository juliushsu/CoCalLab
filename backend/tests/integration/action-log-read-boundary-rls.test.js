import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

if (!process.env.PGLITE_RUNTIME_ROOT) throw new Error('PGLITE_RUNTIME_ROOT is required.');
const require = createRequire(resolve(process.env.PGLITE_RUNTIME_ROOT, 'package.json'));
const { PGlite } = require('@electric-sql/pglite');
const { citext } = require('@electric-sql/pglite/contrib/citext');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const org = n => uuid(100 + n);
const actor = n => uuid(200 + n);
const log = n => uuid(600 + n);
const load = async (db, filename) => db.exec(await readFile(new URL(`../../supabase/migrations/${filename}`, import.meta.url), 'utf8'));
async function bootstrap(db) {
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role authenticated nologin nosuperuser nobypassrls;
    create role anon nologin nosuperuser nobypassrls;
    create role service_role nologin nosuperuser bypassrls;
    grant usage on schema public, auth to authenticated, anon, service_role;
  `);
}

test('action log reads require an active tenant and retain orphan logs for service readers', async t => {
  const db = new PGlite({ extensions: { citext, pgcrypto } });
  try {
    await bootstrap(db);
    await load(db, '202603160001_v1_core_schema.sql');
    await load(db, '202603180002_v1_staging_action_logs.sql');
    // Exact source prefix contains original RLS policy. The remainder defines
    // Storage-dependent purge functions, unrelated to this read-only boundary.
    const followup = await readFile(new URL('../../supabase/migrations/202603180006_v1_staging_hardening_followup.sql', import.meta.url), 'utf8');
    const stop = followup.indexOf('create or replace function purge_staging_data_dry_run()');
    assert.ok(stop > 0);
    const originalReadPolicy = followup.slice(0, stop);
    assert.ok(originalReadPolicy.includes('organization_id is null'));
    await db.exec(originalReadPolicy);
    // SELECT-only fixture grants expose actual RLS behavior. No app mutation
    // grants are introduced here or by the source remediation.
    await db.exec('grant select on action_logs to authenticated, anon, service_role;');
    for (let i = 1; i <= 3; i++) {
      await db.query(`insert into organizations (id, slug, legal_name, display_name)
        values ($1, $2, 'Synthetic legal', 'Synthetic workspace')`, [org(i), `log-test-${i}`]);
    }
    for (const [organization, user, role, status] of [
      [1, 1, 'owner', 'active'], [2, 2, 'owner', 'active'],
      [1, 3, 'viewer', 'active'], [1, 4, 'owner', 'inactive'],
      [1, 5, 'viewer', 'invited'], [3, 6, 'owner', 'active'],
    ]) await db.query(`insert into organization_members (organization_id, user_id, role, status)
      values ($1, $2, $3::member_role, $4::member_status)`, [org(organization), actor(user), role, status]);
    for (let i = 0; i <= 3; i++) {
      await db.query(`insert into action_logs (id, organization_id, action, table_name, record_id, metadata)
        values ($1, $2, 'synthetic', 'synthetic', 'synthetic', $3::jsonb)`,
      [log(i), i === 0 ? null : org(i), JSON.stringify({ marker: `synthetic-${i}` })]);
    }
    async function asRole(role, user, sql, params = []) {
      assert.ok(['authenticated', 'anon', 'service_role'].includes(role));
      await db.exec(`set role ${role}`);
      try {
        await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user === null ? '' : actor(user)]);
        assert.equal((await db.query('select current_user as role')).rows[0].role, role);
        return await db.query(sql, params);
      } finally { await db.exec('reset role'); }
    }
    const rows = (role, user) => asRole(role, user, 'select id, organization_id, metadata from action_logs order by id');
    const privilegeSnapshot = async () => (await db.query(`select rolname,
      has_table_privilege(rolname,'action_logs','SELECT') as read,
      has_table_privilege(rolname,'action_logs','INSERT') as insert,
      has_table_privilege(rolname,'action_logs','UPDATE') as update,
      has_table_privilege(rolname,'action_logs','DELETE') as delete
      from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname`)).rows;
    const grantsBefore = await privilegeSnapshot();
    await t.test('fixture app roles are not owners/superusers/BYPASSRLS roles', async () => {
      const roles = (await db.query("select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('anon','authenticated')")).rows;
      assert.equal(roles.length, 2);
      for (const role of roles) { assert.equal(role.rolsuper, false); assert.equal(role.rolbypassrls, false); }
      const owner = (await db.query("select pg_get_userbyid(relowner) as owner from pg_class where oid='action_logs'::regclass")).rows[0].owner;
      assert.ok(!['anon', 'authenticated'].includes(owner));
    });
    await t.test('pre-fix anonymous and authenticated outsider can read null-tenant log metadata', async () => {
      for (const [role, user] of [['anon', null], ['authenticated', 99]]) {
        const visible = (await rows(role, user)).rows;
        assert.deepEqual(visible.map(row => row.id), [log(0)]);
        assert.equal(visible[0].metadata.marker, 'synthetic-0');
      }
    });
    await load(db, '202610310006_action_logs_read_boundary.sql');
    await t.test('post-fix policy is SELECT-only and targets authenticated role', async () => {
      const policies = (await db.query(`select polcmd, polroles, pg_get_expr(polqual,polrelid) as expression
        from pg_policy where polrelid='action_logs'::regclass`)).rows;
      assert.equal(policies.length, 1);
      assert.equal(policies[0].polcmd, 'r');
      const authOid = (await db.query("select oid from pg_roles where rolname='authenticated'")).rows[0].oid;
      assert.deepEqual(policies[0].polroles, [authOid]);
      assert.match(policies[0].expression, /organization_id IS NOT NULL/);
    });
    await t.test('anonymous and authenticated outsider/inactive/invited members see no rows', async () => {
      for (const [role, user] of [['anon', null], ['authenticated', 99], ['authenticated', 4], ['authenticated', 5]]) {
        assert.deepEqual((await rows(role, user)).rows, []);
      }
      // Actual anon role cannot gain the authenticated policy by supplying a UUID.
      assert.deepEqual((await rows('anon', 1)).rows, []);
    });
    await t.test('active same-tenant owner/viewer reads remain and other-tenant data stays hidden', async () => {
      for (const user of [1, 3]) assert.deepEqual((await rows('authenticated', user)).rows.map(row => row.id), [log(1)]);
      assert.deepEqual((await rows('authenticated', 2)).rows.map(row => row.id), [log(2)]);
    });
    await t.test('revoked membership immediately removes prior log visibility', async () => {
      await db.query("update organization_members set status='inactive' where organization_id=$1 and user_id=$2", [org(1), actor(1)]);
      assert.deepEqual((await rows('authenticated', 1)).rows, []);
      assert.deepEqual((await rows('authenticated', 3)).rows.map(row => row.id), [log(1)]);
    });
    await t.test('organization deletion retains orphan metadata for service readers without public leakage', async () => {
      assert.deepEqual((await rows('authenticated', 6)).rows.map(row => row.id), [log(3)]);
      await db.query('delete from organizations where id=$1', [org(3)]);
      const retained = (await db.query('select organization_id, metadata from action_logs where id=$1', [log(3)])).rows;
      assert.equal(retained.length, 1);
      assert.equal(retained[0].organization_id, null);
      assert.equal(retained[0].metadata.marker, 'synthetic-3');
      const serviceRows = (await rows('service_role', null)).rows;
      assert.equal(serviceRows.length, 4);
      assert.ok(serviceRows.some(row => row.id === log(3) && row.organization_id === null));
      for (const [role, user] of [['anon', null], ['authenticated', 99], ['authenticated', 1], ['authenticated', 2], ['authenticated', 3], ['authenticated', 6]]) {
        assert.ok(!(await rows(role, user)).rows.some(row => row.id === log(3)));
      }
    });
    await t.test('table privileges are unchanged and no client mutation grants appear', async () => {
      assert.deepEqual(await privilegeSnapshot(), grantsBefore);
      for (const row of grantsBefore) {
        assert.equal(row.read, true);
        assert.equal(row.insert, false); assert.equal(row.update, false); assert.equal(row.delete, false);
      }
      for (const role of ['anon', 'authenticated']) {
        for (const sql of [
          "insert into action_logs(action,table_name,record_id) values('denied','denied','denied')",
          "update action_logs set action='denied'",
          'delete from action_logs',
        ]) await assert.rejects(asRole(role, role === 'authenticated' ? 3 : null, sql),
          error => error.code === '42501' && error.message.includes('permission denied for table'));
      }
    });
  } finally { await db.close(); }
});

test('record only: organization deletion with boundary entity/site/project references', async t => {
  // This is a diagnostic of an existing domain deletion question, not a proposed
  // delete-policy change or an assertion that the behavior is commercially accepted.
  for (const hardened of [false, true]) {
    await t.test(hardened ? 'record with tenant-relationship constraints' : 'record original boundary constraints', async () => {
      const db = new PGlite({ extensions: { citext, pgcrypto } });
      try {
        await bootstrap(db);
        for (const filename of [
          '202603160001_v1_core_schema.sql',
          '202603180001_v1_staging_hardening_columns.sql',
          '202603180002_v1_staging_action_logs.sql',
          '202604070002_v1_analytics_classification_backbone.sql',
          '202604070003_v1_adjustments_and_report_integration.sql',
          '202605080001_phase1_boundary_governance_staging.sql',
        ]) await load(db, filename);
        if (hardened) await load(db, '202610310004_tenant_relationship_integrity.sql');
        await db.query(`insert into organizations(id,slug,legal_name,display_name)
          values($1,'synthetic-delete','Synthetic','Synthetic')`, [org(1)]);
        await db.query(`insert into legal_entities(id,workspace_id,entity_code,registered_name,display_name)
          values($1,$2,'SYN','Synthetic','Synthetic')`, [uuid(401), org(1)]);
        await db.query(`insert into sites(id,workspace_id,legal_entity_id,site_code,site_name)
          values($1,$2,$3,'SYN','Synthetic')`, [uuid(501), org(1), uuid(401)]);
        await db.query(`insert into projects(id,organization_id,project_code,name,reporting_start_date,reporting_end_date,legal_entity_id,site_id)
          values($1,$2,'SYN','Synthetic','2026-01-01','2026-12-31',$3,$4)`, [uuid(301), org(1), uuid(401), uuid(501)]);
        let outcome;
        try {
          await db.query('delete from organizations where id=$1', [org(1)]);
          outcome = { hardened, deleted: true, code: null, constraint: null };
        } catch (error) {
          assert.equal(error.code, '23503');
          outcome = { hardened, deleted: false, code: error.code, constraint: error.constraint };
        }
        t.diagnostic(JSON.stringify(outcome));
        for (const table of ['organizations', 'legal_entities', 'sites', 'projects']) {
          assert.equal((await db.query(`select count(*)::int as n from ${table}`)).rows[0].n, outcome.deleted ? 0 : 1);
        }
      } finally { await db.close(); }
    });
  }
});
