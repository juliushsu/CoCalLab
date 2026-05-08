-- CaCalLab V1 hardening: recalculate-project atomic RPC
-- Generated at 2026-03-16

create or replace function recalculate_project_atomic(
  p_organization_id uuid,
  p_project_id uuid,
  p_actor_user_id uuid,
  p_calculation_results jsonb,
  p_request_id text default null
)
returns table (
  project_id uuid,
  processed_activities integer,
  calculated_count integer,
  pending_factor_count integer,
  excluded_count integer,
  error_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb := coalesce(p_calculation_results, '[]'::jsonb);
  v_item jsonb;
  v_activity_ids uuid[] := '{}';
  v_processed integer := 0;
  v_calculated integer := 0;
  v_pending integer := 0;
  v_excluded integer := 0;
  v_error integer := 0;
begin
  if jsonb_typeof(v_payload) <> 'array' then
    raise exception 'calculation_results_payload_must_be_array';
  end if;

  for v_item in select * from jsonb_array_elements(v_payload)
  loop
    v_processed := v_processed + 1;

    if coalesce(v_item->>'status', 'calculated') = 'calculated' then
      v_calculated := v_calculated + 1;
    elsif coalesce(v_item->>'status', 'calculated') = 'pending_factor' then
      v_pending := v_pending + 1;
    elsif coalesce(v_item->>'status', 'calculated') = 'superseded' then
      v_excluded := v_excluded + 1;
    elsif coalesce(v_item->>'status', 'calculated') = 'error' then
      v_error := v_error + 1;
    end if;

    v_activity_ids := array_append(v_activity_ids, (v_item->>'emission_activity_id')::uuid);
  end loop;

  if array_length(v_activity_ids, 1) is not null then
    update calculation_results
    set is_latest = false
    where emission_activity_id = any(v_activity_ids)
      and is_latest = true;

    insert into calculation_results (
      organization_id,
      project_id,
      emission_activity_id,
      calc_version,
      status,
      is_latest,
      co2e_kg,
      co2_kg,
      ch4_kg,
      n2o_kg,
      factor_id,
      factor_snapshot,
      input_snapshot,
      formula_version,
      warnings,
      error_code,
      calculated_at
    )
    select
      p_organization_id,
      p_project_id,
      (item->>'emission_activity_id')::uuid,
      coalesce((item->>'calc_version')::integer, 1),
      coalesce((item->>'status')::calculation_status, 'calculated'),
      true,
      (item->>'co2e_kg')::numeric,
      (item->>'co2_kg')::numeric,
      (item->>'ch4_kg')::numeric,
      (item->>'n2o_kg')::numeric,
      (item->>'factor_id')::uuid,
      coalesce(item->'factor_snapshot', '{}'::jsonb),
      coalesce(item->'input_snapshot', '{}'::jsonb),
      coalesce(item->>'formula_version', 'v1.0.0'),
      coalesce(item->'warnings', '[]'::jsonb),
      item->>'error_code',
      coalesce((item->>'calculated_at')::timestamptz, now())
    from jsonb_array_elements(v_payload) item;
  end if;

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
    p_actor_user_id,
    'edge_function',
    'recalculate_project_atomic',
    'project',
    p_project_id,
    'recorded',
    jsonb_build_object(
      'processed_activities', v_processed,
      'calculated_count', v_calculated,
      'pending_factor_count', v_pending,
      'excluded_count', v_excluded,
      'error_count', v_error
    ),
    jsonb_build_object('request_id', p_request_id)
  );

  return query
  select
    p_project_id,
    v_processed,
    v_calculated,
    v_pending,
    v_excluded,
    v_error;
end;
$$;
