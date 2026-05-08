-- CaCalLab V1 hardening: classify-document atomic RPC
-- Generated at 2026-03-16

create or replace function classify_document_atomic(
  p_organization_id uuid,
  p_project_id uuid,
  p_draft_id uuid,
  p_classification_status classification_status,
  p_suggested_category text,
  p_suggested_scope smallint,
  p_confidence_score numeric,
  p_review_note text,
  p_provider text,
  p_model text,
  p_request_id text default null
)
returns table (
  draft_id uuid,
  classification_status classification_status,
  suggested_category text,
  suggested_scope smallint,
  confidence_score numeric,
  review_note text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft_id uuid;
  v_classification_status classification_status;
  v_suggested_category text;
  v_suggested_scope smallint;
  v_confidence_score numeric;
  v_review_note text;
begin
  update extracted_document_drafts
  set
    classification_status = p_classification_status,
    suggested_category = p_suggested_category,
    suggested_scope = p_suggested_scope,
    confidence_score = p_confidence_score,
    review_note = p_review_note,
    status = 'pending_review'
  where id = p_draft_id
    and organization_id = p_organization_id
    and project_id = p_project_id
  returning
    id,
    classification_status,
    suggested_category,
    suggested_scope,
    confidence_score,
    review_note
  into
    v_draft_id,
    v_classification_status,
    v_suggested_category,
    v_suggested_scope,
    v_confidence_score,
    v_review_note;

  if v_draft_id is null then
    raise exception 'draft_not_found';
  end if;

  insert into audit_logs (
    organization_id,
    project_id,
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
    'edge_function',
    'classify_document_atomic',
    'extracted_document_draft',
    v_draft_id,
    'recorded',
    jsonb_build_object(
      'classification_status', v_classification_status,
      'suggested_category', v_suggested_category,
      'suggested_scope', v_suggested_scope,
      'confidence_score', v_confidence_score,
      'review_note', v_review_note
    ),
    jsonb_build_object(
      'provider', p_provider,
      'model', p_model,
      'request_id', p_request_id
    )
  );

  return query
  select
    v_draft_id,
    v_classification_status,
    v_suggested_category,
    v_suggested_scope,
    v_confidence_score,
    v_review_note;
end;
$$;
