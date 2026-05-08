-- CaCalLab V1 hardening: generate-report atomic RPC
-- Generated at 2026-03-16

create or replace function generate_report_atomic(
  p_organization_id uuid,
  p_project_id uuid,
  p_generated_by_user_id uuid,
  p_report_version integer,
  p_payload jsonb,
  p_payload_hash text,
  p_reporting_period_start date,
  p_reporting_period_end date,
  p_included_activity_count integer,
  p_excluded_activity_count integer,
  p_pending_activity_count integer,
  p_scope_totals jsonb,
  p_category_totals jsonb,
  p_factor_sources jsonb,
  p_warning_count integer,
  p_based_on_calculated_at timestamptz,
  p_request_id text default null
)
returns table (
  report_generation_id uuid,
  status report_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report_generation_id uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'report_payload_required';
  end if;

  insert into report_generations (
    organization_id,
    project_id,
    generated_by_user_id,
    status,
    report_version,
    payload,
    payload_hash,
    reporting_period_start,
    reporting_period_end,
    included_activity_count,
    excluded_activity_count,
    pending_activity_count,
    scope_totals,
    category_totals,
    factor_sources,
    warning_count,
    based_on_calculated_at
  )
  values (
    p_organization_id,
    p_project_id,
    p_generated_by_user_id,
    'completed',
    p_report_version,
    p_payload,
    p_payload_hash,
    p_reporting_period_start,
    p_reporting_period_end,
    p_included_activity_count,
    p_excluded_activity_count,
    p_pending_activity_count,
    coalesce(p_scope_totals, '{}'::jsonb),
    coalesce(p_category_totals, '{}'::jsonb),
    coalesce(p_factor_sources, '[]'::jsonb),
    coalesce(p_warning_count, 0),
    p_based_on_calculated_at
  )
  returning id into v_report_generation_id;

  insert into audit_logs (
    organization_id,
    project_id,
    actor_user_id,
    actor_type,
    action,
    entity_type,
    entity_id,
    status,
    after_state,
    metadata
  )
  values (
    p_organization_id,
    p_project_id,
    p_generated_by_user_id,
    'edge_function',
    'generate_report_atomic',
    'report_generation',
    v_report_generation_id,
    'recorded',
    jsonb_build_object(
      'report_version', p_report_version,
      'warning_count', coalesce(p_warning_count, 0)
    ),
    jsonb_build_object('request_id', p_request_id)
  );

  return query select v_report_generation_id, 'completed'::report_status;
end;
$$;
