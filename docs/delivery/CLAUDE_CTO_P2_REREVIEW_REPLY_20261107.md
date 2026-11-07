# Claude 定向唯讀複審回覆：CTO 四項 P2 修復（PR #30）

- 入口文件：`docs/delivery/CLAUDE_CTO_P2_REVIEW_START_HERE_20261107.md` @ `8e1567fbba0f01b7ab488b32d513c761bf122855`。
- **受審固定程式：`9ebf5b13427edf8d228659a24269ddaaf86a84f0`**（下稱 `9ebf5b1`）。對照基準為 `ba2c7a5`，以及前一輪的回覆 @ `507a94e`。
- 審查方式：
  - 一律以 `git show`、`git diff ba2c7a5 9ebf5b1`、`git grep` 唯讀閱讀固定 SHA，沒有改用 branch HEAD，也沒有重開 H0 或整案。
  - **所有測試都未重跑**。入口所列「原生 15/15」「整合 337 tests = 335 PASS / 0 FAIL / 2 NOT_RUN」都是提交者的數字，未經本審查驗證；文中的測試覆蓋只是「讀過測試碼」，不等於執行過。
  - 沒有修改程式、Git、schema 或資料，沒有操作雲端，也沒有讀取憑證或正式資料。
  - 本輪由主審一人逐行核對來源，沒有使用子審查者。
- 下文所有判定都是**來源推論**。凡標示「最小重現」的地方，都只是依來源推導的步驟，並未實際執行。
- 本回覆不構成 Production、雲端操作、合併或商用放行；發布維持 HOLD。

## 總覽

| ID | 判定 | 摘要 |
|---|---|---|
| P2-1 偽造計算結果被封存 | **已解決**（ordinary REST／SQL 路徑） | 活動與計算兩張表已改為只能由伺服器寫入；活動一有變更，計算就失效；報告必須對上最新 ledger 與來源新鮮度。殘留邊界見文末「已知邊界」 |
| P2-2 舊重算／舊報告 RPC | **已解決** | 舊 RPC 已撤銷對外 EXECUTE，新流程改由函式擁有者在內部呼叫；舊 handler 會 fail closed |
| P2-3 classify 改回 MANUAL | **已解決** | SQL wrapper 會拒絕任何狀態的 MANUAL 草稿；JS helper 與 SQL 的判定語意一致 |
| P2-4 process 取消 MANUAL latest | **主路徑已解決；「另建活動」仍存在（新 P2，N1）** | process／begin／finish 與 MANUAL create 已在交易內雙向互斥。但 editor 可經 REST 對 MANUAL 文件插入一筆非 MANUAL 的旁支草稿，再透過舊 confirm-draft 另建第二筆活動 |

新發現：

- N1 為 P2，屬於 P2-4 的殘留。
- N2–N5 為 P3，其中 N3 需 CTO 裁定，N4、N5 屬推論。
- 沒有 P1。

---

## P2-1：ordinary REST／SQL 能否偽造或改寫活動與計算，進而產生可信報告 — **已解決**

**來源（`9ebf5b1`）：**

- **直接寫入被封鎖。** `202611070001_calculation_source_authority.sql`：
  - `:33-40`：`server_write_only` trigger 要求 `current_user` 等於表格擁有者。因此 authenticated、anon，以及經 PostgREST 的 service_role 直接 insert／update／delete `emission_activities` 或 `calculation_results` 都會回 `42501`。
  - `:41-46`：另有 restrictive 的 insert／update／delete deny policy，與 core schema 的 `for all` permissive policy（`202603160001:618-632`）以 AND 方式疊加。
  - 結論：前一輪 X1／R-P2b／M-3「editor 直接改寫」的根因已封住。
- **受控編輯。** `save_manual_activity_atomic`（`:56-99`）：
  - 第一步呼叫 `require_scope`（`202611060004:19-33`）。這一步檢查 project 屬於該 org、org 為 active、actor 為 owner/admin/editor 且為 active 成員、訂閱可寫，並鎖定 project 列。
  - actor 由 handler 的 `requireOrganizationWriteAccess` 從 JWT 取得（`save-manual-activity/index.ts:12`），不由 client 指定。
  - 欄位白名單與型別檢查在 `:59-85`。
  - 不能修改來自文件的活動：`:89` 回 `ACTIVITY_SOURCE_RETAINED`。
  - 跨 org 或跨 project 的 activity_id 會被拒（`:87`）。
  - 重送綁定 request、actor、input 與已存列（`:66-72`、`:96`）；input 不同時回 `ACTIVITY_REQUEST_INTENT_CONFLICT`，已存列被改過時回 `ACTIVITY_REQUEST_RESULT_CHANGED`。
- **舊計算失效。**
  - `:48-54`：after trigger 在任何活動 insert、update、delete 後，把該 project 所有 latest 計算設為 `is_latest=false`。
  - 這條 trigger 也涵蓋舊版 SECURITY DEFINER 的 confirm 路徑，因為它是 row trigger，不看呼叫者身分。
- **報告的權威來源。** `trusted_inputs`（`:110-125`）依序檢查：
  - 必須存在已完成的 ledger request。
  - `input_matches_current` 與 `results_are_latest`。
  - 目前 latest 計算必須與 ledger 的 `result_snapshot` 完全相同（`:120`）。
  - 每個 active 活動的來源文件必須仍為 active，來源草稿必須仍為 latest 且已 confirmed（`:121-123`）。
  - 另外，`inputs`（`:103-107`）把來源文件與草稿整列納入比對，所以只改草稿或收件、不改數量，也會讓 ledger 失效。
- **報告封存。** `generate_report_snapshot_atomic_v2`（`:150-172`）：
  - 先鎖 activities 與 factors（`:157`），重新取得 `trusted_inputs`。
  - 比對 `calculation_authority`（`:159`），並比對 `appendix_mappings` 的四個 ID 集合（`:160-163`）。
  - handler 不再讀可寫的 public 表，而是改呼叫 `report_calculation_inputs`（`generate-report/index.ts:121-127`）。
- 確認過的旁支：
  - confirm-draft handler 第 94 行只讀 `calculation_results`，沒有寫入；第 82 行讀 factors，也沒有寫入。
  - 舊 confirm 路徑寫入的計算列（`202603160011:109-120`）不會被當成權威：它們不在 ledger 的 `result_snapshot` 內，報告前必須先重算。

**觸發條件與反例：**

- editor 以 REST `PATCH /calculation_results`：trigger 加 restrictive policy 回 `42501`。
- editor 經受控 RPC 編輯活動：舊計算失效，報告回 `CALCULATION_AUTHORITY_STALE`；必須重算後才可產生報告。
- 測試碼覆蓋（讀過，未重跑）：`cto-p2-source-authority-sql.test.js` 的 P2-1 反例與正例、`controlled-manual-report.test.js` 的 SDK／HTTP 鏈（未授權報告被拒、編輯後失效、可信報告 60 kg）。

**未驗：**

- 真實 PostgREST 底下的 `current_user` 與 role 設定。
- service_role 在 Supabase 雲端是否具 BYPASSRLS。這不影響結論，因為 trigger 不看 RLS。
- 兩條獨立連線的並行測試。

## P2-2：舊重算／舊報告 RPC 的對外 EXECUTE — **已解決**

**來源：**

- 舊 RPC 撤銷授權：`202611070001:5-7` 對舊的 `recalculate_project_atomic` 與 v1 `generate_report_atomic` 撤銷 public、anon、authenticated、service_role 的權限。
- 舊實作移到私有 schema：`:11` 把舊實作移到 `cocal_recalc_private`。
  - `:12-21` 在原名建立 owner-only 的 wrapper，`:22` 再次撤銷對外權限。
  - `:174` 撤銷私有 schema 內所有函式的權限。
- 呼叫鏈：
  - `commit_recalculation_v2` 以完整名稱呼叫 `public.recalculate_project_atomic`（`202611060004:139`）。它本身是 SECURITY DEFINER，以函式擁有者身分執行，所以呼叫 wrapper 再進入私有實作時，不需要 service_role 的授權。
  - 空 project 時，`p_calculation_results='[]'`，`:17-19` 的 update 不影響任何列。
- 舊 handler 的行為：
  - 舊重算 handler 直接 RPC 舊名，會得到 permission denied（fail closed）。
  - 舊 generate-report（`ba2c7a5` 版）會呼叫同簽章的 v2，但不帶 `calculation_authority`，所以在 `:159` 得到 `REPORT_CALCULATION_AUTHORITY_MISMATCH`。
  - 若仍呼叫 v1，則回 permission denied。
  - 兩種情況都不會繞過 ledger。
- 已確認：`9ebf5b1` 的 Edge Functions 沒有任何一處直接 RPC 舊重算或 v1 報告函式（grep 結果只剩 classify 與 confirm 的 wrapper）。

**部署後果（不是缺陷，請知悉）：**

- `inputs` 改名為 `inputs_v1`，新版另加 `sources`（`:102-107`）。部署前已完成的 ledger request，其輸入快照是舊格式，因此**所有既有 project 都必須先重算一次才能產生報告**。
- 部署當下仍在進行中、尚未 commit 的重算 request，會在 commit 時因輸入不符而失敗。
- 這兩點與上一輪 CTO 裁定第 1 項（既有報告不可匯出）同屬 fail closed，建議寫進部署說明。

**測試覆蓋：** 讀過新 SQL 的 P2-2 段落，以及 `recalculation-idempotency-http.test.js` 的差異，未重跑。

**未驗：** 雲端實際的 ACL；混合部署（新 migration 搭配舊 handler）只有來源推論。

## P2-3：classify 能否改動 MANUAL 草稿的歷史 status／review_note — **已解決**

**來源：**

- **SQL wrapper。** `202611070002_manual_processing_fences.sql:29-39`：
  - 先鎖文件（`lock_document`，`:5-14`）。
  - 再以 `for update` 讀取目標草稿。
  - 只要 `is_manual`（`:4`）為真就回 `MANUAL_CLASSIFICATION_FORBIDDEN`，不論 status 或 latest。
  - 舊實作已移到私有 schema（`:28`），對外權限已撤銷（`:121`）。
- **判定語意一致。** `is_manual` 有兩個條件：
  - provider 符合 `(^|[_-])manual([_-]|$)`，不分大小寫。
  - 或 `raw_payload ? 'manual_transcription'`。jsonb 的 `?` 會比對物件的頂層 key、字串陣列成員與字串純量。
  - JS helper `manual-source-guard.js:2-8` 以相同規則處理物件、陣列與字串純量三種形狀，regex 也相同。
  - `MANUAL_PROVIDER='MANUAL_TRANSCRIPTION_NO_OCR'`（`contracts/manual-transcription.js:2`）會被兩邊判為 MANUAL。
- **呼叫 provider 前先檢查。** classify handler 先讀 `extraction_provider` 與 `raw_payload`，再檢查 `isProtectedManualDraft`，之後才呼叫 provider。
- **舊 handler。** 舊版 classify handler 會先呼叫 provider，再被 SQL wrapper 拒絕。資料庫不會改變，但外部 provider 呼叫已經發生。這屬成本與外洩面的問題，不是完整性問題。

**測試覆蓋：** 讀過 `cto-p2-source-authority-sql.test.js:48`（classify、process、舊 confirm 三條路徑都被拒且 audit 數不變）與 `manual-activity-contract` 的差異，未重跑。

**殘留：** N2（P3），0602 保護 trigger 的 regex 與此處不一致。

## P2-4：processing 與 MANUAL create 的互斥、latest 與另建活動 — **主路徑已解決；仍存在一條「另建活動」路徑（N1，P2）**

**已解決的部分：**

- **雙向互斥。**
  - `process_document_atomic`、`begin_document_processing`、`finish_document_processing` 的 wrapper（`:42-72`）都會：
    - 先以 `lock_document` 鎖文件，依序取 project `for no key update`、deletion fence 的 advisory lock、`manual:` advisory lock、文件 `for update`。
    - 再以 `assert_not_manual(doc)` 檢查該文件任一歷史版本是否有 MANUAL 草稿。
    - 拒絕呼叫者自行帶入 MANUAL 標記（`:48`）。
  - `create_manual_transcription_atomic`（`:75-90`）取同一組鎖，並拒絕三種情況：已有 active lease 或 `ocr_status='processing'`；已有 latest 草稿；已有任何歷史草稿。
  - 兩邊序列化在同一把 advisory lock 與同一列文件鎖上，所以不論先後，另一方在交易內都會被擋下。
- **只接受仍有效的 server-verified 收件。**
  - `require_verified_original`（`:19-26`）比對三組資料：文件列的 status、verified 時間、object ID；私有 `verifications` 的 object、hash、bucket、path、大小、MIME；以及 `assert_object` 對 storage 物件的現況。
  - 新建時寫入 `original_verification` 標記，contract 為 `20261107.manual.2`（`:87`），重送不補寫（`:86-89`）。
  - confirm v2（`:94-104`）在兩種情況下重新核對物件：文件已是 server_verified，或草稿帶有 v2 標記。
  - 舊資料沒有標記，也沒有 verified 收件，依 CTO 邊界不補簽，仍可與新資料區分。
- **非 MANUAL 流程**：對沒有 MANUAL 歷史的文件，wrapper 只多做鎖定與檢查，其餘照舊。
- **002 的部署守門**：
  - 入場時先檢查 `deletion_ready`（`:3`）。
  - 只刷新兩個明確列出的 fingerprint，而且是在 grant 之後刷新（`:127-128`），不會把未知的部署漂移重新當成基準。
  - 已核對 `cocal_delete_private.catalog_state`（`202611060005:339-345`）與 attachment 基準（`202611060003:208-215`）的涵蓋範圍，001、002、003 沒有改到其他已登記的物件。

### N1（P2，新）：旁支非 MANUAL 草稿加上舊 confirm-draft，可對 MANUAL 文件另建活動

- **根因：**
  - 舊 `confirm_draft_atomic` 的 wrapper（`202611070002:107-118`）只檢查「被 confirm 的那一筆草稿」是否為 MANUAL（`:116`），不像 process 那樣以 `assert_not_manual(doc)` 檢查整份文件。
  - 私有實作 `202603160011:33-60` 不檢查 `is_latest`，也不檢查是否已確認過。
  - editor 依 core policy `extracted_document_drafts_write_policy ... for all`（`202603160001:610-616`），可以直接 REST insert 或 update 草稿。
  - 0602 的保護 trigger（`202611060002_manual_transcription_v1.sql:9-10`）只擋「新列或舊列本身是 MANUAL」，不擋「替 MANUAL 文件新增一筆非 MANUAL 的旁支草稿」。
  - 唯一 latest 索引（`202603160001:198-200`）只能阻止旁支設為 latest，不能阻止 `is_latest=false` 的旁支。
- **最小重現（來源推論，未執行）：**
  1. 同 org 的 editor 以 JWT 呼叫 `POST /rest/v1/extracted_document_drafts`，送出 `{organization_id, project_id, uploaded_document_id: <MANUAL 文件>, extraction_provider: 'mock', extraction_version: 99, is_latest: false, normalized_payload: {quantity: <任意>, …}}`。
     - RLS 的 `with check` 會通過：editor 且 org 可寫。
     - 0602 trigger 會放行：新列不是 MANUAL。
     - 005 的 `reference_guard` 會放行：文件沒有在刪除流程中。
     - 也可以改為 REST update 一筆既有的非 MANUAL 草稿，把它的 `uploaded_document_id` 改指向該文件。
  2. 呼叫 `POST /functions/v1/confirm-draft`，送出 `{draft_id: <旁支>, decision: 'confirmed', overrides: {...}}`。
     - handler 在第 76 行只依這筆草稿的 provider 分流，所以走非 MANUAL 分支（`:117-158`）。
     - wrapper 第 116 行放行，私有實作 insert 第二筆 `emission_activities`，帶上 `source_document_id=<MANUAL 文件>`、`source_draft_id=<旁支>`。
- **影響：**
  - 已通過 server-verified 核驗的 MANUAL 文件，被連上第二筆、數量由攻擊者決定的活動。這違反 P2-4「非 latest 或歷史稿不可另建活動」的要求。
  - 這筆活動沒有被當成可信資料：`trusted_inputs:121-123` 會因為旁支不是 latest 而對**整個 project** 回 `REPORT_SOURCE_INVALID`，所以是 fail closed。
  - 但一般使用者沒有恢復手段：
    - `save_manual_activity` 拒絕修改有來源的活動（`:89`）。
    - REST 刪除被 001 的 `:43` 擋下。
  - 結果是**單一 editor 就能讓該 project 的報告長期無法產生**，必須由後台維護處理。
  - 若旁支是在 MANUAL 建立前插入，則會讓 MANUAL 建立回 `manual_document_history_requires_review`。這與「先 process」的效果相同，不另列。
- **測試缺口：** 新 SQL 測試只對 MANUAL 草稿本身呼叫舊 confirm（`cto-p2-source-authority-sql.test.js:38,48`），沒有「同一文件的非 MANUAL 旁支」反例。
- **最小修法（二者擇一或併用）：**
  1. 在 `public.confirm_draft_atomic` wrapper 鎖定之後，加上 `perform cocal_manual_private.assert_not_manual(d.uploaded_document_id);`，並要求 `d.is_latest` 與 `d.status<>'confirmed'`。
  2. 擴充 0602 的保護 trigger：只要一般角色 insert 草稿、或修改 `uploaded_document_id`，而目標文件已有 MANUAL 歷史，就拒絕。
  3. 不論選哪一種，都補一個 SQL 反例：「MANUAL 文件加旁支草稿、經舊 confirm」須被拒，且活動數不變。

**未驗：**

- 兩條獨立連線的 interleaving。雙向互斥的結論只依鎖的語意推論；序列執行或 `Promise.all` 不能證明它成立。
- 真實 Storage 物件比對（`assert_object`）。

---

## 修復交集

### 003 來源保留 — **來源支持，但有 N3 需裁定**

- `source_retained`（`202611070003:3-16`）同時掃描兩處：public 的報告列，以及私有封存的 `row_snapshot->'payload'`。
- 以下情況全部 fail closed：
  - mapping 不是陣列。
  - 項目不是物件，或缺少四個必要 key 之一。
  - 值不是 null 也不是小寫 UUID 字串，例如帶大括號、沒有連字號、非字串。
- 只要符合，對該 project 任何活動、草稿或收件的 update／delete 都會回 `REPORT_SOURCE_RETAINED`（`:17-29`）。
- 已核對：`build-report-payload.js` 從最早版本 `840b3e3` 到 `9ebf5b1`，一律輸出四個 key，值為 UUID 或 null。repo 內產生的歷史報告不會誤觸全 project 凍結。
- 刪除 project 或 org 時，若有報告、封存、ledger request 或 MANUAL 草稿，會明確回 `PROJECT_/ORGANIZATION_HAS_RETAINED_SOURCES_OR_REPORTS`（`:30-45`）；真正空的範圍可以刪除。這取代了上一輪 I-P3-3 那個不明確的 42501。
- 例外：N2 可能讓「實質空的範圍」被誤判為含 MANUAL，因而無法刪除。

### 001 明確 32 欄 v1／v2 封存 — **已解決**

- `row_snapshot` 改為明確的 32 欄清單（`:131-134`）。
- 已逐一列舉 `report_generations` 的歷次欄位：
  - core 21 欄。
  - staging 加 `is_test`、`env`。
  - adjustments 加 5 欄。
  - boundary 加 3 欄。
  - 006 加 `integrity_status`。
  - 合計正好 32 欄，與清單一致。
- 因此對 repo 定義的 schema 而言，新函式與 006 原本的 `to_jsonb($1)` 產生相同的 jsonb，舊 v1 封存不會因此失效。前提是雲端沒有 repo 以外的欄位，這點未驗。
- v1 proof 交給保留下來的 `verified_row_v1`（`:137-142`）；只有新建的報告標為 v2（`:167-169`）。
- 日後新增無關欄位，不會讓歷史報告失效。上一輪的 I-P3-2 在來源層面已處理。
- 語意邊界與入口一致：v1、v2 只證明保存的內容一致，不證明文件內容真實或經過雙人覆核。

### 新 MANUAL 標記與 receipt 再核對 — **已解決**

已在 P2-4 說明：標記只在新建時寫入，重送不補簽；confirm 時重新核對私有 authority、目前的物件與 metadata。

### 002 入場檢查 — **已解決**

已在 P2-4 說明。

### 匯出 busy 與 attempt 歸屬 — **已解決，附 N5（P3，推論）**

- `reportDownload.ts:5-9`：busy 綁定「同一個 context 物件與同一個 attempt」。`releaseReportExportAttempt` 只清除自己的 attempt，所以舊 attempt 的 `finally` 不會清掉新的。
- `ReportPreviewPage.tsx:83-86`：
  - 切換 report、session 或範圍時，`useLayoutEffect` 會把 attempt 設為 null、清空提示並關閉對話框。
  - 失敗後 attempt 會被釋放，可以重試。
  - 每次匯出都重新呼叫 `readAuthorizedReportSnapshot`，所以權限每次都 fresh 檢查。
- 真實的 React 延遲操作與原生下載都沒有驗證，只讀過 helper 測試（`reportDownload.test.ts`）。

### 私有 activity_requests — **已解決**

- `cocal_recalc_private.activity_requests`（`:25-31`）只綁定 request、actor、input、saved-row，用於處理重送，對外權限全部撤銷。
- 可信計算仍由既有的 recalc ledger 判定。可寫的 `audit_logs` 不被當作權威。

---

## 新發現（P3）

- **N2（P3）：判定 MANUAL 的 regex 有兩套。**
  - 0602 的 `protect_manual_draft` 使用 `^manual([_-]|$)`，只比對開頭（`202611060002_manual_transcription_v1.sql:9-10`）。
  - 002、003 與 JS helper 使用 `(^|[_-])manual([_-]|$)`。
  - 後果：editor 可以 REST insert provider 為 `ocr_manual` 的草稿。0602 不保護這筆草稿，002、003 卻把它當成 MANUAL。於是該文件無法 process，該 project 與 org 也無法 hard delete（`202611070003:35,40`）。
  - 同一位 editor 可以再刪掉這筆草稿，所以影響可恢復。
  - 修法：0602 trigger 改呼叫 `cocal_manual_private.is_manual`，讓全案只有一個判定來源。
- **N3（P3，需 CTO 裁定）：報告後活動永久不能更正或排除。**
  - `retain_source` 擋下所有對已入報告活動的 update，包括 `save_manual_activity` 改為 `status='archived'` 或 `inclusion_status='excluded'`。
  - 某筆活動一旦出現在任何報告裡，就永遠是 active 並計入之後所有報告。要更正只能新增一筆，結果是重複計入。
  - 請裁定：這是預期的保留政策，還是需要「以新版本取代、但保留舊列」的流程。
- **N4（P3，推論，NOT_RUN）：鎖順序。**
  - `retain_source` 在 row trigger 內才取 project 的 `for no key update`（`202611070003:23`）。
  - 已持有文件或 deletion advisory lock 再 update 收件的路徑（005 的刪除流程），取鎖順序與 `lock_document` 的「project → advisory → 文件」相反，可能出現 40P01。
  - 這延續上一輪的 X4。後果是一方乾淨中止，不會破壞資料完整性。
- **N5（P3，推論）：匯出可能被靜默取消。**
  - `exportContext` 包含 `exportBlock`，而 `exportBlock` 由訂閱的 loading 狀態推導（`ReportPreviewPage.tsx:81-82`）。
  - 若訂閱狀態在匯出途中重新整理，例如視窗回到前景時，context 就會換成新物件。layout effect 會清空提示並關閉對話框，舊 attempt 的 `isCurrent()` 變成 false，不會下載，也不會留下任何訊息。
  - 這點取決於 `useSubscriptionStatus` 重新整理時是否會切換 loading，本次未查證，列為證據不足。
  - 建議：context 不要包含 `exportBlock`，改在送出前即時檢查；或在取消時留下「範圍已變更，未下載」的提示。
- **附註（不列等級）：同一 request_id 的並發。**
  - 相同 request_id 的兩個請求並發時，兩者都可能通過 `:156` 的 not-exists 檢查，接著在 `publish_sealed_v1` 的 advisory lock 上序列化。
  - 後到的一方取得 replay 結果後，仍會執行 `:168-169`，對同一份報告重寫 env／is_test 並標為 v2。
  - 這只影響同一個請求剛建立的那份報告，不會重簽部署前的 v1 proof，影響可忽略。

## 已知邊界（如實保留，不另開票）

- 可信報告只證明「與已存 factors 和 ledger 一致」。owner／admin 依 core policy（`202603160001:660-667`）可以維護 org 自訂 factors，這是產品功能，但 factor 本身的真實性不在證明範圍內。
- `scope_totals`、`category_totals` 等合計由 service handler 依可信輸入計算。SQL 只核對 ID mapping 與 authority，不重新加總。可信度依賴已部署的 handler 版本；若要排除 handler 這層信任，可以讓 SQL 重新加總後比對。
- 真實 Supabase JWT、PostgREST、Storage、managed Edge：NOT_RUN。
- 兩條獨立 PG 連線與鎖順序：NOT_RUN。
- 原生選檔與下載：NOT_RUN。
- 雲端 migration、NOT VALID、DB＋Storage 復原：NOT_RUN。
- 19＋1 項驗收：NOT_RUN。
- 瀏覽器證據對應的是 `b7ed0e8`，不涵蓋 `1f657f7`、`9ebf5b1` 的增量。

## 本次實際執行的命令（全部唯讀）

- `git fetch origin`。
- `git log` 與 `git diff --stat ba2c7a5 9ebf5b1`。
- `git show 9ebf5b1:<path>`，涵蓋三支新 migration、0602／0004／0005／0006／core schema 與 202603160011 的相關段落、handler、helper、測試檔。
- `git grep` 查詢所有寫入 `calculation_results` 與 `emission_activities` 的路徑、舊 RPC 的呼叫點、drafts 的 policy 與 trigger。
- `git log -S appendix_mappings`。
- 沒有執行 npm、node、deno、psql 或任何測試。

## 需 CTO 裁定

1. N1 的修法要放在本 PR 內（建議），還是另開一張票。在 N1 修好之前，P2-4 不應關閉。
2. N3：報告後活動不能更正或排除，是否接受；或需要取代型的版本流程。
3. 部署說明是否加註：所有既有 project 部署後都必須先重算一次才能產生報告（P2-2 的部署後果）。

---

本回覆不構成放行，也不核准雲端操作或合併；發布維持 HOLD。
