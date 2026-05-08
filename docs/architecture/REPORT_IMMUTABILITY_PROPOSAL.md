# Report Immutability Proposal

Status: governance proposal. No production migration is implied.

`report_generations` must be an immutable snapshot. After report generation, master data updates must not change historical reports.

## Current Risk

Current reports store `payload`, `payload_hash`, `factor_sources`, and adjustment fields. This is a good start, but the payload does not yet snapshot legal entities, sites, ownership allocations, methodology versions, or report template versions as first-class immutable components.

If a workspace later edits legal names, tax ids, site addresses, emission factors, boundary methods, or adjustment rules, previously generated reports must remain exactly as generated.

## Immutable Snapshot Rule

On report generation:

- Read current project, boundary, entity, site, source, calculation, factor, methodology, and adjustment state.
- Build a full report payload.
- Store all required snapshots inside `report_generations`.
- Store payload hash from the final canonical payload.
- Never recalculate a completed historical report in place.

Allowed after generation:

- Append audit logs.
- Create a new report version.
- Mark a report as superseded by a later report, without changing its payload.
- Add external file export metadata that does not affect payload hash.

Forbidden after generation:

- Mutating `payload` for a completed report.
- Repointing a completed report to updated factor/master data.
- Rebuilding historical report output from live master data.
- Deleting historical report data as part of migration.

## Required Snapshot Components

### `legal_entity_snapshot`

Purpose: freeze the reporting subject.

Fields:

- `legal_entity_id`
- `workspace_id`
- `entity_code`
- `registered_name`
- `display_name`
- `tax_id`
- `country_code`
- `registration_address`
- `industry_code`
- `status_at_generation`
- `snapshot_generated_at`

### `site_snapshot`

Purpose: freeze facility and CBAM-ready location context.

Fields:

- `site_id`
- `legal_entity_id`
- `site_code`
- `site_name`
- `facility_type`
- `address`
- `country_code`
- `timezone`
- `cbam_installation_ref`
- `status_at_generation`
- `included_in_boundary`
- `why_not_selected`

### `factor_snapshot`

Purpose: freeze factor values and source quality.

Fields:

- `factor_id`
- `factor_key`
- `factor_name`
- `source_name`
- `source_reference`
- `source_url`
- `source_region`
- `unit`
- `co2e_kg_per_unit`
- `co2_kg_per_unit`
- `ch4_kg_per_unit`
- `n2o_kg_per_unit`
- `valid_from`
- `valid_to`
- `version`
- `quality_tier`
- `status_at_generation`

### `methodology_snapshot`

Purpose: freeze accounting rules and boundary method.

Fields:

- `methodology_code`
- `methodology_version`
- `boundary_method`
- `standard_refs`
- `calculation_engine_version`
- `classification_version`
- `scope_mapping_version`
- `data_quality_rules_version`
- `generated_at`

### `adjustment_manifest`

Purpose: freeze carbon adjustment claims and prevent later rule drift.

Fields:

- `claim_purpose`
- `adjustment_item_id`
- `certificate_id`
- `application_id`
- `quantity_total_tco2e`
- `quantity_applied_tco2e`
- `eligibility_rule_code`
- `eligibility_rule_version`
- `decision`
- `why_selected`
- `why_not_selected`
- `trace_metadata`

### `report_template_version`

Purpose: freeze rendering contract.

Fields:

- `template_code`
- `template_version`
- `locale`
- `render_schema_version`
- `section_manifest`
- `disclaimer_version`

## Proposed `report_generations` Additions

Additive-only proposal:

```sql
alter table report_generations
  add column if not exists legal_entity_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists site_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists factor_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists methodology_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists report_template_version text,
  add column if not exists immutability_manifest jsonb not null default '{}'::jsonb;
```

The existing `adjustment_manifest` should remain canonical for adjustment claims; if absent in legacy rows, readers treat it as an empty immutable manifest.

## Immutability Enforcement Proposal

Staging-first enforcement:

```sql
create or replace function prevent_completed_report_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'completed' and (
    new.payload is distinct from old.payload
    or new.payload_hash is distinct from old.payload_hash
    or new.legal_entity_snapshot is distinct from old.legal_entity_snapshot
    or new.site_snapshot is distinct from old.site_snapshot
    or new.factor_snapshot is distinct from old.factor_snapshot
    or new.methodology_snapshot is distinct from old.methodology_snapshot
    or new.adjustment_manifest is distinct from old.adjustment_manifest
  ) then
    raise exception 'completed_report_generation_is_immutable';
  end if;
  return new;
end;
$$;
```

This trigger must be staged and validated against seed reports before production rollout.

## Versioning Rule

Any change to a completed report creates a new `report_version`. Readers must render by `report_generations.id` and `payload`, not by live project/entity/site/factor joins.
