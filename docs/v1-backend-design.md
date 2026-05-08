# CaCalLab V1 Backend Design (Implementable)

## A. V1 schema 設計總覽

資料流固定：

`organizations -> projects -> uploaded_documents -> extracted_document_drafts -> emission_activities -> calculation_results -> report_generations / ai_audit_results`

已實作 migration：
- `supabase/migrations/202603160001_v1_core_schema.sql`

包含：
1. 12 張核心表
2. enum status 系統
3. PK / FK / unique / index
4. `created_at` + `updated_at` trigger
5. RLS 多租戶隔離（`organization_id` 為核心）
6. 訂閱唯讀寫入限制（RLS + backend service 雙層）

## B. 每張表欄位與關聯

### 1) organizations
- PK: `id`
- Unique: `slug`
- Status: `status` (`active|archived|suspended`)
- Timestamps: `created_at`, `updated_at`
- Archival: `archived_at`

### 2) organization_members
- PK: `id`
- FK: `organization_id -> organizations.id`
- Unique:
  - `(organization_id, user_id)` (partial)
  - `(organization_id, invited_email)` (partial invited)
- Status: `status` (`active|invited|inactive`)
- Timestamps: `created_at`, `updated_at`

### 3) subscriptions
- PK: `id`
- FK: `organization_id -> organizations.id`
- Status: `status` (`active|grace_period|readonly|suspended|canceled`)
- Timestamps: `created_at`, `updated_at`
- Index: `(organization_id, status, period_end desc)`

### 4) projects
- PK: `id`
- FK: `organization_id -> organizations.id`
- Unique: `(organization_id, project_code)`
- Status: `status` (`draft|active|closed|archived`)
- Timestamps: `created_at`, `updated_at`
- Archival: `archived_at`

### 5) uploaded_documents
- PK: `id`
- FK:
  - `organization_id -> organizations.id`
  - `project_id -> projects.id`
- Unique: `(project_id, sha256_hash)`
- Status:
  - `status` (`active|archived`)
  - `ocr_status` (`pending|processing|succeeded|failed`)
- Timestamps: `created_at`, `updated_at`
- Archival: `archived_at`

### 6) extracted_document_drafts
- PK: `id`
- FK:
  - `organization_id -> organizations.id`
  - `project_id -> projects.id`
  - `uploaded_document_id -> uploaded_documents.id`
- Unique:
  - `(uploaded_document_id, extraction_version)`
  - latest-only partial unique `(uploaded_document_id) where is_latest`
- Status:
  - `status` (`pending_review|needs_clarification|confirmed|rejected`)
  - `classification_status` (`unclassified|classified`)
- Timestamps: `created_at`, `updated_at`

### 7) emission_activities
- PK: `id`
- FK:
  - `organization_id -> organizations.id`
  - `project_id -> projects.id`
  - `source_document_id -> uploaded_documents.id`
  - `source_draft_id -> extracted_document_drafts.id`
- Unique: `(organization_id, project_id, activity_code)`
- Status:
  - `status` (`active|voided|archived`)
  - `inclusion_status` (`included|excluded|pending`)
- Inclusion fields:
  - `exclusion_reason`, `review_note`, `suggested_scope`, `final_scope`, `confidence_score`
- Timestamps: `created_at`, `updated_at`
- Archival: `archived_at`

### 8) emission_factors
- PK: `id`
- FK: `organization_id` nullable（null 表示全域因子）
- Unique:
  - custom: `(organization_id, factor_key, version)`
  - global partial unique: `(factor_key, version) where organization_id is null`
- Status: `status` (`active|deprecated|draft`)
- Versioning: `version`, `valid_from`, `valid_to`
- Timestamps: `created_at`, `updated_at`

### 9) calculation_results
- PK: `id`
- FK:
  - `organization_id -> organizations.id`
  - `project_id -> projects.id`
  - `emission_activity_id -> emission_activities.id`
  - `factor_id -> emission_factors.id`
- Unique:
  - `(emission_activity_id, calc_version)`
  - latest-only partial unique `(emission_activity_id) where is_latest`
- Status: `status` (`calculated|pending_factor|error|superseded`)
- Snapshots: `factor_snapshot`, `input_snapshot`, `formula_version`
- Timestamps: `created_at`, `updated_at`, `calculated_at`

### 10) report_generations
- PK: `id`
- FK:
  - `organization_id -> organizations.id`
  - `project_id -> projects.id`
- Unique: `(project_id, report_version)`
- Status: `status` (`queued|generating|completed|failed`)
- Traceability:
  - `payload`, `payload_hash`, `scope_totals`, `category_totals`, `factor_sources`, `based_on_calculated_at`
- Timestamps: `created_at`, `updated_at`

### 11) ai_audit_results
- PK: `id`
- FK:
  - `organization_id -> organizations.id`
  - `project_id -> projects.id`
  - `report_generation_id -> report_generations.id`
- Status: `status` (`queued|running|completed|failed`)
- Structured audit fields:
  - `completeness_flags`, `anomaly_flags`, `exclusion_review_flags`, `hotspot_ranking`, `summary_text`, `recommended_actions`
- Timestamps: `created_at`, `updated_at`

### 12) audit_logs
- PK: `id`
- FK:
  - `organization_id -> organizations.id`
  - `project_id -> projects.id`
- Status: `status` (`recorded|redacted`)
- Trace fields:
  - `actor_type`, `action`, `entity_type`, `entity_id`, `before_state`, `after_state`, `metadata`
- Timestamps: `created_at`, `updated_at`

## C. 核心 service / function 設計

實作檔案：`src/services/*`

1. `normalize_extracted_document_draft(input)`
- 來源：OCR payload
- 輸出：`normalized_payload`, `confidence_score`, `status`, `warnings`
- 重點：單位正規化、日期/數量 parse、缺漏分數

2. `classify_document_draft(input)`
- 依規則分類 category / activity_type / scope
- 輸出 `inclusion_status` 建議（低信心即 pending）

3. `resolve_emission_factor({activity, factors})`
- 依日期有效期、單位、category/activity_type、tenant custom 優先與版本挑選
- 無法匹配回傳 `pending_factor`

4. `calculate_emission_activity({activity, factors, formula_version})`
- excluded 直接標 `superseded`
- 單位不支援標 `error`
- 無因子標 `pending_factor`
- 成功時寫入 `factor_snapshot` + `input_snapshot`

5. `recalculate_project({...})`
- 逐筆 activity 重算
- 計算 `calc_version` 遞增
- 回傳統計（calculated/pending/excluded/error）

6. `build_report_payload({project, activities, calculation_results})`
- 產出完整報告 payload（符合 V1 必要欄位）

7. `run_ai_audit({report_payload, model_info})`
- 不綁單一模型
- 回傳結構化健檢結果 schema

8. `enforce_subscription_readonly({organization_id, subscriptions, as_of})`
- 計算 effective status
- 輸出 `can_write_formal_data` + `can_generate_report`

## D. Edge Functions contract

實作檔案：
- `supabase/functions/process-document/index.ts`
- `supabase/functions/classify-document/index.ts`
- `supabase/functions/confirm-draft/index.ts`
- `supabase/functions/recalculate-project/index.ts`
- `supabase/functions/generate-report/index.ts`
- `supabase/functions/run-ai-audit/index.ts`
- `supabase/functions/enforce-subscription-status/index.ts`

共享契約定義：`src/contracts/contracts.js`

### 1) process-document
- Input: `organization_id`, `project_id`, `uploaded_document_id`, `ocr_payload`
- Output: `draft_id`, `status`, `normalized_payload`, `warnings`

### 2) classify-document
- Input: `organization_id`, `project_id`, `draft_id`, `normalized_payload`
- Output: `draft_id`, `classification_status`, `suggested_category`, `suggested_scope`, `confidence_score`

### 3) confirm-draft
- Input: `organization_id`, `project_id`, `draft_id`, `decision`, `overrides`
- Output: `draft_id`, `emission_activity_id`, `draft_status`, `inclusion_status`

### 4) recalculate-project
- Input: `organization_id`, `project_id`, `actor_user_id`, `force_recalculate`
- Output: `project_id`, `processed_activities`, `calculated_count`, `pending_factor_count`, `excluded_count`

### 5) generate-report
- Input: `organization_id`, `project_id`, `report_version`
- Output: `report_generation_id`, `status`, `payload`, `warning_count`

### 6) run-ai-audit
- Input: `organization_id`, `project_id`, `report_generation_id`, `model_hint?`
- Output: `ai_audit_result_id`, `status`, `summary_text`, `recommended_actions`

### 7) enforce-subscription-status
- Input: `organization_id`, `as_of?`
- Output: `organization_id`, `effective_status`, `can_write_formal_data`, `can_generate_report`, `reason`

## E. inclusion / exclusion / pending 規則設計

`emission_activities` 強制欄位：
- `inclusion_status` (`included|excluded|pending`)
- `exclusion_reason`
- `review_note`
- `suggested_scope`
- `final_scope`
- `confidence_score`

規則：
1. `excluded` 必須有 `exclusion_reason`（DB check constraint）
2. `pending` 允許計算流程進入，但 `calculation_results.status` 為 `pending_factor` 或 `error` 時必須列入報告 gap
3. `included` 才計入 scope/category totals
4. `excluded` 不可併入正式排放總量

## F. 計算引擎設計

模組：
- `src/services/unit-normalization.js`
- `src/services/resolve-emission-factor.js`
- `src/services/calculate-emission-activity.js`
- `src/services/recalculate-project.js`

設計點：
1. 單位正規化先行
2. 因子解析可同時支援全域+租戶因子
3. 找不到因子 -> `pending_factor`
4. `factor_snapshot` 與 `input_snapshot` 永久保存於 `calculation_results`
5. 公式版本化 `formula_version`
6. `is_latest + calc_version` 支援專案重算追溯

## G. 訂閱與唯讀邏輯

資料表：`subscriptions`
狀態：`active`, `grace_period`, `readonly`, `suspended`, `canceled`

執行層：
1. Service：`enforce_subscription_readonly()`
2. Edge Function：`enforce-subscription-status`
3. DB RLS：`organization_is_writable()` + write policy

明確規則：
1. readonly/suspended 不可新增修改正式資料（`projects`, `emission_activities`, `calculation_results`, `report_generations`, `ai_audit_results`）
2. report generation 只允許 active/grace_period
3. 後端強制（Edge Function + RLS），非前端按鈕控制

## H. migration / seed / test 建議

已新增：
- migration: `supabase/migrations/202603160001_v1_core_schema.sql`
- seed: `supabase/seed/v1_seed.sql`
- tests: `tests/core-services.test.js`

測試覆蓋：
1. OCR draft 正規化
2. 文件分類
3. factor resolve 成功/失敗
4. 活動計算（含 pending factor）
5. 專案重算計數
6. 報告 payload 欄位完整性
7. AI audit 結果結構
8. 訂閱唯讀轉換

## I. 風險與需 Readdy 配合欄位

風險：
1. `organization_members.user_id` 尚未連接 `auth.users` FK（依 Supabase auth schema 整合策略）
2. Edge Function 目前以 service role 執行，需要配合 secret 管理與最小權限策略
3. 因子資料來源（MOENV/環境部）實際更新節奏需資料營運流程支援
4. AI audit 目前為 rule-engine baseline，接 LLM 前需定義成本與審核策略

需 Readdy 配合：
1. 前端上傳後呼叫順序固定：`process-document -> classify-document -> confirm-draft`
2. confirm 畫面需填寫 `inclusion_status/exclusion_reason/final_scope/review_note`
3. 專案頁需顯示 pending/gap 與 readonly 原因（直接吃後端 `reason` 三語物件）
4. 報告頁需用 `report_generations.payload` 原樣渲染，不自行重算
