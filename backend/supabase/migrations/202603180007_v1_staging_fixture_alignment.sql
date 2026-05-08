-- Align frontend fixture records with staging naming/isolation conventions.

update projects
set
  project_code = 'STG-PJT-FIXTURE-001',
  name = '[STG] Fixture Carbon Inventory 2026',
  env = 'staging',
  is_test = true
where id = 'a3333333-1111-4111-8111-111111111111';

update uploaded_documents
set
  storage_bucket = case
    when id = 'a4444444-1111-4111-8111-111111111111' then 'staging-receipts'
    when id = 'a4555555-1111-4111-8111-111111111111' then 'staging-attachments'
    else storage_bucket
  end,
  storage_path = case
    when id = 'a4444444-1111-4111-8111-111111111111' then 'staging/fixtures/TEST_20260316_electricity-bill-202603.png'
    when id = 'a4555555-1111-4111-8111-111111111111' then 'staging/fixtures/TEST_20260316_misc-receipt-202603.jpg'
    else storage_path
  end,
  original_filename = case
    when id = 'a4444444-1111-4111-8111-111111111111' then 'TEST_20260316_electricity-bill-202603.png'
    when id = 'a4555555-1111-4111-8111-111111111111' then 'TEST_20260316_misc-receipt-202603.jpg'
    else original_filename
  end,
  env = 'staging',
  is_test = true
where id in (
  'a4444444-1111-4111-8111-111111111111',
  'a4555555-1111-4111-8111-111111111111'
);

update extracted_document_drafts
set env = 'staging', is_test = true
where id in (
  'a5555555-1111-4111-8111-111111111111',
  'a5666666-1111-4111-8111-111111111111'
);

update emission_activities
set
  activity_code = case
    when id = 'a7777777-1111-4111-8111-111111111111' then 'STG-EA-000001'
    when id = 'a7888888-1111-4111-8111-111111111111' then 'STG-EA-000002'
    else activity_code
  end,
  env = 'staging',
  is_test = true
where id in (
  'a7777777-1111-4111-8111-111111111111',
  'a7888888-1111-4111-8111-111111111111'
);

update calculation_results
set env = 'staging', is_test = true
where id in (
  'a8888888-1111-4111-8111-111111111111',
  'a8999999-1111-4111-8111-111111111111'
);

update report_generations
set
  payload = replace(replace(payload::text, 'EA-000001', 'STG-EA-000001'), 'EA-000002', 'STG-EA-000002')::jsonb,
  env = 'staging',
  is_test = true
where id = 'a9000000-1111-4111-8111-111111111111';

update ai_audit_results
set env = 'staging', is_test = true
where id = 'a9111111-1111-4111-8111-111111111111';

update organizations
set env = 'staging', is_test = true
where id = 'a1111111-1111-4111-8111-111111111111';

update subscriptions
set env = 'staging', is_test = true
where id = 'a2222222-1111-4111-8111-111111111111';
