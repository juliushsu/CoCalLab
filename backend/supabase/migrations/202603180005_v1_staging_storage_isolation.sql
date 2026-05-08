-- Staging storage isolation: dedicated buckets + path policies

insert into storage.buckets (id, name, public)
values
  ('staging-receipts', 'staging-receipts', false),
  ('staging-attachments', 'staging-attachments', false)
on conflict (id) do nothing;

-- storage.objects RLS is managed by Supabase storage service and is already enabled.

drop policy if exists stg_receipts_insert_auth on storage.objects;
create policy stg_receipts_insert_auth
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'staging-receipts'
  and (storage.foldername(name))[1] = 'staging'
);

drop policy if exists stg_receipts_select_auth on storage.objects;
create policy stg_receipts_select_auth
on storage.objects
for select
to authenticated
using (
  bucket_id = 'staging-receipts'
  and (storage.foldername(name))[1] = 'staging'
);

drop policy if exists stg_receipts_update_auth on storage.objects;
create policy stg_receipts_update_auth
on storage.objects
for update
to authenticated
using (
  bucket_id = 'staging-receipts'
  and (storage.foldername(name))[1] = 'staging'
)
with check (
  bucket_id = 'staging-receipts'
  and (storage.foldername(name))[1] = 'staging'
);

drop policy if exists stg_receipts_delete_auth on storage.objects;
create policy stg_receipts_delete_auth
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'staging-receipts'
  and (storage.foldername(name))[1] = 'staging'
);

drop policy if exists stg_attachments_insert_auth on storage.objects;
create policy stg_attachments_insert_auth
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'staging-attachments'
  and (storage.foldername(name))[1] = 'staging'
);

drop policy if exists stg_attachments_select_auth on storage.objects;
create policy stg_attachments_select_auth
on storage.objects
for select
to authenticated
using (
  bucket_id = 'staging-attachments'
  and (storage.foldername(name))[1] = 'staging'
);

drop policy if exists stg_attachments_update_auth on storage.objects;
create policy stg_attachments_update_auth
on storage.objects
for update
to authenticated
using (
  bucket_id = 'staging-attachments'
  and (storage.foldername(name))[1] = 'staging'
)
with check (
  bucket_id = 'staging-attachments'
  and (storage.foldername(name))[1] = 'staging'
);

drop policy if exists stg_attachments_delete_auth on storage.objects;
create policy stg_attachments_delete_auth
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'staging-attachments'
  and (storage.foldername(name))[1] = 'staging'
);
