-- Verify new organization + owner membership linkage
-- Replace placeholders before running.

-- 1) Check organization exists
select
  o.id,
  o.slug,
  o.display_name,
  o.status,
  o.env,
  o.is_test,
  o.created_at
from organizations o
where o.id = '<ORG_UUID>'::uuid
   or o.slug = '<ORG_SLUG>'::citext;

-- 2) Check current user has active owner membership for that org
select
  om.id,
  om.organization_id,
  om.user_id,
  om.role,
  om.status,
  om.joined_at,
  om.env,
  om.is_test,
  om.created_at
from organization_members om
where om.organization_id = '<ORG_UUID>'::uuid
  and om.user_id = '<USER_UUID>'::uuid;

-- 3) Optional: membership-backed organization list used by project selector
select
  o.id,
  o.slug,
  o.display_name,
  o.status
from organizations o
join organization_members om
  on om.organization_id = o.id
where om.user_id = '<USER_UUID>'::uuid
  and om.status = 'active'
order by o.display_name;
