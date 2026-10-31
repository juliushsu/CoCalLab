-- Keep project identity and tenant binding stable during user-JWT updates.
-- Existing profile/lifecycle policies, grants and maintenance authority are unchanged.
-- Apply only after isolated validation and the normal deployment approval.
create or replace function guard_project_identity_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  -- The database role is authoritative; caller-controlled JWT settings are not.
  if current_user in ('authenticated', 'anon')
     and (new.id is distinct from old.id
       or new.organization_id is distinct from old.organization_id) then
    raise exception 'Project identity and organization binding cannot be changed'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_identity_guard on projects;
create trigger trg_projects_identity_guard
before update on projects
for each row execute function guard_project_identity_update();
