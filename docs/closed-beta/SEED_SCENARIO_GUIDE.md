# Seed Scenario Guide

Status: canonical closed-beta seed guide.

## Canonical Scenario

- Scenario code: `stg_core_closed_beta`
- Seed pack version: `v2026.04.07.v3`
- Purpose: cross-page staging verification for workspace, legal entity, sites, documents, drafts, activities, calculations, analytics, reports, and adjustments.

## Scenario Story

The canonical seed represents one closed-beta workspace with:

- active owner membership,
- active subscription,
- primary showcase project,
- secondary isolation project,
- one legal entity,
- two sites,
- January to June evidence chain,
- confirmed and pending review drafts,
- calculated and pending-factor activities,
- analytics-ready scope/category/month/hotspot data,
- report history with baseline and adjustment report versions,
- report history with Phase 1 boundary snapshots,
- adjustment chains with applied, approved, and blocked states.

## Required Verification Order

1. Reseed staging.
2. Run seed validation SQL.
3. Verify analytics.
4. Verify report history and report preview.
5. Verify adjustment scenario.
6. Log any boundary or immutability gap.

## Canonical Files

- `backend/supabase/seed/canonical_seed_pack_staging_v20260407_v3.sql`
- `docs/canonical-seed-pack-validation.sql`
- `docs/seed-governance/phase1-boundary-validation.sql`
- `docs/seed-governance/SEED_COMPATIBILITY_MATRIX.md`

## Boundary Phase Expectations

Phase 1:

- Testers see organization/workspace compatibility only.

Phase 2:

- Seed gains default legal entity and site rows.

Phase 3:

- Seed projects point to primary legal entity while retaining `organization_id`.

Phase 4:

- Seed includes workspace/entity/site membership positive and negative cases.

Phase 5:

- Seed includes immutable report snapshots and duplicate-source governance examples.

## Failure Handling

If reseed, analytics, or report verification fails:

- keep the migration in staging,
- do not promote to closed beta,
- document the failed query or endpoint,
- either fix forward or roll back to the prior canonical seed version.
