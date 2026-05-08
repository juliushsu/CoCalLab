-- CaCalLab V1 P0 fix: process_document_atomic extraction_version auto increment

create or replace function process_document_atomic(
  p_organization_id uuid,
  p_project_id uuid,
  p_uploaded_document_id uuid,
  p_raw_payload jsonb,
  p_normalized_payload jsonb,
  p_status draft_status,
  p_confidence_score numeric,
  p_provider text,
  p_model text,
  p_request_id text default null
)
returns table (
  draft_id uuid,
  status draft_status,
  normalized_payload jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft_id uuid;
  v_next_extraction_version integer;
begin
  select coalesce(max(edd.extraction_version), 0) + 1
  into v_next_extraction_version
  from extracted_document_drafts edd
  where edd.uploaded_document_id = p_uploaded_document_id;

  update extracted_document_drafts edd
  set is_latest = false
  where edd.uploaded_document_id = p_uploaded_document_id
    and edd.is_latest = true;

  insert into extracted_document_drafts (
    organization_id,
    project_id,
    uploaded_document_id,
    extraction_version,
    raw_payload,
    normalized_payload,
    status,
    confidence_score,
    is_latest
  )
  values (
    p_organization_id,
    p_project_id,
    p_uploaded_document_id,
    v_next_extraction_version,
    coalesce(p_raw_payload, '{}'::jsonb),
    coalesce(p_normalized_payload, '{}'::jsonb),
    p_status,
    p_confidence_score,
    true
  )
  returning id into v_draft_id;

  update uploaded_documents ud
  set ocr_status = 'succeeded'
  where ud.id = p_uploaded_document_id
    and ud.organization_id = p_organization_id
    and ud.project_id = p_project_id;

  insert into audit_logs (
    organization_id,
    project_id,
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
    'edge_function',
    'process_document_atomic',
    'extracted_document_draft',
    v_draft_id,
    'recorded',
    jsonb_build_object(
      'uploaded_document_id', p_uploaded_document_id,
      'extraction_version', v_next_extraction_version,
      'provider', p_provider,
      'model', p_model,
      'request_id', p_request_id
    )
  );

  return query
  select
    v_draft_id,
    p_status,
    coalesce(p_normalized_payload, '{}'::jsonb);
end;
$$;
