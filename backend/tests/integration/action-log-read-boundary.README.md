# O1 action-log read boundary and bounded O2 deletion diagnostic

Source baseline: `7dccd545` (H5), feature branch
`codex/saas-o1-log-read-boundary-20261031`. All fixtures are synthetic. Tests create
new in-memory PostgreSQL databases and discard them on close. They do not read
`.env`, accept a cloud database URL, run a cloud operation, or change a live policy.

## Run

Use the existing separate pinned runtime; do not add it to application dependencies:

```sh
npm install --prefix /tmp/cocallab-sql-runtime @electric-sql/pglite@0.5.13 --ignore-scripts --no-audit --no-fund
PGLITE_RUNTIME_ROOT=/tmp/cocallab-sql-runtime node --test backend/tests/integration/action-log-read-boundary-rls.test.js
```

Runtime used: PostgreSQL 18.6 / PGlite 0.5.13. No Supabase Storage tables or services
are simulated. This is not a complete migration-chain or deployed Supabase test.

## O1: source evidence and minimal remediation

`202603180002_v1_staging_action_logs.sql` defines
`action_logs.organization_id REFERENCES organizations(id) ON DELETE SET NULL`.
`202603180006_v1_staging_hardening_followup.sql` defines the original SELECT policy
as `organization_id IS NULL OR is_active_org_member(organization_id)`, without a
role restriction. With a table SELECT grant, the NULL branch reveals log metadata
to anonymous callers and authenticated outsiders.

The test applies the **exact initial source prefix** of the original followup,
stopping before `create or replace function purge_staging_data_dry_run()`. That
prefix includes RLS enablement and the original policy. It is not a handwritten
replacement, and the unrelated Storage-dependent purge-function remainder is not
applied. The other source prerequisites are the core schema and action-log table
migration. Test-only SELECT grants make actual RLS behavior observable; no client
INSERT/UPDATE/DELETE grants are added.

`202610310006_action_logs_read_boundary.sql` replaces only that SELECT policy:

- Actual database role must be `authenticated`.
- `organization_id` must be non-NULL and the caller an active organization member.
- No grants, data deletion, log mutation, retention-FK changes, or service-role
  privilege changes are introduced.

Assertions reproduce the original anonymous/outsider metadata read, then verify
non-owner/non-superuser/non-BYPASSRLS app roles; authenticated-role-only policy;
anonymous (even with an active member's synthetic subject), outsider, inactive,
and invited denial; active same-tenant owner/viewer reads; immediate revocation;
and actual organization deletion retaining orphan metadata while hiding it from
all ordinary callers, including the former owner. Existing service-role readers
retain all rows, including unscoped and newly orphaned logs. Table privileges are
compared before/after; direct client INSERT/UPDATE/DELETE calls remain denied.

These assertions concern the source-derived policy with explicit fixture SELECT
grants. Live grants, extra permissive policies, real JWT verification, deployed
API exposure, and production log contents remain unverified.

## O2: record-only deletion result; no domain-policy change

Two additional fresh databases create one same-workspace organization, legal
entity, site, and bound project. One uses the original boundary schema; the other
also applies `202610310004_tenant_relationship_integrity.sql`. The diagnostic
records the DELETE result and verifies either full statement rollback on a real
FK failure or complete removal of the four synthetic rows on success. A test PASS
means the outcome was recorded consistently, not that a business deletion policy
was approved.

The source subsets are explicitly listed in the test: core, staging columns,
action logs, analytics classification backbone, adjustment/report integration,
and boundary governance; then the relationship migration for the hardened case.
There are no fixture/seed/purge execution or invented Storage dependencies.

Observed on 2026-10-31 in PostgreSQL 18.6 / PGlite 0.5.13:

| Synthetic graph | DELETE organization | Remaining org/entity/site/project rows |
| --- | --- | --- |
| Original boundary schema | Succeeded | 0 / 0 / 0 / 0 |
| Boundary + relationship migration 004 | Succeeded | 0 / 0 / 0 / 0 |

The proposed `RESTRICT` rejection was **not reproduced for this clean graph**.
That result does not cover existing inconsistent rows, external references,
concurrent work, a live schema, or all deletion/retention scenarios. No deletion
strategy was changed in this task.
