# CaCalLab Proposal: Factor Source Lifecycle / Update Governance + Compliant Report Template Governance

Last updated: 2026-04-07
Scope: staging-first

Regulatory basis (Taiwan):
- 溫室氣體排放量盤查登錄及查驗管理辦法（修正日期：2025-12-19）第7條。
- 溫室氣體排放量盤查作業指引（113年版）第2章關於盤查報告書章節與附錄範本。

## A. source lifecycle proposal

### A1) 生命週期狀態模型（source/version）

建議在 `emission_factor_source_versions`（新表）使用以下 canonical 狀態：

- `active_current`
- `newer_version_detected`
- `pending_platform_review`
- `deprecated`
- `retained_for_traceability`

### A2) 狀態定義與轉移

1. `pending_platform_review`
- 新抓取到官方/第三方來源版本，尚未完成平台審核（格式/方法學/適用模組/品質檢查）。
- 不可進入租戶可選清單。

2. `active_current`
- 平台審核通過且已發布給租戶使用的當前版本。
- 每個 `source_code + applicable_module + region` 僅允許 1 筆。

3. `newer_version_detected`
- 平台已偵測到更新版本，但目前租戶仍在使用舊 `active_current`。
- 用於提醒平台啟動審核與升級排程，不要求租戶自行升級。

4. `deprecated`
- 已不建議新計算使用；仍可供歷史查詢與必要重算比對。
- 新計算預設不可選，除非管理員顯式 override。

5. `retained_for_traceability`
- 法規或稽核需要保留追溯版本（唯讀封存）。
- 不可用於新計算，只能用於歷史報告重建與查核。

建議狀態轉移：
- `pending_platform_review -> active_current`
- `active_current -> newer_version_detected`（當偵測到新版本）
- `active_current -> deprecated`
- `deprecated -> retained_for_traceability`

### A3) 平台更新責任原則

- 來源庫更新責任在平台方（CaCalLab），非租戶。
- 租戶不應被要求自行上傳/覆蓋官方來源版本。
- 若版本變更影響重大，平台以 release note + in-app notice 告知，並提供「重算影響評估」。

## B. 租戶端可見狀態 proposal

### B1) 平台方可見狀態（完整）

平台治理後台可見全部狀態：

- `pending_platform_review`
- `active_current`
- `newer_version_detected`
- `deprecated`
- `retained_for_traceability`

並可見治理欄位：`review_status`, `reviewer`, `reviewed_at`, `effective_from/to`, `breaking_change_flag`。

### B2) 租戶可見狀態（簡化）

租戶 UI 不應暴露平台內部流程狀態，建議映射為：

- `available`（來源可用）：對應 `active_current`
- `update_managed_by_platform`（平台更新中）：對應 `newer_version_detected | pending_platform_review`
- `legacy_readonly`（歷史唯讀）：對應 `deprecated | retained_for_traceability`

### B3) 租戶行為限制

- 租戶不可直接把官方來源狀態改為 active/deprecated。
- 租戶可在自身專案層級設定「重算時是否鎖定既有版本」（lock for reproducibility）。
- 預設策略：新計算走 `active_current`；已發布報告維持原版本快照。

## C. report template canonical structure

### C1) Canonical 章節順序（盤查報告輸出模板）

依第7條與盤查作業指引，建議固定章節順序如下：

1. 基本資料
2. 盤查邊界設定
3. 排放源鑑別
4. 排放量計算
5. 數據品質管理與查證資訊
6. 其他主管機關規定事項
7. 附件與圖說（appendix）

### C2) 每章必要欄位（必填 / 條件式）

1. 基本資料（必填）
- 事業名稱
- 事業地址
- 事業負責人姓名
- 報告年度 / 報告版本 / 產製日期

2. 盤查邊界設定
- 必填：邊界類型（營運控制/財務控制/股權比例）
- 必填：廠（場）排放源平面配置圖說
- 條件式：與前一年度相比增設/拆除/停用情形（若無仍須填「無」）
- 必填：製程流程圖說

3. 排放源鑑別
- 必填：排放單元/程序名稱
- 必填：各單元溫室氣體種類
- 必填：產製期程與產品產量（非製造業可依指引規則轉為適用欄位）
- 必填：原（物）料、燃料種類/成分/碳含量/低位熱值/用量（適用者）

4. 排放量計算
- 必填：計算方法（排放係數法/質量平衡法/直接監測法/主管機關認可法）
- 必填：參數選用、數據來源、檢測方法、檢測日期
- 必填：各排放源排放量結果（直接 + 能源間接）
- 條件式：減量措施與說明（若無仍須填「無」）

5. 數據品質管理與查證資訊
- 必填：資料品質控管敘述（資料蒐集、審核、留痕）
- 條件式：查驗聲明/合理保證等級（屬應查驗對象時必填）

6. 其他主管機關規定事項
- 必填：主管機關指定欄位（以 template manifest 驅動）
- 條件式：特定行業附加欄位（服務業/醫院/運輸/校院）

7. 附件與圖說（必保留）
- 必保留：廠（場）排放源平面配置圖
- 必保留：製程流程圖
- 必保留：計算參數來源與檢測證明索引
- 必保留：活動資料與計算結果對照表（traceability appendix）

### C3) 法規對照（第7條）

模板需可逐項映射第7條第1款至第10款，並在輸出內含 `regulatory_mapping`（條款對應表），以利查核。

## D. schema / template versioning proposal

### D1) Factor source lifecycle schema（staging-first）

新增表：`emission_factor_source_versions`

- `id uuid pk`
- `source_id uuid not null references emission_factor_sources(id)`
- `version_code text not null`（例：`2026.03.tw.moenv.v1`）
- `lifecycle_status text not null`（五態）
- `detected_at timestamptz not null`
- `review_started_at timestamptz`
- `reviewed_at timestamptz`
- `published_at timestamptz`
- `effective_from date not null`
- `effective_to date`
- `change_summary jsonb not null default '{}'::jsonb`
- `breaking_change_flag boolean not null default false`
- `visible_to_tenant boolean not null default false`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at / updated_at`
- unique: `(source_id, version_code)`

約束：
- 每個 `source_id` 同時最多 1 筆 `active_current`。
- `visible_to_tenant=true` 僅允許在 `active_current|deprecated|retained_for_traceability`。

### D2) Report template governance schema（staging-first）

新增表：`report_templates`

- `id uuid pk`
- `template_code text unique not null`（例：`TW_GHG_INV_ART7_CANONICAL`）
- `jurisdiction text not null default 'TW'`
- `regulatory_basis text[] not null`
- `status text not null`（`draft|active|deprecated|retained_for_traceability`）
- `created_at / updated_at`

新增表：`report_template_versions`

- `id uuid pk`
- `template_id uuid not null references report_templates(id)`
- `version_code text not null`（例：`v2026.04.07`）
- `schema_version text not null`
- `section_manifest jsonb not null`（章節、欄位順序、必填規則、條件式顯示規則）
- `required_attachments jsonb not null`
- `regulatory_mapping jsonb not null`（第7條款項對應）
- `status text not null`（`draft|active|deprecated|retained_for_traceability`）
- `effective_from date not null`
- `effective_to date`
- `created_at / updated_at`
- unique: `(template_id, version_code)`

擴充 `report_generations`：
- `template_id uuid references report_templates(id)`
- `template_version_id uuid references report_template_versions(id)`
- `template_code text`
- `template_version_code text`

目標：每一份報告都可精準重建「當時所用模板規格」。

## E. Readdy front-end points

1. Factor Sources（租戶）
- 顯示簡化狀態：`available / update_managed_by_platform / legacy_readonly`
- 顯示「平台代管更新」說明文字，避免租戶誤認需自行更新
- 顯示版本生效日與是否建議重算

2. Factor Source Governance（平台後台）
- 顯示五態 lifecycle 看板
- 審核工作流（pending -> active）
- 版本差異檢視（因子異動、適用模組、風險標記）

3. Report Template 管理（平台後台）
- 模板版本編排器（章節順序、必填規則、條件顯示）
- 法規對照檢視（第7條款項覆蓋率）

4. Report Generation（租戶）
- 產報前顯示模板版本與法規基礎
- 章節缺漏檢查（必填欄位 gate）
- 附件缺漏檢查（圖說/證據）

5. Report Viewer / Export
- 顯示章節目錄與法規映射
- 顯示附件索引與圖說引用
- 顯示 `template_version_code` 與 `factor source version snapshot`

## Sources

- 法規第7條（最新版條文頁）：
  - https://oaout.moenv.gov.tw/Law/LawContent.aspx?id=GL005954
- 盤查作業指引（113年版，含盤查報告章節歸納）：
  - https://ghgregistry.moenv.gov.tw/upload/Tools/%E6%BA%AB%E5%AE%A4%E6%B0%A3%E9%AB%94%E6%8E%92%E6%94%BE%E9%87%8F%E7%9B%A4%E6%9F%A5%E4%BD%9C%E6%A5%AD%E6%8C%87%E5%BC%95113%E5%B9%B4%E7%89%88.pdf

