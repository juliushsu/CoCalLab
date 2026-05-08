-- CaCalLab Canonical Seed Pack (staging)
-- Scenario: stg_core_closed_beta
-- Seed pack version: v2026.04.07
-- Usage:
--   npx supabase db query --linked -f supabase/seed/canonical_seed_pack_staging_v20260407.sql

begin;

insert into seed_pack_reseed_runs (
  scenario_code,
  seed_pack_version,
  run_type,
  status,
  initiated_by,
  summary
)
values (
  'stg_core_closed_beta',
  'v2026.04.07',
  'reseed',
  'started',
  'codex',
  jsonb_build_object('note', 'canonical seed pack reseed start')
);

-- 1) Clean staging/test records first (DB rows only; storage objects are not deleted via SQL).
delete from action_logs where env = 'staging' or is_test = true;
delete from adjustment_audit_logs where env = 'staging' or is_test = true;
delete from adjustment_applications where env = 'staging' or is_test = true;
delete from adjustment_certificates where env = 'staging' or is_test = true;
delete from adjustment_claim_rules where env = 'staging' or is_test = true;
delete from carbon_adjustment_items where env = 'staging' or is_test = true;
delete from ai_audit_results where env = 'staging' or is_test = true;
delete from report_generations where env = 'staging' or is_test = true;
delete from calculation_results where env = 'staging' or is_test = true;
delete from emission_activity_classifications where env = 'staging' or is_test = true;
delete from emission_activities where env = 'staging' or is_test = true;
delete from extracted_document_drafts where env = 'staging' or is_test = true;
delete from uploaded_documents where env = 'staging' or is_test = true;
delete from emission_factors where env = 'staging' or is_test = true;
delete from projects where env = 'staging' or is_test = true;
delete from subscriptions where env = 'staging' or is_test = true;
delete from organization_members where env = 'staging' or is_test = true;
delete from organizations where env = 'staging' or is_test = true;
delete from audit_logs where env = 'staging' or is_test = true;

-- 2) Tenant root and membership.
insert into organizations (
  id,
  slug,
  legal_name,
  display_name,
  tax_id,
  country_code,
  timezone,
  status,
  env,
  is_test
)
values (
  'a1111111-1111-4111-8111-111111111111',
  'stg-canonical-org',
  'STG Canonical Org Co., Ltd.',
  '[STG] Canonical Org',
  '87654321',
  'TW',
  'Asia/Taipei',
  'active',
  'staging',
  true
);

insert into organization_members (
  id,
  organization_id,
  user_id,
  invited_email,
  role,
  status,
  invited_at,
  joined_at,
  env,
  is_test
)
values
(
  'a1120000-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  null,
  'owner',
  'active',
  now(),
  now(),
  'staging',
  true
),
(
  'a1130000-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  null,
  'staging-viewer@cacalab.local',
  'viewer',
  'invited',
  now(),
  null,
  'staging',
  true
);

insert into subscriptions (
  id,
  organization_id,
  plan_code,
  status,
  period_start,
  period_end,
  grace_until,
  readonly_from,
  features,
  metadata,
  env,
  is_test
)
values (
  'a2222222-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'pro_staging',
  'active',
  '2026-01-01T00:00:00Z',
  '2026-12-31T23:59:59Z',
  '2027-01-07T23:59:59Z',
  null,
  '{"carbon_report_enabled":true,"ai_audit_enabled":true,"export_enabled":true,"esg_report_enabled":false,"ifrs_s1s2_enabled":false,"product_cfp_enabled":false}'::jsonb,
  '{"seed_pack":"v2026.04.07"}'::jsonb,
  'staging',
  true
);

-- 3) Projects (1 primary + 1 boundary isolation project).
insert into projects (
  id,
  organization_id,
  project_code,
  name,
  description,
  reporting_start_date,
  reporting_end_date,
  boundary_type,
  status,
  env,
  is_test
)
values
(
  'a3333333-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'STG-PJT-CANON-001',
  '[STG] Canonical Carbon Inventory 2026',
  'Primary canonical project for cross-page closed beta flow.',
  '2026-01-01',
  '2026-12-31',
  'operational_control',
  'active',
  'staging',
  true
),
(
  'a3333333-2222-4222-8222-222222222222',
  'a1111111-1111-4111-8111-111111111111',
  'STG-PJT-CANON-002',
  '[STG] Boundary Isolation Project',
  'Secondary project for project switch isolation checks.',
  '2026-01-01',
  '2026-12-31',
  'operational_control',
  'active',
  'staging',
  true
);

-- 4) Document -> Draft chain.
insert into uploaded_documents (
  id,
  organization_id,
  project_id,
  uploaded_by_user_id,
  storage_bucket,
  storage_path,
  original_filename,
  mime_type,
  file_size_bytes,
  sha256_hash,
  document_type,
  ocr_status,
  status,
  metadata,
  received_date,
  env,
  is_test
)
values
(
  'a4444444-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  'staging-receipts',
  'staging/fixtures/TEST_20260407_electricity-bill-202603.png',
  'TEST_20260407_electricity-bill-202603.png',
  'image/png',
  223456,
  'fixturehash-electricity-202603-canonical',
  'utility_bill',
  'succeeded',
  'active',
  '{"source":"canonical_seed_pack","document_label":"electricity_bill"}'::jsonb,
  '2026-03-10',
  'staging',
  true
),
(
  'a4555555-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  'staging-attachments',
  'staging/fixtures/TEST_20260407_misc-receipt-202603.jpg',
  'TEST_20260407_misc-receipt-202603.jpg',
  'image/jpeg',
  128900,
  'fixturehash-misc-202603-canonical',
  'receipt',
  'succeeded',
  'active',
  '{"source":"canonical_seed_pack","document_label":"misc_receipt"}'::jsonb,
  '2026-03-12',
  'staging',
  true
);

insert into extracted_document_drafts (
  id,
  organization_id,
  project_id,
  uploaded_document_id,
  extraction_version,
  extraction_provider,
  raw_payload,
  normalized_payload,
  status,
  classification_status,
  confidence_score,
  suggested_activity_date,
  suggested_category,
  suggested_scope,
  parsed_quantity,
  parsed_unit,
  parsed_vendor,
  review_note,
  reviewed_by_user_id,
  reviewed_at,
  is_latest,
  env,
  is_test
)
values
(
  'a5555555-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  'a4444444-1111-4111-8111-111111111111',
  1,
  'mock-ocr',
  '{"vendor":"Taiwan Power","invoice_date":"2026-03-01","quantity":1200,"unit":"kWh"}'::jsonb,
  '{"vendor":"Taiwan Power","activity_date":"2026-03-01","quantity":1200,"unit":"kWh","normalized_quantity":1200,"normalized_unit":"kWh"}'::jsonb,
  'confirmed',
  'classified',
  0.93,
  '2026-03-01',
  'energy',
  2,
  1200,
  'kWh',
  'Taiwan Power',
  'Canonical seed: confirmed electricity bill',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  now(),
  true,
  'staging',
  true
),
(
  'a5666666-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  'a4555555-1111-4111-8111-111111111111',
  1,
  'mock-ocr',
  '{"vendor":"Unknown Vendor","invoice_date":"2026-03-05","quantity":1,"unit":"kg"}'::jsonb,
  '{"vendor":"Unknown Vendor","activity_date":"2026-03-05","quantity":1,"unit":"kg","normalized_quantity":1,"normalized_unit":"kg"}'::jsonb,
  'needs_clarification',
  'unclassified',
  0.42,
  '2026-03-05',
  null,
  null,
  1,
  'kg',
  'Unknown Vendor',
  'Canonical seed: pending manual review',
  null,
  null,
  true,
  'staging',
  true
);

-- 5) Activities and calculations.
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
  valid_to,
  env,
  is_test
)
values (
  'a6666666-1111-4111-8111-111111111111',
  null,
  'fixture-tw-grid-electricity',
  'Fixture Taiwan Grid Electricity',
  'MOENV',
  'FIXTURE-2026',
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
  null,
  'staging',
  true
);

insert into emission_activities (
  id,
  organization_id,
  project_id,
  source_document_id,
  source_draft_id,
  activity_code,
  activity_name,
  activity_date,
  category,
  subcategory,
  activity_type,
  quantity,
  unit,
  normalized_quantity,
  normalized_unit,
  data_quality,
  inclusion_status,
  exclusion_reason,
  review_note,
  suggested_scope,
  final_scope,
  confidence_score,
  status,
  created_by_user_id,
  env,
  is_test
)
values
(
  'a7777777-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  'a4444444-1111-4111-8111-111111111111',
  'a5555555-1111-4111-8111-111111111111',
  'STG-EA-000001',
  'Electricity Usage March',
  '2026-03-01',
  'energy',
  'purchased_electricity',
  'electricity',
  1200,
  'kWh',
  1200,
  'kWh',
  'measured',
  'included',
  null,
  'Canonical seed confirmed activity',
  2,
  2,
  0.93,
  'active',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  'staging',
  true
),
(
  'a7888888-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  'a4555555-1111-4111-8111-111111111111',
  null,
  'STG-EA-000002',
  'Unknown Receipt Pending Mapping',
  '2026-03-05',
  'unclassified',
  'manual_review',
  'other',
  1,
  'kg',
  1,
  'kg',
  'estimated',
  'pending',
  null,
  'Canonical seed pending factor mapping',
  null,
  null,
  0.42,
  'active',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  'staging',
  true
);

insert into calculation_results (
  id,
  organization_id,
  project_id,
  emission_activity_id,
  calc_version,
  status,
  is_latest,
  co2e_kg,
  co2_kg,
  ch4_kg,
  n2o_kg,
  factor_id,
  factor_snapshot,
  input_snapshot,
  formula_version,
  warnings,
  error_code,
  calculated_at,
  env,
  is_test
)
values
(
  'a8888888-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  'a7777777-1111-4111-8111-111111111111',
  1,
  'calculated',
  true,
  610.8,
  null,
  null,
  null,
  'a6666666-1111-4111-8111-111111111111',
  '{"factor_id":"a6666666-1111-4111-8111-111111111111","factor_key":"fixture-tw-grid-electricity","factor_name":"Fixture Taiwan Grid Electricity","source_name":"MOENV","version":1,"unit":"kWh","co2e_kg_per_unit":0.509,"quality_tier":"official"}'::jsonb,
  '{"quantity":1200,"unit":"kWh","normalized_quantity":1200,"normalized_unit":"kWh"}'::jsonb,
  'v1.0.0',
  '[]'::jsonb,
  null,
  '2026-03-20T00:00:00Z',
  'staging',
  true
),
(
  'a8999999-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  'a7888888-1111-4111-8111-111111111111',
  1,
  'pending_factor',
  true,
  null,
  null,
  null,
  null,
  null,
  '{}'::jsonb,
  '{"quantity":1,"unit":"kg","normalized_quantity":1,"normalized_unit":"kg"}'::jsonb,
  'v1.0.0',
  '[{"zh_tw":"找不到對應排放因子，已標記為 pending","en":"No matching emission factor found; marked as pending","ja":"適合する排出係数が見つからないため、pending として処理しました"}]'::jsonb,
  'FACTOR_NOT_FOUND',
  '2026-03-20T00:00:00Z',
  'staging',
  true
);

insert into adjustment_claim_rules (
  id,
  organization_id,
  rule_code,
  rule_name,
  jurisdiction_code,
  effective_year,
  claim_purpose,
  adjustment_type,
  max_deduction_ratio,
  inventory_impact_mode,
  certificate_verification_required,
  approval_required,
  requires_retirement,
  priority,
  is_active,
  metadata,
  env,
  is_test
)
values
(
  'b2000001-1111-4111-8111-111111111111',
  null,
  'stg_rule_tw_internal_offset_2026',
  'TW Internal Mgmt Offset 2026',
  'TW',
  2026,
  'internal_management',
  'offset_credit',
  1.000000,
  'claim_only',
  true,
  true,
  true,
  10,
  true,
  '{}'::jsonb,
  'staging',
  true
),
(
  'b2000002-1111-4111-8111-111111111111',
  null,
  'stg_rule_tw_internal_re_2026',
  'TW Internal Mgmt RE 2026',
  'TW',
  2026,
  'internal_management',
  'renewable_electricity_attribute',
  0.800000,
  'market_based_adjustment',
  true,
  true,
  true,
  10,
  true,
  '{}'::jsonb,
  'staging',
  true
),
(
  'b2000003-1111-4111-8111-111111111111',
  null,
  'stg_rule_tw_internal_removal_2026',
  'TW Internal Mgmt Removal 2026',
  'TW',
  2026,
  'internal_management',
  'carbon_removal',
  1.000000,
  'claim_only',
  true,
  true,
  true,
  10,
  true,
  '{}'::jsonb,
  'staging',
  true
),
(
  'b2000004-1111-4111-8111-111111111111',
  null,
  'stg_rule_tw_internal_storage_2026',
  'TW Internal Mgmt Storage 2026',
  'TW',
  2026,
  'internal_management',
  'carbon_storage',
  1.000000,
  'claim_only',
  true,
  true,
  true,
  10,
  true,
  '{}'::jsonb,
  'staging',
  true
),
(
  'b2000005-1111-4111-8111-111111111111',
  null,
  'stg_rule_tw_internal_regded_2026',
  'TW Internal Mgmt Regulatory Deduction 2026',
  'TW',
  2026,
  'internal_management',
  'regulatory_deduction',
  1.000000,
  'regulatory_deduction_note',
  true,
  true,
  false,
  10,
  true,
  '{}'::jsonb,
  'staging',
  true
);

-- 6) Adjustment layer.
insert into carbon_adjustment_items (
  id,
  organization_id,
  project_id,
  adjustment_type,
  name,
  description,
  claim_purpose,
  quantity_total_tco2e,
  quantity_available_tco2e,
  quantity_reserved_tco2e,
  quantity_consumed_tco2e,
  usage_lock_status,
  target_type,
  target_id,
  jurisdiction_code,
  vintage_year,
  effective_from,
  effective_to,
  certificate_verification_status,
  approval_status,
  double_counting_status,
  proof_document_status,
  status,
  metadata,
  env,
  is_test
)
values (
  'b1111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  null,
  'renewable_electricity_attribute',
  'STG RECs 2026 Batch A',
  'Canonical adjustment item for report adjustment summary and claim result.',
  'internal_management',
  20.00000000,
  12.00000000,
  2.00000000,
  6.00000000,
  'available',
  'organization',
  null,
  'TW',
  2026,
  '2026-01-01',
  '2026-12-31',
  'verified',
  'approved',
  'clear',
  'ready',
  'active',
  '{"source":"canonical_seed_pack"}'::jsonb,
  'staging',
  true
);

insert into adjustment_certificates (
  id,
  organization_id,
  project_id,
  carbon_adjustment_item_id,
  program,
  registry,
  certificate_number,
  serial_number,
  vintage_year,
  issue_date,
  retirement_date,
  retired_quantity_tco2e,
  retired_quantity_available_tco2e,
  quantity_reserved_tco2e,
  quantity_consumed_tco2e,
  usage_lock_status,
  verification_status,
  approval_status,
  double_counting_check_status,
  proof_attachment_bucket,
  proof_attachment_path,
  metadata,
  env,
  is_test
)
values (
  'b1222222-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  null,
  'b1111111-1111-4111-8111-111111111111',
  'I-REC',
  'I-REC Registry',
  'STG-REC-2026-0001',
  'STG-SERIAL-REC-0001',
  2026,
  '2026-02-01',
  '2026-03-01',
  20.00000000,
  12.00000000,
  2.00000000,
  6.00000000,
  'available',
  'verified',
  'approved',
  'clear',
  'staging-attachments',
  'staging/fixtures/TEST_20260407_adjustment_certificate.pdf',
  '{"source":"canonical_seed_pack"}'::jsonb,
  'staging',
  true
);

insert into adjustment_applications (
  id,
  organization_id,
  project_id,
  report_generation_id,
  adjustment_item_id,
  certificate_id,
  claim_purpose,
  requested_quantity_tco2e,
  eligible_quantity_tco2e,
  disallowed_quantity_tco2e,
  disallow_reasons,
  inventory_impact_mode,
  status,
  idempotency_key,
  payload_hash,
  submitted_by_user_id,
  approved_by_user_id,
  submitted_at,
  approved_at,
  applied_at,
  metadata,
  env,
  is_test
)
values (
  'b1333333-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  null,
  'b1111111-1111-4111-8111-111111111111',
  'b1222222-1111-4111-8111-111111111111',
  'internal_management',
  10.00000000,
  8.00000000,
  2.00000000,
  '["rule_max_deduction_ratio"]'::jsonb,
  'market_based_adjustment',
  'applied',
  'stg-canonical-adjustment-application-001',
  'stg-canonical-adjustment-hash-001',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  '2026-03-20T10:00:00Z',
  '2026-03-20T10:05:00Z',
  '2026-03-20T10:10:00Z',
  '{"source":"canonical_seed_pack"}'::jsonb,
  'staging',
  true
);

insert into adjustment_audit_logs (
  id,
  organization_id,
  project_id,
  actor_user_id,
  action,
  table_name,
  record_id,
  adjustment_item_id,
  certificate_id,
  application_id,
  status,
  metadata,
  env,
  is_test
)
values (
  'b1444444-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  'canonical_seed_adjustment_application',
  'adjustment_applications',
  'b1333333-1111-4111-8111-111111111111',
  'b1111111-1111-4111-8111-111111111111',
  'b1222222-1111-4111-8111-111111111111',
  'b1333333-1111-4111-8111-111111111111',
  'recorded',
  '{"source":"canonical_seed_pack"}'::jsonb,
  'staging',
  true
);

-- 7) Report and AI snapshots.
insert into report_generations (
  id,
  organization_id,
  project_id,
  generated_by_user_id,
  status,
  report_version,
  payload,
  payload_hash,
  reporting_period_start,
  reporting_period_end,
  included_activity_count,
  excluded_activity_count,
  pending_activity_count,
  scope_totals,
  category_totals,
  factor_sources,
  warning_count,
  based_on_calculated_at,
  gross_emissions_snapshot,
  adjustment_summary,
  claim_results,
  adjustment_manifest,
  claim_purpose,
  env,
  is_test
)
values (
  'a9000000-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  'completed',
  1,
  '{"project_metadata":{"project_id":"a3333333-1111-4111-8111-111111111111","organization_id":"a1111111-1111-4111-8111-111111111111","project_code":"STG-PJT-CANON-001","name":"[STG] Canonical Carbon Inventory 2026","status":"active"},"reporting_period":{"start_date":"2026-01-01","end_date":"2026-12-31"},"boundary_summary":{"boundary_type":"operational_control","included_count":1,"excluded_count":0,"pending_count":1},"included_activities_summary":[{"emission_activity_id":"a7777777-1111-4111-8111-111111111111","activity_code":"STG-EA-000001","activity_name":"Electricity Usage March","activity_date":"2026-03-01","category":"energy","subcategory":"purchased_electricity","final_scope":2,"co2e_kg":610.8}],"excluded_items_summary":[],"scope_totals":{"scope_1":0,"scope_2":610.8,"scope_3":0,"unknown":0},"category_totals":{"energy":610.8},"factor_sources_used":[{"factor_id":"a6666666-1111-4111-8111-111111111111","factor_key":"fixture-tw-grid-electricity","source_name":"MOENV","version":1}],"data_gaps_and_warnings":[{"zh_tw":"報告含有 pending 項目，請先補齊資料","en":"Report includes pending items; complete data before final use","ja":"レポートに pending 項目があります。正式利用前にデータを補完してください"}],"ai_summary_placeholder":{"zh_tw":"AI 健檢摘要待產生","en":"AI audit summary pending","ja":"AI 監査サマリーは未生成です"},"appendix_mappings":[{"emission_activity_id":"a7777777-1111-4111-8111-111111111111","source_draft_id":"a5555555-1111-4111-8111-111111111111","source_document_id":"a4444444-1111-4111-8111-111111111111","calculation_result_id":"a8888888-1111-4111-8111-111111111111"},{"emission_activity_id":"a7888888-1111-4111-8111-111111111111","source_draft_id":null,"source_document_id":"a4555555-1111-4111-8111-111111111111","calculation_result_id":"a8999999-1111-4111-8111-111111111111"}]}'::jsonb,
  'canonical-report-hash-v20260407',
  '2026-01-01',
  '2026-12-31',
  1,
  0,
  1,
  '{"scope_1":0,"scope_2":610.8,"scope_3":0,"unknown":0}'::jsonb,
  '{"energy":610.8}'::jsonb,
  '[{"factor_id":"a6666666-1111-4111-8111-111111111111","factor_key":"fixture-tw-grid-electricity","source_name":"MOENV","version":1}]'::jsonb,
  1,
  '2026-03-20T00:00:00Z',
  '{"gross_total_co2e_kg":610.8,"scope_totals":{"scope_1":0,"scope_2":610.8,"scope_3":0,"unknown":0},"category_totals":{"energy":610.8}}'::jsonb,
  '{"claim_purpose":"internal_management","application_count":1,"requested_total_tco2e":10,"eligible_total_tco2e":8,"disallowed_total_tco2e":2}'::jsonb,
  '{"claim_purpose":"internal_management","inventory_impact_mode":"market_based_adjustment","gross_co2e_kg":610.8,"eligible_deduction_tco2e":8,"eligible_deduction_kg":8000,"claim_net_co2e_kg":0}'::jsonb,
  '[{"adjustment_application_id":"b1333333-1111-4111-8111-111111111111","adjustment_item_id":"b1111111-1111-4111-8111-111111111111","certificate_id":"b1222222-1111-4111-8111-111111111111","claim_purpose":"internal_management","status":"applied","requested_quantity_tco2e":10,"eligible_quantity_tco2e":8,"disallowed_quantity_tco2e":2,"inventory_impact_mode":"market_based_adjustment"}]'::jsonb,
  'internal_management',
  'staging',
  true
);

update adjustment_applications
set report_generation_id = 'a9000000-1111-4111-8111-111111111111'
where id = 'b1333333-1111-4111-8111-111111111111';

insert into ai_audit_results (
  id,
  organization_id,
  project_id,
  report_generation_id,
  run_by_user_id,
  model_provider,
  model_name,
  model_version,
  status,
  input_snapshot,
  completeness_flags,
  anomaly_flags,
  exclusion_review_flags,
  hotspot_ranking,
  summary_text,
  recommended_actions,
  token_usage,
  confidence_score,
  env,
  is_test
)
values (
  'a9111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  'a9000000-1111-4111-8111-111111111111',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  'mock-llm',
  'mock-audit-v1',
  '2026.04',
  'completed',
  '{"source":"canonical_seed_pack"}'::jsonb,
  '[{"code":"pending_items_present","severity":"warning"}]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[{"category":"energy","co2e_kg":610.8}]'::jsonb,
  '{"zh_tw":"用電為主要熱點，建議優先補齊 pending 文件並確認憑證套用規則。","en":"Electricity is the hotspot. Complete pending documents and verify certificate claim rules.","ja":"電力使用が主要ホットスポットです。pending 書類の補完と証書適用ルールの確認を優先してください。"}'::jsonb,
  '[{"code":"complete_pending_documents"},{"code":"verify_adjustment_eligibility"}]'::jsonb,
  '{"prompt_tokens":900,"completion_tokens":240,"total_tokens":1140}'::jsonb,
  0.87,
  'staging',
  true
);

-- 8) Ensure analytics classifications are generated.
select upsert_emission_activity_classifications('a7777777-1111-4111-8111-111111111111'::uuid);
select upsert_emission_activity_classifications('a7888888-1111-4111-8111-111111111111'::uuid);

update seed_pack_reseed_runs
set
  status = 'completed',
  completed_at = now(),
  summary = jsonb_build_object(
    'organization_id', 'a1111111-1111-4111-8111-111111111111',
    'project_id', 'a3333333-1111-4111-8111-111111111111',
    'documents', 2,
    'drafts', 2,
    'activities', 2,
    'calculations', 2,
    'reports', 1,
    'adjustments', 1,
    'certificates', 1,
    'applications', 1
  )
where id = (
  select id
  from seed_pack_reseed_runs
  where scenario_code = 'stg_core_closed_beta'
    and seed_pack_version = 'v2026.04.07'
    and status = 'started'
  order by started_at desc
  limit 1
);

commit;
