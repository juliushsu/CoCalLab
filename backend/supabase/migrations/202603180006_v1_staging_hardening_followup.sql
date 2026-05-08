-- CaCalLab staging hardening follow-up
-- Scope: add missing env/is_test coverage, secure action_logs read model,
-- and strengthen staging purge with storage object cleanup.

alter table if exists emission_factors
  add column if not exists is_test boolean not null default true,
  add column if not exists env text not null default 'staging';

create index if not exists emission_factors_env_idx on emission_factors (env, is_test);

alter table if exists action_logs enable row level security;

drop policy if exists action_logs_select_policy on action_logs;
create policy action_logs_select_policy
  on action_logs for select
  using (
    organization_id is null
    or is_active_org_member(organization_id)
  );

create or replace function purge_staging_data_dry_run()
returns table (table_name text, row_count bigint)
language sql
security definer
set search_path = public, storage
as $$
  select 'storage.objects'::text as table_name, count(*)::bigint as row_count
  from storage.objects
  where bucket_id in ('staging-receipts', 'staging-attachments')
     or (storage.foldername(name))[1] = 'staging'
  union all
  select 'action_logs', count(*)::bigint from action_logs where env = 'staging' or is_test = true
  union all
  select 'ai_audit_results', count(*)::bigint from ai_audit_results where env = 'staging' or is_test = true
  union all
  select 'report_generations', count(*)::bigint from report_generations where env = 'staging' or is_test = true
  union all
  select 'calculation_results', count(*)::bigint from calculation_results where env = 'staging' or is_test = true
  union all
  select 'emission_activities', count(*)::bigint from emission_activities where env = 'staging' or is_test = true
  union all
  select 'extracted_document_drafts', count(*)::bigint from extracted_document_drafts where env = 'staging' or is_test = true
  union all
  select 'uploaded_documents', count(*)::bigint from uploaded_documents where env = 'staging' or is_test = true
  union all
  select 'emission_factors', count(*)::bigint from emission_factors where env = 'staging' or is_test = true
  union all
  select 'projects', count(*)::bigint from projects where env = 'staging' or is_test = true
  union all
  select 'subscriptions', count(*)::bigint from subscriptions where env = 'staging' or is_test = true
  union all
  select 'organization_members', count(*)::bigint from organization_members where env = 'staging' or is_test = true
  union all
  select 'organizations', count(*)::bigint from organizations where env = 'staging' or is_test = true
  union all
  select 'audit_logs', count(*)::bigint from audit_logs where env = 'staging' or is_test = true;
$$;

create or replace function purge_staging_data()
returns table (table_name text, deleted_count bigint)
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_count bigint;
begin
  delete from storage.objects
  where bucket_id in ('staging-receipts', 'staging-attachments')
     or (storage.foldername(name))[1] = 'staging';
  get diagnostics v_count = row_count;
  return query select 'storage.objects'::text, v_count;

  delete from action_logs where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'action_logs'::text, v_count;

  delete from ai_audit_results where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'ai_audit_results'::text, v_count;

  delete from report_generations where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'report_generations'::text, v_count;

  delete from calculation_results where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'calculation_results'::text, v_count;

  delete from emission_activities where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'emission_activities'::text, v_count;

  delete from extracted_document_drafts where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'extracted_document_drafts'::text, v_count;

  delete from uploaded_documents where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'uploaded_documents'::text, v_count;

  delete from emission_factors where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'emission_factors'::text, v_count;

  delete from projects where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'projects'::text, v_count;

  delete from subscriptions where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'subscriptions'::text, v_count;

  delete from organization_members where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'organization_members'::text, v_count;

  delete from organizations where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'organizations'::text, v_count;

  delete from audit_logs where env = 'staging' or is_test = true;
  get diagnostics v_count = row_count;
  return query select 'audit_logs'::text, v_count;
end;
$$;

revoke all on function purge_staging_data_dry_run() from public, anon, authenticated;
revoke all on function purge_staging_data() from public, anon, authenticated;
grant execute on function purge_staging_data_dry_run() to service_role;
grant execute on function purge_staging_data() to service_role;
