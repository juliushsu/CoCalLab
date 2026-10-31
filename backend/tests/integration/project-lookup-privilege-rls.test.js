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
const project = n => uuid(300 + n);
const entity = n => uuid(400 + n);
const site = n => uuid(500 + n);
const helpers = ['get_project_workspace_id', 'get_project_legal_entity_id', 'get_project_site_id'];

test('project lookup ACL blocks UUID disclosure without breaking membership-aware RLS', async t => {
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
      grant usage on schema public, auth to authenticated, anon, service_role;
    `);
    await migration('202603160001_v1_core_schema.sql');
    await migration('202605080001_phase1_boundary_governance_staging.sql');
    // Test-only read grants permit actual RLS evaluation instead of grant errors.
    await db.exec(`grant select on organizations, projects, legal_entities, sites to authenticated, anon, service_role;`);
    for (let i = 1; i <= 2; i++) {
      await db.query(`insert into organizations (id, slug, legal_name, display_name)
        values ($1, $2, 'Synthetic legal', 'Synthetic workspace')`, [org(i), `lookup-test-${i}`]);
      await db.query(`insert into legal_entities (id, workspace_id, entity_code, registered_name, display_name)
        values ($1, $2, $3, 'Synthetic entity', 'Synthetic entity')`, [entity(i), org(i), `LE${i}`]);
      await db.query(`insert into sites (id, workspace_id, legal_entity_id, site_code, site_name)
        values ($1, $2, $3, $4, 'Synthetic site')`, [site(i), org(i), entity(i), `S${i}`]);
      await db.query(`insert into projects (id, organization_id, project_code, name,
        reporting_start_date, reporting_end_date, legal_entity_id, site_id)
        values ($1, $2, $3, 'Synthetic project', '2026-01-01', '2026-12-31', $4, $5)`,
      [project(i), org(i), `P${i}`, entity(i), site(i)]);
    }
    for (const [organization, user, role, status] of [
      [1, 1, 'owner', 'active'], [2, 2, 'owner', 'active'],
      [1, 3, 'owner', 'inactive'], [1, 4, 'viewer', 'active'],
    ]) await db.query(`insert into organization_members (organization_id, user_id, role, status)
      values ($1, $2, $3::member_role, $4::member_status)`, [org(organization), actor(user), role, status]);
    async function asRole(role, user, sql, params = []) {
      assert.ok(['authenticated', 'anon', 'service_role'].includes(role));
      await db.exec(`set role ${role}`);
      try {
        await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user === null ? '' : actor(user)]);
        assert.equal((await db.query('select current_user as role')).rows[0].role, role);
        return await db.query(sql, params);
      } finally { await db.exec('reset role'); }
    }
    await t.test('pre-fix anonymous RLS reads no projects but definer lookup reveals workspace UUID', async () => {
      assert.deepEqual((await asRole('anon', null, 'select id from projects')).rows, []);
      assert.equal((await asRole('anon', null,
        'select get_project_workspace_id($1::uuid) as id', [project(1)])).rows[0].id, org(1));
      for (const name of helpers) {
        const row = (await db.query(`select has_function_privilege('anon',$1,'EXECUTE') as anonymous,
          has_function_privilege('authenticated',$1,'EXECUTE') as authenticated`, [`${name}(uuid)`])).rows[0];
        assert.deepEqual(row, { anonymous: true, authenticated: true });
      }
    });
    await migration('202610310005_project_lookup_acl.sql');
    await t.test('post-fix helper grants are service-only and service calls retain correct bindings', async () => {
      for (const [index, name] of helpers.entries()) {
        const row = (await db.query(`select has_function_privilege('anon',$1,'EXECUTE') as anonymous,
          has_function_privilege('authenticated',$1,'EXECUTE') as authenticated,
          has_function_privilege('service_role',$1,'EXECUTE') as service`, [`${name}(uuid)`])).rows[0];
        assert.deepEqual(row, { anonymous: false, authenticated: false, service: true });
        assert.equal((await asRole('service_role', null, `select ${name}($1::uuid) as id`, [project(1)])).rows[0].id,
          [org(1), entity(1), site(1)][index]);
      }
    });
    for (const name of helpers) {
      for (const role of ['anon', 'authenticated']) await t.test(`${role} cannot call ${name} directly`, async () => {
        await assert.rejects(asRole(role, role === 'authenticated' ? 1 : null,
          `select ${name}($1::uuid)`, [project(1)]),
        error => error.code === '42501' && error.message.includes('permission denied for function'));
      });
    }
    await t.test('membership-aware access functions keep effective client grants and exact role decisions', async () => {
      for (const user of [1, 4]) {
        const row = (await asRole('authenticated', user, `select can_access_project($1::uuid) as project,
          is_workspace_member($2::uuid) as workspace, can_access_legal_entity($3::uuid) as entity,
          can_access_site($4::uuid) as site`, [project(1), org(1), entity(1), site(1)])).rows[0];
        assert.deepEqual(row, { project: true, workspace: true, entity: true, site: true });
      }
      for (const user of [2, 3]) {
        assert.equal((await asRole('authenticated', user,
          'select can_access_project($1::uuid) as allowed', [project(1)])).rows[0].allowed, false);
      }
      assert.equal((await asRole('authenticated', 4,
        "select can_access_project($1::uuid,array['owner','admin','editor']::member_role[]) as allowed", [project(1)])).rows[0].allowed, false);
    });
    await t.test('ordinary project/entity/site/view reads remain tenant-scoped after helper ACL change', async () => {
      for (const user of [1, 4]) {
        assert.deepEqual((await asRole('authenticated', user, 'select id from projects')).rows, [{ id: project(1) }]);
        assert.deepEqual((await asRole('authenticated', user, 'select id from legal_entities')).rows, [{ id: entity(1) }]);
        assert.deepEqual((await asRole('authenticated', user, 'select id from sites')).rows, [{ id: site(1) }]);
        assert.deepEqual((await asRole('authenticated', user, 'select project_id from project_boundary_context_v')).rows, [{ project_id: project(1) }]);
      }
      assert.deepEqual((await asRole('authenticated', 3, 'select id from projects')).rows, []);
      assert.deepEqual((await asRole('anon', null, 'select id from projects')).rows, []);
    });
  } finally { await db.close(); }
});
