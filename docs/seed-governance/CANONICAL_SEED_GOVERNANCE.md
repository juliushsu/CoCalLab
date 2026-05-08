# Canonical Seed Governance

Status: closed-beta governance standard.

`stg_core_closed_beta` is the canonical seed pack for staging. It is not just demo data; it is the reproducibility contract for schema, analytics, reports, adjustments, and boundary governance.

## Canonical Pack

- Scenario code: `stg_core_closed_beta`
- Current active seed pack: `v2026.04.07.v2`
- Current schema version: `202604070006`
- Registry source: `seed_pack_registry`
- Active seed SQL: `backend/supabase/seed/canonical_seed_pack_staging_v20260407_v2.sql`
- Validation SQL: `docs/canonical-seed-pack-validation.sql`

## Required Migration Workflow

Every migration must execute:

1. Reseed canonical pack in staging.
2. Run validation SQL.
3. Run analytics verification.
4. Run report verification.

No migration is considered closed-beta ready until all four pass.

## Reseed Requirement

Reseed must:

- Use deterministic ids for canonical scenario rows.
- Purge only staging/test rows.
- Preserve historical production report data.
- Register or update `seed_pack_registry`.
- Record reseed runs in `seed_pack_reseed_runs` when available.

## Validation Requirement

Validation must confirm:

- Workspace/member/subscription chain exists.
- Documents, drafts, activities, calculations, analytics, reports, and adjustments remain connected.
- Report payloads and hashes are present.
- Analytics dimensions return expected scope/category/month/hotspot data.
- Boundary proposal fields are either absent by phase design or present with deterministic seed values.

## Analytics Verification

Analytics verification must cover:

- `ghg_scope`
- `iso_category`
- monthly trend
- hotspot ranking
- project isolation
- workspace isolation

Future multi-entity phases must add:

- legal entity totals
- site totals
- boundary-method totals
- duplicate-source candidate checks

## Report Verification

Report verification must cover:

- report history list loads.
- report preview renders from `report_generations.payload`.
- adjustment manifest is stable.
- completed reports are not rebuilt from live factor/entity/site data.
- new report versions do not mutate old report payloads.

## Versioning Rules

- Any migration that changes UI-visible rows must bump `seed_pack_version`.
- Any migration that changes schema assumptions must update `schema_version`.
- Any change to generated report payload shape must update report verification.
- Any boundary governance phase must update `SEED_COMPATIBILITY_MATRIX.md`.

## Closed-Beta Promotion Rule

A feature or migration may be promoted to closed beta only when:

- canonical seed pack supports it,
- validation SQL covers it,
- analytics verification covers it when relevant,
- report verification covers it when relevant,
- known limitations are documented.
