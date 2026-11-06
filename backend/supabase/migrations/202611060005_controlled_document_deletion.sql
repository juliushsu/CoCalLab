-- Source-only controlled deletion. No cloud apply, byte deletion or reset authorization.
begin;
do $$begin if not cocal_attachment_private.deployment_ready() then raise exception 'Existing verified-upload source drift; do not rebaseline unknown source';end if;end;$$;
create schema cocal_delete_private;
revoke all on schema cocal_delete_private from public,anon,authenticated,service_role;
create table cocal_delete_private.operations(
 document_id uuid primary key,organization_id uuid not null,project_id uuid not null,request_id text not null,
 actor_user_id uuid not null,bucket text not null,path text not null,storage_object_id uuid,owner_id text,object_metadata jsonb,
 receipt_present boolean not null,original_missing boolean not null,expected_receipt_absent boolean not null,
 phase text not null default 'prepared' check(phase in ('prepared','finalized')),
 created_at timestamptz not null default clock_timestamp(),deleted_at timestamptz,
 unique(organization_id,project_id,request_id),unique(bucket,path),check(request_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
);
alter table cocal_delete_private.operations enable row level security;
revoke all on cocal_delete_private.operations from public,anon,authenticated,service_role;
create table cocal_delete_private.processing_leases(
 lease_id uuid primary key,document_id uuid not null,organization_id uuid not null,project_id uuid not null,actor_user_id uuid not null,
 previous_ocr_status public.ocr_status not null,request_id text,state text not null default 'active' check(state in('active','released','completed')),
 created_at timestamptz not null default clock_timestamp(),ended_at timestamptz
);
create unique index document_processing_one_active on cocal_delete_private.processing_leases(document_id) where state='active';
alter table cocal_delete_private.processing_leases enable row level security;
revoke all on cocal_delete_private.processing_leases from public,anon,authenticated,service_role;
alter table public.uploaded_documents add column deletion_state text not null default 'active' check(deletion_state in ('active','pending','deleted'));
alter table public.uploaded_documents add column deleted_at timestamptz;
alter table public.uploaded_documents add column deletion_request_id text;
alter table public.uploaded_documents add constraint uploaded_document_deletion_shape check(
 (deletion_state='active' and deleted_at is null and deletion_request_id is null)
 or(deletion_state='pending' and deleted_at is null and deletion_request_id is not null)
 or(deletion_state='deleted' and deleted_at is not null and deletion_request_id is not null and status='archived'));

-- One durable document fence is shared by prepare and every new reference write.
-- VOLATILE fresh queries run after waiting for the advisory lock.
create function cocal_delete_private.assert_unfenced(doc uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 if doc is null then return;end if;
 perform pg_advisory_xact_lock(hashtextextended('document-delete:'||doc::text,0));
 if exists(select 1 from cocal_delete_private.operations d where d.document_id=doc) then raise exception 'DOCUMENT_DELETION_FENCED' using errcode='42501';end if;
end;$$;
create function cocal_delete_private.references_clear(doc uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 if exists(select 1 from public.extracted_document_drafts d where d.uploaded_document_id=doc)
 or exists(select 1 from cocal_delete_private.processing_leases l where l.document_id=doc and l.state='active')
 or exists(select 1 from public.emission_activities a where a.source_document_id=doc or a.source_draft_id in(select d.id from public.extracted_document_drafts d where d.uploaded_document_id=doc))
 or exists(select 1 from public.uploaded_documents u where u.id=doc and u.ocr_status='processing')
 or exists(select 1 from public.report_generations r cross join lateral jsonb_array_elements(case when jsonb_typeof(r.payload->'appendix_mappings')='array' then r.payload->'appendix_mappings' else '[]'::jsonb end) x
  where lower(x->>'source_document_id')=doc::text or lower(x->>'source_draft_id') in(select d.id::text from public.extracted_document_drafts d where d.uploaded_document_id=doc))
 then raise exception 'DOCUMENT_HAS_REFERENCES';end if;
 -- Old malformed/missing report source mappings cannot prove absence of a
 -- historical source reference. Do not guess or rewrite old snapshots.
 if exists(select 1 from public.report_generations r join public.uploaded_documents u on u.id=doc and r.organization_id=u.organization_id and r.project_id=u.project_id
  where jsonb_typeof(r.payload->'appendix_mappings') is distinct from 'array'
   or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(r.payload->'appendix_mappings')='array' then r.payload->'appendix_mappings' else '[]'::jsonb end) x
    where jsonb_typeof(x) is distinct from 'object' or not(x ?& array['source_document_id','source_draft_id'])
     or exists(select 1 from unnest(array['source_document_id','source_draft_id']) field where x->field is distinct from 'null'::jsonb
      and(jsonb_typeof(x->field) is distinct from 'string' or x->>field !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')))) then raise exception 'DOCUMENT_REFERENCE_INDEX_UNKNOWN';end if;
end;$$;
create function cocal_delete_private.reference_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare doc uuid; item jsonb;
begin
 if tg_table_name='extracted_document_drafts' then perform cocal_delete_private.assert_unfenced(new.uploaded_document_id);
 elsif tg_table_name='emission_activities' then
  perform cocal_delete_private.assert_unfenced(new.source_document_id);
  if new.source_draft_id is not null then select d.uploaded_document_id into doc from public.extracted_document_drafts d where d.id=new.source_draft_id;perform cocal_delete_private.assert_unfenced(doc);end if;
 elsif tg_table_name='report_generations' then
  for item in select * from jsonb_array_elements(case when jsonb_typeof(new.payload->'appendix_mappings')='array' then new.payload->'appendix_mappings' else '[]'::jsonb end) loop
   if item->>'source_document_id' is not null then perform cocal_delete_private.assert_unfenced((item->>'source_document_id')::uuid);end if;
   if item->>'source_draft_id' is not null then select d.uploaded_document_id into doc from public.extracted_document_drafts d where d.id=(item->>'source_draft_id')::uuid;perform cocal_delete_private.assert_unfenced(doc);end if;
  end loop;
 end if;
 return new;
end;$$;
create trigger deletion_draft_reference before insert or update on public.extracted_document_drafts for each row execute function cocal_delete_private.reference_guard();
create trigger deletion_activity_reference before insert or update on public.emission_activities for each row execute function cocal_delete_private.reference_guard();
create trigger deletion_report_reference before insert or update on public.report_generations for each row execute function cocal_delete_private.reference_guard();

create function cocal_delete_private.receipt_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare op cocal_delete_private.operations;role_name text:=current_setting('role',true);
begin
 if tg_op='DELETE' then
  if role_name in ('authenticated','anon') then raise exception 'Controlled receipt archival required' using errcode='42501';end if;
  perform cocal_delete_private.assert_unfenced(old.id);
  if exists(select 1 from cocal_delete_private.processing_leases l where l.document_id=old.id and l.state='active') then raise exception 'DOCUMENT_PROCESSING_LEASE_ACTIVE' using errcode='42501';end if;return old;
 end if;
 if tg_op='INSERT' then
  perform cocal_delete_private.assert_unfenced(new.id);
  perform pg_advisory_xact_lock(hashtextextended('attachment:'||new.storage_bucket||'/'||new.storage_path,0));
  if exists(select 1 from cocal_delete_private.operations d where d.bucket=new.storage_bucket and d.path=new.storage_path) then raise exception 'DOCUMENT_DELETION_FENCED' using errcode='42501';end if;
  if new.deletion_state<>'active' then raise exception 'Deletion state is server managed' using errcode='42501';end if;
  return new;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('document-delete:'||old.id::text,0));
 if exists(select 1 from cocal_delete_private.operations d where d.bucket=new.storage_bucket and d.path=new.storage_path and d.document_id<>old.id) then raise exception 'DOCUMENT_DELETION_FENCED' using errcode='42501';end if;
 select * into op from cocal_delete_private.operations d where d.document_id=old.id;
 if found then
  if role_name in ('authenticated','anon') or (new.id,new.organization_id,new.project_id,new.storage_bucket,new.storage_path) is distinct from(old.id,old.organization_id,old.project_id,old.storage_bucket,old.storage_path)
   or new.deletion_request_id is distinct from op.request_id
   or not ((op.phase='prepared' and old.deletion_state='active' and new.deletion_state='pending' and new.deleted_at is null)
    or(op.phase='finalized' and old.deletion_state='pending' and new.deletion_state='deleted' and new.deleted_at=op.deleted_at and new.status='archived'))
   then raise exception 'DOCUMENT_DELETION_FENCED' using errcode='42501';end if;
 elsif new.deletion_state is distinct from old.deletion_state or new.deleted_at is distinct from old.deleted_at or new.deletion_request_id is distinct from old.deletion_request_id then raise exception 'Deletion state is server managed' using errcode='42501';
 end if;
 if new.ocr_status='processing' then perform cocal_delete_private.assert_unfenced(new.id);end if;
 return new;
end;$$;
create trigger deletion_receipt_guard before insert or update or delete on public.uploaded_documents for each row execute function cocal_delete_private.receipt_guard();

create function cocal_delete_private.object_guard() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_bucket text;object_name text;op cocal_delete_private.operations;role_name text:=current_setting('role',true);
begin
 if tg_op='INSERT' then v_bucket:=new.bucket_id;object_name:=new.name;else v_bucket:=old.bucket_id;object_name:=old.name;end if;
 if tg_op='UPDATE' and new.bucket_id in ('documents','staging-receipts','staging-attachments') and(new.bucket_id,new.name) is distinct from(old.bucket_id,old.name) then
  perform pg_advisory_xact_lock(hashtextextended('attachment:'||new.bucket_id||'/'||new.name,0));
  if exists(select 1 from cocal_delete_private.operations d where d.bucket=new.bucket_id and d.path=new.name) then raise exception 'Deleted original destination cannot be reused' using errcode='42501';end if;
 end if;
 if v_bucket not in ('documents','staging-receipts','staging-attachments') then if tg_op='DELETE' then return old;else return new;end if;end if;
 perform pg_advisory_xact_lock(hashtextextended('attachment:'||v_bucket||'/'||object_name,0));
 if tg_op in ('DELETE','UPDATE') and role_name in ('authenticated','anon') then raise exception 'Controlled original deletion required' using errcode='42501';end if;
 select * into op from cocal_delete_private.operations d where d.bucket=v_bucket and d.path=object_name;
 if found then
  if tg_op<>'DELETE' or op.phase<>'prepared' or old.id is distinct from op.storage_object_id
   or coalesce(nullif(to_jsonb(old)->>'owner_id',''),to_jsonb(old)->>'owner') is distinct from op.owner_id
   or old.metadata is distinct from op.object_metadata then raise exception 'DOCUMENT_DELETE_OBJECT_BINDING_CHANGED' using errcode='42501';end if;
 end if;
 if tg_op='UPDATE' and (new.bucket_id,new.name) is distinct from(old.bucket_id,old.name)
  and exists(select 1 from cocal_delete_private.operations d where d.bucket=new.bucket_id and d.path=new.name) then raise exception 'Deleted original path cannot be reused' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
create trigger deletion_object_guard before insert or update or delete on storage.objects for each row execute function cocal_delete_private.object_guard();
create function cocal_delete_private.object_visible(bucket text,object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select case when $1 in ('documents','staging-receipts','staging-attachments') then
 cocal_storage_private.project_access(cocal_storage_private.project_id($1,$2),false)
 and not exists(select 1 from cocal_delete_private.operations d where d.bucket=$1 and d.path=$2) else true end;
$$;
grant usage on schema cocal_delete_private to authenticated,anon;
create policy controlled_original_visibility on storage.objects as restrictive for select to authenticated,anon using(cocal_delete_private.object_visible(bucket_id,name));

create function cocal_delete_private.result(op cocal_delete_private.operations,p_replayed boolean) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('organization_id',op.organization_id,'project_id',op.project_id,'document_id',op.document_id,'request_id',op.request_id,
 'operation_status',case when op.phase='finalized' then 'deleted' else 'pending' end,'phase',case when op.phase='finalized' then 'finalized' when not exists(select 1 from storage.objects s where s.bucket_id=op.bucket and s.name=op.path) then 'object_absent' else 'prepared' end,
 'replayed',p_replayed,'receipt_present',op.receipt_present,'original_missing',op.original_missing,
 'storage_absent',not exists(select 1 from storage.objects s where s.bucket_id=op.bucket and s.name=op.path),
 'storage_bucket',op.bucket,'storage_path',op.path,'deletion_state',case when op.receipt_present then case when op.phase='finalized' then 'deleted' else 'pending' end else null end,'deleted_at',op.deleted_at);
$$;
create function public.document_deletion_request(p_actor_user_id uuid,p_input jsonb,p_action text default 'lookup') returns table(operation jsonb)
language plpgsql volatile security definer set search_path='' as $$
declare op cocal_delete_private.operations;u public.uploaded_documents;v cocal_attachment_private.verifications;obj storage.objects;
 doc uuid:=(p_input->>'document_id')::uuid;org uuid:=(p_input->>'organization_id')::uuid;project uuid:=(p_input->>'project_id')::uuid;
 v_bucket text;object_name text;receipt_exists boolean;reserved boolean;owner_text text;expected_absent boolean:=coalesce((p_input->>'expected_receipt_absent')::boolean,false);request_key text:=(p_input->>'request_id')::uuid::text;
begin
 perform cocal_attachment_private.assert_write(org,project,p_actor_user_id);
 if p_input ? 'expected_receipt_absent' and jsonb_typeof(p_input->'expected_receipt_absent') is distinct from 'boolean' then raise exception 'DOCUMENT_DELETE_INPUT_INVALID' using errcode='22023';end if;
 if doc is null or p_action is null or p_action not in ('lookup','prepare','locate') or(p_action<>'locate' and (length(btrim(coalesce(p_input->>'request_id','')))=0 or length(p_input->>'request_id')>200)) then raise exception 'DOCUMENT_DELETE_INPUT_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('document-delete:'||doc::text,0));
 select * into op from cocal_delete_private.operations d where d.document_id=doc;
 if p_action='locate' then
  if found and op.organization_id=org and op.project_id=project and op.actor_user_id=p_actor_user_id and op.expected_receipt_absent=expected_absent
   and(not(p_input ? 'storage_bucket') or op.bucket=p_input->>'storage_bucket') and(not(p_input ? 'storage_path') or op.path=p_input->>'storage_path') then
   return query select cocal_delete_private.result(op,true);return;
  end if;
  return query select jsonb_build_object('organization_id',org,'project_id',project,'document_id',doc,'request_id',null,'operation_status','not_found','phase','not_found','replayed',false,'receipt_present',null,'original_missing',null,'storage_absent',null,'storage_bucket',null,'storage_path',null,'deletion_state',null,'deleted_at',null);return;
 end if;
 if found then
  if op.organization_id is distinct from org or op.project_id is distinct from project or op.actor_user_id is distinct from p_actor_user_id or op.request_id is distinct from request_key or op.expected_receipt_absent is distinct from expected_absent
   or(p_input ? 'storage_bucket' and op.bucket is distinct from p_input->>'storage_bucket') or(p_input ? 'storage_path' and op.path is distinct from p_input->>'storage_path') then raise exception 'DOCUMENT_DELETE_INTENT_CONFLICT';end if;
  return query select cocal_delete_private.result(op,true);return;
 end if;
 if p_action='lookup' then return query select jsonb_build_object('organization_id',org,'project_id',project,'document_id',doc,'request_id',p_input->>'request_id','operation_status','not_found','phase','not_found','replayed',false,'receipt_present',null,'original_missing',null,'storage_absent',null,'storage_bucket',null,'storage_path',null,'deletion_state',null,'deleted_at',null);return;end if;
 select * into u from public.uploaded_documents d where d.id=doc for update;receipt_exists:=found;
 if expected_absent and receipt_exists then raise exception 'RECEIPT_ALREADY_REGISTERED';end if;
 select * into v from cocal_attachment_private.verifications d where d.document_id=doc;reserved:=found;
 if receipt_exists then
  if u.organization_id is distinct from org or u.project_id is distinct from project or u.deletion_state<>'active' then raise exception 'DOCUMENT_DELETE_SCOPE_DENIED' using errcode='42501';end if;
  v_bucket:=u.storage_bucket;object_name:=u.storage_path;
 elsif reserved then
  if v.organization_id is distinct from org or v.project_id is distinct from project or v.actor_user_id is distinct from p_actor_user_id then raise exception 'DOCUMENT_DELETE_SCOPE_DENIED' using errcode='42501';end if;
  v_bucket:=v.bucket;object_name:=v.path;
 else v_bucket:=p_input->>'storage_bucket';object_name:=p_input->>'storage_path';
  if cocal_storage_private.document_id(v_bucket,object_name) is distinct from doc then raise exception 'DOCUMENT_ORPHAN_IDENTITY_UNCONFIRMED';end if;
 end if;
 if v_bucket is null or object_name is null or cocal_storage_private.project_id(v_bucket,object_name) is distinct from project
  or object_name ~ '[%?#[:cntrl:]\\]' or right(object_name,1)=' '
  or(p_input ? 'storage_bucket' and v_bucket is distinct from p_input->>'storage_bucket') or(p_input ? 'storage_path' and object_name is distinct from p_input->>'storage_path') then raise exception 'DOCUMENT_DELETE_PATH_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended('attachment:'||v_bucket||'/'||object_name,0));
 perform 1 from storage.buckets b where b.id=v_bucket and b.public=false for share;if not found then raise exception 'DOCUMENT_PRIVATE_BUCKET_UNCONFIRMED';end if;
 select * into obj from storage.objects s where s.bucket_id=v_bucket and s.name=object_name for update;
 owner_text:=coalesce(nullif(to_jsonb(obj)->>'owner_id',''),to_jsonb(obj)->>'owner');
 if obj.id is not null then
  if receipt_exists and (owner_text is distinct from u.uploaded_by_user_id::text or(u.hash_verification_status='server_verified' and obj.id is distinct from u.verified_storage_object_id))
   or(not receipt_exists and owner_text is distinct from p_actor_user_id::text)
   or(reserved and (obj.id is distinct from v.storage_object_id or owner_text is distinct from v.owner_id or obj.metadata is distinct from v.object_metadata)) then raise exception 'DOCUMENT_DELETE_OBJECT_BINDING_CHANGED';end if;
 elsif not receipt_exists and not reserved then raise exception 'DOCUMENT_ORIGINAL_OWNERSHIP_UNCONFIRMED';end if;
 perform cocal_delete_private.references_clear(doc);
 if exists(select 1 from public.uploaded_documents d where d.id<>doc and d.storage_bucket=v_bucket and d.storage_path=object_name and d.deletion_state<>'deleted') then raise exception 'DOCUMENT_SHARED_ORIGINAL_REFERENCE';end if;
 insert into cocal_delete_private.operations(document_id,organization_id,project_id,request_id,actor_user_id,bucket,path,storage_object_id,owner_id,object_metadata,receipt_present,original_missing,expected_receipt_absent)
 values(doc,org,project,request_key,p_actor_user_id,v_bucket,object_name,obj.id,owner_text,obj.metadata,receipt_exists,obj.id is null,expected_absent) returning * into op;
 if receipt_exists then update public.uploaded_documents set deletion_state='pending',deletion_request_id=op.request_id where id=doc;end if;
 insert into public.audit_logs(organization_id,project_id,actor_user_id,actor_type,action,entity_type,entity_id,status,metadata)
 values(org,project,p_actor_user_id,'edge_function','document_delete_prepared','uploaded_document',doc,'recorded',jsonb_build_object('request_id',op.request_id,'original_missing',op.original_missing,'receipt_present',receipt_exists));
 return query select cocal_delete_private.result(op,false);
end;$$;

create function public.finalize_document_deletion(p_actor_user_id uuid,p_input jsonb) returns table(operation jsonb)
language plpgsql volatile security definer set search_path='' as $$
declare op cocal_delete_private.operations;stamp timestamptz:=clock_timestamp();expected_absent boolean:=coalesce((p_input->>'expected_receipt_absent')::boolean,false);request_key text:=(p_input->>'request_id')::uuid::text;
begin
 perform cocal_attachment_private.assert_write((p_input->>'organization_id')::uuid,(p_input->>'project_id')::uuid,p_actor_user_id);
 if p_input ? 'expected_receipt_absent' and jsonb_typeof(p_input->'expected_receipt_absent') is distinct from 'boolean' then raise exception 'DOCUMENT_DELETE_INPUT_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('document-delete:'||(p_input->>'document_id'),0));
 select * into op from cocal_delete_private.operations d where d.document_id=(p_input->>'document_id')::uuid for update;
 if not found then raise exception 'DOCUMENT_DELETE_NOT_PREPARED';end if;
 if op.organization_id is distinct from (p_input->>'organization_id')::uuid or op.project_id is distinct from(p_input->>'project_id')::uuid or op.actor_user_id is distinct from p_actor_user_id or op.request_id is distinct from request_key or op.expected_receipt_absent is distinct from expected_absent
  or(p_input ? 'storage_bucket' and op.bucket is distinct from p_input->>'storage_bucket') or(p_input ? 'storage_path' and op.path is distinct from p_input->>'storage_path') then raise exception 'DOCUMENT_DELETE_INTENT_CONFLICT';end if;
 perform pg_advisory_xact_lock(hashtextextended('attachment:'||op.bucket||'/'||op.path,0));
 if exists(select 1 from storage.objects s where s.bucket_id=op.bucket and s.name=op.path) then raise exception 'DOCUMENT_DELETE_STORAGE_NOT_ABSENT';end if;
 if op.phase='finalized' then return query select cocal_delete_private.result(op,true);return;end if;
 perform cocal_delete_private.references_clear(op.document_id);
 update cocal_delete_private.operations d set phase='finalized',deleted_at=stamp where d.document_id=op.document_id returning * into op;
 if op.receipt_present then
  update public.uploaded_documents set deletion_state='deleted',deleted_at=stamp,status='archived',archived_at=coalesce(archived_at,stamp) where id=op.document_id and deletion_state='pending' and deletion_request_id=op.request_id;
  if not found then raise exception 'DOCUMENT_DELETE_RECEIPT_NOT_ARCHIVED';end if;
 end if;
 insert into public.audit_logs(organization_id,project_id,actor_user_id,actor_type,action,entity_type,entity_id,status,metadata)
 values(op.organization_id,op.project_id,p_actor_user_id,'edge_function','document_delete_finalized','uploaded_document',op.document_id,'recorded',jsonb_build_object('request_id',op.request_id,'original_missing',op.original_missing,'receipt_retained',op.receipt_present));
 return query select cocal_delete_private.result(op,false);
end;$$;

-- Only controlled tombstones release trusted hash uniqueness. Other archived or
-- cross-environment rows retain their original conflict semantics.
create function public.begin_document_processing(p_actor_user_id uuid,p_organization_id uuid,p_project_id uuid,p_document_id uuid,p_lease_id uuid,p_request_id text default null)
returns table(lease_id uuid) language plpgsql volatile security definer set search_path='' as $$
declare doc public.uploaded_documents;
begin
 perform cocal_attachment_private.assert_write(p_organization_id,p_project_id,p_actor_user_id);
 perform cocal_delete_private.assert_unfenced(p_document_id);
 select * into doc from public.uploaded_documents d where d.id=p_document_id and d.organization_id=p_organization_id and d.project_id=p_project_id and d.status='active' and d.deletion_state='active' for update;
 if not found or p_lease_id is null then raise exception 'DOCUMENT_PROCESSING_SCOPE_DENIED' using errcode='42501';end if;
 if doc.ocr_status='processing' or exists(select 1 from cocal_delete_private.processing_leases l where l.document_id=p_document_id and l.state='active') then raise exception 'DOCUMENT_PROCESSING_LEASE_ACTIVE';end if;
 if cocal_storage_private.project_id(doc.storage_bucket,doc.storage_path) is distinct from p_project_id
  or not exists(select 1 from storage.objects s where s.bucket_id=doc.storage_bucket and s.name=doc.storage_path)
  or not exists(select 1 from storage.buckets b where b.id=doc.storage_bucket and b.public=false) then raise exception 'DOCUMENT_PROCESSING_ORIGINAL_UNCONFIRMED';end if;
 insert into cocal_delete_private.processing_leases(lease_id,document_id,organization_id,project_id,actor_user_id,previous_ocr_status,request_id)
 values(p_lease_id,p_document_id,p_organization_id,p_project_id,p_actor_user_id,doc.ocr_status,p_request_id);
 update public.uploaded_documents d set ocr_status='processing' where d.id=p_document_id;
 return query select p_lease_id;
end;$$;
create function public.finish_document_processing(p_actor_user_id uuid,p_lease_id uuid,p_payload jsonb)
returns table(draft_id uuid,status public.draft_status,normalized_payload jsonb)
language plpgsql volatile security definer set search_path='' as $$
declare lease cocal_delete_private.processing_leases;answer record;
begin
 select * into lease from cocal_delete_private.processing_leases l where l.lease_id=p_lease_id;
 if not found or lease.actor_user_id is distinct from p_actor_user_id then raise exception 'DOCUMENT_PROCESSING_LEASE_DENIED' using errcode='42501';end if;
 perform cocal_attachment_private.assert_write(lease.organization_id,lease.project_id,p_actor_user_id);
 perform cocal_delete_private.assert_unfenced(lease.document_id);
 select * into lease from cocal_delete_private.processing_leases l where l.lease_id=p_lease_id for update;
 if lease.state<>'active' or not exists(select 1 from public.uploaded_documents d join storage.objects s on s.bucket_id=d.storage_bucket and s.name=d.storage_path
  where d.id=lease.document_id and d.organization_id=lease.organization_id and d.project_id=lease.project_id and d.status='active' and d.deletion_state='active' and d.ocr_status='processing'
  and cocal_storage_private.project_id(d.storage_bucket,d.storage_path)=lease.project_id) then raise exception 'DOCUMENT_PROCESSING_LEASE_NOT_ACTIVE';end if;
 select * into answer from public.process_document_atomic(lease.organization_id,lease.project_id,lease.document_id,
  p_payload->'raw_payload',p_payload->'normalized_payload',(p_payload->>'status')::public.draft_status,
  (p_payload->>'confidence_score')::numeric,p_payload->>'provider',p_payload->>'model',lease.request_id);
 if answer.draft_id is null or not exists(select 1 from public.extracted_document_drafts d where d.id=answer.draft_id and d.organization_id=lease.organization_id and d.project_id=lease.project_id and d.uploaded_document_id=lease.document_id) then raise exception 'DOCUMENT_PROCESSING_SAVE_UNCONFIRMED';end if;
 update cocal_delete_private.processing_leases l set state='completed',ended_at=clock_timestamp() where l.lease_id=p_lease_id;
 return query select answer.draft_id,answer.status,answer.normalized_payload;
end;$$;
-- Only the actual completed/failed handler calls this, with its own captured
-- server-generated lease/actor. No TTL or client flag can declare work stopped.
-- A crash or failed release keeps the lease and delete fence blocked for Owner
-- investigation; this is not an administrative force-release API.
create function public.release_document_processing(p_actor_user_id uuid,p_lease_id uuid)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare lease cocal_delete_private.processing_leases;
begin
 select * into lease from cocal_delete_private.processing_leases l where l.lease_id=p_lease_id;
 if not found then return false;end if;
 if lease.actor_user_id is distinct from p_actor_user_id then raise exception 'DOCUMENT_PROCESSING_LEASE_DENIED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('document-delete:'||lease.document_id::text,0));
 select * into lease from cocal_delete_private.processing_leases l where l.lease_id=p_lease_id for update;
 if lease.state<>'active' then return false;end if;
 update cocal_delete_private.processing_leases l set state='released',ended_at=clock_timestamp() where l.lease_id=p_lease_id;
 update public.uploaded_documents d set ocr_status=lease.previous_ocr_status where d.id=lease.document_id and d.deletion_state='active' and d.ocr_status='processing';
 return true;
end;$$;
revoke all on function public.begin_document_processing(uuid,uuid,uuid,uuid,uuid,text),public.finish_document_processing(uuid,uuid,jsonb),public.release_document_processing(uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_document_processing(uuid,uuid,uuid,uuid,uuid,text),public.finish_document_processing(uuid,uuid,jsonb),public.release_document_processing(uuid,uuid) to service_role;

drop index public.uploaded_documents_verified_project_hash_uniq;
create unique index uploaded_documents_verified_project_hash_uniq on public.uploaded_documents(project_id,sha256_hash) where hash_verification_status='server_verified' and deletion_state<>'deleted';
do $$declare definition text;old_fragment text:='d.hash_verification_status=''server_verified'' for share;';begin
 definition:=pg_get_functiondef('public.complete_upload_verification(uuid,uuid,text,text,bigint,text)'::regprocedure);
 if length(definition)-length(replace(definition,old_fragment,''))<>length(old_fragment) then raise exception 'Unrecognized approved verification definition';end if;
 execute replace(definition,old_fragment,'d.hash_verification_status=''server_verified'' and d.deletion_state<>''deleted'' for share;');
end;$$;
revoke all on all functions in schema cocal_delete_private from public,anon,authenticated,service_role;
grant execute on function cocal_delete_private.object_visible(text,text) to authenticated,anon;
revoke all on function public.document_deletion_request(uuid,jsonb,text),public.finalize_document_deletion(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.document_deletion_request(uuid,jsonb,text),public.finalize_document_deletion(uuid,jsonb) to service_role;
-- Approved source-only edits of these exact known 003 definitions: a previously
-- verified/reserved ID or duplicate target can never revive a fenced document.
do $$declare change record;definition text;begin
 for change in select * from(values
  ('public.begin_upload_verification(uuid,jsonb)',
   'perform cocal_attachment_private.assert_write(org,project,p_actor_user_id);',
   'perform cocal_attachment_private.assert_write(org,project,p_actor_user_id);perform cocal_delete_private.assert_unfenced(doc);'),
  ('public.complete_upload_verification(uuid,uuid,text,text,bigint,text)',
   'perform cocal_attachment_private.assert_write(v.organization_id,v.project_id,p_actor_user_id);',
   'perform cocal_attachment_private.assert_write(v.organization_id,v.project_id,p_actor_user_id);perform cocal_delete_private.assert_unfenced(v.document_id);'),
  ('public.complete_upload_verification(uuid,uuid,text,text,bigint,text)',
   'if target.status is distinct from ''active''',
   'if target.deletion_state<>''active'' then raise exception ''DOCUMENT_DELETE_PENDING'';end if; if target.status is distinct from ''active'''),
  ('cocal_attachment_private.result(cocal_attachment_private.verifications)',
   'if v.state=''reserved'' then',
   'perform cocal_delete_private.assert_unfenced(v.document_id);if v.state=''reserved'' then'),
  ('cocal_attachment_private.result(cocal_attachment_private.verifications)',
   'if not found then raise exception ''Verified receipt authority missing'';end if;',
   'if not found then raise exception ''Verified receipt authority missing'';end if;perform cocal_delete_private.assert_unfenced(receipt.id);')
 ) as changes(signature,old_text,new_text) loop
  definition:=pg_get_functiondef(change.signature::regprocedure);
  if length(definition)-length(replace(definition,change.old_text,''))<>length(change.old_text) then raise exception 'Unrecognized approved verification function';end if;
  execute replace(definition,change.old_text,change.new_text);
 end loop;
end;$$;
-- The entry assertion proved the old source. Update only these two known,
-- explicitly changed 003 fingerprints; never capture unrelated drift.
update cocal_attachment_private.source_baseline b set fingerprint=c.fingerprint from cocal_attachment_private.catalog_state() c
 where b.kind=c.kind and b.object_key=c.object_key and ((b.kind='index' and b.object_key='uploaded_documents_verified_project_hash_uniq')
 or(b.kind='function' and b.object_key in('public.complete_upload_verification(uuid,uuid,text,text,bigint,text)','public.begin_upload_verification(uuid,jsonb)','cocal_attachment_private.result(cocal_attachment_private.verifications)')));

create table cocal_delete_private.source_baseline(kind text,object_key text,fingerprint text,primary key(kind,object_key));
revoke all on cocal_delete_private.source_baseline from public,anon,authenticated,service_role;
create function cocal_delete_private.catalog_state() returns table(kind text,object_key text,fingerprint text)
language sql stable security definer set search_path='' as $$
 select 'function',p.oid::regprocedure::text,md5(jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',coalesce(p.proacl,acldefault('f',p.proowner))::text,'owner',p.proowner,'config',p.proconfig)::text)
 from pg_proc p where p.pronamespace='cocal_delete_private'::regnamespace or p.oid in(to_regprocedure('public.document_deletion_request(uuid,jsonb,text)'),to_regprocedure('public.finalize_document_deletion(uuid,jsonb)'),to_regprocedure('public.document_deletion_contract(uuid)'),to_regprocedure('public.begin_document_processing(uuid,uuid,uuid,uuid,uuid,text)'),to_regprocedure('public.finish_document_processing(uuid,uuid,jsonb)'),to_regprocedure('public.release_document_processing(uuid,uuid)'))
 union all select 'trigger',t.tgrelid::regclass::text||':'||t.tgname,md5(jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled,'type',t.tgtype)::text) from pg_trigger t where t.tgname in('deletion_draft_reference','deletion_activity_reference','deletion_report_reference','deletion_receipt_guard','deletion_object_guard')
 union all select 'policy',p.polname,md5(jsonb_build_object('definition',pg_get_expr(p.polqual,p.polrelid),'permissive',p.polpermissive,'roles',p.polroles,'command',p.polcmd)::text) from pg_policy p where p.polrelid='storage.objects'::regclass and p.polname='controlled_original_visibility'
 union all select 'table',c.relname,md5(jsonb_build_object('rls',c.relrowsecurity,'acl',coalesce(c.relacl,acldefault('r',c.relowner))::text,'owner',c.relowner)::text) from pg_class c where c.oid in('cocal_delete_private.operations'::regclass,'cocal_delete_private.source_baseline'::regclass,'cocal_delete_private.processing_leases'::regclass);
$$;
create function cocal_delete_private.deployment_ready() returns boolean language sql stable security definer set search_path='' as $$
 select cocal_attachment_private.deployment_ready() and (select count(*)>=10 from cocal_delete_private.source_baseline)
 and not exists((select * from cocal_delete_private.catalog_state() except select * from cocal_delete_private.source_baseline)
 union all(select * from cocal_delete_private.source_baseline except select * from cocal_delete_private.catalog_state()));
$$;
create function public.document_deletion_contract(p_project_id uuid) returns table(project_id uuid,organization_id uuid,contract_version text,can_delete boolean)
language plpgsql security definer set search_path='' as $$
declare org uuid;allowed boolean:=false;
begin
 select p.organization_id into org from public.projects p where p.id=p_project_id and cocal_storage_private.org_access(p.organization_id,false);if not found then return;end if;
 begin perform cocal_attachment_private.assert_write(org,p_project_id,auth.uid());allowed:=cocal_delete_private.deployment_ready();exception when insufficient_privilege then allowed:=false;end;
 return query select p_project_id,org,'20261106.delete.1'::text,allowed;
end;$$;
revoke all on function cocal_delete_private.catalog_state(),cocal_delete_private.deployment_ready(),public.document_deletion_contract(uuid) from public,anon,authenticated,service_role;
grant execute on function public.document_deletion_contract(uuid) to authenticated;
insert into cocal_delete_private.source_baseline select * from cocal_delete_private.catalog_state();
commit;
