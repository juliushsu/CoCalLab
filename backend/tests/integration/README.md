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
