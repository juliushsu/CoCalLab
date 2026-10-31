# H3 tenant relationship integrity

Baseline: `90f1ead1b9ef39a41c17d6342aadc4c1b8f99c09` on
`codex/saas-h3-redteam-remediation-20261031`. This increment addresses the confirmed
F2/F3 relationship defects; it does not change customer/domain requirements.

## Migration and exact scope

`202610310004_tenant_relationship_integrity.sql` adds three unique parent indexes
and sixteen composite foreign keys, all declared **NOT VALID**. There are no new
policies, grants, privileged helper functions, triggers, data repair statements or
`VALIDATE CONSTRAINT` operations. Existing ID-only foreign keys remain in place.

| Project child table | Nullable project retained | Project deletion |
| --- | --- | --- |
| uploaded_documents | No | CASCADE |
| extracted_document_drafts | No | CASCADE |
| emission_activities | No | CASCADE |
| calculation_results | No | CASCADE |
| report_generations | No | CASCADE |
| ai_audit_results | No | CASCADE |
| emission_activity_classifications | No | CASCADE |
| audit_logs | Yes | SET NULL (project_id) |
| action_logs | Yes | SET NULL (project_id) |
| carbon_adjustment_items | Yes | SET NULL (project_id) |
| adjustment_certificates | Yes | SET NULL (project_id) |
| adjustment_applications | Yes | SET NULL (project_id) |
| adjustment_audit_logs | Yes | SET NULL (project_id) |

Each `(project_id, organization_id)` must match `projects(id, organization_id)`
when both values are non-null. MATCH SIMPLE preserves existing nullable columns,
including the nullable `action_logs.organization_id`; a log without a tenant is
not assigned a tenant implicitly. Organization-wide adjustments retain NULL
project bindings.

The three boundary keys require:

- project `(legal_entity_id, organization_id)` → entity `(id, workspace_id)`;
- project `(site_id, organization_id)` → site `(id, workspace_id)`;
- site `(legal_entity_id, workspace_id)` → entity `(id, workspace_id)`.

Project boundary references remain nullable. The migration does **not** require a
project's selected site to belong to its selected legal entity when both are in
the same workspace. It does not constrain same-tenant cross-project document
reuse or introduce new source-document/item/certificate domain relationships.
Composite foreign keys enforce both directions, so changing a referenced parent
workspace cannot invalidate a valid binding, even for `service_role` maintenance.
There is no service-role bypass of referential integrity.

## Isolated reproduction and verification

Use the existing pinned external PGlite 0.5.13 runtime described in README.md:

```sh
PGLITE_RUNTIME_ROOT=/path/to/isolated/sql-runtime node --test backend/tests/integration/tenant-relationship-integrity.test.js
```

The harness creates a new memory-only database, synthetic auth subjects, tenants,
roles and subscriptions. It loads these unmodified source migrations, then the
remediation:

1. `202603160001_v1_core_schema.sql`
2. `202603180001_v1_staging_hardening_columns.sql`
3. `202603180002_v1_staging_action_logs.sql`
4. `202604070002_v1_analytics_classification_backbone.sql`
5. `202604070003_v1_adjustments_and_report_integration.sql`
6. `202605080001_phase1_boundary_governance_staging.sql`
7. `202610310002_project_identity_guard.sql`
8. `202610310004_tenant_relationship_integrity.sql`

The first pre-fix test proves that permitted direct writes can create project
cross-workspace boundary references and `(organization A, project B)` children.
After applying the remediation, the synthetic legacy mismatches are still present
and all sixteen constraints have `convalidated=false`. The migration has neither
silently repaired nor accepted those existing inconsistencies.

The suite checks its thirteen-table list against the loaded source catalog. For
each table it verifies same-tenant success, rejection of mismatched INSERT and
project/organization key UPDATE by both authenticated and service roles, and all
six optional-project cases. Denials require SQLSTATE `23503` **and the new named
constraint**, rather than passing merely because another privilege/uniqueness
check failed. It also verifies boundary references, parent workspace changes,
nullable fields, permitted same-workspace/different-entity selection, and existing
CASCADE/column-specific SET NULL behavior. Test-only grants ensure app-role tests
exercise RLS/FKs rather than missing table permissions. The authenticated role is
explicitly non-superuser and non-BYPASSRLS. Test-only cleanup restores/deletes
synthetic rows to isolate later assertions; the source migration does not do so.

Executed 2026-10-31 on PostgreSQL 18.6 / PGlite 0.5.13: **20 subtests passed**;
Node reports **21/21** including the parent. No database URL, `.env`, cloud
credential, live customer data or external database connection is used.

## Live preflight and limits

Column-specific `ON DELETE SET NULL (project_id)` / boundary-column forms require
**PostgreSQL 15 or newer**. The live engine version has not been checked; deployment
must confirm compatibility. The local result is on PostgreSQL 18.6, not a live
Supabase verification or a PostgreSQL 15 compatibility run.

Deployment also requires verification of the expected tables/columns, existing
constraints/index names, referenced-key uniqueness and an acceptable lock/build
window. The nonconcurrent parent indexes necessarily read parent keys and acquire
locks; NOT VALID avoids validating old child rows, not all migration locks or
index-building work. The migration is transactional and fails if prerequisites
are absent; it does not silently skip a table.

Existing data needs a separately authorized, restricted preflight for mismatches,
followed by explicit remediation/validation decisions. NOT VALID enforces new
INSERT/key changes but leaves legacy mismatches unvalidated; unrelated non-key
updates to old mismatched rows need not recheck unchanged foreign keys. Do not
claim the whole database is clean. No automatic cleanup or validation is included.

Foreign-key diagnostics may echo the request's supplied identifiers; there is no
custom lookup exposing another tenant's private row. JWT/PostgREST/grants, Storage,
Edge/browser E2E, the full migration chain, concurrent multi-connection behavior,
production migration performance and live rollout remain **NOT_RUN**. Formal
deployment, existing-data inspection and remediation require separate authority.
