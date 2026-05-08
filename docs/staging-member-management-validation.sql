-- Closed-beta member management validation SQL
-- Replace placeholders before executing.

-- ============================================================
-- 1) 查某組織 member list
-- ============================================================
select
  om.id,
  om.organization_id,
  om.user_id,
  om.invited_email,
  om.role,
  om.status,
  om.created_at,
  om.updated_at
from organization_members om
where om.organization_id = '<ORG_UUID>'::uuid
order by om.created_at desc;

-- ============================================================
-- 2) 查 role/status
-- ============================================================
select
  om.user_id,
  om.invited_email,
  om.role,
  om.status
from organization_members om
where om.organization_id = '<ORG_UUID>'::uuid
order by om.role, om.status;

-- ============================================================
-- 3) 查某 user 是否 active member
-- ============================================================
select exists (
  select 1
  from organization_members om
  where om.organization_id = '<ORG_UUID>'::uuid
    and om.user_id = '<USER_UUID>'::uuid
    and om.status = 'active'
) as is_active_member;

-- ============================================================
-- 4) 寫入限制驗證（owner/admin/editor/viewer）
-- ============================================================
-- 建議在 transaction 內測，最後 rollback。

begin;

-- 4-1 owner: 可新增 admin/editor/viewer（以下示範新增 viewer）
select set_config('request.jwt.claim.sub', '<OWNER_USER_UUID>', true);
select * from add_organization_member(
  p_organization_id => '<ORG_UUID>'::uuid,
  p_role => 'viewer',
  p_status => 'active',
  p_user_id => '<TARGET_USER_UUID_1>'::uuid
);

-- 4-2 admin: 可新增 editor/viewer（示範新增 editor）
select set_config('request.jwt.claim.sub', '<ADMIN_USER_UUID>', true);
select * from add_organization_member(
  p_organization_id => '<ORG_UUID>'::uuid,
  p_role => 'editor',
  p_status => 'active',
  p_user_id => '<TARGET_USER_UUID_2>'::uuid
);

-- 4-3 admin: 不可新增 admin（預期失敗）
-- select * from add_organization_member(
--   p_organization_id => '<ORG_UUID>'::uuid,
--   p_role => 'admin',
--   p_status => 'active',
--   p_user_id => '<TARGET_USER_UUID_3>'::uuid
-- );

-- 4-4 viewer: 不可寫入（預期失敗）
-- select set_config('request.jwt.claim.sub', '<VIEWER_USER_UUID>', true);
-- select * from add_organization_member(
--   p_organization_id => '<ORG_UUID>'::uuid,
--   p_role => 'viewer',
--   p_status => 'active',
--   p_user_id => '<TARGET_USER_UUID_4>'::uuid
-- );

-- 4-5 owner: 可調整 admin/editor/viewer（示範把 editor 調成 viewer）
select set_config('request.jwt.claim.sub', '<OWNER_USER_UUID>', true);
select * from update_organization_member_role(
  p_organization_id => '<ORG_UUID>'::uuid,
  p_member_id => '<TARGET_MEMBER_UUID>'::uuid,
  p_new_role => 'viewer'
);

-- 4-6 admin: 不可調整 owner（預期失敗）
-- select set_config('request.jwt.claim.sub', '<ADMIN_USER_UUID>', true);
-- select * from update_organization_member_role(
--   p_organization_id => '<ORG_UUID>'::uuid,
--   p_member_id => '<OWNER_MEMBER_UUID>'::uuid,
--   p_new_role => 'viewer'
-- );

-- 4-7 deactivate: 封測最小版改 status='inactive'
select set_config('request.jwt.claim.sub', '<OWNER_USER_UUID>', true);
select * from deactivate_organization_member(
  p_organization_id => '<ORG_UUID>'::uuid,
  p_member_id => '<TARGET_MEMBER_UUID>'::uuid
);

rollback;
