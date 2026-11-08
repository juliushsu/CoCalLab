-- SOURCE CANDIDATE ONLY. N4-R1 native red case is between two draft triggers.
-- Scope checks remain authoritative; this early trigger establishes lock order.
begin;
do $$begin
 if not cocal_delete_private.deployment_ready() then
  raise exception 'Existing deletion source drift; do not rebaseline unknown source';
 end if;
end;$$;

create function cocal_manual_private.lock_draft_project_first() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('role',true),'none') not in('authenticated','anon') then return new;end if;
 if tg_op='UPDATE' and(new.organization_id,new.project_id) is distinct from(old.organization_id,old.project_id) then
  raise exception 'DRAFT_DOCUMENT_SCOPE_DENIED' using errcode='42501';
 end if;
 perform cocal_attachment_private.assert_write(new.organization_id,new.project_id,auth.uid());
 perform 1 from public.projects p where p.id=new.project_id and p.organization_id=new.organization_id for no key update;
 if not found then raise exception 'DRAFT_DOCUMENT_SCOPE_DENIED' using errcode='42501';end if;
 return new;
end;$$;
revoke all on function cocal_manual_private.lock_draft_project_first() from public,anon,authenticated,service_role;

-- Alphabetical BEFORE-trigger order: project -> deletion fence -> MANUAL guard.
-- Existing deletion/reference and protect_manual_draft checks are retained.
create trigger a_draft_project_lock before insert or update on public.extracted_document_drafts
for each row execute function cocal_manual_private.lock_draft_project_first();

-- This new private helper/trigger is outside the deletion baseline's named set.
-- Do not refresh any prior fingerprint, grant or policy.
do $$begin
 if not cocal_delete_private.deployment_ready() then
  raise exception 'Unexpected deletion source drift after draft lock ordering';
 end if;
end;$$;
commit;
