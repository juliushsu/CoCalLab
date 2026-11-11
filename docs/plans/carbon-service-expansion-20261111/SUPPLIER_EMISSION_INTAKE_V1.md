# 供應商排放聲明接收 V1

狀態：設計契約候選；實體 schema／API 名稱由 E0 核對後凍結。
上位決策：[結論與來源](README.md)。工程順序：[計畫](ENGINEERING_PLAN.md)。
目標：企業不需等待供應商加入 CoCalLab，即可上傳交易排放明細、審核並有依據地納入報告。

## 1. 第一版流程與非目標

選定 workspace／法人／專案 → 上傳附件或手動輸入 → 確認數值是交易總量或強度 → 核對來源與邊界 → 接收者審核 → 明確採用 → 重算／產生新版報告。
供應商無須平台帳號；第一版沒有跨租戶查詢、公開 QR 查證入口、自動網路抓取、外部 OCR 或自動接受供應商數字。
保留既有附件上傳、服務端收件與審核元件，但必須經 E0 證明可沿用，不能只因畫面相似就跳過控制。

## 2. 四種資料角色

| 角色 | 例子 | 處理規則 |
| --- | --- | --- |
| 活動量 | 100 人公里、2 房晚 | 可乘相容單位與邊界的係數 |
| 排放強度／係數 | kgCO2e／人公里 | 必須有功能單位、版本、涵蓋期間與適用範圍；不是交易總量 |
| 供應商排放聲明 | 本交易 12.5 kgCO2e | 驗證、單位正規化與採用；不再乘係數，不標成自家直接量測 |
| 自家直接監測排放 | 已受治理的監測資料 | 維持既有獨立模型；不可借此路徑繞過供應商聲明審查 |

直接歸屬是把已計算排放對應至交易，不等於直接量測。供應商亦可能提供估算或分攤結果。
供應商原始聲明與接收者採用紀錄分開，原始聲明不因企業審核、重分類或單位轉換而被覆寫。

## 3. 最小邏輯契約

下列欄位為語意設計，非宣稱已存在的資料表。沿用 organizations.id 的 workspace 意義，不重命名既有表。

| 區塊 | 必需語意 |
| --- | --- |
| 接收範圍 | recipient_workspace_id、project_id、接收法人／報告邊界；服務端驗證彼此 scope |
| 外部簽發者 | supplier_identity、原始名稱、識別依據；沒有平台帳號時不填造假的 tenant FK |
| 原交易 | transaction_reference、line_reference（若有）、service_period、服務種類與原始描述 |
| 原數值 | value_kind = total_emissions 或 emission_intensity；原始 decimal 字串、unit、gas_basis；CO2 與 CO2e 不得混同 |
| 正規化 | total_emissions 的 normalized_co2e_kg、換算版本；僅確認為 CO2e 才進總量路徑 |
| 活動與強度 | 強度分母／功能單位、activity_quantity／unit（若適用）；缺必要活動量留待補，不偽造 quantity=1 |
| 方法與邊界 | methodology_reference／version、boundary_description、included_components、excluded_components、係數參考期；未知明示 unknown |
| 品質與查證 | measured／allocated／estimated／mixed／unknown、供應商聲明的查證狀態、證據核對狀態各自獨立；不自動推導 primary |
| 證據 | document／可信上傳收件引用、內容 hash、擷取頁碼或區段、輸入／擷取來源；hash 僅證明內容識別 |
| 版本 | 本地 immutable revision、供應商版本（如有）、supersedes 關聯、更正／作廢依據、actor／time／reason |
| 採用 | reporting_boundary、Scope／category、採用或排除理由、reviewer、policy_version、原始聲明版本、適用排放組成 |
| 重送 | request_id、標準化完整請求內容 hash、操作結果可查詢；同 ID 同內容回既有結果，同 ID 異內容拒絕 |

沒有可靠供應商交易編號時，仍可收件為待審；以內容 hash、日期、金額／行程等可用線索提示疑似重複，不將附件 hash 當唯一業務識別。
資料庫 numeric 的精度、上限、捨入位置由 E0 按既有契約固定。保留原值；不得使用浮點誤差造成雙重換算或無法重現。
未知不是零；零需有明確聲明及可審查來源。V1 不接受用負排放抵銷一般服務排放；退款／更正透過版本與採用狀態處理。

## 4. 狀態與認列

- 接收審核：draft → pending_review → accepted 或 rejected；accepted 表示接收者審核，不表示第三方 verified。
- 來源版本：current、superseded、voided（僅依可追溯來源更正／作廢證據）；接收者自行不採用則寫 adoption exclusion，不冒稱供應商作廢。
- 採用狀態：pending、included、excluded；included 需具足夠邊界資訊、相容用途及操作者權限。未知邊界可保存，不能自動正式認列。
- 原始總量若與企業所需邊界不同，保存原值並另建可追溯調整／衍生紀錄；不得無證拆分整體生命週期排放。
- 發現更正／作廢時標示受影響活動與報告。舊報告保持原 snapshot；新報告須完成明確處置及重算，不得默默沿用已知無效結果。

供應商 Scope 1／2 不直接複製為接收者 Scope。來源聲明是一份證據，企業的分類、採用與報告是另外的決策。

## 5. 計算與報告接入

邏輯上新增 supplier_declared 結果路徑（名稱待 E0 固定）。該路徑驗證原聲明、採用範圍與單位，保存結果及 input snapshot；不呼叫一般 factor resolver 重新換算，不建立假係數，不將 factor_snapshot 填造假內容。
既有 factor-based 路徑保持相容。結果 schema／SQL guard／可信結果 ledger／服務端報告快照／前端匯出必須同步支援並版本化，不能只改單一 JS 函式。

本輪已讀候選 e4562ed8cb404df6db97a870922ce561b6d4025f：
- backend/src/services/calculate-emission-activity.js：目前一般路徑先 normalizeUnit，再 resolve_emission_factor，再 quantity × factor；因此供應商總量不是已支援能力。
- backend/src/services/build-report-payload.js：included 活動要求一份有效 latest calculated 結果；來源清單依 factor_snapshot.factor_id 收集。新增聲明來源揭露不可只塞入現有 factor 清單，也不可移除完整性檢查。
- activity replacement、重算 ledger、收件與 SQL guard 的完整接入仍由 E0 核對，以上只是具名來源觀察，不是全系統審查結論。

新報告須分別揭露 factor_sources_used 與供應商聲明來源，包含原值／正規化值、邊界、版本、採用理由、調整、資料缺口與查證語意。前端、HTML、JSON 與統計採用相同語意。

## 6. 防重複與原子性

唯一採用的範圍是「接收者盤查邊界＋同一經濟活動／排放組成＋期間」，不是跨全球禁止同一供應鏈排放出現在不同企業盤查。
同一活動的供應商結果與本機估算可保存比較，但在相同邊界與組成只能有一個有效採用結果。
若需部分採用，必須明示不重疊組成與分拆依據；V1 無法證明不重疊時不允許混加。
同一交易由信用卡、報帳、供應商文件多次進入時，能人工關聯／處置疑似重複；不同合法行項不得被粗糙交易 key 誤合併。
採用／取代／排除與有效結果切換必須在受控交易內完成。資料庫唯一性與鎖順序由 E0 對齊既有 project／document 控制；需測兩連線並發，不能只測單一客戶端。

## 7. 權限與更正

- workspace、project、document、結果與報告的關聯由服務端驗證；使用者輸入的 supplier identity 不授予權限。
- 組織切換、權限撤銷與過期 session 不得提交舊範圍結果。
- 不讓前端直接將資料標成 accepted／verified 或寫入可信計算結果。
- 不覆寫歷史附件、來源值、計算或報告；新版本引用前版。
- 第一版不自動輪詢外部作廢，也不聲稱能得知尚未收到的供應商更正。由使用者匯入更正文件；未來交換階段另設通知與版本確認。

## 8. 合成驗收樣例

以下只作測試，不代表真實高鐵／飯店係數：
- 聲明 A：12.5 kgCO2e，採用結果 12.5 kg；可存在本機估算 15 kg，但同一組成總計只採一份。
- 同聲明 0.0125 tCO2e 正規化為 12.5 kg，單位只換一次。
- 強度 B：0.05 kgCO2e／人公里，活動量 100 人公里，得到 5 kg；缺里程時保持 pending。
- A 更正為 13 kg：舊報告仍 12.5；明確採用新版並重算後，新報告為 13，兩版鏈完整。
- 缺單位／僅 CO2／未知邊界：可待補，不得自動當作完整 CO2e 採用。
