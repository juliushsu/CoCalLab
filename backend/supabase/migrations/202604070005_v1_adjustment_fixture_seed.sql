-- CaCalLab V1 staging fixture: adjustment chain + report layered snapshots

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
  'Fixture renewable energy attribute certificates for closed beta report panels',
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
  '{"source":"fixture","note":"org-level item for report claim snapshots"}'::jsonb,
  'staging',
  true
)
on conflict (id) do nothing;

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
  '{"source":"fixture"}'::jsonb,
  'staging',
  true
)
on conflict (id) do nothing;

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
  'a9000000-1111-4111-8111-111111111111',
  'b1111111-1111-4111-8111-111111111111',
  'b1222222-1111-4111-8111-111111111111',
  'internal_management',
  10.00000000,
  8.00000000,
  2.00000000,
  '["rule_ratio_zero_example_for_ui"]'::jsonb,
  'market_based_adjustment',
  'applied',
  'stg-fixture-adjustment-application-001',
  'stg-fixture-adjustment-hash-001',
  '2026-03-20T10:00:00Z',
  '2026-03-20T10:05:00Z',
  '2026-03-20T10:10:00Z',
  '{"source":"fixture"}'::jsonb,
  'staging',
  true
)
on conflict (id) do nothing;

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
  null,
  'fixture_adjustment_application_seed',
  'adjustment_applications',
  'b1333333-1111-4111-8111-111111111111',
  'b1111111-1111-4111-8111-111111111111',
  'b1222222-1111-4111-8111-111111111111',
  'b1333333-1111-4111-8111-111111111111',
  'recorded',
  '{"source":"fixture"}'::jsonb,
  'staging',
  true
)
on conflict (id) do nothing;

update report_generations
set
  claim_purpose = 'internal_management',
  gross_emissions_snapshot = coalesce(
    nullif(gross_emissions_snapshot, '{}'::jsonb),
    jsonb_build_object(
      'gross_total_co2e_kg', 610.8,
      'scope_totals', scope_totals,
      'category_totals', category_totals
    )
  ),
  adjustment_summary = coalesce(
    nullif(adjustment_summary, '{}'::jsonb),
    jsonb_build_object(
      'claim_purpose', 'internal_management',
      'application_count', 1,
      'requested_total_tco2e', 10,
      'eligible_total_tco2e', 8,
      'disallowed_total_tco2e', 2
    )
  ),
  claim_results = coalesce(
    nullif(claim_results, '{}'::jsonb),
    jsonb_build_object(
      'claim_purpose', 'internal_management',
      'inventory_impact_mode', 'market_based_adjustment',
      'gross_co2e_kg', 610.8,
      'eligible_deduction_tco2e', 8,
      'eligible_deduction_kg', 8000,
      'claim_net_co2e_kg', 0
    )
  ),
  adjustment_manifest = coalesce(
    nullif(adjustment_manifest, '[]'::jsonb),
    jsonb_build_array(
      jsonb_build_object(
        'adjustment_application_id', 'b1333333-1111-4111-8111-111111111111',
        'adjustment_item_id', 'b1111111-1111-4111-8111-111111111111',
        'certificate_id', 'b1222222-1111-4111-8111-111111111111',
        'claim_purpose', 'internal_management',
        'status', 'applied',
        'requested_quantity_tco2e', 10,
        'eligible_quantity_tco2e', 8,
        'disallowed_quantity_tco2e', 2,
        'inventory_impact_mode', 'market_based_adjustment'
      )
    )
  )
where id = 'a9000000-1111-4111-8111-111111111111';
