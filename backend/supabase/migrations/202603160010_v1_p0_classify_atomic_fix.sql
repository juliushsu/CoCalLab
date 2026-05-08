-- CaCalLab V1 P0 fix: classify_document_atomic ambiguous column fix

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
  v_out_classification_status classification_status;
  v_out_suggested_category text;
  v_out_suggested_scope smallint;
  v_out_confidence_score numeric;
  v_out_review_note text;
begin
  update extracted_document_drafts as edd
  set
    classification_status = p_classification_status,
    suggested_category = p_suggested_category,
    suggested_scope = p_suggested_scope,
    confidence_score = p_confidence_score,
    review_note = p_review_note,
    status = 'pending_review'
  where edd.id = p_draft_id
    and edd.organization_id = p_organization_id
    and edd.project_id = p_project_id
  returning
    edd.id,
    edd.classification_status,
    edd.suggested_category,
    edd.suggested_scope,
    edd.confidence_score,
    edd.review_note
  into
    v_draft_id,
    v_out_classification_status,
    v_out_suggested_category,
    v_out_suggested_scope,
    v_out_confidence_score,
    v_out_review_note;

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
      'classification_status', v_out_classification_status,
      'suggested_category', v_out_suggested_category,
      'suggested_scope', v_out_suggested_scope,
      'confidence_score', v_out_confidence_score,
      'review_note', v_out_review_note
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
    v_out_classification_status,
    v_out_suggested_category,
    v_out_suggested_scope,
    v_out_confidence_score,
    v_out_review_note;
end;
$$;
