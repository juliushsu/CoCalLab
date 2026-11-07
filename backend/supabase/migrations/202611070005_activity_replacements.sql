-- SOURCE CANDIDATE ONLY. N3 is a local version/replacement flow, not cloud apply.
begin;
create schema cocal_activity_private;
revoke all on schema cocal_activity_private from public,anon,authenticated,service_role;
create table cocal_activity_private.replacements(
 organization_id uuid not null,project_id uuid not null,request_id text not null,
 actor_user_id uuid not null,predecessor_activity_id uuid not null unique references public.emission_activities(id) deferrable initially deferred,
 activity_id uuid not null unique references public.emission_activities(id) deferrable initially deferred,
 mode text not null check(mode in('correct','exclude')),reason text not null check(length(btrim(reason)) between 1 and 2000),
 request_input jsonb not null,canonical_input jsonb not null,saved_result jsonb,activity_snapshot jsonb,
 created_at timestamptz not null default clock_timestamp(),primary key(organization_id,project_id,request_id),
 check(predecessor_activity_id<>activity_id),check(length(btrim(request_id)) between 1 and 200)
);
alter table cocal_activity_private.replacements enable row level security;
revoke all on cocal_activity_private.replacements from public,anon,authenticated,service_role;

create function cocal_activity_private.is_effective(p_id uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select not exists(select 1 from cocal_activity_private.replacements r where r.predecessor_activity_id=p_id);
$$;
-- Bounded public predicate for invoker-security views. No private-schema USAGE
-- or private-table SELECT is granted. Unknown/foreign IDs reveal only false.
create function public.activity_is_effective(p_organization_id uuid,p_project_id uuid,p_activity_id uuid) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare caller text:=coalesce(current_setting('role',true),'none');
begin
 if caller<>'service_role' and not(caller='none' and session_user=pg_get_userbyid((select c.relowner from pg_class c where c.oid='public.emission_activities'::regclass)))
 and not cocal_storage_private.org_access(p_organization_id,false) then return false;end if;
 return exists(select 1 from public.emission_activities a where a.id=p_activity_id and a.organization_id=p_organization_id and a.project_id=p_project_id and a.status='active' and cocal_activity_private.is_effective(a.id));
end;$$;
revoke all on function public.activity_is_effective(uuid,uuid,uuid) from public,anon;
grant execute on function public.activity_is_effective(uuid,uuid,uuid) to authenticated,service_role;
create view public.effective_emission_activities with(security_invoker=true) as
 select a.* from public.emission_activities a where a.status='active' and public.activity_is_effective(a.organization_id,a.project_id,a.id);
create view public.effective_calculation_results with(security_invoker=true) as
 select c.* from public.calculation_results c join public.effective_emission_activities a on a.id=c.emission_activity_id and a.organization_id=c.organization_id and a.project_id=c.project_id where c.is_latest;
revoke all on public.effective_emission_activities,public.effective_calculation_results from public,anon,authenticated,service_role;
grant select on public.effective_emission_activities,public.effective_calculation_results to authenticated,service_role;

create function cocal_activity_private.protect_activity_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from cocal_activity_private.replacements r where r.predecessor_activity_id=old.id or r.activity_id=old.id) then raise exception 'ACTIVITY_VERSION_RETAINED' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
create trigger retained_activity_version before update or delete on public.emission_activities for each row execute function cocal_activity_private.protect_activity_version();
create function cocal_activity_private.protect_retired_calculation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from cocal_activity_private.replacements r where r.predecessor_activity_id=old.emission_activity_id) then raise exception 'RETIRED_ACTIVITY_CALCULATION_RETAINED' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
create trigger retained_activity_calculation before update or delete on public.calculation_results for each row execute function cocal_activity_private.protect_retired_calculation();

create or replace function cocal_recalc_private.invalidate_activity_calculations() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- A replacement relation is inserted BEFORE its successor activity. Therefore
 -- retired predecessor rows are already out of this set when INSERT fires.
 update public.calculation_results c set is_latest=false
 where c.organization_id=coalesce(new.organization_id,old.organization_id) and c.project_id=coalesce(new.project_id,old.project_id) and c.is_latest
 and cocal_activity_private.is_effective(c.emission_activity_id);
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;

create function cocal_activity_private.canonical_input(p_mode text,p_input jsonb,p_reason text,p_old public.emission_activities)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare value jsonb;allowed text[]:=array['activity_name','activity_date','category','subcategory','activity_type','quantity','unit','data_quality','inclusion_status','exclusion_reason','review_note','final_scope','status'];q numeric;day date;k text;
begin
 if jsonb_typeof(p_input) is distinct from 'object' or p_input-allowed<>'{}'::jsonb then raise exception 'ACTIVITY_REPLACEMENT_INPUT_INVALID' using errcode='22023';end if;
 select jsonb_object_agg(key,val) into value from jsonb_each(to_jsonb(p_old)) e(key,val) where key=any(allowed);
 if p_mode='exclude' then
  if p_input<>'{}'::jsonb then raise exception 'ACTIVITY_REPLACEMENT_EXCLUDE_INPUT_MUST_BE_EMPTY' using errcode='22023';end if;
  if jsonb_typeof(value->'quantity') is distinct from 'number' or length(btrim(coalesce(value->>'unit','')))=0 then raise exception 'ACTIVITY_REPLACEMENT_INPUT_INVALID' using errcode='22023';end if;
  return value||jsonb_build_object('inclusion_status','excluded','exclusion_reason',p_reason,'status','active');
 end if;
 if p_mode<>'correct' or not(p_input ?& array['activity_name','activity_date','category','activity_type','quantity','unit','inclusion_status','final_scope']) then raise exception 'ACTIVITY_REPLACEMENT_INPUT_INVALID' using errcode='22023';end if;
 value:=value||p_input||jsonb_build_object('status','active');
 if p_input ? 'status' and p_input->>'status' is distinct from 'active' then raise exception 'ACTIVITY_REPLACEMENT_INPUT_INVALID' using errcode='22023';end if;
 if value->>'inclusion_status'='excluded' then raise exception 'ACTIVITY_REPLACEMENT_USE_EXCLUDE_MODE' using errcode='22023';end if;
 if value->>'inclusion_status' not in('pending','included') or jsonb_typeof(value->'quantity') is distinct from 'number' then raise exception 'ACTIVITY_REPLACEMENT_INPUT_INVALID' using errcode='22023';end if;
 q:=(value->>'quantity')::numeric;
 if q<0 or q>=1000000000000 or q<>round(q,8) then raise exception 'ACTIVITY_REPLACEMENT_INPUT_INVALID' using errcode='22023';end if;
 foreach k in array array['activity_name','activity_date','category','activity_type','unit','data_quality'] loop
  if jsonb_typeof(value->k) is distinct from 'string' or length(btrim(value->>k))=0 then raise exception 'ACTIVITY_REPLACEMENT_INPUT_INVALID' using errcode='22023';end if;
 end loop;
 foreach k in array array['subcategory','exclusion_reason','review_note'] loop
  if jsonb_typeof(value->k) not in('string','null') then raise exception 'ACTIVITY_REPLACEMENT_INPUT_INVALID' using errcode='22023';end if;
 end loop;
 if value->>'activity_date' !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(value->'final_scope') not in('number','null')
 or(jsonb_typeof(value->'final_scope')='number' and value->>'final_scope' not in('1','2','3'))
 or(value->>'inclusion_status'='included' and jsonb_typeof(value->'final_scope')<>'number') then raise exception 'ACTIVITY_REPLACEMENT_INPUT_INVALID' using errcode='22023';end if;
 day:=(value->>'activity_date')::date;
 if not exists(select 1 from public.projects p where p.id=p_old.project_id and p.organization_id=p_old.organization_id and day between p.reporting_start_date and p.reporting_end_date) then raise exception 'ACTIVITY_REPLACEMENT_INPUT_INVALID' using errcode='22023';end if;
 return value;
end;$$;

create function cocal_activity_private.require_source(p_old public.emission_activities) returns void language plpgsql volatile security definer set search_path='' as $$
declare doc public.uploaded_documents;draft public.extracted_document_drafts;
begin
 if p_old.source_document_id is null and p_old.source_draft_id is null then return;end if;
 if p_old.source_document_id is null or p_old.source_draft_id is null then raise exception 'ACTIVITY_REPLACEMENT_SOURCE_INVALID' using errcode='42501';end if;
 doc:=cocal_manual_private.lock_document(p_old.organization_id,p_old.project_id,p_old.source_document_id);
 select * into draft from public.extracted_document_drafts d where d.id=p_old.source_draft_id and d.uploaded_document_id=doc.id and d.organization_id=p_old.organization_id and d.project_id=p_old.project_id and d.is_latest and d.status='confirmed' for share;
 if not found then raise exception 'ACTIVITY_REPLACEMENT_SOURCE_INVALID' using errcode='42501';end if;
 -- No legacy receipt is upgraded. New source-linked revisions require the
 -- existing server verification authority and still-matching private original.
 perform cocal_manual_private.require_verified_original(doc);
end;$$;
create function cocal_activity_private.recalculation_required(p_org uuid,p_project uuid) returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 perform cocal_recalc_private.trusted_inputs(p_org,p_project);return false;
 exception when raise_exception then
  if sqlerrm in('CALCULATION_AUTHORITY_REQUIRED','CALCULATION_AUTHORITY_STALE','REPORT_SOURCE_INVALID') then return true;end if;raise;
end;$$;
create function cocal_activity_private.response(q cocal_activity_private.replacements,p_replayed boolean) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare active boolean;current_row jsonb;projected jsonb;
begin
 select to_jsonb(a) into current_row from public.emission_activities a where a.id=q.activity_id and a.organization_id=q.organization_id and a.project_id=q.project_id;
 if not found or q.saved_result is null or q.activity_snapshot is null then raise exception 'ACTIVITY_REPLACEMENT_RESULT_MISSING';end if;
 select jsonb_object_agg(key,val) into projected from jsonb_each(current_row) x(key,val) where q.activity_snapshot ? key;
 if projected is distinct from q.activity_snapshot then raise exception 'ACTIVITY_REPLACEMENT_RESULT_CHANGED';end if;
 active:=cocal_activity_private.is_effective(q.activity_id) and current_row->>'status'='active';
 return q.saved_result||jsonb_build_object('replayed',p_replayed,'operation_status',case when active then 'completed' else 'historical' end,'is_effective',active,'recalculation_required',cocal_activity_private.recalculation_required(q.organization_id,q.project_id));
end;$$;

create function public.replace_emission_activity(p_organization_id uuid,p_project_id uuid,p_actor_user_id uuid,p_predecessor_activity_id uuid,p_request_id text,p_mode text,p_reason text,p_input jsonb,p_action text default 'lookup')
returns table(result jsonb) language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare old_row public.emission_activities;new_row public.emission_activities;q cocal_activity_private.replacements;value jsonb;new_id uuid;reason text:=btrim(p_reason);project public.projects;
begin
 perform cocal_recalc_private.require_scope(p_organization_id,p_project_id,p_actor_user_id);
 if p_predecessor_activity_id is null or p_request_id is null or length(btrim(p_request_id)) not between 1 and 200 or p_mode is null or p_mode not in('correct','exclude') or reason is null or length(reason) not between 1 and 2000 or p_action is null or p_action not in('lookup','replace') or jsonb_typeof(p_input) is distinct from 'object' then raise exception 'ACTIVITY_REPLACEMENT_INTENT_INVALID' using errcode='22023';end if;
 select * into q from cocal_activity_private.replacements r where r.organization_id=p_organization_id and r.project_id=p_project_id and r.request_id=p_request_id;
 if found then
  if q.actor_user_id is distinct from p_actor_user_id or q.predecessor_activity_id is distinct from p_predecessor_activity_id or q.mode is distinct from p_mode or q.reason is distinct from reason or q.request_input is distinct from p_input then raise exception 'ACTIVITY_REPLACEMENT_INTENT_CONFLICT';end if;
  return query select cocal_activity_private.response(q,true);return;
 end if;
 select * into old_row from public.emission_activities a where a.id=p_predecessor_activity_id and a.organization_id=p_organization_id and a.project_id=p_project_id for update;
 if not found then raise exception 'ACTIVITY_REPLACEMENT_SCOPE_DENIED' using errcode='42501';end if;
 if old_row.status<>'active' or not cocal_activity_private.is_effective(old_row.id) then raise exception 'ACTIVITY_REPLACEMENT_SUPERSEDED';end if;
 value:=cocal_activity_private.canonical_input(p_mode,p_input,reason,old_row);
 perform cocal_activity_private.require_source(old_row);
 if p_action='lookup' then return query select jsonb_build_object('organization_id',p_organization_id,'project_id',p_project_id,'predecessor_activity_id',p_predecessor_activity_id,'activity_id',null,'request_id',p_request_id,'mode',p_mode,'replayed',false,'operation_status','not_found','is_effective',false,'recalculation_required',null);return;end if;
 select * into project from public.projects p where p.id=p_project_id and p.organization_id=p_organization_id;
 new_id:=gen_random_uuid();
 -- Deferred FK permits the relation-first order. The INSERT's existing source
 -- invalidator now sees old_row as retired and cannot touch its historical calc.
 insert into cocal_activity_private.replacements(organization_id,project_id,request_id,actor_user_id,predecessor_activity_id,activity_id,mode,reason,request_input,canonical_input)
 values(p_organization_id,p_project_id,p_request_id,p_actor_user_id,old_row.id,new_id,p_mode,reason,p_input,value) returning * into q;
 insert into public.emission_activities(id,organization_id,project_id,source_document_id,source_draft_id,activity_code,activity_name,activity_date,category,subcategory,activity_type,quantity,unit,normalized_quantity,normalized_unit,data_quality,inclusion_status,exclusion_reason,review_note,suggested_scope,final_scope,confidence_score,status,created_by_user_id,env,is_test)
 values(new_id,p_organization_id,p_project_id,old_row.source_document_id,old_row.source_draft_id,'REVISION-'||new_id::text,value->>'activity_name',(value->>'activity_date')::date,value->>'category',value->>'subcategory',value->>'activity_type',(value->>'quantity')::numeric,value->>'unit',case when p_mode='exclude' then old_row.normalized_quantity else null end,case when p_mode='exclude' then old_row.normalized_unit else null end,value->>'data_quality',(value->>'inclusion_status')::public.inclusion_status,value->>'exclusion_reason',value->>'review_note',(value->>'final_scope')::smallint,(value->>'final_scope')::smallint,old_row.confidence_score,'active',p_actor_user_id,project.env,project.is_test) returning * into new_row;
 update cocal_activity_private.replacements r set saved_result=jsonb_build_object('organization_id',p_organization_id,'project_id',p_project_id,'predecessor_activity_id',old_row.id,'activity_id',new_id,'request_id',p_request_id,'mode',p_mode),activity_snapshot=to_jsonb(new_row)
 where r.organization_id=p_organization_id and r.project_id=p_project_id and r.request_id=p_request_id returning * into q;
 insert into public.audit_logs(organization_id,project_id,actor_user_id,actor_type,action,entity_type,entity_id,status,metadata)
 values(p_organization_id,p_project_id,p_actor_user_id,'edge_function','replace_emission_activity','emission_activity',new_id,'recorded',jsonb_build_object('request_id',p_request_id,'predecessor_activity_id',old_row.id,'mode',p_mode,'reason',reason,'recalculation_required',true));
 return query select cocal_activity_private.response(q,false);
end;$$;

create function public.activity_version_lineage(p_organization_id uuid,p_project_id uuid,p_activity_id uuid)
returns table(result jsonb) language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare caller text:=coalesce(current_setting('role',true),'none');root_id uuid;current_id uuid;edge cocal_activity_private.replacements;a public.emission_activities;incoming cocal_activity_private.replacements;nodes jsonb:='[]';step integer:=0;
begin
 if caller<>'service_role' and not(caller='none' and session_user=pg_get_userbyid((select c.relowner from pg_class c where c.oid='public.emission_activities'::regclass))) and not cocal_storage_private.org_access(p_organization_id,false) then return;end if;
 if not exists(select 1 from public.emission_activities x where x.id=p_activity_id and x.organization_id=p_organization_id and x.project_id=p_project_id) then return;end if;
 root_id:=p_activity_id;
 loop select * into edge from cocal_activity_private.replacements r where r.activity_id=root_id and r.organization_id=p_organization_id and r.project_id=p_project_id;exit when not found;root_id:=edge.predecessor_activity_id;step:=step+1;if step>10000 then raise exception 'ACTIVITY_LINEAGE_INVALID';end if;end loop;
 current_id:=root_id;step:=1;
 loop
  select * into a from public.emission_activities x where x.id=current_id and x.organization_id=p_organization_id and x.project_id=p_project_id;
  if not found then raise exception 'ACTIVITY_LINEAGE_INVALID';end if;
  select * into edge from cocal_activity_private.replacements r where r.predecessor_activity_id=current_id and r.organization_id=p_organization_id and r.project_id=p_project_id;
  nodes:=nodes||jsonb_build_array(jsonb_build_object('activity_id',a.id,'predecessor_activity_id',incoming.predecessor_activity_id,'successor_activity_id',edge.activity_id,'version_index',step,'is_effective',edge.activity_id is null and a.status='active','mode',coalesce(incoming.mode,'original'),'reason',incoming.reason,'actor_user_id',coalesce(incoming.actor_user_id,a.created_by_user_id),'created_at',coalesce(incoming.created_at,a.created_at)));
  exit when edge.activity_id is null;current_id:=edge.activity_id;incoming:=edge;step:=step+1;if step>10000 then raise exception 'ACTIVITY_LINEAGE_INVALID';end if;
 end loop;
 return query select jsonb_build_object('organization_id',p_organization_id,'project_id',p_project_id,'activity_id',p_activity_id,'versions',nodes);
end;$$;

-- One effective set feeds preparation, authority, reports and analytics.
create or replace function cocal_recalc_private.inputs_v1(p_org uuid,p_project uuid) returns jsonb
language sql volatile security definer set search_path='' as $$
 select jsonb_build_object('activities',coalesce((select jsonb_agg(jsonb_build_object(
  'id',a.id,'organization_id',a.organization_id,'project_id',a.project_id,'status',a.status,
  'quantity',a.quantity,'unit',a.unit,'activity_date',a.activity_date,'category',a.category,
  'subcategory',a.subcategory,'activity_type',a.activity_type,'inclusion_status',a.inclusion_status,
  'exclusion_reason',a.exclusion_reason,'final_scope',a.final_scope,'suggested_scope',a.suggested_scope,
  'source_document_id',a.source_document_id,'source_draft_id',a.source_draft_id) order by a.id)
  from public.emission_activities a where a.organization_id=p_org and a.project_id=p_project and a.status='active' and cocal_activity_private.is_effective(a.id)),'[]'::jsonb),
 'factors',coalesce((select jsonb_agg(to_jsonb(f)-array['created_at','updated_at','metadata'] order by f.id)
  from public.emission_factors f where f.status='active' and (f.organization_id=p_org or f.organization_id is null)),'[]'::jsonb));
$$;
create or replace function cocal_recalc_private.inputs(p_org uuid,p_project uuid) returns jsonb language sql volatile security definer set search_path='' set timezone='UTC' as $$
 select cocal_recalc_private.inputs_v1(p_org,p_project)||jsonb_build_object('sources',jsonb_build_object(
 'documents',coalesce((select jsonb_agg(to_jsonb(u) order by u.id) from public.uploaded_documents u where u.id in(select a.source_document_id from public.emission_activities a where a.organization_id=p_org and a.project_id=p_project and a.status='active' and cocal_activity_private.is_effective(a.id))),'[]'),
 'drafts',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from public.extracted_document_drafts d where d.id in(select a.source_draft_id from public.emission_activities a where a.organization_id=p_org and a.project_id=p_project and a.status='active' and cocal_activity_private.is_effective(a.id))),'[]')));
$$;
create or replace function cocal_recalc_private.trusted_inputs(p_org uuid,p_project uuid) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare r cocal_recalc_private.requests; fresh jsonb; answer jsonb; activities jsonb; calculations jsonb;
begin
 fresh:=cocal_recalc_private.inputs(p_org,p_project);
 select * into r from cocal_recalc_private.requests q where q.organization_id=p_org and q.project_id=p_project and q.saved_result is not null order by q.completion_order desc limit 1;
 if not found then raise exception 'CALCULATION_AUTHORITY_REQUIRED';end if;
 answer:=cocal_recalc_private.response(r,fresh,false);
 if not (answer->>'input_matches_current')::boolean or not (answer->>'results_are_latest')::boolean then raise exception 'CALCULATION_AUTHORITY_STALE';end if;
 select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') into activities from public.emission_activities a where a.organization_id=p_org and a.project_id=p_project and a.status='active' and cocal_activity_private.is_effective(a.id);
 select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') into calculations from public.calculation_results c where c.organization_id=p_org and c.project_id=p_project and c.is_latest and cocal_activity_private.is_effective(c.emission_activity_id);
 if calculations is distinct from r.result_snapshot then raise exception 'CALCULATION_AUTHORITY_STALE';end if;
 if exists(select 1 from public.emission_activities a where a.organization_id=p_org and a.project_id=p_project and a.status='active' and cocal_activity_private.is_effective(a.id) and
  ((a.source_document_id is not null and not exists(select 1 from public.uploaded_documents u where u.id=a.source_document_id and u.organization_id=p_org and u.project_id=p_project and u.status='active' and u.deletion_state='active'))
   or(a.source_draft_id is not null and not exists(select 1 from public.extracted_document_drafts d where d.id=a.source_draft_id and d.organization_id=p_org and d.project_id=p_project and d.is_latest and d.status='confirmed' and d.uploaded_document_id is not distinct from a.source_document_id)))) then raise exception 'REPORT_SOURCE_INVALID';end if;
 return jsonb_build_object('activities',activities,'calculation_results',calculations,'factors',fresh->'factors','calculation_authority',jsonb_build_object('request_id',r.request_id,'completion_order',r.completion_order));
end;$$;
create or replace function cocal_recalc_private.response(r cocal_recalc_private.requests,p_current jsonb,p_replayed boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare latest boolean; matches boolean;
begin
 matches:=r.input_snapshot=p_current;
 if r.saved_result is null then
  return jsonb_build_object('project_id',r.project_id,'request_id',r.request_id,'replayed',p_replayed,
   'input_matches_current',matches,'results_are_latest',false,'operation_status','pending',
   'calculation_result_ids','[]'::jsonb,'processed_activities',null,'calculated_count',null,
   'pending_factor_count',null,'excluded_count',null,'error_count',null);
 end if;
 latest:=r.completion_order=(select max(q.completion_order) from cocal_recalc_private.requests q where q.organization_id=r.organization_id and q.project_id=r.project_id)
  and not exists(select 1 from jsonb_array_elements_text(r.saved_result->'calculation_result_ids') x(id)
   where not exists(select 1 from public.calculation_results c where c.id=x.id::uuid and c.organization_id=r.organization_id and c.project_id=r.project_id and c.is_latest and cocal_activity_private.is_effective(c.emission_activity_id)))
  and r.result_snapshot is not distinct from (select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]'::jsonb)
   from public.calculation_results c where c.id in(select x::uuid from jsonb_array_elements_text(r.saved_result->'calculation_result_ids') x));
 return r.saved_result||jsonb_build_object('request_id',r.request_id,'replayed',p_replayed,
  'input_matches_current',matches,'results_are_latest',latest,
  'operation_status',case when matches and latest then 'completed' else 'historical' end);
end;$$;
alter function cocal_recalc_private.response(cocal_recalc_private.requests,jsonb,boolean) set timezone='UTC';
create or replace function get_emissions_analytics(
  p_organization_id uuid,
  p_project_id uuid default null,
  p_dimension text default 'ghg_scope'
)
returns table (
  classification_system_code text,
  classification_code text,
  total_co2e_kg numeric(20,10),
  activity_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_dimension not in ('ghg_scope', 'iso_category') then
    raise exception 'invalid_dimension';
  end if;

  -- Missing/unfinished effective included calculations are unknown, not zero.
  -- This preserves real zero, empty included sets and explicit exclusions.
  if exists(select 1 from public.effective_emission_activities a
   where a.organization_id=p_organization_id and(p_project_id is null or a.project_id=p_project_id) and a.inclusion_status='included'
   and not exists(select 1 from public.effective_calculation_results c where c.emission_activity_id=a.id and c.organization_id=a.organization_id and c.project_id=a.project_id
    and c.status='calculated' and c.co2e_kg is not null and c.co2e_kg>=0 and c.co2e_kg::text not in('NaN','Infinity','-Infinity')))
  then raise exception 'ANALYTICS_CALCULATION_INCOMPLETE';end if;

  return query
  with codes as (
    select c.code, c.sort_order
    from (
      values
        ('scope_1'::text, 1),
        ('scope_2'::text, 2),
        ('scope_3'::text, 3)
    ) as c(code, sort_order)
    where p_dimension = 'ghg_scope'

    union all

    select c.code, c.sort_order
    from (
      values
        ('category_1'::text, 1),
        ('category_2'::text, 2),
        ('category_3'::text, 3),
        ('category_4'::text, 4),
        ('category_5'::text, 5),
        ('category_6'::text, 6)
    ) as c(code, sort_order)
    where p_dimension = 'iso_category'
  ),
  base as (
    select
      ea.id,
      case
        when p_dimension = 'ghg_scope' then
          coalesce(
            eac.classification_code,
            derive_activity_scope_code(ea.final_scope, ea.suggested_scope)
          )
        else
          coalesce(
            eac.classification_code,
            derive_activity_iso_category_code(
              ea.category,
              ea.subcategory,
              ea.activity_type,
              ea.final_scope,
              ea.suggested_scope
            )
          )
      end as resolved_code,
      coalesce(cr.co2e_kg, 0)::numeric(20,10) as co2e_kg
    from public.effective_emission_activities ea
    left join emission_activity_classifications eac
      on eac.emission_activity_id = ea.id
      and eac.classification_system_code = p_dimension::classification_system_code
    left join public.effective_calculation_results cr
      on cr.emission_activity_id = ea.id
      and cr.is_latest = true
    where ea.organization_id = p_organization_id
      and (p_project_id is null or ea.project_id = p_project_id)
      and ea.status = 'active'
      and ea.inclusion_status = 'included'
  ),
  agg as (
    select
      b.resolved_code,
      sum(b.co2e_kg)::numeric(20,10) as total_co2e_kg,
      count(*)::bigint as activity_count
    from base b
    group by b.resolved_code
  )
  select
    p_dimension::text as classification_system_code,
    codes.code as classification_code,
    coalesce(agg.total_co2e_kg, 0)::numeric(20,10) as total_co2e_kg,
    coalesce(agg.activity_count, 0)::bigint as activity_count
  from codes
  left join agg on agg.resolved_code = codes.code
  order by codes.sort_order;
end;
$$;

revoke all on function get_emissions_analytics(uuid, uuid, text) from public, anon, authenticated;
grant execute on function get_emissions_analytics(uuid, uuid, text) to service_role;

create or replace function cocal_report_private.prevent_scope_hard_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='projects' then
  if exists(select 1 from public.report_generations r where r.project_id=old.id) or exists(select 1 from cocal_report_private.snapshots s where s.project_id=old.id)
  or exists(select 1 from cocal_recalc_private.requests q where q.project_id=old.id)
  or exists(select 1 from cocal_activity_private.replacements r where r.project_id=old.id)
  or exists(select 1 from public.extracted_document_drafts d where d.project_id=old.id and cocal_manual_private.is_manual(d.extraction_provider,d.raw_payload))
  then raise exception 'PROJECT_HAS_RETAINED_SOURCES_OR_REPORTS' using errcode='42501';end if;
 else
  if exists(select 1 from public.report_generations r where r.organization_id=old.id) or exists(select 1 from cocal_report_private.snapshots s where s.organization_id=old.id)
  or exists(select 1 from cocal_recalc_private.requests q where q.organization_id=old.id)
  or exists(select 1 from cocal_activity_private.replacements r where r.organization_id=old.id)
  or exists(select 1 from public.extracted_document_drafts d where d.organization_id=old.id and cocal_manual_private.is_manual(d.extraction_provider,d.raw_payload))
  then raise exception 'ORGANIZATION_HAS_RETAINED_SOURCES_OR_REPORTS' using errcode='42501';end if;
 end if;return old;
end;$$;
revoke all on all functions in schema cocal_activity_private from public,anon,authenticated,service_role;
revoke all on function public.replace_emission_activity(uuid,uuid,uuid,uuid,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.replace_emission_activity(uuid,uuid,uuid,uuid,text,text,text,jsonb,text) to service_role;
revoke all on function public.activity_version_lineage(uuid,uuid,uuid) from public,anon;
grant execute on function public.activity_version_lineage(uuid,uuid,uuid) to authenticated,service_role;
commit;
