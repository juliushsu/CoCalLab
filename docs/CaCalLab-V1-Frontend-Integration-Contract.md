# CaCalLab V1 Frontend Integration Contract

## 1) Unified API Envelope

All edge functions use one envelope:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {
    "request_id": "req-123",
    "timestamp": "2026-03-16T12:00:00.000Z",
    "status": "completed",
    "reason": null,
    "warnings": []
  }
}
```

Error envelope:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SUBSCRIPTION_READONLY",
    "message": "Subscription does not allow formal data writes",
    "reason": {
      "zh_tw": "訂閱狀態為唯讀，禁止新增或修改正式資料",
      "en": "Subscription is readonly; formal data write is blocked",
      "ja": "サブスクリプションが読み取り専用のため、正式データの書き込みは禁止されています"
    }
  },
  "meta": {
    "request_id": "req-123",
    "timestamp": "2026-03-16T12:00:00.000Z",
    "status": "readonly",
    "reason": {
      "zh_tw": "訂閱狀態為唯讀，禁止新增或修改正式資料",
      "en": "Subscription is readonly; formal data write is blocked",
      "ja": "サブスクリプションが読み取り専用のため、正式データの書き込みは禁止されています"
    },
    "warnings": []
  }
}
```

Frontend rules:
- `success=false`: show `error.message`, and show localized `error.reason` if present.
- `meta.status=readonly|suspended`: disable all write actions.
- `meta.warnings`: non-blocking warning panel.
- always record `meta.request_id` in FE logs.

## 2) Edge Functions Contracts

### process-document
Required request:
- `organization_id`, `project_id`, `uploaded_document_id`

Optional request:
- `ocr_payload`, `provider_hint`, `request_id`

Success example:

```json
{
  "success": true,
  "data": {
    "draft_id": "a5555555-1111-4111-8111-111111111111",
    "status": "pending_review",
    "normalized_payload": {"vendor":"Taiwan Power","normalized_quantity":1200,"normalized_unit":"kWh"},
    "warnings": [],
    "provider": {"name":"mock-ocr","model":"mock-ocr-v1"}
  },
  "error": null,
  "meta": {"request_id":"req-1","timestamp":"...","status":"pending_review","reason":null,"warnings":[]}
}
```

Error example:

```json
{"success":false,"data":null,"error":{"code":"DOCUMENT_NOT_FOUND","message":"..."},"meta":{"status":"failed","warnings":[]}}
```

### classify-document
Required request:
- `organization_id`, `project_id`, `draft_id`

Optional request:
- `normalized_payload`, `model_hint`, `request_id`

Success example:

```json
{
  "success": true,
  "data": {
    "draft_id": "a5555555-1111-4111-8111-111111111111",
    "classification_status": "classified",
    "suggested_category": "energy",
    "suggested_scope": 2,
    "confidence_score": 0.93,
    "review_note": "Matched rule: electricity_bill",
    "provider": {"name":"mock-llm","model":"mock-classifier-v1"}
  },
  "error": null,
  "meta": {"request_id":"req-2","timestamp":"...","status":"classified","reason":null,"warnings":[]}
}
```

Error example:

```json
{"success":false,"data":null,"error":{"code":"DRAFT_NOT_FOUND","message":"..."},"meta":{"status":"failed","warnings":[]}}
```

### confirm-draft
Required request:
- `organization_id`, `project_id`, `draft_id`, `decision`

Optional request:
- `overrides`, `request_id`

Success example:

```json
{
  "success": true,
  "data": {
    "draft_id": "a5555555-1111-4111-8111-111111111111",
    "emission_activity_id": "a7777777-1111-4111-8111-111111111111",
    "calculation_result_id": "a8888888-1111-4111-8111-111111111111",
    "draft_status": "confirmed",
    "inclusion_status": "included"
  },
  "error": null,
  "meta": {"request_id":"req-3","timestamp":"...","status":"confirmed","reason":null,"warnings":[]}
}
```

Error example:

```json
{"success":false,"data":null,"error":{"code":"SUBSCRIPTION_READONLY","message":"Subscription does not allow formal data writes"},"meta":{"status":"readonly","reason":{"zh_tw":"...","en":"...","ja":"..."},"warnings":[]}}
```

### recalculate-project
Required request:
- `organization_id`, `project_id`, `actor_user_id`, `force_recalculate`

Optional request:
- `request_id`

Success example:

```json
{
  "success": true,
  "data": {
    "project_id": "a3333333-1111-4111-8111-111111111111",
    "processed_activities": 2,
    "calculated_count": 1,
    "pending_factor_count": 1,
    "excluded_count": 0,
    "error_count": 0
  },
  "error": null,
  "meta": {"request_id":"req-4","timestamp":"...","status":"completed","reason":null,"warnings":[]}
}
```

Error example:

```json
{"success":false,"data":null,"error":{"code":"RECALCULATE_PROJECT_ATOMIC_FAILED","message":"..."},"meta":{"status":"failed","warnings":[]}}
```

### generate-report
Required request:
- `organization_id`, `project_id`, `report_version`

Optional request:
- `claim_purpose`, `request_id`

Success example:

```json
{
  "success": true,
  "data": {
    "report_generation_id": "a9000000-1111-4111-8111-111111111111",
    "status": "completed",
    "claim_purpose": "internal_management",
    "gross_emissions_snapshot": {"gross_total_co2e_kg":610.8,"scope_totals":{"scope_1":0,"scope_2":610.8,"scope_3":0}},
    "adjustment_summary": {"claim_purpose":"internal_management","application_count":1,"requested_total_tco2e":10,"eligible_total_tco2e":8,"disallowed_total_tco2e":2},
    "claim_results": {"claim_purpose":"internal_management","inventory_impact_mode":"market_based_adjustment","gross_co2e_kg":610.8,"eligible_deduction_tco2e":8,"claim_net_co2e_kg":0},
    "adjustment_manifest": [{"adjustment_application_id":"b1333333-1111-4111-8111-111111111111","adjustment_item_id":"b1111111-1111-4111-8111-111111111111","claim_purpose":"internal_management","status":"applied"}],
    "payload": {"project_metadata":{},"boundary_summary":{}},
    "warning_count": 1
  },
  "error": null,
  "meta": {"request_id":"req-5","timestamp":"...","status":"completed","reason":null,"warnings":[{"zh_tw":"...","en":"...","ja":"..."}]}
}
```

Error example:

```json
{"success":false,"data":null,"error":{"code":"SUBSCRIPTION_REPORT_BLOCKED","message":"Subscription does not allow report generation"},"meta":{"status":"readonly","warnings":[]}}
```

### run-ai-audit
Required request:
- `organization_id`, `project_id`, `report_generation_id`

Optional request:
- `model_hint`, `request_id`

Success example:

```json
{
  "success": true,
  "data": {
    "ai_audit_result_id": "a9111111-1111-4111-8111-111111111111",
    "status": "completed",
    "summary_text": {"zh_tw":"...","en":"...","ja":"..."},
    "recommended_actions": [],
    "provider": {"name":"mock-llm","model":"mock-audit-v1"}
  },
  "error": null,
  "meta": {"request_id":"req-6","timestamp":"...","status":"completed","reason":null,"warnings":[]}
}
```

Error example:

```json
{"success":false,"data":null,"error":{"code":"RUN_AI_AUDIT_ATOMIC_FAILED","message":"..."},"meta":{"status":"failed","warnings":[]}}
```

### analytics-emissions
Method:
- `GET`

Required query:
- `organization_id`, `dimension` (`ghg_scope` or `iso_category`)

Optional query:
- `project_id`, `request_id`

Success example:

```json
{
  "success": true,
  "data": {
    "organization_id": "a1111111-1111-4111-8111-111111111111",
    "project_id": "a3333333-1111-4111-8111-111111111111",
    "dimension": "iso_category",
    "rows": [
      {"classification_system_code":"iso_category","classification_code":"category_1","total_co2e_kg":0,"activity_count":0},
      {"classification_system_code":"iso_category","classification_code":"category_2","total_co2e_kg":610.8,"activity_count":1},
      {"classification_system_code":"iso_category","classification_code":"category_3","total_co2e_kg":0,"activity_count":0},
      {"classification_system_code":"iso_category","classification_code":"category_4","total_co2e_kg":0,"activity_count":0},
      {"classification_system_code":"iso_category","classification_code":"category_5","total_co2e_kg":0,"activity_count":0},
      {"classification_system_code":"iso_category","classification_code":"category_6","total_co2e_kg":0,"activity_count":0}
    ],
    "total_co2e_kg": 610.8
  },
  "error": null,
  "meta": {"request_id":"req-analytics-1","timestamp":"...","status":"completed","reason":null,"warnings":[]}
}
```

Error example:

```json
{"success":false,"data":null,"error":{"code":"ANALYTICS_QUERY_FAILED","message":"..."},"meta":{"status":"failed","warnings":[]}}
```

### adjustment-rule-result
Method:
- `GET`

Required query:
- `organization_id`
- `adjustment_item_id`
- `claim_purpose` (`taiwan_carbon_fee|voluntary_claim|ifrs_s2_note|esg_note|internal_management`)
- `requested_quantity_tco2e` (>0)

Optional query:
- `project_id`, `report_generation_id`, `request_id`

Success example:

```json
{
  "success": true,
  "data": {
    "organization_id": "a1111111-1111-4111-8111-111111111111",
    "project_id": "a3333333-1111-4111-8111-111111111111",
    "adjustment_item_id": "b1111111-1111-4111-8111-111111111111",
    "report_generation_id": "a9000000-1111-4111-8111-111111111111",
    "claim_purpose": "internal_management",
    "requested": 10,
    "eligible": 8,
    "disallowed": 2,
    "disallow_reasons": [],
    "inventory_impact_mode": "market_based_adjustment"
  },
  "error": null,
  "meta": {"request_id":"req-adjustment-1","timestamp":"...","status":"completed","reason":null,"warnings":[]}
}
```

Error example:

```json
{"success":false,"data":null,"error":{"code":"ADJUSTMENT_RULE_EVAL_FAILED","message":"..."},"meta":{"status":"failed","warnings":[]}}
```

### enforce-subscription-status
Required request:
- `organization_id`

Optional request:
- `as_of`, `request_id`

Success example:

```json
{
  "success": true,
  "data": {
    "organization_id": "a1111111-1111-4111-8111-111111111111",
    "effective_status": "active",
    "can_write_formal_data": true,
    "can_generate_report": true,
    "reason": null
  },
  "error": null,
  "meta": {"request_id":"req-7","timestamp":"...","status":"active","reason":null,"warnings":[]}
}
```

Error example:

```json
{"success":false,"data":null,"error":{"code":"ENFORCE_SUBSCRIPTION_STATUS_FAILED","message":"..."},"meta":{"status":"failed","warnings":[]}}
```

## 3) Frontend Call Sequence

1. Upload file -> write `uploaded_documents`.
2. Call `process-document`.
3. Call `classify-document`.
4. User confirms draft -> call `confirm-draft`.
5. Call `recalculate-project`.
6. Call `generate-report`.
7. (optional) Call `analytics-emissions` for `ghg_scope` / `iso_category`.
8. (optional) Call `adjustment-rule-result` for Rule Result tab.
9. Call `run-ai-audit`.
10. Cron/manual call `enforce-subscription-status`.

## 4) Page Data Mapping

Organization/Subscription page reads:
- `organizations`: `id`, `display_name`, `status`
- `subscriptions`: `status`, `period_end`, `grace_until`, `readonly_from`, `plan_code`

Project dashboard reads:
- `projects`: `id`, `project_code`, `name`, `status`, `reporting_start_date`, `reporting_end_date`
- `emission_activities`: `inclusion_status`, `final_scope`, `category`, `quantity`, `unit`
- `calculation_results` (`is_latest=true`): `status`, `co2e_kg`, `warnings`

Document review page reads:
- `uploaded_documents`: `original_filename`, `ocr_status`, `received_date`
- `extracted_document_drafts`: `status`, `classification_status`, `normalized_payload`, `suggested_category`, `suggested_scope`, `confidence_score`

Report page reads:
- `report_generations`: `status`, `payload`, `warning_count`, `claim_purpose`, `gross_emissions_snapshot`, `adjustment_summary`, `claim_results`, `adjustment_manifest`, `created_at`
- `ai_audit_results`: `status`, `summary_text`, `recommended_actions`, `hotspot_ranking`

Analytics page reads:
- `analytics-emissions` response rows: `classification_system_code`, `classification_code`, `total_co2e_kg`, `activity_count`

Carbon adjustments rule tab reads:
- `adjustment-rule-result` response: `claim_purpose`, `requested`, `eligible`, `disallowed`, `disallow_reasons`, `inventory_impact_mode`

## 5) Editable vs Non-editable

Editable:
- confirm-draft overrides: `activity_name`, `activity_date`, `category`, `subcategory`, `activity_type`, `quantity`, `unit`, `inclusion_status`, `exclusion_reason`, `review_note`, `final_scope`

Non-editable:
- `id`, `organization_id`, `project_id`, `source_*_id`, `factor_snapshot`, `input_snapshot`, `calc_version`, `payload_hash`, `created_at`, `updated_at`

## 6) Readonly Mode UI Rules

When `effective_status` is `readonly` or `suspended`:
- disable project edit
- disable draft confirm to emission activity
- disable recalculation
- disable report generation
- disable AI audit run
- keep all read operations enabled
- show localized `meta.reason` banner

## 7) Typed Import Samples

## 8) Staging Closed Beta Conventions

- All closed-beta writes are marked as `env='staging'` and `is_test=true`.
- Storage uploads must use staging-only buckets:
  - `staging-receipts`
  - `staging-attachments`
- Storage path must be staging-identifiable:
  - `staging/<...>`
- Auto-generated activity codes in staging use prefix:
  - `STG-EA-000001`
- External integrations are guarded in non-production:
  - provider calls are forced to mock when an external provider is requested
  - response `meta.warnings` may include `EXTERNAL_ACTIONS_BLOCKED`

Frontend can directly import typed sample payloads from:
- `/Users/chishenhsu/Desktop/Codex/CaCalLab/src/contracts/frontend-examples.ts`

Minimal service wrappers example:
- `/Users/chishenhsu/Desktop/Codex/CaCalLab/docs/minimal-frontend-service-examples.ts`
