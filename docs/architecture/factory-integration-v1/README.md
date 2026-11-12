# 工廠生管與能源整合設計提案 V1

日期：2026-11-12（Asia/Taipei）  
狀態：PROPOSED／待 PC 端檢核；本次僅交付文件。  
Repository：`juliushsu/CoCalLab`。檢核基準 main：`94d01b9c9f081df494f805b41166599ccd73541e`。

## 1. 問題與交付目的

工廠需要把生產紀錄、能源與物料耗用對應至實際產出，並以不同來源二次核對。目前已有文件→活動→係數→計算→報告的基礎，但未形成工單／批次→設備／製程→耗用→產品排放的完整流程。

本提案讓 PC 端先確認既有實作與依賴，再以小批 PR 接續完成此缺口。它是整體系統開發佇列的補充，不取代既有契約修復、採購、AI、報告與商業驗收工作，也不代表整個系統已完成。

文件入口：

- 本文件：現況證據、領域模型、計算與核對原則、使用者文案。
- [API_CONTRACT.md](API_CONTRACT.md)：來源對應、匯入草案、修正及防重複規則。
- [PC_REVIEW_AND_ACCEPTANCE.md](PC_REVIEW_AND_ACCEPTANCE.md)：PC 檢核、分批實作、驗收案例及回報格式。

用詞：MES 指製造執行系統，EMS 指能源管理系統，ERP 指企業資源規劃系統。使用者提及的 HMS 保留為待確認的廠商／系統名稱；未確認前不將 HMS 自動更名為 MES，也不假定其資料能力。

## 2. 基準版本的事實與缺口

以下路徑相對 repository 根目錄，均以本文件記載的 SHA 檢查；「未見」是來源碼檢查結論，不代表已探測部署環境。

| ID | 現有證據 | 判定與缺口 |
| --- | --- | --- |
| G01 | `backend/supabase/migrations/202603160001_v1_core_schema.sql` 有 `emission_activities`、`emission_factors`、`calculation_results` | 有活動計算基礎；未見工單、批次、實際物料耗用、設備時段對應的完整領域模型 |
| G02 | `backend/src/services/calculate-emission-activity.js` 使用數量×係數並保存 input/factor snapshot | 未見產品歸屬、共用能源分攤、分母與分配版本 |
| G03 | `backend/src/services/resolve-emission-factor.js` 依活動類型、單位、有效日、租戶及品質排序 | 未依 CFP 模組、製程與生命週期適用性形成完整選擇及覆核契約 |
| G04 | `docs/org-owned-monitoring-custom-factor-proposal.md` 規劃監測、設備、自家因子及 CSV/API | 是提案；基準 migrations/functions 未見其完整落地，也未見工單／產品對應與跨來源核對服務 |
| G05 | `backend/supabase/migrations/202605080001_phase1_boundary_governance_staging.sql` 定義 `legal_entities`、`sites` 與報告邊界快照 | 有 schema 基礎；不據此宣稱正式環境已套用、site 細粒度權限已驗收或工廠工作流可用 |
| G06 | `frontend/readdy-app/src/pages/admin/product-carbon/ProductCarbonPage.tsx` 設 `PRODUCT_CFP_AVAILABLE = false` 並使用 `MOCK_PROJECTS/MOCK_STAGES` | CFP 為受控示意入口，尚不能宣稱已有產品 CFP 功能 |
| G07 | `backend/src/services/build-report-payload.js` 產出專案／scope/category 彙總 | 未見產品批次結果、分配清冊、核對狀態及產品計算邊界快照；缺少計算的值不可在新流程默認為零 |

舊監測提案使用 `organization_sites`；目前 staging migration 已定義 `sites`。本提案優先沿用 `sites`，由 PC 驗證套用狀態與相容方式，避免新增第二套廠區主檔。`organizations` 仍依 canonical 文件代表 workspace，不能當作法人或廠區。

## 3. 第一個可交付範圍

以單一 workspace／法人／廠區、一條產線、兩種交替生產產品為最小案例：匯入生產實績、能源時段資料、實際物料與入庫紀錄；建立對應；核對；計算製造階段排放；輸出可回溯的批次與每單位結果。先用合成 CSV 與隔離本機資料庫驗證，共用相同正規化契約，再接實際廠商 API。

廠商連接器需依實際文件選 push API、排程讀取或檔案交換，V1 不預設即時串流。首次不必建立通用工業通訊平台，也不直接控制工廠設備。

製造階段結果應標示「製造階段排放估算」。產品完整 CFP 必須另定宣告／功能單位、參考流、邊界、期間及適用方法，納入邊界內原料、運輸、使用、廢棄等階段；若選 cradle-to-gate 也需明示邊界與排除項目。不能把工廠用電除以產量直接標為完整 CFP。

## 4. 建議資料模型與關係

以下為邏輯物件與候選表名，不是可直接執行的 migration。PC 應依既有命名與資料型態定稿。

| 物件／候選表 | 必要資料與關係 |
| --- | --- |
| `source_connections` | workspace、來源類型與 instance、廠商、允許廠區／資料種類、狀態、同步游標及 credential reference；不保存明文 secret 至匯入內容 |
| `external_id_mappings` | connection＋entity type＋external ID → internal ID，有效期間、版本、覆核者；廠區／設備／料號對應不得跨 workspace |
| `products`、`product_versions` | 料號、規格／版本、產量單位、BOM 版本參照；宣告單位與計算邊界由產品評估版本固定 |
| `production_orders`、`production_batches` | 工單、批次、計畫／實際期間、狀態；透過 junction 支援一工單多批次、批次拆併，不假定一對一 |
| `process_runs`、`process_run_resources` | 批次／製程、實際開始結束、設備／產線使用時段與比例；重疊時段需有共用規則 |
| `production_outputs` | 批次、產品版本、良品／不良品／副產品量及單位；重工與報廢以事件／關聯留痕，避免重工重複算成新良品 |
| `material_movements` | 領料、退料、耗損、包材、重工投入、批次／製程、物料與供應商批號、數量單位及憑證；BOM 預估與實際耗用分開 |
| `monitoring_sources`、`resource_measurements` | 儀表／設備、總表／分表拓樸及有效日、資源種類、時段、增量／累積讀值、量測／估算、校正及證據；銜接既有監測提案 |
| `ingestion_jobs`、`source_records` | 原始內容或私有儲存參照、hash、來源事件 ID、revision、接收時間、mapping version、處理狀態；成功／失敗均可追溯 |
| `reconciliation_runs`、`reconciliation_findings` | 核對對象、共同期間／邊界／單位、差異、容差版本、判定、覆核與處置；核對不覆寫來源值 |
| `allocation_rule_versions`、`allocation_runs`、`allocation_lines` | 待分配耗用或排放池、直接歸屬／分攤基礎、目標批次／產品、比例、餘額、規則／輸入版本、核准人 |
| `product_assessment_versions`、`product_emission_results` | 產品／批次、邊界、宣告單位、reference flow、階段總量、單位排放、缺口、計算／因子／分配／核對版本及結果快照 |

關聯主線：來源紀錄 → 正規化耗用／生產實績 → 核對版本 → 直接歸屬或分攤 → 活動計算 → 產品結果 → 報告版本。每一結果都要能反向追到來源紀錄與證據。

共同約束：

1. 每筆資料有 workspace 範圍、來源與版本；site 必須屬於同 workspace／法人，所有 FK 關係以資料庫約束或受測的原子服務保證範圍一致。
2. source record 是穩定事實來源，可被不同專案引用。專案是準備工作單位，不是來源唯一鍵；跨專案報表亦須依來源血緣去重。
3. 設備、儀表、料號與分配規則都需有效期間。不能用今天的設備對應回寫去年已完成報告。
4. 儲存原始數值、單位、時區／offset、正規化值及轉換版本。負值僅能出現在已定義的退料／修正事件，不可默認為負耗能。

## 5. 計算與係數治理

API 串接改善活動數據的取得與追溯，並不自動改善排放係數。活動品質與因子品質沿用既有提案分開管理；來源為 API／ERP 不等於量測已驗證或資料品質為 primary。

- 因子選擇先檢查模組、地區、日期、能源／物料種類、單位及生命週期涵蓋範圍；再依核准的品質政策選用。缺少適用因子時標 `pending_factor`，不以零代替。
- 電力、燃料等以活動量×適用係數計算；直接量測排放保留獨立計算模式。同一來源活動與涵蓋氣體不可同時把直接量測與係數推估相加。
- 上游物料優先用實際耗用；BOM 推估只能明示為估算，不能再與同一筆實際耗用相加。供應商 PCF 與材料係數也需檢查生命週期重疊。
- 優先直接歸屬；共用耗用才採有依據的製程工時、實測能源、質量等分攤。依適用方法選擇物理或其他關係，不能預設全部按產量平均分配。
- 待機、換線、空壓、空調、損耗、副產品、報廢與重工均需明確處理。未分配量必須保留，不能自動消失或攤成零。
- 在同一範圍與版本內：池總量＝直接歸屬量＋共用分攤量＋未分配量；分配總量不得超過池總量，直接歸屬量先從共用池扣除。
- 組織盤查與產品排放是同一事實的不同視角。產品分配明細不得再次作為新增組織排放相加；企業持股／控制權分配也不等於產品製程分攤。
- 單位排放＝歸屬該產品、該邊界的排放÷對應參考產出量。單位、良品／副產品處理與分母版本必須固定；零產出保留總排放，單位值為不可計算，不能除以零。

計算快照至少包含 source record revision／hash、mapping version、measurement IDs、輸入與轉換版本、產品／BOM 版本、因子內容與版本、allocation rule/run、reconciliation run、methodology／boundary／functional unit、公式版本、覆核與時間。修正資料建立新結果／報告版本，舊快照不變。

## 6. 二次核對規則

| 核對 | 必須處理的語意 |
| --- | --- |
| 電費帳單 ↔ 總表 | 帳期、時區、實際抄表區間、估抄、表計倍率；同一耗用的兩個證據，不是兩筆排放 |
| 總表 ↔ 分表＋合理剩餘量 | 同一拓樸／期間，包含未量測區域及損耗；不可同時把總表與所有分表當獨立耗能相加 |
| 工單完工 ↔ MES 實績 ↔ ERP 入庫 | 數量單位、跨期入庫、在製品、報廢／重工／退回；排程數不是實際產量 |
| BOM 標準 ↔ 實際領退料 | 保留標準與實際差異；確認存貨變動與副產品，不能強迫實際耗用等於標準 |
| 設備能源時段 ↔ 製程時段 | 半開區間 `[start,end)`、重疊生產、待機／換線、時間同步；無實測切分依據的時段估分需標示估算 |

容差使用版本化絕對值／相對值及適用條件；門檻由廠務／生管與方法負責人確認，V1 不宣稱任意百分比為法規要求。相對差異的基準為零時改用絕對容差，不做除零。

狀態分開：`pending`、`within_tolerance`、`discrepancy`、`insufficient_data`；人工處置另記 `open/resolved/accepted_with_exception`。容差內不等於查證通過；同一來源重匯不算獨立核對證據。差異未解可預覽草稿，但計算所需輸入缺漏不得標示完整；接受例外須有理由與授權覆核，結果仍顯示例外。

## 7. 使用者流程與產品文案

以下都是待實作狀態，不因合併本文件而啟用功能。

| 位置／狀態 | 建議文案與行為 |
| --- | --- |
| 資料來源尚未串接 | 「尚未連接生產或能源系統。可先匯入標準檔案建立資料對應。」僅在檔案匯入已實作時提供按鈕 |
| 連接器只有規劃 | 「規劃中」；不能顯示「已連線」或「即時同步」 |
| 已收件未通過驗證 | 「已接收，待驗證。資料尚未納入正式計算。」 |
| 料號／設備未對應 | 「有資料尚未對應至廠區、設備或產品，請完成對應後重新驗證。」 |
| 核對有差異 | 「生產或能源資料存在差異。請檢視期間、單位與來源紀錄，並記錄處理方式。」 |
| 單一批次結果 | 「本批次製造階段排放估算」；旁列期間、邊界、產量單位、每單位排放與估算／未分配量 |
| CFP 資料不齊 | 「目前僅涵蓋已列示階段，尚不足以產出完整產品碳足跡結果。」 |
| 來源修改 | 「來源已更新；此結果保留原版本。請建立新計算版本以納入修正。」 |

日後 UI 至少提供來源／同步紀錄、對應待辦、核對差異、產品批次結果及來源追溯；route 由 PC 與現有 navigation ontology 對齊後定稿，不在本提案另造正式導覽。

## 8. 待 PC／業務確認的事項

HMS 實際名稱與廠商文件；首家試辦廠區；MES/ERP/EMS 各欄位的權威來源；工單／批次拆併方式；儀表粒度、校正與總分表拓樸；材料單位與轉換；分攤規則；產品計算邊界與宣告單位；容差、覆核角色及資料保留期間。PC 可先用明示的合成假設完成本機流程，不等待所有廠商資料才處理無歧義工作。

## 9. 與既有文件及外部方法的關係

- [Canonical world model](../../canonical/PROJECT_WORLD_MODEL_V1.md)、[AI collaboration](../../../AI_COLLABORATION.md)：既有用詞與責任邊界。
- [Monitoring proposal](../../org-owned-monitoring-custom-factor-proposal.md)、[factor dual-axis proposal](../../cfp-p02-dual-axis-governance-proposal.md)：延伸既有活動／因子分離設計；不代表這些提案均已實作。
- [Supported report scope](../../closed-beta/SUPPORTED_REPORT_SCOPE.md)：本提案不直接變更 beta 支援聲明。
- [GHG Protocol Product Standard](https://ghgprotocol.org/sites/default/files/ghgp/standards/Product-Life-Cycle-Accounting-Reporting-Standard_041613.pdf)：活動量、因子、直接排放與資料品質需分別處理；產品盤查以明定邊界為基礎。
- [GHG Protocol Scope 3 Standard, allocation guidance](https://ghgprotocol.org/sites/default/files/standards/Corporate-Value-Chain-Accounting-Reporing-Standard-EReader_041613_0.pdf)：多產品設施可能需分配；應盡可能以更細資料減少分配帶來的不確定性。

表名、狀態碼、API 與驗收門檻均為本專案設計建議，不是上述標準的逐字規定，也不構成合規或查證通過宣告。
