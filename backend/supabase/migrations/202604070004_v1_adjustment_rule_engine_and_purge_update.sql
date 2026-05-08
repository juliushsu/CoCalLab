-- CaCalLab V1 adjustment rule engine (minimal) + staging purge coverage update

create or replace function evaluate_adjustment_eligibility(
  p_organization_id uuid,
  p_project_id uuid,
  p_adjustment_item_id uuid,
  p_claim_purpose claim_purpose_code,
  p_requested_quantity_tco2e numeric,
  p_report_generation_id uuid default null
)
returns table (
  claim_purpose claim_purpose_code,
  requested numeric(20,8),
  eligible numeric(20,8),
  disallowed numeric(20,8),
  disallow_reasons jsonb,
  inventory_impact_mode text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item carbon_adjustment_items%rowtype;
  v_cert adjustment_certificates%rowtype;
  v_rule adjustment_claim_rules%rowtype;
  v_reporting_period_end date;
  v_reporting_year integer := extract(year from now())::integer;
  v_requested numeric(20,8) := coalesce(p_requested_quantity_tco2e, 0);
  v_eligible numeric(20,8) := 0;
  v_disallowed numeric(20,8) := 0;
  v_available numeric(20,8) := 0;
  v_rule_ratio numeric(10,6) := 0;
  v_inventory_mode text := 'claim_only';
  v_disallow_reasons jsonb := '[]'::jsonb;
begin
  if v_requested <= 0 then
    raise exception 'requested_quantity_must_be_positive';
  end if;

  if p_report_generation_id is not null then
    select rg.reporting_period_end
    into v_reporting_period_end
    from report_generations rg
    where rg.id = p_report_generation_id
      and rg.organization_id = p_organization_id;

    if v_reporting_period_end is not null then
      v_reporting_year := extract(year from v_reporting_period_end)::integer;
    end if;
  end if;

  select *
  into v_item
  from carbon_adjustment_items cai
  where cai.id = p_adjustment_item_id
    and cai.organization_id = p_organization_id
    and cai.status = 'active';

  if v_item.id is null then
    return query
    select
      p_claim_purpose,
      v_requested,
      0::numeric(20,8),
      v_requested,
      jsonb_build_array('adjustment_item_not_found'),
      v_inventory_mode;
    return;
  end if;

  if p_project_id is not null
    and v_item.project_id is not null
    and v_item.project_id <> p_project_id
  then
    v_disallow_reasons := v_disallow_reasons || jsonb_build_array('project_scope_mismatch');
  end if;

  select *
  into v_cert
  from adjustment_certificates ac
  where ac.organization_id = p_organization_id
    and ac.carbon_adjustment_item_id = p_adjustment_item_id
  order by ac.created_at desc
  limit 1;

  select *
  into v_rule
  from adjustment_claim_rules acr
  where acr.claim_purpose = p_claim_purpose
    and acr.adjustment_type = v_item.adjustment_type
    and acr.jurisdiction_code = v_item.jurisdiction_code
    and acr.effective_year = v_reporting_year
    and acr.is_active = true
    and (acr.organization_id = p_organization_id or acr.organization_id is null)
  order by
    case when acr.organization_id = p_organization_id then 0 else 1 end,
    acr.priority asc,
    acr.created_at desc
  limit 1;

  if v_rule.id is null then
    v_disallow_reasons := v_disallow_reasons || jsonb_build_array('claim_rule_not_found');
  else
    v_rule_ratio := v_rule.max_deduction_ratio;
    v_inventory_mode := v_rule.inventory_impact_mode;
  end if;

  if v_rule.certificate_verification_required and v_item.certificate_verification_status <> 'verified' then
    v_disallow_reasons := v_disallow_reasons || jsonb_build_array('item_certificate_not_verified');
  end if;

  if v_rule.approval_required and v_item.approval_status <> 'approved' then
    v_disallow_reasons := v_disallow_reasons || jsonb_build_array('item_not_approved');
  end if;

  if v_cert.id is not null then
    if v_rule.certificate_verification_required and v_cert.verification_status <> 'verified' then
      v_disallow_reasons := v_disallow_reasons || jsonb_build_array('certificate_not_verified');
    end if;

    if v_rule.approval_required and v_cert.approval_status <> 'approved' then
      v_disallow_reasons := v_disallow_reasons || jsonb_build_array('certificate_not_approved');
    end if;
  elsif v_rule.requires_retirement then
    v_disallow_reasons := v_disallow_reasons || jsonb_build_array('certificate_required');
  end if;

  if v_item.usage_lock_status = 'consumed' then
    v_disallow_reasons := v_disallow_reasons || jsonb_build_array('item_usage_consumed');
  end if;

  if v_cert.id is not null and v_cert.usage_lock_status = 'consumed' then
    v_disallow_reasons := v_disallow_reasons || jsonb_build_array('certificate_usage_consumed');
  end if;

  v_available := greatest(v_item.quantity_available_tco2e, 0);
  if v_cert.id is not null then
    v_available := least(v_available, greatest(v_cert.retired_quantity_available_tco2e, 0));
  end if;

  if v_available <= 0 then
    v_disallow_reasons := v_disallow_reasons || jsonb_build_array('no_available_quantity');
  end if;

  if v_rule_ratio <= 0 then
    v_disallow_reasons := v_disallow_reasons || jsonb_build_array('rule_ratio_zero');
  end if;

  if jsonb_array_length(v_disallow_reasons) = 0 then
    v_eligible := least(v_requested, v_available, (v_requested * v_rule_ratio))::numeric(20,8);
  else
    v_eligible := 0;
  end if;

  v_disallowed := greatest(v_requested - v_eligible, 0)::numeric(20,8);

  return query
  select
    p_claim_purpose,
    v_requested,
    v_eligible,
    v_disallowed,
    v_disallow_reasons,
    v_inventory_mode;
end;
$$;

revoke all on function evaluate_adjustment_eligibility(uuid, uuid, uuid, claim_purpose_code, numeric, uuid)
  from public, anon, authenticated;
grant execute on function evaluate_adjustment_eligibility(uuid, uuid, uuid, claim_purpose_code, numeric, uuid)
  to service_role;

insert into adjustment_claim_rules (
  organization_id,
  rule_code,
  rule_name,
  jurisdiction_code,
  effective_year,
  claim_purpose,
  adjustment_type,
  max_deduction_ratio,
  inventory_impact_mode,
  certificate_verification_required,
  approval_required,
  requires_retirement,
  priority,
  is_active,
  metadata,
  env,
  is_test
)
select
  null as organization_id,
  seed.rule_code,
  seed.rule_name,
  seed.jurisdiction_code,
  seed.effective_year,
  seed.claim_purpose::claim_purpose_code,
  seed.adjustment_type::carbon_adjustment_type_code,
  seed.max_deduction_ratio,
  seed.inventory_impact_mode,
  seed.certificate_verification_required,
  seed.approval_required,
  seed.requires_retirement,
  seed.priority,
  true,
  '{}'::jsonb,
  'staging',
  true
from (
  values
    ('stg_rule_tw_internal_offset_2026', 'TW Internal Mgmt Offset 2026', 'TW', 2026, 'internal_management', 'offset_credit', 1.0::numeric(10,6), 'claim_only', true, true, true, 10),
    ('stg_rule_tw_internal_re_2026', 'TW Internal Mgmt RE 2026', 'TW', 2026, 'internal_management', 'renewable_electricity_attribute', 1.0::numeric(10,6), 'market_based_adjustment', true, true, true, 10),
    ('stg_rule_tw_internal_removal_2026', 'TW Internal Mgmt Removal 2026', 'TW', 2026, 'internal_management', 'carbon_removal', 1.0::numeric(10,6), 'claim_only', true, true, true, 10),
    ('stg_rule_tw_internal_storage_2026', 'TW Internal Mgmt Storage 2026', 'TW', 2026, 'internal_management', 'carbon_storage', 1.0::numeric(10,6), 'claim_only', true, true, true, 10),
    ('stg_rule_tw_internal_regded_2026', 'TW Internal Mgmt Regulatory Deduction 2026', 'TW', 2026, 'internal_management', 'regulatory_deduction', 1.0::numeric(10,6), 'regulatory_deduction_note', true, true, false, 10)
) as seed (
  rule_code,
  rule_name,
  jurisdiction_code,
  effective_year,
  claim_purpose,
  adjustment_type,
  max_deduction_ratio,
  inventory_impact_mode,
  certificate_verification_required,
  approval_required,
  requires_retirement,
  priority
)
where not exists (
  select 1
  from adjustment_claim_rules acr
  where acr.organization_id is null
    and acr.rule_code = seed.rule_code
    and acr.effective_year = seed.effective_year
);

create or replace function purge_staging_data_dry_run()
returns table (table_name text, row_count bigint)
language sql
security definer
set search_path = public, storage
as $$
  select 'storage.objects'::text as table_name, count(*)::bigint as row_count
  from storage.objects
  where bucket_id in ('staging-receipts', 'staging-attachments')
     or (storage.foldername(name))[1] = 'staging'
  union all
  select 'action_logs', count(*)::bigint from action_logs where env = 'staging' or is_test = true
  union all
  select 'adjustment_audit_logs', count(*)::bigint from adjustment_audit_logs where env = 'staging' or is_test = true
  union all
  select 'adjustment_applications', count(*)::bigint from adjustment_applications where env = 'staging' or is_test = true
  union all
  select 'adjustment_certificates', count(*)::bigint from adjustment_certificates where env = 'staging' or is_test = true
  union all
  select 'adjustment_claim_rules', count(*)::bigint from adjustment_claim_rules where env = 'staging' or is_test = true
  union all
  select 'carbon_adjustment_items', count(*)::bigint from carbon_adjustment_items where env = 'staging' or is_test = true
  union all
  select 'ai_audit_results', count(*)::bigint from ai_audit_results where env = 'staging' or is_test = true
  union all
  select 'report_generations', count(*)::bigint from report_generations where env = 'staging' or is_test = true
  union all
  select 'calculation_results', count(*)::bigint from calculation_results where env = 'staging' or is_test = true
  union all
  select 'emission_activity_classifications', count(*)::bigint from emission_activity_classifications where env = 'staging' or is_test = true
  union all
  select 'emission_activities', count(*)::bigint from emission_activities where env = 'staging' or is_test = true
  union all
  select 'extracted_document_drafts', count(*)::bigint from extracted_document_drafts where env = 'staging' or is_test = true
  union all
  select 'uploaded_documents', count(*)::bigint from uploaded_documents where env = 'staging' or is_test = true
  union all
  select 'emission_factors', count(*)::bigint from emission_factors where env = 'staging' or is_test = true
  union all
  select 'projects', count(*)::bigint from projects where env = 'staging' or is_test = true
  union all
  select 'subscriptions', count(*)::bigint from subscriptions where env = 'staging' or is_test = true
  union all
  select 'organization_members', count(*)::bigint from organization_members where env = 'staging' or is_test = true
  union all
  select 'organizations', count(*)::bigint from organizations where env = 'staging' or is_test = true
  union all
  select 'audit_logs', count(*)::bigint from audit_logs where env = 'staging' or is_test = true;
$$;

create or replace function purge_staging_data()
returns table (table_name text, deleted_count bigint)
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_count bigint;
begin
  delete from storage.objects
  where bucket_id in ('staging-receipts', 'staging-attachments')
     or (storage.foldername(name))[1] = 'staging';
  get diagnostics v_count = row_count;
  return query select 'storage.objects'::text, v_count;

  delete from action_logs where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'action_logs'::text, v_count;

  delete from adjustment_audit_logs where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'adjustment_audit_logs'::text, v_count;

  delete from adjustment_applications where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'adjustment_applications'::text, v_count;

  delete from adjustment_certificates where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'adjustment_certificates'::text, v_count;

  delete from adjustment_claim_rules where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'adjustment_claim_rules'::text, v_count;

  delete from carbon_adjustment_items where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'carbon_adjustment_items'::text, v_count;

  delete from ai_audit_results where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'ai_audit_results'::text, v_count;

  delete from report_generations where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'report_generations'::text, v_count;

  delete from calculation_results where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'calculation_results'::text, v_count;

  delete from emission_activity_classifications where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'emission_activity_classifications'::text, v_count;

  delete from emission_activities where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'emission_activities'::text, v_count;

  delete from extracted_document_drafts where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'extracted_document_drafts'::text, v_count;

  delete from uploaded_documents where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'uploaded_documents'::text, v_count;

  delete from emission_factors where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'emission_factors'::text, v_count;

  delete from projects where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'projects'::text, v_count;

  delete from subscriptions where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'subscriptions'::text, v_count;

  delete from organization_members where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'organization_members'::text, v_count;

  delete from organizations where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'organizations'::text, v_count;

  delete from audit_logs where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'audit_logs'::text, v_count;
end;
$$;

revoke all on function purge_staging_data_dry_run() from public, anon, authenticated;
revoke all on function purge_staging_data() from public, anon, authenticated;
grant execute on function purge_staging_data_dry_run() to service_role;
grant execute on function purge_staging_data() to service_role;
