# Claude 定向唯讀複審回覆：N1／N2（PR #30）與 N3（PR #31）

- 入口文件：`docs/delivery/CLAUDE_N1_N3_REVIEW_QUEUE_20261107.md` @ `a04a562ba869a2d079c3bcec1f9d45643f2b8055`。
- 受審固定程式：
  - A 節：`33d3613487f42a7e9c5888ae312441e730d3d87e`，比較起點為 `b69684d`。
  - B 節：`ed6ca9bbfbc5581cdcacf2969340575217fcb8c4`，比較基底為 `23f49ad`。
  - 兩節都沒有改用 branch HEAD。
- 審查方式：
  - 一律以 `git show`、`git diff`、`git grep` 唯讀閱讀。
  - **沒有重跑任何測試**，也沒有執行 node、npm、deno、psql 或 PostgreSQL。入口所列 358=356PASS／2NOT_RUN、backend 33、FE 227、native 15、CI success 等數字都是提交者的結果，未經本審查驗證，也不加總。
  - 沒有修改程式，沒有操作雲端、帳戶、資料庫或 Storage。
- 範圍：不重開 H0、P2-1～P2-3 或整案。N4 另見 `CLAUDE_N4_LOCK_ORDER_REVIEW_REPLY_20261108.md`。
- 本回覆不構成放行，也沒有合併、雲端套用或 Production 授權；發布維持 HOLD。

## 總覽

| 項目 | 判定 | 新發現 |
|---|---|---|
| A1 N1 MANUAL 旁支、改綁、舊 handler | 已解決 | — |
| A2 N2 判定規則一致 | 已解決 | — |
| A3 來源 witness | 已解決 | A-P3-1：高精度數值讓 witness 永遠對不上，fail closed |
| A4 N5 取消提示與重試 | 已解決（來源層面）；真實 React 前景刷新未驗 | — |
| B1 前版不可原地修改 | 已解決 | — |
| B2 有效集合 | 已解決 | F3、F4（P3） |
| B3 冪等與競爭 | 已解決（來源推論）；獨立連線競爭為 NOT_RUN | — |
| B4 來源繼承 | 繞過原件驗證：已解決。**仍存在：F1（P2）**、F2（P3，需裁定） | — |
| B5 前端恢復參考 | 已解決 | F5（P3） |

**沒有 P1。** 唯一的 P2 是 F1：correct 模式的人工更正值，在報告中顯示為由原本已確認的收據佐證，且沒有任何更正標記。

## A. PR #30：N1／N2、來源 witness、N5（固定程式 `33d3613`）

- 比較起點為 `b69684d`，其程式與 `9ebf5b1` 相同。
- 本節由主審本人逐行閱讀 `git diff b69684d 33d3613`，**未重跑測試**。

| 題目 | 判定 |
|---|---|
| A1 N1：MANUAL 文件的旁支草稿、改綁、舊 handler | **已解決** |
| A2 N2：provider token 與 JSON 標記規則一致 | **已解決** |
| A3 來源 witness（讀 100 → 改 200 → commit 舊 100） | **已解決**，附 A-P3-1（推論） |
| A4 N5：取消時的提示與重試 | **已解決**（helper 與元件來源層面）；真實 React 前景刷新仍未驗 |

### A1 N1 — 已解決

- **ordinary 角色的 INSERT 與改綁：**
  - 對應 `202611070004_manual_document_confirmation_boundary.sql:6-31`。
  - `protect_manual_draft` 改為 SECURITY DEFINER，並以 `current_setting('role')` 判斷 authenticated／anon（`:10`）。這補上前一輪 X3 的作法差異：ordinary 角色經 SECURITY DEFINER 呼叫時，仍會被辨識出來。
  - INSERT 時檢查新文件；UPDATE 時同時檢查新、舊兩份文件（`:13-18`），並禁止跨 org 或跨 project 移動（`:16`）。
  - 依序執行三步：
    1. 先呼叫 `assert_write(org,project,auth.uid())`（`:20`）。
    2. 確認文件 ID 屬於同一 org 與 project（`:23`）。猜測他人的文件 ID 不會洩漏對方是否為 MANUAL。
    3. 以 UUID 排序呼叫 `lock_document`，只要該文件任一歷史版本有 MANUAL 草稿，就回 `MANUAL_DOCUMENT_BRANCH_FORBIDDEN`（`:26-29`）。
  - 前一輪的重現路徑（REST insert 一筆非 MANUAL 旁支）在這裡就會被擋下。
- **確認端以整份文件判定：**
  - `require_confirmation_ready`（`:64-73`）依序檢查：
    - 草稿本身不是 MANUAL。
    - `assert_not_manual(文件)`，涵蓋所有歷史版本。
    - 草稿必須是 latest，狀態必須是 `pending_review` 或 `needs_clarification`。
    - 還沒有確認紀錄，也沒有任何活動指向這筆草稿。
  - 部署前就已存在的特權旁支也會在這裡被拒。
- **舊簽章 adapter：**
  - `public.confirm_draft_atomic`（`:145-157`）改成先走 `confirmation_context` 與 `assert_not_manual`，再交給 `commit_draft_confirmation`。
  - 舊 handler 不帶 `request_id` 時，在 `:59` 被拒。
  - 舊 handler 要確認（confirmed）但沒帶 `__source_snapshot` 時，在 `:117` 回 `DRAFT_CONFIRMATION_SOURCE_REQUIRED`，fail closed。
  - 舊 handler 執行 rejected 不需要 witness，也不會產生活動。這是合理的放行。
- **新 handler：**
  - `confirm-draft/index.ts:103-138`：MANUAL 判定改用共用 helper。
  - 歷史上的 MANUAL 別名不會自動升格為 canonical，回 `MANUAL_CONFIRMATION_REQUIRES_PROVENANCE`（`:106`）。
  - 非 MANUAL 的確認必須帶穩定的 `request_id`（`:121`）。
  - 依序先查舊紀錄（`:123-127`），再檢查 latest 與 pending（`:129`），再分頁讀完整份文件的歷史（`:130-138`），最後才讀 factors 與計算。
- **拒絕後資料不增加：** SQL 的 raise 會回滾整個交易。handler 的所有拒絕點都在寫入之前。
- **權限：** `confirmation_requests` 對外權限全部撤銷（`:41-42`）；三支 public RPC 只授權 service_role（`:160-161`）。
- **測試覆蓋（讀過，未重跑）：**
  - `cto-n1-n2-sql.test.js`：14 個案例，包括 PINNED N1 紅例、ordinary INSERT 與改綁、既存特權旁支、他人文件 ID 猜測、rollback 後同一 request 重試。
  - `draft-confirmation-http.test.js`：5 個案例。
  - `legacy-confirm-handler-http.test.js`：2 個案例，以凍結的 `9ebf5b1` handler 原碼驗證 fail closed。

### A2 N2 — 已解決

- **全案只剩一個判定規則：**
  - SQL 端：`protect_manual_draft`、`require_confirmation_ready`、003 的範圍保護都呼叫 `cocal_manual_private.is_manual`。
  - JS 端：`modules/document-provenance/manual.js:2-5`，由後端 `manual-source-guard.js` 與前端 `draftReview.ts` 共用。
  - 規則：provider 符合 `(^|[_-])manual([_-]|$)`，不分大小寫；或 `raw_payload` 的頂層含有 `manual_transcription`。頂層可以是物件的 key、字串陣列的成員或字串純量，與 jsonb 的 `?` 運算子語意相同。
  - 前一輪的 `^manual` 不一致（N2）已消除。
- **UI：** `ExtractedDraftReviewPage.tsx` 的四處判斷都由比對 `MANUAL_TRANSCRIPTION_NO_OCR` 改為 `isProtectedManualDraft`；`buildDraftDecision` 遇到 MANUAL 會拒絕，並指向專用入口。
- **新舊資料分開：** 只有 `extraction_provider===MANUAL_PROVIDER` 的草稿能進入 v2 確認流程；歷史別名或格式不正確的資料一律停在「須審閱」，不升格。
- **測試語料：** `manual-provenance.corpus.json` 共 17 個案例，正反例都涵蓋：
  - 後綴與連字號的 token。
  - `manuality`、`ocrmanual`、含空白等不應命中的情況。
  - 巢狀物件與陣列中的物件不算頂層標記。
  - 純量字串的大小寫。
  - `0`、`true` 等非字串值。
  - SQL 測試以同一份語料做交叉比對（`cto-n1-n2-sql.test.js`，「N2 SQL predicate…share the cross-product corpus」）。

### A3 來源 witness — 已解決，附 A-P3-1

- **流程：**
  1. handler 在任何 await 之前，以 `draftConfirmationSourceSnapshot` 擷取初讀時的草稿（`confirm-draft/index.ts:78`；`draft-confirmation-source.js:2-7`）。擷取時排除四個頂層時戳。
  2. SQL 在鎖住草稿列之後計算 `confirmation_source(d)`（`:102-103`），與傳入的 witness 比對；不一致回 `DRAFT_CONFIRMATION_SOURCE_CHANGED`（`:118`）。
- 因此「初讀 100 → ordinary 角色改成 200 → commit 舊的 100」會被拒絕。
- **witness 與 intent 分開：** `intent` 只含 `decision` 與 `overrides`，由 `:56-63` 檢查；witness 不屬於 intent，也不授予任何權限。
- **replay：**
  - `confirmation_replay`（`:74-85`）會核對：活動與計算的 ID、計算快照（排除 `is_latest` 與 `updated_at`）、草稿狀態。
  - 因此之後合法的重算只會讓 `is_latest` 改變，不影響回原 ID。
  - replay 前會重新跑 `assert_write`，已撤權的 actor 不能 replay。
- 這是合成的序列交錯，不是兩條獨立的 SQL 連線並行；`CANDIDATE_N4.json` 的 `N1_same_request_confirmation_one_original_result` 另有原生三 PID 的證據（提交者執行，未重跑）。
- **A-P3-1（P3，推論）：高精度數值會讓 witness 永遠對不上，fail closed。**
  - witness 經過 JS 的 `JSON.parse`／`JSON.stringify`，數值會轉成 IEEE-754 double。
  - `parsed_quantity numeric(20,8)` 最多 20 位有效數字，`normalized_payload` 與 `raw_payload` 內的 JSON 數字也一樣。超過約 15–17 位有效數字時，往返會失真。
  - jsonb 的數值比較是精確的 numeric 比較，所以這類草稿每次確認都會得到 `SOURCE_CHANGED`，且無法自行恢復。
  - 這屬於可用性問題，不是安全問題。
  - 修法：handler 改傳 SQL 端計算出的 witness，例如由 `draft_confirmation_request` 一併回傳 `confirmation_source(d)`；或 supabase-js 以字串讀取 numeric 欄位。

### A4 N5 — 已解決（來源層面）；真實 React 前景刷新未驗

- **取消時保留提示：**
  - `reportDownload.ts` 新增 `reportExportVisitNotice`。若進行中的 attempt 已不屬於目前的 context，就輸出「匯出已取消：…未下載檔案；請…重新按匯出」，並附上目前的 `exportBlock` 原因。
  - 同一次造訪內的提示保留；切換到不同造訪時清空，不會帶入舊報告的內容。
  - `ReportPreviewPage.tsx:84-88` 以 `activeExportAttempt` ref 與 `previousExportContext` 在 layout effect 中計算提示。
- **重試：** `finally` 同時釋放 ref 與 state 中屬於自己的 attempt（`:316`）。新的 context 下 busy 為 false，可以重新匯出。
- **授權沒有放寬：** 判斷是否下載仍由 `isCurrent()` 決定，條件包括：同一個 context、登入狀態仍有效、沒有 `exportBlock`；每次匯出都重新呼叫 `readAuthorizedReportSnapshot`。
- **界線：** 依入口要求保留：只驗了 helper 與受控刷新的契約（`reportDownload.test.ts`，讀過，未重跑）。真實 React 在前景自動刷新時是否觸發，**仍未證實**。

## B. PR #31：N3 保留前版與明確取代（固定應用程式 `ed6ca9b`）

- 比較基底為 `23f49ad`；N3 的差異不算入 A 固定版。
- 本節的分工：
  - 由一位唯讀子審查者逐題閱讀 `git diff 23f49ad ed6ca9b`，以及直接相關的既有 SQL 與讀取路徑，撰寫初稿。
  - **兩項 P2 候選（F1、F2）由主審親自在 `ed6ca9b` 上核對來源**：`202611070005_activity_replacements.sql:39-60,62-150`、`replace-emission-activity/index.ts:15`、`202611060003:22-24`、`build-report-payload.js`。
  - P3 項目與前端行號主要採用子審查者的閱讀結果，主審未逐一重核。
- **未重跑任何測試。**
- 附註：入口列出的 `ACTIVITY_REPLACEMENT_N3_DELIVERY_20261107.md` 與 `evidence/activity-replacement-20261107/` 不在 `ed6ca9b` 內，而在後續的 docs commit `a04a562`。這兩份只當作宣稱閱讀，結論一律以 `ed6ca9b` 的來源為準。

| 題目 | 判定 |
|---|---|
| B1 前版、計算、來源、報告能否被原地修改 | **已解決** |
| B2 有效集合在各讀取路徑是否一致 | **已解決**，附 F3、F4（P3） |
| B3 冪等、重送、競爭、跨租戶、rollback | **已解決**（來源推論）；兩條獨立 PG 連線的競爭為 NOT_RUN，見下方說明 |
| B4 MANUAL 與非 MANUAL 的來源繼承 | 繞過原件驗證：**已解決**。更正值冒用來源佐證：**仍存在（F1，P2）**。舊收據來源的活動仍不能排除：**仍存在（F2，P3，需裁定）** |
| B5 前端恢復參考 | **已解決**，附 F5（P3） |

### B1 前版不可原地修改 — 已解決

- **版本列保護：** `retained_activity_version` trigger（`:39-44`）擋下所有 UPDATE 與 DELETE，只要該活動是任一取代關係的前版或後繼，連表格擁有者也擋。舊的 `save_manual_activity_atomic` 對這類活動會回 `ACTIVITY_VERSION_RETAINED`。
- **計算列保護：** `retained_activity_calculation`（`:45-50`）禁止修改前版的計算列。
- **失效器只處理有效活動：** `invalidate_activity_calculations` 改成只讓有效活動的計算失效（`:52-60`）。
- **寫入順序：** 先寫取代關係，再寫後繼（`:144-147`），外鍵設為 deferrable。因此後繼的 INSERT 觸發失效器時，前版已經被視為退休，前版的計算不會被改動。
- **關係表權限：** 取代關係表對 public、anon、authenticated、service_role 全部撤銷，啟用 RLS，沒有任何 policy。
- **來源與報告：** 來源文件與草稿只被鎖定，沒有被寫入；報告與封存證明仍由 003 保護。
- **測試覆蓋（讀過，未重跑）：** `activity-replacement-sql.test.js`、`activity-replacement-http.test.js` 中「legacy in-place mutation of either version」等案例。
- **P3 觀察：** 舊 `save_manual_activity_atomic` 的重送路徑，對已被取代的前版仍回 `replayed=true` 與原本的已存列，沒有標示它已是歷史版本。這條路徑不寫資料，只是 API 直接呼叫者可能誤讀回應。

### B2 有效集合 — 已解決，附 F3、F4

**SQL 端：**

- `inputs` 與 `trusted_inputs`（`:175-207`）中的活動、計算、來源檢查都加上了 `is_effective`。
- 重算的 response 也一樣過濾（`:219-223`）。
- 報告經由 `trusted_inputs` 取資料。
- `get_emissions_analytics` 改讀有效 view（`:251-255,304-314`）。只要有納入的活動缺少已計算的結果，就回 `ANALYTICS_CALCULATION_INCOMPLETE`，edge 回 409，不會把缺件當成 0。

**前端：**

- `projectStatistics.ts`、`manualWorkflow.ts`、`activityDetail.ts`、`activityService.ts` 都改用有效 view 或版本鏈判斷。

**其他：**

- 兩個 view 都設 `security_invoker`，沿用原表的 RLS；沒有發現讀取繞過。
- 子審查者逐一 grep 過 `ed6ca9b` 的產品讀取路徑，沒有新舊版本重複計入的情況。

**F3（P3）：前版的計算永久保留 `is_latest=true`。**

- 若前版在最近一次重算之後才被取代，它的計算列會因 `:45-50` 的保護與 `:52-60` 的略過，永遠停在 `is_latest=true`。
- 任何直接讀原表、只以 `is_latest` 過濾的讀者，都會把新舊兩版一起加總。這包括一般成員經 PostgREST 讀取，或日後新增的報表。目前的產品程式沒有這樣的讀者。
- 建議：明文規定「目前值只能從有效 view 或 `trusted_inputs` 取得」，並加一條 lint 或 grep 測試，禁止產品程式直接以 `calculation_results` 加 `is_latest` 做加總。

**F4（P3）：排除的活動在明細頁標題顯示為 0。**

- 被排除的活動，其計算為 `superseded` 且 `co2e_kg=0`。`EmissionActivityDetailPage.tsx:98` 的大字標題直接顯示「0 kgCO₂e」。
- 下方雖有說明文字，最顯眼的數字仍是 0。
- 建議：遇到 `superseded` 時，標題改為「排除／不計入」，不顯示數字。

### B3 冪等、重送、競爭 — 已解決（來源推論）

- **重送綁定：** `:129-132` 比對 actor、前版、mode、trim 後的 reason、原始 input；不一致回 `ACTIVITY_REPLACEMENT_INTENT_CONFLICT`。
- **回原結果：** 重送經 `response`（`:112-121`）回原本的後繼，並以 `activity_snapshot` 核對。若後繼之後又被取代，回 `historical`，且 `is_effective=false`。
- **撤權：** 第一句就是 `require_scope`（`:127`），重送時也會重新驗證。
- **跨租戶：** 前版的查詢綁定 org 與 project（`:134-135`），不符時回 `SCOPE_DENIED`。
- **再取代歷史版：** 回 `SUPERSEDED`（`:136`）。
- **競爭：** 依序由三層把關：
  1. project 的 `for no key update`（經 `require_scope`）。
  2. 前版列的 `for update`。
  3. 最後以 `unique(predecessor_activity_id)` 兜底。
- **rollback：** SQL 測試在三個階段注入失敗，驗證全部回滾後可以用同一個 request 重試（讀過，未重跑）。
- **獨立連線競爭：** 在 `ed6ca9b` 的測試中為 NOT_RUN。後續的 `CANDIDATE_N4.json` 有一個原生三 PID 案例 `N3_competing_replacements_one_leaf_preserve_retired_calculation`，屬提交者執行，未重跑；而且它的產品版本是 `da5a099`，不是本節的 `ed6ca9b`。

### B4 來源繼承

**B4a 能否繞過原件驗證 — 已解決**

- 只要活動有來源，`require_source`（`:94-105`）一律依序要求：
  - 文件仍為 active，且不在刪除流程中（經 `lock_document`）。
  - 草稿仍是 latest 且已 confirmed。
  - 通過 `require_verified_original`。
- 呼叫者不能改綁來源：白名單（`:64`）不含來源欄位。
- **證據缺口：** 非 MANUAL 來源（OCR 確認後）的取代沒有任何測試。

**F1（P2，主審已核實）：correct 模式的人工更正值，掛在原本已確認的收據與草稿名下，報告沒有更正標記。**

- **來源：**
  - correct 模式可以修改數量、日期、類別等欄位（`:73-91`）。
  - 但後繼原封不動繼承 `source_document_id` 與 `source_draft_id`，並複製前版的 `confidence_score`（`:146-147`）。
  - 這推翻了 `202611070001:88-89` 原本的不變式：「有來源的活動只能經文件審核路徑變更」。
- **報告端：**
  - `trusted_inputs` 只檢查草稿仍是 latest 且已確認，不比對數值。
  - `build-report-payload.js` 的 `appendix_mappings` 只帶四個 ID。已 grep 確認：`ed6ca9b` 的 `build-report-payload.js` 與 `generate-report/index.ts` 都沒有任何 predecessor、replacement 或 reason 欄位；唯一的線索只有 `activity_code` 的 `REVISION-` 前綴。
- **最小重現（來源推論，未執行）：**
  1. 一份 server-verified 的 MANUAL 收據已確認為 100 kWh。
  2. editor 以 `replace-emission-activity` 的 correct 模式改成 120，並填寫理由。
  3. 重算，再產生報告。
  4. 報告的 appendix 會把 120 對應到同一份收據與已確認的草稿，看起來由該收據佐證；報告中查不到更正理由。
- **測試現況：** HTTP 測試「source-linked MANUAL correction retains original receipt/draft provenance」反而把這個繼承當成預期行為斷言。
- **最小修法（擇一）：**
  - (a) 有來源的活動，correct 必須改走新的草稿版本或審核路徑。
  - (b) 仍允許更正，但後繼的 `confidence_score` 設為 null；payload 與 `appendix_mappings` 帶上 `predecessor_activity_id`、`replacement_mode`、`reason`，並納入 `generate_report_snapshot_atomic_v2` 的 expected mapping 驗證。
- 若 CTO 認為明細頁 UI 的揭露已經足夠，可以降為 P3，但需要明文接受。

**F2（P3，需 CTO 裁定；主審已核實，並由子審查者的 P2 改評）：舊收據來源的活動仍然不能排除。**

- **來源：**
  - `:138` 不論 mode 都呼叫 `require_source`，它在 `:104` 一律要求 `require_verified_original`。
  - 既有文件的預設值是 `hash_verification_status='legacy_unverified'`（`202611060003:23`）。
  - 因此 exclude 模式對所有舊收據來源的活動都會回 `MANUAL_VERIFIED_RECEIPT_REQUIRED`。
- 加上 `save_manual_activity` 拒絕修改有來源的活動、003 的報告保留機制，這類已入報告的活動仍是「不能更正、也不能排除」。N3 原本要解決的問題，對歷史資料沒有解決。
- **錯誤碼：** edge 的正規式 `(?:ACTIVITY_REPLACEMENT|REPLACEMENT|ACTIVITY|SOURCE)_[A-Z_]+`（`replace-emission-activity/index.ts:15`）比對不到這個錯誤碼，使用者只會看到 `ACTIVITY_REPLACEMENT_FAILED`（403），看不到原因。
- **改評理由：** `:102-103` 的註解表明「不升級舊收據」是刻意設計，而且結果是 fail closed，不影響資料完整性。
- **測試現況：** 沒有任何舊收據來源的取代測試。
- **建議：**
  - exclude 模式不帶入任何新數值，可以只要求文件與草稿仍有效，不必要求原件已驗證；correct 模式維持嚴格。
  - 錯誤碼的正規式加上 `MANUAL_`，讓前端能顯示原因。

### B5 前端恢復參考 — 已解決，附 F5

- **綁定：** key 為 `…:user:org:project:predecessor:requestId`（`activityReplacementRecovery.ts:7-8`）。讀取時重新驗證並正規化 intent；已存在不同 intent 的參考時拒絕送出；送出前先持久保存並讀回確認。
- **表單與 intent 一致：** 有參考時，表單由保存的 intent 填入，相關欄位都被停用；實際送出的是保存的參考，不是表單值（`CreateActivityModal.tsx:86,155`）。有多筆參考時，必須明確選一筆。
- **損壞與過期回應：**
  - 參考損壞時可以逐筆明確放棄；只有在原始內容完全相同時才移除。
  - 每個 await 之後都檢查 `isCurrent`，並讀回後繼核對 org、project、intent；`not_found` 不視為成功。
- **F5（P3）：** 參考存在 `sessionStorage`，每個分頁各有一份。回覆遺失後若關閉分頁，request_id 就跟著消失。
  - 資料完整性仍由伺服端保證：再取代會回 `SUPERSEDED`，清單也看得到後繼。只是使用者無法以原 ID 核對結果。
  - 建議：改用 localStorage（key 綁定不變），或由伺服端提供「依 actor 加前版查詢」的唯讀 lookup。

**其他 P3（推論，主審未重核）：**

- 清單每一列歷史活動各發一次版本鏈 RPC（N+1）。
- view 對每一列都呼叫一次 SECURITY DEFINER 函式，有效能風險。
- 有效 view 內含 `status='active'` 條件，統計中的活動總數不再包含 archived 的活動，語意因此改變。
- edge 的 catch 會把讀取訂閱失敗等錯誤也歸類為 400 `INPUT_INVALID`。

## 本次實際執行的命令（全部唯讀）

**主審：**

- `git fetch origin`。
- `git diff --stat b69684d 33d3613`。
- `git show 33d3613:<path>`：涵蓋 `202611070004`、confirm-draft handler、`draft-confirmation-source.js`、`manual-source-guard.js`、`modules/document-provenance/*`、前端 diff、三個測試檔的案例名稱、core schema 的草稿欄位。
- `git show ed6ca9b:<path>`：涵蓋 `202611070005:39-150`、`replace-emission-activity/index.ts`、`202611060003:20-25`。
- `git grep`：在 `ed6ca9b` 的 `build-report-payload.js` 與 `generate-report` 中查 predecessor／replacement 欄位。

**子審查者（B 節）：** 只用 `git show`、`git diff`、`git grep`、`git log`，完整清單保留在本機審查紀錄。

## 需 CTO 裁定

1. **F1（P2）：** 有來源的 correct 要改走新的草稿或審核路徑，還是允許更正、但在報告中帶出前版、mode 與理由，並清除 `confidence_score`？若認為 UI 揭露已足夠，請明文接受並降為 P3。
2. **F2（P3）：** 舊收據來源（`legacy_unverified`）的活動，是否允許只做 exclude？目前它們仍然「不能更正、也不能排除」。
3. F3、F4、F5 與 A-P3-1 是否列為後續項目。

---

本回覆不構成放行，也不核准雲端操作、合併或 Production；發布維持 HOLD。
