-- CaCalLab Canonical Seed Pack v3 (Phase 1 boundary execution)
-- Scenario: stg_core_closed_beta
-- Seed pack version: v2026.04.07.v3
-- Usage:
--   npx supabase db query --linked -f supabase/seed/canonical_seed_pack_staging_v20260407_v3.sql

begin;

update seed_pack_registry
set
  seed_pack_version = 'v2026.04.07.v3',
  schema_version = '202605080001',
  title = 'Staging Core Closed Beta Canonical Pack (Boundary Phase 1 v3)',
  description = 'Showcase-grade canonical seed with Phase 1 legal entity, site, project binding, and report boundary snapshots.',
  metadata = jsonb_build_object(
    'organization_id', 'a1111111-1111-4111-8111-111111111111',
    'legal_entity_id', 'e1111111-1111-4111-8111-111111111111',
    'primary_site_id', 'e2111111-1111-4111-8111-111111111111',
    'secondary_site_id', 'e2222222-2222-4222-8222-222222222222',
    'primary_project_id', 'a3333333-1111-4111-8111-111111111111',
    'secondary_project_id', 'a3333333-2222-4222-8222-222222222222',
    'report_generation_ids', jsonb_build_array('d9000001-1111-4111-8111-111111111111', 'd9000002-1111-4111-8111-111111111111'),
    'activity_count', 12,
    'document_count', 14,
    'adjustment_item_count', 3
  ),
  updated_at = now()
where scenario_code = 'stg_core_closed_beta';

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
  'v2026.04.07.v3',
  'reseed',
  'started',
  'codex',
  jsonb_build_object('note', 'boundary phase 1 v3 reseed start')
);

-- Purge DB rows only (storage objects are cleaned via Storage API).
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
delete from sites where env = 'staging' or is_test = true;
delete from legal_entities where env = 'staging' or is_test = true;
delete from subscriptions where env = 'staging' or is_test = true;
delete from organization_members where env = 'staging' or is_test = true;
delete from organizations where env = 'staging' or is_test = true;
delete from audit_logs where env = 'staging' or is_test = true;

insert into organizations (
  id, slug, legal_name, display_name, tax_id, country_code, timezone, status, env, is_test
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
  id, organization_id, user_id, invited_email, role, status, invited_at, joined_at, env, is_test
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

insert into legal_entities (
  id, workspace_id, entity_code, registered_name, display_name, tax_id, country_code,
  registration_address, industry_code, status, metadata, env, is_test
)
values (
  'e1111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'STG-LE-001',
  'STG Canonical Manufacturing Co., Ltd.',
  '[STG] Canonical Manufacturing',
  '87654321',
  'TW',
  '1F, No. 100, Carbon Road, Taipei',
  'C24',
  'active',
  '{"source":"seed_pack_v3","reporting_subject":true}'::jsonb,
  'staging',
  true
);

insert into sites (
  id, workspace_id, legal_entity_id, site_code, site_name, facility_type, address,
  country_code, timezone, cbam_installation_ref, status, metadata, env, is_test
)
values
(
  'e2111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'e1111111-1111-4111-8111-111111111111',
  'STG-SITE-PRIMARY',
  '[STG] Taichung Main Plant',
  'manufacturing_plant',
  'No. 88, Industrial Road, Taichung',
  'TW',
  'Asia/Taipei',
  'CBAM-STG-TC-001',
  'active',
  '{"source":"seed_pack_v3","primary_project_site":true}'::jsonb,
  'staging',
  true
),
(
  'e2222222-2222-4222-8222-222222222222',
  'a1111111-1111-4111-8111-111111111111',
  'e1111111-1111-4111-8111-111111111111',
  'STG-SITE-SECONDARY',
  '[STG] Hsinchu Office Lab',
  'office_lab',
  'No. 12, Science Park Road, Hsinchu',
  'TW',
  'Asia/Taipei',
  'CBAM-STG-HC-002',
  'active',
  '{"source":"seed_pack_v3","isolation_project_site":true}'::jsonb,
  'staging',
  true
);

insert into subscriptions (
  id, organization_id, plan_code, status, period_start, period_end, grace_until, readonly_from, features, metadata, env, is_test
)
values (
  'a2222222-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'pro_staging_showcase',
  'active',
  '2026-01-01T00:00:00Z',
  '2026-12-31T23:59:59Z',
  '2027-01-07T23:59:59Z',
  null,
  '{"carbon_report_enabled":true,"ai_audit_enabled":true,"export_enabled":true,"analytics_hotspot_enabled":true,"analytics_trend_enabled":true}'::jsonb,
  '{"seed_pack":"v2026.04.07.v3"}'::jsonb,
  'staging',
  true
);

insert into projects (
  id, organization_id, legal_entity_id, site_id, project_code, name, description, reporting_start_date, reporting_end_date, boundary_type, status, env, is_test
)
values
(
  'a3333333-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'e1111111-1111-4111-8111-111111111111',
  'e2111111-1111-4111-8111-111111111111',
  'STG-PJT-SHOWCASE-001',
  '[STG] Showcase Inventory 2026',
  'Showcase-grade closed beta project with trend/hotspot and adjustment chains.',
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
  'e1111111-1111-4111-8111-111111111111',
  'e2222222-2222-4222-8222-222222222222',
  'STG-PJT-SHOWCASE-002',
  '[STG] Isolation Project',
  'Secondary project reserved for boundary isolation checks.',
  '2026-01-01',
  '2026-12-31',
  'operational_control',
  'active',
  'staging',
  true
);

insert into emission_factors (
  id, organization_id, factor_key, factor_name, source_name, source_reference, source_url, source_region, category, subcategory, activity_type, unit,
  co2e_kg_per_unit, version, quality_tier, status, valid_from, valid_to, env, is_test
)
values
(
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
),
(
  'a6666666-2222-4222-8222-222222222222',
  null,
  'fixture-diesel-combustion',
  'Fixture Diesel Combustion',
  'MOENV',
  'FIXTURE-DIESEL-2026',
  'https://www.moenv.gov.tw',
  'TW',
  'stationary_combustion',
  'diesel_fuel',
  'fuel',
  'L',
  2.6800000000,
  1,
  'official',
  'active',
  '2026-01-01',
  null,
  'staging',
  true
);

insert into uploaded_documents (
  id, organization_id, project_id, uploaded_by_user_id, storage_bucket, storage_path, original_filename, mime_type, file_size_bytes, sha256_hash,
  document_type, ocr_status, status, metadata, received_date, env, is_test
)
values
('d4440001-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-receipts','staging/showcase/TEST_20260115_electricity_bill_jan.png','TEST_20260115_electricity_bill_jan.png','image/png',203001,'showcase-hash-doc-0001','utility_bill','succeeded','active','{"source":"seed_pack_v3","month":"2026-01","stream":"electricity"}'::jsonb,'2026-01-15','staging',true),
('d4440002-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-receipts','staging/showcase/TEST_20260118_diesel_receipt_jan.jpg','TEST_20260118_diesel_receipt_jan.jpg','image/jpeg',173002,'showcase-hash-doc-0002','fuel_receipt','succeeded','active','{"source":"seed_pack_v3","month":"2026-01","stream":"diesel"}'::jsonb,'2026-01-18','staging',true),
('d4440003-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-receipts','staging/showcase/TEST_20260214_electricity_bill_feb.png','TEST_20260214_electricity_bill_feb.png','image/png',203003,'showcase-hash-doc-0003','utility_bill','succeeded','active','{"source":"seed_pack_v3","month":"2026-02","stream":"electricity"}'::jsonb,'2026-02-14','staging',true),
('d4440004-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-receipts','staging/showcase/TEST_20260217_diesel_receipt_feb.jpg','TEST_20260217_diesel_receipt_feb.jpg','image/jpeg',173004,'showcase-hash-doc-0004','fuel_receipt','succeeded','active','{"source":"seed_pack_v3","month":"2026-02","stream":"diesel"}'::jsonb,'2026-02-17','staging',true),
('d4440005-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-receipts','staging/showcase/TEST_20260315_electricity_bill_mar.png','TEST_20260315_electricity_bill_mar.png','image/png',203005,'showcase-hash-doc-0005','utility_bill','succeeded','active','{"source":"seed_pack_v3","month":"2026-03","stream":"electricity"}'::jsonb,'2026-03-15','staging',true),
('d4440006-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-receipts','staging/showcase/TEST_20260318_diesel_receipt_mar.jpg','TEST_20260318_diesel_receipt_mar.jpg','image/jpeg',173006,'showcase-hash-doc-0006','fuel_receipt','succeeded','active','{"source":"seed_pack_v3","month":"2026-03","stream":"diesel"}'::jsonb,'2026-03-18','staging',true),
('d4440007-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-receipts','staging/showcase/TEST_20260414_electricity_bill_apr.png','TEST_20260414_electricity_bill_apr.png','image/png',203007,'showcase-hash-doc-0007','utility_bill','succeeded','active','{"source":"seed_pack_v3","month":"2026-04","stream":"electricity"}'::jsonb,'2026-04-14','staging',true),
('d4440008-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-receipts','staging/showcase/TEST_20260417_diesel_receipt_apr.jpg','TEST_20260417_diesel_receipt_apr.jpg','image/jpeg',173008,'showcase-hash-doc-0008','fuel_receipt','succeeded','active','{"source":"seed_pack_v3","month":"2026-04","stream":"diesel"}'::jsonb,'2026-04-17','staging',true),
('d4440009-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-receipts','staging/showcase/TEST_20260515_electricity_bill_may.png','TEST_20260515_electricity_bill_may.png','image/png',203009,'showcase-hash-doc-0009','utility_bill','succeeded','active','{"source":"seed_pack_v3","month":"2026-05","stream":"electricity"}'::jsonb,'2026-05-15','staging',true),
('d4440010-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-receipts','staging/showcase/TEST_20260518_diesel_receipt_may.jpg','TEST_20260518_diesel_receipt_may.jpg','image/jpeg',173010,'showcase-hash-doc-0010','fuel_receipt','succeeded','active','{"source":"seed_pack_v3","month":"2026-05","stream":"diesel"}'::jsonb,'2026-05-18','staging',true),
('d4440011-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-receipts','staging/showcase/TEST_20260615_electricity_bill_jun.png','TEST_20260615_electricity_bill_jun.png','image/png',203011,'showcase-hash-doc-0011','utility_bill','succeeded','active','{"source":"seed_pack_v3","month":"2026-06","stream":"electricity"}'::jsonb,'2026-06-15','staging',true),
('d4440012-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-receipts','staging/showcase/TEST_20260618_diesel_receipt_jun.jpg','TEST_20260618_diesel_receipt_jun.jpg','image/jpeg',173012,'showcase-hash-doc-0012','fuel_receipt','succeeded','active','{"source":"seed_pack_v3","month":"2026-06","stream":"diesel"}'::jsonb,'2026-06-18','staging',true),
('d4440013-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-attachments','staging/showcase/TEST_20260620_business_travel_receipt.pdf','TEST_20260620_business_travel_receipt.pdf','application/pdf',145321,'showcase-hash-doc-0013','travel_receipt','succeeded','active','{"source":"seed_pack_v3","month":"2026-06","stream":"travel_pending"}'::jsonb,'2026-06-20','staging',true),
('d4440014-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging-attachments','staging/showcase/TEST_20260621_waste_manifest.pdf','TEST_20260621_waste_manifest.pdf','application/pdf',164322,'showcase-hash-doc-0014','waste_manifest','pending','active','{"source":"seed_pack_v3","month":"2026-06","stream":"waste_pending"}'::jsonb,'2026-06-21','staging',true);

insert into extracted_document_drafts (
  id, organization_id, project_id, uploaded_document_id, extraction_version, extraction_provider, raw_payload, normalized_payload,
  status, classification_status, confidence_score, suggested_activity_date, suggested_category, suggested_scope, parsed_quantity, parsed_unit, parsed_vendor,
  review_note, reviewed_by_user_id, reviewed_at, is_latest, env, is_test
)
values
('d5550001-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440001-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Taiwan Power","invoice_date":"2026-01-15","quantity":1022,"unit":"kWh"}'::jsonb,'{"vendor":"Taiwan Power","activity_date":"2026-01-15","normalized_quantity":1022,"normalized_unit":"kWh"}'::jsonb,'confirmed','classified',0.95,'2026-01-15','energy',2,1022,'kWh','Taiwan Power','auto-confirmed for showcase','27141206-6e54-40d0-8b9d-7dc60832bdd7',now(),true,'staging',true),
('d5550002-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440002-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Fuel Co","invoice_date":"2026-01-18","quantity":119.4,"unit":"L"}'::jsonb,'{"vendor":"Fuel Co","activity_date":"2026-01-18","normalized_quantity":119.4,"normalized_unit":"L"}'::jsonb,'confirmed','classified',0.92,'2026-01-18','stationary_combustion',1,119.4,'L','Fuel Co','auto-confirmed for showcase','27141206-6e54-40d0-8b9d-7dc60832bdd7',now(),true,'staging',true),
('d5550003-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440003-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Taiwan Power","invoice_date":"2026-02-14","quantity":1002,"unit":"kWh"}'::jsonb,'{"vendor":"Taiwan Power","activity_date":"2026-02-14","normalized_quantity":1002,"normalized_unit":"kWh"}'::jsonb,'confirmed','classified',0.95,'2026-02-14','energy',2,1002,'kWh','Taiwan Power','auto-confirmed for showcase','27141206-6e54-40d0-8b9d-7dc60832bdd7',now(),true,'staging',true),
('d5550004-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440004-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Fuel Co","invoice_date":"2026-02-17","quantity":113.8,"unit":"L"}'::jsonb,'{"vendor":"Fuel Co","activity_date":"2026-02-17","normalized_quantity":113.8,"normalized_unit":"L"}'::jsonb,'confirmed','classified',0.92,'2026-02-17','stationary_combustion',1,113.8,'L','Fuel Co','auto-confirmed for showcase','27141206-6e54-40d0-8b9d-7dc60832bdd7',now(),true,'staging',true),
('d5550005-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440005-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Taiwan Power","invoice_date":"2026-03-15","quantity":992,"unit":"kWh"}'::jsonb,'{"vendor":"Taiwan Power","activity_date":"2026-03-15","normalized_quantity":992,"normalized_unit":"kWh"}'::jsonb,'confirmed','classified',0.95,'2026-03-15','energy',2,992,'kWh','Taiwan Power','auto-confirmed for showcase','27141206-6e54-40d0-8b9d-7dc60832bdd7',now(),true,'staging',true),
('d5550006-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440006-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Fuel Co","invoice_date":"2026-03-18","quantity":108.2,"unit":"L"}'::jsonb,'{"vendor":"Fuel Co","activity_date":"2026-03-18","normalized_quantity":108.2,"normalized_unit":"L"}'::jsonb,'confirmed','classified',0.92,'2026-03-18','stationary_combustion',1,108.2,'L','Fuel Co','auto-confirmed for showcase','27141206-6e54-40d0-8b9d-7dc60832bdd7',now(),true,'staging',true),
('d5550007-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440007-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Taiwan Power","invoice_date":"2026-04-14","quantity":978,"unit":"kWh"}'::jsonb,'{"vendor":"Taiwan Power","activity_date":"2026-04-14","normalized_quantity":978,"normalized_unit":"kWh"}'::jsonb,'confirmed','classified',0.95,'2026-04-14','energy',2,978,'kWh','Taiwan Power','auto-confirmed for showcase','27141206-6e54-40d0-8b9d-7dc60832bdd7',now(),true,'staging',true),
('d5550008-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440008-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Fuel Co","invoice_date":"2026-04-17","quantity":104.5,"unit":"L"}'::jsonb,'{"vendor":"Fuel Co","activity_date":"2026-04-17","normalized_quantity":104.5,"normalized_unit":"L"}'::jsonb,'confirmed','classified',0.92,'2026-04-17','stationary_combustion',1,104.5,'L','Fuel Co','auto-confirmed for showcase','27141206-6e54-40d0-8b9d-7dc60832bdd7',now(),true,'staging',true),
('d5550009-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440009-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Taiwan Power","invoice_date":"2026-05-15","quantity":963,"unit":"kWh"}'::jsonb,'{"vendor":"Taiwan Power","activity_date":"2026-05-15","normalized_quantity":963,"normalized_unit":"kWh"}'::jsonb,'confirmed','classified',0.95,'2026-05-15','energy',2,963,'kWh','Taiwan Power','auto-confirmed for showcase','27141206-6e54-40d0-8b9d-7dc60832bdd7',now(),true,'staging',true),
('d5550010-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440010-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Fuel Co","invoice_date":"2026-05-18","quantity":100.7,"unit":"L"}'::jsonb,'{"vendor":"Fuel Co","activity_date":"2026-05-18","normalized_quantity":100.7,"normalized_unit":"L"}'::jsonb,'confirmed','classified',0.92,'2026-05-18','stationary_combustion',1,100.7,'L','Fuel Co','auto-confirmed for showcase','27141206-6e54-40d0-8b9d-7dc60832bdd7',now(),true,'staging',true),
('d5550011-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440011-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Taiwan Power","invoice_date":"2026-06-15","quantity":953,"unit":"kWh"}'::jsonb,'{"vendor":"Taiwan Power","activity_date":"2026-06-15","normalized_quantity":953,"normalized_unit":"kWh"}'::jsonb,'confirmed','classified',0.95,'2026-06-15','energy',2,953,'kWh','Taiwan Power','auto-confirmed for showcase','27141206-6e54-40d0-8b9d-7dc60832bdd7',now(),true,'staging',true),
('d5550012-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440012-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Fuel Co","invoice_date":"2026-06-18","quantity":95.2,"unit":"L"}'::jsonb,'{"vendor":"Fuel Co","activity_date":"2026-06-18","normalized_quantity":95.2,"normalized_unit":"L"}'::jsonb,'confirmed','classified',0.91,'2026-06-18','stationary_combustion',1,95.2,'L','Fuel Co','confirmed but pending factor','27141206-6e54-40d0-8b9d-7dc60832bdd7',now(),true,'staging',true),
('d5550013-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440013-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Travel Co","invoice_date":"2026-06-20","quantity":1,"unit":"trip"}'::jsonb,'{"vendor":"Travel Co","activity_date":"2026-06-20","normalized_quantity":1,"normalized_unit":"trip"}'::jsonb,'pending_review','unclassified',0.44,'2026-06-20',null,null,1,'trip','Travel Co','awaiting manual classification',null,null,true,'staging',true),
('d5550014-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440014-1111-4111-8111-111111111111',1,'mock-ocr','{"vendor":"Waste Service","invoice_date":"2026-06-21","quantity":2,"unit":"ton"}'::jsonb,'{"vendor":"Waste Service","activity_date":"2026-06-21","normalized_quantity":2,"normalized_unit":"ton"}'::jsonb,'needs_clarification','unclassified',0.41,'2026-06-21',null,null,2,'ton','Waste Service','needs clarification for boundary',null,null,true,'staging',true);

insert into emission_activities (
  id, organization_id, project_id, source_document_id, source_draft_id, activity_code, activity_name, activity_date, category, subcategory, activity_type,
  quantity, unit, normalized_quantity, normalized_unit, data_quality, inclusion_status, exclusion_reason, review_note, suggested_scope, final_scope, confidence_score,
  status, created_by_user_id, env, is_test
)
values
('d7770001-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440001-1111-4111-8111-111111111111','d5550001-1111-4111-8111-111111111111','STG-EA-100001','Electricity Usage Jan','2026-01-15','energy','purchased_electricity','electricity',1022,'kWh',1022,'kWh','measured','included',null,'showcase jan electricity',2,2,0.95,'active','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging',true),
('d7770002-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440002-1111-4111-8111-111111111111','d5550002-1111-4111-8111-111111111111','STG-EA-100002','Diesel Combustion Jan','2026-01-18','stationary_combustion','diesel_fuel','fuel',119.4,'L',119.4,'L','measured','included',null,'showcase jan diesel',1,1,0.92,'active','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging',true),
('d7770003-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440003-1111-4111-8111-111111111111','d5550003-1111-4111-8111-111111111111','STG-EA-100003','Electricity Usage Feb','2026-02-14','energy','purchased_electricity','electricity',1002,'kWh',1002,'kWh','measured','included',null,'showcase feb electricity',2,2,0.95,'active','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging',true),
('d7770004-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440004-1111-4111-8111-111111111111','d5550004-1111-4111-8111-111111111111','STG-EA-100004','Diesel Combustion Feb','2026-02-17','stationary_combustion','diesel_fuel','fuel',113.8,'L',113.8,'L','measured','included',null,'showcase feb diesel',1,1,0.92,'active','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging',true),
('d7770005-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440005-1111-4111-8111-111111111111','d5550005-1111-4111-8111-111111111111','STG-EA-100005','Electricity Usage Mar','2026-03-15','energy','purchased_electricity','electricity',992,'kWh',992,'kWh','measured','included',null,'showcase mar electricity',2,2,0.95,'active','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging',true),
('d7770006-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440006-1111-4111-8111-111111111111','d5550006-1111-4111-8111-111111111111','STG-EA-100006','Diesel Combustion Mar','2026-03-18','stationary_combustion','diesel_fuel','fuel',108.2,'L',108.2,'L','measured','included',null,'showcase mar diesel',1,1,0.92,'active','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging',true),
('d7770007-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440007-1111-4111-8111-111111111111','d5550007-1111-4111-8111-111111111111','STG-EA-100007','Electricity Usage Apr','2026-04-14','energy','purchased_electricity','electricity',978,'kWh',978,'kWh','measured','included',null,'showcase apr electricity',2,2,0.95,'active','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging',true),
('d7770008-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440008-1111-4111-8111-111111111111','d5550008-1111-4111-8111-111111111111','STG-EA-100008','Diesel Combustion Apr','2026-04-17','stationary_combustion','diesel_fuel','fuel',104.5,'L',104.5,'L','measured','included',null,'showcase apr diesel',1,1,0.92,'active','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging',true),
('d7770009-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440009-1111-4111-8111-111111111111','d5550009-1111-4111-8111-111111111111','STG-EA-100009','Electricity Usage May','2026-05-15','energy','purchased_electricity','electricity',963,'kWh',963,'kWh','measured','included',null,'showcase may electricity',2,2,0.95,'active','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging',true),
('d7770010-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440010-1111-4111-8111-111111111111','d5550010-1111-4111-8111-111111111111','STG-EA-100010','Diesel Combustion May','2026-05-18','stationary_combustion','diesel_fuel','fuel',100.7,'L',100.7,'L','measured','included',null,'showcase may diesel',1,1,0.92,'active','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging',true),
('d7770011-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440011-1111-4111-8111-111111111111','d5550011-1111-4111-8111-111111111111','STG-EA-100011','Electricity Usage Jun','2026-06-15','energy','purchased_electricity','electricity',953,'kWh',953,'kWh','measured','included',null,'showcase jun electricity',2,2,0.95,'active','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging',true),
('d7770012-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d4440012-1111-4111-8111-111111111111','d5550012-1111-4111-8111-111111111111','STG-EA-100012','Diesel Combustion Jun Pending','2026-06-18','stationary_combustion','diesel_fuel','fuel',95.2,'L',95.2,'L','estimated','pending',null,'pending factor verification for june diesel',1,1,0.91,'active','27141206-6e54-40d0-8b9d-7dc60832bdd7','staging',true);

insert into calculation_results (
  id, organization_id, project_id, emission_activity_id, calc_version, status, is_latest, co2e_kg, co2_kg, ch4_kg, n2o_kg, factor_id,
  factor_snapshot, input_snapshot, formula_version, warnings, error_code, calculated_at, env, is_test
)
values
('d8880001-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d7770001-1111-4111-8111-111111111111',1,'calculated',true,520,null,null,null,'a6666666-1111-4111-8111-111111111111','{"factor_id":"a6666666-1111-4111-8111-111111111111","factor_key":"fixture-tw-grid-electricity","source_name":"MOENV","version":1}'::jsonb,'{"quantity":1022,"unit":"kWh"}'::jsonb,'v1.0.0','[]'::jsonb,null,'2026-01-15T12:00:00Z','staging',true),
('d8880002-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d7770002-1111-4111-8111-111111111111',1,'calculated',true,320,null,null,null,'a6666666-2222-4222-8222-222222222222','{"factor_id":"a6666666-2222-4222-8222-222222222222","factor_key":"fixture-diesel-combustion","source_name":"MOENV","version":1}'::jsonb,'{"quantity":119.4,"unit":"L"}'::jsonb,'v1.0.0','[]'::jsonb,null,'2026-01-18T12:00:00Z','staging',true),
('d8880003-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d7770003-1111-4111-8111-111111111111',1,'calculated',true,510,null,null,null,'a6666666-1111-4111-8111-111111111111','{"factor_id":"a6666666-1111-4111-8111-111111111111","factor_key":"fixture-tw-grid-electricity","source_name":"MOENV","version":1}'::jsonb,'{"quantity":1002,"unit":"kWh"}'::jsonb,'v1.0.0','[]'::jsonb,null,'2026-02-14T12:00:00Z','staging',true),
('d8880004-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d7770004-1111-4111-8111-111111111111',1,'calculated',true,305,null,null,null,'a6666666-2222-4222-8222-222222222222','{"factor_id":"a6666666-2222-4222-8222-222222222222","factor_key":"fixture-diesel-combustion","source_name":"MOENV","version":1}'::jsonb,'{"quantity":113.8,"unit":"L"}'::jsonb,'v1.0.0','[]'::jsonb,null,'2026-02-17T12:00:00Z','staging',true),
('d8880005-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d7770005-1111-4111-8111-111111111111',1,'calculated',true,505,null,null,null,'a6666666-1111-4111-8111-111111111111','{"factor_id":"a6666666-1111-4111-8111-111111111111","factor_key":"fixture-tw-grid-electricity","source_name":"MOENV","version":1}'::jsonb,'{"quantity":992,"unit":"kWh"}'::jsonb,'v1.0.0','[]'::jsonb,null,'2026-03-15T12:00:00Z','staging',true),
('d8880006-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d7770006-1111-4111-8111-111111111111',1,'calculated',true,290,null,null,null,'a6666666-2222-4222-8222-222222222222','{"factor_id":"a6666666-2222-4222-8222-222222222222","factor_key":"fixture-diesel-combustion","source_name":"MOENV","version":1}'::jsonb,'{"quantity":108.2,"unit":"L"}'::jsonb,'v1.0.0','[]'::jsonb,null,'2026-03-18T12:00:00Z','staging',true),
('d8880007-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d7770007-1111-4111-8111-111111111111',1,'calculated',true,498,null,null,null,'a6666666-1111-4111-8111-111111111111','{"factor_id":"a6666666-1111-4111-8111-111111111111","factor_key":"fixture-tw-grid-electricity","source_name":"MOENV","version":1}'::jsonb,'{"quantity":978,"unit":"kWh"}'::jsonb,'v1.0.0','[]'::jsonb,null,'2026-04-14T12:00:00Z','staging',true),
('d8880008-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d7770008-1111-4111-8111-111111111111',1,'calculated',true,280,null,null,null,'a6666666-2222-4222-8222-222222222222','{"factor_id":"a6666666-2222-4222-8222-222222222222","factor_key":"fixture-diesel-combustion","source_name":"MOENV","version":1}'::jsonb,'{"quantity":104.5,"unit":"L"}'::jsonb,'v1.0.0','[]'::jsonb,null,'2026-04-17T12:00:00Z','staging',true),
('d8880009-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d7770009-1111-4111-8111-111111111111',1,'calculated',true,490,null,null,null,'a6666666-1111-4111-8111-111111111111','{"factor_id":"a6666666-1111-4111-8111-111111111111","factor_key":"fixture-tw-grid-electricity","source_name":"MOENV","version":1}'::jsonb,'{"quantity":963,"unit":"kWh"}'::jsonb,'v1.0.0','[]'::jsonb,null,'2026-05-15T12:00:00Z','staging',true),
('d8880010-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d7770010-1111-4111-8111-111111111111',1,'calculated',true,270,null,null,null,'a6666666-2222-4222-8222-222222222222','{"factor_id":"a6666666-2222-4222-8222-222222222222","factor_key":"fixture-diesel-combustion","source_name":"MOENV","version":1}'::jsonb,'{"quantity":100.7,"unit":"L"}'::jsonb,'v1.0.0','[]'::jsonb,null,'2026-05-18T12:00:00Z','staging',true),
('d8880011-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d7770011-1111-4111-8111-111111111111',1,'calculated',true,485,null,null,null,'a6666666-1111-4111-8111-111111111111','{"factor_id":"a6666666-1111-4111-8111-111111111111","factor_key":"fixture-tw-grid-electricity","source_name":"MOENV","version":1}'::jsonb,'{"quantity":953,"unit":"kWh"}'::jsonb,'v1.0.0','[]'::jsonb,null,'2026-06-15T12:00:00Z','staging',true),
('d8880012-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d7770012-1111-4111-8111-111111111111',1,'pending_factor',true,null,null,null,null,null,'{}'::jsonb,'{"quantity":95.2,"unit":"L"}'::jsonb,'v1.0.0','[{"zh_tw":"六月柴油憑證待補，暫列 pending","en":"June diesel evidence pending; marked as pending","ja":"6月ディーゼル証憑が未補完のため pending"}]'::jsonb,'FACTOR_PENDING_VERIFICATION','2026-06-18T12:00:00Z','staging',true);

insert into adjustment_claim_rules (
  id, organization_id, rule_code, rule_name, jurisdiction_code, effective_year, claim_purpose, adjustment_type, max_deduction_ratio,
  inventory_impact_mode, certificate_verification_required, approval_required, requires_retirement, priority, is_active, metadata, env, is_test
)
values
('c2000001-1111-4111-8111-111111111111',null,'stg_rule_tw_internal_re_2026','TW Internal Mgmt RE 2026','TW',2026,'internal_management','renewable_electricity_attribute',0.800000,'market_based_adjustment',true,true,true,10,true,'{}'::jsonb,'staging',true),
('c2000002-1111-4111-8111-111111111111',null,'stg_rule_tw_voluntary_offset_2026','TW Voluntary Offset 2026','TW',2026,'voluntary_claim','offset_credit',1.000000,'claim_only',true,true,true,10,true,'{}'::jsonb,'staging',true),
('c2000003-1111-4111-8111-111111111111',null,'stg_rule_tw_ifrs_removal_2026','TW IFRS Removal 2026','TW',2026,'ifrs_s2_note','carbon_removal',1.000000,'claim_only',true,true,true,10,true,'{}'::jsonb,'staging',true);

insert into carbon_adjustment_items (
  id, organization_id, project_id, adjustment_type, name, description, claim_purpose, quantity_total_tco2e, quantity_available_tco2e,
  quantity_reserved_tco2e, quantity_consumed_tco2e, usage_lock_status, target_type, target_id, jurisdiction_code, vintage_year,
  effective_from, effective_to, certificate_verification_status, approval_status, double_counting_status, proof_document_status, status,
  metadata, env, is_test
)
values
('c1110001-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111',null,'renewable_electricity_attribute','STG REC Portfolio 2026','Market-based REC portfolio for internal management claims.','internal_management',25.0,22.0,1.0,2.0,'available','organization',null,'TW',2026,'2026-01-01','2026-12-31','verified','approved','clear','ready','active','{"source":"seed_pack_v3"}'::jsonb,'staging',true),
('c1110002-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','offset_credit','STG Offset Credits Batch A','Voluntary offset credits for marketing claim scenario.','voluntary_claim',12.0,10.0,1.0,1.0,'available','project','a3333333-1111-4111-8111-111111111111','TW',2025,'2026-01-01','2026-12-31','verified','approved','clear','ready','active','{"source":"seed_pack_v3"}'::jsonb,'staging',true),
('c1110003-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','carbon_removal','STG Removal Pilot','Pilot removal certificates pending verification for IFRS notes.','ifrs_s2_note',8.0,8.0,0.0,0.0,'available','project','a3333333-1111-4111-8111-111111111111','TW',2026,'2026-01-01','2026-12-31','pending','pending','unchecked','missing','active','{"source":"seed_pack_v3"}'::jsonb,'staging',true);

insert into adjustment_certificates (
  id, organization_id, project_id, carbon_adjustment_item_id, program, registry, certificate_number, serial_number, vintage_year,
  issue_date, retirement_date, retired_quantity_tco2e, retired_quantity_available_tco2e, quantity_reserved_tco2e, quantity_consumed_tco2e,
  usage_lock_status, verification_status, approval_status, double_counting_check_status, proof_attachment_bucket, proof_attachment_path,
  metadata, env, is_test
)
values
('c1220001-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111',null,'c1110001-1111-4111-8111-111111111111','I-REC','I-REC Registry','STG-REC-2026-1001','STG-REC-SERIAL-1001',2026,'2026-02-01','2026-03-01',25.0,22.0,1.0,2.0,'available','verified','approved','clear','staging-attachments','staging/showcase/TEST_20260407_rec_cert_1001.pdf','{"source":"seed_pack_v3"}'::jsonb,'staging',true),
('c1220002-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','c1110002-1111-4111-8111-111111111111','VERRA','Verra Registry','STG-OFF-2026-2001','STG-OFF-SERIAL-2001',2025,'2026-01-20','2026-02-05',12.0,10.0,1.0,1.0,'available','verified','approved','clear','staging-attachments','staging/showcase/TEST_20260407_offset_cert_2001.pdf','{"source":"seed_pack_v3"}'::jsonb,'staging',true),
('c1220003-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','c1110003-1111-4111-8111-111111111111','Puro','Puro Registry','STG-REM-2026-3001','STG-REM-SERIAL-3001',2026,'2026-03-01',null,8.0,8.0,0.0,0.0,'available','pending','pending','unchecked','staging-attachments','staging/showcase/TEST_20260407_removal_cert_3001.pdf','{"source":"seed_pack_v3"}'::jsonb,'staging',true);

insert into report_generations (
  id, organization_id, project_id, generated_by_user_id, status, report_version, payload, payload_hash,
  reporting_period_start, reporting_period_end, included_activity_count, excluded_activity_count, pending_activity_count,
  scope_totals, category_totals, factor_sources, warning_count, based_on_calculated_at,
  gross_emissions_snapshot, adjustment_summary, claim_results, adjustment_manifest,
  legal_entity_snapshot, site_snapshot, boundary_snapshot, claim_purpose, env, is_test
)
values
(
  'd9000001-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  'completed',
  1,
  jsonb_build_object(
    'project_metadata', jsonb_build_object(
      'project_id','a3333333-1111-4111-8111-111111111111',
      'organization_id','a1111111-1111-4111-8111-111111111111',
      'workspace_id','a1111111-1111-4111-8111-111111111111',
      'legal_entity_id','e1111111-1111-4111-8111-111111111111',
      'site_id','e2111111-1111-4111-8111-111111111111',
      'project_code','STG-PJT-SHOWCASE-001',
      'name','[STG] Showcase Inventory 2026'
    ),
    'reporting_period', jsonb_build_object('start_date','2026-01-01','end_date','2026-03-31'),
    'boundary_summary', jsonb_build_object('boundary_type','operational_control','included_count',6,'excluded_count',0,'pending_count',0),
    'workspace_snapshot', jsonb_build_object('workspace_id','a1111111-1111-4111-8111-111111111111','workspace_label','[STG] Canonical Org','slug','stg-canonical-org'),
    'legal_entity_snapshot', jsonb_build_object('legal_entity_id','e1111111-1111-4111-8111-111111111111','legal_entity_label','[STG] Canonical Manufacturing','entity_code','STG-LE-001','registered_name','STG Canonical Manufacturing Co., Ltd.','tax_id','87654321','country_code','TW'),
    'site_snapshot', jsonb_build_object('site_id','e2111111-1111-4111-8111-111111111111','site_label','[STG] Taichung Main Plant','site_code','STG-SITE-PRIMARY','facility_type','manufacturing_plant','country_code','TW','cbam_installation_ref','CBAM-STG-TC-001'),
    'boundary_snapshot', jsonb_build_object('workspace_id','a1111111-1111-4111-8111-111111111111','workspace_label','[STG] Canonical Org','legal_entity_id','e1111111-1111-4111-8111-111111111111','legal_entity_label','[STG] Canonical Manufacturing','site_id','e2111111-1111-4111-8111-111111111111','site_label','[STG] Taichung Main Plant','boundary_type','operational_control','reporting_period',jsonb_build_object('start_date','2026-01-01','end_date','2026-03-31')),
    'scope_totals', jsonb_build_object('scope_1',915,'scope_2',1535,'scope_3',0,'unknown',0),
    'category_totals', jsonb_build_object('energy',1535,'stationary_combustion',915),
    'data_gaps_and_warnings', jsonb_build_array(),
    'appendix_mappings', jsonb_build_array()
  ),
  'showcase-v3-report-hash-v1',
  '2026-01-01',
  '2026-03-31',
  6,
  0,
  0,
  '{"scope_1":915,"scope_2":1535,"scope_3":0,"unknown":0}'::jsonb,
  '{"energy":1535,"stationary_combustion":915}'::jsonb,
  '[{"factor_id":"a6666666-1111-4111-8111-111111111111","factor_key":"fixture-tw-grid-electricity","source_name":"MOENV","version":1},{"factor_id":"a6666666-2222-4222-8222-222222222222","factor_key":"fixture-diesel-combustion","source_name":"MOENV","version":1}]'::jsonb,
  0,
  '2026-03-31T23:59:00Z',
  '{"gross_total_co2e_kg":2450,"scope_totals":{"scope_1":915,"scope_2":1535,"scope_3":0,"unknown":0},"category_totals":{"energy":1535,"stationary_combustion":915}}'::jsonb,
  '{"claim_purpose":"internal_management","application_count":0,"requested_total_tco2e":0,"eligible_total_tco2e":0,"disallowed_total_tco2e":0}'::jsonb,
  '{"claim_purpose":"internal_management","inventory_impact_mode":"claim_only","gross_co2e_kg":2450,"eligible_deduction_tco2e":0,"eligible_deduction_kg":0,"claim_net_co2e_kg":2450}'::jsonb,
  '[]'::jsonb,
  '{"legal_entity_id":"e1111111-1111-4111-8111-111111111111","legal_entity_label":"[STG] Canonical Manufacturing","entity_code":"STG-LE-001","registered_name":"STG Canonical Manufacturing Co., Ltd.","tax_id":"87654321","country_code":"TW"}'::jsonb,
  '{"site_id":"e2111111-1111-4111-8111-111111111111","site_label":"[STG] Taichung Main Plant","site_code":"STG-SITE-PRIMARY","facility_type":"manufacturing_plant","country_code":"TW","cbam_installation_ref":"CBAM-STG-TC-001"}'::jsonb,
  '{"workspace_id":"a1111111-1111-4111-8111-111111111111","workspace_label":"[STG] Canonical Org","legal_entity_id":"e1111111-1111-4111-8111-111111111111","legal_entity_label":"[STG] Canonical Manufacturing","site_id":"e2111111-1111-4111-8111-111111111111","site_label":"[STG] Taichung Main Plant","boundary_type":"operational_control","reporting_period":{"start_date":"2026-01-01","end_date":"2026-03-31"}}'::jsonb,
  'internal_management',
  'staging',
  true
),
(
  'd9000002-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  'completed',
  2,
  jsonb_build_object(
    'project_metadata', jsonb_build_object(
      'project_id','a3333333-1111-4111-8111-111111111111',
      'organization_id','a1111111-1111-4111-8111-111111111111',
      'workspace_id','a1111111-1111-4111-8111-111111111111',
      'legal_entity_id','e1111111-1111-4111-8111-111111111111',
      'site_id','e2111111-1111-4111-8111-111111111111',
      'project_code','STG-PJT-SHOWCASE-001',
      'name','[STG] Showcase Inventory 2026'
    ),
    'reporting_period', jsonb_build_object('start_date','2026-01-01','end_date','2026-06-30'),
    'boundary_summary', jsonb_build_object('boundary_type','operational_control','included_count',11,'excluded_count',0,'pending_count',1),
    'workspace_snapshot', jsonb_build_object('workspace_id','a1111111-1111-4111-8111-111111111111','workspace_label','[STG] Canonical Org','slug','stg-canonical-org'),
    'legal_entity_snapshot', jsonb_build_object('legal_entity_id','e1111111-1111-4111-8111-111111111111','legal_entity_label','[STG] Canonical Manufacturing','entity_code','STG-LE-001','registered_name','STG Canonical Manufacturing Co., Ltd.','tax_id','87654321','country_code','TW'),
    'site_snapshot', jsonb_build_object('site_id','e2111111-1111-4111-8111-111111111111','site_label','[STG] Taichung Main Plant','site_code','STG-SITE-PRIMARY','facility_type','manufacturing_plant','country_code','TW','cbam_installation_ref','CBAM-STG-TC-001'),
    'boundary_snapshot', jsonb_build_object('workspace_id','a1111111-1111-4111-8111-111111111111','workspace_label','[STG] Canonical Org','legal_entity_id','e1111111-1111-4111-8111-111111111111','legal_entity_label','[STG] Canonical Manufacturing','site_id','e2111111-1111-4111-8111-111111111111','site_label','[STG] Taichung Main Plant','boundary_type','operational_control','reporting_period',jsonb_build_object('start_date','2026-01-01','end_date','2026-06-30')),
    'scope_totals', jsonb_build_object('scope_1',1465,'scope_2',3008,'scope_3',0,'unknown',0),
    'category_totals', jsonb_build_object('energy',3008,'stationary_combustion',1465),
    'data_gaps_and_warnings', jsonb_build_array(jsonb_build_object('code','pending_factor_exists')),
    'appendix_mappings', jsonb_build_array()
  ),
  'showcase-v3-report-hash-v2',
  '2026-01-01',
  '2026-06-30',
  11,
  0,
  1,
  '{"scope_1":1465,"scope_2":3008,"scope_3":0,"unknown":0}'::jsonb,
  '{"energy":3008,"stationary_combustion":1465}'::jsonb,
  '[{"factor_id":"a6666666-1111-4111-8111-111111111111","factor_key":"fixture-tw-grid-electricity","source_name":"MOENV","version":1},{"factor_id":"a6666666-2222-4222-8222-222222222222","factor_key":"fixture-diesel-combustion","source_name":"MOENV","version":1}]'::jsonb,
  1,
  '2026-06-30T23:59:00Z',
  '{"gross_total_co2e_kg":4473,"scope_totals":{"scope_1":1465,"scope_2":3008,"scope_3":0,"unknown":0},"category_totals":{"energy":3008,"stationary_combustion":1465}}'::jsonb,
  '{"claim_purpose":"internal_management","application_count":1,"requested_total_tco2e":3,"eligible_total_tco2e":2.4,"disallowed_total_tco2e":0.6}'::jsonb,
  '{"claim_purpose":"internal_management","inventory_impact_mode":"market_based_adjustment","gross_co2e_kg":4473,"eligible_deduction_tco2e":2.4,"eligible_deduction_kg":2400,"claim_net_co2e_kg":2073}'::jsonb,
  '[{"adjustment_application_id":"c1330001-1111-4111-8111-111111111111","adjustment_item_id":"c1110001-1111-4111-8111-111111111111","certificate_id":"c1220001-1111-4111-8111-111111111111","claim_purpose":"internal_management","status":"applied","requested_quantity_tco2e":3,"eligible_quantity_tco2e":2.4,"disallowed_quantity_tco2e":0.6,"inventory_impact_mode":"market_based_adjustment"}]'::jsonb,
  '{"legal_entity_id":"e1111111-1111-4111-8111-111111111111","legal_entity_label":"[STG] Canonical Manufacturing","entity_code":"STG-LE-001","registered_name":"STG Canonical Manufacturing Co., Ltd.","tax_id":"87654321","country_code":"TW"}'::jsonb,
  '{"site_id":"e2111111-1111-4111-8111-111111111111","site_label":"[STG] Taichung Main Plant","site_code":"STG-SITE-PRIMARY","facility_type":"manufacturing_plant","country_code":"TW","cbam_installation_ref":"CBAM-STG-TC-001"}'::jsonb,
  '{"workspace_id":"a1111111-1111-4111-8111-111111111111","workspace_label":"[STG] Canonical Org","legal_entity_id":"e1111111-1111-4111-8111-111111111111","legal_entity_label":"[STG] Canonical Manufacturing","site_id":"e2111111-1111-4111-8111-111111111111","site_label":"[STG] Taichung Main Plant","boundary_type":"operational_control","reporting_period":{"start_date":"2026-01-01","end_date":"2026-06-30"}}'::jsonb,
  'internal_management',
  'staging',
  true
);

insert into adjustment_applications (
  id, organization_id, project_id, report_generation_id, adjustment_item_id, certificate_id, claim_purpose,
  requested_quantity_tco2e, eligible_quantity_tco2e, disallowed_quantity_tco2e, disallow_reasons,
  inventory_impact_mode, status, idempotency_key, payload_hash, submitted_by_user_id, approved_by_user_id,
  submitted_at, approved_at, applied_at, metadata, env, is_test
)
values
('c1330001-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','d9000002-1111-4111-8111-111111111111','c1110001-1111-4111-8111-111111111111','c1220001-1111-4111-8111-111111111111','internal_management',3.0,2.4,0.6,'[]'::jsonb,'market_based_adjustment','applied','showcase-v3-app-001','showcase-v3-app-hash-001','27141206-6e54-40d0-8b9d-7dc60832bdd7','27141206-6e54-40d0-8b9d-7dc60832bdd7','2026-06-30T10:00:00Z','2026-06-30T10:05:00Z','2026-06-30T10:10:00Z','{"source":"seed_pack_v3"}'::jsonb,'staging',true),
('c1330002-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111',null,'c1110002-1111-4111-8111-111111111111','c1220002-1111-4111-8111-111111111111','voluntary_claim',6.0,6.0,0.0,'[]'::jsonb,'claim_only','approved','showcase-v3-app-002','showcase-v3-app-hash-002','27141206-6e54-40d0-8b9d-7dc60832bdd7','27141206-6e54-40d0-8b9d-7dc60832bdd7','2026-06-28T09:00:00Z','2026-06-28T09:05:00Z',null,'{"source":"seed_pack_v3"}'::jsonb,'staging',true),
('c1330003-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111',null,'c1110003-1111-4111-8111-111111111111','c1220003-1111-4111-8111-111111111111','ifrs_s2_note',5.0,0.0,5.0,'["certificate_not_verified","item_not_approved"]'::jsonb,'claim_only','submitted','showcase-v3-app-003','showcase-v3-app-hash-003','27141206-6e54-40d0-8b9d-7dc60832bdd7',null,'2026-06-29T09:00:00Z',null,null,'{"source":"seed_pack_v3"}'::jsonb,'staging',true);

insert into adjustment_audit_logs (
  id, organization_id, project_id, actor_user_id, action, table_name, record_id, adjustment_item_id, certificate_id, application_id,
  status, metadata, env, is_test
)
values
('c1440001-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','seed_v3_application_applied','adjustment_applications','c1330001-1111-4111-8111-111111111111','c1110001-1111-4111-8111-111111111111','c1220001-1111-4111-8111-111111111111','c1330001-1111-4111-8111-111111111111','recorded','{"source":"seed_pack_v3"}'::jsonb,'staging',true),
('c1440002-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','seed_v3_application_approved','adjustment_applications','c1330002-1111-4111-8111-111111111111','c1110002-1111-4111-8111-111111111111','c1220002-1111-4111-8111-111111111111','c1330002-1111-4111-8111-111111111111','recorded','{"source":"seed_pack_v3"}'::jsonb,'staging',true),
('c1440003-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','a3333333-1111-4111-8111-111111111111','27141206-6e54-40d0-8b9d-7dc60832bdd7','seed_v3_application_submitted','adjustment_applications','c1330003-1111-4111-8111-111111111111','c1110003-1111-4111-8111-111111111111','c1220003-1111-4111-8111-111111111111','c1330003-1111-4111-8111-111111111111','recorded','{"source":"seed_pack_v3"}'::jsonb,'staging',true);

insert into ai_audit_results (
  id, organization_id, project_id, report_generation_id, run_by_user_id, model_provider, model_name, model_version, status, input_snapshot,
  completeness_flags, anomaly_flags, exclusion_review_flags, hotspot_ranking, summary_text, recommended_actions, token_usage, confidence_score, env, is_test
)
values
(
  'd9110001-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-1111-4111-8111-111111111111',
  'd9000002-1111-4111-8111-111111111111',
  '27141206-6e54-40d0-8b9d-7dc60832bdd7',
  'mock-llm',
  'mock-audit-v3',
  '2026.04.showcase',
  'completed',
  '{"source":"seed_pack_v3"}'::jsonb,
  '[{"code":"pending_factor_exists","severity":"warning"}]'::jsonb,
  '[{"code":"high_stationary_combustion_share","severity":"info"}]'::jsonb,
  '[]'::jsonb,
  '[{"activity_code":"STG-EA-100001","co2e_kg":520},{"activity_code":"STG-EA-100003","co2e_kg":510},{"activity_code":"STG-EA-100005","co2e_kg":505}]'::jsonb,
  '{"zh_tw":"展示資料顯示用電與固定燃燒為主要熱點，六月柴油仍有 pending 因子。","en":"Showcase data indicates electricity and stationary combustion hotspots, with a pending diesel factor in June.","ja":"展示データでは電力と固定燃焼が主なホットスポットで、6月のディーゼル係数は pending です。"}'::jsonb,
  '[{"code":"close_pending_factor_june"},{"code":"review_diesel_reduction_plan"}]'::jsonb,
  '{"prompt_tokens":1320,"completion_tokens":360,"total_tokens":1680}'::jsonb,
  0.9,
  'staging',
  true
);

-- Ensure classification rows are synchronized for all seeded activities.
select upsert_emission_activity_classifications('d7770001-1111-4111-8111-111111111111'::uuid);
select upsert_emission_activity_classifications('d7770002-1111-4111-8111-111111111111'::uuid);
select upsert_emission_activity_classifications('d7770003-1111-4111-8111-111111111111'::uuid);
select upsert_emission_activity_classifications('d7770004-1111-4111-8111-111111111111'::uuid);
select upsert_emission_activity_classifications('d7770005-1111-4111-8111-111111111111'::uuid);
select upsert_emission_activity_classifications('d7770006-1111-4111-8111-111111111111'::uuid);
select upsert_emission_activity_classifications('d7770007-1111-4111-8111-111111111111'::uuid);
select upsert_emission_activity_classifications('d7770008-1111-4111-8111-111111111111'::uuid);
select upsert_emission_activity_classifications('d7770009-1111-4111-8111-111111111111'::uuid);
select upsert_emission_activity_classifications('d7770010-1111-4111-8111-111111111111'::uuid);
select upsert_emission_activity_classifications('d7770011-1111-4111-8111-111111111111'::uuid);
select upsert_emission_activity_classifications('d7770012-1111-4111-8111-111111111111'::uuid);

update seed_pack_reseed_runs
set
  status = 'completed',
  completed_at = now(),
  summary = jsonb_build_object(
    'organization_id', 'a1111111-1111-4111-8111-111111111111',
    'legal_entity_id', 'e1111111-1111-4111-8111-111111111111',
    'site_ids', jsonb_build_array('e2111111-1111-4111-8111-111111111111', 'e2222222-2222-4222-8222-222222222222'),
    'project_id', 'a3333333-1111-4111-8111-111111111111',
    'documents', 14,
    'drafts', 14,
    'activities', 12,
    'included_activities', 11,
    'pending_activities', 1,
    'calculation_results', 12,
    'reports', 2,
    'report_boundary_snapshots', 2,
    'adjustment_items', 3,
    'adjustment_certificates', 3,
    'adjustment_applications', 3
  )
where id = (
  select id
  from seed_pack_reseed_runs
  where scenario_code = 'stg_core_closed_beta'
    and seed_pack_version = 'v2026.04.07.v3'
    and status = 'started'
  order by started_at desc
  limit 1
);

commit;
