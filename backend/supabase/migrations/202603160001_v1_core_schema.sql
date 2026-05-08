-- CaCalLab V1 core schema
-- Generated at 2026-03-16

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ===== Enums =====
create type organization_status as enum ('active', 'archived', 'suspended');
create type member_role as enum ('owner', 'admin', 'editor', 'viewer');
create type member_status as enum ('active', 'invited', 'inactive');
create type subscription_status as enum ('active', 'grace_period', 'readonly', 'suspended', 'canceled');
create type project_status as enum ('draft', 'active', 'closed', 'archived');
create type upload_status as enum ('active', 'archived');
create type ocr_status as enum ('pending', 'processing', 'succeeded', 'failed');
create type draft_status as enum ('pending_review', 'needs_clarification', 'confirmed', 'rejected');
create type classification_status as enum ('unclassified', 'classified');
create type activity_status as enum ('active', 'voided', 'archived');
create type inclusion_status as enum ('included', 'excluded', 'pending');
create type factor_quality_tier as enum ('official', 'industry', 'proxy', 'custom');
create type factor_status as enum ('active', 'deprecated', 'draft');
create type calculation_status as enum ('calculated', 'pending_factor', 'error', 'superseded');
create type report_status as enum ('queued', 'generating', 'completed', 'failed');
create type ai_audit_status as enum ('queued', 'running', 'completed', 'failed');
create type audit_actor_type as enum ('user', 'system', 'edge_function');
create type audit_log_status as enum ('recorded', 'redacted');

-- ===== Shared utility =====
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===== Core tenant tables =====
create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  legal_name text not null,
  display_name text not null,
  tax_id text,
  country_code char(2) not null default 'TW',
  timezone text not null default 'Asia/Taipei',
  status organization_status not null default 'active',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_archived_at_chk check (
    (status = 'archived' and archived_at is not null)
    or (status <> 'archived')
  )
);

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid,
  invited_email citext,
  role member_role not null,
  status member_status not null default 'invited',
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_identity_chk check (
    user_id is not null or invited_email is not null
  )
);

create unique index organization_members_org_user_uniq
  on organization_members (organization_id, user_id)
  where user_id is not null;

create unique index organization_members_org_invited_email_uniq
  on organization_members (organization_id, invited_email)
  where invited_email is not null and status = 'invited';

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_code text not null,
  status subscription_status not null default 'active',
  period_start timestamptz not null,
  period_end timestamptz not null,
  grace_until timestamptz,
  readonly_from timestamptz,
  provider text,
  provider_subscription_ref text,
  features jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_period_chk check (period_end > period_start)
);

create index subscriptions_org_status_period_idx
  on subscriptions (organization_id, status, period_end desc);

create table projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_code text not null,
  name text not null,
  description text,
  reporting_start_date date not null,
  reporting_end_date date not null,
  boundary_type text not null default 'operational_control',
  status project_status not null default 'draft',
  base_currency char(3) not null default 'TWD',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_reporting_period_chk
    check (reporting_end_date >= reporting_start_date),
  constraint projects_archived_at_chk check (
    (status = 'archived' and archived_at is not null)
    or (status <> 'archived')
  )
);

create unique index projects_org_project_code_uniq
  on projects (organization_id, project_code);

create index projects_org_status_period_idx
  on projects (organization_id, status, reporting_start_date, reporting_end_date);

-- ===== Document flow =====
create table uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  uploaded_by_user_id uuid,
  storage_bucket text not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  file_size_bytes bigint not null,
  sha256_hash text not null,
  document_type text not null default 'other',
  ocr_status ocr_status not null default 'pending',
  status upload_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  received_date date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uploaded_documents_file_size_chk check (file_size_bytes >= 0),
  constraint uploaded_documents_archived_at_chk check (
    (status = 'archived' and archived_at is not null)
    or (status <> 'archived')
  )
);

create unique index uploaded_documents_project_hash_uniq
  on uploaded_documents (project_id, sha256_hash);

create index uploaded_documents_org_project_ocr_idx
  on uploaded_documents (organization_id, project_id, ocr_status, created_at desc);

create table extracted_document_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  uploaded_document_id uuid not null references uploaded_documents(id) on delete cascade,
  extraction_version integer not null default 1,
  extraction_provider text,
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  status draft_status not null default 'pending_review',
  classification_status classification_status not null default 'unclassified',
  confidence_score numeric(5,4),
  suggested_activity_date date,
  suggested_category text,
  suggested_scope smallint,
  parsed_quantity numeric(20,8),
  parsed_unit text,
  parsed_vendor text,
  review_note text,
  reviewed_by_user_id uuid,
  reviewed_at timestamptz,
  is_latest boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extracted_document_drafts_confidence_chk check (
    confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)
  ),
  constraint extracted_document_drafts_scope_chk check (
    suggested_scope is null or suggested_scope in (1, 2, 3)
  )
);

create unique index extracted_document_drafts_doc_version_uniq
  on extracted_document_drafts (uploaded_document_id, extraction_version);

create unique index extracted_document_drafts_doc_latest_uniq
  on extracted_document_drafts (uploaded_document_id)
  where is_latest = true;

create index extracted_document_drafts_org_project_status_idx
  on extracted_document_drafts (organization_id, project_id, status, classification_status, created_at desc);

create table emission_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  source_document_id uuid references uploaded_documents(id),
  source_draft_id uuid references extracted_document_drafts(id),
  activity_code text not null,
  activity_name text not null,
  activity_date date not null,
  category text not null,
  subcategory text,
  activity_type text not null,
  quantity numeric(20,8) not null,
  unit text not null,
  normalized_quantity numeric(20,8),
  normalized_unit text,
  data_quality text not null default 'measured',
  inclusion_status inclusion_status not null default 'pending',
  exclusion_reason text,
  review_note text,
  suggested_scope smallint,
  final_scope smallint,
  confidence_score numeric(5,4),
  status activity_status not null default 'active',
  archived_at timestamptz,
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emission_activities_quantity_chk check (quantity >= 0),
  constraint emission_activities_normalized_quantity_chk check (
    normalized_quantity is null or normalized_quantity >= 0
  ),
  constraint emission_activities_confidence_chk check (
    confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)
  ),
  constraint emission_activities_suggested_scope_chk check (
    suggested_scope is null or suggested_scope in (1, 2, 3)
  ),
  constraint emission_activities_final_scope_chk check (
    final_scope is null or final_scope in (1, 2, 3)
  ),
  constraint emission_activities_exclusion_chk check (
    (inclusion_status = 'excluded' and exclusion_reason is not null)
    or (inclusion_status <> 'excluded')
  ),
  constraint emission_activities_archived_at_chk check (
    (status = 'archived' and archived_at is not null)
    or (status <> 'archived')
  )
);

create unique index emission_activities_org_project_activity_code_uniq
  on emission_activities (organization_id, project_id, activity_code);

create index emission_activities_project_scope_idx
  on emission_activities (project_id, inclusion_status, final_scope, activity_date);

create index emission_activities_org_status_idx
  on emission_activities (organization_id, status, created_at desc);

-- ===== Factors and calculations =====
create table emission_factors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  factor_key text not null,
  factor_name text not null,
  source_name text not null,
  source_reference text,
  source_url text,
  source_region text not null default 'TW',
  category text not null,
  subcategory text,
  activity_type text not null,
  unit text not null,
  co2e_kg_per_unit numeric(20,10) not null,
  co2_kg_per_unit numeric(20,10),
  ch4_kg_per_unit numeric(20,10),
  n2o_kg_per_unit numeric(20,10),
  valid_from date not null,
  valid_to date,
  version integer not null,
  quality_tier factor_quality_tier not null default 'official',
  status factor_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emission_factors_valid_period_chk check (
    valid_to is null or valid_to >= valid_from
  ),
  constraint emission_factors_positive_chk check (
    co2e_kg_per_unit >= 0
  )
);

create unique index emission_factors_org_key_version_uniq
  on emission_factors (organization_id, factor_key, version)
  where organization_id is not null;

create unique index emission_factors_global_key_version_uniq
  on emission_factors (factor_key, version)
  where organization_id is null;

create index emission_factors_lookup_idx
  on emission_factors (
    organization_id,
    activity_type,
    category,
    subcategory,
    unit,
    source_region,
    status,
    valid_from desc
  );

create table calculation_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  emission_activity_id uuid not null references emission_activities(id) on delete cascade,
  calc_version integer not null default 1,
  status calculation_status not null default 'calculated',
  is_latest boolean not null default true,
  co2e_kg numeric(20,10),
  co2_kg numeric(20,10),
  ch4_kg numeric(20,10),
  n2o_kg numeric(20,10),
  factor_id uuid references emission_factors(id),
  factor_snapshot jsonb not null,
  input_snapshot jsonb not null,
  formula_version text not null,
  warnings jsonb not null default '[]'::jsonb,
  error_code text,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index calculation_results_activity_version_uniq
  on calculation_results (emission_activity_id, calc_version);

create unique index calculation_results_activity_latest_uniq
  on calculation_results (emission_activity_id)
  where is_latest = true;

create index calculation_results_project_status_idx
  on calculation_results (project_id, status, is_latest, calculated_at desc);

create table report_generations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  generated_by_user_id uuid,
  status report_status not null default 'queued',
  report_version integer not null,
  payload jsonb not null,
  payload_hash text not null,
  reporting_period_start date not null,
  reporting_period_end date not null,
  included_activity_count integer not null default 0,
  excluded_activity_count integer not null default 0,
  pending_activity_count integer not null default 0,
  scope_totals jsonb not null default '{}'::jsonb,
  category_totals jsonb not null default '{}'::jsonb,
  factor_sources jsonb not null default '[]'::jsonb,
  warning_count integer not null default 0,
  based_on_calculated_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_generations_period_chk check (
    reporting_period_end >= reporting_period_start
  )
);

create unique index report_generations_project_version_uniq
  on report_generations (project_id, report_version);

create index report_generations_project_status_idx
  on report_generations (project_id, status, created_at desc);

create table ai_audit_results (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  report_generation_id uuid references report_generations(id) on delete set null,
  run_by_user_id uuid,
  model_provider text,
  model_name text,
  model_version text,
  status ai_audit_status not null default 'queued',
  input_snapshot jsonb not null,
  completeness_flags jsonb not null default '[]'::jsonb,
  anomaly_flags jsonb not null default '[]'::jsonb,
  exclusion_review_flags jsonb not null default '[]'::jsonb,
  hotspot_ranking jsonb not null default '[]'::jsonb,
  summary_text jsonb not null default '{}'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  token_usage jsonb not null default '{}'::jsonb,
  confidence_score numeric(5,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_audit_results_confidence_chk check (
    confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)
  )
);

create index ai_audit_results_project_status_idx
  on ai_audit_results (project_id, status, created_at desc);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  actor_user_id uuid,
  actor_type audit_actor_type not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  status audit_log_status not null default 'recorded',
  request_id text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audit_logs_org_project_created_idx
  on audit_logs (organization_id, project_id, created_at desc);

create index audit_logs_entity_created_idx
  on audit_logs (entity_type, entity_id, created_at desc);

-- ===== Triggers =====
create trigger trg_organizations_updated_at
before update on organizations
for each row execute function set_updated_at();

create trigger trg_organization_members_updated_at
before update on organization_members
for each row execute function set_updated_at();

create trigger trg_subscriptions_updated_at
before update on subscriptions
for each row execute function set_updated_at();

create trigger trg_projects_updated_at
before update on projects
for each row execute function set_updated_at();

create trigger trg_uploaded_documents_updated_at
before update on uploaded_documents
for each row execute function set_updated_at();

create trigger trg_extracted_document_drafts_updated_at
before update on extracted_document_drafts
for each row execute function set_updated_at();

create trigger trg_emission_activities_updated_at
before update on emission_activities
for each row execute function set_updated_at();

create trigger trg_emission_factors_updated_at
before update on emission_factors
for each row execute function set_updated_at();

create trigger trg_calculation_results_updated_at
before update on calculation_results
for each row execute function set_updated_at();

create trigger trg_report_generations_updated_at
before update on report_generations
for each row execute function set_updated_at();

create trigger trg_ai_audit_results_updated_at
before update on ai_audit_results
for each row execute function set_updated_at();

create trigger trg_audit_logs_updated_at
before update on audit_logs
for each row execute function set_updated_at();

-- ===== Multi-tenant RLS helpers =====
create or replace function is_active_org_member(target_org_id uuid, allowed_roles member_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_members om
    where om.organization_id = target_org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and (
        allowed_roles is null
        or om.role = any(allowed_roles)
      )
  );
$$;

create or replace function organization_is_writable(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from subscriptions s
    where s.organization_id = target_org_id
      and s.status in ('active', 'grace_period')
      and now() >= s.period_start
      and now() <= coalesce(s.grace_until, s.period_end)
    order by s.period_end desc
    limit 1
  );
$$;

-- ===== RLS enablement =====
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table subscriptions enable row level security;
alter table projects enable row level security;
alter table uploaded_documents enable row level security;
alter table extracted_document_drafts enable row level security;
alter table emission_activities enable row level security;
alter table emission_factors enable row level security;
alter table calculation_results enable row level security;
alter table report_generations enable row level security;
alter table ai_audit_results enable row level security;
alter table audit_logs enable row level security;

-- Read policies
create policy organizations_select_policy
  on organizations for select
  using (is_active_org_member(id));

create policy organization_members_select_policy
  on organization_members for select
  using (is_active_org_member(organization_id));

create policy subscriptions_select_policy
  on subscriptions for select
  using (is_active_org_member(organization_id));

create policy projects_select_policy
  on projects for select
  using (is_active_org_member(organization_id));

create policy uploaded_documents_select_policy
  on uploaded_documents for select
  using (is_active_org_member(organization_id));

create policy extracted_document_drafts_select_policy
  on extracted_document_drafts for select
  using (is_active_org_member(organization_id));

create policy emission_activities_select_policy
  on emission_activities for select
  using (is_active_org_member(organization_id));

create policy emission_factors_select_policy
  on emission_factors for select
  using (
    organization_id is null
    or is_active_org_member(organization_id)
  );

create policy calculation_results_select_policy
  on calculation_results for select
  using (is_active_org_member(organization_id));

create policy report_generations_select_policy
  on report_generations for select
  using (is_active_org_member(organization_id));

create policy ai_audit_results_select_policy
  on ai_audit_results for select
  using (is_active_org_member(organization_id));

create policy audit_logs_select_policy
  on audit_logs for select
  using (is_active_org_member(organization_id));

-- Write policies (owner/admin/editor + writable subscription)
create policy projects_write_policy
  on projects for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );

create policy uploaded_documents_write_policy
  on uploaded_documents for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );

create policy extracted_document_drafts_write_policy
  on extracted_document_drafts for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );

create policy emission_activities_write_policy
  on emission_activities for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );

create policy calculation_results_write_policy
  on calculation_results for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );

create policy report_generations_write_policy
  on report_generations for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );

create policy ai_audit_results_write_policy
  on ai_audit_results for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );

create policy audit_logs_write_policy
  on audit_logs for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );

-- factors: custom factors can be written only in own org
create policy emission_factors_write_policy
  on emission_factors for all
  using (
    organization_id is not null
    and is_active_org_member(organization_id, array['owner', 'admin']::member_role[])
  )
  with check (
    organization_id is not null
    and is_active_org_member(organization_id, array['owner', 'admin']::member_role[])
    and organization_is_writable(organization_id)
  );
