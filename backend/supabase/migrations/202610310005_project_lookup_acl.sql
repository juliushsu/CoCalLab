-- UUID-to-tenant/boundary lookups are internal maintenance helpers.
-- Current frontend uses JWT/RLS table reads and has no direct helper consumers.
-- Leave membership-aware can_access_* / is_workspace_member RPCs and RLS unchanged.
-- Source-only change; live ACLs and deployment require separate acceptance.
begin;

revoke all on function get_project_workspace_id(uuid) from public, anon, authenticated;
grant execute on function get_project_workspace_id(uuid) to service_role;

revoke all on function get_project_legal_entity_id(uuid) from public, anon, authenticated;
grant execute on function get_project_legal_entity_id(uuid) to service_role;

revoke all on function get_project_site_id(uuid) from public, anon, authenticated;
grant execute on function get_project_site_id(uuid) to service_role;

commit;
