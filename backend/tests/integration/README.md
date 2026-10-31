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

## Internal atomic RPC execution boundary

```sh
PGLITE_RUNTIME_ROOT=/tmp/cocallab-sql-runtime node --test backend/tests/integration/atomic-rpc-privilege-rls.test.js
```

The suite applies the final source definitions of six internal `SECURITY DEFINER`
RPCs (`confirm_draft_atomic`, `process_document_atomic`,
`recalculate_project_atomic`, `generate_report_atomic`, `run_ai_audit_atomic`,
`classify_document_atomic`), plus the minimal core/staging/member definitions listed
in the test. It first verifies their pre-fix effective PUBLIC privileges and
reproduces an anonymous, membership-free/subscription-free call that writes an
audit record through the recalculate RPC. No application table grants are given to
that caller: the definer execution itself crosses the intended Edge boundary.

`202610310003_atomic_rpc_service_role_only.sql` then revokes execution from PUBLIC,
`anon`, and `authenticated` for exactly those signatures and grants `service_role`.
The six Edge handlers use service-role clients after JWT/member checks and separate
subscription enforcement. Source locations include `_shared/authz.ts`,
`_shared/supabase-client.ts`, and each named handler's `index.ts`. This ACL change
does not modify those checks, RPC bodies, or legitimate frontend organization/member
RPC grants.

Executed on 2026-10-31, PostgreSQL 18.6 / PGlite 0.5.13: **17 subtests passed**
(Node parent included: 18/18). All twelve anonymous/authenticated direct calls
failed at function ACL with `42501`; effective grants retained service execution;
a real service recalculate call remained usable; authenticated create-org/member
RPC execution grants remained intact. This confirms the source-derived isolated
boundary, not current live grants, PostgREST exposure, or deployed Edge E2E.

A separate source/isolated check confirmed an existing helper followup in
`202605080001_phase1_boundary_governance_staging.sql`: the three `get_project_*`
UUID lookup helpers are definer functions with PUBLIC execution retained. An
anonymous synthetic caller whose normal project SELECT returned no RLS-visible row
could retrieve the workspace UUID through `get_project_workspace_id`. Helpers for
legal entity/site use the same unguarded lookup pattern. The new navigation service
uses ordinary user-JWT/RLS table reads, not these helpers. Helper remediation is
outside the six-RPC ACL migration; live exposure remains unverified.

## Separate project UUID-lookup ACL remediation

```sh
PGLITE_RUNTIME_ROOT=/tmp/cocallab-sql-runtime node --test backend/tests/integration/project-lookup-privilege-rls.test.js
```

`202610310005_project_lookup_acl.sql` addresses the confirmed lookup followup
separately: only `get_project_workspace_id(uuid)`,
`get_project_legal_entity_id(uuid)`, and `get_project_site_id(uuid)` become
service-role-only. Repository call-site inspection found no current frontend
direct consumer and no membership-aware RLS helper that calls these three lookup
functions. The membership-aware `can_access_project`, `is_workspace_member`,
`can_access_legal_entity`, and `can_access_site` functions keep their existing
privileges and bodies.

The test loads the original core schema and boundary-governance migration, first
reproduces the anonymous disclosure, then applies the new ACL. Executed on
2026-10-31 with PostgreSQL 18.6 / PGlite 0.5.13: **10 subtests passed** (Node parent
included: 11/11). All three direct lookup calls reject anonymous/authenticated
roles with function-permission `42501`; maintenance service calls still return the
correct synthetic UUIDs. Positive/negative membership-aware access decisions and
ordinary project/entity/site/security-invoker-view RLS reads remain intact. This
checks source-derived database behavior only; live grants and API exposure were
not queried or changed.
