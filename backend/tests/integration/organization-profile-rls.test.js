import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Explicit external runtime dependency, never a cloud connection or repo .env.
if (!process.env.PGLITE_RUNTIME_ROOT) {
  throw new Error('Set PGLITE_RUNTIME_ROOT to the isolated npm prefix containing @electric-sql/pglite.');
}
const require = createRequire(resolve(process.env.PGLITE_RUNTIME_ROOT, 'package.json'));
const { PGlite } = require('@electric-sql/pglite');
const { citext } = require('@electric-sql/pglite/contrib/citext');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const org = n => uuid(100 + n);
const actor = n => uuid(200 + n);

// In-memory PostgreSQL is discarded on close. Only the listed source migrations
// are applied: this does not claim complete Supabase/migration-chain acceptance.
test('organization profile RLS and field guard in isolated PostgreSQL', async t => {
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
      '202610310001_organization_profile_update.sql',
    ]) {
      await db.exec(await readFile(new URL(`../../supabase/migrations/${filename}`, import.meta.url), 'utf8'));
    }
    // A future column must remain protected without needing to update the guard.
    await db.exec('alter table organizations add column future_sensitive_field text;');
    // Test-only table grants deliberately allow operations so denials come from
    // actual RLS/trigger execution, not missing table privileges.
    await db.exec(`
      grant usage on schema public, auth to authenticated, anon, service_role;
      grant select, insert, update, delete on organizations to authenticated, anon, service_role;
    `);
    for (let i = 1; i <= 7; i++) {
      await db.query(`insert into organizations (id, slug, legal_name, display_name)
        values ($1, $2, 'Synthetic legal name', 'Synthetic workspace')`, [org(i), `synthetic-${i}`]);
    }
    const memberships = [
      [1, 1, 'owner', 'active'], [1, 2, 'admin', 'active'],
      [1, 3, 'editor', 'active'], [1, 4, 'viewer', 'active'],
      [1, 5, 'owner', 'inactive'], [2, 6, 'owner', 'active'],
      [3, 1, 'owner', 'active'], [4, 1, 'owner', 'active'],
      [5, 1, 'owner', 'active'], [6, 1, 'owner', 'active'],
      [7, 1, 'owner', 'inactive'],
    ];
    for (const [organization, user, role, status] of memberships) {
      await db.query(`insert into organization_members (organization_id, user_id, role, status)
        values ($1, $2, $3::member_role, $4::member_status)`, [org(organization), actor(user), role, status]);
    }
    for (const [organization, status, expired] of [
      [1, 'active', false], [2, 'active', false], [3, 'readonly', false],
      [4, 'active', true], [5, 'grace_period', true], [7, 'active', false],
    ]) {
      await db.query(`insert into subscriptions (organization_id, plan_code, status, period_start, period_end, grace_until)
        values ($1, 'synthetic', $2::subscription_status, now() - interval '30 days',
          case when $3 then now() - interval '1 day' else now() + interval '30 days' end,
          case when $2 = 'grace_period' then now() + interval '2 days' else null end)`,
      [org(organization), status, expired]);
    }
    async function asRole(role, user, sql, params = []) {
      assert.ok(['authenticated', 'anon', 'service_role'].includes(role));
      await db.exec(`set role ${role}`);
      try {
        await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user === null ? '' : actor(user)]);
        assert.equal((await db.query('select current_user as role')).rows[0].role, role);
        return await db.query(sql, params);
      } finally {
        await db.exec('reset role');
      }
    }
    async function updateAs(user, organization, role = 'authenticated') {
      const result = await asRole(role, user,
        'update organizations set display_name = $1 where id = $2 returning id', ['Updated synthetic workspace', org(organization)]);
      return result.rows.length;
    }
    await t.test('RLS executes under roles without superuser/bypassrls', async () => {
      const result = await db.query("select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('authenticated', 'anon')");
      assert.equal(result.rows.length, 2);
      for (const role of result.rows) { assert.equal(role.rolsuper, false); assert.equal(role.rolbypassrls, false); }
    });
    await t.test('active owner and admin can update their workspace profile', async () => {
      assert.equal(await updateAs(1, 1), 1);
      assert.equal(await updateAs(2, 1), 1);
    });
    await t.test('editor/viewer remain able to read but cannot update', async () => {
      for (const user of [3, 4]) {
        assert.equal((await asRole('authenticated', user, 'select id from organizations where id = $1', [org(1)])).rows.length, 1);
        assert.equal(await updateAs(user, 1), 0);
      }
    });
    await t.test('inactive membership and cross-tenant owner cannot update', async () => {
      assert.equal(await updateAs(5, 1), 0);
      assert.equal(await updateAs(1, 2), 0);
      assert.equal(await updateAs(1, 7), 0);
    });
    await t.test('anonymous role and missing auth identity cannot update', async () => {
      assert.equal(await updateAs(null, 1, 'anon'), 0);
      assert.equal(await updateAs(null, 1), 0);
      // An anon database role cannot gain the authenticated policy by supplying a user UUID.
      assert.equal(await updateAs(1, 1, 'anon'), 0);
    });
    await t.test('readonly, expired and missing subscriptions deny updates', async () => {
      for (const organization of [3, 4, 6]) assert.equal(await updateAs(1, organization), 0);
    });
    await t.test('unexpired grace period permits profile updates', async () => {
      assert.equal(await updateAs(1, 5), 1);
    });
    await t.test('identity/lifecycle/staging/future fields reject with permission error', async () => {
      for (const [column, value] of [
        ['id', uuid(999)], ['slug', 'forbidden-slug'], ['status', 'suspended'],
        ['env', 'production'], ['is_test', false], ['future_sensitive_field', 'forbidden'],
        ['created_at', '2000-01-01T00:00:00Z'],
      ]) {
        await assert.rejects(asRole('authenticated', 1,
          `update organizations set ${column} = $1 where id = $2 returning id`, [value, org(1)]),
        error => error.code === '42501');
      }
    });
    await t.test('WITH CHECK independently rejects a new tenant identity', async () => {
      // Disable only the field guard in this disposable fixture, to prove the
      // policy itself rejects the new row identity rather than relying on it.
      await db.exec('alter table organizations disable trigger trg_organizations_profile_fields_guard');
      try {
        await assert.rejects(asRole('authenticated', 1,
          'update organizations set id = $1 where id = $2', [uuid(998), org(1)]),
        error => error.code === '42501');
      } finally {
        await db.exec('alter table organizations enable trigger trg_organizations_profile_fields_guard');
      }
    });
    await t.test('caller-controlled JWT role settings cannot bypass field guard', async () => {
      await db.query("select set_config('request.jwt.claim.role', 'service_role', false)");
      await assert.rejects(asRole('authenticated', 1,
        "update organizations set status = 'suspended' where id = $1", [org(1)]), error => error.code === '42501');
    });
    await t.test('all allowed profile fields update and stored values can be re-read', async () => {
      const result = await asRole('authenticated', 1, `update organizations set
        legal_name = 'Updated legal', display_name = 'Updated display', tax_id = '12345678',
        country_code = 'JP', timezone = 'Asia/Tokyo', updated_at = '2000-01-01T00:00:00Z'
        where id = $1 returning *`, [org(1)]);
      assert.equal(result.rows.length, 1);
      const reread = (await asRole('authenticated', 1, 'select * from organizations where id = $1', [org(1)])).rows[0];
      assert.equal(reread.legal_name, 'Updated legal');
      assert.equal(reread.display_name, 'Updated display');
      assert.equal(reread.tax_id, '12345678');
      assert.equal(reread.country_code, 'JP');
      assert.equal(reread.timezone, 'Asia/Tokyo');
      assert.ok(new Date(reread.updated_at).getFullYear() > 2000);
      assert.equal(reread.status, 'active');
      assert.equal(reread.env, 'staging');
    });
    await t.test('new policy does not permit INSERT or DELETE', async () => {
      await assert.rejects(asRole('authenticated', 1,
        "insert into organizations (slug, legal_name, display_name) values ('denied', 'denied', 'denied')"), error => error.code === '42501');
      assert.equal((await asRole('authenticated', 1, 'delete from organizations where id = $1 returning id', [org(1)])).rows.length, 0);
    });
    await t.test('existing service-role maintenance authority is unchanged', async () => {
      const result = await asRole('service_role', null,
        "update organizations set status = 'suspended' where id = $1 returning id", [org(1)]);
      assert.equal(result.rows.length, 1);
    });
  } finally {
    await db.close();
  }
});
