import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

if (!process.env.PGLITE_RUNTIME_ROOT) {
  throw new Error('Set PGLITE_RUNTIME_ROOT to an isolated npm prefix containing @electric-sql/pglite.');
}
const require = createRequire(resolve(process.env.PGLITE_RUNTIME_ROOT, 'package.json'));
const { PGlite } = require('@electric-sql/pglite');
const { citext } = require('@electric-sql/pglite/contrib/citext');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const org = n => uuid(100 + n);
const actor = n => uuid(200 + n);
const project = n => uuid(300 + n);

test('project profile RLS and immutable tenant binding in isolated PostgreSQL', async t => {
  const db = new PGlite({ extensions: { citext, pgcrypto } });
  try {
    await db.exec(`
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create role authenticated nologin nosuperuser nobypassrls;
      create role anon nologin nosuperuser nobypassrls;
      create role service_role nologin nosuperuser bypassrls;
    `);
    for (const filename of [
      '202603160001_v1_core_schema.sql',
      '202603180001_v1_staging_hardening_columns.sql',
    ]) await db.exec(await readFile(new URL(`../../supabase/migrations/${filename}`, import.meta.url), 'utf8'));
    // Deliberate test-only grants make denial evidence depend on RLS, not lack of grants.
    await db.exec(`
      grant usage on schema public, auth to authenticated, anon, service_role;
      grant select, update on projects to authenticated, anon, service_role;
    `);
    for (let i = 1; i <= 4; i++) {
      await db.query(`insert into organizations (id, slug, legal_name, display_name)
        values ($1, $2, 'Synthetic legal', 'Synthetic workspace')`, [org(i), `project-test-${i}`]);
      await db.query(`insert into projects (id, organization_id, project_code, name, reporting_start_date, reporting_end_date)
        values ($1, $2, $3, 'Synthetic project', '2026-01-01', '2026-12-31')`, [project(i), org(i), `P${i}`]);
    }
    for (const [organization, user, role, status] of [
      [1, 1, 'owner', 'active'], [1, 2, 'admin', 'active'], [1, 3, 'editor', 'active'],
      [1, 4, 'viewer', 'active'], [1, 5, 'owner', 'inactive'], [2, 6, 'owner', 'active'],
      [3, 1, 'owner', 'active'], [4, 1, 'owner', 'active'],
      [1, 8, 'owner', 'active'], [2, 8, 'owner', 'active'],
    ]) await db.query(`insert into organization_members (organization_id, user_id, role, status)
      values ($1, $2, $3::member_role, $4::member_status)`, [org(organization), actor(user), role, status]);
    for (const [organization, status, expired] of [
      [1, 'active', false], [2, 'active', false], [3, 'readonly', false], [4, 'active', true],
    ]) await db.query(`insert into subscriptions (organization_id, plan_code, status, period_start, period_end)
      values ($1, 'synthetic', $2::subscription_status, now() - interval '30 days',
        case when $3 then now() - interval '1 day' else now() + interval '30 days' end)`, [org(organization), status, expired]);

    async function asRole(role, user, sql, params = []) {
      assert.ok(['authenticated', 'anon', 'service_role'].includes(role));
      await db.exec(`set role ${role}`);
      try {
        await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user === null ? '' : actor(user)]);
        assert.equal((await db.query('select current_user as role')).rows[0].role, role);
        return await db.query(sql, params);
      } finally { await db.exec('reset role'); }
    }
    const updateAs = (user, index, role = 'authenticated') => asRole(role, user,
      'update projects set name = $1 where id = $2 returning id', ['Updated synthetic project', project(index)]);

    await t.test('pre-fix reproduction: dual-tenant owner can reassign project with existing policy', async () => {
      // Reproduce, then restore as maintenance role, before applying the fix.
      const result = await asRole('authenticated', 8,
        'update projects set organization_id = $1 where id = $2 returning organization_id', [org(2), project(1)]);
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0].organization_id, org(2));
      await db.query('update projects set organization_id = $1 where id = $2', [org(1), project(1)]);
    });
    await db.exec(await readFile(new URL('../../supabase/migrations/202610310002_project_identity_guard.sql', import.meta.url), 'utf8'));
    await t.test('non-owner app roles are not superusers and cannot bypass RLS', async () => {
      const roles = (await db.query("select rolsuper, rolbypassrls from pg_roles where rolname in ('authenticated', 'anon')")).rows;
      assert.equal(roles.length, 2);
      for (const role of roles) { assert.equal(role.rolsuper, false); assert.equal(role.rolbypassrls, false); }
    });
    await t.test('owner/admin/editor can update profile fields in original tenant', async () => {
      for (const user of [1, 2, 3]) assert.equal((await updateAs(user, 1)).rows.length, 1);
    });
    await t.test('viewer can read but cannot update', async () => {
      assert.equal((await asRole('authenticated', 4, 'select id from projects where id = $1', [project(1)])).rows.length, 1);
      assert.equal((await updateAs(4, 1)).rows.length, 0);
    });
    await t.test('inactive and cross-tenant members cannot update', async () => {
      assert.equal((await updateAs(5, 1)).rows.length, 0);
      assert.equal((await updateAs(6, 1)).rows.length, 0);
      assert.equal((await updateAs(1, 2)).rows.length, 0);
    });
    await t.test('anonymous and missing auth identity cannot update', async () => {
      assert.equal((await updateAs(null, 1, 'anon')).rows.length, 0);
      assert.equal((await updateAs(null, 1)).rows.length, 0);
    });
    await t.test('readonly and expired subscriptions reject UPDATE through WITH CHECK', async () => {
      for (const index of [3, 4]) {
        await assert.rejects(updateAs(1, index), error => error.code === '42501');
      }
    });
    await t.test('single-tenant and dual-tenant owners cannot reassign tenant binding after fix', async () => {
      for (const user of [1, 8]) await assert.rejects(asRole('authenticated', user,
        'update projects set organization_id = $1 where id = $2', [org(2), project(1)]), error => error.code === '42501');
      assert.equal((await db.query('select organization_id from projects where id = $1', [project(1)])).rows[0].organization_id, org(1));
    });
    await t.test('primary key mutation is denied but unchanged identity is allowed', async () => {
      await assert.rejects(asRole('authenticated', 1,
        'update projects set id = $1 where id = $2', [uuid(999), project(1)]), error => error.code === '42501');
      assert.equal((await asRole('authenticated', 1,
        'update projects set organization_id = $1 where id = $2 returning id', [org(1), project(1)])).rows.length, 1);
    });
    await t.test('spoofed JWT role settings cannot bypass identity guard', async () => {
      await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
      await assert.rejects(asRole('authenticated', 8,
        'update projects set organization_id = $1 where id = $2', [org(2), project(1)]), error => error.code === '42501');
    });
    await t.test('project profile and reporting dates persist and re-read without DTO aliases', async () => {
      assert.equal((await asRole('authenticated', 3, `update projects set
        project_code = 'UPDATED-P1', name = 'Updated profile', description = 'Synthetic evidence',
        reporting_start_date = '2025-04-01', reporting_end_date = '2026-03-31',
        boundary_type = 'financial_control', base_currency = 'JPY'
        where id = $1 returning id`, [project(1)])).rows.length, 1);
      const row = (await asRole('authenticated', 3, 'select * from projects where id = $1', [project(1)])).rows[0];
      assert.equal(row.organization_id, org(1));
      assert.equal(row.project_code, 'UPDATED-P1');
      assert.equal(row.name, 'Updated profile');
      assert.equal(row.description, 'Synthetic evidence');
      assert.equal(row.reporting_start_date.toISOString().slice(0, 10), '2025-04-01');
      assert.equal(row.reporting_end_date.toISOString().slice(0, 10), '2026-03-31');
      assert.equal(row.boundary_type, 'financial_control');
      assert.equal(row.base_currency, 'JPY');
    });
    await t.test('invalid reporting date order is rejected by database constraint', async () => {
      await assert.rejects(asRole('authenticated', 1,
        "update projects set reporting_start_date = '2027-01-01' where id = $1", [project(1)]), error => error.code === '23514');
    });
    await t.test('existing service-role maintenance can still rebind an empty project', async () => {
      const result = await asRole('service_role', null,
        'update projects set organization_id = $1 where id = $2 returning organization_id', [org(2), project(1)]);
      assert.equal(result.rows[0].organization_id, org(2));
    });
  } finally { await db.close(); }
});
