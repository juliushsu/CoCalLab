-- Org read-chain validation / repair for Project create selector

-- A) 查目前登入 user 可見的 organizations（canonical）
select * from list_my_organizations();

-- B) 若空，先檢查是否根本無 organizations
select id, slug, display_name, status, env, is_test, created_at
from organizations
order by created_at desc;

-- C) 檢查當前 user membership（請替換 USER_UUID）
select id, organization_id, user_id, invited_email, role, status, created_at
from organization_members
where user_id = '<USER_UUID>'::uuid
order by created_at desc;

-- D) staging 最小修補（若該 user 無 active membership）
-- 1) 建測試 organization
insert into organizations (slug, legal_name, display_name, status, env, is_test)
values ('stg-bootstrap-org', '[STG] Bootstrap Org', '[STG] Bootstrap Org', 'active', 'staging', true)
on conflict (slug) do update set
  display_name = excluded.display_name,
  legal_name = excluded.legal_name,
  status = 'active',
  env = 'staging',
  is_test = true,
  updated_at = now();

-- 2) 綁到測試帳號 owner/active（替換 USER_UUID）
insert into organization_members (
  organization_id,
  user_id,
  role,
  status,
  joined_at,
  env,
  is_test
)
select o.id, '<USER_UUID>'::uuid, 'owner', 'active', now(), 'staging', true
from organizations o
where o.slug = 'stg-bootstrap-org'
on conflict (organization_id, user_id) do update set
  role = 'owner',
  status = 'active',
  joined_at = coalesce(organization_members.joined_at, excluded.joined_at),
  env = 'staging',
  is_test = true,
  updated_at = now();

-- 3) 再驗一次 canonical list
select * from list_my_organizations();
