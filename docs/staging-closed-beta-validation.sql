-- CaCalLab Staging / Closed Beta validation SQL
-- WARNING: this script is for staging only.

-- ============================================================
-- 0) Context check
-- ============================================================
select 'organizations' as table_name, count(*) as staging_rows
from organizations
where env = 'staging' or is_test = true;

-- ============================================================
-- 1) Flow validation: uploaded_documents -> drafts -> activities
-- ============================================================
-- Expectation: each uploaded document should have at least one draft.
select
  ud.id as uploaded_document_id,
  ud.project_id,
  ud.organization_id,
  count(distinct edd.id) as draft_count,
  count(distinct ea.id) as activity_count
from uploaded_documents ud
left join extracted_document_drafts edd on edd.uploaded_document_id = ud.id
left join emission_activities ea on ea.source_document_id = ud.id
where ud.env = 'staging' or ud.is_test = true
group by ud.id, ud.project_id, ud.organization_id
order by ud.created_at desc;

-- Expectation: confirmed drafts should map to one activity (no orphan confirmed draft).
select
  edd.id as confirmed_draft_id,
  edd.project_id,
  edd.organization_id,
  count(ea.id) as linked_activity_count
from extracted_document_drafts edd
left join emission_activities ea on ea.source_draft_id = edd.id
where edd.status = 'confirmed'
  and (edd.env = 'staging' or edd.is_test = true)
group by edd.id, edd.project_id, edd.organization_id
having count(ea.id) <> 1;

-- Expectation: all emission activities are inside reporting period.
select
  ea.id as emission_activity_id,
  ea.activity_date,
  p.reporting_start_date,
  p.reporting_end_date,
  ea.project_id
from emission_activities ea
join projects p on p.id = ea.project_id
where (ea.env = 'staging' or ea.is_test = true)
  and (ea.activity_date < p.reporting_start_date or ea.activity_date > p.reporting_end_date)
order by ea.created_at desc;

-- Expectation: project boundary isolation (same org, different projects) should not cross-link documents/drafts/activities.
select
  p.organization_id,
  p.id as project_id,
  count(distinct ud.id) as doc_count,
  count(distinct edd.id) as draft_count,
  count(distinct ea.id) as activity_count
from projects p
left join uploaded_documents ud on ud.project_id = p.id
left join extracted_document_drafts edd on edd.project_id = p.id
left join emission_activities ea on ea.project_id = p.id
where p.env = 'staging' or p.is_test = true
group by p.organization_id, p.id
order by p.organization_id, p.id;

-- ============================================================
-- 2) Role matrix validation (membership + expected write permission)
-- ============================================================
-- Replace <ORG_UUID> with target organization.
select
  om.organization_id,
  om.user_id,
  om.role,
  om.status,
  (om.status = 'active' and om.role in ('owner', 'admin', 'editor')) as should_have_write_access
from organization_members om
where om.organization_id = '<ORG_UUID>'::uuid
order by om.role, om.user_id;

-- RLS helper check using simulated JWT subject (run once per user_id).
-- Example:
-- select set_config('request.jwt.claim.sub', '<USER_UUID>', true);
-- select is_active_org_member('<ORG_UUID>'::uuid);
-- select is_active_org_member('<ORG_UUID>'::uuid, array['owner','admin','editor']::member_role[]);

-- Subscription write gate check.
select
  s.organization_id,
  s.status,
  s.period_start,
  s.period_end,
  s.grace_until,
  case
    when s.status in ('active', 'grace_period') and now() between s.period_start and coalesce(s.grace_until, s.period_end)
      then true
    else false
  end as should_allow_writes
from subscriptions s
where s.organization_id = '<ORG_UUID>'::uuid
order by s.period_end desc;

-- ============================================================
-- 3) Staging recycle validation (dry run + purge + post check)
-- ============================================================
-- Step 1: dry run count before purge.
select * from purge_staging_data_dry_run() order by table_name;

-- Step 2: execute purge (staging only).
-- select * from purge_staging_data() order by table_name;

-- Step 3: verify all staging rows are cleared.
select * from purge_staging_data_dry_run()
where row_count <> 0
order by table_name;
