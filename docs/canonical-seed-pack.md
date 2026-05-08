# CaCalLab Canonical Seed Pack (Staging)

## Active Canonical Pack
- `scenario_code`: `stg_core_closed_beta`
- `seed_pack_version`: `v2026.04.07.v3` (Phase 1 boundary execution draft)
- `schema_version`: `202605080001`
- `registry`: `seed_pack_registry.is_canonical=true`

Governance source:
- `docs/seed-governance/CANONICAL_SEED_GOVERNANCE.md`
- `docs/seed-governance/SEED_COMPATIBILITY_MATRIX.md`
- `docs/seed-governance/phase1-boundary-validation.sql`

## v3 Storyline (Phase 1 Boundary Execution)
1. One staging workspace represented by the existing `organizations` table.
2. One legal entity under that workspace.
3. Two sites under that legal entity:
   - primary manufacturing plant
   - secondary office/lab for isolation checks
4. Primary showcase project bound to legal entity + primary site.
5. Secondary isolation project bound to legal entity + secondary site.
6. Completed report rows include `legal_entity_snapshot`, `site_snapshot`, and `boundary_snapshot`.

## v2 Storyline (Showcase Grade)
1. One staging organization with active owner membership and active subscription.
2. Two projects:
   - Primary showcase project for cross-page chain
   - Secondary project for isolation checks
3. 14 uploaded documents (Jan-Jun):
   - electricity + diesel monthly evidence
   - attachment-type pending evidence for review queue
4. 14 extracted drafts:
   - 12 confirmed/classified
   - 2 pending/unclassified review items
5. 12 emission activities:
   - 11 included
   - 1 pending factor
6. 12 calculation results:
   - 11 calculated
   - 1 pending_factor
7. Analytics-ready data from same chain:
   - `ghg_scope`
   - `iso_category` (`category_1..category_6` full output shape)
   - monthly trend (Jan-Jun)
   - top 10 hotspot
8. Two report generations:
   - Q1 baseline (`report_version=1`)
   - H1 with adjustment application (`report_version=2`)
9. Three adjustment chains:
   - internal management REC (applied)
   - voluntary offset (approved)
   - IFRS removal (submitted but blocked by verification/approval)

## v1 -> v2 Delta
- Documents: `2 -> 14`
- Drafts: `2 -> 14`
- Activities: `2 -> 12`
- Calculations: `2 -> 12`
- Reports: `1 -> 2`
- Adjustment items/certs/apps: `1/1/1 -> 3/3/3`
- Added trend/hotspot-capable volume and mixed adjustment states for richer UI demonstrations.

## Source of Truth Files
- Governance migration:
  - `supabase/migrations/202604070006_v1_canonical_seed_pack_governance.sql`
- Canonical seed scripts:
  - `supabase/seed/canonical_seed_pack_staging_v20260407.sql` (v1 baseline)
  - `supabase/seed/canonical_seed_pack_staging_v20260407_v2.sql` (v2 showcase baseline)
  - `supabase/seed/canonical_seed_pack_staging_v20260407_v3.sql` (Phase 1 boundary execution)
- Validation checks:
  - `docs/canonical-seed-pack-validation.sql`
  - `docs/seed-governance/phase1-boundary-validation.sql`

## Reseed Flow (Staging)
1. Ensure CLI is linked to staging.
2. Execute v3 reseed:
   - `npx supabase db query --linked -f supabase/seed/canonical_seed_pack_staging_v20260407_v3.sql`
3. Validate:
   - `npx supabase db query --linked -f docs/canonical-seed-pack-validation.sql`
   - `npx supabase db query --linked -f docs/seed-governance/phase1-boundary-validation.sql`

## Versioning Rules
- Every schema expansion that affects UI-visible models must bump `seed_pack_version`.
- Seed scenario must stay cross-page consistent: `documents -> drafts -> activities -> calculations -> analytics -> reports -> adjustments`.
- New modules cannot be marked handoff-ready without matching canonical seed rows plus validation SQL.
