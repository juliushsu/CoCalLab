-- Org read-chain hardening for Project create selector
-- Goal: provide a canonical, JWT-based organization list API path.

create index if not exists organization_members_user_status_org_idx
  on organization_members (user_id, status, organization_id);

create or replace function list_my_organizations()
returns table (
  organization_id uuid,
  slug citext,
  display_name text,
  legal_name text,
  organization_status organization_status,
  member_role member_role,
  member_status member_status,
  project_writable boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id as organization_id,
    o.slug,
    o.display_name,
    o.legal_name,
    o.status as organization_status,
    om.role as member_role,
    om.status as member_status,
    organization_is_writable(o.id) as project_writable,
    o.created_at
  from organization_members om
  join organizations o on o.id = om.organization_id
  where om.user_id = auth.uid()
    and om.status = 'active'
    and o.status <> 'archived'
  order by o.created_at desc;
$$;

revoke all on function list_my_organizations() from public, anon;
grant execute on function list_my_organizations() to authenticated, service_role;
