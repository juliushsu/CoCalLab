-- SOURCE CANDIDATE ONLY. No cloud application. CTO four-P2 ruling, 2026-11-07.
begin;
-- The wrapper is the only public service entry. SECURITY DEFINER internal calls
-- retain owner execution; ordinary service-role calls to the old writers fail.
revoke all on function public.recalculate_project_atomic(uuid,uuid,uuid,jsonb,text),
 public.generate_report_atomic(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text)
 from public,anon,authenticated,service_role;

-- Preserve the dependency used by commit_recalculation_v2, but only as an
-- owner-callable implementation. New calculations inherit project provenance.
alter function public.recalculate_project_atomic(uuid,uuid,uuid,jsonb,text) set schema cocal_recalc_private;
create function public.recalculate_project_atomic(p_organization_id uuid,p_project_id uuid,p_actor_user_id uuid,p_calculation_results jsonb,p_request_id text default null)
returns table(project_id uuid,processed_activities integer,calculated_count integer,pending_factor_count integer,excluded_count integer,error_count integer) language plpgsql security definer set search_path='' as $$
declare result record;
begin
 select * into result from cocal_recalc_private.recalculate_project_atomic(p_organization_id,p_project_id,p_actor_user_id,p_calculation_results,p_request_id);
 update public.calculation_results c set env=p.env,is_test=p.is_test from public.projects p
 where p.id=p_project_id and p.organization_id=p_organization_id and c.organization_id=p_organization_id and c.project_id=p_project_id and c.is_latest
 and c.emission_activity_id in(select (x->>'emission_activity_id')::uuid from jsonb_array_elements(p_calculation_results) x);
 return query select result.project_id,result.processed_activities,result.calculated_count,result.pending_factor_count,result.excluded_count,result.error_count;
end;$$;
revoke all on function public.recalculate_project_atomic(uuid,uuid,uuid,jsonb,text) from public,anon,authenticated,service_role;

-- Small operational request binding; user-writable audit is never authority.
create table cocal_recalc_private.activity_requests(
 organization_id uuid not null,project_id uuid not null,request_id text not null,
 activity_id uuid not null,actor_user_id uuid not null,input jsonb not null,saved_row jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(organization_id,project_id,request_id)
);
alter table cocal_recalc_private.activity_requests enable row level security;
revoke all on cocal_recalc_private.activity_requests from public,anon,authenticated,service_role;

create function cocal_recalc_private.server_write_only() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user is distinct from pg_get_userbyid((select c.relowner from pg_class c where c.oid=tg_relid)) then
  raise exception 'CONTROLLED_ACTIVITY_OR_CALCULATION_REQUIRED' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
create trigger activity_server_write_only before insert or update or delete on public.emission_activities for each row execute function cocal_recalc_private.server_write_only();
create trigger calculation_server_write_only before insert or update or delete on public.calculation_results for each row execute function cocal_recalc_private.server_write_only();
create policy activity_insert_controlled on public.emission_activities as restrictive for insert to public with check(false);
create policy activity_update_controlled on public.emission_activities as restrictive for update to public using(false) with check(false);
create policy activity_delete_controlled on public.emission_activities as restrictive for delete to public using(false);
create policy calculation_insert_controlled on public.calculation_results as restrictive for insert to public with check(false);
create policy calculation_update_controlled on public.calculation_results as restrictive for update to public using(false) with check(false);
create policy calculation_delete_controlled on public.calculation_results as restrictive for delete to public using(false);

create function cocal_recalc_private.invalidate_activity_calculations() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- No history is deleted. Inputs/replay retain old authority but become stale.
 update public.calculation_results c set is_latest=false where c.organization_id=coalesce(new.organization_id,old.organization_id) and c.project_id=coalesce(new.project_id,old.project_id) and c.is_latest;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
create trigger activity_invalidate_calculations after insert or update or delete on public.emission_activities for each row execute function cocal_recalc_private.invalidate_activity_calculations();

create function public.save_manual_activity_atomic(p_organization_id uuid,p_project_id uuid,p_actor_user_id uuid,p_activity_id uuid,p_input jsonb,p_request_id text)
returns table(activity_data jsonb,replayed boolean) language plpgsql security definer set search_path='' as $$
declare prior cocal_recalc_private.activity_requests; saved public.emission_activities; existed boolean; d date; v_quantity numeric; project_row public.projects;
 allowed text[]:=array['activity_name','activity_date','category','subcategory','activity_type','quantity','unit','data_quality','inclusion_status','exclusion_reason','review_note','final_scope','status'];
begin
 perform cocal_recalc_private.require_scope(p_organization_id,p_project_id,p_actor_user_id);
 select * into project_row from public.projects p where p.id=p_project_id and p.organization_id=p_organization_id;
 if p_activity_id is null or p_request_id is null or length(btrim(p_request_id)) not between 1 and 200 or jsonb_typeof(p_input) is distinct from 'object'
 or p_input-allowed<>'{}'::jsonb or not(p_input ?& array['activity_name','activity_date','category','activity_type','quantity','unit','inclusion_status','final_scope'])
 then raise exception 'ACTIVITY_INPUT_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('activity-request:'||p_organization_id::text||':'||p_project_id::text||':'||p_request_id,0));
 select * into prior from cocal_recalc_private.activity_requests q where q.organization_id=p_organization_id and q.project_id=p_project_id and q.request_id=p_request_id;
 if found then
  if prior.activity_id is distinct from p_activity_id or prior.actor_user_id is distinct from p_actor_user_id or prior.input is distinct from p_input then raise exception 'ACTIVITY_REQUEST_INTENT_CONFLICT';end if;
  select * into saved from public.emission_activities a where a.id=p_activity_id and a.organization_id=p_organization_id and a.project_id=p_project_id;
  if not found or to_jsonb(saved) is distinct from prior.saved_row then raise exception 'ACTIVITY_REQUEST_RESULT_CHANGED';end if;
  return query select prior.saved_row,true;return;
 end if;
 if jsonb_typeof(p_input->'quantity') is distinct from 'number' then raise exception 'ACTIVITY_INPUT_INVALID' using errcode='22023';end if;
 v_quantity:=(p_input->>'quantity')::numeric;
 if v_quantity<0 or v_quantity>=1000000000000 or v_quantity<>round(v_quantity,8)
 or exists(select 1 from unnest(array['activity_name','activity_date','category','activity_type','unit']) k where jsonb_typeof(p_input->k) is distinct from 'string' or length(btrim(p_input->>k))=0)
 or p_input->>'activity_date' !~ '^\d{4}-\d{2}-\d{2}$'
 or p_input->>'inclusion_status' not in ('pending','included','excluded')
 or jsonb_typeof(p_input->'final_scope') not in ('null','number') or(jsonb_typeof(p_input->'final_scope')='number' and p_input->>'final_scope' not in('1','2','3'))
 or(p_input->>'inclusion_status'='included' and jsonb_typeof(p_input->'final_scope')<>'number')
 or(p_input->>'inclusion_status'='excluded' and length(btrim(coalesce(p_input->>'exclusion_reason','')))=0)
 or coalesce(p_input->>'status','active') not in ('active','archived') then raise exception 'ACTIVITY_INPUT_INVALID' using errcode='22023';end if;
 d:=(p_input->>'activity_date')::date;
 if not exists(select 1 from public.projects p where p.id=p_project_id and d between p.reporting_start_date and p.reporting_end_date) then raise exception 'ACTIVITY_INPUT_INVALID' using errcode='22023';end if;
 select * into saved from public.emission_activities a where a.id=p_activity_id for update;existed:=found;
 if existed and(saved.organization_id is distinct from p_organization_id or saved.project_id is distinct from p_project_id) then raise exception 'ACTIVITY_SCOPE_DENIED' using errcode='42501';end if;
 -- Source-linked activities are changed only through their document-review path.
 if existed and(saved.source_document_id is not null or saved.source_draft_id is not null) then raise exception 'ACTIVITY_SOURCE_RETAINED' using errcode='42501';end if;
 if existed then
  update public.emission_activities a set activity_name=p_input->>'activity_name',activity_date=d,category=p_input->>'category',subcategory=p_input->>'subcategory',activity_type=p_input->>'activity_type',quantity=v_quantity,unit=p_input->>'unit',normalized_quantity=null,normalized_unit=null,data_quality=coalesce(p_input->>'data_quality','primary'),inclusion_status=(p_input->>'inclusion_status')::public.inclusion_status,exclusion_reason=p_input->>'exclusion_reason',review_note=p_input->>'review_note',final_scope=(p_input->>'final_scope')::smallint,suggested_scope=(p_input->>'final_scope')::smallint,status=(coalesce(p_input->>'status','active'))::public.activity_status where a.id=p_activity_id returning * into saved;
 else
  insert into public.emission_activities(id,organization_id,project_id,activity_code,activity_name,activity_date,category,subcategory,activity_type,quantity,unit,data_quality,inclusion_status,exclusion_reason,review_note,final_scope,suggested_scope,status,created_by_user_id,env,is_test)
  values(p_activity_id,p_organization_id,p_project_id,'MANUAL-'||p_activity_id::text,p_input->>'activity_name',d,p_input->>'category',p_input->>'subcategory',p_input->>'activity_type',v_quantity,p_input->>'unit',coalesce(p_input->>'data_quality','primary'),(p_input->>'inclusion_status')::public.inclusion_status,p_input->>'exclusion_reason',p_input->>'review_note',(p_input->>'final_scope')::smallint,(p_input->>'final_scope')::smallint,(coalesce(p_input->>'status','active'))::public.activity_status,p_actor_user_id,project_row.env,project_row.is_test) returning * into saved;
 end if;
 insert into cocal_recalc_private.activity_requests(organization_id,project_id,request_id,activity_id,actor_user_id,input,saved_row) values(p_organization_id,p_project_id,p_request_id,p_activity_id,p_actor_user_id,p_input,to_jsonb(saved));
 insert into public.audit_logs(organization_id,project_id,actor_user_id,actor_type,action,entity_type,entity_id,status,metadata) values(p_organization_id,p_project_id,p_actor_user_id,'edge_function','save_manual_activity_atomic','emission_activity',p_activity_id,'recorded',jsonb_build_object('request_id',p_request_id,'operation',case when existed then 'update' else 'insert' end,'calculations_invalidated',true));
 return query select to_jsonb(saved),false;
end;$$;

-- A draft/receipt edit must stale authority even when activity quantity is unchanged.
alter function cocal_recalc_private.inputs(uuid,uuid) rename to inputs_v1;
create function cocal_recalc_private.inputs(p_org uuid,p_project uuid) returns jsonb language sql volatile security definer set search_path='' set timezone='UTC' as $$
 select cocal_recalc_private.inputs_v1(p_org,p_project)||jsonb_build_object('sources',jsonb_build_object(
 'documents',coalesce((select jsonb_agg(to_jsonb(u) order by u.id) from public.uploaded_documents u where u.id in(select a.source_document_id from public.emission_activities a where a.organization_id=p_org and a.project_id=p_project and a.status='active')),'[]'),
 'drafts',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from public.extracted_document_drafts d where d.id in(select a.source_draft_id from public.emission_activities a where a.organization_id=p_org and a.project_id=p_project and a.status='active')),'[]')));
$$;
alter function public.commit_recalculation_v2(uuid,uuid,uuid,text,boolean,text,jsonb,jsonb) set timezone='UTC';
alter function cocal_recalc_private.response(cocal_recalc_private.requests,jsonb,boolean) set timezone='UTC';
create function cocal_recalc_private.trusted_inputs(p_org uuid,p_project uuid) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare r cocal_recalc_private.requests; fresh jsonb; answer jsonb; activities jsonb; calculations jsonb;
begin
 fresh:=cocal_recalc_private.inputs(p_org,p_project);
 select * into r from cocal_recalc_private.requests q where q.organization_id=p_org and q.project_id=p_project and q.saved_result is not null order by q.completion_order desc limit 1;
 if not found then raise exception 'CALCULATION_AUTHORITY_REQUIRED';end if;
 answer:=cocal_recalc_private.response(r,fresh,false);
 if not (answer->>'input_matches_current')::boolean or not (answer->>'results_are_latest')::boolean then raise exception 'CALCULATION_AUTHORITY_STALE';end if;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') into activities from public.emission_activities a where a.organization_id=p_org and a.project_id=p_project and a.status='active';
 select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') into calculations from public.calculation_results c where c.organization_id=p_org and c.project_id=p_project and c.is_latest;
 if calculations is distinct from r.result_snapshot then raise exception 'CALCULATION_AUTHORITY_STALE';end if;
 if exists(select 1 from public.emission_activities a where a.organization_id=p_org and a.project_id=p_project and a.status='active' and
  ((a.source_document_id is not null and not exists(select 1 from public.uploaded_documents u where u.id=a.source_document_id and u.organization_id=p_org and u.project_id=p_project and u.status='active' and u.deletion_state='active'))
   or(a.source_draft_id is not null and not exists(select 1 from public.extracted_document_drafts d where d.id=a.source_draft_id and d.organization_id=p_org and d.project_id=p_project and d.is_latest and d.status='confirmed' and d.uploaded_document_id is not distinct from a.source_document_id)))) then raise exception 'REPORT_SOURCE_INVALID';end if;
 return jsonb_build_object('activities',activities,'calculation_results',calculations,'factors',fresh->'factors','calculation_authority',jsonb_build_object('request_id',r.request_id,'completion_order',r.completion_order));
end;$$;
create function public.report_calculation_inputs(p_organization_id uuid,p_project_id uuid,p_actor_user_id uuid) returns table(result jsonb) language plpgsql security definer set search_path='' as $$
begin perform cocal_recalc_private.require_scope(p_organization_id,p_project_id,p_actor_user_id);return query select cocal_recalc_private.trusted_inputs(p_organization_id,p_project_id);end;$$;

-- Freeze the current v1 field set explicitly, preserving historical v1 proofs.
-- A future unrelated column must not silently become part of either contract.
create or replace function cocal_report_private.row_snapshot(p_row public.report_generations) returns jsonb language sql stable security definer set search_path='' set timezone='UTC' as $$
 select jsonb_object_agg(key,value) from jsonb_each(to_jsonb($1)) where key=any(array[
 'id','organization_id','project_id','generated_by_user_id','status','report_version','payload','payload_hash','reporting_period_start','reporting_period_end','included_activity_count','excluded_activity_count','pending_activity_count','scope_totals','category_totals','factor_sources','warning_count','based_on_calculated_at','error_message','created_at','updated_at','is_test','env','gross_emissions_snapshot','adjustment_summary','claim_results','adjustment_manifest','claim_purpose','legal_entity_snapshot','site_snapshot','boundary_snapshot','integrity_status']);
$$;
create function cocal_report_private.row_snapshot_v2(p_row public.report_generations) returns jsonb language sql stable security definer set search_path='' set timezone='UTC' as $$select cocal_report_private.row_snapshot($1)$$;
-- Keep the already checked v1 verifier implementation, do not re-attest old rows.
alter function cocal_report_private.verified_row(uuid,uuid,uuid) rename to verified_row_v1;
create function cocal_report_private.verified_row(p_org uuid,p_project uuid,p_report uuid) returns public.report_generations language plpgsql security definer set search_path='' as $$
declare saved public.report_generations;proof cocal_report_private.snapshots;
begin
 select * into proof from cocal_report_private.snapshots s where s.report_id=p_report and s.organization_id=p_org and s.project_id=p_project;
 if not found or proof.contract_version='20261107.report.1' then return cocal_report_private.verified_row_v1(p_org,p_project,p_report);end if;
 select * into saved from public.report_generations r where r.id=p_report and r.organization_id=p_org and r.project_id=p_project for share;
 if not found or proof.contract_version<>'20261107.report.2' or saved.integrity_status<>'server_verified' or saved.status<>'completed'
 or cocal_report_private.row_snapshot_v2(saved) is distinct from proof.row_snapshot
 or not exists(select 1 from public.report_snapshot_requests_v2 q where q.organization_id=p_org and q.project_id=p_project and q.request_id=proof.request_id and q.actor_user_id=proof.actor_user_id and q.report_version=proof.report_version and q.claim_purpose::text=proof.claim_purpose and q.report_generation_id=p_report) then raise exception 'REPORT_SNAPSHOT_INTEGRITY_MISMATCH';end if;return saved;
end;$$;
alter function public.generate_report_snapshot_atomic_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb) rename to publish_sealed_v1;
alter function public.publish_sealed_v1(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb) set schema cocal_report_private;
create function public.generate_report_snapshot_atomic_v2(p_organization_id uuid,p_project_id uuid,p_generated_by_user_id uuid,p_report_version integer,p_payload jsonb,p_payload_hash text,p_reporting_period_start date,p_reporting_period_end date,p_included_activity_count integer,p_excluded_activity_count integer,p_pending_activity_count integer,p_scope_totals jsonb,p_category_totals jsonb,p_factor_sources jsonb,p_warning_count integer,p_based_on_calculated_at timestamptz,p_request_id text default null,p_snapshot jsonb default null)
returns table(report_generation_id uuid,status public.report_status) language plpgsql security definer set search_path='' as $$
declare inputs jsonb; expected jsonb; actual jsonb;saved_id uuid;saved public.report_generations;
begin
 perform cocal_recalc_private.require_scope(p_organization_id,p_project_id,p_generated_by_user_id);
 -- Existing idempotent report requests remain their original historical snapshot.
 if not exists(select 1 from cocal_report_private.snapshots s where s.organization_id=p_organization_id and s.project_id=p_project_id and s.request_id=p_request_id) then
  lock table public.emission_activities,public.emission_factors in share mode;
  inputs:=cocal_recalc_private.trusted_inputs(p_organization_id,p_project_id);
  if p_snapshot->'calculation_authority' is distinct from inputs->'calculation_authority' then raise exception 'REPORT_CALCULATION_AUTHORITY_MISMATCH';end if;
  select coalesce(jsonb_agg(jsonb_build_object('emission_activity_id',a->'id','source_document_id',a->'source_document_id','source_draft_id',a->'source_draft_id','calculation_result_id',c->'id') order by a->>'id'),'[]') into expected from jsonb_array_elements(inputs->'activities') a join jsonb_array_elements(inputs->'calculation_results') c on c->>'emission_activity_id'=a->>'id';
  if jsonb_typeof(p_payload->'appendix_mappings') is distinct from 'array' then raise exception 'REPORT_SOURCE_MAPPING_MISMATCH';end if;
  select coalesce(jsonb_agg(jsonb_build_object('emission_activity_id',x->'emission_activity_id','source_document_id',x->'source_document_id','source_draft_id',x->'source_draft_id','calculation_result_id',x->'calculation_result_id') order by x->>'emission_activity_id'),'[]') into actual from jsonb_array_elements(p_payload->'appendix_mappings') x;
  if actual is distinct from expected then raise exception 'REPORT_SOURCE_MAPPING_MISMATCH';end if;
 end if;
 select r.report_generation_id into saved_id from cocal_report_private.publish_sealed_v1(p_organization_id,p_project_id,p_generated_by_user_id,p_report_version,p_payload,p_payload_hash,p_reporting_period_start,p_reporting_period_end,p_included_activity_count,p_excluded_activity_count,p_pending_activity_count,p_scope_totals,p_category_totals,p_factor_sources,p_warning_count,p_based_on_calculated_at,p_request_id,p_snapshot) r;
 select * into saved from public.report_generations r where r.id=saved_id;
 -- Only a newly created proof uses v2; old requests are never re-signed.
 if inputs is not null then update public.report_generations r set env=p.env,is_test=p.is_test from public.projects p where r.id=saved_id and p.id=p_project_id and p.organization_id=p_organization_id returning r.* into saved;
 update cocal_report_private.snapshots s set contract_version='20261107.report.2',row_snapshot=cocal_report_private.row_snapshot_v2(saved) where s.report_id=saved_id;end if;
 saved:=cocal_report_private.verified_row(p_organization_id,p_project_id,saved_id);
 return query select saved.id,saved.status;
end;$$;
alter function public.save_manual_activity_atomic(uuid,uuid,uuid,uuid,jsonb,text) set timezone='UTC';
revoke all on all functions in schema cocal_recalc_private,cocal_report_private from public,anon,authenticated,service_role;
revoke all on function public.save_manual_activity_atomic(uuid,uuid,uuid,uuid,jsonb,text),public.report_calculation_inputs(uuid,uuid,uuid),public.generate_report_snapshot_atomic_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_manual_activity_atomic(uuid,uuid,uuid,uuid,jsonb,text),public.report_calculation_inputs(uuid,uuid,uuid),public.generate_report_snapshot_atomic_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb) to service_role;
commit;
