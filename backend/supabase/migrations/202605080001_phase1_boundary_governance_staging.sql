-- CoCalLab Phase 1 boundary governance execution pack (staging-first)
-- Additive only. Do not rename organizations. Current semantic: organizations = workspaces.

begin;

-- ===== Phase 1 canonical boundary tables =====

create table if not exists legal_entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references organizations(id) on delete cascade,
  entity_code text not null,
  registered_name text not null,
  display_name text not null,
  tax_id text,
  country_code char(2) not null default 'TW',
  registration_address text,
  industry_code text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  env text not null default 'production',
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists legal_entities_workspace_code_uniq
  on legal_entities (workspace_id, entity_code);

create unique index if not exists legal_entities_workspace_tax_id_uniq
  on legal_entities (workspace_id, country_code, tax_id)
  where tax_id is not null;

create index if not exists legal_entities_workspace_status_idx
  on legal_entities (workspace_id, status, created_at desc);

drop trigger if exists trg_legal_entities_updated_at on legal_entities;
create trigger trg_legal_entities_updated_at
before update on legal_entities
for each row execute function set_updated_at();

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references organizations(id) on delete cascade,
  legal_entity_id uuid not null references legal_entities(id) on delete restrict,
  site_code text not null,
  site_name text not null,
  facility_type text,
  address text,
  country_code char(2) not null default 'TW',
  timezone text not null default 'Asia/Taipei',
  latitude numeric(10,7),
  longitude numeric(10,7),
  cbam_installation_ref text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  env text not null default 'production',
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sites_workspace_entity_code_uniq
  on sites (workspace_id, legal_entity_id, site_code);

create index if not exists sites_workspace_status_idx
  on sites (workspace_id, status, created_at desc);

drop trigger if exists trg_sites_updated_at on sites;
create trigger trg_sites_updated_at
before update on sites
for each row execute function set_updated_at();

-- ===== Project compatibility columns =====

alter table projects
  add column if not exists legal_entity_id uuid references legal_entities(id) on delete set null,
  add column if not exists site_id uuid references sites(id) on delete set null;

create index if not exists projects_legal_entity_idx
  on projects (legal_entity_id, status, reporting_start_date, reporting_end_date);

create index if not exists projects_site_idx
  on projects (site_id, status, reporting_start_date, reporting_end_date);

-- ===== Report immutable snapshot columns =====

alter table report_generations
  add column if not exists legal_entity_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists site_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists boundary_snapshot jsonb not null default '{}'::jsonb;

-- ===== Compatibility helper functions =====

create or replace function get_workspace_id(p_organization_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p_organization_id;
$$;

create or replace function get_project_workspace_id(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.organization_id
  from projects p
  where p.id = p_project_id;
$$;

create or replace function get_project_legal_entity_id(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.legal_entity_id
  from projects p
  where p.id = p_project_id;
$$;

create or replace function get_project_site_id(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.site_id
  from projects p
  where p.id = p_project_id;
$$;

create or replace view project_boundary_context_v
with (security_invoker = true) as
select
  p.id as project_id,
  p.organization_id as workspace_id,
  o.display_name as workspace_label,
  p.legal_entity_id,
  le.display_name as legal_entity_label,
  p.site_id,
  s.site_name as site_label,
  p.boundary_type,
  p.reporting_start_date,
  p.reporting_end_date
from projects p
join organizations o on o.id = p.organization_id
left join legal_entities le on le.id = p.legal_entity_id
left join sites s on s.id = p.site_id;

-- ===== RLS helper-first strategy =====
-- These helpers preserve current organization_members semantics while giving
-- future policies stable workspace/entity/site names.

create or replace function is_workspace_member(
  p_workspace_id uuid,
  p_allowed_roles member_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_active_org_member(p_workspace_id, p_allowed_roles);
$$;

create or replace function can_access_legal_entity(
  p_legal_entity_id uuid,
  p_allowed_roles member_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from legal_entities le
    where le.id = p_legal_entity_id
      and is_workspace_member(le.workspace_id, p_allowed_roles)
  );
$$;

create or replace function can_access_site(
  p_site_id uuid,
  p_allowed_roles member_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from sites s
    where s.id = p_site_id
      and is_workspace_member(s.workspace_id, p_allowed_roles)
  );
$$;

create or replace function can_access_project(
  p_project_id uuid,
  p_allowed_roles member_role[] default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from projects p
    where p.id = p_project_id
      and is_workspace_member(p.organization_id, p_allowed_roles)
      and (
        p.legal_entity_id is null
        or can_access_legal_entity(p.legal_entity_id, p_allowed_roles)
      )
      and (
        p.site_id is null
        or can_access_site(p.site_id, p_allowed_roles)
      )
  );
$$;

-- ===== RLS for new tables only =====

alter table legal_entities enable row level security;
alter table sites enable row level security;

drop policy if exists legal_entities_select_policy on legal_entities;
create policy legal_entities_select_policy
  on legal_entities for select
  using (is_workspace_member(workspace_id));

drop policy if exists legal_entities_write_policy on legal_entities;
create policy legal_entities_write_policy
  on legal_entities for all
  using (is_workspace_member(workspace_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_workspace_member(workspace_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(workspace_id)
  );

drop policy if exists sites_select_policy on sites;
create policy sites_select_policy
  on sites for select
  using (
    is_workspace_member(workspace_id)
    and can_access_legal_entity(legal_entity_id)
  );

drop policy if exists sites_write_policy on sites;
create policy sites_write_policy
  on sites for all
  using (
    is_workspace_member(workspace_id, array['owner', 'admin', 'editor']::member_role[])
    and can_access_legal_entity(legal_entity_id, array['owner', 'admin', 'editor']::member_role[])
  )
  with check (
    is_workspace_member(workspace_id, array['owner', 'admin', 'editor']::member_role[])
    and can_access_legal_entity(legal_entity_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(workspace_id)
  );

grant execute on function get_workspace_id(uuid) to authenticated, service_role;
grant execute on function get_project_workspace_id(uuid) to authenticated, service_role;
grant execute on function get_project_legal_entity_id(uuid) to authenticated, service_role;
grant execute on function get_project_site_id(uuid) to authenticated, service_role;
grant execute on function is_workspace_member(uuid, member_role[]) to authenticated, service_role;
grant execute on function can_access_project(uuid, member_role[]) to authenticated, service_role;
grant execute on function can_access_legal_entity(uuid, member_role[]) to authenticated, service_role;
grant execute on function can_access_site(uuid, member_role[]) to authenticated, service_role;
grant select on project_boundary_context_v to authenticated, service_role;

commit;
