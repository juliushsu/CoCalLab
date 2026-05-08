# CaCalLab Proposal: Organization-owned Primary Monitoring / Custom Factor

Last updated: 2026-04-07
Scope: staging-first (schema / resolution / governance / UI)

## A. schema proposal

### A1) 設計原則

- 一級活動數據（activity data）與排放係數（factor）分離建模，不共用同一欄位。
- 直接排放量（direct emissions measurement）獨立於 activity quantity 與 factor 推估。
- organization-specific factor 屬於 factor 軸高品質來源，但不等於 activity primary。
- 支援 organization / site / equipment 綁定，並保留 project 與 activity 關聯。

### A2) 建議新增與調整表

### 1) `organization_sites`（支援 site 綁定，新增）

- `id uuid pk`
- `organization_id uuid not null references organizations(id) on delete cascade`
- `site_code text not null`
- `site_name text not null`
- `country_code char(2) not null default 'TW'`
- `timezone text not null default 'Asia/Taipei'`
- `status text not null default 'active'`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at / updated_at`
- unique: `(organization_id, site_code)`

### 2) `organization_equipment`（支援 equipment 綁定，新增）

- `id uuid pk`
- `organization_id uuid not null references organizations(id) on delete cascade`
- `site_id uuid references organization_sites(id)`
- `equipment_code text not null`
- `equipment_name text not null`
- `equipment_type text`
- `manufacturer text`
- `model text`
- `serial_number text`
- `commissioned_on date`
- `decommissioned_on date`
- `status text not null default 'active'`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at / updated_at`
- unique: `(organization_id, equipment_code)`

### 3) `organization_monitoring_sources`（必要）

用途：描述資料來源本體（監測儀表、SCADA、CEMS、實驗室檢測、ERP 匯入等）

- `id uuid pk`
- `organization_id uuid not null references organizations(id) on delete cascade`
- `site_id uuid references organization_sites(id)`
- `equipment_id uuid references organization_equipment(id)`
- `source_code text not null`
- `source_name text not null`
- `source_type text not null`  
  建議值：`meter | cems | scada | lab_test | erp | manual_log | supplier_feed`
- `measurement_subject text not null`  
  建議值：`activity | direct_emission | both`
- `calibration_status text not null default 'unknown'`
- `calibration_valid_until date`
- `verification_status text not null default 'unverified'`
- `methodology_ref text`
- `applicable_gases text[] not null default '{CO2e}'`
- `evidence_document_id uuid references uploaded_documents(id)`
- `effective_from date not null`
- `effective_to date`
- `status text not null default 'active'`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at / updated_at`
- unique: `(organization_id, source_code)`

### 4) `organization_activity_measurements`（必要）

用途：儲存自家監測的活動量（例如 kWh、Nm3、L、kg）

- `id uuid pk`
- `organization_id uuid not null references organizations(id) on delete cascade`
- `project_id uuid references projects(id)`
- `site_id uuid references organization_sites(id)`
- `equipment_id uuid references organization_equipment(id)`
- `monitoring_source_id uuid not null references organization_monitoring_sources(id)`
- `emission_activity_id uuid references emission_activities(id)`
- `measurement_time timestamptz not null`
- `activity_type text not null`
- `category text`
- `subcategory text`
- `quantity numeric(20,8) not null`
- `unit text not null`
- `normalized_quantity numeric(20,8)`
- `normalized_unit text`
- `activity_data_level text not null default 'primary'`  
  建議值：`primary | secondary | hybrid | fallback`
- `data_quality_score numeric(5,4)`
- `verification_status text not null default 'unverified'`
- `methodology_ref text`
- `applicable_gases text[]`
- `evidence_document_id uuid references uploaded_documents(id)`
- `effective_from date not null`
- `effective_to date`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at / updated_at`

### 5) `organization_direct_emission_measurements`（必要）

用途：儲存直接量測到的排放量（不經 factor 換算）

- `id uuid pk`
- `organization_id uuid not null references organizations(id) on delete cascade`
- `project_id uuid references projects(id)`
- `site_id uuid references organization_sites(id)`
- `equipment_id uuid references organization_equipment(id)`
- `monitoring_source_id uuid not null references organization_monitoring_sources(id)`
- `emission_activity_id uuid references emission_activities(id)`
- `measurement_time timestamptz not null`
- `gas_type text not null`  
  建議值：`CO2 | CH4 | N2O | CO2e`
- `emission_amount numeric(20,10) not null`
- `emission_unit text not null`  
  建議值：`kg | t`
- `direct_emissions_data boolean not null default true`
- `activity_data_level text not null default 'primary'`
- `verification_status text not null default 'unverified'`
- `methodology_ref text`
- `applicable_gases text[] not null default '{}'::text[]`
- `evidence_document_id uuid references uploaded_documents(id)`
- `effective_from date not null`
- `effective_to date`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at / updated_at`

### 6) `organization_custom_factors`（必要）

用途：organization-specific factor，與 site/equipment/activity 綁定

- `id uuid pk`
- `organization_id uuid not null references organizations(id) on delete cascade`
- `project_id uuid references projects(id)`
- `site_id uuid references organization_sites(id)`
- `equipment_id uuid references organization_equipment(id)`
- `factor_key text not null`
- `factor_name text not null`
- `factor_scope text not null`  
  建議值：`organization | site | equipment | process`
- `activity_type text not null`
- `category text not null`
- `subcategory text`
- `unit text not null`
- `co2e_kg_per_unit numeric(20,10) not null`
- `co2_kg_per_unit numeric(20,10)`
- `ch4_kg_per_unit numeric(20,10)`
- `n2o_kg_per_unit numeric(20,10)`
- `factor_data_level text not null default 'primary'`  
  建議值：`primary | secondary | hybrid | fallback`
- `organization_specific_factor boolean not null default true`
- `calibration_status text not null default 'unknown'`
- `calibration_valid_until date`
- `verification_status text not null default 'unverified'`
- `methodology_ref text`
- `applicable_gases text[] not null default '{CO2e}'`
- `evidence_document_id uuid references uploaded_documents(id)`
- `effective_from date not null`
- `effective_to date`
- `priority_rank integer not null default 20`
- `status text not null default 'active'`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at / updated_at`
- unique: `(organization_id, factor_key, effective_from)`

### A3) 與既有表 FK 關係

- `organizations`：上述四個核心新表均以 `organization_id` 為 tenant key。
- `projects`：`organization_activity_measurements` / `organization_direct_emission_measurements` / `organization_custom_factors` 可選 `project_id`（支援專案化管理）。
- `equipment`：透過新增 `organization_equipment` 串接，並由 `site_id` 對應 `organization_sites`。
- `emission_activities`：
  - `organization_activity_measurements.emission_activity_id` 對應活動量來源。
  - `organization_direct_emission_measurements.emission_activity_id` 對應直接排放來源。
- `calculation_results`：
  - 不直接 FK 到 measurement 表（避免版本耦合），改在 `factor_snapshot` / `input_snapshot` 寫入來源追溯 ID：
    - `monitoring_source_id`
    - `activity_measurement_id`
    - `direct_emission_measurement_id`
    - `organization_custom_factor_id`

## B. resolution priority proposal

### B1) 組織盤查（org_inventory）

建議優先序（高 -> 低）：

1. `organization_direct_emission_measurements`（direct emissions data，已驗證）
2. `organization_activity_measurements`（primary） + `organization_custom_factors`（organization-specific, primary/hybrid）
3. `organization_activity_measurements`（primary） + 官方 inventory 因子
4. 官方 inventory 因子（活動數據為 secondary/hybrid）
5. `CFP_P_02`（僅在政策允許且活動具產品/服務功能單位映射時）
6. 其他 LCA DB / industry factors
7. fallback / proxy

### B2) 產品碳足跡 / 服務碳足跡（product_cfp/service_cfp）

建議優先序（高 -> 低）：

1. 自家直接排放數據（direct emissions）
2. 自家監測活動數據（primary） + 自家因子（organization-specific, verified）
3. 自家監測活動數據（primary） + `CFP_P_02`（official secondary）
4. 自家監測活動數據（primary） + 官方一般因子
5. 二級活動數據 + `CFP_P_02`
6. 其他 LCA 資料庫
7. fallback

### B3) 關鍵說明

- 「自家監測活動數據」與「自家因子」是兩層判斷：
  - 活動數據品質由 `activity_data_level` 判斷。
  - 因子品質由 `factor_data_level` + `organization_specific_factor` 判斷。
- `direct_emissions_data=true` 時，不應再套用 factor 換算同一筆排放（避免重複計算）。

## C. governance / quality fields

### C1) 必要欄位（依你指定）

以下欄位應分別存在於 monitoring source / measurement / custom factor（依語意）：

- `calibration_status`
- `calibration_valid_until`
- `verification_status`
- `methodology_ref`
- `applicable_gases`
- `evidence_document_id`
- `effective_from`
- `effective_to`

### C2) 建議 enum（staging 可先 text + check）

- `calibration_status`: `not_required | unknown | pending | calibrated | expired | failed`
- `verification_status`: `unverified | pending | verified | rejected | superseded`

### C3) 四種概念的治理切分（避免混欄）

- `activity_data_level`: 活動量資料等級（來源於生產/營運/控制流程）
- `factor_data_level`: 因子資料等級（含 organization-specific factor）
- `direct_emissions_data`: 是否為直接量測排放（boolean 或 measurement type）
- `organization_specific_factor`: 是否為組織特定因子（boolean）

## D. migration plan

### Stage 1: Schema（staging）

1. 新增 enum/check：`calibration_status`、`verification_status`、`data_level`（可沿用 canonical）
2. 新增表：
   - `organization_sites`
   - `organization_equipment`
   - `organization_monitoring_sources`
   - `organization_activity_measurements`
   - `organization_direct_emission_measurements`
   - `organization_custom_factors`
3. 在 `emission_activities` 新增：
   - `activity_data_level`
   - `site_id`
   - `equipment_id`
4. 在 `calculation_results.factor_snapshot` / `input_snapshot` 寫入 trace keys（程式層）

### Stage 2: Resolver / Service

1. resolver 增加 `calculation_mode`：`factor_based | direct_emission`
2. 若存在有效 `direct_emission_measurement`，直接出結果並寫 `resolution_path='org_direct_emission'`
3. 若為 factor-based，先查 `organization_custom_factors`（org/site/equipment 精確匹配）再落到官方/CFP_P_02/LCA/fallback
4. 寫入完整 trace：`resolution_path`, `source_table`, `source_id`, `quality_flags`

### Stage 3: Backfill 與相容

1. 現有 `emission_factors` 中 organization-owned 因子遷移至 `organization_custom_factors`（保留舊表鏡像期）
2. 舊 `quality_tier` 對應到新 `factor_data_level`（過渡 mapping）
3. API 保留舊欄位，新增新欄位，前端逐步切換

### Stage 4: Guardrails

1. 若 `direct_emissions_data=true` 且同 activity 又被 factor-based 計算，阻擋並回錯誤碼
2. 若 `calibration_valid_until < activity_date`，標記 warning 或降級可用性
3. `verification_status != verified` 的 custom factor 預設不可用，除非組織策略允許並留痕

## E. Readdy front-end points

### E1) 組織設備 / 監測來源設定頁

- 新頁：`Monitoring Sources`
- 支援 site/equipment 綁定、校正狀態、驗證狀態、方法學引用、有效期間

### E2) 自家量測資料輸入頁

- 新頁：`Activity Measurements`
- 新頁：`Direct Emissions`
- 支援批次匯入（CSV/API）、文件證據綁定、project/activity 關聯

### E3) 自家因子管理頁

- 新頁：`Organization Custom Factors`
- 顯示 `organization_specific_factor`、`factor_data_level`、適用 site/equipment、有效期間、可用氣體

### E4) Factor Resolution Trace 顯示

- 在計算結果/活動詳情頁新增 `Resolution Trace` 區塊：
  - `calculation_mode`
  - `resolution_path`
  - `selected_source_type`
  - `activity_data_level`
  - `factor_data_level`
  - `direct_emissions_data`
  - `monitoring_source_id / custom_factor_id / factor_id`
  - `why_not_selected`（候選未入選原因）

## F. Normative 條文版（對齊辦法第4條、第5條）

法規對齊基準（as of 2026-04-07）：

- 《溫室氣體排放量盤查登錄及查驗管理辦法》第4條：盤查計算方法、排放係數法可用來源、直接監測法計畫核定要求。
- 同辦法第5條：燃料熱值與碳含量之檢測資格與方法（含 CNS 17025 / ISO/IEC 17025、NIEA/CNS/USEPA/APHA/JIS/ASTM/AOAC/ISO/EU/主管機關認可方法等）。

以下為 CaCalLab 需落地之 normative requirements：

### F1) 定義（Normative Definitions）

1. `direct monitoring`
- 指依第4條之直接監測法取得排放濃度/流量並計算排放量之資料路徑。
- 在系統以 `calculation_mode='direct_emission'` 與 `direct_emissions_data=true` 表示。

2. `self-plant factor`
- 指第4條第2項第2款所稱「國際文獻或檢測報告所得之自廠係數」。
- 在系統以 `organization_specific_factor=true` 的 `organization_custom_factors` 表示。

3. `activity data`
- 指製程/設備/營運控制範圍內之活動量（例如燃料量、電力量、原物料量）。
- 在系統以 `organization_activity_measurements` 與 `activity_data_level` 表示。

4. `required calibration / verification / lab qualification`
- `calibration`: 監測設備需有有效校正狀態與期限（`calibration_status`, `calibration_valid_until`）。
- `verification`: 量測/因子需具驗證狀態（`verification_status`）。
- `lab qualification`: 涉及熱值與碳含量檢測時，檢測來源須符合第5條資格與方法學要求。

### F2) 計算方法合規要求（Article 4 aligned）

1. 系統 `MUST` 僅允許下列盤查計算方法：
- `emission_factor_method`
- `mass_balance_method`
- `direct_monitoring_method`
- `other_moenv_approved_method`

2. 系統 `MUST` 以單一排放單元或程序為最小計算單位，儲存對應單元識別（site/equipment/process key）。

3. 若使用排放係數法，系統 `MUST` 限定因子來源為：
- 中央主管機關公告因子，或
- `self-plant factor`（具國際文獻或檢測報告證據）。

4. 若活動為燃料燃燒且採排放係數法，系統 `MUST` 具備「燃料用量 × 低位熱值 × 係數」所需欄位與公式留痕。

5. 若採直接監測法，系統 `MUST` 保存監測計畫與品質保證證據（可由 `methodology_ref` + `evidence_document_id` + `metadata.plan_approval_ref` 表示）。

### F3) 檢測資格與方法合規要求（Article 5 aligned）

1. 涉及燃料熱值、原（物）料與燃料碳含量之數據，系統 `MUST` 記錄：
- 檢測機構類型與資格（含是否 CNS 17025 / ISO/IEC 17025）
- 檢測方法標準（NIEA/CNS/USEPA/APHA/JIS/ASTM/AOAC/ISO/EU/其他主管機關認可）
- 檢測日期與報告編號

2. 若未提供上述資格與方法欄位，該筆數據 `MUST NOT` 被標記為可直接進入高優先序 resolution。

3. 對於法規允許之公告燃料/原（物）料標示值情境，系統 `SHOULD` 支援 `lab_requirement_exempted=true` 並要求公告依據來源留痕。

### F4) Factor Resolution 適用條件（Normative）

1. `direct monitoring` 路徑進入條件（`MUST` 全部成立）：
- `direct_emissions_data=true`
- `verification_status in ('verified','pending')`（正式申報建議僅 `verified`）
- `calibration_status in ('calibrated','not_required')`
- `calibration_valid_until` 未逾測量日期（若適用）
- `methodology_ref` 與 `evidence_document_id` 不得為空

2. `self-plant factor` 高優先序進入條件（`MUST` 全部成立）：
- `organization_specific_factor=true`
- `factor_data_level in ('primary','hybrid')`
- `verification_status='verified'`
- `effective_from <= activity_date <= effective_to (or effective_to is null)`
- 若因子依檢測建立，需有第5條對應之 lab qualification/method 證據

3. 若不滿足上述條件，系統 `MUST` 自動降級至下一層（官方因子/CFP_P_02/LCA/fallback），並在 `resolution_trace.why_not_selected` 留痕原因。

4. 系統 `MUST` 禁止同一 `emission_activity_id` 同時計入：
- direct emissions 結果，與
- factor-based 換算結果。

### F5) 與既有雙軸治理欄位之關係

1. `activity_data_level` 只描述活動數據品質，`MUST NOT` 直接代表因子品質。
2. `factor_data_level` 只描述排放係數品質，`MUST NOT` 反推活動數據等級。
3. `direct_emissions_data` 與 `organization_specific_factor` 為獨立旗標，`MUST` 分開管理與顯示。
