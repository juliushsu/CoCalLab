-- Minimal operational request binding. User-writable audit logs are NOT authority.
create table report_snapshot_requests_v2(
 organization_id uuid not null references organizations(id) on delete cascade,
 project_id uuid not null references projects(id) on delete cascade,
 request_id text not null check(length(btrim(request_id)) between 1 and 200),
 actor_user_id uuid not null,report_version integer not null,
 claim_purpose claim_purpose_code not null,
 report_generation_id uuid not null references report_generations(id) on delete cascade,
 primary key(organization_id,project_id,request_id)
);
alter table report_snapshot_requests_v2 enable row level security;
revoke all on report_snapshot_requests_v2 from public,anon,authenticated;
grant select,insert on report_snapshot_requests_v2 to service_role;

-- Source-only incremental deployment candidate. Cloud application is NOT authorized.
-- Preserve v1 signature for existing callers; the handler moves to service-only v2.
create or replace function generate_report_snapshot_atomic_v2(
 p_organization_id uuid, p_project_id uuid, p_generated_by_user_id uuid,
 p_report_version integer, p_payload jsonb, p_payload_hash text,
 p_reporting_period_start date, p_reporting_period_end date,
 p_included_activity_count integer, p_excluded_activity_count integer, p_pending_activity_count integer,
 p_scope_totals jsonb, p_category_totals jsonb, p_factor_sources jsonb,
 p_warning_count integer, p_based_on_calculated_at timestamptz,
 p_request_id text default null, p_snapshot jsonb default null
) returns table(report_generation_id uuid,status report_status)
 language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_prior report_generations%rowtype;
begin
 if nullif(btrim(p_request_id),'') is null or jsonb_typeof(p_snapshot) is distinct from 'object'
    or not (p_snapshot ?& array['claim_purpose','gross_emissions_snapshot','adjustment_summary','claim_results','adjustment_manifest']) then
  raise exception 'complete_snapshot_and_request_required';
 end if;
 if not exists(select 1 from projects p where p.id=p_project_id and p.organization_id=p_organization_id)
 or not exists(select 1 from organization_members m where m.organization_id=p_organization_id and m.user_id=p_generated_by_user_id and m.status='active' and m.role in ('owner','admin','editor')) then
  raise exception 'report_scope_or_actor_denied';
 end if;
 -- Serialize this immutable request intent; a retry returns its saved snapshot.
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_project_id::text||':'||p_request_id,0));
 select r.* into v_prior from report_generations r join report_snapshot_requests_v2 q on q.report_generation_id=r.id
 where q.organization_id=p_organization_id and q.project_id=p_project_id and q.request_id=p_request_id
 and r.organization_id=p_organization_id and r.project_id=p_project_id;
 if found then
  if not exists(select 1 from report_snapshot_requests_v2 q where q.organization_id=p_organization_id and q.project_id=p_project_id and q.request_id=p_request_id and q.actor_user_id=p_generated_by_user_id and q.report_version=p_report_version and q.claim_purpose::text=p_snapshot->>'claim_purpose') or v_prior.generated_by_user_id is distinct from p_generated_by_user_id or v_prior.report_version<>p_report_version
     or v_prior.claim_purpose::text is distinct from p_snapshot->>'claim_purpose' then raise exception 'report_request_intent_conflict'; end if;
  return query select v_prior.id,v_prior.status; return;
 end if;
 select g.report_generation_id into v_id from generate_report_atomic(
 p_organization_id,p_project_id,p_generated_by_user_id,p_report_version,p_payload,p_payload_hash,
 p_reporting_period_start,p_reporting_period_end,p_included_activity_count,p_excluded_activity_count,
 p_pending_activity_count,p_scope_totals,p_category_totals,p_factor_sources,p_warning_count,p_based_on_calculated_at,p_request_id) g;
 update report_generations set
 claim_purpose=(p_snapshot->>'claim_purpose')::claim_purpose_code,
 gross_emissions_snapshot=p_snapshot->'gross_emissions_snapshot',adjustment_summary=p_snapshot->'adjustment_summary',
 claim_results=p_snapshot->'claim_results',adjustment_manifest=p_snapshot->'adjustment_manifest',
 legal_entity_snapshot=coalesce(p_payload->'legal_entity_snapshot','{}'::jsonb),site_snapshot=coalesce(p_payload->'site_snapshot','{}'::jsonb),
 boundary_snapshot=coalesce(p_payload->'boundary_snapshot','{}'::jsonb)
 where id=v_id and organization_id=p_organization_id and project_id=p_project_id;
 if not found then raise exception 'snapshot_write_not_confirmed'; end if;
 insert into report_snapshot_requests_v2(organization_id,project_id,request_id,actor_user_id,report_version,claim_purpose,report_generation_id)
 values(p_organization_id,p_project_id,p_request_id,p_generated_by_user_id,p_report_version,(p_snapshot->>'claim_purpose')::claim_purpose_code,v_id);
 insert into audit_logs(organization_id,project_id,actor_user_id,actor_type,action,entity_type,entity_id,status,metadata)
 values(p_organization_id,p_project_id,p_generated_by_user_id,'edge_function','generate_report_snapshot_atomic_v2','report_generation',v_id,'recorded',jsonb_build_object('request_id',p_request_id));
 return query select v_id,'completed'::report_status;
end;$$;
revoke all on function generate_report_snapshot_atomic_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function generate_report_snapshot_atomic_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb) to service_role;

-- Look up an already committed request BEFORE rebuilding mutable calculation inputs.
create or replace function report_snapshot_request_v2(
 p_organization_id uuid,p_project_id uuid,p_actor_user_id uuid,p_request_id text,p_report_version integer,p_claim_purpose text
) returns setof report_generations language plpgsql security definer set search_path=public as $$
declare v_saved report_generations%rowtype;
begin
 if not exists(select 1 from projects p where p.id=p_project_id and p.organization_id=p_organization_id)
 or not exists(select 1 from organization_members m where m.organization_id=p_organization_id and m.user_id=p_actor_user_id and m.status='active' and m.role in ('owner','admin','editor')) then raise exception 'report_scope_or_actor_denied'; end if;
 select r.* into v_saved from report_generations r join report_snapshot_requests_v2 q on q.report_generation_id=r.id
 where q.organization_id=p_organization_id and q.project_id=p_project_id and q.request_id=p_request_id
 and r.organization_id=p_organization_id and r.project_id=p_project_id;
 if not found then return; end if;
 if not exists(select 1 from report_snapshot_requests_v2 q where q.organization_id=p_organization_id and q.project_id=p_project_id and q.request_id=p_request_id and q.actor_user_id=p_actor_user_id and q.report_version=p_report_version and q.claim_purpose::text=p_claim_purpose) or v_saved.generated_by_user_id is distinct from p_actor_user_id or v_saved.report_version is distinct from p_report_version
 or v_saved.claim_purpose::text is distinct from p_claim_purpose then raise exception 'report_request_intent_conflict'; end if;
 return next v_saved;
end;$$;
revoke all on function report_snapshot_request_v2(uuid,uuid,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function report_snapshot_request_v2(uuid,uuid,uuid,text,integer,text) to service_role;
