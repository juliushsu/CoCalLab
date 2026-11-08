# Claude 唯讀定向複審回覆：F1／F2／N4-R1（固定產品 `0405097`）

- **入口：** [`CLAUDE_REPLACEMENT_PROVENANCE_REVIEW_20261108.md` @ `5864f4f`](https://github.com/juliushsu/CoCalLab/blob/5864f4f5cb4f9f47fffae1c33b8f0528156d3371/docs/delivery/CLAUDE_REPLACEMENT_PROVENANCE_REVIEW_20261108.md)
- **固定產品：** `040509777bb1cb60589a01ce7ec176a4ec54cee7`
- **固定工具：** `08162ca307f9336b635b77e7682de750e814a5f0`。與產品相比只改兩檔四行：`run.mjs` 的 `DRAFT_FIXED` 釘選，以及 preview 工具。
- **比較基準：** `523b502`，即 N3 `ed6ca9b` 與 N4 `da5a099` 的合併點。相容小修另以 `99c233d` 為基準。
- 全程沒有改用 branch HEAD。

## 審查方式與界線

- 本人逐行閱讀 `git diff 523b502 0405097` 的 SQL、handler、builder 與前端來源，並讀過下列測試名稱與斷言、原生紅綠證據 JSON。
- **所有測試均未重跑。** 本機 shell 沒有 node，也沒有 55439 PG17 環境，原生指令標 BLOCKED。文中所有通過數字都來自提交者或獨立代理，不是本人驗證。
- 沒有修改程式、Git（本回覆檔除外）、schema、權限或資料，也沒有連線雲端、留言、合併或部署。
- 沒有重開 H0、已關閉的 P2-1～3、N1／N2／N5 或整案稽核。
- 依入口要求，以下三項 P3 維持 OPEN，本輪不評：高精度 witness、歷史 `is_latest` 語意、effective view 使用規範。
- **此回覆不構成發布、Production 或雲端核准，發布維持 HOLD。**

## 總表

| 項目 | 判定 | 主要來源（@`0405097`） |
|---|---|---|
| F1 人工更正來源失真 | **已解決**（來源層面） | `202611080002:6-45, 64-72, 87-106, 143-171`；`build-report-payload.js:175-178, 227`；前端揭露四檔 |
| F2 legacy exclude | **已解決** | `202611080002:47-60, 64-68`；`0005:62-72, 127-138`；`replace-emission-activity/index.ts:17-21` |
| 恢復交集 | **已解決**（來源層面） | `202611080002:120-138`；handler `:14-29`；`activityReplacement.ts:47-66`；`CreateActivityModal.tsx:85-92` |
| 排除呈現交集 | **已解決**（來源層面） | `activityDetail.ts:171-174`；`EmissionActivityDetailPage.tsx:92, 101` |
| N4-R1 草稿 trigger 鎖序 | INSERT 具名排程：**已解決**（原生證據為提交者執行）；UPDATE 兩 trigger 間並行：**證據不足**（NOT_RUN，維持 CTO 界線） | `202611080003:10-27`；`draft-trigger-race.mjs:18-78` |
| 相容小修（`99c233d` → `0405097`） | **已解決**，確認只有 6 增 1 刪 | `202611080002:152-157` |

- 本輪沒有新的 P1 或 P2。
- 下方列出兩項觀察，都不是缺陷，也不阻擋。

---

## F1 — 已解決（來源層面）

### 觸發條件

- 情境：有收據來源的活動（MANUAL 或非 MANUAL）以 correct 模式由 100 改成 120，接著重算並產生新報告。
- 前一輪的問題：新版沿用原收據、草稿與 OCR 信心值，報告中看起來像由原收據佐證 120，而且沒有更正標記。

### 修正內容逐點核對

1. **寫入時清除信心值**
   - `:69-71` 以「錨點必須恰好出現一次」的方式，把 `replace_emission_activity` 插入值中的 `old_row.confidence_score` 換成 `null`。錨點出現次數不是 1 時，migration 直接失敗。
   - 來源 ID 仍然繼承，因為重算與報告需要原始映射。
   - 繼承的來源有兩層防護：第 2 點把它標為僅供歷史參考，第 3、4 點強制報告揭露。
2. **伺服器端權威 provenance**
   - `cocal_activity_private.provenance()`（`:6-37`）從目前活動沿 private ledger 往前回溯。每一步都會核對以下四點：
     - 前版與後繼都在同一 org 與 project 內（`:17-19`）。
     - 後繼列的現值與當時保存的 `activity_snapshot` 投影完全相等（`:22-23`）。後繼列受 `retained_activity_version` 保護，不能修改，所以正常情況下一定相等；不相等就 fail closed。
     - 來源 ID 確實是繼承而來（`:23-24`）。
     - 不形成循環，深度上限為 10000（`:16`）。
   - `changes` 由「前版現列」與「後繼保存快照」逐欄比對產生（`:25-26`），不採用呼叫端宣稱的差異。
   - 每一步保存模式、理由、actor 與時間（`:27-28`）。
   - 回傳物件固定帶 `source_usage:'historical_reference_only'`，以及根收據的驗證狀態（`:32-36`）。
3. **進入可信輸入**
   - 重算輸入 `inputs_v1`（`:89-101`）的每筆活動都帶 `replacement_provenance`。
   - `trusted_inputs` 改用 `projected_activity`（`:38-45, 102-106`），讓報告來源中有 provenance 的活動，信心值一律投影為 null。這也涵蓋 migration 之前就已建立的後繼列，而且不改寫已保存的列（`:42-43`）。
4. **報告發布端核對**
   - 公開的 `generate_report_snapshot_atomic_v2` 改為包裝函式（`:140-171`），原函式移入 private schema，並撤銷所有角色的權限（`:140-142`）。
   - 新請求在交給原 publisher 之前，必須依序通過四項檢查：
     1. 映射 ID 多重集合與可信輸入相同（`:154-157`）。
     2. 有更正時必須帶版本 `20261108.replacement.1`（`:160`）。
     3. 每筆 `appendix_mappings` 的 `replacement_provenance` 與伺服器計算結果完全相等；遺漏的值以 JSON null 比對，所以漏列也會被抓到（`:161-163`）。
     4. `correction_disclosures` 與伺服器計算出的清單完全相等（`:164-167`）。
   - 理由、actor、時間、模式、差異、祖先順序或漏列，任何一項被偽造，都會得到 `REPORT_REPLACEMENT_PROVENANCE_MISMATCH`。
5. **包裝函式沒有加鎖，但沒有 TOCTOU**
   - 包裝函式在未加鎖的情況下讀 `trusted_inputs`；原 publisher 會先取 share lock，再重讀 `trusted_inputs`，並核對 calculation authority（`202611070001:156-160`）。
   - provenance 屬於 `inputs_v1`，因此也屬於 authority 的 `input_snapshot`。兩次讀取都必須等於同一份 authority 快照，否則回 `CALCULATION_AUTHORITY_STALE`。
   - 所以兩次讀取之間 provenance 若有變化，請求一定 fail closed，不會發布不一致的揭露。
6. **舊報告不回填、不補簽**
   - 已存在的 request_id 會直接略過新檢查（`:150`），由原 publisher 回傳原快照（`202611060006:97-101`）。
   - 前端 `savedReplacementDisclosure` 只讀保存的 payload。沒有版本欄位時，明示「不以目前活動或版本鏈回填，也不能推定沒有人工更正」（`replacementDisclosure.ts:13-15`）。
7. **報告與畫面呈現**
   - Builder 在 payload 頂層與每筆映射附上揭露（`build-report-payload.js:175-178, 227`）。
   - `ReportOutlinePanel` 顯示保存的揭露。
   - HTML 匯出新增「保存的人工更正／排除揭露」段落，所有欄位都經過 `escapeReportHtml`（`reportExport.ts:59, 68`）；JSON 匯出附 `replacement_disclosure`（`:52`）。
   - 文案明示「原收據僅歷史來源，不佐證更正值」。
   - 活動明細頁的後繼版本會顯示同樣的提示與揭露面板（`EmissionActivityDetailPage.tsx:85`）。
   - 前端 read model 也把信心值投影為 null（`activityReplacement.ts:45`）。
   - 明細頁不顯示 `confidence_score` 欄位（已 grep 確認）。

### 讀過的測試（未重跑）

- `replacement-provenance-sql.test.js` 共 13 個案例，包括：
  - F1 清除信心值與完整 provenance。
  - verified MANUAL 100→120 只產生 120 的新報告，舊活動、計算、報告與 proof 全部不變。
  - 兩步 lineage，以及兩個 payload 位置的偽造拒絕。
  - migration 只做投影、不改寫歷史。
  - 未帶版本的舊 builder 與四 ID 映射仍相容。
- `replacement-provenance-http.test.js` 有 3 個案例，前端 `replacementDisclosure.test.ts` 有 3 個案例。

### 觀察 R6-O1（不是缺陷；交付文件已揭露）

- 每筆活動新增 `replacement_provenance` 鍵（沒有更正時為 null），因此所有既有專案的 calculation authority 在部署後都會變成 STALE，必須先重算，才能產生新報告。
- 這與 `REPLACEMENT_PROVENANCE_FIX_DELIVERY_20261108.md:70` 的說明一致。部署時程與溝通需要納入這點。

### 觀察 R6-O2（不是缺陷）

- `receipt_verification_status` 取的是產生報告當下的收據狀態，不是更正當時的狀態（`:33`）。
- 這個值會封存在新報告中；之後若狀態改變，authority 會變成 STALE，需要重算。
- 建議 UI 文案把它理解為「報告產生時的原收據狀態」。

---

## F2 — 已解決

### 觸發條件

- 情境：活動的原收據是 `legacy_unverified`，使用者要排除這筆活動。
- 前一輪的問題：exclude 也要求伺服器驗證原件，所以永遠失敗，而且錯誤碼被遮蔽，使用者看不到原因。

### 核對結果

- **`require_source` 依模式分流**（`202611080002:47-60`），以「錨點必須恰好出現一次」的方式替換呼叫點（`:64-68`）。
  - 模式不合法時回 `INTENT_INVALID`（`:51`）。
  - 沒有來源的活動直接返回（`:52`）。
  - 只有一側來源時拒絕（`:53`）。
  - 有來源時，兩種模式都必須先通過 `lock_document`（`:54`），代表 project → 刪除 fence → manual → 文件列依序上鎖，而且文件必須是 active、未進入刪除流程。
  - 草稿也必須是同一份文件的 latest，且狀態為 confirmed（`:55`）。
  - **只有 correct 模式**另外要求 `require_verified_original`（`:59`）。
- **排除時數值保持原樣**
  - exclude 模式要求 input 為空（`0005:69`），回傳原值，只改 `inclusion_status`、`exclusion_reason` 與 `status`（`0005:71`）。
  - `normalized_quantity` 也沿用原值（`0005:147`）。
- **其他控制仍然有效**
  - actor、tenant 與角色：`require_scope`（`0005:127`）。
  - 訂閱：handler 的 `enforce_subscription_readonly` 在呼叫 RPC 之前執行。
  - 已被取代或衝突：`for update`、`is_effective` 與 `predecessor_activity_id unique`（`0005:7, 134-136`）。
  - 同一 request 改寫內容：`INTENT_CONFLICT`（`0005:131`）。
- **不會把 legacy 升格**：本 migration 沒有任何寫入 `uploaded_documents` 的語句。provenance 照實帶出 `receipt_verification_status:'legacy_unverified'`。
- **錯誤碼不再被遮蔽**：handler 的錯誤碼 regex 已加入 `MANUAL_` 與 `verification_`，並附中文說明（`index.ts:18-21`）。correct 模式遇到 legacy 時，會回 `MANUAL_VERIFIED_RECEIPT_REQUIRED` 與「舊未驗證來源僅可在合法範圍內排除，不會自動升格」。
- **讀過的測試（未重跑）**：
  - SQL：「F2 legacy original may be excluded unchanged but cannot be corrected or upgraded」、「legacy exclude … survives real recalculation and report; correct still fails」、「exclude still enforces current actor subscription scope empty intent and an active exact confirmed latest source」。
  - HTTP 對應案例 1 個。

---

## 恢復交集 — 已解決（來源層面）

- **觸發條件**：送出取代請求後回應遺失，使用者關閉分頁，sessionStorage 清空，之後重新開啟。
- **SQL**：`recover_activity_replacement`（`202611080002:120-138`）。
  - 先執行 `require_scope`，已撤權的 actor 會立即被拒（`:124`）。
  - 前版必須屬於同一 tenant（`:125-126`）。
  - 只有 `q.actor_user_id = 呼叫者` 時，才回傳原 request、reason、input 與 canonical_input（`:129-130`）；回傳內容經 `response` 再核對快照（`:74-85`）。
  - 其他 actor 只會得到 `superseded`，所有意圖欄位都是 null（`:132-137`）。
  - 執行權限只授予 service_role（`:176`）。
- **Handler**：
  - recover 的 DTO 只接受 scope、predecessor 與 action 四個鍵（`activity-replacement.js:5-10`），不信任呼叫端帶來的 actor 或 request。
  - actor 來自 JWT。
  - `superseded` 或 `not_found` 時，若夾帶任何意圖欄位就判為 `UNCONFIRMED`（`index.ts:25-28`）。
- **前端**：
  - `recoverReplacementOperation`（`activityReplacement.ts:47-66`）取得恢復的 reference 後，會以原 request_id 再做一次 lookup 核對，不產生新 ID。
  - `retainRecoveredReplacementReference` 不會覆寫本機同 ID 但內容不同的參考（`activityReplacementRecovery.ts:22-29`）。
  - 只有在 `recovered.status === 'not_found'` 且目前版本有效時，才允許建立新請求（`CreateActivityModal.tsx:92`）。
- **不會重複**：即使兩個分頁同時判定為 not_found，`predecessor_activity_id unique` 搭配 `for update`，也只會有一筆取代成功。
- **讀過的測試（未重跑）**：SQL 2 個案例、HTTP 1 個案例、前端 `activityReplacement.test.ts` 2 個案例（「empty session journal recovers…」、「server recovery failure, stale context, foreign scope and leaked other-actor intent never authorize a fresh request」）。
- 真實瀏覽器關閉分頁後的行為，只有提交者的截圖與 DOM（`tab-reopened-recovery*`），本人未驗。

## 排除呈現交集 — 已解決（來源層面）

- `formatActivityEmissions(kg, inclusionStatus, calculationStatus)`：遇到 excluded 時回「已排除／不計入」，不顯示 0（`activityDetail.ts:171-174`）。明細頁標題處已改用這個函式（`EmissionActivityDetailPage.tsx:101`）。
- 「原始數量與單位」仍然顯示 120（`:92`）。
- 歷史版本改顯示保存的歷史計算，並標註「不計目前統計」，保留原有行為。
- 「included 且真實為 0」的情況仍顯示 0；`replacementDisclosure.test.ts` 有對應案例（讀過，未重跑）。
- 另外確認：`calculation_status` 的 `superseded` 分支在目前 SQL 中沒有任何地方會寫入，不會被誤判為排除。

---

## N4-R1 — INSERT 具名排程已解決；UPDATE 兩 trigger 間並行證據不足（NOT_RUN）

### 觸發條件

- 情境：editor 以 ordinary 角色經 REST 新增或修改草稿，同時另一方對同一文件發起刪除。
- 前一輪的問題：
  - 草稿這邊的 `deletion_draft_reference` 先取刪除 advisory 鎖，`protect_manual_draft` 才鎖 project。
  - 刪除這邊是先鎖 project，再取 advisory。
  - 兩邊順序相反，可能形成 40P01 死鎖。

### 來源核對

- **觸發器順序**：新增的 `a_draft_project_lock`（`202611080003:26-27`）因名稱排序，會在 `deletion_draft_reference`、`protect_manual_draft`、`report_retain_draft` 之前執行。
- **角色範圍與權限**：與 `protect_manual_draft` 相同，只針對 authenticated／anon（`:13`）。
  - 禁止跨 org 或跨 project 改綁（`:14-16`）。
  - 先 `assert_write`，再以 `for no key update` 鎖 project（`:17-19`），順序與 `lock_document` 相同。
  - 現有 trigger 一個都沒有移除，權限檢查仍以原本的 trigger 為準（`:2, 24-25`）。
- **鎖升級不會死鎖**：`assert_write` 先取 `for key share`，之後才升級為 `for no key update`。全 repo 沒有任何地方對 projects 取 `for update`（已 grep），而 key share 只與 for update 衝突，所以升級不會造成 key-share ↔ update 死鎖。
- **project 鎖負責序列化**：所有競爭路徑都會先取 project 的 `for no key update`，包括刪除請求、finalize、release、`lock_document` 與 `retain_source`。
  - 因此草稿寫入一旦先持有 project 鎖，之後取 advisory 的順序就不影響是否形成環。
  - 包括 UPDATE 改綁時「先取新文件 advisory，再依 UUID 順序鎖舊文件」的情況。
- **DELETE 路徑**：`a_` trigger 不處理 DELETE。DELETE 時第一個取鎖的是 `protect_manual_draft → lock_document`，先鎖 project，所以順序本來就正確。
- **特權角色路徑**：`a_` trigger 不處理特權角色。
  - 應用程式用到的特權寫草稿路徑（classify、process、confirm 的 wrapper）會先呼叫 `lock_document`（`202611070002:28-34` 等），也就是先鎖 project。
  - 任意的 service_role 直接 UPDATE 不在本輪範圍內，屬於 CTO 保留的「其他並行組合」。
  - `emission_activities` 與 `report_generations` 的 reference trigger 本輪同樣未審。

### 工具與證據核對（讀 JSON，未重跑）

- **barrier 位置**：先斷言 trigger 順序為 `deletion_draft_reference < n4_r1_between_draft_triggers < protect_manual_draft`；修復版另外斷言 `a_draft_project_lock` 排最前面（`draft-trigger-race.mjs:21-24`）。
- **紅例**（`da5`）：
  - 觀察端放開 barrier 之後，才開始輪詢兩方互相阻擋的自然環。
  - 每次讀取前都會呼叫 `pg_stat_clear_snapshot()`，並斷言 `observerNotInCycle`（`:33-38`）。
  - 證據中 victim 為 `delete_prepare`，錯誤碼 40P01；winner 為 ordinary_draft。兩條連線的狀態都是 active／Lock（`native-red-da5.json:260-295`）。
- **綠例**（`0405097`）：
  - B 的等待事件是 `transactionid`，代表在等 A 持有的 project 列鎖，而不是 advisory（`:29-30`）。
  - A 提交之後，B 得到 `DOCUMENT_HAS_REFERENCES`，不是 40P01（`:46`）。
  - 另有三個案例：rollback 後原刪除 request_id 可以恢復且 fence 保留；外部 actor、viewer、readonly 訂閱都被拒且資料列不變；合法 UPDATE 可以執行、改綁被拒。
  - 證據顯示四個具名案例 PASS，三筆 Lock 觀察的狀態都是 active。7 筆 ERROR 都是預期的負例（`DOCUMENT_HAS_REFERENCES`、`DOCUMENT_DELETION_FENCED`、`verification_actor_denied`）。
- **前輪證據註記已處理**：`waitLock` 已加上 `pg_stat_clear_snapshot()`（`run.mjs`）。上一輪「等鎖中的連線被記成 idle」的瑕疵，本輪證據中已不再出現。
- **界線（同意 CTO 保留）**：
  - UPDATE 在兩個 trigger 之間並行，工具本身也標為 `NOT_RUN`（`:78`）。從來源看，UPDATE 走的是同一組 trigger 順序，但沒有原生執行證據，所以判定為證據不足。
  - 其他並行組合未驗。
  - 不能據此全域關閉 N4。

---

## 相容小修 — 已解決

- `git diff 99c233d 0405097 -- backend/supabase` 只有 `202611080002` 的 **+6／−1**（`:152-157`）。
- 內容是把 `appendix_mappings` 的陣列型別檢查移到最前面，並加上映射 ID 多重集合的比對；排序後的陣列能保留重複與漏列。
- 這樣舊的 `REPORT_SOURCE_MAPPING_MISMATCH` 錯誤碼會先於 provenance 檢查回傳。
- 後續的版本檢查與 provenance 比對都沒有放寬。
- 同一區間內沒有任何測試檔變更，所以原本兩個負例沒有被刪改。

## 未驗範圍（不是來源漏洞，也不構成發布通過）

- 本人未重跑任何 SQL、HTTP、前端或原生 PG 測試。
- 下列項目本輪都沒有執行：
  - managed JWT、Storage bytes、Edge runtime。
  - 雲端 migration。
  - 現版完整備份與還原。
  - 代表使用者驗收。
  - 原生瀏覽器下載實際落盤。
  - 真實 React 前景刷新。
- PGlite 使用的是合成的 Auth／Storage catalog。
- N4 只有具名排程通過；UPDATE 兩 trigger 間的並行與其他組合仍然 NOT_RUN。
- `NEXT_ACTION` 中「Owner 已選 Micro／US$20／14 天」的敘述，本審查不核對、也不依賴。該紀錄的更正由 Codex 依 CTO 裁定處理。

## 請 CTO 裁定

1. F1、F2、N4-R1（INSERT 具名排程）與兩個交集在來源層面都已解決，是否據此關閉對應的阻擋項？
2. 部署計畫是否納入 R6-O1：所有既有專案部署後都必須重算，才能產生新報告。
3. N4 的 UPDATE 並行與其他組合，是否排入真 UAT 剩餘清單。
