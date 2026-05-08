-- P1 staging fix: organization creation must create active owner membership.
-- Scope: staging bugfix only, no product feature expansion.

create or replace function create_organization_with_owner(
  p_slug citext,
  p_legal_name text,
  p_display_name text,
  p_tax_id text default null,
  p_country_code char(2) default 'TW',
  p_timezone text default 'Asia/Taipei'
)
returns table (
  organization_id uuid,
  membership_id uuid,
  role member_role,
  membership_status member_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_member_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'auth_required';
  end if;

  insert into organizations (
    slug,
    legal_name,
    display_name,
    tax_id,
    country_code,
    timezone,
    status,
    env,
    is_test
  )
  values (
    p_slug,
    p_legal_name,
    p_display_name,
    p_tax_id,
    coalesce(p_country_code, 'TW'),
    coalesce(p_timezone, 'Asia/Taipei'),
    'active',
    'staging',
    true
  )
  returning id into v_org_id;

  insert into organization_members (
    organization_id,
    user_id,
    role,
    status,
    joined_at,
    env,
    is_test
  )
  values (
    v_org_id,
    v_user_id,
    'owner',
    'active',
    now(),
    'staging',
    true
  )
  on conflict (organization_id, user_id)
  do update set
    role = 'owner',
    status = 'active',
    joined_at = coalesce(organization_members.joined_at, excluded.joined_at),
    env = 'staging',
    is_test = true,
    updated_at = now()
  returning id into v_member_id;

  insert into audit_logs (
    organization_id,
    actor_user_id,
    actor_type,
    action,
    entity_type,
    entity_id,
    status,
    metadata,
    env,
    is_test
  )
  values (
    v_org_id,
    v_user_id,
    'user',
    'create_organization_with_owner',
    'organization',
    v_org_id,
    'recorded',
    jsonb_build_object(
      'membership_id', v_member_id,
      'membership_role', 'owner',
      'membership_status', 'active'
    ),
    'staging',
    true
  );

  return query
  select
    v_org_id,
    v_member_id,
    'owner'::member_role,
    'active'::member_status;
end;
$$;

create or replace function ensure_organization_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return new;
  end if;

  insert into organization_members (
    organization_id,
    user_id,
    role,
    status,
    joined_at,
    env,
    is_test
  )
  values (
    new.id,
    v_user_id,
    'owner',
    'active',
    now(),
    coalesce(new.env, 'staging'),
    coalesce(new.is_test, true)
  )
  on conflict (organization_id, user_id)
  do update set
    role = 'owner',
    status = 'active',
    joined_at = coalesce(organization_members.joined_at, excluded.joined_at),
    env = coalesce(new.env, 'staging'),
    is_test = coalesce(new.is_test, true),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_organizations_auto_owner_membership on organizations;
create trigger trg_organizations_auto_owner_membership
after insert on organizations
for each row
execute function ensure_organization_owner_membership();

revoke all on function create_organization_with_owner(citext, text, text, text, char(2), text)
  from public, anon;
grant execute on function create_organization_with_owner(citext, text, text, text, char(2), text)
  to authenticated, service_role;
