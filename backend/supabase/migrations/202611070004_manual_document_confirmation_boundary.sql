-- SOURCE ONLY. N1/N2 delta; no cloud resources, data cleanup or history upgrade.
begin;
-- One MANUAL predicate for provider tokens and JSON object/array/scalar markers.
-- Trigger execution is owner-scoped; caller role is checked explicitly so this
-- does not grant clients direct access to the private schema/helpers.
create or replace function cocal_manual_private.protect_manual_draft() returns trigger
language plpgsql security definer set search_path='' as $$
declare org uuid;project uuid;doc uuid;ids uuid[];
begin
 if coalesce(current_setting('role',true),'none') not in ('authenticated','anon') then if tg_op='DELETE' then return old;else return new;end if;end if;
 if(tg_op<>'INSERT' and cocal_manual_private.is_manual(old.extraction_provider,old.raw_payload))
 or(tg_op<>'DELETE' and cocal_manual_private.is_manual(new.extraction_provider,new.raw_payload)) then raise exception 'Manual provenance is server-managed' using errcode='42501';end if;
 if tg_op='DELETE' then org:=old.organization_id;project:=old.project_id;ids:=array[old.uploaded_document_id];
 else org:=new.organization_id;project:=new.project_id;ids:=array[new.uploaded_document_id];
  if tg_op='UPDATE' then
   if(new.organization_id,new.project_id) is distinct from(old.organization_id,old.project_id) then raise exception 'DRAFT_DOCUMENT_SCOPE_DENIED' using errcode='42501';end if;
   ids:=array_append(ids,old.uploaded_document_id);
  end if;
 end if;
 perform cocal_attachment_private.assert_write(org,project,auth.uid());
 -- Validate both receipt scopes before inspecting MANUAL history: guessing a
 -- foreign receipt ID must not disclose whether that foreign receipt is MANUAL.
 if exists(select 1 from unnest(ids) x(id) where not exists(select 1 from public.uploaded_documents u where u.id=x.id and u.organization_id=org and u.project_id=project)) then raise exception 'DRAFT_DOCUMENT_SCOPE_DENIED' using errcode='42501';end if;
 -- A rebind locks old+new documents in deterministic UUID order. These are SQL
 -- transaction fences, not independently tested lock-wait/concurrency evidence.
 for doc in select distinct x.id from unnest(ids) x(id) where x.id is not null order by x.id loop
  perform cocal_manual_private.lock_document(org,project,doc);
  if exists(select 1 from public.extracted_document_drafts d where d.uploaded_document_id=doc and cocal_manual_private.is_manual(d.extraction_provider,d.raw_payload)) then raise exception 'MANUAL_DOCUMENT_BRANCH_FORBIDDEN' using errcode='42501';end if;
 end loop;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;

-- Private operation authority. The old mutable audit table is not replay proof.
create table cocal_manual_private.confirmation_requests(
 organization_id uuid not null,project_id uuid not null,request_id text not null,
 draft_id uuid not null,actor_user_id uuid not null,intent jsonb not null,result jsonb not null,
 calculation_snapshot jsonb,created_at timestamptz not null default clock_timestamp(),
 primary key(organization_id,project_id,request_id),unique(draft_id),
 check(length(btrim(request_id)) between 1 and 200)
);
alter table cocal_manual_private.confirmation_requests enable row level security;
revoke all on cocal_manual_private.confirmation_requests from public,anon,authenticated,service_role;

create function cocal_manual_private.confirmation_context(p_org uuid,p_project uuid,p_draft uuid,p_actor uuid)
returns public.extracted_document_drafts language plpgsql volatile security definer set search_path='' as $$
declare d public.extracted_document_drafts;first_doc uuid;
begin
 perform cocal_attachment_private.assert_write(p_org,p_project,p_actor);
 select * into d from public.extracted_document_drafts x where x.id=p_draft and x.organization_id=p_org and x.project_id=p_project;
 if not found then raise exception 'draft_not_found';end if;first_doc:=d.uploaded_document_id;
 perform cocal_manual_private.lock_document(p_org,p_project,first_doc);
 select * into d from public.extracted_document_drafts x where x.id=p_draft and x.organization_id=p_org and x.project_id=p_project for update;
 if not found or d.uploaded_document_id is distinct from first_doc then raise exception 'DRAFT_CONFIRMATION_SCOPE_CHANGED' using errcode='42501';end if;
 return d;
end;$$;
create function cocal_manual_private.require_confirmation_intent(p_request text,p_intent jsonb) returns void
language plpgsql immutable set search_path='' as $$
begin
 if p_request is null or length(btrim(p_request)) not between 1 and 200 or jsonb_typeof(p_intent) is distinct from 'object'
 or not(p_intent ?& array['decision','overrides']) or p_intent-array['decision','overrides']<>'{}'::jsonb
 or jsonb_typeof(p_intent->'decision') is distinct from 'string' or p_intent->>'decision' not in('confirmed','rejected') or jsonb_typeof(p_intent->'overrides') is distinct from 'object'
 then raise exception 'DRAFT_CONFIRMATION_INTENT_REQUIRED' using errcode='22023';end if;
end;$$;
create function cocal_manual_private.require_confirmation_ready(d public.extracted_document_drafts) returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 if cocal_manual_private.is_manual(d.extraction_provider,d.raw_payload) then raise exception 'MANUAL_CONFIRMATION_V2_REQUIRED' using errcode='42501';end if;
 -- A non-MANUAL side branch is still part of its receipt's MANUAL history.
 perform cocal_manual_private.assert_not_manual(d.uploaded_document_id);
 if not d.is_latest then raise exception 'DRAFT_CONFIRMATION_STALE';end if;
 if d.status not in('pending_review','needs_clarification') or exists(select 1 from cocal_manual_private.confirmation_requests q where q.draft_id=d.id)
 or exists(select 1 from public.emission_activities a where a.source_draft_id=d.id) then raise exception 'DRAFT_CONFIRMATION_ALREADY_PROCESSED';end if;
end;$$;
create function cocal_manual_private.confirmation_replay(q cocal_manual_private.confirmation_requests,d public.extracted_document_drafts) returns jsonb
language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare cid uuid:=(q.result->>'calculation_result_id')::uuid;aid uuid:=(q.result->>'emission_activity_id')::uuid;actual jsonb;
begin
 if d.status::text is distinct from q.result->>'draft_status' then raise exception 'DRAFT_CONFIRMATION_RESULT_CHANGED';end if;
 if q.result->>'draft_status'='confirmed' then
  if aid is null or cid is null or not exists(select 1 from public.emission_activities a where a.id=aid and a.organization_id=q.organization_id and a.project_id=q.project_id and a.source_document_id=d.uploaded_document_id and a.source_draft_id=d.id) then raise exception 'DRAFT_CONFIRMATION_RESULT_CHANGED';end if;
  select to_jsonb(c)-array['is_latest','updated_at'] into actual from public.calculation_results c where c.id=cid and c.organization_id=q.organization_id and c.project_id=q.project_id and c.emission_activity_id=aid;
  if not found or actual is distinct from q.calculation_snapshot then raise exception 'DRAFT_CONFIRMATION_RESULT_CHANGED';end if;
 elsif aid is not null or cid is not null then raise exception 'DRAFT_CONFIRMATION_RESULT_CHANGED';end if;
 return q.result||jsonb_build_object('operation_status','completed','replayed',true);
end;$$;

create function public.draft_confirmation_request(p_organization_id uuid,p_project_id uuid,p_draft_id uuid,p_actor_user_id uuid,p_request_id text,p_intent jsonb)
returns table(result jsonb) language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare d public.extracted_document_drafts;q cocal_manual_private.confirmation_requests;
begin
 d:=cocal_manual_private.confirmation_context(p_organization_id,p_project_id,p_draft_id,p_actor_user_id);
 perform cocal_manual_private.require_confirmation_intent(p_request_id,p_intent);
 select * into q from cocal_manual_private.confirmation_requests x where x.organization_id=p_organization_id and x.project_id=p_project_id and x.request_id=p_request_id;
 if found then
  if q.actor_user_id is distinct from p_actor_user_id or q.draft_id is distinct from p_draft_id or q.intent is distinct from p_intent then raise exception 'DRAFT_CONFIRMATION_INTENT_CONFLICT';end if;
  return query select cocal_manual_private.confirmation_replay(q,d);return;
 end if;
 perform cocal_manual_private.require_confirmation_ready(d);
 return query select jsonb_build_object('operation_status','not_found','replayed',false);
end;$$;

create function cocal_manual_private.confirmation_source(d public.extracted_document_drafts) returns jsonb
language sql stable set search_path='' set timezone='UTC' as $$select to_jsonb(d)-array['created_at','updated_at','reviewed_at','classified_at']$$;

create function public.commit_draft_confirmation(p_organization_id uuid,p_project_id uuid,p_draft_id uuid,p_actor_user_id uuid,p_request_id text,p_intent jsonb,p_emission_activity jsonb default null,p_calculation_result jsonb default null,p_expected_source jsonb default null)
returns table(result jsonb) language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare d public.extracted_document_drafts;q cocal_manual_private.confirmation_requests;answer record;activity jsonb;review_note text;calc_snapshot jsonb;response jsonb;project public.projects;
begin
 d:=cocal_manual_private.confirmation_context(p_organization_id,p_project_id,p_draft_id,p_actor_user_id);
 perform cocal_manual_private.require_confirmation_intent(p_request_id,p_intent);
 select * into q from cocal_manual_private.confirmation_requests x where x.organization_id=p_organization_id and x.project_id=p_project_id and x.request_id=p_request_id;
 if found then
  if q.actor_user_id is distinct from p_actor_user_id or q.draft_id is distinct from p_draft_id or q.intent is distinct from p_intent then raise exception 'DRAFT_CONFIRMATION_INTENT_CONFLICT';end if;
  return query select cocal_manual_private.confirmation_replay(q,d);return;
 end if;
 perform cocal_manual_private.require_confirmation_ready(d);
 if p_intent->>'decision'='confirmed' and p_expected_source is null then raise exception 'DRAFT_CONFIRMATION_SOURCE_REQUIRED';end if;
 if p_expected_source is not null and p_expected_source is distinct from cocal_manual_private.confirmation_source(d) then raise exception 'DRAFT_CONFIRMATION_SOURCE_CHANGED';end if;
 if p_intent->>'decision'='confirmed' then
  if jsonb_typeof(p_emission_activity) is distinct from 'object' or jsonb_typeof(p_calculation_result) is distinct from 'object' then raise exception 'DRAFT_CONFIRMATION_PAYLOAD_REQUIRED';end if;
  if(p_emission_activity ? 'organization_id' and p_emission_activity->>'organization_id' is distinct from p_organization_id::text)
  or(p_emission_activity ? 'project_id' and p_emission_activity->>'project_id' is distinct from p_project_id::text)
  or(p_emission_activity ? 'source_document_id' and p_emission_activity->>'source_document_id' is distinct from d.uploaded_document_id::text)
  or(p_emission_activity ? 'source_draft_id' and p_emission_activity->>'source_draft_id' is distinct from d.id::text) then raise exception 'DRAFT_CONFIRMATION_ACTIVITY_SCOPE_MISMATCH' using errcode='42501';end if;
  activity:=p_emission_activity||jsonb_build_object('organization_id',p_organization_id,'project_id',p_project_id,'source_document_id',d.uploaded_document_id,'source_draft_id',d.id,'activity_code','DRAFT-'||d.id::text);
 end if;
 review_note:=coalesce(nullif(p_intent->'overrides'->>'review_note',''),d.review_note);
 select * into answer from cocal_manual_private.confirm_draft_atomic(p_organization_id,p_project_id,p_draft_id,p_intent->>'decision',(p_intent->>'decision')::public.draft_status,review_note,clock_timestamp(),activity,p_calculation_result,p_actor_user_id,p_request_id);
 if answer.draft_id is null then raise exception 'DRAFT_CONFIRMATION_SAVE_UNCONFIRMED';end if;
 if answer.calculation_result_id is not null then
  select * into project from public.projects p where p.id=p_project_id and p.organization_id=p_organization_id;
  update public.emission_activities a set env=project.env,is_test=project.is_test where a.id=answer.emission_activity_id and(a.env,a.is_test) is distinct from(project.env,project.is_test);
  -- The provenance-only activity update invalidates old calculations as usual;
  -- restore only this newly inserted confirmation result, never an old result.
  update public.calculation_results c set env=project.env,is_test=project.is_test,is_latest=true where c.id=answer.calculation_result_id;
  select to_jsonb(c)-array['is_latest','updated_at'] into calc_snapshot from public.calculation_results c where c.id=answer.calculation_result_id;
 end if;
 response:=jsonb_build_object('draft_id',answer.draft_id,'emission_activity_id',answer.emission_activity_id,'calculation_result_id',answer.calculation_result_id,'draft_status',answer.draft_status,'inclusion_status',answer.inclusion_status,'operation_status','completed','replayed',false);
 insert into cocal_manual_private.confirmation_requests(organization_id,project_id,request_id,draft_id,actor_user_id,intent,result,calculation_snapshot) values(p_organization_id,p_project_id,p_request_id,p_draft_id,p_actor_user_id,p_intent,response,calc_snapshot);
 return query select response;
end;$$;

-- Preserve the old signature as a guarded adapter, not an untracked bypass.
-- Runtime-generated code/id/time and recalculated result data are not user intent.
create or replace function public.confirm_draft_atomic(p_organization_id uuid,p_project_id uuid,p_draft_id uuid,p_decision text,p_draft_status public.draft_status,p_draft_review_note text,p_draft_reviewed_at timestamptz,p_emission_activity jsonb default null,p_calculation_result jsonb default null,p_actor_user_id uuid default null,p_request_id text default null)
returns table(draft_id uuid,emission_activity_id uuid,calculation_result_id uuid,draft_status public.draft_status,inclusion_status public.inclusion_status) language plpgsql volatile security definer set search_path='' as $$
declare d public.extracted_document_drafts;intent jsonb;answer jsonb;
begin
 d:=cocal_manual_private.confirmation_context(p_organization_id,p_project_id,p_draft_id,p_actor_user_id);
 -- Preserve the explicit MANUAL error even for a legacy caller without request_id.
 if cocal_manual_private.is_manual(d.extraction_provider,d.raw_payload) then raise exception 'MANUAL_CONFIRMATION_V2_REQUIRED' using errcode='42501';end if;
 perform cocal_manual_private.assert_not_manual(d.uploaded_document_id);
 if p_decision is null or p_decision not in('confirmed','rejected') or p_draft_status::text is distinct from p_decision then raise exception 'DRAFT_CONFIRMATION_INTENT_REQUIRED' using errcode='22023';end if;
 intent:=jsonb_build_object('decision',p_decision,'overrides',(coalesce(p_emission_activity,'{}')-array['id','activity_code','created_at','updated_at','organization_id','project_id','source_document_id','source_draft_id','__source_snapshot'])||jsonb_build_object('review_note',p_draft_review_note));
 select r.result into answer from public.commit_draft_confirmation(p_organization_id,p_project_id,p_draft_id,p_actor_user_id,p_request_id,intent,p_emission_activity-'__source_snapshot',p_calculation_result,p_emission_activity->'__source_snapshot') r;
 return query select(answer->>'draft_id')::uuid,(answer->>'emission_activity_id')::uuid,(answer->>'calculation_result_id')::uuid,(answer->>'draft_status')::public.draft_status,(answer->>'inclusion_status')::public.inclusion_status;
end;$$;
revoke all on all functions in schema cocal_manual_private from public,anon,authenticated,service_role;
grant execute on function cocal_manual_private.receipt_can_delete(uuid),cocal_manual_private.original_can_delete(text,text) to authenticated;
revoke all on function public.draft_confirmation_request(uuid,uuid,uuid,uuid,text,jsonb),public.commit_draft_confirmation(uuid,uuid,uuid,uuid,text,jsonb,jsonb,jsonb,jsonb),public.confirm_draft_atomic(uuid,uuid,uuid,text,public.draft_status,text,timestamptz,jsonb,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.draft_confirmation_request(uuid,uuid,uuid,uuid,text,jsonb),public.commit_draft_confirmation(uuid,uuid,uuid,uuid,text,jsonb,jsonb,jsonb,jsonb),public.confirm_draft_atomic(uuid,uuid,uuid,text,public.draft_status,text,timestamptz,jsonb,jsonb,uuid,text) to service_role;
commit;
