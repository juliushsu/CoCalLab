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
const functions = [
  ['confirm_draft_atomic', 'uuid,uuid,uuid,text,draft_status,text,timestamptz,jsonb,jsonb,uuid,text'],
  ['process_document_atomic', 'uuid,uuid,uuid,jsonb,jsonb,draft_status,numeric,text,text,text'],
  ['recalculate_project_atomic', 'uuid,uuid,uuid,jsonb,text'],
  ['generate_report_atomic', 'uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text'],
  ['run_ai_audit_atomic', 'uuid,uuid,uuid,uuid,text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,numeric,text'],
  ['classify_document_atomic', 'uuid,uuid,uuid,classification_status,text,smallint,numeric,text,text,text,text'],
];
const frontendFunctions = [
  'create_organization_with_owner(citext,text,text,text,char(2),text)',
  'add_organization_member(uuid,member_role,member_status,uuid,citext)',
  'update_organization_member_role(uuid,uuid,member_role)',
  'deactivate_organization_member(uuid,uuid)',
];
const organization = '00000000-0000-0000-0000-000000000101';
const project = '00000000-0000-0000-0000-000000000301';
const forgedActor = '00000000-0000-0000-0000-000000000201';

test('internal atomic RPCs reject direct clients and preserve service/frontend boundaries', async t => {
  const db = new PGlite({ extensions: { citext, pgcrypto } });
  const migration = async filename => db.exec(await readFile(new URL(`../../supabase/migrations/${filename}`, import.meta.url), 'utf8'));
  try {
    await db.exec(`
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create role authenticated nologin nosuperuser nobypassrls;
      create role anon nologin nosuperuser nobypassrls;
      create role service_role nologin nosuperuser bypassrls;
      grant usage on schema auth, public to authenticated, anon, service_role;
    `);
    // Explicit subset: final six atomic function bodies plus legitimate client
    // RPCs. No Storage emulation, fixture seeds, real credentials or cloud URL.
    for (const filename of [
      '202603160001_v1_core_schema.sql',
      '202603160002_v1_hardening_atomic_rpc.sql',
      '202603160003_v1_hardening_document_atomic_rpc.sql',
      '202603160004_v1_hardening_recalculate_atomic_rpc.sql',
      '202603160005_v1_hardening_generate_report_atomic_rpc.sql',
      '202603160006_v1_hardening_run_ai_audit_atomic_rpc.sql',
      '202603160007_v1_hardening_classify_atomic_rpc.sql',
      '202603160009_v1_p0_process_document_atomic_fix.sql',
      '202603160010_v1_p0_classify_atomic_fix.sql',
      '202603160011_v1_p0_confirm_atomic_fix.sql',
      '202603180001_v1_staging_hardening_columns.sql',
      '202603180002_v1_staging_action_logs.sql',
      '202603180008_v1_p1_org_membership_alignment.sql',
      '202603180009_v1_member_management_rpc.sql',
    ]) await migration(filename);
    await db.query(`insert into organizations (id, slug, legal_name, display_name)
      values ($1, 'synthetic-acl', 'Synthetic ACL', 'Synthetic ACL')`, [organization]);
    await db.query(`insert into projects (id, organization_id, project_code, name, reporting_start_date, reporting_end_date)
      values ($1, $2, 'ACL', 'Synthetic ACL', '2026-01-01', '2026-12-31')`, [project, organization]);
    async function asRole(role, sql, params = []) {
      assert.ok(['anon', 'authenticated', 'service_role'].includes(role));
      await db.exec(`set role ${role}`);
      try {
        await db.query("select set_config('request.jwt.claim.sub', $1, false)", [role === 'authenticated' ? forgedActor : '']);
        assert.equal((await db.query('select current_user as role')).rows[0].role, role);
        return await db.query(sql, params);
      } finally { await db.exec('reset role'); }
    }
    const recalculate = role => asRole(role,
      'select * from recalculate_project_atomic($1::uuid,$2::uuid,$3::uuid,$4::jsonb,$5::text)',
      [organization, project, forgedActor, '[]', 'synthetic-acl']);
    await t.test('pre-fix PUBLIC default grants allow anonymous/authenticated access to six definer RPCs', async () => {
      for (const [name, types] of functions) {
        const row = (await db.query(`select prosecdef,
          has_function_privilege('anon',oid,'EXECUTE') as anonymous,
          has_function_privilege('authenticated',oid,'EXECUTE') as authenticated
          from pg_proc where oid=to_regprocedure($1)`, [`${name}(${types})`])).rows[0];
        assert.equal(row.prosecdef, true); assert.equal(row.anonymous, true); assert.equal(row.authenticated, true);
      }
    });
    await t.test('pre-fix anonymous caller without membership/subscription performs privileged write', async () => {
      assert.equal((await db.query('select count(*)::int as n from organization_members')).rows[0].n, 0);
      assert.equal((await db.query('select count(*)::int as n from subscriptions')).rows[0].n, 0);
      assert.equal((await recalculate('anon')).rows.length, 1);
      assert.equal((await db.query("select count(*)::int as n from audit_logs where action='recalculate_project_atomic'")).rows[0].n, 1);
    });
    await migration('202610310003_atomic_rpc_service_role_only.sql');
    await t.test('effective execution privileges exclude client roles and retain service role', async () => {
      for (const [name, types] of functions) {
        const signature = `${name}(${types})`;
        const row = (await db.query(`select
          has_function_privilege('anon',$1,'EXECUTE') as anonymous,
          has_function_privilege('authenticated',$1,'EXECUTE') as authenticated,
          has_function_privilege('service_role',$1,'EXECUTE') as service`, [signature])).rows[0];
        assert.deepEqual(row, { anonymous: false, authenticated: false, service: true });
      }
    });
    for (const [name, types] of functions) {
      for (const role of ['anon', 'authenticated']) {
        await t.test(`${role} direct ${name} call fails at ACL before body execution`, async () => {
          const args = types.split(',').map(type => `null::${type}`).join(',');
          await assert.rejects(asRole(role, `select * from ${name}(${args})`),
            error => error.code === '42501' && error.message.includes('permission denied for function'));
        });
      }
    }
    await t.test('post-fix rejected clients cannot append audit data while service RPC remains usable', async () => {
      for (const role of ['anon', 'authenticated']) await assert.rejects(recalculate(role), error => error.code === '42501');
      assert.equal((await db.query('select count(*)::int as n from audit_logs')).rows[0].n, 1);
      assert.equal((await recalculate('service_role')).rows.length, 1);
      assert.equal((await db.query('select count(*)::int as n from audit_logs')).rows[0].n, 2);
    });
    await t.test('frontend create-org/member execution grants are preserved', async () => {
      for (const signature of frontendFunctions) {
        const row = (await db.query(`select
          has_function_privilege('anon',$1,'EXECUTE') as anonymous,
          has_function_privilege('authenticated',$1,'EXECUTE') as authenticated,
          has_function_privilege('service_role',$1,'EXECUTE') as service`, [signature])).rows[0];
        assert.deepEqual(row, { anonymous: false, authenticated: true, service: true });
      }
    });
  } finally { await db.close(); }
});
