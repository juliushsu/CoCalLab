# Claude 定向唯讀審查回覆：PR #14 安全上傳與收件

- 審查對象：`juliushsu/CoCalLab` 固定 commit `71ffcf47defef31236181f8b938fc005f46dcb71`，比較基準 `be23b32654c222cb51d7458669cf6d93364fc0fd`（未使用移動中的 branch HEAD）。
- 方式：只讀來源與測試碼。**未重跑任何測試**（PR 宣稱的 116/116、16/16、122/122 未由本審查獨立重現）；未連線資料庫／雲端、未送出檔案、未搬移或刪除物件。
- 結論摘要：S1 來源通過、S2 來源通過（附相容性註記）、S3 仍有缺陷（P2）、S4 仍有缺陷（P2）、S5 來源通過（漂移偵測偏淺，P3）。真實服務層面全部證據不足（見最後一節）。
- 本回覆不構成外部紅隊完成或放行；發布維持 HOLD。

以下行號皆指固定 commit。`M` = `backend/supabase/migrations/202611020001_secure_upload_storage.sql`；`DI` = `frontend/readdy-app/src/services/documentIntake.ts`；`IR` = `.../services/intakeRecovery.ts`；`UP` = `.../pages/admin/documents/DocumentUploadPage.tsx`；`FT` = `frontend/readdy-app/tests/documentIntake.test.ts`；`ST` = `backend/tests/integration/storage-upload-rls.test.js`。

---

## S1：policy 合成與身分邊界 —— 來源通過

- 四個 restrictive guard 皆 `to public`（M:88-103、M:118-127），會與既有 `stg_*`（`202603180005` 全部只檢查 `staging/` 前綴，含 UPDATE）及任何新增 permissive policy 做 AND。UPDATE guard 對三個 bucket 恆拒（M:101-103），因此舊 `stg_*_update_auth` 被封住。ST:96-97 注入 `synthetic_wide_*`（`for all to public using(true)`）後仍拒絕，覆蓋「最寬鬆漂移」。
- 跨租戶讀／寫／刪、viewer、inactive、invited、readonly 訂閱、archived／suspended org、匿名、偽造 path：由 `org_access`（M:57-65：`auth.uid()`、`o.status='active'`、活躍會員、寫入需 owner/admin/editor 且 `organization_is_writable`）承擔；ST:120-158、:220-237 有對應案例。合法同租戶操作（含舊 basename 讀／刪）仍可行，見 ST:120、:147。
- Helper：`set search_path = ''`，引用皆完整限定（M:28-81）；`guard_receipt_write`、`deployment_ready` 已撤回 execute（M:166、M:197）。ST:110 確認 app role 非 superuser／無 BYPASSRLS，且 helper 可執行（不是靠 ACL 拒絕假裝通過）。
- 註記（非本差異缺陷）：
  - M:83-84 將 `org_access`／`project_access`／`receipt_binding` 授權給 `anon`、`authenticated`。它們只回傳「呼叫者本人是否有權」的布林值，沒有越權 oracle；前提是 `cocal_storage_private` 不在 PostgREST exposed schemas（真實設定 NOT_RUN）。
  - 收件 trigger 對 `authenticated`/`anon` 以外的 role 全部放行（M:135）。目前會寫 `uploaded_documents` 的 atomic RPC 已限 service_role（`202610310003`），但這是必須維持的不變量：日後任何授權給 `authenticated` 的 SECURITY DEFINER RPC 若寫此表，會整個繞過 trigger。建議記入 RPC 審查清單。
  - 寫入者可刪除收件所引用的 Storage 物件（M:97-100、M:113-115）；收件列不會跟著改變，之後同內容的「既存重用」會因下載失敗變成 `duplicate`。此行為沿用既有語意，不是本差異造成的回歸。
  - 既有 `is_active_org_member`／`organization_is_writable` 使用 `search_path = public`（core_schema:488-525），不在本差異範圍。

## S2：路徑與歷史相容性 —— 來源通過（附相容性註記）

- 新寫入：`document_id` 要求小寫 UUIDv4 加 `pdf|jpg|jpeg|png` 副檔名（M:51）；舊 basename 只供讀／刪（M:26-43）。ST:214、:160 覆蓋。
- 未知前綴（如 `staging/fixtures/x`）、巢狀目錄、`..`、非 UUID 專案段 → `project_id` 回傳 NULL → 所有 authenticated 都看不到，service_role 仍可見。這是刻意的行為改變：`202603180005` 原本讓所有 authenticated 讀取任何 `staging/*`，等同跨租戶外洩，收窄是正確的。上線前需要 Owner 盤點清單。
- `%`／`\`：SQL 對舊 basename 仍允許讀／刪；前端 `compatiblePath` 拒絕重用（DI:98-104）。邊界清楚。
- NOT VALID 前 org/project/path 不一致的歷史收件：`receipt_binding` 會將其隔離，查不到也刪不掉，且不修補資料（M:74-81、M:118-127；ST:166）。符合需求。
- Bucket 處置：任一 bucket 為 public 時整個 migration 停止（M:6-11）；缺少 staging bucket 也停止（M:12-15）；缺少 `documents` 則建立 private bucket（M:19-20）。治理註記：在雲端套用本 migration **本身就是建立 bucket**，必須併入另行取得的雲端授權，不能視為「只是套用 policy」。
- **P3-a 大小寫不一致**：`project_id` 接受大寫專案段（M:39 用 `[0-9a-fA-F]`），因此 Storage INSERT guard 允許 `staging/ABCDEF…/{uuid}.pdf`；但 trigger 用 `like … || new.project_id::text || '/%'` 比對（M:145），而 `::text` 一律是小寫，結果收件必定被拒。直接呼叫 API 可以製造永遠無法登記的孤兒物件；前端固定產生小寫路徑，不受影響。最小修正：新寫入路徑要求 `parts[2] = lower(parts[2])`，或在 `document_id` 內同時檢查專案段為小寫。

## S3：真實收件與不可偽造 —— 仍有缺陷（P2）

通過項目：
- uploader 必須等於 `auth.uid()`（M:142）；`id` 必須等於檔名 UUID（M:143）；project、path、org 綁定（M:144-147）；初始狀態固定為 `pending`/`active`/未封存（M:148）；env/is_test 必須與 bucket 相符（M:153-155）；物件 owner 必須是本人（M:159-162）。ST:195-212、:226 覆蓋。
- Client UPDATE 有兩道防線：restrictive `using(false)`（M:123-124）與 trigger（M:136-138）。ST:239 證明無法用 UPDATE 偽造 OCR 成功。
- 錯誤回傳偽造：前端 `receiptRow` 逐欄位核對回傳列（DI:106-116）。既存收件重用時，以私有 download 重算大小與 SHA256（DI:117-134），並以 `record` 呈現實際的 uploader 與文件類型（DI:115）。FT:176 覆蓋。

**P2-S3 收件的 `file_size_bytes`／`mime_type` 是 client 宣稱值，未與實際物件綁定**
- 位置：M:149-150 只檢查 `> 0` 與 hash 格式；M:159-162 已讀取 `storage.objects` 列，但未比對其 `metadata`。Storage 伺服器會在 metadata 中寫入實際的 `size` 與 `mimetype`。
- 觸發：editor 先上傳自己的 PNG（5 MB），再直接呼叫 PostgREST 插入收件，填 `file_size_bytes=1`、`mime_type='application/pdf'`、任意格式正確的 `sha256_hash`。
- 影響：收件列表顯示假值（`UploadedDocumentListPage.tsx:335,348`）。偽造的 hash 會占用 `(project_id, sha256_hash)` 唯一索引（core_schema:157），之後真正內容相同的檔案在此專案永遠無法登記：前端 `verifyOriginal` 比對不符，回報 `duplicate`。這是內部人員可對特定內容發動的定向阻斷。
- 測試：ST:195 只測 `file_size_bytes: 0`；物件與收件之間的大小／類型不一致沒有測試。
- 最小合成重現（ST 架構）：`object(r)` 時寫入 `metadata: {size: 16, mimetype: 'image/png'}`，再 `app(OWNER, () => save({...r, file_size_bytes: 1}))`，目前會成功，修正後應得 `42501`。
- 最小修正：在 M:159-162 的 EXISTS 內加入 `(o.metadata->>'size')::bigint = new.file_size_bytes and o.metadata->>'mimetype' = new.mime_type`；metadata 為 NULL 時 fail closed。`mimetype` 只是 client 送出的 Content-Type，至少能保證一致性，但不代表內容真偽。
- 維持既有誠實標示：SHA256 仍是 client 計算的值，SQL 無法驗證原始 bytes。要真正驗證需要伺服器端計算（Edge Function 或 worker），屬另一張票。
- P3 附記：`metadata` jsonb 與 `received_date` 也可由 client 任意填寫（DI:234 只是自己填了合理值）。下游不得把 `uploaded_documents.metadata` 當成可信資料。目前搜尋不到讀取它的地方。

## S4：部分失敗與恢復 —— 仍有缺陷（P2）

通過項目：不盲刪（沒有任何 DELETE 呼叫，FT:198）；不重送 bytes（FT:211、:238）；`upsert:false`；每個 attempt 先寫入 checkpoint 再送 bytes（FT:253）；雙分頁交錯儲存／清除不互相覆寫（FT:265）；回應遺失時以固定 ID 核對（FT:211）。文件沒有宣稱後端冪等或原子保存，此點正確。

**P2-S4 物件已提交但收件未寫入的 attempt 會永久卡住，且常見事件（token refresh）就能觸發**
- 觸發 A（常見）：頁面的 `view` 依賴 `session` 物件身分（UP:39、UP:47、UP:60-67、UP:136）。`AuthProvider` 每收到一次 auth 事件就 `setSession(新物件)`（`contexts/AuthProvider.tsx:25-31`、`:40-43`；`authSessionGate.ts:19-21` 原樣回傳該 session）。上傳期間只要發生 `TOKEN_REFRESHED`（必然會週期性發生；supabase-js 2.57.4 在分頁重新取得焦點時也可能發出 `SIGNED_IN`），`isCurrent()` 就變成 false。此時物件已提交，DI:227 拋出 `context`，DI:234 的 INSERT 從未送出。
- 觸發 B：物件成功後 INSERT 遇到暫時性 5xx 或網路中斷，且列確實沒寫入 → DI:250 核對結果為 null。
- 觸發 C（P3-c 同源）：專案內存在被 select guard 隱藏的同 hash 舊列 → INSERT 回 `23505` → 核對結果為 null。
- 之後的結果：
  - `reconcileIntake` 只讀不寫（DI:148-163），永遠回傳 null；頁面只能顯示 `unconfirmed`（UP:176-178）。
  - 重新選取相同內容時，在重複檢查之前就被 DI:181-190 攔下，固定回 `uncertain`，這個專案再也無法登記該檔。
  - `unknown` 狀態沒有放棄本機參考的按鈕（UP:251 只對 `pending`／`failed` 提供取消）；每次重新載入頁面都會再列出（UP:115-126）。
  - 累積 100 筆後，該使用者的所有上傳都被擋（IR:324-325）。
  - 沒有資料遺失，也沒有假成功，所以不是安全缺陷；但核心功能會在例行事件後失效，物件也會成為無主物件。
- 測試：FT:198、FT:223 把「卡住」當成預期行為來斷言；頁面層沒有 token refresh 測試，也沒有任何「完成登記」路徑的測試。
- 最小合成重現：
  1. 單元層：沿用 FT:223 的 `storageHook: () => { active = false }` → 拿到 `error.attempt` → `reconcileIntake(client, attempt)` 回傳 null → 再呼叫一次 `runUpload(client, input())`，得到 `uncertain`，且沒有任何 API 能完成登記。
  2. 頁面層：在 storage upload 的攔截 hook 中用同一 user、新的 session 物件觸發 `onAuthStateChange('TOKEN_REFRESHED', …)`，即可觀察到收件 INSERT 未送出。
- 最小修正：
  1. `isCurrent` 改為比對 user id、route scope 與 session 未過期，而不是比對 session 物件身分。目的是避免例行 token refresh 被當成切換情境。
  2. 新增「只補登記」：核對結果為 null 時，先以 download 加 hash 確認本人物件存在且內容相符，再用**同一個** `documentId`/path 重送 INSERT。PK 與 `(project_id, sha256_hash)` 唯一索引可保證重送安全；衝突時回到唯讀核對。整個過程不重送 bytes、不刪除。
  3. 提供明確的「放棄本機參考」：先下載參考 JSON，再只刪除該 localStorage key，不動伺服器上的物件。

P3（同屬 S4）：
- **P3-b**：`journal.save` 在 DI:213 執行，但情境檢查在 DI:219，而且拋錯時沒有附 `attempt`。如果情境剛好在這兩行之間切換，會留下一筆沒有送出 bytes 的 checkpoint，同樣導致上述永久鎖定。把 save 移到檢查之後，或拋錯時附上 attempt。
- **P3-c**：DI:181 優先使用本機的 `previous`，DI:196 才做重複檢查，且查詢多加了 `organization_id` 條件，但唯一索引只有 `(project_id, sha256_hash)`。雙分頁首次同時提交相同內容時（文件已承認會留下孤兒物件），落敗分頁的 checkpoint 之後會遮蔽勝出分頁的有效收件。建議 `previous` 核對為 null 時，退回做 hash 重複檢查，再決定是否回 `uncertain`。
- **P3-d**：任一筆 recovery key 無效就整體拋錯（IR:306-308），整頁進入 `recoveryError`，且頁面內沒有修復途徑。
- **P3-e**：既存收件重用時，回傳的 `attempt` 保留表單的 `userId`/`documentType`（DI:115 的 `...expected`），`saveReference` 會把它和 `record` 一起輸出（UP:246）。參考 JSON 的 attempt 段會顯示目前使用者，而不是實際上傳者。建議改用 `record` 的值，或在既存重用時省略這兩欄。

## S5：版本前置與未驗範圍 —— 來源通過（漂移偵測偏淺，P3）

- 傳 bytes 前的閘門：`upload_intake_contract` 必須回傳 1 列，且 project/org、版本 `20261102`、`can_write` 全部相符，否則在 bytes 前停止（DI:83-96）。`can_write` 已包含 `deployment_ready()`（M:203）。舊部署沒有這個 RPC 時會得到 `read`。FT:145、ST:257、:274 覆蓋。
- 未知的 Storage catalog ownership：`owner_id` 與舊版 `owner` 都讀不到時 fail closed（M:157-162）。保守，正確。
- **P3-f**：`deployment_ready` 只檢查 policy 名稱、cmd、permissive、roles，以及 trigger 名稱、函式與是否啟用（M:172-196）。它不檢查 `polqual`/`polwithcheck` 表達式、trigger 的 `tgtype`（BEFORE、INSERT/UPDATE）或 helper 函式本體。若 guard 被以同名重建為 `using (true)`，或 trigger 被重建為 AFTER UPDATE only，探測仍回報 ready。這需要具 DDL 權限的人才能做到，因此列為 P3。建議對 `md5(pg_get_expr(polqual, polrelid))` 等值做固定指紋比對，並檢查 `tgtype` 位元。ST:274 只覆蓋缺失與停用的情況。

## 真實服務未驗（與上述來源缺陷分開）

以下項目目前只有替身證據，必須維持 NOT_RUN／BLOCKED，不得當作驗收：

| 項目 | 目前證據 | 未覆蓋 |
| --- | --- | --- |
| Storage RLS 身分 | PGlite `set role authenticated`、`auth.uid()` 讀 GUC（ST:33-38、:98-105） | 真實 storage-api 是否以 `current_user = 'authenticated'` 執行（guard M:90/94/99 依賴此點；若否，會全部 fail closed 造成功能中斷，但不會外洩）、`owner_id` 是否確實寫入 |
| 物件 metadata | stub 有 `metadata jsonb`，但未使用 | 實際 `size`/`mimetype` 內容，影響 P2-S3 的修正 |
| JWT 驗證、PostgREST exposed schemas | 無 | 私有 helper 是否對外不可見 |
| SDK 行為 | 攔截 fetch（FT:71 附近） | 真實 HTTP 錯誤碼與重試，以及 409/413/415 和 bucket `allowed_mime_types`/`file_size_limit` |
| 瀏覽器 | 記憶體合成 File | 原生 chooser、相機 capture、OS 下載參考 JSON、真實 `onAuthStateChange` 時序（P2-S4 的觸發 A） |
| Migration | PGlite 依序載入，並排除 3 個 fixture | 雲端套用、`documents` bucket 建立授權、回退演練 |

## 建議處置

- 本差異內應修：P2-S4（至少修正 1 與 2）、P2-S3（size/mimetype 綁定）。
- 可併入或另開票：P3-a 至 P3-f。
- 修正後請以新的固定 commit 再送審；本回覆只適用於 `71ffcf4`。
