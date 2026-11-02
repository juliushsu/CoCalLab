# Claude 定向唯讀複審回覆：Storage 修復差異（PR #15）

- 審查對象：`juliushsu/CoCalLab` 固定修復來源 `8cf7525d60755ea8adbdf3ba818fb26635efb8b0`，差異基準 `f76368953d4f952632f4356c4d7ccbccd46cd5c2`（未使用移動中的 branch HEAD）。
- 方式：只讀來源、合成測試與證據檔。**未獨立重跑任何測試**，前端 131/131、後端 16/16、隔離 SQL 183/183 均未經本審查驗證。未留言、未合併、未部署、未連線雲端、未做真實上傳。
- 結論摘要：10 列中，9 列為「已解決」（其中 S4-refresh、S3-metadata、P3-f 各附 1 項附帶缺陷或限制），1 列（P3-d）為「已解決（附註）」。本差異**沒有新增 P1／P2**，新增 2 項 P3（N1、N2）。SHA256 占用唯一索引的問題仍維持 OPEN，已如實記錄。
- 本回覆不構成放行。S3／S4 是否關閉、是否發布，由 CTO 裁定；發布維持 HOLD。

行號皆指 `8cf7525`。縮寫：`M2` = `backend/supabase/migrations/202611020002_storage_receipt_review_fixes.sql`；`DI` = `frontend/readdy-app/src/services/documentIntake.ts`；`IR` = `.../services/intakeRecovery.ts`；`AC` = `.../services/authContinuity.ts`；`AP` = `.../contexts/AuthProvider.tsx`；`UP` = `.../pages/admin/documents/DocumentUploadPage.tsx`；`FT` = `frontend/readdy-app/tests/documentIntake.test.ts`；`AT` = `.../tests/authContinuity.test.ts`；`RT` = `backend/tests/integration/storage-receipt-review-fixes.test.js`。

---

## 逐列結果

### S4-refresh —— 已解決（附新增 P3：N1）

- 例行事件保留操作：`AC.accept` 的判定式（AC:20-22）在以下條件全部成立時視為例行事件，不增加 epoch：
  - 同一使用者；
  - 同一個 `session_id` family，或 access token 完全相同；
  - 事件不是 `EXPLICIT_SIGN_IN` 或 `SIGNED_OUT`。
  
  因此 `TOKEN_REFRESHED` 與同一 session 在分頁取得焦點時發出的 `SIGNED_IN` 都不會中斷操作。UP 的 `route` 改為依賴 `userId` 與 `authEpoch`，不再依賴 session 物件（UP:41）；所有 `isCurrent` 都改走 `isAuthenticationCurrent`（UP:142、:178）。覆蓋測試：AT:7、證據 `green-token-refresh.ax.txt`，對照 `red-token-refresh.ax.txt`。
- 會使舊操作失效的情況：
  - 登出：AP:113 呼叫 `invalidate`。
  - 明確重新登入，包含同一帳號：AP:86 在開始時 invalidate，AP:101 以 `EXPLICIT_SIGN_IN` 再加一次 epoch。
  - 新的 session family、換使用者、`SIGNED_OUT` 事件：AC:20-23。
  - 換專案：UP:224 在 onChange 中同步設定 `currentView.current = null`。
  - 換路由：`view` 隨之改變。
  
  覆蓋測試：AT:14、:21、:28、:36，以及 `green-relogin/logout/user-switch/project-switch-boundary.ax.txt`。
- `sessionGate` 沒有修改，`acceptEvent` 在登出後與登入進行中仍回傳 null；`signOut` 依舊先呼叫 `sessionGate.signOut()`（AP:112）。`family()` 只解碼 JWT payload，註解也標明它不是驗證機制（AC:10-11），定位正確。
- **N1（P3，本差異新增）：明確登入失敗後，continuity 狀態與 React session 不一致。**
  - 觸發：已登入的使用者進入 `/login`（LoginPage 不會把已登入者導走），輸入錯誤密碼。AP:86 已經 `invalidate()`，把 `latest` 設為 null；失敗分支 AP:103-106 沒有還原 continuity，但 React 的 `session` 仍保留原值。
  - 影響：
    1. 在下一個 auth 事件之前（通常要等到下一次 `TOKEN_REFRESHED`），`isAuthenticationCurrent` 一律回傳 false。上傳頁會進入錯誤狀態，按「重試」也無效。
    2. AP:72 新增了 `continuity.current.latest()===session` 條件，因此這個 session 到期時，計時器不再清除它。原本的「到期即清除」防護在這個情境下被削弱。若之後自動刷新失敗（例如離線），畫面會在權杖過期後仍顯示已登入。
    
    這兩點都是 fail closed：伺服器 RLS 仍是權威，所以不構成權限問題。但它確實削弱了既有的到期防護，也造成可用性問題。
  - 最小重現（AT 層）：`c.accept('INITIAL_SESSION', s)` → `const e = c.invalidate()`（模擬登入失敗，之後不再呼叫 accept）→ `c.isCurrent(e, s.user.id) === false`，而 AuthProvider 的 `session` 仍是 `s`；同時 `c.latest() !== s`，導致 AP:72 的條件不成立。
  - 最小修正：登入失敗時以不增加 epoch 的方式把 `latest` 還原為仍持有的 session（例如新增 `restore(session)`）；或把 AP:72 恢復為只看 `!sessionIsCurrent(session)` 的無條件清除。
  - 現有測試未覆蓋（AT 沒有「登入失敗」案例）。

### S4-complete —— 已解決

- `completeIntakeRegistration` 的處理順序（DI:191-200）：
  1. 核對 actor 是否相符（DI:193）。
  2. 重新取得身分並檢查 `20261102.2` 可寫契約（DI:194）。
  3. `reconcileIntake`：先以原 ID 查詢（DI:163），再以 hash 查另一分頁可能已勝出的列（DI:169）。
  4. 確認本機 journal 中有完全相同的參考（DI:196-197）。
  5. 私有下載原物件，核對 size、Blob type 與 SHA（DI:198，以及 DI:118-135）。
  6. 用**原** documentId 與 path 執行 INSERT（DI:175、:199）。
- 異常情境：
  - INSERT 失敗或成功回應遺失：回到唯讀核對（DI:183-187）。
  - 兩個分頁同時補登記：PK 衝突後會以 ID 查到已存在的列，結果仍正確。
  - 整個流程不重傳 bytes、不產生新 ID、不執行 DELETE。
  - 缺檔、權限撤銷、MIME／size／SHA 不符、本機參考被竄改、舊契約：都在 INSERT 前停止。
  - 情境切換：拋出 `context`。
- 覆蓋測試：FT「review S4: explicitly complete…」、「…completion refuses wrong actor, revoked write access, old deployment and missing or changed original before INSERT」、「…already committed receipt is read first and completion lost response never resends bytes or changes ID」；證據 `green-original-id-recovery.ax.txt`、`green-row-retry.ax.txt`。
- 尚缺證據：真實 storage-api 回傳的下載 Content-Type 是否與 metadata 的 `mimetype` 一致。SDK fixture 固定回傳 `application/pdf`。另見 N2。

### S4-discard —— 已解決

- `IR.discard` 只處理 `prefix + user + ':' + id` 這一個 key，並核對 user、org、project 都相符才動作；不呼叫任何 Storage 或 DB（IR:87-97）。移除後會再讀一次確認，失敗就拋錯。UP:197-203 在失敗時標示 `recovery` 錯誤，不會清掉列。
- 確認對話框（UP:278）先提供下載參考回執。zh 文案 `discardMessage` 明確寫出「不刪除伺服器檔案或資料列，也不能取消已送出的請求」，en/ja 我未逐字核對。
- 覆蓋測試：FT「review S4: abandon only the current user/project/attempt reference…」、「review recovery: … failed local removal cannot claim success」；證據 `green-local-abandon-reload.ax.txt`。

### S3-metadata —— 已解決（hash 防偽仍 OPEN；附 N2）

- `cocal_receipt_metadata_guard` 是 BEFORE INSERT 的 row trigger（M2:56-57），因此不論是否經過 UI，所有 authenticated 的直接 INSERT 都會被檢查。檢查內容：
  - `metadata` 必須是 object；`size` 必須是 JSON number，且是非負、可放進 bigint 的整數（文字比對後才轉型）；`mimetype` 必須是 string，且屬於三種允許類型之一。
  - 以上兩者都必須與收件列相符，否則一律回 42501（M2:31-51）。
- 001 的 trigger 未修改，仍檢查 owner、身分與初始狀態。兩個 trigger 依名稱字母序執行，metadata 檢查先跑，任一拒絕即失敗。合法角色在三個 bucket 都能成功保存（RT:85）。
- 服務維護繞過的不變量與 001 一致（M2:27）：`authenticated`/`anon` 以外的角色直接放行。RT:101 證明 anon 仍被拒、service_role 仍可維護。沿用前次附註：日後任何授權給 `authenticated` 的 SECURITY DEFINER RPC 若寫入此表，會同時繞過兩個 trigger。
- 覆蓋測試：RT:56-58、:78、:81（含 `16.0`、超出 bigint、`1e100`）。
- OPEN 邊界記錄正確：RT:128 刻意保留「格式合法的偽造 SHA 仍可占用唯一索引、第二筆得到 23505」的正例；`STORAGE_REVIEW_FIX_DELIVERY_20261102.md:62` 也明確寫出 metadata 一致不代表內容類型或 hash 經伺服器驗證。這是既有、另行列管的缺口，不是本次新增。
- **N2（P3，本差異讓問題浮現）：`contentType` 選項實際上沒有送出，瀏覽器回報 `image/jpg` 的檔案永遠無法登記。**
  - 原因：DI:226 傳的是 `File` 本體，SDK 會改用 FormData 上傳（fixture 在 FT 的 SDK 替身中也斷言 `body instanceof FormData`，並以 `body.get('')` 取檔）。這種情況下 `contentType: file.mimeType` 不會送出，Storage 記錄的 `mimetype` 是瀏覽器提供的 `File.type`。
  - 觸發：`fileIdentity` 接受 `File.type === 'image/jpg'`，再把它正規化為 `image/jpeg`（DI:137、:146），但 Storage metadata 仍是 `image/jpg`。
  - 結果：
    1. M2:48-49 拒絕收件（`image/jpg` 不在允許清單，且與收件列不一致），物件成為 orphan。
    2. 補登記時，DI:123 的 Blob type 比對也不相符，所以只能放棄本機參考。
  - 範圍：PDF 與 PNG 不受影響。
  - 最小重現：
    1. SQL 層：`object(db, r, {size: 16, mimetype: 'image/jpg'})`，收件列 `mime_type: 'image/jpeg'` → 42501。
    2. 前端層：`new File([jpegBytes], 'a.jpg', {type: 'image/jpg'})`，觀察 FormData 中 part 的 type。
  - 最小修正：上傳時改傳 `new Blob([bytes], {type: file.mimeType})`，或使用正規化 type 的新 `File`；也可以直接在 `fileIdentity` 拒絕 `image/jpg`。
  - 真實 storage-api 是否以 multipart part 的 type 作為 `mimetype`：NOT_RUN，但 SDK 送出 FormData 這點已由測試替身證實。

### P3-a —— 已解決

- 新的 `document_id` 要求路徑中的專案段與 `project::text` 完全相同，也就是必須是小寫（M2:11-14）。這與收件 trigger 的 `like` 比對一致。`project_id()` 未修改，所以舊有的合法大寫路徑仍可讀取，也可由有權者刪除（RT:59、:85）。

### P3-b —— 已解決

- 在 checkpoint 之前：DI:222 先做情境檢查，失效就直接拋錯，不會寫入紀錄。
- checkpoint 之後、送出 bytes 之前：DI:224 若發現情境失效，只清除自己這一筆參考，再拋錯。
- 本機儲存不可用：DI:223 在送出 bytes 前就停止。
- 覆蓋測試：FT「review P3-b…」，以及原有的「unavailable or nonpersisting recovery storage…」。

### P3-c —— 已解決

- 既有的合法收件優先：DI:217 先執行 `existingByHash`，之後才處理本機的 `previous`。
- 另一分頁的勝出列若要到第二次查詢才出現：`reconcileIntake` 回傳的結果會帶 `recoveryReference` 指向原 orphan，且不清除它（DI:169-172）。UP:157、:184 以 `recoveryReference` 作為列的 `attempt`，所以「放棄」只會清掉 orphan 的 key，不會誤清勝出列的 UUID。
- 覆蓋測試：FT「review P3-c」兩項。

### P3-d —— 已解決（附註）

- 損壞的紀錄會逐筆隔離：原值先備份到 `cocal-intake-quarantine:v1:{user}:{uuid}`，確認備份確實寫入、且原值沒有被其他分頁改過，才移除原 key；備份失敗就保留原值，只略過這一筆（IR:49-62）。有效紀錄與新上傳都不受影響。
- 覆蓋測試：FT「review P3-d」與「failed quarantine preserves the malformed entry」。
- 附註（P4，非缺陷）：
  - 隔離區沒有清除途徑，會永久留在 localStorage。內容只有 metadata、hash 與路徑，不含憑證。
  - 未來版本若改變紀錄格式，舊版程式讀到時會把它當成損壞紀錄移入隔離區。

### P3-e —— 已解決

- 已驗證收件的參考 JSON：`uploaded_by_user_id`、`document_type`、`ocr_status` 取自已保存的 `record`（DI:202-205）。
- 未確認的 attempt：只標示 `requested_by_user_id`。
- 兩種情況都把 SHA 標為 `client_sha256`，並附 `ocr_executed_by_this_intake: false`。
- 覆蓋測試：FT「review P3-e」。

### P3-f —— 已解決（偵測範圍充分；限制記錄如實）

- `catalog_state` 的指紋涵蓋以下項目（M2:67-106）：
  - 8 個 guard policy：command、permissive、roles、USING／CHECK 表達式。Postgres 的 policy 沒有獨立的 ACL。
  - 2 個 trigger：`pg_get_triggerdef`（含 WHEN 條件、時機、事件）、enabled、tgtype、函式。
  - 私有 schema 的所有函式，以及 `upload_intake_contract`、`is_active_org_member`、`organization_is_writable`、`auth.uid`：定義、owner、ACL、config（含 search_path）、SECURITY DEFINER、volatility、leakproof。
  - 4 個 schema 的 owner／ACL。
  - baseline 表本身的 ACL 與 RLS 設定。
- `deployment_ready` 另外核對 tgtype 23 與 7（M2:114-117）、baseline 至少 20 列，並做雙向 EXCEPT 比對。前端只接受 `20261102.2`（DI:93），因此新舊版本互相搭配時都會在送出 bytes 前停止。覆蓋測試：RT:60-66、:104-127。
- 明確評估：
  1. 安裝時的快照只能證明「安裝之後沒有改變」，無法證明安裝當下是可信的。若 `is_active_org_member` 在安裝前就已被改寫，baseline 會把被改寫的版本當成正確基準。
  2. 無法對抗 DDL owner：owner 可以直接改寫 baseline 表或 `deployment_ready`，也可以新增一個名稱排在兩個 guard 之後的 BEFORE INSERT trigger，在驗證後改寫 `NEW`。額外的 trigger 與 policy 都不在指紋範圍內。
  3. 這是相容性前置檢查，不是權限控制，真正的權威仍是每次寫入時的 RLS 與 trigger。M2:59-60、M2:146-147 與交付文件都如實這樣描述。
- 營運風險（P3，建議寫入 runbook）：指紋包含 Supabase 自行管理的物件（`auth.uid()`，以及 `auth`、`storage`、`public` 這三個 schema 的 ACL），而 `pg_get_functiondef` 的輸出格式也可能隨 Postgres 大版本改變。平台升級或 PG 升級後，`can_write` 可能變成 false，上傳入口會關閉。這是 fail closed，不會造成外洩，但需要監控與「經核准的重新建立基準」migration 流程。

## 本差異新增缺陷彙總

| 編號 | 等級 | 位置 | 摘要 | 建議 |
| --- | --- | --- | --- | --- |
| N1 | P3 | AP:86、AP:103-106、AP:72 | 明確登入失敗後 continuity 與 React session 不一致：上傳頁暫時無法使用，該 session 到期時也不會被計時器清除 | 失敗時還原 `latest` 但不增加 epoch，或恢復無條件的到期清除 |
| N2 | P3 | DI:226、DI:137/:146、M2:48-49、DI:123 | SDK 以 FormData 上傳時忽略 `contentType`；瀏覽器回報 `image/jpg` 的檔案會成為無法登記的 orphan | 上傳正規化 type 的 Blob，或拒絕 `image/jpg` |

本差異沒有新增 P1／P2。

## 真實服務未驗（與來源缺陷分開）

- Chrome 證據使用真實頁面，但 useAuth 與 SDK 都是 fixture，沒有真實 AuthProvider、Supabase Auth 事件時序或 BroadcastChannel 跨分頁同步。
- 真實 storage-api 的 metadata（`size` 型別、`mimetype` 來源、寫入時機），以及下載回應的 Content-Type：NOT_RUN（影響 S3-metadata 與 N2）。
- JWT 驗證、PostgREST exposed schemas、雲端 migration 套用／備份／還原、平台升級後 baseline 是否仍相符：NOT_RUN。
- 原生選檔：BLOCKED。

## 治理提醒

001 在缺少 `documents` bucket 時會建立它；002 新增私有 baseline 表、函式、trigger，並把 RPC 契約版本改為 `20261102.2`。套用兩者都需要 Owner 另行批准。本複審與合成測試都不構成雲端授權，也不構成發布放行。
