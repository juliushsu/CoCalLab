-- SOURCE ONLY. No cloud application/bucket creation/upload is authorized by this file.
-- Incremental review fixes; prerequisite 202611020001 remains unchanged.
begin;

-- New INSERT must use exactly the same lowercase project prefix as the receipt.
-- project_id() stays unchanged so legitimate uppercase legacy reads/deletes work.
create or replace function cocal_storage_private.document_id(bucket text, object_name text)
returns uuid language plpgsql immutable security invoker set search_path = '' as $$
declare filename text; project uuid; project_part text;
begin
  project := cocal_storage_private.project_id(bucket, object_name);
  if project is null then return null; end if;
  project_part := pg_catalog.split_part(object_name, '/', case when bucket = 'documents' then 1 else 2 end);
  if project_part is distinct from project::text then return null; end if;
  filename := pg_catalog.split_part(object_name, '/', case when bucket = 'documents' then 2 else 3 end);
  if filename !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](pdf|jpg|jpeg|png)$' then return null; end if;
  return pg_catalog.split_part(filename, '.', 1)::uuid;
end;
$$;

-- Additional client INSERT guard. Existing identity/state/object-owner checks in
-- 001 still run. No existing receipt or Storage row is rewritten or validated.
create function cocal_storage_private.guard_receipt_metadata()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare metadata_value jsonb; size_text text; object_size bigint; object_mime text;
begin
  if current_user not in ('authenticated','anon') then return new; end if;
  if current_user <> 'authenticated' then
    raise exception 'Authenticated upload receipt required' using errcode = '42501';
  end if;
  select o.metadata into metadata_value from storage.objects o
    where o.bucket_id = new.storage_bucket and o.name = new.storage_path;
  if pg_catalog.jsonb_typeof(metadata_value) is distinct from 'object'
    or pg_catalog.jsonb_typeof(metadata_value->'size') is distinct from 'number'
    or pg_catalog.jsonb_typeof(metadata_value->'mimetype') is distinct from 'string' then
    raise exception 'Missing or invalid Storage size/MIME metadata' using errcode = '42501';
  end if;
  size_text := metadata_value->>'size';
  -- JSON strings are deliberately rejected. Check text/range before casting so
  -- malformed, fractional, negative and overflowing sizes all fail with 42501.
  if size_text is null or size_text !~ '^[0-9]+$' or pg_catalog.length(size_text) > 19
    or (pg_catalog.length(size_text) = 19 and size_text collate "C" > '9223372036854775807' collate "C") then
    raise exception 'Storage size must be a range-safe JSON integer' using errcode = '42501';
  end if;
  object_size := size_text::bigint;
  object_mime := metadata_value->>'mimetype';
  if object_size <= 0 or object_size is distinct from new.file_size_bytes
    or object_mime is null or object_mime not in ('application/pdf','image/jpeg','image/png')
    or object_mime is distinct from new.mime_type then
    raise exception 'Receipt size/MIME does not match Storage metadata' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function cocal_storage_private.guard_receipt_metadata() from public, authenticated, anon;
create trigger cocal_receipt_metadata_guard before insert on public.uploaded_documents
for each row execute function cocal_storage_private.guard_receipt_metadata();

-- Owner-installed compatibility baseline, not a DDL administrator security boundary.
-- No application or service-role grant; no runtime learning/rebaselining path.
create table cocal_storage_private.deployment_baseline (
  kind text not null, object_key text not null, fingerprint text not null,
  primary key (kind, object_key)
);
revoke all on table cocal_storage_private.deployment_baseline from public, authenticated, anon, service_role;

create function cocal_storage_private.catalog_state()
returns table(kind text, object_key text, fingerprint text)
language sql stable security definer set search_path = '' as $$
  select 'policy'::text, p.polrelid::regclass::text || ':' || p.polname,
    pg_catalog.md5(pg_catalog.jsonb_build_object('command',p.polcmd,'permissive',p.polpermissive,
      'roles',p.polroles,'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid),
      'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid))::text)
  from pg_catalog.pg_policy p where
    (p.polrelid = 'storage.objects'::regclass and p.polname in
      ('cocal_upload_select_guard','cocal_upload_insert_guard','cocal_upload_update_guard','cocal_upload_delete_guard'))
    or (p.polrelid = 'public.uploaded_documents'::regclass and p.polname in
      ('cocal_receipt_select_guard','cocal_receipt_insert_guard','cocal_receipt_update_guard','cocal_receipt_delete_guard'))
  union all
  select 'trigger', t.tgrelid::regclass::text || ':' || t.tgname,
    pg_catalog.md5(pg_catalog.jsonb_build_object('definition',pg_catalog.pg_get_triggerdef(t.oid,false),
      'enabled',t.tgenabled,'type',t.tgtype,'function',t.tgfoid::regprocedure::text,'internal',t.tgisinternal)::text)
  from pg_catalog.pg_trigger t where t.tgrelid = 'public.uploaded_documents'::regclass
    and t.tgname in ('cocal_receipt_write_guard','cocal_receipt_metadata_guard')
  union all
  select 'function', p.oid::regprocedure::text,
    pg_catalog.md5(pg_catalog.jsonb_build_object('definition',pg_catalog.pg_get_functiondef(p.oid),
      'owner',pg_catalog.pg_get_userbyid(p.proowner),
      'acl',coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))::text,
      'config',coalesce(p.proconfig,array[]::text[]),'definer',p.prosecdef,
      'volatility',p.provolatile,'leakproof',p.proleakproof)::text)
  from pg_catalog.pg_proc p where p.pronamespace = 'cocal_storage_private'::regnamespace
    or p.oid in (pg_catalog.to_regprocedure('public.upload_intake_contract(uuid)'),
      pg_catalog.to_regprocedure('public.is_active_org_member(uuid,public.member_role[])'),
      pg_catalog.to_regprocedure('public.organization_is_writable(uuid)'),pg_catalog.to_regprocedure('auth.uid()'))
  union all
  select 'schema', n.nspname::text,
    pg_catalog.md5(pg_catalog.jsonb_build_object('owner',pg_catalog.pg_get_userbyid(n.nspowner),
      'acl',coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))::text)::text)
  from pg_catalog.pg_namespace n where n.nspname in ('cocal_storage_private','public','auth','storage')
  union all
  select 'baseline_table', c.oid::regclass::text,
    pg_catalog.md5(pg_catalog.jsonb_build_object('owner',pg_catalog.pg_get_userbyid(c.relowner),
      'acl',coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))::text,'rls',c.relrowsecurity)::text)
  from pg_catalog.pg_class c where c.oid = 'cocal_storage_private.deployment_baseline'::regclass;
$$;
revoke all on function cocal_storage_private.catalog_state() from public, authenticated, anon, service_role;

create or replace function cocal_storage_private.deployment_ready()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select count(*) = 3 from storage.buckets where id in ('documents','staging-receipts','staging-attachments') and public is false)
    and (select count(*) = 2 from pg_catalog.pg_class where oid in ('storage.objects'::regclass,'public.uploaded_documents'::regclass) and relrowsecurity)
    and exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.uploaded_documents'::regclass
      and tgname = 'cocal_receipt_write_guard' and tgtype = 23 and tgenabled in ('O','A') and not tgisinternal)
    and exists (select 1 from pg_catalog.pg_trigger where tgrelid = 'public.uploaded_documents'::regclass
      and tgname = 'cocal_receipt_metadata_guard' and tgtype = 7 and tgenabled in ('O','A') and not tgisinternal)
    and (select count(*) >= 20 from cocal_storage_private.deployment_baseline)
    and not exists (
      (select kind,object_key,fingerprint from cocal_storage_private.catalog_state()
       except select kind,object_key,fingerprint from cocal_storage_private.deployment_baseline)
      union all
      (select kind,object_key,fingerprint from cocal_storage_private.deployment_baseline
       except select kind,object_key,fingerprint from cocal_storage_private.catalog_state())
    ), false);
$$;
revoke all on function cocal_storage_private.deployment_ready() from public, authenticated, anon;

create or replace function public.upload_intake_contract(p_project_id uuid)
returns table(project_id uuid, organization_id uuid, contract_version text, can_write boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.organization_id, '20261102.2'::text,
    coalesce(cocal_storage_private.project_access(p.id, true) and cocal_storage_private.deployment_ready(),false)
  from public.projects p where p.id = p_project_id
    and cocal_storage_private.org_access(p.organization_id, false);
$$;
revoke all on function public.upload_intake_contract(uuid) from public, anon, authenticated;
grant execute on function public.upload_intake_contract(uuid) to authenticated;
comment on function public.upload_intake_contract(uuid) is
  'Read-only scoped compatibility probe, contract 20261102.2; never substitutes for per-write RLS/triggers';

-- Capture only after all source definitions and ACLs are installed. A future
-- approved migration must explicitly replace this baseline; probes never modify it.
insert into cocal_storage_private.deployment_baseline(kind,object_key,fingerprint)
select kind,object_key,fingerprint from cocal_storage_private.catalog_state();
comment on table cocal_storage_private.deployment_baseline is
  'Owner-installed source compatibility snapshot; not tamper-proof against DDL owners; app cannot read/write';
commit;
