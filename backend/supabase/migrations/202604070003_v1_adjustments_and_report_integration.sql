-- CaCalLab V1 carbon adjustments + report integration (staging-first)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'carbon_adjustment_type_code') THEN
    CREATE TYPE carbon_adjustment_type_code AS ENUM (
      'offset_credit',
      'renewable_electricity_attribute',
      'carbon_removal',
      'carbon_storage',
      'regulatory_deduction'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_purpose_code') THEN
    CREATE TYPE claim_purpose_code AS ENUM (
      'taiwan_carbon_fee',
      'voluntary_claim',
      'ifrs_s2_note',
      'esg_note',
      'internal_management'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'certificate_verification_status') THEN
    CREATE TYPE certificate_verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adjustment_approval_status') THEN
    CREATE TYPE adjustment_approval_status AS ENUM ('draft', 'pending', 'approved', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adjustment_application_status') THEN
    CREATE TYPE adjustment_application_status AS ENUM ('draft', 'submitted', 'approved', 'applied', 'inactive');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'usage_lock_status') THEN
    CREATE TYPE usage_lock_status AS ENUM ('available', 'reserved', 'consumed', 'released');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adjustment_double_counting_status') THEN
    CREATE TYPE adjustment_double_counting_status AS ENUM ('unchecked', 'clear', 'suspected', 'blocked');
  END IF;
END;
$$;

create table if not exists carbon_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  adjustment_type carbon_adjustment_type_code not null,
  name text not null,
  description text,
  claim_purpose claim_purpose_code not null default 'internal_management',
  quantity_total_tco2e numeric(20,8) not null,
  quantity_available_tco2e numeric(20,8) not null,
  quantity_reserved_tco2e numeric(20,8) not null default 0,
  quantity_consumed_tco2e numeric(20,8) not null default 0,
  usage_lock_status usage_lock_status not null default 'available',
  target_type text not null default 'organization',
  target_id uuid,
  jurisdiction_code text not null default 'TW',
  vintage_year integer,
  effective_from date,
  effective_to date,
  certificate_verification_status certificate_verification_status not null default 'unverified',
  approval_status adjustment_approval_status not null default 'draft',
  double_counting_status adjustment_double_counting_status not null default 'unchecked',
  proof_document_status text not null default 'missing',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid,
  is_test boolean not null default true,
  env text not null default 'staging',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carbon_adjustment_items_quantity_chk check (
    quantity_total_tco2e >= 0
    and quantity_available_tco2e >= 0
    and quantity_reserved_tco2e >= 0
    and quantity_consumed_tco2e >= 0
    and quantity_available_tco2e <= quantity_total_tco2e
  ),
  constraint carbon_adjustment_items_effective_period_chk check (
    effective_to is null or effective_from is null or effective_to >= effective_from
  ),
  constraint carbon_adjustment_items_target_type_chk check (
    target_type in ('organization', 'project')
  )
);

create index if not exists carbon_adjustment_items_org_project_idx
  on carbon_adjustment_items (organization_id, project_id, adjustment_type, claim_purpose, status);

create index if not exists carbon_adjustment_items_usage_lock_idx
  on carbon_adjustment_items (organization_id, usage_lock_status, approval_status, certificate_verification_status);

create index if not exists carbon_adjustment_items_env_idx
  on carbon_adjustment_items (env, is_test);

create table if not exists adjustment_certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  carbon_adjustment_item_id uuid not null references carbon_adjustment_items(id) on delete cascade,
  program text not null,
  registry text,
  certificate_number text not null,
  serial_number text,
  vintage_year integer,
  issue_date date,
  retirement_date date,
  retired_quantity_tco2e numeric(20,8) not null,
  retired_quantity_available_tco2e numeric(20,8) not null,
  quantity_reserved_tco2e numeric(20,8) not null default 0,
  quantity_consumed_tco2e numeric(20,8) not null default 0,
  usage_lock_status usage_lock_status not null default 'available',
  verification_status certificate_verification_status not null default 'unverified',
  approval_status adjustment_approval_status not null default 'draft',
  double_counting_check_status adjustment_double_counting_status not null default 'unchecked',
  proof_attachment_bucket text,
  proof_attachment_path text,
  proof_attachment_hash text,
  metadata jsonb not null default '{}'::jsonb,
  is_test boolean not null default true,
  env text not null default 'staging',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adjustment_certificates_quantity_chk check (
    retired_quantity_tco2e >= 0
    and retired_quantity_available_tco2e >= 0
    and quantity_reserved_tco2e >= 0
    and quantity_consumed_tco2e >= 0
    and retired_quantity_available_tco2e <= retired_quantity_tco2e
  ),
  constraint adjustment_certificates_retirement_chk check (
    retirement_date is null or issue_date is null or retirement_date >= issue_date
  )
);

create unique index if not exists adjustment_certificates_org_number_uniq
  on adjustment_certificates (organization_id, certificate_number);

create index if not exists adjustment_certificates_item_idx
  on adjustment_certificates (carbon_adjustment_item_id, verification_status, approval_status, usage_lock_status);

create index if not exists adjustment_certificates_env_idx
  on adjustment_certificates (env, is_test);

create table if not exists adjustment_claim_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  rule_code text not null,
  rule_name text not null,
  jurisdiction_code text not null,
  effective_year integer not null,
  claim_purpose claim_purpose_code not null,
  adjustment_type carbon_adjustment_type_code not null,
  max_deduction_ratio numeric(10,6) not null default 1,
  inventory_impact_mode text not null default 'claim_only',
  certificate_verification_required boolean not null default true,
  approval_required boolean not null default true,
  requires_retirement boolean not null default true,
  priority integer not null default 100,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  is_test boolean not null default true,
  env text not null default 'staging',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adjustment_claim_rules_ratio_chk check (
    max_deduction_ratio >= 0 and max_deduction_ratio <= 1
  )
);

create unique index if not exists adjustment_claim_rules_scope_uniq
  on adjustment_claim_rules (
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    jurisdiction_code,
    effective_year,
    claim_purpose,
    adjustment_type,
    priority
  );

create index if not exists adjustment_claim_rules_lookup_idx
  on adjustment_claim_rules (organization_id, jurisdiction_code, effective_year, claim_purpose, adjustment_type, is_active);

create index if not exists adjustment_claim_rules_env_idx
  on adjustment_claim_rules (env, is_test);

create table if not exists adjustment_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  report_generation_id uuid references report_generations(id) on delete set null,
  adjustment_item_id uuid not null references carbon_adjustment_items(id) on delete restrict,
  certificate_id uuid references adjustment_certificates(id) on delete set null,
  claim_purpose claim_purpose_code not null,
  requested_quantity_tco2e numeric(20,8) not null,
  eligible_quantity_tco2e numeric(20,8) not null default 0,
  disallowed_quantity_tco2e numeric(20,8) not null default 0,
  disallow_reasons jsonb not null default '[]'::jsonb,
  inventory_impact_mode text not null default 'claim_only',
  status adjustment_application_status not null default 'draft',
  idempotency_key text,
  payload_hash text,
  submitted_by_user_id uuid,
  approved_by_user_id uuid,
  submitted_at timestamptz,
  approved_at timestamptz,
  applied_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  is_test boolean not null default true,
  env text not null default 'staging',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adjustment_applications_quantity_chk check (
    requested_quantity_tco2e > 0
    and eligible_quantity_tco2e >= 0
    and disallowed_quantity_tco2e >= 0
  )
);

create unique index if not exists adjustment_applications_org_idempotency_uniq
  on adjustment_applications (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists adjustment_applications_org_project_status_idx
  on adjustment_applications (organization_id, project_id, claim_purpose, status, created_at desc);

create index if not exists adjustment_applications_item_idx
  on adjustment_applications (adjustment_item_id, certificate_id, status);

create index if not exists adjustment_applications_env_idx
  on adjustment_applications (env, is_test);

create table if not exists adjustment_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  actor_user_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid,
  adjustment_item_id uuid references carbon_adjustment_items(id) on delete set null,
  certificate_id uuid references adjustment_certificates(id) on delete set null,
  application_id uuid references adjustment_applications(id) on delete set null,
  status audit_log_status not null default 'recorded',
  metadata jsonb not null default '{}'::jsonb,
  before_state jsonb,
  after_state jsonb,
  is_test boolean not null default true,
  env text not null default 'staging',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists adjustment_audit_logs_org_created_idx
  on adjustment_audit_logs (organization_id, created_at desc);

create index if not exists adjustment_audit_logs_record_idx
  on adjustment_audit_logs (table_name, record_id, created_at desc);

create index if not exists adjustment_audit_logs_env_idx
  on adjustment_audit_logs (env, is_test);

drop trigger if exists trg_carbon_adjustment_items_updated_at on carbon_adjustment_items;
create trigger trg_carbon_adjustment_items_updated_at
before update on carbon_adjustment_items
for each row execute function set_updated_at();

drop trigger if exists trg_adjustment_certificates_updated_at on adjustment_certificates;
create trigger trg_adjustment_certificates_updated_at
before update on adjustment_certificates
for each row execute function set_updated_at();

drop trigger if exists trg_adjustment_claim_rules_updated_at on adjustment_claim_rules;
create trigger trg_adjustment_claim_rules_updated_at
before update on adjustment_claim_rules
for each row execute function set_updated_at();

drop trigger if exists trg_adjustment_applications_updated_at on adjustment_applications;
create trigger trg_adjustment_applications_updated_at
before update on adjustment_applications
for each row execute function set_updated_at();

drop trigger if exists trg_adjustment_audit_logs_updated_at on adjustment_audit_logs;
create trigger trg_adjustment_audit_logs_updated_at
before update on adjustment_audit_logs
for each row execute function set_updated_at();

alter table carbon_adjustment_items enable row level security;
alter table adjustment_certificates enable row level security;
alter table adjustment_claim_rules enable row level security;
alter table adjustment_applications enable row level security;
alter table adjustment_audit_logs enable row level security;

drop policy if exists carbon_adjustment_items_select_policy on carbon_adjustment_items;
create policy carbon_adjustment_items_select_policy
  on carbon_adjustment_items for select
  using (is_active_org_member(organization_id));

drop policy if exists carbon_adjustment_items_write_policy on carbon_adjustment_items;
create policy carbon_adjustment_items_write_policy
  on carbon_adjustment_items for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );

drop policy if exists adjustment_certificates_select_policy on adjustment_certificates;
create policy adjustment_certificates_select_policy
  on adjustment_certificates for select
  using (is_active_org_member(organization_id));

drop policy if exists adjustment_certificates_write_policy on adjustment_certificates;
create policy adjustment_certificates_write_policy
  on adjustment_certificates for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );

drop policy if exists adjustment_claim_rules_select_policy on adjustment_claim_rules;
create policy adjustment_claim_rules_select_policy
  on adjustment_claim_rules for select
  using (
    organization_id is null
    or is_active_org_member(organization_id)
  );

drop policy if exists adjustment_claim_rules_write_policy on adjustment_claim_rules;
create policy adjustment_claim_rules_write_policy
  on adjustment_claim_rules for all
  using (
    organization_id is not null
    and is_active_org_member(organization_id, array['owner', 'admin']::member_role[])
  )
  with check (
    organization_id is not null
    and is_active_org_member(organization_id, array['owner', 'admin']::member_role[])
    and organization_is_writable(organization_id)
  );

drop policy if exists adjustment_applications_select_policy on adjustment_applications;
create policy adjustment_applications_select_policy
  on adjustment_applications for select
  using (is_active_org_member(organization_id));

drop policy if exists adjustment_applications_write_policy on adjustment_applications;
create policy adjustment_applications_write_policy
  on adjustment_applications for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );

drop policy if exists adjustment_audit_logs_select_policy on adjustment_audit_logs;
create policy adjustment_audit_logs_select_policy
  on adjustment_audit_logs for select
  using (is_active_org_member(organization_id));

drop policy if exists adjustment_audit_logs_write_policy on adjustment_audit_logs;
create policy adjustment_audit_logs_write_policy
  on adjustment_audit_logs for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );

alter table report_generations
  add column if not exists gross_emissions_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists adjustment_summary jsonb not null default '{}'::jsonb,
  add column if not exists claim_results jsonb not null default '{}'::jsonb,
  add column if not exists adjustment_manifest jsonb not null default '[]'::jsonb,
  add column if not exists claim_purpose claim_purpose_code not null default 'internal_management';

create index if not exists report_generations_claim_purpose_idx
  on report_generations (organization_id, project_id, claim_purpose, created_at desc);
