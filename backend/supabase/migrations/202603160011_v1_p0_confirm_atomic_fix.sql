-- CaCalLab V1 P0 fix: confirm_draft_atomic ambiguous column fix

create or replace function confirm_draft_atomic(
  p_organization_id uuid,
  p_project_id uuid,
  p_draft_id uuid,
  p_decision text,
  p_draft_status draft_status,
  p_draft_review_note text,
  p_draft_reviewed_at timestamptz,
  p_emission_activity jsonb default null,
  p_calculation_result jsonb default null,
  p_actor_user_id uuid default null,
  p_request_id text default null
)
returns table (
  draft_id uuid,
  emission_activity_id uuid,
  calculation_result_id uuid,
  draft_status draft_status,
  inclusion_status inclusion_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft_id uuid;
  v_emission_activity_id uuid;
  v_calculation_result_id uuid;
  v_out_inclusion_status inclusion_status := 'excluded';
begin
  update extracted_document_drafts as edd
  set
    status = p_draft_status,
    review_note = p_draft_review_note,
    reviewed_by_user_id = p_actor_user_id,
    reviewed_at = p_draft_reviewed_at
  where edd.id = p_draft_id
    and edd.organization_id = p_organization_id
    and edd.project_id = p_project_id
  returning edd.id into v_draft_id;

  if v_draft_id is null then
    raise exception 'draft_not_found';
  end if;

  if p_decision = 'confirmed' then
    if p_emission_activity is null then
      raise exception 'emission_activity_payload_required';
    end if;

    if p_calculation_result is null then
      raise exception 'calculation_result_payload_required';
    end if;

    insert into emission_activities as ea (
      organization_id,
      project_id,
      source_document_id,
      source_draft_id,
      activity_code,
      activity_name,
      activity_date,
      category,
      subcategory,
      activity_type,
      quantity,
      unit,
      normalized_quantity,
      normalized_unit,
      data_quality,
      inclusion_status,
      exclusion_reason,
      review_note,
      suggested_scope,
      final_scope,
      confidence_score,
      status,
      created_by_user_id
    )
    values (
      p_organization_id,
      p_project_id,
      (p_emission_activity->>'source_document_id')::uuid,
      v_draft_id,
      p_emission_activity->>'activity_code',
      p_emission_activity->>'activity_name',
      (p_emission_activity->>'activity_date')::date,
      p_emission_activity->>'category',
      p_emission_activity->>'subcategory',
      p_emission_activity->>'activity_type',
      (p_emission_activity->>'quantity')::numeric,
      p_emission_activity->>'unit',
      (p_emission_activity->>'normalized_quantity')::numeric,
      p_emission_activity->>'normalized_unit',
      coalesce(p_emission_activity->>'data_quality', 'measured'),
      coalesce((p_emission_activity->>'inclusion_status')::inclusion_status, 'pending'),
      p_emission_activity->>'exclusion_reason',
      p_emission_activity->>'review_note',
      (p_emission_activity->>'suggested_scope')::smallint,
      (p_emission_activity->>'final_scope')::smallint,
      (p_emission_activity->>'confidence_score')::numeric,
      coalesce((p_emission_activity->>'status')::activity_status, 'active'),
      p_actor_user_id
    )
    returning ea.id, ea.inclusion_status into v_emission_activity_id, v_out_inclusion_status;

    update calculation_results as cr
    set is_latest = false
    where cr.emission_activity_id = v_emission_activity_id
      and cr.is_latest = true;

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
    values (
      p_organization_id,
      p_project_id,
      v_emission_activity_id,
      coalesce((p_calculation_result->>'calc_version')::integer, 1),
      coalesce((p_calculation_result->>'status')::calculation_status, 'calculated'),
      true,
      (p_calculation_result->>'co2e_kg')::numeric,
      (p_calculation_result->>'co2_kg')::numeric,
      (p_calculation_result->>'ch4_kg')::numeric,
      (p_calculation_result->>'n2o_kg')::numeric,
      (p_calculation_result->>'factor_id')::uuid,
      coalesce(p_calculation_result->'factor_snapshot', '{}'::jsonb),
      coalesce(p_calculation_result->'input_snapshot', '{}'::jsonb),
      coalesce(p_calculation_result->>'formula_version', 'v1.0.0'),
      coalesce(p_calculation_result->'warnings', '[]'::jsonb),
      p_calculation_result->>'error_code',
      coalesce((p_calculation_result->>'calculated_at')::timestamptz, now())
    )
    returning id into v_calculation_result_id;
  elsif p_decision = 'rejected' then
    v_out_inclusion_status := 'excluded';
  else
    raise exception 'invalid_decision';
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
    metadata
  )
  values (
    p_organization_id,
    p_project_id,
    p_actor_user_id,
    'edge_function',
    'confirm_draft_atomic',
    'extracted_document_draft',
    v_draft_id,
    'recorded',
    jsonb_build_object(
      'decision', p_decision,
      'emission_activity_id', v_emission_activity_id,
      'calculation_result_id', v_calculation_result_id,
      'request_id', p_request_id
    )
  );

  return query
  select
    v_draft_id,
    v_emission_activity_id,
    v_calculation_result_id,
    p_draft_status,
    v_out_inclusion_status;
end;
$$;
