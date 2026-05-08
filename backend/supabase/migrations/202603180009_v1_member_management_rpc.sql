-- Closed-beta minimal member management RPCs
-- Scope: add / update role / deactivate

create or replace function add_organization_member(
  p_organization_id uuid,
  p_role member_role,
  p_status member_status,
  p_user_id uuid default null,
  p_invited_email citext default null
)
returns table (
  member_id uuid,
  organization_id uuid,
  user_id uuid,
  invited_email citext,
  role member_role,
  status member_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid;
  v_actor_role member_role;
  v_actor_status member_status;
  v_member_id uuid;
begin
  v_actor_user_id := auth.uid();

  if v_actor_user_id is null then
    raise exception 'auth_required';
  end if;

  select om.role, om.status
  into v_actor_role, v_actor_status
  from organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = v_actor_user_id
  order by om.created_at desc
  limit 1;

  if v_actor_role is null or v_actor_status <> 'active' then
    raise exception 'forbidden_not_active_member';
  end if;

  if v_actor_role = 'owner' then
    if p_role not in ('admin', 'editor', 'viewer') then
      raise exception 'forbidden_owner_add_role';
    end if;
  elsif v_actor_role = 'admin' then
    if p_role not in ('editor', 'viewer') then
      raise exception 'forbidden_admin_add_role';
    end if;
  else
    raise exception 'forbidden_role_cannot_add_member';
  end if;

  if p_status not in ('active', 'invited') then
    raise exception 'invalid_status_for_add_member';
  end if;

  if (p_user_id is null and p_invited_email is null)
     or (p_user_id is not null and p_invited_email is not null) then
    raise exception 'exactly_one_identity_required';
  end if;

  if p_status = 'active' and p_user_id is null then
    raise exception 'active_requires_user_id';
  end if;

  if p_status = 'invited' and p_invited_email is null then
    raise exception 'invited_requires_email';
  end if;

  if p_user_id is not null then
    select om.id
    into v_member_id
    from organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = p_user_id
    order by om.created_at desc
    limit 1;

    if v_member_id is null then
      insert into organization_members (
        organization_id,
        user_id,
        invited_email,
        role,
        status,
        invited_at,
        joined_at,
        env,
        is_test
      )
      values (
        p_organization_id,
        p_user_id,
        null,
        p_role,
        p_status,
        case when p_status = 'invited' then now() else null end,
        case when p_status = 'active' then now() else null end,
        'staging',
        true
      )
      returning id into v_member_id;
    else
      update organization_members om
      set
        role = p_role,
        status = p_status,
        invited_email = null,
        invited_at = case when p_status = 'invited' then now() else om.invited_at end,
        joined_at = case when p_status = 'active' then coalesce(om.joined_at, now()) else om.joined_at end,
        env = 'staging',
        is_test = true
      where om.id = v_member_id;
    end if;
  else
    select om.id
    into v_member_id
    from organization_members om
    where om.organization_id = p_organization_id
      and om.invited_email = p_invited_email
    order by om.created_at desc
    limit 1;

    if v_member_id is null then
      insert into organization_members (
        organization_id,
        user_id,
        invited_email,
        role,
        status,
        invited_at,
        joined_at,
        env,
        is_test
      )
      values (
        p_organization_id,
        null,
        p_invited_email,
        p_role,
        p_status,
        now(),
        null,
        'staging',
        true
      )
      returning id into v_member_id;
    else
      update organization_members om
      set
        role = p_role,
        status = p_status,
        invited_email = p_invited_email,
        invited_at = now(),
        env = 'staging',
        is_test = true
      where om.id = v_member_id;
    end if;
  end if;

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
    p_organization_id,
    v_actor_user_id,
    'user',
    'add_organization_member',
    'organization_member',
    v_member_id,
    'recorded',
    jsonb_build_object(
      'role', p_role,
      'status', p_status,
      'user_id', p_user_id,
      'invited_email', p_invited_email
    ),
    'staging',
    true
  );

  return query
  select om.id, om.organization_id, om.user_id, om.invited_email, om.role, om.status
  from organization_members om
  where om.id = v_member_id;
end;
$$;

create or replace function update_organization_member_role(
  p_organization_id uuid,
  p_member_id uuid,
  p_new_role member_role
)
returns table (
  member_id uuid,
  organization_id uuid,
  user_id uuid,
  invited_email citext,
  role member_role,
  status member_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid;
  v_actor_role member_role;
  v_actor_status member_status;
  v_target_user_id uuid;
  v_target_role member_role;
  v_target_status member_status;
begin
  v_actor_user_id := auth.uid();

  if v_actor_user_id is null then
    raise exception 'auth_required';
  end if;

  select om.role, om.status
  into v_actor_role, v_actor_status
  from organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = v_actor_user_id
  order by om.created_at desc
  limit 1;

  if v_actor_role is null or v_actor_status <> 'active' then
    raise exception 'forbidden_not_active_member';
  end if;

  if v_actor_role not in ('owner', 'admin') then
    raise exception 'forbidden_role_cannot_update_member_role';
  end if;

  if p_new_role not in ('admin', 'editor', 'viewer') then
    raise exception 'invalid_target_role';
  end if;

  select om.user_id, om.role, om.status
  into v_target_user_id, v_target_role, v_target_status
  from organization_members om
  where om.id = p_member_id
    and om.organization_id = p_organization_id
  for update;

  if v_target_role is null then
    raise exception 'member_not_found';
  end if;

  if v_target_user_id = v_actor_user_id then
    raise exception 'self_role_change_blocked';
  end if;

  if v_actor_role = 'admin' then
    if v_target_role not in ('editor', 'viewer') then
      raise exception 'forbidden_admin_cannot_change_target_role';
    end if;

    if p_new_role not in ('editor', 'viewer') then
      raise exception 'forbidden_admin_cannot_set_role';
    end if;
  elsif v_actor_role = 'owner' then
    if v_target_role = 'owner' then
      raise exception 'forbidden_owner_target';
    end if;
  end if;

  update organization_members om
  set role = p_new_role,
      env = 'staging',
      is_test = true
  where om.id = p_member_id;

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
    p_organization_id,
    v_actor_user_id,
    'user',
    'update_organization_member_role',
    'organization_member',
    p_member_id,
    'recorded',
    jsonb_build_object(
      'new_role', p_new_role,
      'previous_role', v_target_role,
      'target_status', v_target_status
    ),
    'staging',
    true
  );

  return query
  select om.id, om.organization_id, om.user_id, om.invited_email, om.role, om.status
  from organization_members om
  where om.id = p_member_id;
end;
$$;

create or replace function deactivate_organization_member(
  p_organization_id uuid,
  p_member_id uuid
)
returns table (
  member_id uuid,
  organization_id uuid,
  user_id uuid,
  invited_email citext,
  role member_role,
  status member_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid;
  v_actor_role member_role;
  v_actor_status member_status;
  v_target_user_id uuid;
  v_target_role member_role;
  v_target_status member_status;
begin
  v_actor_user_id := auth.uid();

  if v_actor_user_id is null then
    raise exception 'auth_required';
  end if;

  select om.role, om.status
  into v_actor_role, v_actor_status
  from organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = v_actor_user_id
  order by om.created_at desc
  limit 1;

  if v_actor_role is null or v_actor_status <> 'active' then
    raise exception 'forbidden_not_active_member';
  end if;

  if v_actor_role not in ('owner', 'admin') then
    raise exception 'forbidden_role_cannot_deactivate_member';
  end if;

  select om.user_id, om.role, om.status
  into v_target_user_id, v_target_role, v_target_status
  from organization_members om
  where om.id = p_member_id
    and om.organization_id = p_organization_id
  for update;

  if v_target_role is null then
    raise exception 'member_not_found';
  end if;

  if v_target_user_id = v_actor_user_id then
    raise exception 'self_deactivate_blocked';
  end if;

  if v_target_role = 'owner' then
    raise exception 'owner_deactivate_blocked';
  end if;

  if v_actor_role = 'admin' and v_target_role not in ('editor', 'viewer') then
    raise exception 'forbidden_admin_cannot_deactivate_target';
  end if;

  update organization_members om
  set status = 'inactive',
      env = 'staging',
      is_test = true
  where om.id = p_member_id;

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
    p_organization_id,
    v_actor_user_id,
    'user',
    'deactivate_organization_member',
    'organization_member',
    p_member_id,
    'recorded',
    jsonb_build_object(
      'previous_status', v_target_status,
      'target_role', v_target_role
    ),
    'staging',
    true
  );

  return query
  select om.id, om.organization_id, om.user_id, om.invited_email, om.role, om.status
  from organization_members om
  where om.id = p_member_id;
end;
$$;

revoke all on function add_organization_member(uuid, member_role, member_status, uuid, citext)
  from public, anon;
revoke all on function update_organization_member_role(uuid, uuid, member_role)
  from public, anon;
revoke all on function deactivate_organization_member(uuid, uuid)
  from public, anon;

grant execute on function add_organization_member(uuid, member_role, member_status, uuid, citext)
  to authenticated, service_role;
grant execute on function update_organization_member_role(uuid, uuid, member_role)
  to authenticated, service_role;
grant execute on function deactivate_organization_member(uuid, uuid)
  to authenticated, service_role;
