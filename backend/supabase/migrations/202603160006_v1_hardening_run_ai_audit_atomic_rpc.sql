-- CaCalLab V1 hardening: run-ai-audit atomic RPC
-- Generated at 2026-03-16

create or replace function run_ai_audit_atomic(
  p_organization_id uuid,
  p_project_id uuid,
  p_report_generation_id uuid,
  p_run_by_user_id uuid,
  p_model_provider text,
  p_model_name text,
  p_model_version text,
  p_input_snapshot jsonb,
  p_completeness_flags jsonb,
  p_anomaly_flags jsonb,
  p_exclusion_review_flags jsonb,
  p_hotspot_ranking jsonb,
  p_summary_text jsonb,
  p_recommended_actions jsonb,
  p_token_usage jsonb,
  p_confidence_score numeric,
  p_request_id text default null
)
returns table (
  ai_audit_result_id uuid,
  status ai_audit_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ai_audit_result_id uuid;
begin
  if p_summary_text is null or jsonb_typeof(p_summary_text) <> 'object' then
    raise exception 'summary_text_required';
  end if;

  if not (p_summary_text ? 'zh_tw' and p_summary_text ? 'en' and p_summary_text ? 'ja') then
    raise exception 'summary_text_i18n_required';
  end if;

  insert into ai_audit_results (
    organization_id,
    project_id,
    report_generation_id,
    run_by_user_id,
    model_provider,
    model_name,
    model_version,
    status,
    input_snapshot,
    completeness_flags,
    anomaly_flags,
    exclusion_review_flags,
    hotspot_ranking,
    summary_text,
    recommended_actions,
    token_usage,
    confidence_score
  )
  values (
    p_organization_id,
    p_project_id,
    p_report_generation_id,
    p_run_by_user_id,
    p_model_provider,
    p_model_name,
    p_model_version,
    'completed',
    p_input_snapshot,
    coalesce(p_completeness_flags, '[]'::jsonb),
    coalesce(p_anomaly_flags, '[]'::jsonb),
    coalesce(p_exclusion_review_flags, '[]'::jsonb),
    coalesce(p_hotspot_ranking, '[]'::jsonb),
    p_summary_text,
    coalesce(p_recommended_actions, '[]'::jsonb),
    coalesce(p_token_usage, '{}'::jsonb),
    p_confidence_score
  )
  returning id into v_ai_audit_result_id;

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
    p_run_by_user_id,
    'edge_function',
    'run_ai_audit_atomic',
    'ai_audit_result',
    v_ai_audit_result_id,
    'recorded',
    jsonb_build_object(
      'report_generation_id', p_report_generation_id,
      'model_name', p_model_name
    ),
    jsonb_build_object('request_id', p_request_id)
  );

  return query select v_ai_audit_result_id, 'completed'::ai_audit_status;
end;
$$;
