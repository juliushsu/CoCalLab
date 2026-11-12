# Function reality audit — public source edition
基準：GitHub main `0a90b7b9b499ae382c17293b7dd674b09b0ef020`，2026-10-31。以下只依該公開程式與本機檢查分類，**不列即時雲端／權限／部署判定**；完整環境稽核另由 owner 受限交接。

REAL＝所描述狹義 pure-JS 能力已測；PARTIAL＝有程式但未驗完整閉環；MOCK＝fixture、硬編碼或 mock provider；BROKEN＝可由 source 確認不相容／stub；NOT_BUILT＝本 baseline 無可交付實作。REAL 不等於 production-ready。

| ID | Capability / source | Status | Source evidence / gap |
| --- | --- | --- | --- |
| F01 | 首頁／方案／footer | PARTIAL | home components 存在；placeholder links 與數字宣稱不是驗收證據 |
| F02 | 登入／登出／session | PARTIAL | AuthContext 使用 Supabase auth；未登入驗收 |
| F03 | ProtectedRoute／角色 | PARTIAL | UI gate + backend authz；需 deny tests |
| F04 | 三語 i18n | PARTIAL | zh/en/ja resources；未逐畫面驗證 |
| F05 | 組織列表／建立 | PARTIAL | organizationService、CreateOrganizationPage、create-organization handler；未寫入測試 |
| F06 | 組織編輯 | BROKEN（source） | EditOrganizationPage load/update 註解，回 notFound |
| F07 | 成員管理 | PARTIAL | list/add/update/deactivate RPC 路徑；角色與 last-owner 待測 |
| F08 | 專案列表／建立／overview | PARTIAL | projectService 有真實 queries；未做 UI persistence 驗收 |
| F09 | 專案編輯 | BROKEN（source） | EditProjectPage load/update TODO／註解 |
| F10 | 多法人／據點／邊界 | PARTIAL | 有 source migration；target apply 狀態不得由檔案推論 |
| F11 | 文件 upload/hash/storage | PARTIAL | DocumentUploadPage、documentService；需授權 preview／失敗恢復驗收 |
| F12 | 文件列表／預覽／刪除 | PARTIAL | 真實 storage/table calls；非同一交易，需 error tests |
| F13 | 真 OCR | MOCK | provider factory 只支援 MockOcrProvider |
| F14 | OCR payload normalization | REAL（pure JS） | normalization unit test PASS |
| F15 | 真 LLM 分類 | MOCK | factory 只支援 mock-llm；rule classify 有測試 |
| F16 | 草稿 review/confirm/exclude | PARTIAL | confirm-draft 與 RPC source；confirm-draft.js function coverage 0% |
| F17 | AI 解釋 panel | PARTIAL | 從既有 draft/confidence/filename 推導，沒有模型請求 |
| F18 | 活動列表／建立 | PARTIAL | activityService/CreateActivityModal 有 query/insert，亦有 fixture path |
| F19 | 活動詳情／編輯／單筆重算 | MOCK | mockActivity；actual API 仍 TODO |
| F20 | resolver／units／calculate | REAL（pure JS） | selected unit tests PASS；未涵蓋完整 domain matrix |
| F21 | 專案重算持久化 | PARTIAL | recalculate handler + atomic RPC；transaction/race 未測 |
| F22 | 因子列表 UI | MOCK | EmissionFactorsPage 靜態資料 |
| F23 | 因子來源 UI | MOCK | FactorSourcesPage useState(MOCK_SOURCES) |
| F24 | 因子同步／source lifecycle | NOT_BUILT | governance proposals 不等於 ingestion 實作 |
| F25 | Analytics adapter | BROKEN（contract） | frontend POST/org_id/items/value_tco2e，backend GET/organization_id/rows/total_co2e_kg |
| F26 | Analytics trend／hotspot | MOCK | EmissionsAnalyticsPage fixtures |
| F27 | 報告中心／ESG／IFRS aliases | PARTIAL | 同一中心畫面；摘要 mock，非完整三種報告引擎 |
| F28 | report payload builder | REAL（pure JS） | build-report-payload unit test PASS |
| F29 | report generation persistence | PARTIAL | RPC 後 UPDATE，非全程同交易；target schema 另核 |
| F30 | history/version reads | PARTIAL | 真實讀取路徑；completed 不保證完整交付 |
| F31 | snapshot DTO | BROKEN（contract） | number/tCO2e vs JSON gross_total_co2e_kg，key mismatch，缺值轉 mock |
| F32 | preview chapters／save | PARTIAL | sections=[]、total_sections 固定10；save API 註解 |
| F33 | section regeneration | BROKEN（source） | frontend 呼叫 regenerate-section，backend 無 source |
| F34 | report PDF export | NOT_BUILT | export-report 呼叫仍註解，無可驗 exporter |
| F35 | real AI audit | MOCK | mock-llm／rule-based summary，非真模型 |
| F36 | adjustment item/certificate/application reads | PARTIAL | table paths 存在，empty/error fallback，部分 tabs 仍 mock |
| F37 | adjustment gross summary | BROKEN（source） | status='success' filter vs calculation status='calculated' |
| F38 | adjustment rule adapter | BROKEN（contract） | frontend POST/results[] vs backend GET/single eligibility；keys 與必填值不符 |
| F39 | 調整核准／鎖定／消耗 | PARTIAL | schema/RPC 設計存在，concurrency/claims 未驗 |
| F40 | subscription readonly rules | PARTIAL | overdue pure JS test PASS；handler/UI failure 策略仍待測 |
| F41 | billing／quotas／upgrade | MOCK | mockUsage/capability TODO，dependency 不代表 billing 完成 |
| F42 | product-carbon route | NOT_BUILT | route 指 NotFound；未接入頁面有 mock |
| F43 | ai-governance route | NOT_BUILT | route 指 NotFound |
| F44 | action/audit logs | PARTIAL | helper/table source 存在；寫失敗可被 catch，完整性待驗 |
| F45 | seed/reset/purge | PARTIAL | source scripts 存在且含刪除；H0 未執行 |
| F46 | 19+1 顧問 cohort／逐家驗收 | NOT_BUILT | generic org 不等於合作案管理與 acceptance domain |
| F47 | supplier／需求／RFQ／比價／審批／PO | NOT_BUILT | 未有採購 domain；vendor 字串／樣本圖不等於採購閉環 |
| F48 | SSO／SLA／restore/support delivery | NOT_BUILT（source evidence） | 公開 repo 無對應交付證據；不推論供應商功能 |

本機：13 Node tests PASS、type-check/build PASS、lint FAIL（15 warnings、0 errors、max-warnings=0）。未做登入、storage writes、real AI、SQL mutation、tenant E2E 或 production deploy。環境與安全結論只在受限 owner packet。
