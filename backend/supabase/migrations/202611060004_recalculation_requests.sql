-- Source candidate; no cloud application. Operational authority, not audit-log authority.
begin;
create schema cocal_recalc_private;
revoke all on schema cocal_recalc_private from public,anon,authenticated,service_role;
create sequence cocal_recalc_private.completion_order;
create table cocal_recalc_private.requests(
 organization_id uuid not null references public.organizations(id),
 project_id uuid not null references public.projects(id), request_id text not null,
 actor_user_id uuid not null, force_recalculate boolean not null, formula_version text not null,
 input_snapshot jsonb not null, saved_result jsonb, result_snapshot jsonb, completion_order bigint,
 created_at timestamptz not null default now(), completed_at timestamptz,
 primary key(organization_id,project_id,request_id),
 check(length(btrim(request_id)) between 1 and 200)
);
alter table cocal_recalc_private.requests enable row level security;
revoke all on all tables in schema cocal_recalc_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema cocal_recalc_private from public,anon,authenticated,service_role;

create function cocal_recalc_private.require_scope(p_org uuid,p_project uuid,p_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare sub public.subscriptions; effective text;
begin
 -- Serialize this project's operations without blocking FK KEY SHARE taken by
 -- ordinary activity INSERTs before the short source-table locks are acquired.
 perform 1 from public.projects p where p.id=p_project and p.organization_id=p_org for no key update;
 if not found then raise exception 'recalculation_scope_denied' using errcode='42501';end if;
 perform 1 from public.organizations o where o.id=p_org and o.status='active' for share;
 if not found then raise exception 'recalculation_organization_inactive' using errcode='42501';end if;
 perform 1 from public.organization_members m where m.organization_id=p_org and m.user_id=p_actor and m.status='active' and m.role in ('owner','admin','editor') for share;
 if not found then raise exception 'recalculation_actor_denied' using errcode='42501';end if;
 select * into sub from public.subscriptions s where s.organization_id=p_org order by s.period_end desc,s.created_at desc,s.id limit 1 for share;
 if not found or now()<sub.period_start then raise exception 'recalculation_subscription_readonly' using errcode='42501';end if;
 effective:=sub.status::text;
 if effective='active' and now()>sub.period_end then
  if sub.grace_until is not null and now()<=sub.grace_until then effective:='grace_period';else effective:='readonly';end if;
 elsif effective='grace_period' and sub.grace_until is not null and now()>sub.grace_until then effective:='readonly';end if;
 if effective not in ('active','grace_period') then raise exception 'recalculation_subscription_readonly' using errcode='42501';end if;
end;$$;

-- Complete aggregate, not an unpaged REST result. Include all candidate factors,
-- even non-winning ones: a newly tied candidate must invalidate an old request.
-- Exclude generated calculation data and timestamps, which would self-invalidate.
create function cocal_recalc_private.inputs(p_org uuid,p_project uuid) returns jsonb
language sql volatile security definer set search_path='' as $$
 select jsonb_build_object('activities',coalesce((select jsonb_agg(jsonb_build_object(
  'id',a.id,'organization_id',a.organization_id,'project_id',a.project_id,'status',a.status,
  'quantity',a.quantity,'unit',a.unit,'activity_date',a.activity_date,'category',a.category,
  'subcategory',a.subcategory,'activity_type',a.activity_type,'inclusion_status',a.inclusion_status,
  'exclusion_reason',a.exclusion_reason,'final_scope',a.final_scope,'suggested_scope',a.suggested_scope,
  'source_document_id',a.source_document_id,'source_draft_id',a.source_draft_id) order by a.id)
  from public.emission_activities a where a.organization_id=p_org and a.project_id=p_project and a.status='active'),'[]'::jsonb),
 'factors',coalesce((select jsonb_agg(to_jsonb(f)-array['created_at','updated_at','metadata'] order by f.id)
  from public.emission_factors f where f.status='active' and (f.organization_id=p_org or f.organization_id is null)),'[]'::jsonb));
$$;

create function cocal_recalc_private.response(r cocal_recalc_private.requests,p_current jsonb,p_replayed boolean)
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
   where not exists(select 1 from public.calculation_results c where c.id=x.id::uuid and c.organization_id=r.organization_id and c.project_id=r.project_id and c.is_latest))
  and r.result_snapshot is not distinct from (select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]'::jsonb)
   from public.calculation_results c where c.id in(select x::uuid from jsonb_array_elements_text(r.saved_result->'calculation_result_ids') x));
 return r.saved_result||jsonb_build_object('request_id',r.request_id,'replayed',p_replayed,
  'input_matches_current',matches,'results_are_latest',latest,
  'operation_status',case when matches and latest then 'completed' else 'historical' end);
end;$$;

create function public.recalculation_request_v2(p_organization_id uuid,p_project_id uuid,p_actor_user_id uuid,
 p_request_id text,p_force_recalculate boolean,p_formula_version text,p_action text default 'lookup')
returns table(result jsonb) language plpgsql security definer set search_path='' as $$
declare r cocal_recalc_private.requests; current_inputs jsonb; response jsonb;
begin
 perform cocal_recalc_private.require_scope(p_organization_id,p_project_id,p_actor_user_id);
 if p_request_id is null or length(btrim(p_request_id))<1 or length(p_request_id)>200 or p_force_recalculate is null or p_formula_version is null or p_action is null or p_action not in ('lookup','prepare') then raise exception 'invalid_recalculation_request';end if;
 current_inputs:=cocal_recalc_private.inputs(p_organization_id,p_project_id);
 select * into r from cocal_recalc_private.requests q where q.organization_id=p_organization_id and q.project_id=p_project_id and q.request_id=p_request_id;
 if found then
  if r.actor_user_id is distinct from p_actor_user_id or r.force_recalculate is distinct from p_force_recalculate or r.formula_version is distinct from p_formula_version then raise exception 'RECALCULATION_REQUEST_INTENT_CONFLICT' using errcode='P0001';end if;
  response:=cocal_recalc_private.response(r,current_inputs,true);
  if p_action='prepare' then
   if r.input_snapshot<>current_inputs then raise exception 'RECALCULATION_INPUT_CHANGED';end if;
   if r.saved_result is not null and not (response->>'results_are_latest')::boolean then raise exception 'RECALCULATION_RESULT_SUPERSEDED';end if;
  end if;
 elsif p_action='lookup' then
  return query select jsonb_build_object('project_id',p_project_id,'request_id',p_request_id,'replayed',false,
   'input_matches_current',false,'results_are_latest',false,'operation_status','not_found',
   'calculation_result_ids','[]'::jsonb,'processed_activities',null,'calculated_count',null,
   'pending_factor_count',null,'excluded_count',null,'error_count',null);return;
 else
  if p_formula_version<>'v1.0.0' then raise exception 'UNSUPPORTED_FORMULA_VERSION' using errcode='22023';end if;
  insert into cocal_recalc_private.requests(organization_id,project_id,request_id,actor_user_id,force_recalculate,formula_version,input_snapshot)
   values(p_organization_id,p_project_id,p_request_id,p_actor_user_id,p_force_recalculate,p_formula_version,current_inputs) returning * into r;
  response:=cocal_recalc_private.response(r,current_inputs,false);
 end if;
 if p_action='prepare' and r.saved_result is null then response:=response||jsonb_build_object('input_snapshot',r.input_snapshot);end if;
 return query select response;
end;$$;

create function public.commit_recalculation_v2(p_organization_id uuid,p_project_id uuid,p_actor_user_id uuid,
 p_request_id text,p_force_recalculate boolean,p_formula_version text,p_input_snapshot jsonb,p_calculation_results jsonb)
returns table(result jsonb) language plpgsql security definer set search_path='' as $$
declare r cocal_recalc_private.requests; fresh jsonb; answer jsonb; item jsonb; payload jsonb:='[]';
 ids jsonb; activity uuid; expected_count integer;
begin
 perform cocal_recalc_private.require_scope(p_organization_id,p_project_id,p_actor_user_id);
 -- Short commit-phase SHARE table locks prevent source UPDATE/INSERT phantoms
 -- during compare+save. They can briefly delay writes in other projects; this is
 -- not a scalability claim. Independent SQL-connection contention NOT_RUN locally.
 lock table public.emission_activities,public.emission_factors in share mode;
 fresh:=cocal_recalc_private.inputs(p_organization_id,p_project_id);
 select * into r from cocal_recalc_private.requests q where q.organization_id=p_organization_id and q.project_id=p_project_id and q.request_id=p_request_id for update;
 if not found then raise exception 'RECALCULATION_REQUEST_NOT_PREPARED';end if;
 if r.actor_user_id is distinct from p_actor_user_id or r.force_recalculate is distinct from p_force_recalculate or r.formula_version is distinct from p_formula_version then raise exception 'RECALCULATION_REQUEST_INTENT_CONFLICT';end if;
 if r.input_snapshot is distinct from fresh or p_input_snapshot is distinct from fresh then raise exception 'RECALCULATION_INPUT_CHANGED';end if;
 if r.saved_result is not null then
  answer:=cocal_recalc_private.response(r,fresh,true);
  if not (answer->>'results_are_latest')::boolean then raise exception 'RECALCULATION_RESULT_SUPERSEDED';end if;
  return query select answer;return;
 end if;
 expected_count:=jsonb_array_length(fresh->'activities');
 if jsonb_typeof(p_calculation_results) is distinct from 'array' or jsonb_array_length(p_calculation_results)<>expected_count then raise exception 'RECALCULATION_PAYLOAD_SCOPE_MISMATCH';end if;
 if (select count(distinct x->>'emission_activity_id') from jsonb_array_elements(p_calculation_results) x)<>expected_count then raise exception 'RECALCULATION_PAYLOAD_SCOPE_MISMATCH';end if;
 for item in select * from jsonb_array_elements(p_calculation_results) loop
  activity:=(item->>'emission_activity_id')::uuid;
  if not exists(select 1 from jsonb_array_elements(fresh->'activities') x where (x->>'id')::uuid=activity)
   or item->>'organization_id' is distinct from p_organization_id::text or item->>'project_id' is distinct from p_project_id::text
   or item->>'formula_version' is distinct from p_formula_version then raise exception 'RECALCULATION_PAYLOAD_SCOPE_MISMATCH';end if;
  payload:=payload||jsonb_build_array(item||jsonb_build_object('calc_version',(select coalesce(max(c.calc_version),0)+1 from public.calculation_results c where c.emission_activity_id=activity)));
 end loop;
 select to_jsonb(t) into answer from public.recalculate_project_atomic(p_organization_id,p_project_id,p_actor_user_id,payload,p_request_id) t;
 select coalesce(jsonb_agg(c.id order by c.emission_activity_id),'[]') into ids from public.calculation_results c
  where c.organization_id=p_organization_id and c.project_id=p_project_id and c.is_latest
  and c.emission_activity_id in(select (x->>'id')::uuid from jsonb_array_elements(fresh->'activities') x);
 if jsonb_array_length(ids)<>expected_count then raise exception 'RECALCULATION_RESULT_COUNT_MISMATCH';end if;
 answer:=answer||jsonb_build_object('calculation_result_ids',ids);
 update cocal_recalc_private.requests q set saved_result=answer,
  result_snapshot=(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]'::jsonb) from public.calculation_results c where c.id in(select x::uuid from jsonb_array_elements_text(ids) x)),
  completion_order=nextval('cocal_recalc_private.completion_order'),completed_at=now()
  where q.organization_id=p_organization_id and q.project_id=p_project_id and q.request_id=p_request_id returning * into r;
 return query select cocal_recalc_private.response(r,fresh,false);
end;$$;

revoke all on all functions in schema cocal_recalc_private from public,anon,authenticated,service_role;
revoke all on function public.recalculation_request_v2(uuid,uuid,uuid,text,boolean,text,text),public.commit_recalculation_v2(uuid,uuid,uuid,text,boolean,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.recalculation_request_v2(uuid,uuid,uuid,text,boolean,text,text),public.commit_recalculation_v2(uuid,uuid,uuid,text,boolean,text,jsonb,jsonb) to service_role;

create function public.recalculation_contract(p_project_id uuid)
returns table(project_id uuid,organization_id uuid,contract_version text,can_recalculate boolean)
language plpgsql security definer set search_path='' as $$
declare org uuid; allowed boolean:=false;
begin
 select p.organization_id into org from public.projects p join public.organization_members m on m.organization_id=p.organization_id
 join public.organizations o on o.id=p.organization_id
 where p.id=p_project_id and m.user_id=auth.uid() and m.status='active' and o.status='active';
 if not found then return;end if;
 begin perform cocal_recalc_private.require_scope(org,p_project_id,auth.uid());allowed:=true;
 exception when insufficient_privilege then allowed:=false;end;
 return query select p_project_id,org,'20261106.recalc.1'::text,allowed;
end;$$;
revoke all on function public.recalculation_contract(uuid) from public,anon;
grant execute on function public.recalculation_contract(uuid) to authenticated;
commit;
