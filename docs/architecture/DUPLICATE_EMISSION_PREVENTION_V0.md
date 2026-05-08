# Duplicate Emission Prevention V0

Status: schema and governance proposal only. No duplicate-prevention engine is included in this sprint.

Goal: prevent the same emission source from being counted multiple times across legal entities, sites, or report boundaries.

## Problem

The current model stores emissions as project activities under `organization_id`. Once one workspace contains multiple legal entities, the same physical emission source can appear in multiple projects or entities. Without source identity and ownership allocation, CoCalLab cannot determine whether duplicate counting is valid, invalid, or intentionally allocated.

Examples:

- Shared factory utility meter used by two legal entities.
- Joint venture installation reported by equity share.
- One electricity invoice uploaded once by plant operations and again by a legal reporting team.
- A certificate or adjustment item applied to two report boundaries.

## Governance Concepts

### `source_uid`

Stable workspace-level identity for a real-world source.

Source UID should be deterministic where possible:

- utility meter number
- equipment serial number
- installation id
- invoice account id plus site id
- asset fingerprint derived from source metadata

Rule:

- `source_uid` uniqueness is workspace-scoped.
- If a user cannot provide a stable external id, CoCalLab creates a provisional UID and marks confidence.

### `ownership_type`

How a legal entity has the right or obligation to report a source.

Allowed V0 values:

- `operational_control`
- `financial_control`
- `equity_share`
- `leased_asset`
- `shared_service`
- `supplier_allocated`
- `unknown`

### `allocation_ratio`

Ratio of the source's calculated emissions allocated to a legal entity or boundary.

Rules:

- Must be `> 0` and `<= 1`.
- For exclusive operational or financial control, total active allocation for the same period should equal `1`.
- For equity share, total allocation may be less than, equal to, or greater than `1` only when justified by relationship metadata and flagged for review.

### Trace Metadata

Trace metadata explains source identity and allocation evidence.

Fields:

- `source_evidence_type`
- `source_document_id`
- `source_draft_id`
- `meter_number`
- `invoice_account`
- `equipment_serial_number`
- `allocation_basis`
- `allocation_formula`
- `reviewed_by_user_id`
- `reviewed_at`
- `confidence_score`

### `why_not_selected`

Human-readable exclusion reason for sources not included in a report boundary.

Examples:

- `outside_reporting_period`
- `not_under_operational_control`
- `allocated_to_other_legal_entity`
- `duplicate_source_uid_in_boundary`
- `missing_ownership_evidence`
- `superseded_by_canonical_source`

## Proposed Tables

This proposal complements `SCHEMA_PROPOSAL_V0.md`.

### `emission_sources`

Tracks real-world sources with workspace-scoped identity.

Key fields:

- `workspace_id`
- `site_id`
- `source_uid`
- `source_type`
- `source_name`
- `asset_fingerprint`
- `status`
- `metadata`

### `emission_source_ownerships`

Tracks legal entity ownership/control/allocation over time.

Key fields:

- `workspace_id`
- `emission_source_id`
- `legal_entity_id`
- `site_id`
- `ownership_type`
- `allocation_ratio`
- `effective_from`
- `effective_to`
- `trace_metadata`
- `status`

### `report_boundary_source_selections`

Optional future table for selected source-by-boundary rows.

Key fields:

- `report_boundary_id`
- `emission_source_id`
- `ownership_id`
- `selected`
- `allocation_ratio_snapshot`
- `why_selected`
- `why_not_selected`
- `trace_metadata`

## V0 Duplicate Checks

Before report generation, staging validation should identify:

```sql
select
  eso.workspace_id,
  eso.emission_source_id,
  eso.effective_from,
  eso.effective_to,
  sum(eso.allocation_ratio) as total_allocation_ratio
from emission_source_ownerships eso
where eso.status = 'active'
group by eso.workspace_id, eso.emission_source_id, eso.effective_from, eso.effective_to
having sum(eso.allocation_ratio) > 1.000001;
```

Boundary-level duplicate candidate:

```sql
select
  rb.id as report_boundary_id,
  es.source_uid,
  count(*) as selected_count
from report_boundaries rb
join report_boundary_source_selections rbss
  on rbss.report_boundary_id = rb.id
join emission_sources es
  on es.id = rbss.emission_source_id
where rbss.selected = true
group by rb.id, es.source_uid
having count(*) > 1;
```

## Report Governance

Report generation must snapshot:

- selected `source_uid`
- selected `ownership_type`
- selected `allocation_ratio`
- trace metadata
- why selected
- why not selected

Historical reports must not change when source ownership is later corrected. A correction creates a new project/report version.

## Out Of Scope For V0

- Automatic duplicate-resolution engine.
- Cross-workspace source matching.
- Public marketplace source sharing.
- Destructive migration of existing activities.
- Retroactive rewriting of completed reports.
