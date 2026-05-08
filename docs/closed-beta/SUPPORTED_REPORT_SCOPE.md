# Supported Report Scope

Status: closed-beta support matrix.

## Supported Now

- One workspace represented by current `organizations`.
- One or more projects under that workspace.
- Project-level report generation.
- Current `boundary_type` values as compatibility labels.
- Report rendering from `report_generations.payload`.
- Staging canonical reports in `stg_core_closed_beta`.

## Supported With Governance Caveat

- Operational control label on projects.
- Adjustment summaries and manifests from current adjustment flow.
- Analytics by project/workspace.
- Report history and preview for canonical seed data.

## Not Supported Yet

- Multiple legal entities under one workspace as production semantics.
- Multiple sites/facilities under one legal entity as production semantics.
- Entity/site-level RLS.
- Equity-share allocation engine.
- Financial-control consolidation engine.
- Duplicate emission source prevention engine.
- Public-beta report scope selection.

## Report Immutability Rule

Completed reports are historical snapshots. Master data updates must create new report versions instead of mutating existing report payloads.

## Closed-Beta Report Acceptance Criteria

A report is acceptable for closed-beta verification only when:

- report payload exists,
- payload hash exists,
- project/reporting period is visible,
- scope/category totals render,
- adjustment summary is stable where applicable,
- report preview does not recalculate from live master data.
