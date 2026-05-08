# Seed Compatibility Matrix

Status: canonical seed governance.

`stg_core_closed_beta` is the canonical seed scenario. The table below maps schema versions to seed versions and expected verification coverage.

| Schema version | Seed version | Scenario code | Status | Required verification |
| --- | --- | --- | --- | --- |
| `202603160001` | `v1_seed` | legacy V1 base | legacy | core schema smoke only |
| `202603160008` | `v1_frontend_fixture` | frontend fixture | legacy | frontend contract fixture |
| `202604070006` | `v2026.04.07` | `stg_core_closed_beta` | canonical baseline | seed registry, documents, activities, calculations, reports, adjustments |
| `202604070006` | `v2026.04.07.v2` | `stg_core_closed_beta` | v2 baseline | reseed, validation SQL, analytics verification, report verification |
| `202605080001` | `v2026.04.07.v3` | `stg_core_closed_beta` | active Phase 1 draft | add legal entity/site validation, project bindings, report boundary snapshots |
| Phase 2 boundary schema | `v2026.04.07.v4` | `stg_core_closed_beta` | planned | harden legal entity/site workflows |
| Phase 3 project ownership | `v2026.04.07.v5` | `stg_core_closed_beta` | planned | add project-to-entity validation and report compatibility |
| Phase 4 RLS redesign | `v2026.04.07.v6` | `stg_core_closed_beta` | planned | add workspace/entity/site membership positive and negative checks |
| Phase 5 historical seed migration | `v2026.04.07.v7` | `stg_core_closed_beta` | planned | add immutable report snapshots and duplicate-source proposal checks |

## Compatibility Rules

- A seed pack may support multiple schema versions only when validation SQL branches explicitly by schema capability.
- A schema version may have multiple seed versions, but only one active canonical seed pack per scenario.
- Closed-beta testers must use the active canonical seed pack unless testing a rollback.
- Public-beta data flows must not be based on planned seed rows.

## Required Checks Per Seed Version

Minimum:

- reseed succeeds
- validation SQL succeeds
- analytics verification succeeds
- report verification succeeds

Boundary phases add:

- legal entity count per workspace
- site count per legal entity
- project primary legal entity alignment
- membership inheritance checks
- completed report immutability checks
- duplicate source candidate checks
