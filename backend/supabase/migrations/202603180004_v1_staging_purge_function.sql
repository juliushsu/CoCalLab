-- One-click purge for staging closed-beta records

create or replace function purge_staging_data()
returns table (table_name text, deleted_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
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
