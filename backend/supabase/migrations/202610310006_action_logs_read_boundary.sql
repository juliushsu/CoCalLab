-- Orphan/unscoped action logs remain available only to existing privileged readers.
-- Retain log rows and existing ON DELETE SET NULL behavior; do not add grants.
-- Deployment and live-policy verification remain separate acceptance steps.
begin;

drop policy if exists action_logs_select_policy on public.action_logs;
create policy action_logs_select_policy
  on public.action_logs for select to authenticated
  using (
    organization_id is not null
    and is_active_org_member(organization_id)
  );

commit;
