-- SOURCE ONLY. Owner approval is required before any cloud application.
begin;
do $$begin
 if not cocal_storage_private.deployment_ready() then raise exception 'Existing upload source drift; do not learn/rebaseline unknown policies'; end if;
end;$$;
create schema cocal_attachment_private;
revoke all on schema cocal_attachment_private from public,anon,authenticated,service_role;
create table cocal_attachment_private.verifications(
 document_id uuid primary key,organization_id uuid not null references organizations(id),project_id uuid not null references projects(id),
 actor_user_id uuid not null,request_id text not null,bucket text not null,path text not null,storage_object_id uuid not null,
 owner_id text not null,file_size_bytes bigint not null check(file_size_bytes between 1 and 10485760),mime_type text not null,
 object_metadata jsonb not null,intent jsonb not null,state text not null default 'reserved' check(state in ('reserved','verified','duplicate')),
 sha256_hash text,verified_at timestamptz,duplicate_of_document_id uuid,created_at timestamptz not null default clock_timestamp(),
 unique(organization_id,project_id,request_id),unique(bucket,path),
 check((state='reserved' and sha256_hash is null and verified_at is null and duplicate_of_document_id is null)
 or(state='verified' and sha256_hash~'^[0-9a-f]{64}$' and verified_at is not null and duplicate_of_document_id is null)
 or(state='duplicate' and sha256_hash~'^[0-9a-f]{64}$' and verified_at is not null and duplicate_of_document_id is not null and duplicate_of_document_id<>document_id))
);
alter table cocal_attachment_private.verifications enable row level security;
revoke all on cocal_attachment_private.verifications from public,anon,authenticated,service_role;

-- Existing statements remain untouched and explicitly historical/unverified.
alter table uploaded_documents add column hash_verification_status text not null default 'legacy_unverified'
 check(hash_verification_status in ('legacy_unverified','server_verified'));
alter table uploaded_documents add column server_verified_at timestamptz;
alter table uploaded_documents add column verified_storage_object_id uuid;
alter table uploaded_documents add constraint uploaded_document_verification_shape check(
 (hash_verification_status='legacy_unverified' and server_verified_at is null and verified_storage_object_id is null)
 or(hash_verification_status='server_verified' and server_verified_at is not null and verified_storage_object_id is not null));
drop index uploaded_documents_project_hash_uniq;
create unique index uploaded_documents_verified_project_hash_uniq on uploaded_documents(project_id,sha256_hash)
 where hash_verification_status='server_verified';

create function cocal_attachment_private.assert_write(org uuid,project uuid,actor uuid) returns void
language plpgsql security definer set search_path='' as $$
declare sub public.subscriptions; effective text;
begin
 perform 1 from public.projects p join public.organizations o on o.id=p.organization_id where p.id=project and p.organization_id=org and o.status='active' for key share of p,o;
 if not found then raise exception 'verification_scope_denied' using errcode='42501'; end if;
 perform 1 from public.organization_members m where m.organization_id=org and m.user_id=actor and m.status='active' and m.role in ('owner','admin','editor') for share;
 if not found then raise exception 'verification_actor_denied' using errcode='42501'; end if;
 select * into sub from public.subscriptions s where s.organization_id=org order by s.period_end desc,s.created_at desc,s.id limit 1 for share;
 if not found or now()<sub.period_start then raise exception 'verification_subscription_readonly' using errcode='42501'; end if;
 effective:=sub.status::text;
 if effective='active' and now()>sub.period_end then if sub.grace_until is not null and now()<=sub.grace_until then effective:='grace_period';else effective:='readonly';end if;
 elsif effective='grace_period' and sub.grace_until is not null and now()>sub.grace_until then effective:='readonly';end if;
 if effective not in ('active','grace_period') then raise exception 'verification_subscription_readonly' using errcode='42501';end if;
end;$$;

create function cocal_attachment_private.assert_object(v cocal_attachment_private.verifications) returns void
language plpgsql security definer set search_path='' as $$
declare obj storage.objects;
begin
 perform 1 from storage.buckets b where b.id=v.bucket and b.public=false for share;
 if not found then raise exception 'verification_private_bucket_missing';end if;
 select * into obj from storage.objects o where o.bucket_id=v.bucket and o.name=v.path for update;
 if not found or obj.id is distinct from v.storage_object_id
 or coalesce(nullif(to_jsonb(obj)->>'owner_id',''),to_jsonb(obj)->>'owner') is distinct from v.owner_id
 or obj.metadata is distinct from v.object_metadata then raise exception 'verification_object_binding_changed';end if;
end;$$;

-- VOLATILE: fresh recheck after acquiring the same advisory key as begin/complete.
-- This is not a claim of independently tested lock-wait/real Storage concurrency.
create function cocal_attachment_private.path_is_reserved(p_bucket text,p_object_name text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
begin
 if p_bucket not in ('documents','staging-receipts','staging-attachments') then return false;end if;
 if not cocal_storage_private.project_access(cocal_storage_private.project_id(p_bucket,p_object_name),false) then return true;end if;
 perform pg_advisory_xact_lock(hashtextextended('attachment:'||p_bucket||'/'||p_object_name,0));
 return exists(select 1 from cocal_attachment_private.verifications v where v.bucket=p_bucket and v.path=p_object_name);
end;$$;
create function cocal_attachment_private.protect_object() returns trigger
language plpgsql security invoker set search_path='' as $$
declare b text; p text;
begin
 if current_user not in ('authenticated','anon') then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op='INSERT' then b:=new.bucket_id;p:=new.name;else b:=old.bucket_id;p:=old.name;end if;
 if cocal_attachment_private.path_is_reserved(b,p) then raise exception 'Reserved or verified original is retained; server deletion workflow required' using errcode='42501';end if;
 if tg_op='UPDATE' and(new.bucket_id,new.name) is distinct from(old.bucket_id,old.name)
 and cocal_attachment_private.path_is_reserved(new.bucket_id,new.name) then raise exception 'Reserved destination cannot be replaced' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
create trigger attachment_object_retention before insert or update or delete on storage.objects
 for each row execute function cocal_attachment_private.protect_object();

create function cocal_attachment_private.receipt_is_reserved(doc uuid,bucket text,object_name text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
begin
 if cocal_attachment_private.path_is_reserved(bucket,object_name) then return true;end if;
 return exists(select 1 from cocal_attachment_private.verifications v where v.document_id=doc);
end;$$;
create function cocal_attachment_private.protect_receipt() returns trigger
language plpgsql security definer set search_path='' as $$
declare v cocal_attachment_private.verifications; role_name text:=current_setting('role',true);
begin
 if role_name in ('authenticated','anon') then
  if tg_op<>'DELETE' then raise exception 'Client receipt writes disabled; server verification required' using errcode='42501';end if;
  if old.hash_verification_status='server_verified' or cocal_attachment_private.receipt_is_reserved(old.id,old.storage_bucket,old.storage_path) then raise exception 'Verified receipt is retained; server deletion workflow required' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 if new.hash_verification_status='server_verified' then
  select * into v from cocal_attachment_private.verifications x where x.document_id=new.id and x.state='verified';
  if not found or new.organization_id is distinct from v.organization_id or new.project_id is distinct from v.project_id
  or new.sha256_hash is distinct from v.sha256_hash or new.server_verified_at is distinct from v.verified_at
  or new.verified_storage_object_id is distinct from v.storage_object_id or new.storage_bucket is distinct from v.bucket
  or new.storage_path is distinct from v.path or new.uploaded_by_user_id is distinct from v.actor_user_id
  or new.file_size_bytes is distinct from v.file_size_bytes or new.mime_type is distinct from v.mime_type then raise exception 'Server receipt has no matching private authority' using errcode='42501';end if;
 end if;
 return new;
end;$$;
create trigger attachment_receipt_authority before insert or update or delete on uploaded_documents
 for each row execute function cocal_attachment_private.protect_receipt();
create policy attachment_client_receipt_insert_denied on uploaded_documents as restrictive for insert to authenticated with check(false);

create function cocal_attachment_private.result(v cocal_attachment_private.verifications) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receipt public.uploaded_documents; authority cocal_attachment_private.verifications;
begin
 if v.state='reserved' then return to_jsonb(v)-'object_metadata'-'intent';end if;
 select * into receipt from public.uploaded_documents d where d.id=case when v.state='duplicate' then v.duplicate_of_document_id else v.document_id end and d.organization_id=v.organization_id and d.project_id=v.project_id and d.hash_verification_status='server_verified' for share;
 if not found then raise exception 'Verified receipt authority missing';end if;
 if receipt.status is distinct from 'active' or receipt.env is distinct from (case when v.bucket='documents' then 'production' else 'staging' end)
 or receipt.is_test is distinct from(v.bucket<>'documents') then raise exception 'HASH_EXISTS_DIFFERENT_LIFECYCLE_OR_ENV';end if;
 select * into authority from cocal_attachment_private.verifications x where x.document_id=receipt.id and x.state='verified' and x.sha256_hash=receipt.sha256_hash and x.storage_object_id=receipt.verified_storage_object_id and x.verified_at=receipt.server_verified_at;
 if not found then raise exception 'Verified receipt proof mismatch';end if;
 perform cocal_attachment_private.assert_object(authority);
 return jsonb_build_object('state',v.state,'document_id',v.document_id,'request_id',v.request_id,'receipt',to_jsonb(receipt),
  'server_proof',jsonb_build_object('contract_version','20261106.hash.1','sha256_hash',authority.sha256_hash,'storage_object_id',authority.storage_object_id,'verified_at',authority.verified_at),
  'duplicate_of_document_id',v.duplicate_of_document_id);
end;$$;

create function begin_upload_verification(p_actor_user_id uuid,p_input jsonb) returns table(verification jsonb)
language plpgsql security definer set search_path='' as $$
declare v cocal_attachment_private.verifications;obj storage.objects;doc uuid;org uuid;project uuid;bucket text;path text;owner_text text;size_text text;intent jsonb;
begin
 if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'verification_input_required';end if;
 doc:=(p_input->>'document_id')::uuid;org:=(p_input->>'organization_id')::uuid;project:=(p_input->>'project_id')::uuid;bucket:=p_input->>'storage_bucket';path:=p_input->>'storage_path';intent:=p_input-'client_sha256';
 perform cocal_attachment_private.assert_write(org,project,p_actor_user_id);
 if doc is null or p_actor_user_id is null or length(btrim(coalesce(p_input->>'request_id',''))) not between 1 and 200
 or bucket not in ('documents','staging-receipts','staging-attachments')
 or cocal_storage_private.project_id(bucket,path) is distinct from project or cocal_storage_private.document_id(bucket,path) is distinct from doc
 or p_input->>'document_type' not in ('receipt','invoice','bill','utility_bill','contract','report','other')
 or length(btrim(coalesce(p_input->>'original_filename','')))=0 then raise exception 'verification_input_binding_invalid';end if;
 perform pg_advisory_xact_lock(hashtextextended('attachment:'||bucket||'/'||path,0));
 select * into v from cocal_attachment_private.verifications x where x.document_id=doc for update;
 if found then
  if v.actor_user_id is distinct from p_actor_user_id or v.intent is distinct from intent then raise exception 'verification_request_intent_conflict';end if;
  perform cocal_attachment_private.assert_object(v);return query select cocal_attachment_private.result(v);return;
 end if;
 if exists(select 1 from public.uploaded_documents d where d.id=doc) then raise exception 'LEGACY_RECEIPT_REQUIRES_OWNER_REVIEW';end if;
 select * into obj from storage.objects o where o.bucket_id=bucket and o.name=path for update;
 owner_text:=coalesce(nullif(to_jsonb(obj)->>'owner_id',''),to_jsonb(obj)->>'owner');size_text:=obj.metadata->>'size';
 if obj.id is null or owner_text is distinct from p_actor_user_id::text or jsonb_typeof(obj.metadata) is distinct from 'object'
 or jsonb_typeof(obj.metadata->'size') is distinct from 'number' or size_text !~ '^[0-9]+$' or length(size_text)>8
 or jsonb_typeof(obj.metadata->'mimetype') is distinct from 'string' or obj.metadata->>'mimetype' not in ('application/pdf','image/jpeg','image/png')
 then raise exception 'verification_original_metadata_invalid';end if;
 if size_text::bigint not between 1 and 10485760 or jsonb_typeof(p_input->'file_size_bytes') is distinct from 'number'
 or p_input->>'file_size_bytes' !~ '^[0-9]+$' or (p_input->>'file_size_bytes')::numeric<>size_text::bigint
 or p_input->>'mime_type' is distinct from obj.metadata->>'mimetype' then raise exception 'verification_original_metadata_mismatch';end if;
 if (p_input->>'mime_type'='application/pdf' and (p_input->>'original_filename' !~* '[.]pdf$' or path !~ '[.]pdf$'))
 or(p_input->>'mime_type'='image/png' and (p_input->>'original_filename' !~* '[.]png$' or path !~ '[.]png$'))
 or(p_input->>'mime_type'='image/jpeg' and (p_input->>'original_filename' !~* '[.]jpe?g$' or path !~ '[.]jpe?g$')) then raise exception 'verification_filename_mime_mismatch';end if;
 insert into cocal_attachment_private.verifications(document_id,organization_id,project_id,actor_user_id,request_id,bucket,path,storage_object_id,owner_id,file_size_bytes,mime_type,object_metadata,intent)
 values(doc,org,project,p_actor_user_id,p_input->>'request_id',bucket,path,obj.id,owner_text,size_text::bigint,p_input->>'mime_type',obj.metadata,intent) returning * into v;
 perform cocal_attachment_private.assert_object(v);
 return query select cocal_attachment_private.result(v);
end;$$;

create function complete_upload_verification(p_actor_user_id uuid,p_document_id uuid,p_request_id text,p_sha256 text,p_observed_size bigint,p_observed_mime text)
returns table(verification jsonb) language plpgsql security definer set search_path='' as $$
declare v cocal_attachment_private.verifications;target public.uploaded_documents;stamp timestamptz:=clock_timestamp();
begin
 select * into v from cocal_attachment_private.verifications x where x.document_id=p_document_id;
 if not found then raise exception 'verification_reservation_missing';end if;
 perform cocal_attachment_private.assert_write(v.organization_id,v.project_id,p_actor_user_id);
 if v.actor_user_id is distinct from p_actor_user_id or v.request_id is distinct from p_request_id then raise exception 'verification_request_intent_conflict';end if;
 perform pg_advisory_xact_lock(hashtextextended('attachment:'||v.bucket||'/'||v.path,0));
 select * into v from cocal_attachment_private.verifications x where x.document_id=p_document_id for update;
 perform cocal_attachment_private.assert_object(v);
 if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_observed_size is distinct from v.file_size_bytes or p_observed_mime is distinct from v.mime_type then raise exception 'verification_observed_content_mismatch';end if;
 if v.state<>'reserved' then
  if v.sha256_hash is distinct from p_sha256 then raise exception 'verification_hash_intent_conflict';end if;
  return query select cocal_attachment_private.result(v);return;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('verified-hash:'||v.project_id::text||':'||p_sha256,0));
 select * into target from public.uploaded_documents d where d.project_id=v.project_id and d.organization_id=v.organization_id and d.sha256_hash=p_sha256 and d.hash_verification_status='server_verified' for share;
 if found then
  if target.status is distinct from 'active' or target.env is distinct from (case when v.bucket='documents' then 'production' else 'staging' end)
  or target.is_test is distinct from(v.bucket<>'documents') then raise exception 'HASH_EXISTS_DIFFERENT_LIFECYCLE_OR_ENV';end if;
  update cocal_attachment_private.verifications x set state='duplicate',sha256_hash=p_sha256,verified_at=stamp,duplicate_of_document_id=target.id where x.document_id=v.document_id returning * into v;
 else
  update cocal_attachment_private.verifications x set state='verified',sha256_hash=p_sha256,verified_at=stamp where x.document_id=v.document_id returning * into v;
  insert into public.uploaded_documents(id,organization_id,project_id,uploaded_by_user_id,storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,sha256_hash,document_type,ocr_status,status,env,is_test,metadata,received_date,hash_verification_status,server_verified_at,verified_storage_object_id)
  values(v.document_id,v.organization_id,v.project_id,v.actor_user_id,v.bucket,v.path,v.intent->>'original_filename',v.mime_type,v.file_size_bytes,p_sha256,v.intent->>'document_type','pending','active',case when v.bucket='documents' then 'production' else 'staging' end,v.bucket<>'documents',jsonb_build_object('intake_mode','server_verified_upload','verification_contract','20261106.hash.1'),current_date,'server_verified',stamp,v.storage_object_id);
 end if;
 return query select cocal_attachment_private.result(v);
end;$$;

revoke all on all functions in schema cocal_attachment_private from public,anon,authenticated,service_role;
grant usage on schema cocal_attachment_private to authenticated,anon;
grant execute on function cocal_attachment_private.path_is_reserved(text,text) to authenticated,anon;
revoke all on function begin_upload_verification(uuid,jsonb),complete_upload_verification(uuid,uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function begin_upload_verification(uuid,jsonb),complete_upload_verification(uuid,uuid,text,text,bigint,text) to service_role;

-- Versioned compatibility is separate from the old v2 delete/library probe.
create table cocal_attachment_private.source_baseline(kind text,object_key text,fingerprint text,primary key(kind,object_key));
revoke all on cocal_attachment_private.source_baseline from public,anon,authenticated,service_role;
create function cocal_attachment_private.catalog_state() returns table(kind text,object_key text,fingerprint text)
language sql stable security definer set search_path='' as $$
 select 'function',p.oid::regprocedure::text,md5(jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',coalesce(p.proacl,acldefault('f',p.proowner))::text,'owner',p.proowner,'config',p.proconfig)::text)
 from pg_proc p where p.pronamespace='cocal_attachment_private'::regnamespace or p.oid in(to_regprocedure('public.begin_upload_verification(uuid,jsonb)'),to_regprocedure('public.complete_upload_verification(uuid,uuid,text,text,bigint,text)'),to_regprocedure('public.upload_verification_contract(uuid)'))
 union all select 'trigger',t.tgname,md5(jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled,'type',t.tgtype)::text) from pg_trigger t where t.tgname in('attachment_object_retention','attachment_receipt_authority') and t.tgrelid in('storage.objects'::regclass,'public.uploaded_documents'::regclass)
 union all select 'policy',p.polname,md5(jsonb_build_object('using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid),'permissive',p.polpermissive,'roles',p.polroles,'command',p.polcmd)::text) from pg_policy p where p.polrelid='public.uploaded_documents'::regclass and p.polname='attachment_client_receipt_insert_denied'
 union all select 'index',c.relname,md5(pg_get_indexdef(c.oid)) from pg_class c where c.oid='public.uploaded_documents_verified_project_hash_uniq'::regclass
 union all select 'table',c.relname,md5(jsonb_build_object('rls',c.relrowsecurity,'acl',coalesce(c.relacl,acldefault('r',c.relowner))::text,'owner',c.relowner)::text) from pg_class c where c.oid in('cocal_attachment_private.verifications'::regclass,'cocal_attachment_private.source_baseline'::regclass);
$$;
create function cocal_attachment_private.deployment_ready() returns boolean
language sql stable security definer set search_path='' as $$
 select cocal_storage_private.deployment_ready() and to_regclass('public.uploaded_documents_project_hash_uniq') is null
 and (select count(*)>=10 from cocal_attachment_private.source_baseline)
 and not exists((select * from cocal_attachment_private.catalog_state() except select * from cocal_attachment_private.source_baseline)
 union all(select * from cocal_attachment_private.source_baseline except select * from cocal_attachment_private.catalog_state()));
$$;
create function upload_verification_contract(p_project_id uuid)
returns table(project_id uuid,organization_id uuid,contract_version text,can_verify boolean,max_bytes bigint,client_receipt_insert boolean)
language sql stable security definer set search_path='' as $$
 select p.id,p.organization_id,'20261106.hash.1'::text,cocal_storage_private.project_access(p.id,true) and cocal_attachment_private.deployment_ready(),10485760::bigint,false
 from public.projects p where p.id=p_project_id and cocal_storage_private.org_access(p.organization_id,false);
$$;
revoke all on function cocal_attachment_private.catalog_state(),cocal_attachment_private.deployment_ready(),upload_verification_contract(uuid) from public,anon,authenticated,service_role;
grant execute on function upload_verification_contract(uuid) to authenticated;
-- Capture only these newly installed, approved definitions; old drift was refused
-- at migration entry. There is no client/service re-learning or refresh endpoint.
insert into cocal_attachment_private.source_baseline select * from cocal_attachment_private.catalog_state();
commit;
