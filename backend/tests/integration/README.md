# Isolated PostgreSQL policy integration tests

These tests instantiate a new **in-memory PGlite PostgreSQL** engine. They never
accept a database URL, load `.env`, use Supabase credentials, or contact a cloud
resource. Synthetic fixtures and the entire database disappear on `close()`.

Install the pinned runtime outside this repository, then run from the repo root:

```sh
npm install --prefix /tmp/cocallab-sql-runtime @electric-sql/pglite@0.5.13 --ignore-scripts --no-audit --no-fund
PGLITE_RUNTIME_ROOT=/tmp/cocallab-sql-runtime node --test backend/tests/integration/organization-profile-rls.test.js
```

The extra integration dependency is intentionally separate from the existing
`backend` unit-test glob, which remains runnable without PGlite.

## Exact scope

The harness loads these unmodified source files:

- `202603160001_v1_core_schema.sql`
- `202603180001_v1_staging_hardening_columns.sql`
- `202610310001_organization_profile_update.sql`

It bootstraps a test-only `auth.uid()` matching a synthetic JWT subject setting,
plus database roles named `authenticated`, `anon`, and `service_role`. Assertions
verify the first two roles are neither superusers nor `BYPASSRLS`. Test-only table
grants deliberately permit operations so tested denials result from RLS or the
field guard rather than missing table privileges. No production grants are added
by the source migration.

Coverage includes owner/admin success, editor/viewer read-only behavior, inactive
membership, cross-tenant access, anonymous/missing identity, readonly/expired/no
subscription, unexpired grace, protected/future columns, spoofed JWT role settings,
independent `WITH CHECK`, profile write/re-read, server-managed timestamp,
INSERT/DELETE denial, and preserved service-role maintenance behavior. The
`WITH CHECK` test temporarily disables the field guard **only in the disposable
fixture** to prove the policy independently rejects tenant identity changes.

This is not full Supabase emulation or acceptance of all migrations, cloud grants,
PostgREST/JWT verification, RLS across every table, Storage, Edge handlers, existing
privileged RPCs, browser E2E, or a production deployment. In particular, the existing
`organization_is_writable` helper still accepts any qualifying active/grace
subscription; ordering/conflicting subscription lifecycle semantics remain outside
this migration's scope.

## Project profile UPDATE and tenant binding

Run separately or run both policy suites:

```sh
PGLITE_RUNTIME_ROOT=/tmp/cocallab-sql-runtime node --test backend/tests/integration/project-profile-rls.test.js
PGLITE_RUNTIME_ROOT=/tmp/cocallab-sql-runtime node --test backend/tests/integration/*-rls.test.js
```

The project suite loads the unmodified core schema and staging-columns migrations,
then **first reproduces** a pre-existing defect: an owner of two writable tenants
can move a project from one tenant to the other using the existing `FOR ALL`
policy. It restores that synthetic row and applies
`202610310002_project_identity_guard.sql`. The incremental invoker trigger blocks
changes to `id` or `organization_id` for actual database roles `authenticated` and
`anon`, including a user who owns both tenants. It does not alter policy, grants,
other profile/lifecycle columns, or service-role maintenance authority.

Post-fix assertions cover owner/admin/editor profile updates, viewer reads without
updates, inactive/cross-tenant/anonymous denial, readonly/expired `WITH CHECK`
failures, both single-tenant and dual-tenant reassignment denial, immutable primary
key, spoofed JWT role settings, actual profile/date write-and-read, invalid date
order constraints, and preserved service-role maintenance. Test-only grants again
ensure denials are not caused merely by absent table privileges.

Executed on 2026-10-31 with PostgreSQL 18.6 / PGlite 0.5.13: **13 project subtests
passed** (Node counts the parent test as well: 14/14). This is an isolated database
result, not browser or deployed Supabase E2E evidence.

## Full migration-chain cold-start diagnostic

```sh
PGLITE_RUNTIME_ROOT=/tmp/cocallab-sql-runtime node backend/tests/integration/migration-chain-diagnostic.js
```

This command creates another entirely new in-memory database and attempts the
sorted migration chain, including repository synthetic fixture migrations. It
prints source SHA-256s, successful files, and the first real error, then exits
nonzero when blocked. It does not skip the blocker, rewrite historical migrations,
or add fake Storage tables to make the chain appear to pass.

Observed on 2026-10-31: the first **15** migrations executed successfully, through
`202603180004_v1_staging_purge_function.sql`. The first blocker was the next file,
`202603180005_v1_staging_storage_isolation.sql`: PostgreSQL code `42P01`, relation
`storage.buckets` does not exist. This is the boundary between bare PostgreSQL and
the Supabase-managed Storage schema; it does **not** establish a source SQL defect
or a live-environment mismatch. Later migrations were not attempted, so no full
migration-chain PASS is claimed. The fixture seeds ran only inside the disposable
synthetic database, not against any existing database or cloud resource.
