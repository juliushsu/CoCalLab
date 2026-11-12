# Database and API map — public source edition
日期：2026-10-31。基準：[juliushsu/CoCalLab](https://github.com/juliushsu/CoCalLab)，main `0a90b7b9b499ae382c17293b7dd674b09b0ef020`。

本文件只描述該公開 Git commit 已存在的架構與程式契約。完整即時 catalog、環境資源定位、權限、migration 對照與本機非公開來源清單保留於 owner 受限本機交接包；不發布到公開 GitHub。Source 宣告不代表目標環境已套用或通過驗收。

## 系統與信任邊界
```text
Readdy / React 19 + TypeScript + Vite 7 + Tailwind + i18next + React Router
   AuthContext / ProtectedRoute
   typed services + supabase-js 2.57.4
      ├─ Supabase Auth
      ├─ PostgREST tables + member RPC（user JWT / RLS）
      ├─ Supabase Storage（upload / metadata / preview）
      └─ Deno Edge handlers
           authz → contracts → pure JS services → SQL RPC
                            └─ mock OCR / mock LLM providers
```
backend/package.json 僅有 Node tests，沒有獨立 Node HTTP server。firebase／Stripe dependency 不足以證明對應整合完成。Edge 使用 SDK 2.49.4，frontend 使用 2.57.4；兩者須分別驗證。UI route gate 不取代 server authorization。

## Public source map
| Layer | Path | Responsibility |
| --- | --- | --- |
| Routes | frontend/readdy-app/src/router/config.tsx | 登入、組織、專案、文件、活動、報告、因子、分析、調整、訂閱；product-carbon／ai-governance 指向 NotFound |
| Auth | src/contexts/AuthContext.tsx / components/auth/ProtectedRoute.tsx | session 與 route gate |
| CRUD/read services | src/services/organizationService.ts、projectService.ts、documentService.ts、activityService.ts、reportService.ts | tables／storage／member RPC／report DTO |
| Read adapters | src/services/analyticsService.ts、adjustmentService.ts、reportSnapshotService.ts | API／snapshot adapters，有下述 source contract 差異 |
| Edge transport | src/services/edgeFunction.ts | functions.invoke 預設 POST，錯誤 envelope parsing |
| Request validators | backend/src/contracts/contracts.js | request field／enum validation |
| Domain functions | backend/src/services | normalize、classify、resolve、calculate、confirm、recalculate、report、audit、subscription |
| Provider factory | backend/src/providers/index.js | 只有 mock OCR／LLM；未知 provider 會 throw |
| Shared handlers | backend/supabase/functions/_shared | service-role/request client、authz、HTTP envelope、staging guard、action logging |
| Database declarations | backend/supabase/migrations | 依時間順序定義 schema、RLS、RPC；後版可能覆蓋前版 |
| Fixture declarations | backend/supabase/seed + fixture migrations | staging／demo；含 purge/delete，禁止無差別 replay |

## Database domains declared in the public migrations
以下為 source 模型，**不是即時雲端表清單**。欄位、constraints、policies 與最後函式實作，應逐一讀取此 commit 的 migration 全鏈；受限環境驗證另見 owner packet。

| Domain | Source declarations | Relations / purpose |
| --- | --- | --- |
| Tenancy | organizations、organization_members、subscriptions、projects | organizations 為 workspace，members/subscriptions/projects 以 organization_id 關聯 |
| Documents | uploaded_documents、extracted_document_drafts | project/document → draft；storage metadata 不等於授權 URL |
| Inventory | emission_activities、emission_factors、calculation_results、emission_activity_classifications | activity 連 source document/draft；calculation 連 activity/factor 並留 input/factor snapshot |
| Reports | report_generations、ai_audit_results | project 的 versioned payload；audit 可連 report generation |
| Adjustments | carbon_adjustment_items、adjustment_certificates、adjustment_claim_rules、adjustment_applications、adjustment_audit_logs | item→certificate/application，application 可連 project/report |
| Operations | audit_logs、action_logs、seed_pack_registry、seed_pack_reseed_runs | audit 與 seed governance；不當作業務客戶資料 |
| Boundary proposal implementation | legal_entities、sites；project references；report snapshots | public source 202605080001 migration 定義，套用狀態僅在受限 packet 核對 |

主資料流：
```text
organizations → projects → uploaded_documents → extracted_document_drafts
                       → emission_activities → calculation_results
                                            → report_generations → ai_audit_results
carbon_adjustment_items → adjustment_certificates / adjustment_applications
                        → report snapshot / adjustment_audit_logs
```
Factor source/version lifecycle、monitoring/direct emissions/custom factors 與 report template proposals 是 docs 設計，不能當作已完成。採購 supplier/RFQ/quote/approval/PO domain 無本基準交付實作。

## Edge contracts in the public source
以下僅列 source method 與邏輯責任；雲端是否部署、版本／JWT 設定與資源定位留在受限 packet，不依檔案存在宣稱 live。
Base path 為 `/functions/v1/<slug>`。

| Slug | Source method / input | Persistence / response |
| --- | --- | --- |
| create-organization | POST；slug/legal_name/display_name 等 | create_organization_with_owner，組織與 owner membership |
| process-document | POST；organization_id/project_id/uploaded_document_id；ocr_payload 或 provider_hint | process_document_atomic；draft/status/normalized payload/provider/warnings |
| classify-document | POST；organization_id/project_id/draft_id/model_hint | classify_document_atomic；分類與 provider |
| confirm-draft | POST；organization/project/draft/decision 等，詳 validator | confirm_draft_atomic；review/activity/calculation |
| recalculate-project | POST；organization_id/project_id | recalculate_project_atomic；counters |
| generate-report | POST；organization/project/report_version；claim_purpose/language/request_id | generate_report_atomic 後再 UPDATE snapshot；payload+snapshots |
| run-ai-audit | POST；organization/project/report context，詳 validator | run_ai_audit_atomic；structured audit，factory 為 mock |
| enforce-subscription-status | POST；organization_id/as_of/request_id | 可能 UPDATE subscription + INSERT audit；不能作唯讀 health check |
| analytics-emissions | GET；organization_id/project_id?/dimension | get_emissions_analytics；rows/total_co2e_kg |
| adjustment-rule-result | GET；organization_id/adjustment_item_id/claim_purpose/requested_quantity_tco2e，project/report optional | evaluate_adjustment_eligibility；requested/eligible/disallowed/reasons |
| regenerate-section | frontend 呼叫，無 backend source | NOT_BUILT |
| export-report | frontend 註解 placeholder | NOT_BUILT |
| recalculate-emissions | activity detail 註解 placeholder | 無對應單筆 API |

共通成功 envelope 為 `{success,data,error:null,meta:{request_id,timestamp,status,reason,warnings}}`；失敗為 `success:false/data:null/error`。create-organization 獨立實作需驗證相容性。共通 http.ts 沒有 OPTIONS/CORS headers，跨來源應驗證，不以 build PASS 推論可用。

## Source-level integration gaps
1. analyticsService 使用 POST body org_id、期待 items/value_tco2e/total_tco2e/trend；backend source 接 GET query organization_id，回 rows/total_co2e_kg。method、名稱、shape、kg/tonne 必須統一。
2. adjustmentService 使用 POST adjustment_id/org_id、期待 results[]/rule_engine_applied/is_mock；backend source 接 GET 且需 purpose/quantity，回單筆 eligibility。部署不能補救契約錯誤。
3. reportSnapshotService 把 gross_emissions_snapshot 當 number；generate-report 寫 JSON object gross_total_co2e_kg。adjustment_summary/claim_results key 與 unit 亦不同，缺值會混 mock。
4. fetchGrossEmissions 篩 status='success'，calculate-emission-activity 回 calculated；資料路徑需修正及測試。
5. generate-report 在 atomic RPC 後再 patch snapshot，非全程同一交易。需在完整 schema 的隔離環境驗證 partial failure、版本、hash 與 idempotency。
6. reportService 回 sections=[] 卻固定 total_sections=10；不代表章節生成完成。
7. documentService 使用 getPublicUrl；需依目標 storage 的 private/public policy 實作授權 preview，不能假設可公開讀取。
8. request contract、RLS、privileged RPC 與 role checks 必須一起驗證；不執行 production writes 探測。

## Source migration navigation
Public source migration 分組如下。完整檔名由 `git ls-tree -r --name-only <baseline> backend/supabase/migrations` 取得；**這裡不發布環境 applied-state 對照**。

| Source versions | Purpose |
| --- | --- |
| 202603160001–202603160011 | core schema、atomic RPC、provider/confirmation hardening、frontend fixture |
| 202603180001–202603180009 | staging flags/logging/storage/purge、fixture、membership/member management |
| 202604070001–202604070006 | organization read chain、classification analytics、adjustments/rules/report/seed governance |
| 202605080001 | additive boundary tables/project links/report snapshots |

逐版閱讀，尤其 fixture migrations 與 seeds/purge 有刪除行為。後續 agent 應在受限環境取回 applied versions、schema、policy、grants 與 edge versions，對照 owner packet；核准前不得 apply/seed/reset。
