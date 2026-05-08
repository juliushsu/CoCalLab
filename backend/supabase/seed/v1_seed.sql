-- CaCalLab V1 seed data (non-production bootstrap only)
-- This file is intentionally separate from runtime logic to avoid mock data polluting production flow.

insert into organizations (
  id,
  slug,
  legal_name,
  display_name,
  tax_id,
  country_code,
  timezone,
  status
) values (
  '11111111-1111-4111-8111-111111111111',
  'demo-org',
  'Demo Carbon Co., Ltd.',
  'Demo Carbon',
  '12345678',
  'TW',
  'Asia/Taipei',
  'active'
) on conflict (id) do nothing;

insert into organization_members (
  id,
  organization_id,
  user_id,
  role,
  status,
  joined_at
) values (
  '21111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '31111111-1111-4111-8111-111111111111',
  'owner',
  'active',
  now()
) on conflict (id) do nothing;

insert into subscriptions (
  id,
  organization_id,
  plan_code,
  status,
  period_start,
  period_end,
  grace_until,
  features
) values (
  '41111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'starter_monthly',
  'active',
  now() - interval '10 days',
  now() + interval '20 days',
  now() + interval '27 days',
  '{"max_projects": 10, "ai_audit": true}'::jsonb
) on conflict (id) do nothing;

insert into projects (
  id,
  organization_id,
  project_code,
  name,
  description,
  reporting_start_date,
  reporting_end_date,
  boundary_type,
  status
) values (
  '51111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'PJT-2026-001',
  '2026 Corporate Inventory',
  'Demo project for CaCalLab V1',
  '2026-01-01',
  '2026-12-31',
  'operational_control',
  'active'
) on conflict (id) do nothing;

insert into emission_factors (
  id,
  organization_id,
  factor_key,
  factor_name,
  source_name,
  source_reference,
  source_url,
  source_region,
  category,
  subcategory,
  activity_type,
  unit,
  co2e_kg_per_unit,
  version,
  quality_tier,
  status,
  valid_from,
  valid_to
) values
(
  '61111111-1111-4111-8111-111111111111',
  null,
  'tw-grid-electricity',
  'Taiwan Grid Electricity',
  'MOENV',
  'TW-EF-2026',
  'https://www.moenv.gov.tw',
  'TW',
  'energy',
  'purchased_electricity',
  'electricity',
  'kWh',
  0.5090000000,
  1,
  'official',
  'active',
  '2026-01-01',
  null
),
(
  '62222222-1111-4111-8111-111111111111',
  null,
  'diesel-combustion',
  'Diesel Combustion',
  'IPCC',
  'IPCC-2006',
  'https://www.ipcc.ch',
  'GLOBAL',
  'stationary_combustion',
  'fuel',
  'fuel',
  'L',
  2.6800000000,
  1,
  'industry',
  'active',
  '2020-01-01',
  null
)
on conflict do nothing;
