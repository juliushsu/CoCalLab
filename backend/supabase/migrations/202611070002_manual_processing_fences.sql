-- SOURCE ONLY. Transaction fences protect MANUAL even via legacy handlers/RPCs.
begin;
do $$begin if not cocal_delete_private.deployment_ready() then raise exception 'Existing deletion source drift; do not rebaseline unknown source';end if;end;$$;
create function cocal_manual_private.is_manual(p_provider text,p_raw jsonb) returns boolean language sql immutable set search_path='' as $$select coalesce(p_provider,'') ~* '(^|[_-])manual([_-]|$)' or coalesce(p_raw,'{}') ? 'manual_transcription'$$;
create function cocal_manual_private.lock_document(p_org uuid,p_project uuid,p_doc uuid) returns public.uploaded_documents language plpgsql volatile security definer set search_path='' as $$
declare doc public.uploaded_documents;
begin
 perform 1 from public.projects p where p.id=p_project and p.organization_id=p_org for no key update;
 if not found then raise exception 'MANUAL_DOCUMENT_SCOPE_DENIED' using errcode='42501';end if;
 perform cocal_delete_private.assert_unfenced(p_doc);
 perform pg_advisory_xact_lock(hashtextextended('manual:'||p_doc::text,0));
 select * into doc from public.uploaded_documents u where u.id=p_doc and u.organization_id=p_org and u.project_id=p_project and u.status='active' and u.deletion_state='active' for update;
 if not found then raise exception 'MANUAL_DOCUMENT_SCOPE_DENIED' using errcode='42501';end if;return doc;
end;$$;
create function cocal_manual_private.assert_not_manual(p_doc uuid) returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if exists(select 1 from public.extracted_document_drafts d where d.uploaded_document_id=p_doc and cocal_manual_private.is_manual(d.extraction_provider,d.raw_payload)) then raise exception 'MANUAL_PROCESSING_FORBIDDEN' using errcode='42501';end if;
end;$$;
create function cocal_manual_private.require_verified_original(p_doc public.uploaded_documents) returns void language plpgsql volatile security definer set search_path='' as $$
declare v cocal_attachment_private.verifications;
begin
 if p_doc.hash_verification_status<>'server_verified' or p_doc.server_verified_at is null or p_doc.verified_storage_object_id is null then raise exception 'MANUAL_VERIFIED_RECEIPT_REQUIRED' using errcode='42501';end if;
 select * into v from cocal_attachment_private.verifications q where q.document_id=p_doc.id and q.organization_id=p_doc.organization_id and q.project_id=p_doc.project_id and q.state='verified';
 if not found or v.storage_object_id is distinct from p_doc.verified_storage_object_id or v.sha256_hash is distinct from p_doc.sha256_hash or v.bucket is distinct from p_doc.storage_bucket or v.path is distinct from p_doc.storage_path or v.file_size_bytes is distinct from p_doc.file_size_bytes or v.mime_type is distinct from p_doc.mime_type then raise exception 'MANUAL_VERIFIED_RECEIPT_REQUIRED' using errcode='42501';end if;
 perform cocal_attachment_private.assert_object(v);
end;$$;

alter function public.classify_document_atomic(uuid,uuid,uuid,public.classification_status,text,smallint,numeric,text,text,text,text) set schema cocal_manual_private;
create function public.classify_document_atomic(p_organization_id uuid,p_project_id uuid,p_draft_id uuid,p_classification_status public.classification_status,p_suggested_category text,p_suggested_scope smallint,p_confidence_score numeric,p_review_note text,p_provider text,p_model text,p_request_id text default null)
returns table(draft_id uuid,classification_status public.classification_status,suggested_category text,suggested_scope smallint,confidence_score numeric,review_note text) language plpgsql security definer set search_path='' as $$
declare d public.extracted_document_drafts;
begin
 select * into d from public.extracted_document_drafts x where x.id=p_draft_id and x.organization_id=p_organization_id and x.project_id=p_project_id;
 if not found then raise exception 'draft_not_found';end if;
 perform cocal_manual_private.lock_document(p_organization_id,p_project_id,d.uploaded_document_id);
 select * into d from public.extracted_document_drafts x where x.id=p_draft_id for update;
 if cocal_manual_private.is_manual(d.extraction_provider,d.raw_payload) then raise exception 'MANUAL_CLASSIFICATION_FORBIDDEN' using errcode='42501';end if;
 return query select * from cocal_manual_private.classify_document_atomic(p_organization_id,p_project_id,p_draft_id,p_classification_status,p_suggested_category,p_suggested_scope,p_confidence_score,p_review_note,p_provider,p_model,p_request_id);
end;$$;

alter function public.process_document_atomic(uuid,uuid,uuid,jsonb,jsonb,public.draft_status,numeric,text,text,text) set schema cocal_manual_private;
create function public.process_document_atomic(p_organization_id uuid,p_project_id uuid,p_uploaded_document_id uuid,p_raw_payload jsonb,p_normalized_payload jsonb,p_status public.draft_status,p_confidence_score numeric,p_provider text,p_model text,p_request_id text default null)
returns table(draft_id uuid,status public.draft_status,normalized_payload jsonb) language plpgsql security definer set search_path='' as $$
begin
 perform cocal_manual_private.lock_document(p_organization_id,p_project_id,p_uploaded_document_id);
 perform cocal_manual_private.assert_not_manual(p_uploaded_document_id);
 -- Do not let the automatic path manufacture the MANUAL provenance marker.
 if cocal_manual_private.is_manual(p_provider,p_raw_payload) then raise exception 'MANUAL_PROCESSING_FORBIDDEN' using errcode='42501';end if;
 return query select * from cocal_manual_private.process_document_atomic(p_organization_id,p_project_id,p_uploaded_document_id,p_raw_payload,p_normalized_payload,p_status,p_confidence_score,p_provider,p_model,p_request_id);
end;$$;

alter function public.begin_document_processing(uuid,uuid,uuid,uuid,uuid,text) set schema cocal_manual_private;
create function public.begin_document_processing(p_actor_user_id uuid,p_organization_id uuid,p_project_id uuid,p_document_id uuid,p_lease_id uuid,p_request_id text default null)
returns table(lease_id uuid) language plpgsql security definer set search_path='' as $$
begin
 perform cocal_attachment_private.assert_write(p_organization_id,p_project_id,p_actor_user_id);
 perform cocal_manual_private.lock_document(p_organization_id,p_project_id,p_document_id);
 perform cocal_manual_private.assert_not_manual(p_document_id);
 return query select * from cocal_manual_private.begin_document_processing(p_actor_user_id,p_organization_id,p_project_id,p_document_id,p_lease_id,p_request_id);
end;$$;
alter function public.finish_document_processing(uuid,uuid,jsonb) set schema cocal_manual_private;
create function public.finish_document_processing(p_actor_user_id uuid,p_lease_id uuid,p_payload jsonb)
returns table(draft_id uuid,status public.draft_status,normalized_payload jsonb) language plpgsql security definer set search_path='' as $$
declare l cocal_delete_private.processing_leases;
begin
 select * into l from cocal_delete_private.processing_leases x where x.lease_id=p_lease_id and x.actor_user_id=p_actor_user_id;
 if not found then raise exception 'DOCUMENT_PROCESSING_LEASE_DENIED' using errcode='42501';end if;
 perform cocal_attachment_private.assert_write(l.organization_id,l.project_id,p_actor_user_id);
 perform cocal_manual_private.lock_document(l.organization_id,l.project_id,l.document_id);
 perform cocal_manual_private.assert_not_manual(l.document_id);
 return query select * from cocal_manual_private.finish_document_processing(p_actor_user_id,p_lease_id,p_payload);
end;$$;

alter function public.create_manual_transcription_atomic(uuid,uuid,uuid,uuid,uuid,text,jsonb) set schema cocal_manual_private;
create function public.create_manual_transcription_atomic(p_organization_id uuid,p_project_id uuid,p_document_id uuid,p_draft_id uuid,p_actor_user_id uuid,p_request_id text,p_transcription jsonb)
returns table(draft_data jsonb,replayed boolean) language plpgsql security definer set search_path='' as $$
declare doc public.uploaded_documents;answer record;saved public.extracted_document_drafts;
begin
 perform cocal_attachment_private.assert_write(p_organization_id,p_project_id,p_actor_user_id);
 doc:=cocal_manual_private.lock_document(p_organization_id,p_project_id,p_document_id);
 perform cocal_manual_private.require_verified_original(doc);
 if doc.ocr_status='processing' or exists(select 1 from cocal_delete_private.processing_leases l where l.document_id=p_document_id and l.state='active') then raise exception 'DOCUMENT_PROCESSING_LEASE_ACTIVE';end if;
 if exists(select 1 from public.extracted_document_drafts d where d.uploaded_document_id=p_document_id and d.is_latest) and not exists(select 1 from public.extracted_document_drafts d where d.id=p_draft_id and d.uploaded_document_id=p_document_id) then raise exception 'manual_document_latest_conflict';end if;
 if exists(select 1 from public.extracted_document_drafts d where d.uploaded_document_id=p_document_id) and not exists(select 1 from public.extracted_document_drafts d where d.id=p_draft_id and d.uploaded_document_id=p_document_id) then raise exception 'manual_document_history_requires_review';end if;
 select * into answer from cocal_manual_private.create_manual_transcription_atomic(p_organization_id,p_project_id,p_document_id,p_draft_id,p_actor_user_id,p_request_id,p_transcription);
 if not answer.replayed then
  update public.extracted_document_drafts d set raw_payload=jsonb_set(d.raw_payload,'{manual_transcription,original_verification}',jsonb_build_object('contract_version','20261107.manual.2','storage_object_id',doc.verified_storage_object_id,'sha256_hash',doc.sha256_hash,'verified_at',doc.server_verified_at)) where d.id=p_draft_id returning * into saved;
  return query select to_jsonb(saved),false;
 else return query select answer.draft_data,answer.replayed;end if;
end;$$;
-- Confirmation of old MANUAL records does not upgrade their original to verified.
-- New drafts must pass the original fence above; old data remains distinguishable.
alter function public.confirm_manual_draft_atomic_v2(uuid,uuid,uuid,uuid,jsonb,jsonb,numeric,text) set schema cocal_manual_private;
create function public.confirm_manual_draft_atomic_v2(p_organization_id uuid,p_project_id uuid,p_draft_id uuid,p_actor_user_id uuid,p_intent jsonb,p_calculation_result jsonb default null,p_normalized_quantity numeric default null,p_normalized_unit text default null)
returns table(draft_id uuid,emission_activity_id uuid,calculation_result_id uuid,draft_status public.draft_status,inclusion_status public.inclusion_status) language plpgsql security definer set search_path='' as $$
declare d public.extracted_document_drafts;doc public.uploaded_documents;
begin
 perform cocal_attachment_private.assert_write(p_organization_id,p_project_id,p_actor_user_id);
 select * into d from public.extracted_document_drafts x where x.id=p_draft_id and x.organization_id=p_organization_id and x.project_id=p_project_id;
 if not found then raise exception 'manual_draft_not_found';end if;
 doc:=cocal_manual_private.lock_document(p_organization_id,p_project_id,d.uploaded_document_id);
 if doc.hash_verification_status='server_verified' or d.raw_payload->'manual_transcription'->'original_verification'->>'contract_version'='20261107.manual.2' then perform cocal_manual_private.require_verified_original(doc);end if;
 return query select * from cocal_manual_private.confirm_manual_draft_atomic_v2(p_organization_id,p_project_id,p_draft_id,p_actor_user_id,p_intent,p_calculation_result,p_normalized_quantity,p_normalized_unit);
end;$$;
-- Old confirm handlers cannot route MANUAL around the v2 provenance/intent guard.
alter function public.confirm_draft_atomic(uuid,uuid,uuid,text,public.draft_status,text,timestamptz,jsonb,jsonb,uuid,text) set schema cocal_manual_private;
create function public.confirm_draft_atomic(p_organization_id uuid,p_project_id uuid,p_draft_id uuid,p_decision text,p_draft_status public.draft_status,p_draft_review_note text,p_draft_reviewed_at timestamptz,p_emission_activity jsonb default null,p_calculation_result jsonb default null,p_actor_user_id uuid default null,p_request_id text default null)
returns table(draft_id uuid,emission_activity_id uuid,calculation_result_id uuid,draft_status public.draft_status,inclusion_status public.inclusion_status) language plpgsql security definer set search_path='' as $$
declare d public.extracted_document_drafts;
begin
 perform cocal_attachment_private.assert_write(p_organization_id,p_project_id,p_actor_user_id);
 select * into d from public.extracted_document_drafts x where x.id=p_draft_id and x.organization_id=p_organization_id and x.project_id=p_project_id;
 if not found then raise exception 'draft_not_found';end if;
 perform cocal_manual_private.lock_document(p_organization_id,p_project_id,d.uploaded_document_id);
 select * into d from public.extracted_document_drafts x where x.id=p_draft_id for update;
 if cocal_manual_private.is_manual(d.extraction_provider,d.raw_payload) then raise exception 'MANUAL_CONFIRMATION_V2_REQUIRED' using errcode='42501';end if;
 return query select * from cocal_manual_private.confirm_draft_atomic(p_organization_id,p_project_id,p_draft_id,p_decision,p_draft_status,p_draft_review_note,p_draft_reviewed_at,p_emission_activity,p_calculation_result,p_actor_user_id,p_request_id);
end;$$;
revoke all on function public.confirm_draft_atomic(uuid,uuid,uuid,text,public.draft_status,text,timestamptz,jsonb,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.confirm_draft_atomic(uuid,uuid,uuid,text,public.draft_status,text,timestamptz,jsonb,jsonb,uuid,text) to service_role;
revoke all on all functions in schema cocal_manual_private from public,anon,authenticated,service_role;
grant execute on function cocal_manual_private.receipt_can_delete(uuid),cocal_manual_private.original_can_delete(text,text) to authenticated;
revoke all on function public.classify_document_atomic(uuid,uuid,uuid,public.classification_status,text,smallint,numeric,text,text,text,text),public.process_document_atomic(uuid,uuid,uuid,jsonb,jsonb,public.draft_status,numeric,text,text,text),public.begin_document_processing(uuid,uuid,uuid,uuid,uuid,text),public.finish_document_processing(uuid,uuid,jsonb),public.create_manual_transcription_atomic(uuid,uuid,uuid,uuid,uuid,text,jsonb),public.confirm_manual_draft_atomic_v2(uuid,uuid,uuid,uuid,jsonb,jsonb,numeric,text) from public,anon,authenticated;
grant execute on function public.classify_document_atomic(uuid,uuid,uuid,public.classification_status,text,smallint,numeric,text,text,text,text),public.process_document_atomic(uuid,uuid,uuid,jsonb,jsonb,public.draft_status,numeric,text,text,text),public.begin_document_processing(uuid,uuid,uuid,uuid,uuid,text),public.finish_document_processing(uuid,uuid,jsonb),public.create_manual_transcription_atomic(uuid,uuid,uuid,uuid,uuid,text,jsonb),public.confirm_manual_draft_atomic_v2(uuid,uuid,uuid,uuid,jsonb,jsonb,numeric,text) to service_role;
-- The entry assertion proved the previous baseline. Refresh only the exact two
-- public functions intentionally wrapped above, never learn unrelated drift.
update cocal_delete_private.source_baseline b set fingerprint=c.fingerprint from cocal_delete_private.catalog_state() c
 where b.kind=c.kind and b.object_key=c.object_key and b.kind='function' and b.object_key in('public.begin_document_processing(uuid,uuid,uuid,uuid,uuid,text)','public.finish_document_processing(uuid,uuid,jsonb)');
commit;
