-- These six internal write RPCs are invoked only by Edge service-role handlers.
-- Handlers check JWT/member access and separately enforce subscription policy.
-- SECURITY DEFINER bodies must not be callable by clients that bypass those checks.
-- Revoke direct client execution; leave frontend member/create-org RPCs unchanged.
-- Source migration only: deployment still requires the normal approval boundary.
begin;

revoke all on function confirm_draft_atomic(uuid, uuid, uuid, text, draft_status, text, timestamptz, jsonb, jsonb, uuid, text)
  from public, anon, authenticated;
grant execute on function confirm_draft_atomic(uuid, uuid, uuid, text, draft_status, text, timestamptz, jsonb, jsonb, uuid, text)
  to service_role;

revoke all on function process_document_atomic(uuid, uuid, uuid, jsonb, jsonb, draft_status, numeric, text, text, text)
  from public, anon, authenticated;
grant execute on function process_document_atomic(uuid, uuid, uuid, jsonb, jsonb, draft_status, numeric, text, text, text)
  to service_role;

revoke all on function recalculate_project_atomic(uuid, uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function recalculate_project_atomic(uuid, uuid, uuid, jsonb, text)
  to service_role;

revoke all on function generate_report_atomic(uuid, uuid, uuid, integer, jsonb, text, date, date, integer, integer, integer, jsonb, jsonb, jsonb, integer, timestamptz, text)
  from public, anon, authenticated;
grant execute on function generate_report_atomic(uuid, uuid, uuid, integer, jsonb, text, date, date, integer, integer, integer, jsonb, jsonb, jsonb, integer, timestamptz, text)
  to service_role;

revoke all on function run_ai_audit_atomic(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, numeric, text)
  from public, anon, authenticated;
grant execute on function run_ai_audit_atomic(uuid, uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, numeric, text)
  to service_role;

revoke all on function classify_document_atomic(uuid, uuid, uuid, classification_status, text, smallint, numeric, text, text, text, text)
  from public, anon, authenticated;
grant execute on function classify_document_atomic(uuid, uuid, uuid, classification_status, text, smallint, numeric, text, text, text, text)
  to service_role;

commit;
