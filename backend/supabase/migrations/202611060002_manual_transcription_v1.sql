-- Source candidate only. No cloud application authorized. Existing tables/JSON only.
create schema cocal_manual_private;
revoke all on schema cocal_manual_private from public,anon,authenticated;

create function cocal_manual_private.protect_manual_draft() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user not in ('authenticated','anon') then if tg_op='DELETE' then return old; else return new; end if; end if;
 if (tg_op<>'INSERT' and (coalesce(old.extraction_provider,'') ~* '^manual([_-]|$)' or old.raw_payload ? 'manual_transcription'))
 or (tg_op<>'DELETE' and (coalesce(new.extraction_provider,'') ~* '^manual([_-]|$)' or new.raw_payload ? 'manual_transcription')) then
  raise exception 'Manual provenance is server-managed' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end;$$;
revoke all on function cocal_manual_private.protect_manual_draft() from public,anon,authenticated;
create trigger protect_manual_draft before insert or update or delete on extracted_document_drafts
 for each row execute function cocal_manual_private.protect_manual_draft();

-- Narrow source retention guards; AND with the entire existing policy chain.
-- They prevent a known pending manual receipt from losing bytes before cascade
-- reaches its protected draft. Cross-service races/atomic recovery remain OPEN.
create function cocal_manual_private.receipt_can_delete(doc_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.uploaded_documents u where u.id=doc_id
  and cocal_storage_private.org_access(u.organization_id,true)
  and not exists(select 1 from public.extracted_document_drafts d where d.uploaded_document_id=u.id
   and (coalesce(d.extraction_provider,'') ~* '^manual([_-]|$)' or d.raw_payload ? 'manual_transcription')));
$$;
create function cocal_manual_private.original_can_delete(bucket text,object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select case when bucket in ('documents','staging-receipts','staging-attachments') then
  cocal_storage_private.project_access(cocal_storage_private.project_id(bucket,object_name),true)
  and not exists(select 1 from public.uploaded_documents u join public.extracted_document_drafts d on d.uploaded_document_id=u.id
    where u.storage_bucket=bucket and u.storage_path=object_name
    and (coalesce(d.extraction_provider,'') ~* '^manual([_-]|$)' or d.raw_payload ? 'manual_transcription'))
  else true end;
$$;
revoke all on function cocal_manual_private.receipt_can_delete(uuid),cocal_manual_private.original_can_delete(text,text) from public,anon,authenticated;
grant usage on schema cocal_manual_private to authenticated;
grant execute on function cocal_manual_private.receipt_can_delete(uuid),cocal_manual_private.original_can_delete(text,text) to authenticated;
create policy manual_receipt_retention_guard on public.uploaded_documents as restrictive for delete to authenticated
 using(cocal_manual_private.receipt_can_delete(id));
create policy manual_original_retention_guard on storage.objects as restrictive for delete to authenticated
 using(cocal_manual_private.original_can_delete(bucket_id,name));

create function cocal_manual_private.require_scope(p_org uuid,p_project uuid,p_document uuid,p_actor uuid)
returns uploaded_documents language plpgsql security definer set search_path='' as $$
declare doc public.uploaded_documents; project public.projects; subscription public.subscriptions; effective text;
begin
 select * into project from public.projects p where p.id=p_project and p.organization_id=p_org for key share;
 if not found then raise exception 'manual_scope_denied' using errcode='42501'; end if;
 perform 1 from public.organizations o where o.id=p_org and o.status='active' for share;
 if not found then raise exception 'manual_organization_inactive' using errcode='42501'; end if;
 perform 1 from public.organization_members m where m.organization_id=p_org and m.user_id=p_actor and m.status='active' and m.role in ('owner','admin','editor') for share;
 if not found then raise exception 'manual_actor_denied' using errcode='42501'; end if;
 select * into subscription from public.subscriptions s where s.organization_id=p_org order by s.period_end desc,s.created_at desc,s.id limit 1 for share;
 if not found or now()<subscription.period_start then raise exception 'manual_subscription_readonly' using errcode='42501'; end if;
 effective:=subscription.status::text;
 if effective='active' and now()>subscription.period_end then
  if subscription.grace_until is not null and now()<=subscription.grace_until then effective:='grace_period';else effective:='readonly';end if;
 elsif effective='grace_period' and subscription.grace_until is not null and now()>subscription.grace_until then effective:='readonly';
 end if;
 if effective not in ('active','grace_period') then raise exception 'manual_subscription_readonly' using errcode='42501'; end if;
 select * into doc from public.uploaded_documents d where d.id=p_document and d.organization_id=p_org and d.project_id=p_project and d.status='active' for update;
 if not found then raise exception 'manual_document_missing_or_inactive' using errcode='42501'; end if;
 if cocal_storage_private.project_id(doc.storage_bucket,doc.storage_path) is distinct from p_project then raise exception 'manual_document_path_mismatch' using errcode='42501'; end if;
 perform 1 from storage.buckets b where b.id=doc.storage_bucket and b.public=false for share;
 if not found then raise exception 'manual_private_bucket_missing' using errcode='42501'; end if;
 perform 1 from storage.objects o where o.bucket_id=doc.storage_bucket and o.name=doc.storage_path for share;
 if not found then raise exception 'manual_original_missing' using errcode='42501'; end if;
 return doc;
end;$$;
revoke all on function cocal_manual_private.require_scope(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function cocal_manual_private.validate_input(p_input jsonb,p_project uuid) returns void
language plpgsql security definer set search_path='' as $$
declare required text[]:=array['activity_name','quantity','unit','activity_date','category','subcategory','activity_type','final_scope','inclusion_status','exclusion_reason','review_note','period_start','period_end','source_locator','source_text'];
 key text; q numeric; day date; first_day date; last_day date; project public.projects;
begin
 if jsonb_typeof(p_input) is distinct from 'object' or not(p_input ?& required) or p_input-required<>'{}'::jsonb then raise exception 'manual_explicit_input_required'; end if;
 foreach key in array array['activity_name','unit','activity_date','category','activity_type','inclusion_status','source_locator'] loop
  if jsonb_typeof(p_input->key) is distinct from 'string' or length(btrim(p_input->>key))=0 then raise exception 'manual_explicit_text_required: %',key; end if;
 end loop;
 foreach key in array array['subcategory','exclusion_reason','review_note','source_text'] loop
  if jsonb_typeof(p_input->key) not in ('null','string') then raise exception 'manual_invalid_optional_text'; end if;
 end loop;
 if jsonb_typeof(p_input->'quantity') is distinct from 'number' then raise exception 'manual_quantity_number_required'; end if;
 q:=(p_input->>'quantity')::numeric;
 if q<0 or q>=1000000000000 or q<>round(q,8) then raise exception 'manual_quantity_out_of_range'; end if;
 if p_input->>'unit' !~* '^(kwh|kw-h|wh|mwh|l|liter|liters|ml|kg|g|ton|tonne|km|m|m3)$' then raise exception 'manual_unsupported_unit'; end if;
 if p_input->>'inclusion_status' not in ('pending','included','excluded') or jsonb_typeof(p_input->'final_scope') not in ('null','number')
 or (jsonb_typeof(p_input->'final_scope')='number' and p_input->>'final_scope' not in ('1','2','3'))
 or (p_input->>'inclusion_status'='included' and jsonb_typeof(p_input->'final_scope')<>'number')
 or (p_input->>'inclusion_status'='excluded' and length(btrim(coalesce(p_input->>'exclusion_reason','')))=0) then raise exception 'manual_inclusion_scope_required'; end if;
 if p_input->>'activity_date' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'manual_activity_date_required'; end if;
 day:=(p_input->>'activity_date')::date;
 select * into project from public.projects p where p.id=p_project;
 if day<project.reporting_start_date or day>project.reporting_end_date then raise exception 'manual_activity_outside_project_period'; end if;
 if jsonb_typeof(p_input->'period_start') is distinct from jsonb_typeof(p_input->'period_end') or jsonb_typeof(p_input->'period_start') not in ('null','string') then raise exception 'manual_period_pair_required'; end if;
 if jsonb_typeof(p_input->'period_start')='string' then
  if p_input->>'period_start' !~ '^\d{4}-\d{2}-\d{2}$' or p_input->>'period_end' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'manual_period_date_required'; end if;
  first_day:=(p_input->>'period_start')::date;last_day:=(p_input->>'period_end')::date;
  if first_day>last_day or first_day<project.reporting_start_date or last_day>project.reporting_end_date then raise exception 'manual_period_outside_project_no_allocation'; end if;
 end if;
end;$$;
revoke all on function cocal_manual_private.validate_input(jsonb,uuid) from public,anon,authenticated,service_role;

create function create_manual_transcription_atomic(p_organization_id uuid,p_project_id uuid,p_document_id uuid,p_draft_id uuid,p_actor_user_id uuid,p_request_id text,p_transcription jsonb)
returns table(draft_data jsonb,replayed boolean) language plpgsql security definer set search_path='' as $$
declare doc public.uploaded_documents; draft public.extracted_document_drafts; stamp timestamptz:=clock_timestamp();
begin
 if p_draft_id is null or p_actor_user_id is null or p_request_id is null or length(btrim(p_request_id)) not between 1 and 200 then raise exception 'manual_fixed_identity_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('manual:'||p_document_id::text,0));
 doc:=cocal_manual_private.require_scope(p_organization_id,p_project_id,p_document_id,p_actor_user_id);
 perform cocal_manual_private.validate_input(p_transcription,p_project_id);
 select * into draft from public.extracted_document_drafts d where d.id=p_draft_id for update;
 if found then
  if draft.organization_id is distinct from p_organization_id or draft.project_id is distinct from p_project_id or draft.uploaded_document_id is distinct from p_document_id
  or draft.extraction_provider is distinct from 'MANUAL_TRANSCRIPTION_NO_OCR'
  or draft.raw_payload->'manual_transcription'->>'user_id' is distinct from p_actor_user_id::text
  or draft.raw_payload->'manual_transcription'->>'request_id' is distinct from p_request_id
  or draft.normalized_payload is distinct from p_transcription then raise exception 'manual_request_intent_conflict'; end if;
  return query select to_jsonb(draft),true;return;
 end if;
 if exists(select 1 from public.extracted_document_drafts d where d.uploaded_document_id=p_document_id and d.is_latest) then raise exception 'manual_document_latest_conflict'; end if;
 insert into public.extracted_document_drafts(id,organization_id,project_id,uploaded_document_id,extraction_provider,extraction_version,raw_payload,normalized_payload,status,classification_status,parsed_quantity,parsed_unit,suggested_activity_date,suggested_category,suggested_scope,review_note,is_latest,env,is_test)
 values(p_draft_id,p_organization_id,p_project_id,p_document_id,'MANUAL_TRANSCRIPTION_NO_OCR',1,jsonb_build_object('manual_transcription',jsonb_build_object('user_id',p_actor_user_id,'transcribed_at',stamp,'request_id',p_request_id,'mode','MANUAL_NO_OCR','input',p_transcription)),p_transcription,'pending_review','unclassified',(p_transcription->>'quantity')::numeric,p_transcription->>'unit',(p_transcription->>'activity_date')::date,p_transcription->>'category',(p_transcription->>'final_scope')::smallint,p_transcription->>'review_note',true,doc.env,doc.is_test)
 returning * into draft;
 insert into public.audit_logs(organization_id,project_id,actor_user_id,actor_type,action,entity_type,entity_id,status,metadata)
 values(p_organization_id,p_project_id,p_actor_user_id,'edge_function','create_manual_transcription_atomic','extracted_document_draft',draft.id,'recorded',jsonb_build_object('request_id',p_request_id,'document_id',p_document_id,'provider','MANUAL_TRANSCRIPTION_NO_OCR'));
 return query select to_jsonb(draft),false;
end;$$;
revoke all on function create_manual_transcription_atomic(uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function create_manual_transcription_atomic(uuid,uuid,uuid,uuid,uuid,text,jsonb) to service_role;

create function confirm_manual_draft_atomic_v2(p_organization_id uuid,p_project_id uuid,p_draft_id uuid,p_actor_user_id uuid,p_intent jsonb,p_calculation_result jsonb default null,p_normalized_quantity numeric default null,p_normalized_unit text default null)
returns table(draft_id uuid,emission_activity_id uuid,calculation_result_id uuid,draft_status public.draft_status,inclusion_status public.inclusion_status)
language plpgsql security definer set search_path='' as $$
declare draft public.extracted_document_drafts; doc public.uploaded_documents; x jsonb; prior jsonb; aid uuid; cid uuid; desired public.draft_status; inclusion public.inclusion_status;
begin
 select * into draft from public.extracted_document_drafts d where d.id=p_draft_id and d.organization_id=p_organization_id and d.project_id=p_project_id;
 if not found or draft.extraction_provider is distinct from 'MANUAL_TRANSCRIPTION_NO_OCR' then raise exception 'manual_draft_not_found'; end if;
 perform pg_advisory_xact_lock(hashtextextended('manual:'||draft.uploaded_document_id::text,0));
 doc:=cocal_manual_private.require_scope(p_organization_id,p_project_id,draft.uploaded_document_id,p_actor_user_id);
 select * into draft from public.extracted_document_drafts d where d.id=p_draft_id for update;
 if not draft.is_latest then raise exception 'manual_stale_draft'; end if;
 x:=draft.normalized_payload;perform cocal_manual_private.validate_input(x,p_project_id);
 if jsonb_typeof(p_intent) is distinct from 'object' or not(p_intent ?& array['decision','request_id','review_note']) or p_intent-array['decision','request_id','review_note']<>'{}'::jsonb
 or p_intent->>'decision' not in ('confirmed','rejected') or length(btrim(coalesce(p_intent->>'request_id','')))=0 then raise exception 'manual_confirmation_intent_required'; end if;
 prior:=draft.raw_payload->'manual_transcription'->'confirmation';
 if prior is not null then
  if prior->>'actor_user_id' is distinct from p_actor_user_id::text or prior->'intent' is distinct from p_intent then raise exception 'manual_confirmation_intent_conflict'; end if;
  return query select draft.id,(prior->>'activity_id')::uuid,(prior->>'calculation_id')::uuid,draft.status,coalesce((prior->>'inclusion_status')::public.inclusion_status,'excluded');return;
 end if;
 if draft.status not in ('pending_review','needs_clarification') then raise exception 'manual_already_processed'; end if;
 desired:=case when p_intent->>'decision'='confirmed' then 'confirmed'::public.draft_status else 'rejected'::public.draft_status end;
 inclusion:='excluded';
 if desired='confirmed' then
  if p_calculation_result is null or jsonb_typeof(p_calculation_result) is distinct from 'object' or p_calculation_result->>'status' not in ('calculated','pending_factor','error','superseded') then raise exception 'manual_calculation_required'; end if;
  inclusion:=(x->>'inclusion_status')::public.inclusion_status;
  insert into public.emission_activities(organization_id,project_id,source_document_id,source_draft_id,activity_code,activity_name,activity_date,category,subcategory,activity_type,quantity,unit,normalized_quantity,normalized_unit,data_quality,inclusion_status,exclusion_reason,review_note,suggested_scope,final_scope,status,created_by_user_id,env,is_test)
  values(p_organization_id,p_project_id,doc.id,draft.id,'MANUAL-'||draft.id::text,x->>'activity_name',(x->>'activity_date')::date,x->>'category',x->>'subcategory',x->>'activity_type',(x->>'quantity')::numeric,x->>'unit',p_normalized_quantity,p_normalized_unit,'primary',inclusion,x->>'exclusion_reason',p_intent->>'review_note',(x->>'final_scope')::smallint,(x->>'final_scope')::smallint,'active',p_actor_user_id,doc.env,doc.is_test) returning id into aid;
  insert into public.calculation_results(organization_id,project_id,emission_activity_id,calc_version,status,is_latest,co2e_kg,co2_kg,ch4_kg,n2o_kg,factor_id,factor_snapshot,input_snapshot,formula_version,warnings,error_code,calculated_at,env,is_test)
  values(p_organization_id,p_project_id,aid,1,(p_calculation_result->>'status')::public.calculation_status,true,(p_calculation_result->>'co2e_kg')::numeric,(p_calculation_result->>'co2_kg')::numeric,(p_calculation_result->>'ch4_kg')::numeric,(p_calculation_result->>'n2o_kg')::numeric,(p_calculation_result->>'factor_id')::uuid,coalesce(p_calculation_result->'factor_snapshot','{}'),coalesce(p_calculation_result->'input_snapshot','{}'),coalesce(p_calculation_result->>'formula_version','v1.0.0'),coalesce(p_calculation_result->'warnings','[]'),p_calculation_result->>'error_code',coalesce((p_calculation_result->>'calculated_at')::timestamptz,clock_timestamp()),doc.env,doc.is_test) returning id into cid;
 end if;
 update public.extracted_document_drafts d set status=desired,review_note=p_intent->>'review_note',reviewed_by_user_id=p_actor_user_id,reviewed_at=clock_timestamp(),raw_payload=jsonb_set(d.raw_payload,'{manual_transcription,confirmation}',jsonb_build_object('actor_user_id',p_actor_user_id,'intent',p_intent,'activity_id',aid,'calculation_id',cid,'inclusion_status',inclusion,'confirmed_at',clock_timestamp())) where d.id=draft.id;
 insert into public.audit_logs(organization_id,project_id,actor_user_id,actor_type,action,entity_type,entity_id,status,metadata)
 values(p_organization_id,p_project_id,p_actor_user_id,'edge_function','confirm_manual_draft_atomic_v2','extracted_document_draft',draft.id,'recorded',jsonb_build_object('request_id',p_intent->>'request_id','activity_id',aid,'calculation_id',cid));
 return query select draft.id,aid,cid,desired,inclusion;
end;$$;
revoke all on function confirm_manual_draft_atomic_v2(uuid,uuid,uuid,uuid,jsonb,jsonb,numeric,text) from public,anon,authenticated;
grant execute on function confirm_manual_draft_atomic_v2(uuid,uuid,uuid,uuid,jsonb,jsonb,numeric,text) to service_role;
