-- Enable workspace profile editing through the existing user-JWT/RLS client.
-- No grants, service-role elevation, lifecycle changes, or tenant reassignment.
-- Source-only migration: apply only after isolated database validation and approval.

create or replace function guard_organization_profile_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  -- Use the actual database role, not caller-controlled request JWT settings.
  -- Existing SECURITY DEFINER maintenance functions execute as their owner and
  -- retain their current authority; this trigger does not grant that authority.
  if current_user in ('authenticated', 'anon') then
    if (to_jsonb(new) - array[
      'legal_name', 'display_name', 'tax_id', 'country_code', 'timezone', 'updated_at'
    ]) is distinct from (to_jsonb(old) - array[
      'legal_name', 'display_name', 'tax_id', 'country_code', 'timezone', 'updated_at'
    ]) then
      raise exception 'Only organization profile fields may be updated'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- PostgreSQL orders same-event triggers alphabetically. This guard runs before
-- trg_organizations_updated_at; updated_at is ignored so either order is safe.
drop trigger if exists trg_organizations_profile_fields_guard on organizations;
create trigger trg_organizations_profile_fields_guard
before update on organizations
for each row execute function guard_organization_profile_update();

-- SELECT continues to use the existing active-membership policy. UPDATE is
-- limited to owner/admin of the same old/new organization and writable plan.
drop policy if exists organizations_profile_update_policy on organizations;
create policy organizations_profile_update_policy
  on organizations for update to authenticated
  using (
    is_active_org_member(id, array['owner', 'admin']::member_role[])
    and organization_is_writable(id)
  )
  with check (
    is_active_org_member(id, array['owner', 'admin']::member_role[])
    and organization_is_writable(id)
  );
