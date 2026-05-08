-- CaCalLab canonical seed pack governance (staging-first)

create table if not exists seed_pack_registry (
  scenario_code text primary key,
  seed_pack_version text not null,
  schema_version text not null,
  title text not null,
  description text,
  is_active boolean not null default true,
  is_canonical boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists seed_pack_reseed_runs (
  id uuid primary key default gen_random_uuid(),
  scenario_code text not null references seed_pack_registry(scenario_code) on delete restrict,
  seed_pack_version text not null,
  run_type text not null,
  status text not null,
  initiated_by text,
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists seed_pack_reseed_runs_scenario_started_idx
  on seed_pack_reseed_runs (scenario_code, started_at desc);

drop trigger if exists trg_seed_pack_registry_updated_at on seed_pack_registry;
create trigger trg_seed_pack_registry_updated_at
before update on seed_pack_registry
for each row execute function set_updated_at();

insert into seed_pack_registry (
  scenario_code,
  seed_pack_version,
  schema_version,
  title,
  description,
  is_active,
  is_canonical,
  metadata
)
values (
  'stg_core_closed_beta',
  'v2026.04.07',
  '202604070006',
  'Staging Core Closed Beta Canonical Pack',
  'Canonical staging seed for documents, activities, calculations, analytics, reports, and adjustments.',
  true,
  true,
  jsonb_build_object(
    'organization_id', 'a1111111-1111-4111-8111-111111111111',
    'primary_project_id', 'a3333333-1111-4111-8111-111111111111',
    'secondary_project_id', 'a3333333-2222-4222-8222-222222222222',
    'report_generation_id', 'a9000000-1111-4111-8111-111111111111',
    'adjustment_item_id', 'b1111111-1111-4111-8111-111111111111'
  )
)
on conflict (scenario_code)
do update set
  seed_pack_version = excluded.seed_pack_version,
  schema_version = excluded.schema_version,
  title = excluded.title,
  description = excluded.description,
  is_active = excluded.is_active,
  is_canonical = excluded.is_canonical,
  metadata = excluded.metadata,
  updated_at = now();

-- Align canonical rule baseline so eligibility API is consistent with report summary seed.
update adjustment_claim_rules
set
  max_deduction_ratio = 0.8,
  updated_at = now()
where rule_code = 'stg_rule_tw_internal_re_2026'
  and jurisdiction_code = 'TW'
  and claim_purpose = 'internal_management'
  and adjustment_type = 'renewable_electricity_attribute';
