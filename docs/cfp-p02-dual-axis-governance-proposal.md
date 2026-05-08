# CaCalLab Proposal: 納入台灣環境部 CFP_P_02 與雙軸資料治理

Last updated: 2026-04-07
Scope: staging-first (schema / resolver / DTO / UI)

## A. CFP_P_02 納入建議

### A1) Source 白名單登錄建議

建議在 `emission_factor_sources`（新表）新增官方來源主檔列：

- `source_code`: `TW_MOENV_CFP_P_02`
- `source_name`: `環境部 CFP_P_02 產品/服務碳足跡排放係數`
- `source_type`: `official_registry`
- `region`: `TW`
- `jurisdiction`: `TW`
- `owner_org`: `MOENV`
- `default_data_level`: `secondary`
- `applicable_modules`: `['product_cfp', 'service_cfp']`
- `status`: `active`
- `official_url`: 環境部資料平台資料集頁 + 產品碳足跡資訊網來源說明

### A2) 與一般 inventory factor source 差異

`TW_MOENV_CFP_P_02` 不應混入一般組織盤查常用因子來源（如電力、燃料通用係數）原因：

- 主用途不同：CFP_P_02 主要面向「產品/服務碳足跡」核准案例係數，不是通用盤查預設因子庫。
- 資料語意不同：CFP_P_02 常帶有產品/服務邊界、功能單位、PCR/方法脈絡，解析度比通用 inventory 因子更細。
- 治理維度不同：其「官方」屬性成立，但多數場景仍屬二級因子，不等於一級活動數據。

## B. data_level 雙軸模型 proposal

### B1) 雙軸核心

建議從單軸 `source_type` 升級為：

- 軸 1（來源軸）: `source_type`（誰發布/可信度類型）
- 軸 2（資料等級軸）: `data_level`（資料是 primary/secondary/hybrid/fallback）

### B2) 欄位建議

建議至少新增/調整：

- `source_type`
  - 用途：來源性質分類
  - 建議值：`official_registry | official_guideline | industry_association | lca_database | supplier_specific | internal_measured | custom`
- `data_level`
  - 用途：該筆因子或來源預設資料等級
  - 建議值：`primary | secondary | hybrid | fallback`
- `activity_data_level`
  - 用途：活動數據等級（來自憑證/ERP/量測）
  - 建議值：`primary | secondary | hybrid | fallback`
- `factor_data_level`
  - 用途：排放係數本身等級
  - 建議值：`primary | secondary | hybrid | fallback`
- `applicable_module`
  - 用途：可用模組
  - 建議值（陣列）：`org_inventory | product_cfp | service_cfp`
- `priority_rank`
  - 用途：resolver 在同模組下排序（數字越小優先）

### B3) 關鍵治理原則

- `source_type != data_level`：官方來源可為 secondary。
- `activity_data_level` 與 `factor_data_level` 必須分開存，避免把「活動數據一級」誤判為「因子一級」。
- `hybrid` 僅在明確混用 primary + secondary 方法時使用，避免濫標。

### B4) Readdy 顯示層代碼 vs 資料層代碼（Canonical Mapping）

前提：目前 V1 後端可見的是 `quality_tier`（`official|industry|proxy|custom`），尚非 canonical `data_level`。

資料層（DB / API canonical code）固定使用：

- `data_level`: `primary | secondary | hybrid | fallback`
- `factor_data_level`: `primary | secondary | hybrid | fallback`
- `activity_data_level`: `primary | secondary | hybrid | fallback`

顯示層（UI badge/view-model code）建議固定使用：

- `display_tier_code`: `DL1 | DL2 | DL3 | DL4`
- `display_tier_label_zh_tw`:
  - `DL1`: `一級資料`
  - `DL2`: `二級資料`
  - `DL3`: `混合資料`
  - `DL4`: `替代/回補資料`

canonical mapping（前端唯一映射）：

- `primary -> DL1`
- `secondary -> DL2`
- `hybrid -> DL3`
- `fallback -> DL4`

過渡期 mapping（舊欄位 `quality_tier` 存在時）：

- `official -> secondary`（除非該筆另有 `factor_data_level`，以新欄位優先）
- `industry -> secondary`
- `proxy -> fallback`
- `custom -> hybrid`（若有可驗證一級證據則可升級為 `primary`，需人工審核）

前端渲染優先順序（避免混亂）：

1. `factor_data_level`（若有）
2. `data_level`（若有）
3. `quality_tier` 經過渡 mapping 推導

## C. factor resolution proposal

## C1) 組織盤查（org_inventory）

建議 priority（高 -> 低）：

1. 組織自有且經審核之 primary 因子（如特定供應商/設備實測，`organization_id` scoped）
2. 官方盤查通用因子（TW 官方年版 inventory 因子）
3. 產業協會/第三方資料庫二級因子
4. proxy/fallback 因子（需警示）

CFP_P_02 放置建議：

- 預設不進 org_inventory 第一層；僅在活動明確對應產品/服務功能單位且政策允許時可降階候選。
- 實作上應設定 `applicable_module` 預設不含 `org_inventory`，避免誤用。

## C2) 產品碳足跡 / 服務碳足跡（product_cfp / service_cfp）

建議 priority（高 -> 低）：

1. 一級活動數據 + 一級因子（若可得）
2. 一級活動數據 + 官方二級因子（CFP_P_02 典型落點）
3. 一級活動數據 + 其他高可信二級因子
4. 二級活動數據 + 官方二級因子
5. fallback（proxy）

CFP_P_02 放置建議：

- 定位：`source_type=official_registry` + `factor_data_level=secondary`。
- 在產品/服務 CFP resolver 中，應位於「官方二級因子」層，高於一般 secondary DB，低於可驗證 primary 因子。

## D. migration / schema proposal（staging-first）

### D1) emission_factor_sources 擴充（新表，正式來源白名單）

新增表（建議）：

- `emission_factor_sources`
  - `id uuid pk`
  - `source_code text unique not null`
  - `source_name text not null`
  - `source_type factor_source_type not null`
  - `region text not null default 'TW'`
  - `jurisdiction text`
  - `default_data_level factor_data_level not null default 'secondary'`
  - `applicable_modules text[] not null default '{org_inventory}'`
  - `priority_rank integer not null default 100`
  - `official_url text`
  - `metadata jsonb not null default '{}'::jsonb`
  - `status text not null default 'active'`
  - `created_at / updated_at`

並 seed：`TW_MOENV_CFP_P_02`。

### D2) emission_factors / factor versions

目前 `emission_factors` 僅有 `source_name/source_region/quality_tier`；建議擴充：

- `source_id uuid references emission_factor_sources(id)`
- `source_type factor_source_type`（可由 source 帶入，保留 denormalized 查詢便利）
- `data_level factor_data_level`（整體預設）
- `factor_data_level factor_data_level`（優先使用）
- `activity_data_level factor_data_level`（若該因子綁定特定活動資料等級）
- `applicable_modules text[]`
- `priority_rank integer`

相容策略：

- migration backfill 由舊欄位推導：
  - `source_name='MOENV'` -> map 至既有官方來源（非 CFP_P_02）
  - 其餘未識別先掛 `CUSTOM_UNMAPPED` 並 `data_level='fallback'`（或 `secondary` 依現況調整）
- `source_name` 先保留一版（deprecated）確保舊 API 不破。

### D3) product CFP module primary/secondary 標記

建議新增（若尚無專用表可先放 `emission_activities`）：

- `emission_activities.activity_data_level`
- `emission_activities.activity_data_evidence_type`（`invoice|meter|erp|supplier_pcf|estimate|other`）
- `calculation_results.factor_snapshot` 擴充寫入：
  - `source_code`
  - `source_type`
  - `factor_data_level`
  - `activity_data_level`
  - `applicable_module`

目標是報告可稽核：「同一筆計算的 activity level 與 factor level」。

### D4) UI / DTO 暴露欄位

建議 DTO 最少新增：

- Factor Source DTO
  - `source_code`
  - `source_name`
  - `source_type`
  - `default_data_level`
  - `applicable_modules`
  - `priority_rank`
- Emission Factor DTO
  - `source_id/source_code`
  - `factor_data_level`
  - `activity_data_level`（若有）
  - `data_level`
  - `applicable_modules`
  - `priority_rank`
- Calculation Result DTO
  - `factor_snapshot.source_code`
  - `factor_snapshot.source_type`
  - `factor_snapshot.factor_data_level`
  - `factor_snapshot.activity_data_level`

## E. Readdy front-end points

### E1) 排放係數來源頁

新增顯示欄位：

- `資料等級`（預設等級 + 可覆寫標記）
- `來源類型`（official_registry 等）
- `適用模組`（chips: 組織盤查/產品CFP/服務CFP）

### E2) 來源卡片

至少顯示：

- `source_name`
- `source_code`
- `source_type`
- `default_data_level`
- `applicable_modules`
- `priority_rank`

### E3) CFP_P_02 獨立入口

必須獨立資訊架構，不可混在一般台灣排放係數來源清單：

- 在來源頁新增「CFP 官方來源」分群或 tab（例如 `CFP Sources`）
- `TW_MOENV_CFP_P_02` 單獨卡片與詳情頁（含資料定義、適用模組、解析優先層）
- Resolver 設定頁顯示「CFP_P_02 在 product/service CFP 的預設順位」

## staging-first 建議 rollout

1. Stage 1（DB）: 新 enum + 新表 `emission_factor_sources` + `emission_factors` 新欄位（nullable）+ backfill。
2. Stage 2（Service）: resolver 分模組排序（org_inventory vs product_cfp/service_cfp），寫入 snapshot 新欄位。
3. Stage 3（API/DTO）: 對外暴露雙軸欄位，保留舊欄位相容。
4. Stage 4（Frontend）: 來源頁雙軸顯示 + CFP_P_02 獨立入口 + card 模組標籤。
5. Stage 5（Guardrail）: 若 `module=org_inventory` 且來源為 CFP_P_02，預設 warning 或需顯式覆核。

## 參照現況（CaCalLab）

- 目前因子主表：`emission_factors`（`source_name` 為文字欄位）
- 目前 resolver：`src/services/resolve-emission-factor.js`（尚未納入 module/data_level 維度）
- 目前 seed 來源示例：`MOENV`（未拆來源主檔）
