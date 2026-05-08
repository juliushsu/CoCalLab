-- Dry-run helper for staging data purge

create or replace function purge_staging_data_dry_run()
returns table (table_name text, row_count bigint)
language sql
security definer
set search_path = public
as $$
  select 'action_logs'::text as table_name, count(*)::bigint as row_count from action_logs where env = 'staging' or is_test = true
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
