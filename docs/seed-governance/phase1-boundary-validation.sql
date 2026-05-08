-- CoCalLab Phase 1 boundary validation
-- Expected after applying 202605080001_phase1_boundary_governance_staging.sql
-- and reseeding canonical_seed_pack_staging_v20260407_v3.sql.

-- A) Canonical seed pack registry
select
  scenario_code,
  seed_pack_version,
  schema_version,
  is_canonical
from seed_pack_registry
where scenario_code = 'stg_core_closed_beta';

-- B) Workspace / legal entity / site counts
select 'workspaces' as check_name, count(*) as row_count
from organizations
where env = 'staging' or is_test = true;

select 'legal_entities' as check_name, count(*) as row_count
from legal_entities
where env = 'staging' or is_test = true;

select 'sites' as check_name, count(*) as row_count
from sites
where env = 'staging' or is_test = true;

-- C) Project -> legal entity -> site chain
select
  p.id as project_id,
  p.project_code,
  p.organization_id as workspace_id,
  le.id as legal_entity_id,
  le.display_name as legal_entity_label,
  s.id as site_id,
  s.site_name as site_label
from projects p
join legal_entities le
  on le.id = p.legal_entity_id
 and le.workspace_id = p.organization_id
join sites s
  on s.id = p.site_id
 and s.legal_entity_id = le.id
 and s.workspace_id = p.organization_id
where p.env = 'staging' or p.is_test = true
order by p.project_code;

-- D) Violations: staging projects missing Phase 1 bindings
select
  p.id,
  p.project_code,
  p.legal_entity_id,
  p.site_id
from projects p
where (p.env = 'staging' or p.is_test = true)
  and (p.legal_entity_id is null or p.site_id is null);

-- E) Violations: project/site/legal entity workspace mismatch
select
  p.id as project_id,
  p.organization_id as project_workspace_id,
  le.workspace_id as legal_entity_workspace_id,
  s.workspace_id as site_workspace_id,
  s.legal_entity_id as site_legal_entity_id
from projects p
left join legal_entities le on le.id = p.legal_entity_id
left join sites s on s.id = p.site_id
where (p.env = 'staging' or p.is_test = true)
  and (
    le.id is null
    or s.id is null
    or le.workspace_id <> p.organization_id
    or s.workspace_id <> p.organization_id
    or s.legal_entity_id <> le.id
  );

-- F) Report snapshot chain
select
  rg.id as report_generation_id,
  rg.report_version,
  rg.legal_entity_snapshot->>'legal_entity_label' as legal_entity_label,
  rg.site_snapshot->>'site_label' as site_label,
  rg.boundary_snapshot->>'workspace_label' as workspace_label,
  rg.boundary_snapshot->>'boundary_type' as boundary_type,
  rg.boundary_snapshot->'reporting_period' as reporting_period
from report_generations rg
where rg.env = 'staging' or rg.is_test = true
order by rg.project_id, rg.report_version;

-- G) Violations: completed staging reports missing immutable boundary labels
select
  rg.id,
  rg.report_version
from report_generations rg
where (rg.env = 'staging' or rg.is_test = true)
  and rg.status = 'completed'
  and (
    coalesce(rg.legal_entity_snapshot->>'legal_entity_label', '') = ''
    or coalesce(rg.site_snapshot->>'site_label', '') = ''
    or coalesce(rg.boundary_snapshot->>'workspace_label', '') = ''
    or coalesce(rg.boundary_snapshot->>'boundary_type', '') = ''
    or rg.boundary_snapshot->'reporting_period' is null
  );

-- H) Compatibility helper smoke checks
select
  p.id as project_id,
  get_project_workspace_id(p.id) as helper_workspace_id,
  get_project_legal_entity_id(p.id) as helper_legal_entity_id,
  get_project_site_id(p.id) as helper_site_id
from projects p
where p.env = 'staging' or p.is_test = true
order by p.project_code;

-- I) Compatibility view smoke check
select
  project_id,
  workspace_id,
  workspace_label,
  legal_entity_id,
  legal_entity_label,
  site_id,
  site_label,
  boundary_type,
  reporting_start_date,
  reporting_end_date
from project_boundary_context_v
where workspace_id = 'a1111111-1111-4111-8111-111111111111'::uuid
order by project_id;
