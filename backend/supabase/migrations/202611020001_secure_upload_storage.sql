-- SOURCE ONLY: requires Owner approval and Storage/JWT preflight before cloud application.
-- No object moves/deletes, legacy receipt rewrites, or new core data models.
begin;

-- Public drift is a deployment blocker, not something this migration silently repairs.
do $$
begin
  if exists (select 1 from storage.buckets
    where id in ('documents', 'staging-receipts', 'staging-attachments') and public is distinct from false) then
    raise exception 'Protected upload bucket is public; Owner review required' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.buckets where id = 'staging-receipts')
     or not exists (select 1 from storage.buckets where id = 'staging-attachments') then
    raise exception 'Apply staging bucket prerequisite before secure uploads';
  end if;
end;
$$;
-- This definition is not authorization to create the bucket in any cloud project.
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

create schema if not exists cocal_storage_private;
revoke all on schema cocal_storage_private from public;
grant usage on schema cocal_storage_private to authenticated, anon, service_role;

-- Legacy reads/deletes retain exactly one basename below the existing project prefix.
-- No casts of unvalidated path input: malformed/traversal names return NULL.
create function cocal_storage_private.project_id(bucket text, object_name text)
returns uuid language plpgsql immutable security invoker set search_path = '' as $$
declare parts text[]; project_part text; filename text;
begin
  parts := pg_catalog.string_to_array(object_name, '/');
  if bucket in ('staging-receipts', 'staging-attachments') and pg_catalog.array_length(parts, 1) = 3 and parts[1] = 'staging' then
    project_part := parts[2]; filename := parts[3];
  elsif bucket = 'documents' and pg_catalog.array_length(parts, 1) = 2 then
    project_part := parts[1]; filename := parts[2];
  else return null;
  end if;
  if project_part !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     or filename is null or filename = '' or filename in ('.', '..') then return null; end if;
  return project_part::uuid;
end;
$$;

create function cocal_storage_private.document_id(bucket text, object_name text)
returns uuid language plpgsql immutable security invoker set search_path = '' as $$
declare filename text;
begin
  if cocal_storage_private.project_id(bucket, object_name) is null then return null; end if;
  filename := pg_catalog.split_part(object_name, '/', case when bucket = 'documents' then 2 else 3 end);
  if filename !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](pdf|jpg|jpeg|png)$' then return null; end if;
  return pg_catalog.split_part(filename, '.', 1)::uuid;
end;
$$;

-- Private boolean helpers expose neither project rows nor a bypassing public lookup RPC.
create function cocal_storage_private.org_access(org_id uuid, writing boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.organizations o where o.id = org_id and o.status = 'active'
      and public.is_active_org_member(o.id, case when writing
        then array['owner','admin','editor']::public.member_role[] else null end)
      and (not writing or public.organization_is_writable(o.id))
  );
$$;
create function cocal_storage_private.project_access(project uuid, writing boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects p where p.id = project
    and cocal_storage_private.org_access(p.organization_id, writing));
$$;

-- NOT VALID tenant constraints do not attest existing receipt bindings. Preserve
-- legacy basenames/hash/environment, but never treat a mixed tenant/path as valid.
create function cocal_storage_private.receipt_binding(org_id uuid, project uuid, bucket text, object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projects p where p.id = project
    and p.organization_id = org_id
    and pg_catalog.current_setting('role', true) = 'authenticated'
    and cocal_storage_private.org_access(org_id, false)
    and p.id = cocal_storage_private.project_id(bucket, object_name));
$$;

revoke all on all functions in schema cocal_storage_private from public;
grant execute on all functions in schema cocal_storage_private to authenticated, anon, service_role;

-- Restrictive PUBLIC guards AND with every permissive policy, including old staging
-- policies or a mistakenly broad future policy. Unrelated buckets are unchanged.
create policy cocal_upload_select_guard on storage.objects as restrictive for select to public
using (case when bucket_id in ('documents','staging-receipts','staging-attachments') then
  current_user = 'authenticated' and cocal_storage_private.project_access(cocal_storage_private.project_id(bucket_id,name), false)
  else true end);
create policy cocal_upload_insert_guard on storage.objects as restrictive for insert to public
with check (case when bucket_id in ('documents','staging-receipts','staging-attachments') then
  current_user = 'authenticated' and cocal_storage_private.document_id(bucket_id,name) is not null
    and cocal_storage_private.project_access(cocal_storage_private.project_id(bucket_id,name), true)
  else true end);
create policy cocal_upload_delete_guard on storage.objects as restrictive for delete to public
using (case when bucket_id in ('documents','staging-receipts','staging-attachments') then
  current_user = 'authenticated' and cocal_storage_private.project_access(cocal_storage_private.project_id(bucket_id,name), true)
  else true end);
create policy cocal_upload_update_guard on storage.objects as restrictive for update to public
using (bucket_id not in ('documents','staging-receipts','staging-attachments'))
with check (bucket_id not in ('documents','staging-receipts','staging-attachments'));

-- Necessary allow policies for documents; guards above remain authoritative.
create policy cocal_upload_select_allow on storage.objects for select to authenticated
using (bucket_id in ('documents','staging-receipts','staging-attachments')
  and cocal_storage_private.project_access(cocal_storage_private.project_id(bucket_id,name), false));
create policy cocal_upload_insert_allow on storage.objects for insert to authenticated
with check (bucket_id in ('documents','staging-receipts','staging-attachments')
  and cocal_storage_private.document_id(bucket_id,name) is not null
  and cocal_storage_private.project_access(cocal_storage_private.project_id(bucket_id,name), true));
create policy cocal_upload_delete_allow on storage.objects for delete to authenticated
using (bucket_id in ('documents','staging-receipts','staging-attachments')
  and cocal_storage_private.project_access(cocal_storage_private.project_id(bucket_id,name), true));

-- Keep legacy SELECT shape but prevent permissive-policy drift from bypassing tenancy.
create policy cocal_receipt_select_guard on public.uploaded_documents as restrictive for select to public
using (current_user = 'authenticated' and cocal_storage_private.org_access(organization_id, false)
  and cocal_storage_private.receipt_binding(organization_id, project_id, storage_bucket, storage_path));
create policy cocal_receipt_insert_guard on public.uploaded_documents as restrictive for insert to public
with check (current_user = 'authenticated' and cocal_storage_private.org_access(organization_id, true));
create policy cocal_receipt_update_guard on public.uploaded_documents as restrictive for update to public
using (false) with check (false);
create policy cocal_receipt_delete_guard on public.uploaded_documents as restrictive for delete to public
using (current_user = 'authenticated' and cocal_storage_private.org_access(organization_id, true)
  and cocal_storage_private.receipt_binding(organization_id, project_id, storage_bucket, storage_path));

-- Trigger checks stay effective even if another permissive INSERT policy is added.
-- Only trusted database maintenance roles bypass this guard; JWT claims cannot do so.
create function cocal_storage_private.guard_receipt_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare expected_project uuid; expected_document uuid; expected_prefix text;
begin
  if current_user not in ('authenticated','anon') then return new; end if;
  if current_user <> 'authenticated' or tg_op <> 'INSERT' then
    raise exception 'Client receipt updates are disabled; use authorized maintenance' using errcode = '42501';
  end if;
  expected_project := cocal_storage_private.project_id(new.storage_bucket, new.storage_path);
  expected_document := cocal_storage_private.document_id(new.storage_bucket, new.storage_path);
  expected_prefix := case when new.storage_bucket = 'documents' then '' else 'staging/' end;
  if auth.uid() is null or new.uploaded_by_user_id is distinct from auth.uid()
    or expected_document is null or expected_document is distinct from new.id
    or expected_project is distinct from new.project_id
    or new.storage_path not like expected_prefix || new.project_id::text || '/%'
    or not cocal_storage_private.org_access(new.organization_id, true)
    or not exists (select 1 from public.projects p where p.id = new.project_id and p.organization_id = new.organization_id)
    or new.ocr_status <> 'pending' or new.status <> 'active' or new.archived_at is not null
    or new.file_size_bytes <= 0 or new.sha256_hash !~ '^[0-9a-f]{64}$'
    or pg_catalog.btrim(new.original_filename) = '' then
    raise exception 'Invalid upload receipt identity or initial state' using errcode = '42501';
  end if;
  if (new.storage_bucket = 'documents' and (new.env is distinct from 'production' or new.is_test is distinct from false))
    or (new.storage_bucket in ('staging-receipts','staging-attachments') and (new.env is distinct from 'staging' or new.is_test is distinct from true)) then
    raise exception 'Upload receipt environment does not match bucket' using errcode = '42501';
  end if;
  -- to_jsonb supports deployed Storage catalog versions with owner_id or legacy owner.
  -- Missing ownership metadata fails closed. SQL cannot attest file bytes/hash content.
  if not exists (select 1 from storage.objects o where o.bucket_id = new.storage_bucket and o.name = new.storage_path
    and coalesce(nullif(pg_catalog.to_jsonb(o)->>'owner_id',''), pg_catalog.to_jsonb(o)->>'owner') = auth.uid()::text) then
    raise exception 'Upload object is missing, inaccessible, or belongs to another uploader' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function cocal_storage_private.guard_receipt_write() from public, authenticated, anon;
create trigger cocal_receipt_write_guard before insert or update on public.uploaded_documents
for each row execute function cocal_storage_private.guard_receipt_write();

-- Runtime capability probe. Absence of this exact versioned RPC on an older
-- deployment must stop the client before sending file bytes.
create function cocal_storage_private.deployment_ready()
returns boolean language sql stable security definer set search_path = '' as $$
  select
    (select count(*) = 3 from storage.buckets where id in ('documents','staging-receipts','staging-attachments') and public is false)
    and (select count(*) = 2 from pg_catalog.pg_class where oid in ('storage.objects'::regclass,'public.uploaded_documents'::regclass) and relrowsecurity)
    and not exists (
      select 1 from (values
        ('storage.objects'::regclass, 'cocal_upload_select_guard', 'r'),
        ('storage.objects'::regclass, 'cocal_upload_insert_guard', 'a'),
        ('storage.objects'::regclass, 'cocal_upload_update_guard', 'w'),
        ('storage.objects'::regclass, 'cocal_upload_delete_guard', 'd'),
        ('public.uploaded_documents'::regclass, 'cocal_receipt_select_guard', 'r'),
        ('public.uploaded_documents'::regclass, 'cocal_receipt_insert_guard', 'a'),
        ('public.uploaded_documents'::regclass, 'cocal_receipt_update_guard', 'w'),
        ('public.uploaded_documents'::regclass, 'cocal_receipt_delete_guard', 'd')
      ) as expected(relation, policy_name, command)
      left join pg_catalog.pg_policy p on p.polrelid = expected.relation and p.polname = expected.policy_name
      where p.oid is null or p.polpermissive or p.polcmd::text <> expected.command
        or p.polroles <> array[0::oid]
    )
    and exists (select 1 from pg_catalog.pg_trigger t
      where t.tgrelid = 'public.uploaded_documents'::regclass and t.tgname = 'cocal_receipt_write_guard'
        and not t.tgisinternal and t.tgenabled in ('O','A')
        and t.tgfoid = pg_catalog.to_regprocedure('cocal_storage_private.guard_receipt_write()'));
$$;
revoke all on function cocal_storage_private.deployment_ready() from public, authenticated, anon;

create function public.upload_intake_contract(p_project_id uuid)
returns table(project_id uuid, organization_id uuid, contract_version text, can_write boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.organization_id, '20261102'::text,
    cocal_storage_private.project_access(p.id, true) and cocal_storage_private.deployment_ready()
  from public.projects p where p.id = p_project_id
    and cocal_storage_private.org_access(p.organization_id, false);
$$;
revoke all on function public.upload_intake_contract(uuid) from public, anon, authenticated;
grant execute on function public.upload_intake_contract(uuid) to authenticated;
comment on function public.upload_intake_contract(uuid) is
  'Read-only scoped upload readiness probe, contract 20261102; no rows for inaccessible projects';

comment on schema cocal_storage_private is 'Private upload policy helpers; not a public PostgREST RPC schema';
commit;
