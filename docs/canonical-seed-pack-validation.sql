-- CaCalLab canonical seed pack validation (staging)
-- Scenario: stg_core_closed_beta
-- Active version: v2026.04.07.v2

-- A) Registry and latest reseed run
select
  scenario_code,
  seed_pack_version,
  schema_version,
  is_active,
  is_canonical
from seed_pack_registry
where scenario_code = 'stg_core_closed_beta';

select
  scenario_code,
  seed_pack_version,
  run_type,
  status,
  started_at,
  completed_at,
  summary
from seed_pack_reseed_runs
where scenario_code = 'stg_core_closed_beta'
order by started_at desc
limit 3;

-- B) Core counts (v2 expected: 1/2/14/14/12/12/2/3/3/3)
select 'organizations' as table_name, count(*) as row_count
from organizations
where id = 'a1111111-1111-4111-8111-111111111111'
union all
select 'projects', count(*) from projects where organization_id = 'a1111111-1111-4111-8111-111111111111'
union all
select 'uploaded_documents', count(*) from uploaded_documents where project_id = 'a3333333-1111-4111-8111-111111111111'
union all
select 'extracted_document_drafts', count(*) from extracted_document_drafts where project_id = 'a3333333-1111-4111-8111-111111111111'
union all
select 'emission_activities', count(*) from emission_activities where project_id = 'a3333333-1111-4111-8111-111111111111'
union all
select 'calculation_results', count(*) from calculation_results where project_id = 'a3333333-1111-4111-8111-111111111111'
union all
select 'report_generations', count(*) from report_generations where project_id = 'a3333333-1111-4111-8111-111111111111'
union all
select 'carbon_adjustment_items', count(*) from carbon_adjustment_items where organization_id = 'a1111111-1111-4111-8111-111111111111'
union all
select 'adjustment_certificates', count(*) from adjustment_certificates where organization_id = 'a1111111-1111-4111-8111-111111111111'
union all
select 'adjustment_applications', count(*) from adjustment_applications where organization_id = 'a1111111-1111-4111-8111-111111111111';

-- C) Document -> draft -> activity closure
select
  ud.id as uploaded_document_id,
  count(distinct edd.id) as draft_count,
  count(distinct ea.id) as activity_count
from uploaded_documents ud
left join extracted_document_drafts edd on edd.uploaded_document_id = ud.id
left join emission_activities ea on ea.source_document_id = ud.id
where ud.project_id = 'a3333333-1111-4111-8111-111111111111'
group by ud.id
order by ud.id;

-- D) Analytics dimensions (GHG Scope + ISO Category)
select *
from get_emissions_analytics(
  'a1111111-1111-4111-8111-111111111111'::uuid,
  'a3333333-1111-4111-8111-111111111111'::uuid,
  'ghg_scope'
);

select *
from get_emissions_analytics(
  'a1111111-1111-4111-8111-111111111111'::uuid,
  'a3333333-1111-4111-8111-111111111111'::uuid,
  'iso_category'
);

-- E) Trend dataset for analytics chart (month aggregate)
select
  date_trunc('month', ea.activity_date)::date as month,
  sum(coalesce(cr.co2e_kg, 0))::numeric(20,10) as total_co2e_kg,
  count(*)::bigint as included_activities
from emission_activities ea
left join calculation_results cr
  on cr.emission_activity_id = ea.id
  and cr.is_latest = true
where ea.organization_id = 'a1111111-1111-4111-8111-111111111111'
  and ea.project_id = 'a3333333-1111-4111-8111-111111111111'
  and ea.inclusion_status = 'included'
group by 1
order by 1;

-- F) Top 10 hotspot dataset
select
  ea.activity_code,
  ea.activity_name,
  ea.activity_date,
  coalesce(cr.co2e_kg, 0)::numeric(20,10) as co2e_kg
from emission_activities ea
left join calculation_results cr
  on cr.emission_activity_id = ea.id
  and cr.is_latest = true
where ea.organization_id = 'a1111111-1111-4111-8111-111111111111'
  and ea.project_id = 'a3333333-1111-4111-8111-111111111111'
  and ea.inclusion_status = 'included'
order by coalesce(cr.co2e_kg, 0) desc, ea.activity_code
limit 10;

-- G) Report 3-layer snapshot consistency (v1 + v2)
select
  rg.id,
  rg.report_version,
  rg.claim_purpose,
  (rg.gross_emissions_snapshot->>'gross_total_co2e_kg')::numeric as gross_kg,
  (rg.adjustment_summary->>'requested_total_tco2e')::numeric as requested_tco2e,
  (rg.adjustment_summary->>'eligible_total_tco2e')::numeric as eligible_tco2e,
  (rg.adjustment_summary->>'disallowed_total_tco2e')::numeric as disallowed_tco2e,
  (rg.claim_results->>'eligible_deduction_tco2e')::numeric as claim_eligible_tco2e,
  (rg.claim_results->>'claim_net_co2e_kg')::numeric as claim_net_kg,
  jsonb_array_length(rg.adjustment_manifest) as manifest_count
from report_generations rg
where rg.id in (
  'd9000001-1111-4111-8111-111111111111',
  'd9000002-1111-4111-8111-111111111111'
)
order by rg.report_version;

-- H) Rule engine check against seeded applied application
select *
from evaluate_adjustment_eligibility(
  'a1111111-1111-4111-8111-111111111111'::uuid,
  'a3333333-1111-4111-8111-111111111111'::uuid,
  'c1110001-1111-4111-8111-111111111111'::uuid,
  'internal_management'::claim_purpose_code,
  3,
  'd9000002-1111-4111-8111-111111111111'::uuid
);
