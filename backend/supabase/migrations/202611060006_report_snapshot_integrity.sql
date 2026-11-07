-- SOURCE ONLY; no cloud application or historical attestation is authorized.
begin;
create schema cocal_report_private;
revoke all on schema cocal_report_private from public,anon,authenticated,service_role;
alter table public.report_generations add column integrity_status text not null default 'legacy_unverified'
 check(integrity_status in('legacy_unverified','server_verified'));
-- Deliberately no FK/cascade to mutable public rows: maintenance deletion cannot
-- erase request authority and make a committed request look like a new request.
create table cocal_report_private.snapshots(
 report_id uuid primary key,organization_id uuid not null,project_id uuid not null,request_id text not null,
 actor_user_id uuid not null,report_version integer not null,claim_purpose text not null,
 row_snapshot jsonb not null,contract_version text not null default '20261107.report.1',
 sealed_at timestamptz not null default clock_timestamp(),unique(organization_id,project_id,request_id)
);
alter table cocal_report_private.snapshots enable row level security;
revoke all on cocal_report_private.snapshots from public,anon,authenticated,service_role;

create function cocal_report_private.protect_report() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_setting('role',true) in ('authenticated','anon') then raise exception 'REPORT_SERVER_PUBLICATION_REQUIRED' using errcode='42501';end if;
 if tg_op<>'DELETE' and new.integrity_status='server_verified'
  and(tg_op='INSERT' or old.integrity_status is distinct from new.integrity_status)
  and current_user is distinct from pg_get_userbyid((select c.relowner from pg_class c where c.oid='public.report_generations'::regclass)) then
  raise exception 'REPORT_INTEGRITY_MARKER_IS_SERVER_MANAGED' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
revoke all on function cocal_report_private.protect_report() from public,anon,authenticated,service_role;
create trigger report_snapshot_write_guard before insert or update or delete on public.report_generations
 for each row execute function cocal_report_private.protect_report();
create policy report_client_insert_denied on public.report_generations as restrictive for insert to public with check(false);
create policy report_client_update_denied on public.report_generations as restrictive for update to public using(false) with check(false);
create policy report_client_delete_denied on public.report_generations as restrictive for delete to public using(false);

create function cocal_report_private.require_write(p_org uuid,p_project uuid,p_actor uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
declare sub public.subscriptions;effective text;
begin
 perform 1 from public.projects p where p.id=p_project and p.organization_id=p_org for key share;
 if not found then raise exception 'report_scope_or_actor_denied' using errcode='42501';end if;
 perform 1 from public.organizations o where o.id=p_org and o.status='active' for share;
 if not found then raise exception 'report_scope_or_actor_denied' using errcode='42501';end if;
 perform 1 from public.organization_members m where m.organization_id=p_org and m.user_id=p_actor and m.status='active' and m.role in('owner','admin','editor') for share;
 if not found then raise exception 'report_scope_or_actor_denied' using errcode='42501';end if;
 select * into sub from public.subscriptions s where s.organization_id=p_org order by s.period_end desc,s.created_at desc,s.id limit 1 for share;
 if not found or now()<sub.period_start then raise exception 'REPORT_SUBSCRIPTION_READONLY' using errcode='42501';end if;
 effective:=sub.status::text;
 if effective='active' and now()>sub.period_end then
  if sub.grace_until is not null and now()<=sub.grace_until then effective:='grace_period';else effective:='readonly';end if;
 elsif effective='grace_period' and sub.grace_until is not null and now()>sub.grace_until then effective:='readonly';end if;
 if effective not in('active','grace_period') then raise exception 'REPORT_SUBSCRIPTION_READONLY' using errcode='42501';end if;
end;$$;

-- Compare database values independent of the SQL connection's timezone.
create function cocal_report_private.row_snapshot(p_row public.report_generations) returns jsonb
language sql stable security definer set search_path='' set timezone='UTC' as $$select to_jsonb($1)$$;

create function cocal_report_private.verified_row(p_org uuid,p_project uuid,p_report uuid)
returns public.report_generations language plpgsql volatile security definer set search_path='' as $$
declare saved public.report_generations;proof cocal_report_private.snapshots;has_proof boolean;
begin
 select * into proof from cocal_report_private.snapshots s where s.report_id=p_report and s.organization_id=p_org and s.project_id=p_project;has_proof:=found;
 select * into saved from public.report_generations r where r.id=p_report and r.organization_id=p_org and r.project_id=p_project for share;
 if not found then
  if has_proof then raise exception 'REPORT_SNAPSHOT_INTEGRITY_MISMATCH';end if;
  return null;
 end if;
 if not has_proof then raise exception 'REPORT_SNAPSHOT_UNVERIFIED';end if;
 if saved.integrity_status<>'server_verified' or saved.status<>'completed' or proof.contract_version<>'20261107.report.1'
  or cocal_report_private.row_snapshot(saved) is distinct from proof.row_snapshot
  or not exists(select 1 from public.report_snapshot_requests_v2 q where q.organization_id=p_org and q.project_id=p_project
   and q.request_id=proof.request_id and q.actor_user_id=proof.actor_user_id and q.report_version=proof.report_version
   and q.claim_purpose::text=proof.claim_purpose and q.report_generation_id=p_report)
  then raise exception 'REPORT_SNAPSHOT_INTEGRITY_MISMATCH';end if;
 return saved;
end;$$;

-- Retain the checked-in two-stage INSERT+snapshot UPDATE implementation inside
-- an owner-only publisher; no client flag/GUC/metadata can invoke or bless it.
alter function public.generate_report_snapshot_atomic_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb) set schema cocal_report_private;
revoke all on function cocal_report_private.generate_report_snapshot_atomic_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb) from public,anon,authenticated,service_role;

create function public.generate_report_snapshot_atomic_v2(
 p_organization_id uuid,p_project_id uuid,p_generated_by_user_id uuid,p_report_version integer,
 p_payload jsonb,p_payload_hash text,p_reporting_period_start date,p_reporting_period_end date,
 p_included_activity_count integer,p_excluded_activity_count integer,p_pending_activity_count integer,
 p_scope_totals jsonb,p_category_totals jsonb,p_factor_sources jsonb,p_warning_count integer,p_based_on_calculated_at timestamptz,
 p_request_id text default null,p_snapshot jsonb default null)
returns table(report_generation_id uuid,status public.report_status)
language plpgsql volatile security definer set search_path='' as $$
declare saved public.report_generations;proof cocal_report_private.snapshots;new_id uuid;
begin
 perform cocal_report_private.require_write(p_organization_id,p_project_id,p_generated_by_user_id);
 if p_request_id is null or length(btrim(p_request_id))<1 or length(p_request_id)>200 then raise exception 'complete_snapshot_and_request_required';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_project_id::text||':'||p_request_id,0));
 select * into proof from cocal_report_private.snapshots s where s.organization_id=p_organization_id and s.project_id=p_project_id and s.request_id=p_request_id;
 if found then
  if proof.actor_user_id is distinct from p_generated_by_user_id or proof.report_version is distinct from p_report_version or proof.claim_purpose is distinct from p_snapshot->>'claim_purpose' then raise exception 'report_request_intent_conflict';end if;
  saved:=cocal_report_private.verified_row(p_organization_id,p_project_id,proof.report_id);
  return query select saved.id,saved.status;return;
 end if;
 if exists(select 1 from public.report_snapshot_requests_v2 q where q.organization_id=p_organization_id and q.project_id=p_project_id and q.request_id=p_request_id) then raise exception 'REPORT_SNAPSHOT_UNVERIFIED';end if;
 select r.report_generation_id into new_id from cocal_report_private.generate_report_snapshot_atomic_v2(
  p_organization_id,p_project_id,p_generated_by_user_id,p_report_version,p_payload,p_payload_hash,
  p_reporting_period_start,p_reporting_period_end,p_included_activity_count,p_excluded_activity_count,p_pending_activity_count,
  p_scope_totals,p_category_totals,p_factor_sources,p_warning_count,p_based_on_calculated_at,p_request_id,p_snapshot) r;
 update public.report_generations r set integrity_status='server_verified' where r.id=new_id and r.organization_id=p_organization_id and r.project_id=p_project_id
  and r.status='completed' and r.generated_by_user_id=p_generated_by_user_id and r.report_version=p_report_version
  and r.claim_purpose::text=p_snapshot->>'claim_purpose' returning * into saved;
 if not found then raise exception 'REPORT_PUBLICATION_NOT_CONFIRMED';end if;
 insert into cocal_report_private.snapshots(report_id,organization_id,project_id,request_id,actor_user_id,report_version,claim_purpose,row_snapshot)
 values(saved.id,p_organization_id,p_project_id,p_request_id,p_generated_by_user_id,p_report_version,saved.claim_purpose::text,cocal_report_private.row_snapshot(saved));
 -- Verify final persisted row, request binding and marker after sealing.
 saved:=cocal_report_private.verified_row(p_organization_id,p_project_id,saved.id);
 return query select saved.id,saved.status;
end;$$;

create or replace function public.report_snapshot_request_v2(
 p_organization_id uuid,p_project_id uuid,p_actor_user_id uuid,p_request_id text,p_report_version integer,p_claim_purpose text)
returns setof public.report_generations language plpgsql volatile security definer set search_path='' as $$
declare proof cocal_report_private.snapshots;saved public.report_generations;
begin
 perform cocal_report_private.require_write(p_organization_id,p_project_id,p_actor_user_id);
 select * into proof from cocal_report_private.snapshots s where s.organization_id=p_organization_id and s.project_id=p_project_id and s.request_id=p_request_id;
 if not found then
  if exists(select 1 from public.report_snapshot_requests_v2 q where q.organization_id=p_organization_id and q.project_id=p_project_id and q.request_id=p_request_id) then raise exception 'REPORT_SNAPSHOT_UNVERIFIED';end if;
  return;
 end if;
 if proof.actor_user_id is distinct from p_actor_user_id or proof.report_version is distinct from p_report_version or proof.claim_purpose is distinct from p_claim_purpose then raise exception 'report_request_intent_conflict';end if;
 saved:=cocal_report_private.verified_row(p_organization_id,p_project_id,proof.report_id);
 return next saved;
end;$$;
create function public.read_verified_report_snapshot(p_organization_id uuid,p_project_id uuid,p_actor_user_id uuid,p_report_id uuid)
returns setof public.report_generations language plpgsql volatile security definer set search_path='' as $$
declare saved public.report_generations;
begin
 perform cocal_report_private.require_write(p_organization_id,p_project_id,p_actor_user_id);
 saved:=cocal_report_private.verified_row(p_organization_id,p_project_id,p_report_id);
 if saved.id is not null then return next saved;end if;
end;$$;
revoke all on all functions in schema cocal_report_private from public,anon,authenticated,service_role;
revoke all on function public.generate_report_snapshot_atomic_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb),public.report_snapshot_request_v2(uuid,uuid,uuid,text,integer,text),public.read_verified_report_snapshot(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.generate_report_snapshot_atomic_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb),public.report_snapshot_request_v2(uuid,uuid,uuid,text,integer,text),public.read_verified_report_snapshot(uuid,uuid,uuid,uuid) to service_role;
commit;
