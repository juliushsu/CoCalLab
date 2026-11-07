# Claude 定向唯讀審查回覆：整合驗收（PR #28）H／R／D／L／M＋I1–I6

- 入口文件：`docs/delivery/CLAUDE_INTEGRATION_REVIEW_START_HERE_20261107.md` @ `9839e1f5ab6ab21f0e81975b1d43ff447cf692f7`。
- 各組受審固定 SHA：

| 組別 | 固定 SHA |
|---|---|
| H | `411a99d` |
| R | `67e546f` |
| D | `1b1e829` |
| L | `18c0894` |
| M | `06bad08` |
| I | `6974e18`（核心）＋ `ba2c7a5`（最終整合） |

- 審查方式：
  - 一律以 `git show`／`git diff`／`git grep` 唯讀閱讀固定 SHA，沒有使用移動中的 branch HEAD。
  - **所有測試皆未重跑**。前端 221/221、後端 27/27、SQL／HTTP 308 都是提交者的數字，未經本審查驗證。
  - 沒有修改程式、Git、schema 或資料，沒有操作雲端，也沒有讀取憑證。
- 分工與核實：
  - 六組各由一位獨立的唯讀子審查者撰寫逐題回覆，見下方各節，內容保留原樣。
  - 所有 P2 與跨組結論，主審都已在固定 SHA 上親自核對來源：L-F1／D-F1 的 cascade 與 `for all` policy、R 的 `calculation_results` 寫入 policy 與舊 RPC 授權、H 的唯一索引替換、I 的 restrictive policy 與 trigger、M-1／M-2 的 SECURITY DEFINER 路徑。
  - P3 主要依子審查者的閱讀結果，未逐一重核。
- 本回覆不構成放行、不核准雲端操作或合併。發布維持 HOLD，最終裁定交 CTO。

## 總覽

| 組別 | 歷史固定 SHA 的結論 | 最終整合 `ba2c7a5` 的狀態 |
|---|---|---|
| H 附件 hash | 無 P1／P2，3 項 P3。先前 PR #14／#15 列為 OPEN 的「偽造 SHA 占用 `(project_id, sha256_hash)` 唯一索引」，在來源層面已修復：舊索引已刪除，新索引只涵蓋 `server_verified` 的列 | H 檔案未再修改；005 加上刪除 fence。H-1、H-3 仍存在 |
| R 重算冪等 | R1–R4 來源支持，R5 部分有缺陷：2 項 P2、3 項 P3 | R 檔案未修改，**全部仍存在** |
| D 刪除恢復 | 1 項 P2（D-F1）、3 項 P3 | D-F1、D-F2 已由 006 對一般角色封住；D-F3、D-F4 仍存在 |
| L report ledger | 1 項 P2（L-F1）、2 項 P3；L4 證據不足 | 三項都由 006 在來源層面修復；ledger 的 FK cascade 仍保留 |
| M MANUAL | 3 項 P2、3 項 P3 | M-4 已關閉，**M-1、M-2、M-3、M-5、M-6 仍存在** |
| I 報告完整性 | 無 P1／P2，4 項 P3。兩項 OPEN（一般角色可直接寫入 completed 報告、只有 hash 的歷史列可匯出）在一般 client 路徑上已於來源中關閉 | — |

**`ba2c7a5` 仍未解決的 P2（沒有 P1）：**

1. **X1／R-P2b／M-3：計算結果仍可直接改寫，再被 006 封存。** owner/admin/editor 仍能直接寫入 `calculation_results` 與 `emission_activities`（core schema 的 `for all` policy：`202603160001:618-632`）。`generate-report` 直接讀取 `calculation_results`（`generate-report/index.ts:130`），006 再把讀到的內容當作伺服器發布的報告封存。結果是，被改過的數字會進入「server_verified」報告。
2. **R-P2a：只確認 004 已套用，沒確認 handler 已部署。** 相容性檢查只能證明 migration 004 存在，不能證明新的 handler 已部署。舊的 `recalculate_project_atomic` 仍授權給 service_role（`202610310003:20`），因此舊版或回退的 handler 會繞過重算 ledger；前端的「只查詢、不產生新版本」按鈕會變成每按一次就完整重算一次。撤銷這項授權是安全的：004 是在 SECURITY DEFINER 函式內部呼叫舊 RPC，以函式擁有者身分執行，不依賴 service_role 的授權。
3. **M-1：classify-document 能把已確認的 MANUAL 草稿改回待審。** `classify_document_atomic` 是 SECURITY DEFINER（`202603160010`）。002 的 MANUAL 保護 trigger 只擋 `current_user` 為 authenticated/anon 的情況，所以這個函式會被放行。它不檢查 provider 或狀態，會把任一草稿的 status 改回 `pending_review` 並覆寫 `review_note`。同 org 的 editor 可經由 classify-document edge function 觸發。
4. **M-2：process-document 能讓 MANUAL 草稿失去 latest。** `process_document_atomic`（`202603160009:33-60`）同樣以函式擁有者身分執行，會把 MANUAL 草稿設為 `is_latest=false` 並插入新的 latest 草稿，`ocr_payload` 由 client 提供。確認前觸發會永久阻擋該文件建立 MANUAL；確認後觸發則可能經舊 confirm 路徑產生第二筆活動。

## 跨組發現

- **X1（P2）：直接改寫計算結果的缺口跨越 R、M、I 三組。**
  - 006 封存的是「報告列」，不是「計算來源」。
  - R 的 ledger 能標示被改寫的列屬於歷史資料，但報告產生流程與 006 都不讀 ledger。
  - 建議下一步二選一：讓 `calculation_results`／`emission_activities` 對 client 唯讀（restrictive deny 加上 server-managed trigger）；或讓 generate-report 只採用 R ledger 所確認的 calc_version。
  - 這項可能與入口文件所說的「整表可改寫」已知 OPEN 重疊，請 CTO 判定是否另立一張票。
- **X2（P2）：舊的 SECURITY DEFINER RPC 會穿過新的保護 trigger。**
  - 002／003 的保護 trigger 以 `current_user` 判斷是否為一般角色，因此所有 SECURITY DEFINER 函式都會被放行。
  - 目前已知可利用的入口：classify／process（M-1、M-2，editor 可經 edge function 觸及），以及舊重算 RPC 與舊 v1 `generate_report_atomic`（R-P2a；I 組也建議撤銷）。
  - 建議：舊 RPC 明確拒絕 MANUAL 或已封存的對象；撤銷新 handler 已不再使用的舊 RPC 授權。
- **X3（P3）：三個 migration 用三種方式判斷「一般角色」。**
  - 002／003 用 `current_user`：會讓 SECURITY DEFINER 與 RI cascade 通過。
  - 006 用 `current_setting('role')`：會擋住 cascade，導致「刪除有報告的專案或 org」整筆失敗並回 42501，見 I-P3-3。
  - 005 依 role 設定判斷。
  - 建議統一規則，並在文件中寫明 cascade 與 SECURITY DEFINER 各自的預期行為。
- **X4（P3，NOT_RUN）：多處 lock 順序相反，可能 deadlock。**
  - 位置：H-2（003 的 start／complete 與 Storage delete trigger）、D-F4（MANUAL create／confirm 與 deletion prepare），M 組也指出與 005 可能 deadlock。
  - 結果是 40P01，一方乾淨中止，不會破壞資料完整性，但使用者只會看到泛用錯誤。
  - 建議統一取鎖順序：先 advisory lock，再 row lock。
- **X5：整合後的覆蓋關係與殘留風險。**
  - L-F1、D-F1、D-F2 的根因相同：editor 可直接刪除或修改報告。它們在歷史 SHA 上確實存在，在 `ba2c7a5` 已由 006 對一般角色封住。
  - service_role 的維護路徑仍可移除報告對應，以釋放文件供刪除：005 檢查的是公開的報告列，不是私有封存。
  - 若之後匯出，會得到 MISMATCH，屬於 fail closed，但該文件已經被刪除。

## 既有 OPEN／NOT_RUN（如實保留）

- 真實 Supabase Auth／JWT／Storage HTTP／Deno：NOT_RUN。所有 trigger 都依賴真實環境的 role 設定，這點未驗。
- 兩項獨立 SQL 連線的並行測試：NOT_RUN。L4、I 的並發結論，以及 X4，都只是依鎖語意推論。
- 原生選檔與下載存檔、備份復原、雲端 migration：未驗。
- Mock OCR／AI 尚未完成。
- `payload_hash` 從未被驗證；匯出檔沒有伺服器簽章（I 組附註）。

## 需 CTO 裁定

1. 006 部署後，所有既有報告都會變成不可匯出（回傳 `REPORT_SNAPSHOT_UNVERIFIED`）。是否接受？是否需要經核准的重新封存流程？
2. 刪除有報告的專案或 org 會失敗（I-P3-3／X3）：這是預期中的保留政策，還是需要修正？
3. X1 的修正範圍：在本 PR 內處理，還是另開一張票。
4. 是否撤銷舊 RPC 對 service_role 的授權：`recalculate_project_atomic`、v1 `generate_report_atomic`；`classify`／`process` 則需加上 MANUAL 防護。
5. MANUAL 的範圍檢查沒有綁定 003 的 hash 驗證狀態（M 組列為證據不足），要求必須是 `server_verified` 嗎？
6. D-F3：非 MANUAL 草稿與活動可被 editor 刪除，使報告引用斷鏈。是否擴大 fence 的涵蓋範圍？
7. 006 以整列內容作為封存（I-P3-2）：日後任何 schema 變更都會讓所有報告變成 MISMATCH，需要 migration 守門與重新封存政策。

---

以下為各組逐題回覆（子審查者撰寫，主審已核實其 P2 結論）。


## H 組：服務端附件 hash 驗證：唯讀定向審閱

- 受審固定程式 SHA：`411a99d597046f65dd54fc134df5dc0d8346c346`（對照 `411a99d^`）
- 整合比對 SHA：`ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde`
- 題目來源：`9839e1f:docs/delivery/CLAUDE_ATTACHMENT_HASH_TARGETED_REVIEW_20261106.md`（H1–H5）
- 審閱方式：只用 `git show`／`git diff`／`git grep` 讀原始碼。沒有執行任何測試、npm、雲端或 migration。下文所有測試都標「未重跑」。本文是獨立代理的來源審閱，不能當作 Claude／CTO 的裁定。
- 行號：沒有特別註明時，都是 411a99d 的行號。`003` 指 `backend/supabase/migrations/202611060003_server_attachment_verification.sql`，`005` 指 `202611060005_controlled_document_deletion.sql`（在 ba2c7a5）。

### 呼叫鏈（已追蹤）

1. 前端 `documentIntake.ts:192`（`registerReceipt`）呼叫 `functions.invoke('verify-upload-receipt')`，不再直接 INSERT。
2. Edge function `backend/supabase/functions/verify-upload-receipt/index.ts:12-18` 依序執行：`validateVerificationInput` → JWT 加 `requireOrganizationWriteAccess`（`_shared/authz.ts:17-55`）→ 讀 subscriptions 並呼叫 `enforce_subscription_readonly` → 建立 service-role client 與私有 adapter → 呼叫 `verifyUploadReceipt`。
3. Service `backend/src/services/verify-upload-receipt.js:27-34` 依序執行：`begin_upload_verification` RPC → `state==='reserved'` 時，以 reservation 的 bucket/path/size/MIME 呼叫 `modules/file-verification/index.js:6-37` 實際讀 bytes 並計算 SHA-256 → `complete_upload_verification` RPC → `savedResult` 白名單欄位。
4. Adapter `backend/src/adapters/supabase-private-file.js:2-10` 以 service key 讀 `/storage/v1/object/authenticated/...`，設定 `redirect:'error'`。
5. SQL（003）：`begin`（132-167）與 `complete`（169-197）都是 SECURITY DEFINER，並設 `search_path=''`。兩者只 GRANT 給 service_role（202-203），已明確 REVOKE public/anon/authenticated。私有 authority 表 `cocal_attachment_private.verifications`（8-20）開啟 RLS 且沒有 policy，並 REVOKE 了 public/anon/authenticated/service_role。

### 逐題回覆

#### H1. 服務端是否從受授權原件實算 SHA、普通 API 不能偽造 trusted proof 或占用可信唯一索引、legacy 是否未自動升格

**判定：來源支持**（SHA 411a99d）

依據：
- **hash 來源**：service 只把模組回傳的 `result.sha256` 傳給 complete（verify-upload-receipt.js:31-32）。`client_sha256` 在 begin 就從 intent 剝除（003:137），之後沒有任何地方使用。模組會從 adapter 實際讀取 bytes，檢查 ≤10 MiB、長度須等於 reservation size、核對 PDF/PNG/JPEG header，再計算 digest（index.js:22-34）。
- **唯一索引**：舊的 `uploaded_documents_project_hash_uniq` 已刪除（003:30）。新的部分唯一索引只涵蓋 `hash_verification_status='server_verified'`（003:31-32）。歷史偽造 hash 因此不再占用可信位置。這項先前 review 列為 OPEN 的問題，在 411a99d 的來源層面已處理。
- **普通 API 寫入被擋**：
  - authenticated/anon 對 `uploaded_documents` 的任何 INSERT/UPDATE 都會被 trigger 拒絕（003:96-97）。這裡用的是 `current_setting('role')`，所以舊的 SECURITY DEFINER RPC 只要是由 authenticated 呼叫，同樣會被擋。
  - 另有 restrictive INSERT policy `with check(false)`（003:113）。
  - 任何角色寫入 `server_verified` 時，org/project/sha/verified_at/object id/bucket/path/uploader/size/mime 都必須逐欄等於 `state='verified'` 的私有 authority（003:101-107），否則拋出 42501。
  - authority 表只有 `complete` 會寫入（003:190-192）。
  - DB shape constraint 規定 `server_verified` 必須帶 `server_verified_at` 與 `verified_storage_object_id`（003:27-29）。
- **legacy 不自動升格**：begin 遇到同 ID 已有收件時，拋出 `LEGACY_RECEIPT_REQUIRES_OWNER_REVIEW`（003:150）。complete 的 INSERT 遇到同 ID 會撞 PK。如果 UPDATE 把 legacy 改成 `server_verified`，因為沒有對應 authority，會被 003:101-107 拒絕。
- 舊的 atomic／manual RPC 都只授權給 service_role（`202610310003`、`202611060002:134,172`），而 role GUC 為 service_role 時只會觸發 authority 比對，不會放行 `server_verified` 偽造。

觸發條件與影響：無（未找到繞過）。

殘留，不屬 H 範圍的缺陷：
- 舊的偽 hash 列仍然保留 `sha256_hash` 值。下游報告或匯出是否會把 legacy hash 當成證據，屬於 L/I 組已知 OPEN，H 沒有處理。
- 同一專案內，任何持有相同 bytes 的 editor 先上傳，就會成為該 hash 的可信收件人；後來者只會得到 duplicate。這是專案層級去重的商業範圍，交付文件也說明未改。

測試（已讀、未重跑）：
- `attachment-verification-sql.test.js:17-19`：加入 broad permissive policy 後，INSERT 仍得 42501。
- 同檔 26-30：legacy 偽 hash 不阻擋新收件、同 ID 不升格。
- 同檔 47-54：authenticated 呼叫 RPC 或寫私有表都得 42501。
- `attachment-verification-http.test.js:17-25`：假的 `client_sha256` 不被採用。
- 同檔 44-53：viewer、無效 JWT、跨專案、多餘欄位都被拒。

缺少的回歸測試：
- 沒有測「由 authenticated 呼叫、會寫 `uploaded_documents` 的 SECURITY DEFINER 函式」。來源以 role GUC 防護，但沒有負例。
- 沒有測 service_role 以 PATCH 把 legacy 改成 `server_verified` 的負例（只有 SQL 觸發器的邏輯可依）。

#### H2. begin/read/complete 是否綁定 object generation、owner、size/MIME、scope 與當下角色／訂閱；普通角色能否 delete/recreate 繞過

**判定：來源支持**（SHA 411a99d）。附一個 P3 競態觀察（H-2）。

依據：
- **begin 的綁定**（003:139-164）：
  - path 由 project/document 推導，必須等於輸入值（141）。
  - Storage 物件的 `owner` 必須等於 actor（153）。
  - metadata 的 size/mimetype 型別與值必須等於輸入（153-159）。
  - 副檔名必須與 MIME 相符（160-162）。
  - authority 記錄 `storage_object_id`、`owner_id` 與完整 `object_metadata`（163-164）。
- **complete 的重新核對**：先在 path advisory lock 下 `FOR UPDATE` 重讀 reservation（177-178），再以 `assert_object` 核對 object id、owner 與 metadata 全等（50-60），也核對觀察到的 size/MIME（180）。
- **result 的核對**：對既存 authority 也重跑 `assert_object`（126）。
- **角色與訂閱**：begin（138）與 complete（175）都呼叫 `assert_write`（34-48）。它以 `FOR SHARE` 鎖住 active 組織／專案、active owner/admin/editor 成員列，以及最新一筆 subscription（含 grace 計算）。重讀既存結果時也會先過 `assert_write`，所以撤權後無法經由 edge 重讀。Edge function 另外先做一次 TS 層的 role 與 subscription 檢查（index.ts:13-16）。
- **delete/recreate**：
  - `protect_object` trigger（72-84）對 authenticated/anon 的 INSERT/UPDATE/DELETE，只要 path 已 reserved/verified/duplicate 就拒絕（42501）。改名到 reserved 目的地也拒絕（79-80）。
  - verifications 列永不刪除，所以 path 永久受保護。
  - 舊的 `cocal_upload_update_guard` 原本就禁止 client 對這三個 bucket 做 UPDATE（`202611020001:101-103`）。

**H-2（P3，信心中）鎖順序反轉可能造成 deadlock，但沒有繞過**
- 位置：begin 先取 advisory lock（003:144），再 `FOR UPDATE` storage.objects 列（003:151）。complete 同樣是 177 取鎖，再於 179 經 `assert_object` 的第 56 行鎖列。反過來，authenticated 對 storage.objects 做 DELETE/UPDATE 時，PostgreSQL 在 BEFORE ROW trigger 前會先鎖住該 tuple，之後 `protect_object` → `path_is_reserved` 才取同一個 advisory key（003:69）。
- 觸發條件：同一物件上，begin（或 complete）與 Storage 刪除／改寫幾乎同時發生，而且各自先取得第一把鎖。
- 影響：PostgreSQL 偵測 deadlock 後中止其中一方（40P01），使用者看到可重試的錯誤。我推演了兩種中止順序，結果都一致：要嘛刪除失敗，要嘛 reservation 未建立而刪除成功，之後 begin 找不到物件。沒有繞過或錯誤綁定。
- 最小重現（合成，需要兩條獨立連線，NOT_RUN）：
  - 連線 A：`begin; select pg_advisory_xact_lock(hashtextextended('attachment:staging-receipts/<path>',0));`
  - 連線 B（以 authenticated 身分）：`delete from storage.objects where bucket_id='staging-receipts' and name='<path>';`，B 會先鎖列，然後在 advisory 上等待。
  - 連線 A：`select 1 from storage.objects where ... for update;`，此時形成 deadlock。
- ba2c7a5 中，005 的 `object_guard`（005:122）在 trigger 內取 advisory lock，也是同一模式。

其他未驗範圍（證據不足）：
- 真 Supabase Storage 寫入時，`current_user` 或 role GUC 是否確實為 authenticated（`protect_object` 用的是 `current_user`，003:76）。
- 真 Storage metadata 是否帶 eTag/version，能否作為 generation 綁定。合成 harness 的 metadata 只有 `{size,mimetype}`（`worker.js` 的 storageRead），所以測試中的 generation 綁定實際只靠 row id。
- S3 protocol 或 TUS 上傳路徑。
- 以上都是 NOT_RUN。

一致性觀察（證據不足，不列 finding）：
- `protect_object` 以 `current_user` 判定（003:76），`protect_receipt` 則以 role GUC 判定（003:94）。
- 如果存在「由 authenticated 呼叫、會 DELETE 或 UPDATE storage.objects 的 SECURITY DEFINER 函式」，就能繞過 `protect_object`。411a99d 只找到 `purge_staging_data`，而它僅授權給 service_role（`202604070004:383-386`），所以目前沒有可觸發的路徑。
- ba2c7a5 的 005:123 改以 role GUC 拒絕 authenticated 的 DELETE/UPDATE，已補上這個不一致。

測試（已讀、未重跑）：
- SQL 20-25：replay、改 intent、換 actor。
- SQL 35-46：delete/recreate、metadata、收件刪除都被拒。
- SQL 47-50：object id、owner、size/MIME 漂移。
- HTTP 26-33：壞內容或讀取失敗時保留 reservation。
- ba2c7a5 新增 `tenant-revocation-integration.test.js:90-95`：在 complete 前撤權會被拒，恢復權限後可沿用同 ID 復原。這是序列測試。

缺少的回歸測試：
- 兩條獨立 SQL 連線下的鎖等待與 deadlock（NOT_RUN）。
- begin 與 complete 之間 subscription 轉為 readonly 的負例。
- 真 Storage 的 upsert 與版本化。

#### H3. 同一 intent 重送、回覆遺失、讀取失敗能否持久恢復；duplicate proof 是否歸屬既存 receipt；跨 env／封存衝突是否不回假成功

**判定：服務端「來源支持」；前端 fallback 有一項 P3（H-3）**（SHA 411a99d）

服務端依據：
- **重送**：同一 document ID 會在 lock 下取回 reservation，要求 actor 與 intent 全等，否則回 `verification_request_intent_conflict`（003:145-148）。
- **complete 重入**：如果已非 reserved，要求 hash 相同後回傳既存結果（003:181-183）。
- **讀取失敗**：reservation 保持 reserved，重試時不需重新上傳 bytes（service 27-33）。
- **duplicate**：在 `verified-hash` advisory lock 下，以服務端算出的 hash 查找 `server_verified` 目標（003:185-186）。結果回傳目標收件，以及目標 authority 的 proof（003:120-129）。service 再核對 proof 與收件逐欄一致（verify-upload-receipt.js:24）。
- **跨 env 或已封存**：明確拋出 `HASH_EXISTS_DIFFERENT_LIFECYCLE_OR_ENV`（003:188-189、122-123），reservation 保留。不會回 200。

**H-3（P3，信心中高）前端失敗 fallback 用 client hash 推定 duplicate 歸屬**
- 位置：`frontend/readdy-app/src/services/documentIntake.ts:201-204`。`registerReceipt` 的 catch 會呼叫 `reconcileIntake`，後者（184-187）以 `existingByHash`（165-173）查詢，條件是 `.eq('sha256_hash', attempt.sha256Hash)`，也就是瀏覽器算的 hash，再加上 `server_verified`。
- 觸發條件：
  - edge 呼叫在 begin/complete 提交前失敗，例如 5xx、逾時、網路中斷、`FILE_SIGNATURE_INVALID`，或 reservation 卡在 reserved。
  - 同時，該專案已有一筆 active 的 server_verified 收件，其 hash 等於本機檔案 hash。
- 影響：
  - UI 把此次 attempt 呈現為「已存在可信收件 X」，並附 `recoveryReference`。但服務端從未讀過這次上傳的物件，並未證明它等於 X。
  - 新物件可能停在 reserved 或未登記狀態，在 411a99d 一般角色無法刪除。
  - 這不是信任提升，X 本身確實經服務端驗證，也只影響操作者自己的畫面。但「duplicate 歸屬」在這條路徑上是 client 斷言，與交付文件「同內容不同 ID 由服務端計算後回傳」的語意不一致。
- 最小重現（合成）：
  1. 上傳 PDF P 並完成驗證，得到 X。
  2. 再次選同一個 P，讓 `uploadIntake` 走到上傳。例如第 235 行預查時 X 尚不可見，或以另一個 tab 競態。
  3. 對 `/functions/v1/verify-upload-receipt` 注入一次 `failNext` 500（beforeDispatch）。
  4. `uploadIntake` 會回傳 X，加上 `recoveryReference`，而不是 `uncertain`。服務端此時沒有這次新 ID 的 duplicate 紀錄。
- 修正方向：在 catch 中以相同 ID 重新呼叫 edge。edge 本身是冪等的，可以用服務端結果歸屬，而不是靠 client hash。
- ba2c7a5 狀態：未修。只多了 `deletion_state` 過濾（documentIntake.ts 的 existingByHash 增加 `.eq('deletion_state','active')`）。

其他（P3 以下，不列 finding）：
- 在 411a99d，自己的 verified 收件如果被 service 維護封存，replay 會得到 `HASH_EXISTS_DIFFERENT_LIFECYCLE_OR_ENV`（003:122）。錯誤碼語意不精確，但屬 fail-closed。
- 在 411a99d，reservation 卡在 reserved 或 duplicate 時，沒有任何一般角色的釋放路徑，原件永久保留，交付文件已明示。ba2c7a5 的 005 `document_deletion_request` 允許原 reserving actor 對 reserved 狀態走受控刪除（005:178-183、193-199）。

測試（已讀、未重跑）：
- HTTP 34-43：begin/complete 在 afterCommit 時回覆遺失、duplicate 沿用目標 proof、duplicate 原件受保護。
- HTTP 68-75 與 SQL 56-63：env 或封存衝突回 409 並保留 reservation。
- HTTP 55-60：前端 preflight 與重送。

缺少的回歸測試：
- 前端 edge 失敗時走 `existingByHash` fallback 的情境（H-3）。
- 兩個並行 complete 同 hash 不同 ID 的獨立連線測試（目前只有 advisory lock 加唯一索引的來源推論，NOT_RUN）。

#### H4. catalog compatibility 不是權限控制；private helper ACL、schema/table 隔離與普通 direct API 是否足夠；service-role 維護與獨立 SQL race 未實測

**判定：來源支持**（SHA 411a99d）

依據：
- **compat 與權限分離**：
  - `upload_verification_contract`（003:224-231）只回報 `can_verify`，授權給 authenticated。
  - begin/complete 不依賴 `deployment_ready`，權限完全由 GRANT（202-203）、trigger（83-84、111-112）、policy（113）與 `assert_write` 執行。
  - catalog 指紋（208-216）納入函式定義、ACL、owner、config，以及 trigger、policy、index、table 的 RLS/ACL。之後若有人加 grant，只會讓 `can_verify=false`，不會放寬權限。
- **ACL**：
  - schema 先 REVOKE 全部角色（7），只把 USAGE 給 authenticated/anon（200）。這是 invoker trigger 呼叫 `path_is_reserved` 所必需。
  - 所有私有函式都 REVOKE，包含 service_role（199、230），只把 `path_is_reserved` GRANT 給 authenticated/anon（201）。
  - `verifications` 開 RLS 且沒有 policy，並 REVOKE 全部角色（19-20）。
  - `source_baseline` 也 REVOKE 全部角色（207）。
  - 函式建立後才 REVOKE，所以能抵銷 Supabase public schema 的 default privileges。
  - 所有 SECURITY DEFINER 都設 `search_path=''`，且全部以 schema 限定名稱引用。
  - `protect_object` 與 `path_is_reserved` 的寫法安全。
- **只有 service_role 能寫可信狀態**：authority 只能經 `complete`（service_role）寫入。service_role 本身對私有表沒有任何權限（20），不能用 PostgREST 直接寫 authority。service_role 直接寫 `uploaded_documents` 時，只能寫 legacy，或寫與 authority 逐欄相符的 `server_verified`（101-107）。

證據不足：
- `path_is_reserved` 對 anon/authenticated 可執行，能用來探測任一可讀專案 path 是否已 reserved，並可自取 advisory xact lock。只有當 `cocal_attachment_private` 被加入 PostgREST exposed schemas 時，普通 API 才能觸及；source 中沒有這樣做。資訊外洩面有限。
- 獨立 SQL 連線 race、真 Supabase JWT/Storage/Deno 都是 NOT_RUN。本文不以 PGlite 的序列執行或 Promise.all 推論並行正確性。
- trusted service-role 維護（例如 `purge_staging_data` 刪除收件後留下孤兒 authority）不在一般角色保證範圍內，交付文件已明示。

測試（已讀、未重跑）：
- SQL 47-54：authenticated 呼叫 begin、寫 verifications、anon/authenticated 呼叫 `receipt_is_reserved` 都得 42501。
- HTTP 49：PostgREST 呼叫 `begin_upload_verification` 得 42501。

缺少的回歸測試：
- 刻意加 grant 或 policy 漂移後 `can_verify=false` 的負例（我沒有找到）。
- 真 PostgREST exposed-schema 設定的驗證。

#### H5. 舊 client 的 INSERT 契約不相容與版本切換、可信原件暫時禁止舊刪除、未授權雲端套用是否明示

**判定：大致來源支持；舊 client preflight 未主動關閉（H-1，P3）**（SHA 411a99d）

依據：
- **可信原件禁止舊刪除**：
  - 前端在 `documentLibrary.ts:106` 遇到 `server_verified` 直接拒絕。
  - SQL 端，authenticated 刪除 `server_verified` 或已 reserved 的收件會被拒（003:98）。
  - 原件 path 的刪除也被拒（003:78）。
- **雲端未授權**：003:1 標示「SOURCE ONLY. Owner approval is required」。交付文件的「部署與維運範圍」也明示。
- **新 client 的處理**：新 client 先檢查舊契約，再檢查新契約（`documentIntake.ts:101-107`）。缺少新契約時，在送出 bytes 前就停止（HTTP 58 有驗）。

**H-1（P3，信心高）舊 client 的 preflight 在新 schema 下仍回 `can_write=true`**
- 位置：
  - `202611020002_storage_receipt_review_fixes.sql:129-136`：`upload_intake_contract` 仍回傳 `20261102.2` 與 `can_write`，條件只看舊的 `cocal_storage_private.deployment_ready`。
  - 舊的 catalog（同檔 67-104）只對具名的舊 guard 取指紋，003 沒有改動它。
  - 同時 003:97 與 003:113 拒絕 client INSERT。
- 觸發條件：仍在執行舊前端（411a99d^ 版 `documentIntake.ts:86-97`）的使用者，在套用 003 後上傳。
- 影響：
  - 舊 client 的 preflight 通過，bytes 寫入 Storage，接著收件 INSERT 得 42501，留下未登記原件，畫面停在 `uncertain`。這不是信任問題，屬於版本切換時的資料殘留與 UX 問題。
  - 在 411a99d，使用者可經舊流程刪除孤兒原件，因為該 path 未被 reserve。
  - 在 ba2c7a5，005:123 拒絕 authenticated 對這三個 bucket 的 DELETE，孤兒只能經新的受控刪除處理（005 的 orphan 分支，要求 owner 等於 actor）。
  - 交付文件只寫「須安排明確版本切換」，來源沒有讓舊契約 fail-closed。
- 最小重現（合成）：
  1. 在 003 後的 PGlite 以 authenticated 呼叫 `select * from upload_intake_contract('<project>')`，結果為 `can_write=true`。
  2. INSERT storage.objects，成功。
  3. INSERT `uploaded_documents`，得到 42501。
- 修正方向：在 003 中讓 `upload_intake_contract` 回 `can_write=false`，或改變其版本，讓舊 client 在送出 bytes 前就停止。

測試（已讀、未重跑）：HTTP 58（新契約缺少時寫入數為 0）。沒有舊 client 對新 schema 的測試。

缺少的回歸測試：
- 舊契約 `20261102.2` 在 003 後應為 fail-closed 的負例。

### Findings 彙總

| ID | 等級 | 位置（411a99d） | 觸發條件 | 信心 | ba2c7a5 狀態 |
|---|---|---|---|---|---|
| H-1 | P3 | `202611020002:129-136` 搭配 `003:97,113` | 舊前端在 003 後上傳：preflight 通過、bytes 已寫入、INSERT 得 42501，留下孤兒原件 | 高 | 未修。孤兒原件改由 005 受控刪除處理，一般 DELETE 已被 005:123 擋下 |
| H-2 | P3 | `003:144/151`、`177-179/56` 對 `003:69/76` | 同一物件上，begin/complete 與 authenticated Storage 刪除或改寫並行，鎖順序反轉，產生 40P01 | 中（NOT_RUN） | 同一模式也存在於 005:122 |
| H-3 | P3 | `documentIntake.ts:165-173,184-187,201-204` | edge 失敗，且專案中已有同 client hash 的可信收件時，前端回報 duplicate 成功，但服務端未驗證此物件 | 中高 | 未修，只加上 deletion_state 過濾 |

沒有 P1/P2 finding。先前 OPEN 的「client 斷言的 sha256 可占用 (project_id, sha256_hash) 唯一索引」，在 411a99d 的來源層面已處理（003:30-32、96-113）。這是來源判斷，不是真 Supabase 驗收。

### 歷史（411a99d）與整合（ba2c7a5）差異

- 003 本身在 ba2c7a5 未變。edge function、adapter、module 也未變（`git diff 411a99d ba2c7a5` 沒有差異）。
- `verify-upload-receipt.js`：`VERIFIED_RECEIPT_FIELDS` 增加 `deletion_state`、`deleted_at`、`deletion_request_id`，沒有安全語意變更。
- 005 以「字串精確替換」修改 003 的函式，並在置換前核對舊片段只出現一次（005:297-330），同時只更新對應的 baseline 指紋（005:333-335）：
  - 部分唯一索引改為同時排除 `deletion_state='deleted'`（005:295-296）。complete 的目標查找同步排除已刪除收件（005:297-300）。目標為 pending 時拋出 `DOCUMENT_DELETE_PENDING`（005:316-318）。
  - begin、complete、result 都加上 `assert_unfenced`，已刪除或刪除中的 ID 或 duplicate 目標不能復活（005:310-324）。
  - `object_guard` 以 role GUC 拒絕 authenticated/anon 對三個 bucket 的 DELETE/UPDATE（005:123），補上 003 `protect_object` 只看 `current_user` 的不一致。`receipt_guard` 拒絕 authenticated 刪除收件（005:85）。
  - reserved 或 duplicate 卡住的 attempt，可由原 actor 走受控刪除（005:178-199）。這補上了 411a99d 沒有釋放路徑的問題。
- 前端：`attachmentVerificationView.ts` 與 `documentIntake.ts` 只加入 `deletion_state` 呈現與過濾。`documentLibrary.ts` 改用新的受控刪除流程。H-3 的 client hash fallback 仍在。
- 新增測試（已讀、未重跑）：`tenant-revocation-integration.test.js:90-95`（complete 前撤權後復原）、`document-deletion-http.test.js:14-30,60,105`（刪除後舊 authority 不能復活、未登記原件的後續驗證會失敗）。

### NOT_RUN 與需 CTO 裁定

- NOT_RUN：
  - 真 Supabase JWT/Storage/Deno（含 storage-api 實際的 role 與 metadata/eTag 行為）。
  - 獨立 PostgreSQL 連線的鎖等待、deadlock 與並行 complete。
  - 雲端 migration、備份與還原。
  - 所有測試本文都未重跑，提交者的 13/13、19/19 等數字並未經本文驗證。
- 需 CTO 裁定：
  - H-1：舊契約是否應在 003 中 fail-closed。
  - H-3：前端 fallback 是否應改為以同 ID 重呼叫 edge，而不是用 client hash 歸屬。
  - legacy 偽 hash 列對下游報告或匯出的影響，屬於 L/I 組。


## R 組：重算冪等定向審查（唯讀來源審查）

- 受審固定程式 SHA：`67e546fa6894303ccbff66d829d077b93c5fb8e2`（對 `67e546f^` 差異）
- 題目來源：`docs/delivery/CLAUDE_RECALCULATION_TARGETED_REVIEW_20261106.md` @ `9839e1f`；交付說明 `RECALCULATION_IDEMPOTENCY_DELIVERY_20261106.md` @ `9839e1f`
- 整合核對 SHA：`ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde`
- 方法：只用 `git show` / `git diff` / `git grep` 讀來源與測試。**所有測試均未重跑**；未連任何真 Supabase／JWT／Deno；未做獨立 SQL 連線並行。本節是獨立代理的來源審閱，不代表 Claude／CTO 裁定。
- 下文 `004` 指 `backend/supabase/migrations/202611060004_recalculation_requests.sql`，`handler` 指 `backend/supabase/functions/recalculate-project/index.ts`，行號都以 67e546f 為準。

---

### 逐題結論

#### R1. 相同 scope／JWT actor／request／force／formula 與有效輸入重試，是否回原 ID／原版本、不重寫 audit；回覆遺失時能否查回

**結論：來源支持**（SHA 67e546f）

- 來源位置
  - handler:16-20：actor 取自 `requireOrganizationWriteAccess` 解出的 JWT user，不採用 DTO 的 `actor_user_id`。
  - 004:85-92：prepare 找到既有 row 時，actor、force 或 formula 不同就丟出 `RECALCULATION_REQUEST_INTENT_CONFLICT`；輸入改變丟出 `INPUT_CHANGED`；結果已不是 latest 丟出 `RESULT_SUPERSEDED`。只有 completed 且仍是 latest 時才回 `replayed=true`。
  - handler:27-29：prepare 回 completed 就直接回傳，不進 commit，也不寫 action log。
  - 004:120-128：commit 以 `FOR UPDATE` 鎖住 request row；`saved_result` 已存在時直接回原結果，不呼叫 `recalculate_project_atomic`，所以不會再寫一筆 audit_logs。
  - 兩個同 ID 的並行請求：`require_scope` 在 project row 上取 `FOR NO KEY UPDATE`（004:25），把 prepare 與 commit 都串行化。後到的一方在 READ COMMITTED 下以新 snapshot 讀到已提交的 row，因此走 replay 路徑；就算沒被串行化，PK（004:12）也會擋下重複 insert。
  - 查回路徑：`action:'lookup'` 唯讀（004:93-97），回 not_found／pending／completed／historical。
- 觸發：同 body 重送；或 commit 成功後回覆遺失（HTTP 測試以 `failNext afterCommit` 模擬）再 lookup 或重送。
- 實際影響：不會產生第二個 calc_version，也不會產生第二筆 audit_logs。
- 測試（已讀、未重跑）：`recalculation-idempotency-http.test.js:21-46, 71-88`；`recalculation-idempotency-sql.test.js:47-58`；frontend `calculationWorkflow.test.ts`。
- 附帶（P3，見 R-F4）：`action_logs` 在交易外寫入（handler:42-46）。若 SQL 已 commit 但 handler 在寫 log 前就中止，重送會走 replay 而略過 log，這筆 action_log 就永久缺漏。SQL 內的 audit_logs 仍在，所以只是營運 log 不完整。
- 缺少的回歸：真正獨立 SQL 連線下，同一 request 兩個 commit 並行（現有測試 skip，見 SQL 測試:103）。

#### R2. canonical activity／factor 完整快照、fresh compare、DB max+1、實際 result IDs／content，能否避免舊輸入或被改結果被當成 current；pending／not_found／historical 是否正確

**結論：來源支持**（ledger 本身）。直接寫入造成的版本溢位 DoS 另列 P3（R-F3）；報表不消費 ledger 的問題另列 P2（R-F2）。

- 來源位置
  - 004:43-54：`inputs()` 在 SQL 內聚合本 project 所有 `status='active'` 的 activities，加上所有 active 的 org 與 global factors，因此沒有 REST 分頁上限。activity 欄位涵蓋 `calculate-emission-activity.js` 與 `resolve-emission-factor.js` 用到的全部欄位。factor 只排除 created_at、updated_at、metadata，計算器不讀這三欄（已 grep 確認）。
  - 004:118-123：commit 先取 project 鎖與兩張來源表的 SHARE 鎖，再重算 fresh，並同時比對 ledger 存的 snapshot 與 handler 傳入的 snapshot。
  - 004:129-137：比對 payload 筆數、activity 不重複、activity 屬於 fresh、org／project／formula 一致；calc_version 一律由 SQL 以 `max+1` 覆寫，忽略 caller 給的值。
  - 004:140-148：實際讀回 is_latest 的結果，筆數不符就 rollback；`result_snapshot` 存整列 `to_jsonb(c)`。
  - 004:67-74：判斷 latest 需同時滿足三項：completion_order 是本 project 最大值；每個 ID 仍是 is_latest 且 org／project 正確；整列內容與 snapshot 一致。
- 能否被偽造成 current：不能。core schema:345-347 的 partial unique index 限制每個 activity 只能有一筆 is_latest。所以任何路徑要替同一 activity 寫入新的 latest（舊 RPC、confirm_draft_atomic、manual confirm、一般編輯者直接 UPDATE／INSERT），都必須先把原 row 改成 is_latest=false 或改動原 row。BEFORE UPDATE trigger 會強制更新 `updated_at`（core:471-473），因此內容回不到原 snapshot，判定只會變成 historical，不會變成 completed。
- 狀態語意：pending 沒有計數、ids 為空（004:61-65）；not_found 只出現在 lookup，且不插入 row；historical 會分開回報 `input_matches_current` 與 `results_are_latest`（004:72-74）。frontend `manualWorkflow.ts:76-83` 也拒絕不一致的組合。
- 測試（已讀、未重跑）：SQL 測試:35-58, 93-101, 105-117；HTTP 測試:48-69, 104-112。
- 缺少的回歸：caller 傳入 snapshot 與 ledger snapshot 不一致；calc_version 已接近 int 上限（R-F3）。

#### R3. private authority／ACL、SQL scope／member／latest subscription 與 rollback 是否完整，普通 direct API 能否偽造 request 權威

**結論：ledger 權威本身來源支持。** 但舊 RPC 仍可由 service_role 直接寫入、繞過 ledger，列入 R-F1（P2）；`calculation_results` 仍可直接寫入，列入 R-F2（P2，既有 OPEN）。

- ACL
  - 004:3-4, 15-17, 152：private schema、表、序列、函式都對 public、anon、authenticated、service_role 撤權，RLS 開啟且沒有 policy。
  - 004:153-154：`recalculation_request_v2` 與 `commit_recalculation_v2` 撤掉 public、anon、authenticated（同時涵蓋 Supabase 對 public schema 的 default grant），只授權給 service_role。
  - 所有函式都是 SECURITY DEFINER 並設 `search_path=''`，內文全部使用 schema 限定名。
- `recalculation_contract`（004:156-170）開放給 authenticated，只回傳呼叫者自己 active 成員身分下的 project 及一個布林值。它內部呼叫 `require_scope`，會短暫取得 project 的 NO KEY UPDATE 列鎖；沒有資料外洩，影響可忽略。
- scope 與撤權：`require_scope`（004:19-38）檢查 project 屬於該 org、org 為 active、actor 是 active 且角色為 owner、admin 或 editor、最新一筆 subscription 在時效內且為 active 或 grace_period。prepare、commit、lookup 都會重查（004:82, 114）。
  - member 與最新 subscription 以 `FOR SHARE` 鎖住，所以 commit 期間對這兩列的降權 UPDATE 或 DELETE 必須等 commit 結束。
  - 並行 INSERT 一筆更新的 subscription 不會被鎖擋下（phantom），等同 commit 線性化在該 INSERT 之前，可接受。
  - 這個判定與 `enforce-subscription-readonly.js` 一致，並多加了 `period_start` 檢查。
- rollback：PostgREST RPC 是單一交易，commit 失敗不會留下 latest、audit 或 completion（SQL 測試:60-71, 105-117）。
- 普通 API：authenticated 直接讀寫 ledger、呼叫 helper 或 v2 RPC 都會被拒（SQL 測試:21-33，HTTP 測試:82-83）；`recalculate_project_atomic` 對 authenticated 已撤權（`202610310003`:18-21，`product-preview.test.js:84-85`）。
- 舊路徑：`recalculate_project_atomic` 仍授權給 service_role（202610310003:20），可完全繞過 ledger 寫入新的 latest。它無法讓 ledger 誤報 completed（理由見 R2），但能讓舊版或回滾的 edge handler 持續做非冪等寫入，見 R-F1。
- 測試（已讀、未重跑）：上列各測試，以及 ba2c7a5 新增的 `tenant-revocation-integration.test.js:84-88`（在 prepare 與 commit 之間撤權，屬序列插入，不是並行）。

#### R4. 短暫的來源表 SHARE 鎖加 project NO KEY UPDATE 的已知範圍與負載限制、004 是否以交易包覆、未驗證獨立 SQL 連線並行是否如實揭露

**結論：來源支持（揭露如實）；真實並行屬證據不足（NOT_RUN）。**

- 004:2 與 004:171 以 `begin;…commit;` 包覆整個 migration。
- 004:23-25 的註解與做法一致：NO KEY UPDATE 與 FK 的 KEY SHARE 相容，所以 activity INSERT 不會與 project 鎖互卡。
- 004:115-118 已註明 SHARE 鎖是整張表層級，會延遲其他 project 甚至其他 tenant 的 activity／factor 寫入。
- 補充一點文件未明講的行為：commit 在等待 SHARE 鎖期間，仍持有 project、member、subscription 的列鎖，且之後排隊的寫入者都會被卡住（convoy）。同 project 的 lookup 也要取 NO KEY UPDATE，因此也會等待。這屬於已揭露的吞吐限制，不另列缺陷。
- 鎖序：我在 002（manual confirm）、003、005（刪除與 processing lease）、006（report）的函式中，沒有找到「先寫 emission_activities 或 factors，再鎖 projects、member 或 subscription 列」的路徑，所以來源上沒有看到 deadlock 環；ba2c7a5 也沒有任何 `update public.projects`。這只是來源推論，獨立連線下的 lock-wait 與 deadlock 仍是 NOT_RUN（SQL 測試:103 明示 skip）。
- 缺少的回歸：雙連線測試，涵蓋 commit 與 activity INSERT、commit 與 member 降權、同 request 雙 commit 三種組合。

#### R5. frontend 的 durable 範圍與舊 context、損壞 journal 的明確放棄、不取消 server、舊 client 相容性、report pending gate 是否正確

**結論：部分仍有缺陷。** 新 client 遇上舊 handler 的閘門失效列為 R-F1（P2）；journal 範圍與 report gate 列為 R-F5（P3）；其餘來源支持。

- 來源支持的部分
  - `calculationRecovery.ts:5`：key 綁定 org、project、user，且都經 canonical UUID 正規化。
  - `calculationRecovery.ts:14-17`：寫入後立即讀回比對，失敗就不發送請求。
  - `calculationRecovery.ts:7-9`：journal 損壞就丟錯，不會自動換新 ID。
  - `calculationRecovery.ts:21-25`：只有明確按「放棄」才移除，且以 captured raw 比對後才刪；只動本機，不呼叫 server。
  - `EmissionActivitiesListPage.tsx:46, 73`：切換 context 時重設狀態，載入完成後才重讀 journal。
  - `EmissionActivitiesListPage.tsx:82`：`isCurrent()` 失效時不清除 journal，回到原頁可再 lookup。
  - 舊 client 對新 handler：舊 client 每次點擊會帶 `crypto.randomUUID()`，新 handler 在沒有 action／formula 時預設為 calculate 與 v1.0.0，回傳結構仍滿足舊驗證，能正常運作。完全沒帶 request_id 的請求回 400（`contracts.js:185-186`）。
- 缺陷：見 R-F1、R-F5。
- 測試（已讀、未重跑）：`calculationRecovery.test.ts` 4 項、`calculationWorkflow.test.ts` 6 項、HTTP 測試:114-127。

---

### Findings

#### R-F1 [P2] 相容閘門只證明 DB 有 migration 004，不證明 handler 已更新；舊 RPC 仍授權給 service_role，舊或回滾的 handler 能繞過 ledger 持續做非冪等寫入

- 狀態：67e546f 仍有缺陷；ba2c7a5 未變，仍有缺陷。
- 位置
  - `004:156-168`：版本字串 `'20261106.recalc.1'` 是 DB 函式回傳的值。
  - `frontend/readdy-app/src/services/manualWorkflow.ts:71-75`：client 只檢查這個 DB 版本。
  - `manualWorkflow.ts:85`：之後才呼叫 edge function。
  - `202610310003_atomic_rpc_service_role_only.sql:20`：舊 RPC 仍授權給 service_role。
  - 舊 handler `67e546f^:backend/supabase/functions/recalculate-project/index.ts:23, 52-88`：不認識 `action`，每次都計算並呼叫 `recalculate_project_atomic`。
  - 舊驗證器 `67e546f^:backend/src/contracts/contracts.js:177-186`：不拒絕未知欄位。
- 觸發：migration 004 已套用，但 edge function 尚未重新部署，或 edge function 單獨回滾。這是「先 schema 後 function」部署順序中的正常窗口，也包括只回滾 function 的情況。
  - 新 client 按「核對待確認計算（不新增版本）」送出 `{action:'lookup',…}`：探針回 recalc.1，通過；舊 handler 卻執行完整重算，寫入新的 calc_version、一筆 audit_logs、一筆 action_log。
  - 回應沒有 `request_id`，`calculationResult` 拋錯（`manualWorkflow.ts:78`），UI 顯示失敗並保留 journal。使用者再按「核對」或「重試」，每按一次就多一個版本。
- 實際影響：與交付聲稱「以版本化 contract 阻擋舊的不冪等 handler」相反。在部署偏差期間，標示「不新增版本」的按鈕仍會新增版本並寫 audit。ledger 不會被汙染（舊路徑寫入只會讓舊 request 變成 historical），但冪等保證失效。
- 最小合成重現：在 PGlite 套用到 004 → 掛載 `67e546f^` 的 handler → 呼叫 `lookupManualCalculation(client, scope, user, id)` 兩次 → `select count(*) from calculation_results` 得到 2，audit_logs 也是 2，而預期是 0。
- 建議最小修正（僅供參考，未實作）：在 004 對 service_role 撤銷 `recalculate_project_atomic` 的 EXECUTE。`commit_recalculation_v2` 以 definer owner 身分仍能呼叫它，而舊 handler 會 fail closed。也可以改成由 handler 在回應中回報 contract 版本，client 驗證不符時停止後續操作。
- 缺少的回歸：「004 已套用加舊 handler」組合下，新 client 必須在送出前停止，或 server 端拒絕寫入。

#### R-F2 [P2，既有 OPEN／跨組] `calculation_results` 仍可由 owner、admin、editor 直接 INSERT／UPDATE／DELETE；ledger 偵測得到竄改，但報表產生與 006 封存都不消費 ledger 狀態

- 狀態：67e546f 仍有缺陷（交付文件已自承「未全面收緊」）；ba2c7a5 仍有缺陷，005 與 006 都沒有修改 `calculation_results_write_policy`。
- 位置
  - `202603160001_v1_core_schema.sql:626-632`：寫入 policy。
  - `ba2c7a5:backend/supabase/functions/generate-report/index.ts:129-143`：直接讀 `is_latest` 的結果組成報表。
  - `ba2c7a5:202611060006_report_snapshot_integrity.sql`：沒有引用 `calculation_results` 或 `cocal_recalc_private`。
- 觸發：editor 送出 `PATCH /rest/v1/calculation_results?id=eq.<latest> {co2e_kg:999}`，HTTP 測試:108 已證明會回 204，然後產生報表。
- 實際影響：ledger lookup 會回 historical（R2 成立），但報表仍以 999 計算，並被 006 以 server_verified 封存。frontend 的 report gate 只看本機 journal，不會攔下。結果是同 tenant 的寫入者可以繞過公式與係數，偽造已封存報告的排放數字。
- 最小合成重現：HTTP 測試:104-109 的前段流程，接著呼叫 `generate-report`，報表 `gross_emissions_snapshot` 會反映 999。
- 缺少的回歸：報告產生前檢查最新 ledger request 是否 completed 且 latest；或 RESTRICTIVE 拒絕 client 寫入 `calculation_results`。

#### R-F3 [P3] 可直接寫入 calc_version 造成 project 重算永久 DoS

- 狀態：67e546f 仍有缺陷；ba2c7a5 仍有缺陷。
- 位置：`004:137`，`coalesce(max(c.calc_version),0)+1`，型別為 integer，見 core:323。
- 觸發：editor 直接 `INSERT calculation_results(..., emission_activity_id=<A>, calc_version=2147483647, is_latest=false, ...)`，RLS 允許（core:626-632）。之後每次 commit 都丟出 `22003 integer out of range`，handler 回 409，直到有人刪除這筆 row。
- 實際影響：同 tenant 寫入者可讓該 project 無法重算。對方本來也能刪改 activity，所以嚴重度低。
- 缺少的回歸：版本接近上限時應得到明確錯誤或被拒絕；一併收緊直接寫入（與 R-F2 同源）。

#### R-F4 [P3] action_log 不在交易內，回覆遺失加 replay 時永久缺漏

- 位置：`handler:42-46`，`if(!result.replayed)` 而且是 `.catch` 吞錯。
- 觸發：commit 已提交後，handler 在 `insertActionLog` 之前中止或寫入失敗，client 以同 ID 重送，結果是 replayed=true，因此不再寫 log。
- 實際影響：營運用的 action_logs 少一筆。SQL 內 audit_logs（`202603160004…:100-129`）仍為恰好一筆，權威稽核不受影響。

#### R-F5 [P3] 「durable」journal 實為 per-tab 的 sessionStorage；report pending gate 只在 client 端、只在同一分頁

- 位置
  - `EmissionActivitiesListPage.tsx:80, 85, 91`：全部使用 `sessionStorage`。
  - `ba2c7a5` 的 generate-report 不檢查 ledger。
- 觸發：回覆遺失後關閉分頁，或開新分頁，journal 就不存在。下一次按「計算」會建立新 request（新版本），另一分頁也能直接保存報告。
- 實際影響：DB 狀態本身一致（未 commit 的計算沒有任何寫入），不會造成錯誤數值。但與交付用語「持久保存」不符，gate 也不是 server 保證。屬文件準確性加 UX 問題。

---

### 歷史（67e546f）與整合（ba2c7a5）狀態對照

| 項目 | 67e546f | ba2c7a5 |
|---|---|---|
| 004、handler、contracts、計算服務、calculationRecovery、manualWorkflow、EmissionActivitiesListPage | 受審版本 | `git diff 67e546f ba2c7a5` 對這些檔案為 0 行，內容不變 |
| R-F1 contract 閘門與舊 RPC service_role 授權 | 仍有缺陷 | 仍有缺陷，沒有新 revoke |
| R-F2 calculation_results 直接寫入、報表不看 ledger | 仍有缺陷（已揭露） | 仍有缺陷。006 封存報告列，但輸入的 calc 結果仍可被竄改 |
| R-F3、R-F4、R-F5 | 仍有缺陷 | 同左 |
| 005 刪除與 processing lease | 不適用 | 在 emission_activities 新增 BEFORE INSERT/UPDATE trigger（005:63-77，advisory lock）；processing lease 只作用於 drafts 與 documents。recalc 不寫 activities，沒有形成新的鎖環，snapshot 欄位也不受影響，未見交互缺陷 |
| 006 報告完整性 | 不適用 | 取 org、member、subscription 的 FOR SHARE，與 recalc 相容；不消費 recalc ledger，見 R-F2 |
| 測試 | — | 6974e18 新增 `tenant-revocation-integration.test.js:84-88`（commit 前撤權、恢復後同 ID replay），屬序列插入，未重跑 |

### NOT_RUN 與待 CTO 裁定

- NOT_RUN（本審查與交付皆然）：真 Supabase、JWT、Deno；獨立 SQL 連線並行、lock-wait、deadlock；雲端 migration。本審查未重跑任何測試。
- 待 CTO 裁定
  1. R-F1：是否在 004 撤銷 service_role 對 `recalculate_project_atomic` 的 EXECUTE，或改用 handler 回報的 contract 版本。
  2. R-F2：與 report integrity（I 組）合併處理 `calculation_results` 的 client 寫入收緊，以及報告是否以 ledger completed/latest 作為前置條件。
  3. 全域 SHARE 鎖的吞吐限制是否可接受上線。


## D 組：受控文件刪除與持久引用 fence — 定向唯讀審查

- 固定程式 SHA：`1b1e82913ee593f4255eb33a92744d597c530b2c`（diff 對 `1b1e829^`）；最終整合：`ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde`；問題文件版本：`9839e1f`。
- 方法：只用 `git show`／`git diff`／`git grep` 讀來源與測試。**所有測試均未重跑**；提交者的 FE219／backend27／SQL-HTTP 292 PASS 數字不是本審查的驗證結果。
- 下文行號除另註外，都是 `1b1e829` 下 `backend/supabase/migrations/202611060005_controlled_document_deletion.sql`（簡稱 005）的行號。003＝`202611060003_server_attachment_verification.sql`，002＝`202611060002_manual_transcription_v1.sql`，core＝`202603160001_v1_core_schema.sql`，006＝`ba2c7a5` 下的 `202611060006_report_snapshot_integrity.sql`。
- 後續提交：`git diff 1b1e829 ba2c7a5` 對 005、003、002、001、delete service／handler、process-document、前端 deletion／library／service／頁面及兩個 deletion 測試**都沒有差異**。整合版的差異只有新增 006（report 封存）、`tenant-revocation-integration.test.js`（新增「finalize 前撤權→pending→恢復權限→同 ID 完成」案例），以及 product-preview 工具（`read_verified_report_snapshot` allowlist、revokeMembership 故障注入、CORS 4207）。

### Findings 總表

| ID | 等級 | 歷史 1b1e829 | 整合 ba2c7a5 | 摘要 |
|---|---|---|---|---|
| D-F1 | P2 | 仍有缺陷 | 來源支持（006 已封住一般角色） | 一般 editor 可直接 DELETE／UPDATE saved report，移除 appendix 引用後，受控刪除就能刪掉曾被報告引用的原件 |
| D-F2 | P3 | 仍有缺陷 | 來源支持（006 已封住一般角色） | prepare 之後一般 editor 插入畸形 report，finalize 會卡在 `DOCUMENT_REFERENCE_INDEX_UNKNOWN`，原件 bytes 可能已移除 |
| D-F3 | P3 | 仍有缺陷 | 仍有缺陷 | 報告只靠 `source_draft_id` 的間接引用，依賴可被 editor 刪除的非 MANUAL draft；draft 被刪後 fence 無法還原 doc 連結 |
| D-F4 | P3 | 仍有缺陷 | 仍有缺陷 | MANUAL create／confirm 與 complete duplicate 的 row lock → advisory lock 順序，與 prepare 的 advisory → row lock 順序相反，可能 deadlock（40P01）；資料完整性不受影響 |

沒有找到由一般角色觸發的 P1。

---

### D-F1（P2）：saved report 引用可被一般角色移除，然後受控刪除原件

- **來源**：core:634 `report_generations_write_policy on report_generations for all`（owner／admin／editor 可 INSERT／UPDATE／DELETE）。005:69-72 的 `deletion_report_reference` 只在 INSERT／UPDATE 時對 **new** mapping 做 `assert_unfenced`，不檢查引用被移除。005:48-49 的 `references_clear` 只看當下仍存在的 report row。
- **觸發**（1b1e829）：editor 對引用 doc D 的已保存報告執行 `DELETE FROM report_generations WHERE id=R`；或者 `UPDATE ... SET payload = payload - 'appendix_mappings' || '{"appendix_mappings":[]}'`，這個 UPDATE 不含 D，trigger 會放行。之後呼叫 `delete-uploaded-document`，prepare／finalize 都通過，D 的原件被刪。
- **實際影響**：報告完整性被破壞後，原件證據也被不可逆移除。這和既有 OPEN（report row 可被一般角色改寫）同根，但它讓「被引用原件不可刪」的 fence 承諾在 1b1e829 無法單獨成立。
- **最小合成重現**：沿用 `document-deletion-sql.test.js` 的 `setup()`。先以 superuser 插入含 `{appendix_mappings:[{source_document_id:D,source_draft_id:null}]}` 的 report，再以 `role('authenticated')` 執行 `delete from report_generations where id=$1`，最後 `operation(v)` 應得 `pending`（預期被拒）。
- **整合狀態**：006:18-34 對 authenticated／anon 的 INSERT／UPDATE／DELETE 一律 raise，並加上三條 restrictive deny policy。`report-integrity-sql.test.js:94`「source retention survives ordinary report mapping removal or hard-delete attempts」已覆蓋（已讀，未重跑）。service_role 維護仍能移除，這屬可信角色範圍；被移除後 `verified_row` 會回 409，不會靜默。
- **缺少的回歸**（歷史）：1b1e829 的 deletion 測試沒有「一般角色先移除引用再刪」的反例。整合版已補在 006 測試。

### D-F2（P3）：prepare 後新增的畸形 report 會讓 finalize 永久卡住（歷史）

- **來源**：005:53-58 的畸形檢查以同 org／project 的所有 report 為範圍。005:224 的 finalize 會重跑 `references_clear`。005:69 的 trigger 遇到非 array 的 `appendix_mappings`，或缺 key 的 object item，都不會 raise。
- **觸發**（1b1e829）：D 已 prepare，Storage 也已刪除（`object_absent`）。同專案 editor 依 core:634 插入 `payload='{}'` 或 `{appendix_mappings:[{}]}` 的 report。此後 finalize 每次都拋 `DOCUMENT_REFERENCE_INDEX_UNKNOWN`，D 停在 pending，同專案其他 prepare 也全部被拒。
- **影響**：可用性與營運問題（原件已移除但 tombstone 無法完成）。在 1b1e829，editor 也能自行刪掉該 row 來恢復，所以列 P3。
- **整合**：006 禁止一般角色寫入 report，legit publisher 由 `build-report-payload.js:209-214` 以 `select('*')` 的活動產生，keys 完整，所以一般角色無法觸發。
- **缺少的回歸**：「prepare 之後插入畸形 report → finalize」的案例。

### D-F3（P3）：只經 source_draft_id 的報告間接引用，依賴可刪的非 MANUAL draft（歷史＋整合）

- **來源**：005:49 只在 `extracted_document_drafts` 仍存在時，才把 mapping 的 `source_draft_id` 解析回 D。core:610 `extracted_document_drafts_write_policy for all`、core:618 activities `for all`。002:9-11 只禁止 authenticated 刪 **MANUAL** draft。
- **觸發**（兩個版本都成立）：editor 先把 activity A（來自 D 的 OCR draft X）的 `source_document_id` UPDATE 成 NULL，再經正常 handler 保存報告，mapping 會是 `{source_document_id:null, source_draft_id:X}`。之後 editor 直接 DELETE A 與 X（RLS 允許，FK 解除）。此時 `references_clear(D)` 的 drafts／activities／report 檢查都不命中，D 可被受控刪除，但 006 封存的報告仍指向 X→D。
- **影響**：需要 editor 刻意多步操作，正常 `confirm-draft.js:23-24` 會同時寫入 `source_document_id`，所以列 P3。報告本身仍被 006 封住，但引用鏈中的原件已不存在。
- **最小修補方向**（非本審查授權）：在報告封存時保存已解析的 document id，或把被 sealed report 引用的 draft／activity 列入保留。
- **缺少的回歸**：「sealed report 只含 source_draft_id，editor 刪 draft 後再 prepare」。

### D-F4（P3）：lock 順序倒置導致可偵測的 deadlock

- **來源**：prepare 是 005:161 advisory `document-delete:D` 之後，005:176 `uploaded_documents ... FOR UPDATE`。MANUAL create 是 002:113-114 `require_scope`，再到 002:64 `FOR UPDATE` D row，再到 002:126 draft INSERT，觸發 005:64 → 005:38 advisory `document-delete:D`。confirm 同樣走 002:144 → 002:161 activity INSERT → 005:66。complete duplicate 是 003:186 經 005:297-301 改寫的 target `FOR SHARE`，再到 result() 中 005:323-324 新加的 `assert_unfenced(receipt.id)`。
- **觸發**：兩個獨立 SQL 連線同時對同一 D 執行 MANUAL create 與 delete prepare（或 complete duplicate-of-D 與 prepare D）。
- **影響**：PostgreSQL 會偵測 deadlock，並中止其中一個交易（40P01）。兩種結果都一致：要麼草稿已存在而刪除被拒，要麼已 fence 而草稿被拒。不會造成資料污染，但使用者得到的是一般錯誤，而不是 fence 錯誤碼。交付文件已把「獨立 SQL 連線 lock-wait／deadlock」列 NOT_RUN（`document-deletion-sql.test.js:101` skip）。信心中等（依 PG 鎖語意推論，未實跑）。

---

### 逐題回覆

#### 1. actor／scope／doc／request／mode／path 與 object generation 綁定；raw DELETE／overwrite／hard delete；他人 orphan；locate 不能接手 — **來源支持**

- 綁定：005:6-13 的 operations 主鍵是 `document_id`，有 `unique(org,project,request_id)`、`unique(bucket,path)`，並保存 `storage_object_id／owner_id／object_metadata`。lookup／prepare 的 replay 在 005:171-172、finalize 在 005:219-220，比對 org／project／actor／request／expected_receipt_absent／bucket／path，不符一律 `INTENT_CONFLICT`。刪物件時 005:126-128 比對 id／owner／metadata（generation）。
- raw 路徑：receipt DELETE 對 authenticated／anon raise（005:85）。objects 的 DELETE／UPDATE 對 authenticated／anon raise（005:123）。已 fence 的 path 的 INSERT／UPDATE（含 service_role overwrite／move）raise（005:117-131）。002／003 的 UPDATE 拒絕仍在（202611020001:136-137、003:96-97）。**202611020001 允許 owner／admin／editor 直接 DELETE 的漏洞，已由 005 的 trigger 關閉**，但 permissive／restrictive delete policy 本身沒有移除。關閉機制依賴 `current_setting('role')`，在真 Supabase Storage／PostgREST 是否設定為 `authenticated` 只能由真服務驗證，這部分**證據不足**（NOT_RUN）。在 storage.objects 上建 trigger 是否具備真 Supabase 所需的 owner 權限，同樣未驗。
- 他人 orphan：沒有 receipt 也沒有 reservation 時，要求 `owner_text = actor`（005:197）；物件不存在則拒絕（005:199）。有 reservation 時要求 `v.actor = actor`（005:183）。
- locate（005:163-168）只回傳同 actor／org／project／mode／path 的作業，其他情況回 `not_found`，不建立新作業。
- 測試（已讀，未重跑）：sql:20-26、71-78；http:66、152。
- 缺少的回歸：Storage API upsert（INSERT ... ON CONFLICT UPDATE）在真 Storage 的行為。

#### 2. draft／MANUAL／直接與間接活動／report／processing 的 prepare 前後 fence；uppercase 與畸形歷史 fail-closed — **部分仍有缺陷（D-F1 歷史、D-F2 歷史、D-F3）**

- prepare 前：005:44-50 涵蓋**任何** draft（含所有 MANUAL 歷史、rejected、非 latest），活動的 `source_document_id` 或經 draft，active lease、`ocr_status='processing'`，以及所有 report 的 appendix（全域，005:48-49 用 `lower()`），另有 005:201 的共用 path 檢查。
- prepare 後：draft／activity／report 的 INSERT／UPDATE trigger（005:60-78）、receipt 設為 processing（005:107）、MANUAL create／confirm 的 INSERT 都會被 trigger 拒絕（HTTP 測試 http:113 已讀）。process／verify RPC 都先 `assert_unfenced`。
- uppercase：trigger 用 `::uuid`，references_clear 用 `lower()`。畸形值在 trigger 端 cast 失敗即拒；歷史畸形 row 在 005:53-58 以 `INDEX_UNKNOWN` fail-closed（只限同 org／project 範圍，跨專案的人造畸形 row 不阻擋，但那不是語意上的引用）。
- 缺陷：D-F1（歷史，引用可被一般角色移除）、D-F2（歷史，prepare 後新畸形 row）、D-F3（間接引用依賴可刪 draft）。
- 測試：sql:44-69、129-138、149-159；http:84、113。

#### 3. file／receipt 不同步、403／empty ACK、delete／finalize 回覆遺失或錯誤、同 ID retry／lookup／locate；保留 audit，不宣稱跨服務 atomic — **來源支持**

- service：`delete-uploaded-document.js:31-39`。Storage error 回 502，ACK 必須正好是 1 筆且同 path（:36）。prepare replay 由 005:147-149 的 catalog 判定 `storage_absent`，所以 retry 時跳過 remove、直接 finalize。finalize 要求 catalog 不存在（005:222），封存與 audit 在同一 SQL 交易（005:225-231）。handler 錯誤時保留原 ID 的 recovery 文字（index.ts:16）。
- receipt 不會被硬刪（只做 archived／deleted tombstone）；ops 文件明示 DB rollback 不復原 bytes、不宣稱跨服務 atomic。
- 已知限制（文件已載明，不列 finding）：作業綁定原 actor。原 actor 被撤權或離開後，沒有其他人能完成 finalize，pending 只能由 Owner 決策恢復（ops 文件「恢復原權限或其他管理處理須Owner決策」）。整合版 `tenant-revocation-integration.test.js` 新增撤權後恢復的案例（已讀，未重跑）。
- Storage API 內部「DB row 已刪但 S3 刪除失敗」屬服務外行為，**證據不足**。
- 測試：http:35、45；sql:92-99；前端 documentDeletion.test.ts:20-21、29。

#### 4. 只有 controlled deleted 才釋放 trusted unique；舊 verify／原路徑不能復活；catalog 不重學未知漂移；前置檢查不當權限控制 — **來源支持**

- 005:295-296 的 index 只排除 `deletion_state='deleted'`（pending 與其他 archived 仍占用）。005:297-300 讓 complete 的 target 查詢排除 deleted，005:316-318 遇 pending target 回 `DOCUMENT_DELETE_PENDING`。
- 復活：begin／complete／result 都插入 `assert_unfenced`（005:310-324），原 path 的 object INSERT 被拒（005:124-128），receipt INSERT 也被拒（005:90-92）。
- catalog：005:3 進場先驗 003 baseline，005:333-335 只更新已知 3 個函式與 1 個 index 的 fingerprint，005:362 只擷取自身新物件。觀察（非一般角色可觸發，不列 finding）：005 的 catalog 沒有納入 `document_processing_one_active` unique index、`uploaded_document_deletion_shape` constraint，以及 schema usage grant。這些物件漂移不會讓 `deployment_ready` 變 false，但 begin 在 advisory lock 下另有 active lease 檢查。
- 權限：delete handler 不依賴 `document_deletion_contract`，授權在每個 RPC 的 `assert_write`（005:158、214），capability 只是前端提示。
- 測試：http:20、57；sql:28-42。

#### 5. provider 前的 durable lease、finish 重查角色與最新訂閱、失敗 release／無 TTL、舊未追蹤工作；未啟用 OCR／外送 — **來源支持**

- `process-document/index.ts:63-72` 在讀檔與 provider 之前 begin。005:237-253 以 `assert_write` 加 `assert_unfenced` 先拿 advisory，再 `FOR UPDATE`，並拒絕 processing 或已有 active lease。
- finish（005:254-273）重跑 `assert_write`（latest subscription 依 003:42 的排序），先 fence 再鎖 lease，並檢查 doc 與物件仍有效，最後在同交易建 draft 與 completed。
- release（005:278-291）只限原 actor，並只在 deletion_state 為 active 時還原 ocr_status。handler 的 finally（:189-197）只在未完成時 release，失敗則保留 lease。沒有 TTL（sql:107）。
- 回覆遺失：finish 已 commit 後 release 為 no-op，draft 本身會阻擋刪除。
- 舊工作：`references_clear` 擋 `ocr_status='processing'`，但舊版 handler 不設 processing。`process_document_atomic` 仍授權給 service_role（202610310003），舊部署繞過 lease 時，draft INSERT 仍被 fence 拒絕。文件要求先盤點與停止舊工作。
- provider 選擇邏輯未變（:97-98），沒有新增外送。
- 測試：sql:103-127；http:133、144。

#### 6. 前端 corrupt journal、原 ID 查回、another-tab receipt priority、pending／deleted 原件可用性、租戶 context、舊 client 相容 — **來源支持**

- 損壞的 journal 會拋錯且不建立新 ID（documentDeletionRecovery.ts:8-9），只能用精準 captured-raw 放棄（:19）。
- 無本機參考時以 locate 找回 server ID（documentService.ts:252）。
- `expectedReceiptAbsent` 的 409 只在 lookup 回 `not_found` 後才清本機參考（:255-258）。
- pending／deleted 原件：UI 停用，`readPrivateOriginal` 拒絕（documentLibrary.ts:188），server 端 restrictive SELECT policy 隱藏（005:135-142）。之前已簽發的 signed URL 在真 Storage 的有效性屬**證據不足**。
- 每個 await 之後都有 `isCurrent` 檢查（documentDeletion.ts:9、13-15、35）。舊兩步刪除已移除，舊 client 會收到 42501。
- 測試：documentDeletion.test.ts:18-33、documentDeletionRecovery.test.ts:5-7（已讀，未重跑）。

---

### 必要交集

1. **005 對 003 的替換**：**來源支持**。以 `pg_get_functiondef` 加 `replace`，再 `execute` CREATE OR REPLACE，簽名不變，所以沒有新 overload。ACL、owner、SECURITY DEFINER、`search_path=''` 保留，003:202-203 的 service_role-only grant 不變。每個片段先驗證恰出現 1 次（005:299、327）。只插入檢查、不刪原檢查，所以沒有遺失。003 baseline 只更新被改的 3 個函式與 index。
2. **fence 與 MANUAL／report**：**MANUAL 來源支持**（任何 MANUAL 歷史都擋 prepare；prepare 後 create／confirm 的 INSERT 被拒）。**report：歷史仍有缺陷（D-F1、D-F2），整合由 006 補上一般角色寫入；間接引用的 D-F3 在兩個版本都存在。**
3. **processing lease 與刪除競態**：**來源支持**。begin／finish／release 與 prepare 共用 `document-delete:D` advisory，且都先拿 advisory 再鎖 row，兩種順序都已序列化。唯一未驗的是獨立連線下的實際 lock-wait（NOT_RUN）。

### 未驗與需 CTO 裁定

- NOT_RUN：真 Supabase Storage／PostgREST 的 `role` GUC、在 storage.objects 建 trigger 的權限、S3 部分失敗、signed URL、獨立 SQL 連線並行／deadlock、Deno。
- 需裁定：D-F3 是否要求 sealed report 保存已解析的 document 引用；被撤權 actor 留下的 pending 作業，是否需要 Owner 專用的接手流程（目前設計是不接手）。


## L 組：report request ledger（保存報告快照）定向唯讀審查

- 受審固定程式 SHA：`18c0894cf9da42eb341ce5835ba36fdc3a7bedc9`（差異基準 `18c0894^`）
- 題目來源：`docs/delivery/CLAUDE_REPORT_LEDGER_TARGETED_REVIEW_20261106.md`、`CLAUDE_INTEGRATION_REVIEW_START_HERE_20261107.md`（皆讀自文件固定版本 `9839e1f5ab6ab21f0e81975b1d43ff447cf692f7`）
- 整合比對 SHA：`ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde`（`git diff 18c0894 ba2c7a5`；006 只做交集核對，深度審查由其他審查者負責）
- 方法：只用 `git show`／`git diff`／`git grep` 唯讀閱讀來源；**沒有執行任何測試、migration 或服務**。下文提到的測試都是「已讀、未重跑」。

已讀來源（固定 SHA）：
- `backend/supabase/migrations/202611060001_report_snapshot_atomic_v2.sql`（全檔 1–85）
- `backend/supabase/functions/generate-report/index.ts`（全檔）
- `backend/supabase/functions/_shared/authz.ts`、`backend/src/services/enforce-subscription-readonly.js`、`backend/src/contracts/contracts.js:189-201`
- `202603160005_v1_hardening_generate_report_atomic_rpc.sql`、`202610310003_atomic_rpc_service_role_only.sql`
- `202603160001_v1_core_schema.sql`：352–383（表／unique index）、488–524（RLS helper）、581–583、634–640（report_generations policies）
- `202610310004_tenant_relationship_integrity.sql:31-34`
- `backend/src/services/build-report-payload.js`（差異部分）
- `frontend/readdy-app/src/services/manualWorkflow.ts:63-79`、`manualRecovery.ts`
- 測試：`backend/tests/integration/report-request-boundary.test.js`（全檔）、`product-preview.test.js:91-199`
- 整合版：`202611060006_report_snapshot_integrity.sql`（全檔）、`generate-report/index.ts` 與 boundary test 的差異

---

### Finding 總表

| ID | 等級 | 固定 SHA 位置 | 觸發條件（一行） | 歷史狀態 @18c0894 | 整合狀態 @ba2c7a5 |
|---|---|---|---|---|---|
| L-F1 | **P2** | `202611060001…sql:8`（ledger FK `on delete cascade`）＋ `202603160001…sql:634-640`（report 寫入 policy `for all`） | 同組織 editor 直接 `DELETE /rest/v1/report_generations?id=eq.<X>`，再用原 request_id 重送 | 仍有缺陷 | 來源已修正（006:7-16, 30-34, 97-103, 125-128）；未重跑 |
| L-F2 | **P3** | 同上 policy ＋ `202611060001…sql:39-44, 76-81`；`index.ts:87, 248-249` | 同組織 editor 直接 PATCH 已綁定 report 的 `generated_by_user_id`／`report_version`／`claim_purpose`／`status`／`project_id` | 仍有缺陷（fail-closed DoS；內容竄改屬已知 M3 OPEN） | 來源已修正（006:30-34, 59-77）；未重跑 |
| L-F3 | **P3** | `index.ts:44-67` 對比 `202611060001…sql:33-36, 74-75` | subscription 在 handler 檢查後、RPC 提交前轉為 readonly／suspended，或 membership 在 RPC 第 34 行檢查後同時被撤銷 | 仍有缺陷（TOCTOU 時間窗） | 來源已修正（006:36-53，`require_write` 以 `FOR SHARE` 鎖住 project/org/member/subscription） |

本定向範圍內，**沒有找到**一般 anon／authenticated 角色能直接讀寫 ledger、EXECUTE 新 RPC 或舊 `generate_report_atomic`，也沒有找到能把 ledger 指向其他 organization／project 報告的路徑。

---

### L1 權限與偽造

**判定：來源支持**（ledger／RPC ACL 與 audit 偽造部分）。直接可寫的 `report_generations` 帶來的旁路另列在 L-F1／L-F2。

- SHA：`18c0894`
- 證據：
  - `202611060001…sql:11-13`：ledger 啟用 RLS、沒有 policy，`revoke all … from public,anon,authenticated`，只 `grant select,insert … to service_role`。
  - `:26`、`:71`：兩支 RPC 都是 `security definer set search_path=public`。函式本體的表名都沒有 schema 前綴，但 search_path 已固定為 `public`，也沒有使用者可控的動態 SQL。
  - `:65-66`、`:84-85`：兩支 RPC 都 `revoke all … from public,anon,authenticated`，只授予 service_role。Supabase 預設給 anon/authenticated 的 EXECUTE 由這兩行明確收回，PUBLIC 也一併收回。
  - 舊 `generate_report_atomic`（`202603160005:4-29`，SECURITY DEFINER，沒有任何 actor／scope 檢查）已由 `202610310003:23-26` 收回 public/anon/authenticated，只授予 service_role。001 只在 v2 內部（definer 身分，`:47-50`）呼叫它，沒有新增 client 入口。`git grep` 顯示除了 v2 和本機 harness（`tools/local-workflow/engine.js:162`），沒有其他 handler 呼叫它。
  - audit 偽造：新 lookup（`:76-78`）與 v2（`:39-41`）只 join `report_snapshot_requests_v2` 和 `report_generations`，完全不讀 `audit_logs`。`git grep` 在 functions/src/frontend 也沒有其他以 audit metadata 反查 request 的消費者。因此使用者自行寫入的 audit action／metadata／entity_id 不影響綁定。
- 角色繼承：repo 內沒有 `alter default privileges`，也沒有任何 `grant … to authenticated` 牽涉 ledger／RPC。authenticated 能否經由角色成員關係取得 service_role，取決於雲端角色設定，repo 無法證明（屬 NOT_RUN）。
- **證據不足（不列 finding）**：`:13` 宣稱 service_role「只有 SELECT/INSERT」。但 Supabase 雲端通常有 default privileges，會在建表時把 ALL 授給 service_role，而 `:12` 沒有對 service_role 執行 `revoke`。所以 service_role 實際上可能仍有 UPDATE/DELETE。這屬於受信任角色，不影響 client 邊界；006 也沒處理 ledger 這一點（只對 private snapshots 做了 `revoke … service_role`）。
- 測試（已讀、未重跑）：boundary test `:35-41`（偽造 audit 後 lookup 回空）、`:43-54`（ACL／RLS 目錄）、`:56-67`（RPC EXECUTE）、`:84-94`（暫時 grant 後 RLS 仍拒絕）；product-preview `:177`（authenticated 直接呼叫 lookup RPC 得到 42501）。
- 缺少的回歸：沒有任何測試驗證一般 editor 直接改寫 `report_generations` 後的 ledger 行為（見 L-F1／L-F2）。
- 整合 @ba2c7a5：ACL 結構不變；006:142-144 重新 revoke/grant，並把舊 v2 本體移到 `cocal_report_private`（006:81-82）。

### L2 唯一綁定與 scope

**判定：跨租戶部分來源支持；同租戶綁定持久性仍有缺陷（L-F1）。**

- 證據：
  - ledger 主鍵 `(organization_id, project_id, request_id)`（`001:9`）。
  - lookup 和 v2 做了雙重 scope fence：`q.org/project = p_*` 且 `r.org/project = p_*`（`:39-41`、`:76-78`）。
  - ledger 只在 v2 `:59-60` 寫入，而且 `report_generation_id` 只能是同一交易剛插入的 `v_id`。`v_id` 經 `:57` 以 org/project 條件 UPDATE 確認過。
  - `report_generations` 另有 `(project_id, organization_id)` tenant FK（`202610310004:31-34`，NOT VALID，但新寫入會被檢查）。
- 跨租戶：已失去 B 會員資格的 actor 拿著 B 報告 UUID 走 A 的 request，由於 ledger 無法被 client 寫入，而 fence 要求報告列的 org/project 與 A 相符，因此回空。若服務端寫出一條錯誤綁定，lookup 回空，save 會因 ledger PK 衝突（23505）整筆回滾，是 fail closed（boundary test `:114-122`，已讀、未重跑）。
- **L-F1（P2）同租戶綁定可被一般 editor 清除並重建**
  - 位置：`202611060001…sql:8` `report_generation_id … references report_generations(id) on delete cascade`；`202603160001…sql:634-640` `report_generations_write_policy for all`，允許 owner/admin/editor 在 subscription 可寫時 DELETE。
  - 觸發：同組織的 editor 直接用 PostgREST `DELETE report_generations where id = X`，ledger 列會被 cascade 刪除。之後原 actor 用同一 request_id 和 version 重送。
  - 實際影響：`:37` 註解宣稱 request intent「immutable」，但一般角色就能把權威綁定刪掉。重送時 lookup 未命中（`:79`），handler 會依目前的活動／計算重建 payload（`index.ts:90-144`）。v2 因為沒有 ledger 列，會插入**另一份**報告。`(project_id, report_version)` unique 位置（`202603160001:379-380`）已被刪除釋出，所以新報告的 version 一樣是 1。結果是同一 request_id 綁定到內容不同的新報告。前端 `manualWorkflow.ts:74` 只核對 id、scope、status、version，會把它當作「恢復成功」。這直接違反 L5 要求的「重送不因目前活動改變而重建另一份報告」，並抹除了 ledger 的綁定證據（audit_logs 也是 client 可寫，不能補證）。
  - 範圍限制：攻擊者必須是同組織的 owner/admin/editor，而且 subscription 可寫；不能跨租戶。DELETE 能力本身屬已知 M3 OPEN，但「ledger 隨 report DELETE 一起 cascade 消失，使 request 重新變成新請求」是 001 自己的設計選擇造成的。
  - 最小合成重現：
    ```
    1. editor E（A org）POST generate-report {request_id:R, report_version:1} → 報告 X；ledger (A,P,R)→X
    2. 模擬回覆遺失
    3. E（或 A 的另一位 editor）以自身 JWT：DELETE /rest/v1/report_generations?id=eq.X → 204；ledger 列被 cascade 刪除
    4. 新增／改動 A/P 的活動與計算
    5. E 重送 {request_id:R, report_version:1} → 200，回傳新報告 Y≠X，totals 依目前資料
    ```
  - 最小修正方向：ledger 不以 cascade 依附在可變的 public row 上，並禁止 client DELETE 已完成報告（006 已採用這個做法）。
- 整合 @ba2c7a5：來源已修正。006:32-34 加上 restrictive DELETE/UPDATE/INSERT `false` policy，006:18-31 的 trigger 拒絕 `authenticated/anon`。006:9-14 的 private snapshots 沒有 FK／cascade。lookup／save 在只有 public ledger、沒有 proof 時回報 `REPORT_SNAPSHOT_UNVERIFIED`（006:103, 127）；有 proof 但報告列不見時回報 `INTEGRITY_MISMATCH`（006:65-66）。注意 001 的 ledger FK cascade 仍然存在，維運者用 service_role 刪除時 public ledger 仍會消失，但 private proof 會讓重送 fail closed。未重跑。
- 測試：沒有任何測試覆蓋 client DELETE 後重送。缺少的回歸是：「editor DELETE 綁定報告後，同 request 重送不得產生新報告」。

### L3 actor 與 intent

**判定：來源支持**（actor 來源、檢查順序、跨 actor／version／claim 借用）。L-F2 為 fail-closed 的 P3。

- actor：`index.ts:42` 的 `requireOrganizationWriteAccess` 用 request JWT 呼叫 `auth.getUser()`（`authz.ts:27-34`），會員身分以 service client 依 `user.id` 查詢（`:36-49`）。handler 只把 `actor.user_id` 傳給兩支 RPC（`index.ts:84, 220`）。`validateGenerateReportInput`（`contracts.js:189-201`）不接受也不使用 body 內的 actor。
- 順序：authz（42）→ subscription（44-67）→ project 所屬（69-81）→ 早期 lookup（83-88）。viewer、已撤權或非 active 的使用者在 42 就收到 403，不會走到 lookup。lookup RPC 本身在 `001:74-75` 再查一次 active 的 owner/admin/editor。
- intent：lookup（`001:80-81`）與 v2（`:43-44`）同時核對 ledger 上的 actor/version/claim 和報告列上的 `generated_by_user_id/report_version/claim_purpose`，任一不符就丟 `report_request_intent_conflict`。同使用者的合法重送會回傳保存列（`index.ts:87`）。
- **L-F2（P3）雙重核對中報告端欄位是一般角色可寫的**
  - 位置：`202603160001:634-640`（`for all` 寫入 policy）；`001:39-44, 76-81`；`index.ts:87, 248-249`。
  - 觸發：同組織 editor PATCH 已綁定報告 X 的 `generated_by_user_id`、`report_version`、`claim_purpose`，或把 `status` 改成非 `completed`，或把 `project_id`/`organization_id` 移到自己可寫的另一個 project（須通過 tenant FK）。
  - 影響：(a) actor/version/claim 被改，原 actor 合法重送永久收到 409 intent_conflict；(b) status 被改，lookup 命中後 `index.ts:87` throw，回 400；(c) scope 被移走，lookup 的 fence 回空，v2 插入新列後在 ledger PK 撞 23505 整筆回滾，永久 409。三者都是 fail closed，不會把綁定借給別人或別的 scope，但合法的回覆遺失恢復會被阻斷。(d) 改 payload 或 snapshot 欄位時，lookup 和 `:248` 的重讀會回傳被竄改的內容。這是提交者已聲明的 M3 OPEN（完整報告列可被改寫），此處不重複計為新缺陷。
  - 最小合成重現：E 依 L-F1 步驟 1–2 建立 X，另一位 A editor 執行 `PATCH /rest/v1/report_generations?id=eq.X {report_version:99}`，E 再以 R 重送，得到 409 `report_request_intent_conflict`。
  - 修正方向：已完成報告禁止 client 寫入（006 的做法）。
- 整合 @ba2c7a5：來源已修正。006:32-34 與 trigger 封鎖 client 寫入；006:70-75 比對整列 `row_snapshot` 與 private proof，intent 改以 proof 核對（006:99, 130）。未重跑。
- 測試（已讀、未重跑）：boundary `:96-104`（另一 actor、version、claim、錯 project）；product-preview `:155-180`（變更 version/claim、提升為 editor 的第二 actor 都被拒、HTTP lookup 得 42501）。
- 缺少的回歸：已撤權／降為 viewer 的原 actor 重送（handler 403）沒有專門測試；client PATCH 綁定報告欄位後的行為沒有測試。

### L4 競態與衝突

**判定：證據不足**（真並行 NOT_RUN）。SQL 來源推論的結論是安全的，本範圍未發現覆寫或錯綁。

來源推論：
- 同一 request 並行：`001:38` 在 project 與 membership 檢查之後取 `pg_advisory_xact_lock(org:project:request)`。第二個交易會等到第一個 commit 才拿到鎖。函式是預設 VOLATILE plpgsql，在 READ COMMITTED 下 `:39` 會取新 snapshot，看得到已提交的 ledger 列，回傳原 id。handler 隨後在 `:248` 重讀保存列並以它回應（`:272-284`），**不會回傳自己剛算出、未保存的 payload**。唯一的例外是 `insertActionLog` 的 metadata（`:263`）用的是本次的 payload warning 數，屬記錄層面的小誤差，不列 finding。
- lookup 未命中、另一交易先提交：同上，v2 在鎖內重查，回傳已提交的那一份。
- 不同 request、相同 project/version：advisory key 不同，不會互相序列化，但 `report_generations_project_version_uniq`（`202603160001:379-380`）會讓後者在 `generate_report_atomic` INSERT 時因 23505 失敗並整筆回滾，handler 回 409（`index.ts:238-244`）。不會覆寫。
- 前提：上述推論依賴 READ COMMITTED。若連線改用 REPEATABLE READ/SERIALIZABLE，第二個等待者看不到新 ledger 列，會改在 unique／PK 上失敗，變成 409 而不是冪等回傳。這仍是 fail closed，但冪等性會喪失。repo 沒有證據顯示雲端的隔離等級。
- 雜湊碰撞（`hashtextextended`）只會造成多餘的序列化，不影響正確性。
- 測試：既有測試都在單一 PGlite 連線上序列執行，沒有真正的兩條連線並行（提交者也標為 NOT_RUN）。缺少的回歸是兩條獨立連線對同一 request 並行，以及不同 request 對同一 version 並行。
- L-F3（P3）也屬於這一題的「request 與 completion 之間的撤權／最新 subscription」：
  - 位置：subscription 只在 `index.ts:44-67` 用 JS 判斷；v2（`001:33-36`）和 lookup（`:74-75`）只查 membership，不查 subscription 或 organization status，也沒有加列鎖。
  - 觸發：handler 讀完 subscriptions 之後，到 `:217` RPC 執行之前（期間有 6 次以上查詢），subscription 被改為 suspended/canceled 或期滿；或者撤銷 membership 的交易在 v2 `:34` 檢查之後、v2 commit 之前提交。
  - 影響：時間窗內不該再允許產生的報告仍會被正式保存（秒級時間窗，需外部事件剛好在這段時間發生）。不涉及跨租戶。
  - 整合 @ba2c7a5：已修正。006:36-53 `require_write` 在 SQL 內以 `FOR SHARE` 鎖 project/org/member/最新 subscription，並重算最新一筆 subscription 的有效狀態；save、lookup、read 都會呼叫它（006:94, 124, 138）。未重跑。

### L5 部分失敗與恢復

**判定：SQL 原子性來源支持；回覆遺失恢復大致來源支持，但受 L-F1 影響（歷史版本）。**

- 原子性：`generate_report_atomic`（報告 INSERT ＋ v1 audit）、snapshot UPDATE（`001:51-58`，未命中會 raise）、ledger INSERT（`:59-60`）、v2 audit（`:61-62`）全部在同一個 plpgsql 呼叫內，屬同一個交易。任何 exception（例如 `:52` enum cast 22P02、`:5` 長度 check、PK 23505）都會整筆回滾。
- 提交後回覆／重讀失敗：`:248-249` 失敗時 throw，回 400。重送同 request_id 時，`:83-88` 在重建 payload 之前就回傳保存列。新增未計算活動不影響恢復，因為 lookup 發生在 `build_report_payload` 的完整性 gate（`build-report-payload.js` 新增的 125-133 行）之前。
- 限制：
  - 沒有 request_id 時，handler 用 `crypto.randomUUID()`（`index.ts:234`），無法恢復。前端 `nextManualReport` 永遠提供 request_id（`manualWorkflow.ts:69`），並由 `manualRecovery.ts:11-12` 保存在本機 storage。
  - subscription 在提交後轉為 readonly 時，`:56-67` 會在 lookup 之前擋下恢復（403）。這是 fail closed 的設計取捨，不列 finding；使用者仍可用 RLS SELECT 讀報告列。
  - 歷史版本中，L-F1 會讓「同 request 重送拿到同一份保存列」的保證被一般 editor 打破。
- 測試（已讀、未重跑）：boundary `:106-112`（enum 失敗時 report、ledger、兩筆 audit 皆無殘留）；product-preview `:91-107`（提交前失敗、提交後回覆遺失只有一份報告）、`:155-167`（新增活動後仍恢復原 payload）、`:182-198`（snapshot UPDATE 失敗回滾、修正後可重試）。
- 缺少的回歸：client DELETE/PATCH 綁定報告後的重送（L-F1/L-F2）；提交後 subscription 轉 readonly 時的恢復路徑。
- 整合 @ba2c7a5：`index.ts` 改用 `read_verified_report_snapshot` 重讀並要求 `integrity_status='server_verified'`；lookup 改以 private proof 為準。006 的錯誤碼映射與 subscription 403 行為改變，需由 006 審查者確認。未重跑。

---

### NOT_RUN／已知 OPEN／需 CTO 裁定

- NOT_RUN（本審查者完全沒有執行）：所有 PGlite／Node HTTP 測試、真 Supabase Auth/JWT/PostgREST/Edge、雲端 default privileges 與角色成員關係、真正兩條連線的並行 SQL 交易、雲端 migration 套用與備份還原。`product-preview/{runtime,worker}.js` 是替身 harness，只讀了 RPC 白名單（`worker.js:24`），不能當作部署證據。
- 已知 M3 OPEN（固定 SHA）：一般角色可以對 completed 報告執行 INSERT/UPDATE/DELETE，內容與 hash 沒有防竄改。L-F1 和 L-F2 是這個缺口與新 ledger 交互後的具體後果；其中 L-F1 的 cascade 擴大效應由 001 引入。整合版 006 以來源候選方式處理，深度判定留給 006 審查者。
- 需 CTO 決策：
  1. 是否接受 L-F1 屬於 M1 範圍內的 P2（ledger 綁定可被同租戶 editor 清除並重建），還是併入 M3 一起處理。
  2. 001 的 ledger FK `on delete cascade` 在整合版仍然保留，是否要改為不 cascade 或 restrict。
  3. service_role 對 ledger 的實際權限是否需要在 migration 中明確 `revoke update, delete, truncate`。

本審查只限 L1–L5 的定向範圍，不代表全案通過，也不能批准雲端套用或解除發布 HOLD。


## 組別 M — MANUAL 轉錄／原子確認 定向審查

- 固定程式 SHA：`06bad0818625bd9d4f3b685dff50994157b52757`（差異基準 `06bad08^`）
- 問題來源：`docs/delivery/CLAUDE_MANUAL_TRANSCRIPTION_TARGETED_REVIEW_20261106.md` @ `9839e1f`；回覆規則 `CLAUDE_INTEGRATION_REVIEW_START_HERE_20261107.md` @ `9839e1f`
- 整合交集：`git diff 06bad08 ba2c7a5`（`ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde`）
- 方法：只用 `git show／diff／grep` 唯讀閱讀來源與測試。**所有測試都未重跑**；SQL／RI 行為是依 PostgreSQL 語意推論，沒有實際執行。真 JWT／Storage／Deno／獨立 SQL 並行：NOT_RUN。

### Finding 總表

| ID | 等級 | 位置（06bad08） | 觸發 | 06bad08 | ba2c7a5 |
|---|---|---|---|---|---|
| M-1 | P2 | `202603160010_v1_p0_classify_atomic_fix.sql:25,36-44`；`functions/classify-document/index.ts:56-62,94` | 同 org editor 對已確認或已駁回的 MANUAL draft 呼叫 classify-document | 存在 | 仍存在（未修改） |
| M-2 | P2 | `202603160009_v1_p0_process_document_atomic_fix.sql:21,33-35,38-60`；`functions/process-document/index.ts:59,105`；`confirm-draft/index.ts:110-158` | 同 org editor 對有 MANUAL draft 的文件呼叫 process-document（可帶 client `ocr_payload`），再走舊 confirm 路徑 | 存在 | 仍存在（改經 lease，`005:267` 仍呼叫 process_document_atomic，沒有 MANUAL 檢查） |
| M-3 | P2（既有「整表防竄改」OPEN 在 MANUAL 的具體化） | `202603160001_v1_core_schema.sql:618-632`；`202611060002:162`；`frontend/.../manualWorkflow.ts:35` | 同 org editor 直接 REST INSERT／UPDATE／DELETE `emission_activities`／`calculation_results` | 存在 | 仍存在 |
| M-4 | P3 | `202603160001:594-600`（projects FOR ALL）；`202610310004`（cascade FK）；`202611060002:8,41-44` | editor `DELETE /projects?id=eq.X`，經 RI cascade 刪除 MANUAL 收件與 draft | 存在（推論，信心中） | 實質關閉（`005:85` 與 `003:9`） |
| M-5 | P3 | `202611060002:144-154` | 回覆遺失後重送，但其間出現 new latest、專案期間變更、撤權或訂閱到期 | 存在 | 仍存在 |
| M-6 | P3 | `202611060002:125`；`manual-transcription.js:13`；`unit-normalization.js` 與 `numeric(20,8)` | 轉錄有誤只能駁回；駁回或溢位後此文件永遠無法再建立 MANUAL | 存在 | 仍存在 |

本組沒有 P1。沒有發現跨租戶、viewer、inactive 繞過，也沒有直接 authenticated SQL 偽造 MANUAL draft 的路徑。

---

### Q1 普通會員能否偽造 MANUAL provider、raw provenance、server actor/time 或確認決定，或藉其他可寫表／舊 RPC 改變其權威？

**判定：仍有缺陷（M-1、M-2、M-3）。直接 authenticated 寫入 draft 的部分有來源支持。**

#### 來源支持的部分

- `202611060002:5-17`：trigger `protect_manual_draft` 是 BEFORE INSERT/UPDATE/DELETE、`security invoker`、`search_path=''`。當 `current_user` 是 `authenticated`／`anon`，且 OLD 或 NEW 的 provider 符合 `^manual([_-]|$)`（不分大小寫，涵蓋 `MANUAL_TRANSCRIPTION_NO_OCR`）或 `raw_payload ? 'manual_transcription'` 時，以 42501 拒絕。規則同時涵蓋「把非 MANUAL 列改成 MANUAL」和「修改或刪除 MANUAL 列」。
- 兩支 RPC 在 `:133-134`、`:171-172` 都 revoke public／anon／authenticated，只 grant service_role。helper（`require_scope`、`validate_input`）在 `:73`、`:106` 連 service_role 也 revoke。全部 SECURITY DEFINER 且 `search_path=''`，物件都有 schema 限定。
- actor 來自 `requireOrganizationWriteAccess`（JWT），由 handler 傳入 `p_actor_user_id`。contract `manual-transcription.js:22-25,27-33` 拒絕 client 傳入的 actor、provider 等多餘欄位；`transcribed_at` 由 server 端 `clock_timestamp()` 產生（`:110,127`）。

#### M-1（P2）舊 classify 路徑可改寫 MANUAL draft 的權威欄位

- **位置**：`classify_document_atomic` 是 `security definer`（`202603160010:25`），owner 為 migration 角色，所以函式內 `current_user` 不是 authenticated，trigger 在 `202611060002:8` 直接放行。它的 UPDATE（`:36-44`）不檢查 provider 與現有 status，無條件寫入 `status='pending_review'`、`review_note`、`suggested_*`、`confidence_score`。`classify-document/index.ts:56-62` 只以 id／org／project 讀 draft，`:94` 即呼叫 RPC。
- **觸發**：同 org、可寫訂閱的 editor 對 `confirmed` 或 `rejected` 的 MANUAL draft 發 `POST /functions/v1/classify-document {organization_id, project_id, draft_id}`。
- **影響**：
  - MANUAL 列的 `status` 被改回 `pending_review`，`review_note` 被 LLM／mock 輸出覆蓋。`raw_payload.confirmation` 與已建的 activity 仍在，資料自相矛盾。
  - 同 intent 重送時，`confirm v2:153` 回傳的是 `draft.status`（已變成 `pending_review`）。前端 `manualTranscription.ts:59` 因 `draft_status!==intent.decision` 而報錯，使用者無法完成恢復；換一個 intent 則得到 `manual_confirmation_intent_conflict`。
  - 不會產生第二筆 activity，因為 `:151-154` 的 prior 判斷在 status 判斷之前。
  - 這與交付文件「MANUAL 列由 server 管理」的說法不符：一般 editor 透過 service-role handler 就能改寫。
- **最小重現（合成）**：create → confirm(`confirmed`) → 以 editor JWT 呼叫 classify-document 同 draft_id → `select status, review_note from extracted_document_drafts` 得 `pending_review`／被覆寫；再以原 intent 呼叫 confirm-draft，回 200 但 `draft_status='pending_review'`。

#### M-2（P2）process-document 可取代 MANUAL latest，舊 confirm 路徑可重複計入同一收件

- **位置**：`process_document_atomic`（`202603160009:21` definer，`:33-35` 把該文件所有 latest 設為 false，`:38-60` 插入新的 latest draft，`raw_payload=coalesce(p_raw_payload,...)`）。handler `process-document/index.ts:59` 接受 client 直接提供的 `ocr_payload` 作為 raw_payload。舊 `confirm_draft_atomic`（`202603160011`）沒有 status、latest 或「同文件已有 activity」檢查；`confirm_draft_to_emission_activity` 會補 `quantity ?? 0`、`unit ?? 'kg'`。
- **觸發**：
  - (a) MANUAL 尚待確認時呼叫 process-document，MANUAL 變成 stale（`:146` 拒絕，屬正確處理）。但新 latest 是 OCR／direct-input draft，所以 `create_manual_transcription_atomic` 永遠得到 `manual_document_latest_conflict`（`:125`）。同 org editor 因此可以永久阻斷某文件的 MANUAL 流程。
  - (b) MANUAL 已確認後呼叫 process-document（`ocr_payload` 任意），再以 confirm-draft 確認新 draft，舊路徑會為同一個 `source_document_id` 建出第二筆 activity／calc。
  - (c) `ocr_payload` 可放入頂層 `manual_transcription` 鍵，因 definer 繞過 trigger 而寫入。provider 仍是 NULL，confirm 不會把它當 MANUAL，但 retention guard（`:27,35`）與前端 `documentLibrary.ts` 的 OR 條件會把它當 MANUAL，這等於自家 org 的刪除阻斷（影響輕）。
- **影響**：MANUAL「一份收件只有一筆、明示輸入、不補 0/kg」的保證可被並行的舊路徑繞過，同一收件可能重複計入。這是舊非 MANUAL 路徑的既有缺陷與 MANUAL 的交集；交付文件自己寫了「舊非 MANUAL 路徑未全面重構」。
- **最小重現（合成）**：MANUAL create → confirm → `POST process-document {uploaded_document_id, ocr_payload:{quantity:100,unit:'kWh',...}}` → `POST confirm-draft {draft_id:<新id>, decision:'confirmed'}` → `select count(*) from emission_activities where source_document_id=<doc>` 得 2。

#### M-3（P2，既有 OPEN 的具體化）MANUAL 衍生的 activity／calc 沒有 server-managed 保護

- **位置**：`emission_activities_write_policy`、`calculation_results_write_policy` 對 owner／admin／editor 開放 FOR ALL（`202603160001:618-632`），且 created_by、source_draft_id、activity_code 都沒有約束。confirm v2 以 `'MANUAL-'||draft.id` 作為 activity_code（`202611060002:162`），只有 `(org,project,activity_code)` 唯一索引。既有前端直接新增 activity 的功能也用 `'MANUAL-'+client UUID` 前綴（`manualWorkflow.ts:35`），兩者共用命名空間。
- **觸發與影響**：
  1. editor 先 REST INSERT 一筆 `activity_code='MANUAL-<draft_id>'`（draft_id 由 SELECT 可得）。之後 confirm v2 的 INSERT 撞唯一索引（23505）而整筆 rollback，handler 回 409，該 MANUAL 草稿無法確認，直到有人刪掉占位列。
  2. editor 可直接插入 `source_draft_id=<MANUAL draft>`、`created_by_user_id=<他人>` 的 activity，偽造看似 MANUAL 來源鏈的活動。
  3. 確認後可直接 UPDATE activity 的 quantity／scope，或 calc 的 `co2e_kg`／warnings。重送時 handler（`confirm-draft/index.ts:92-105`）只驗形狀與 ID，所以會回傳被改過的「保存計算」。
- **說明**：這屬於已列 OPEN 的「整表防竄改」，此處不假關閉。新增的具體面向是 activity_code 占位造成的確認 DoS，以及 MANUAL 來源鏈可偽造。
- **最小重現**：`POST /rest/v1/emission_activities {organization_id, project_id, activity_code:'MANUAL-<draft>', activity_name:'x', activity_date, category, activity_type, quantity:1, unit:'kWh'}`（editor JWT）→ confirm-draft 回 409 `MANUAL_CONFIRMATION_NOT_SAVED`。

#### 已讀測試（未重跑）與缺少的回歸

- **已讀測試**：
  - `manual-transcription-sql.test.js:29-40`：直接 INSERT／UPDATE／DELETE 與寬 permissive policy。
  - `manual-transcription-http.test.js:29`：偽 actor／provider 與 REST 改 provenance。
  - `manual-transcription.test.js:7,22`。
- **缺少的回歸**：
  - classify-document 作用在 MANUAL draft（確認前後）。
  - process-document 作用在有 MANUAL 的文件，含 `ocr_payload` 帶 `manual_transcription` 鍵。
  - 確認後舊路徑二次 confirm 的 activity 數。
  - 直接 REST 占用 `MANUAL-<draft>` activity_code。
  - 直接竄改 calc 後的重送結果。

---

### Q2 兩 RPC 是否核對同 org/project/doc、活躍可寫角色、真正 latest 訂閱／到期、合法私有原件；new latest、改 intent、不同 actor、stale journal 是否正確處理？

**判定：scope、角色、訂閱與原件的核對有來源支持；new latest 部分仍有缺陷（M-2、M-5）。**

#### 來源支持（`202611060002:46-72`）

- `require_scope` 依序檢查：
  - project 屬於 org，並取 `for key share`。
  - org 為 `active`。
  - 成員為 active 且角色是 owner／admin／editor（`for share`，排除 viewer、invited、inactive）。
  - 訂閱取 `period_end desc, created_at desc, id` 的第一筆並 `for share`：未開始、`active` 已過期且無有效 grace、grace 已過期、readonly／suspended／canceled 一律拒絕。
  - doc 同 org／project 且 `status='active'`，`for update`。
  - 路徑解析出的 project 與參數一致。
  - bucket 為 private，object 存在且 `for share`。
- SQL 比 JS（`enforce-subscription-readonly.js`）更嚴格：未來才開始的續約列會讓 SQL 拒絕。屬 fail-closed，可能誤擋，但不是繞過。
- create（`:112-124`）：先取文件 advisory lock，再做 scope 與 input 驗證。同 draft_id 時比對 org／project／doc／provider／actor／request_id／`normalized_payload`，完全相同才 replay，否則 `manual_request_intent_conflict`。不同 draft_id 會因 `:125` 的 latest 檢查與 partial unique index（`202603160001:198-200`）而拒絕。
- confirm（`:141-154`）：draft 以 id＋org＋project 讀取，之後鎖文件、重跑 scope，`for update` 重讀並檢查 `is_latest`。同 actor 且 intent（含 request_id）完全相同才 replay；不同 actor 或 intent 回 conflict。
- 跨 org 的 draft_id 在 `:141` 回 `not_found`，handler `confirm-draft:60-66` 回 404，沒有 oracle。
- 前端 journal 依 user／org／project／doc 分區；`requireMatchingManualAttempt` 阻止舊參考套用到新 draft。
- 撤權或訂閱變更發生在轉錄與確認之間：confirm 會即時重查（`sql.test:58-97`）。

#### 缺陷

- **new latest**：pending MANUAL 被 process-document 取代時拒絕確認，這是正確的。但 MANUAL 本身沒有阻擋取代，取代後無法再建立 MANUAL；已確認的 MANUAL 被取代後，可經舊路徑重複計入（M-2）。
- **M-5（P3）**：confirm v2 在 `:144-147` 先做 `require_scope`、`is_latest`、`validate_input`，`:150` 才看 prior。所以回覆遺失後重送時，若其間發生 new latest、專案盤查期間修改、撤權或訂閱到期，會拿到錯誤，而不是已保存的結果。撤權或到期時拒絕可視為政策選擇；new latest 與期間修改則讓已提交的確認無法經 API 讀回（使用者只能用 SELECT 自行查看）。create 的 replay（`:116-124`）同樣排在 `require_scope` 與 `validate_input` 之後。
  - **最小重現**：create → confirm（丟棄回覆）→ process-document 同 doc → 以同 intent 重送 confirm，得 `manual_stale_draft`，而非已保存的 activity／calc。
- **整合版注意（證據不足，不列 finding）**：`require_scope` 沒有核對 003 的 `hash_verification_status`／`verified_storage_object_id`，`legacy_unverified` 收件仍可轉錄。依 `SERVER_ATTACHMENT_HASH_DELIVERY_20261106.md:17`，人工轉錄沿用既有流程，沒有要求可信收件，因此不判缺陷。是否要把 MANUAL 限定在 server_verified 收件，請 CTO 裁定。
- **已讀測試（未重跑）**：`sql.test:20-28,58-97`；`http.test:29,44,72,81`；前端 `manualTranscription.test.ts:12,20,41`。
- **缺少的回歸**：process-document 在 MANUAL 前後的 latest 行為；new latest 後的同 intent 重送；未來 period_start 續約的誤擋。

---

### Q3 create／confirm 重送或回覆遺失是否只產生一份 draft／activity／calc；真正 SQL 錯誤是否連 audit 一起 rollback；重送回的是保存的計算與警示，而非重算或空警示？

**判定：只看 MANUAL 路徑時有來源支持；保存計算會被直接竄改（M-3），跨路徑會重複計入（M-2）。**

- **單一 draft**：固定 draft_id＋request_id；文件 advisory lock；latest partial unique index；完全相同才 replay。
- **單一 activity／calc**：文件 advisory lock、draft `for update`、prior 先判斷（`:151-154`），另有 `MANUAL-<draft>` 唯一索引作後備（`:162`）。並發的同 intent 確認中，第二筆會 replay。不同 request_id 會 conflict，不會建第二筆。
- **原子性**：activity、calc、draft confirmation 與 audit（`:161-168`）都在同一個 plpgsql 呼叫內，任何例外整筆 rollback（`sql.test:49-57` 以無效 factor_id 觸發 22P02 驗證）。commit 之後若 handler 讀回失敗，回 409 `READBACK_FAILED`；重送會走 replay，不會重寫。
- **重送不重算**：handler 在 confirmation 已存在時不計算（`confirm-draft:81`）。即使並發時已多算一次，RPC 也會丟棄它，改以保存的 `calculation_result_id` 讀回 status／warnings／co2e（`:92-105`），並驗證 ID、org／project／activity 對應和狀態與金額的一致性。rejected 不建 calc（`:103-104`）。
- **缺陷**：
  - 讀回的 calc 列可被 editor 直接 UPDATE，重送會回傳竄改後的值（M-3）。
  - status 欄可能已被 classify 改寫，重送回傳的 `draft_status` 失真（M-1）。
  - 計算本身由 service-role JS 在 RPC 外完成並作為參數傳入（`p_calculation_result`）。RPC 只檢查 status 列舉（`:159`），不驗證 factor／co2e。這是信任邊界設計（只有 service_role 能呼叫），不判缺陷。
- **已讀測試（未重跑）**：`sql.test:41-57`；`http.test:19,53,99`。真正獨立的 SQL 並行：NOT_RUN（PGlite 是單連線）。
- **缺少的回歸**：確認後直接 PATCH calc 再重送；真雙連線並發確認。

---

### Q4 MANUAL 原件／收件 retention 是否 AND 完整 policy 鏈且沒有跨租戶 scope oracle？（不可說成跨服務 atomic delete）

**判定：06bad08 的直接 DELETE 路徑有來源支持；project cascade 可繞過（M-4，P3，推論）。ba2c7a5 實質強化。不構成跨服務 atomic delete，此保護不應如此描述。**

#### 來源支持

- `202611060002:41-44`：兩條 restrictive policy（`for delete to authenticated`），與 `202611020001` 既有的 restrictive guard 及 permissive allow 以 AND 疊加。`sql.test:69-78` 加入寬 permissive policy 後仍拒絕。
- helper 為 definer、`search_path=''`。第一個條件是 `org_access(...,true)` 或 `project_access(...,true)`，無權限時一律回 false，所以無法探測他租戶是否存在 MANUAL，沒有 oracle。其他 bucket 回 true，屬中性，因為只會與其他 policy AND。
- `cocal_manual_private` 只有 usage／execute 給 authenticated，供 policy 求值。目前沒有證據顯示 PostgREST 對外暴露此 schema；即使能直接呼叫，結果也同樣不構成 oracle。
- uploaded_documents 的 client UPDATE 被 `cocal_receipt_update_guard using(false)` 與 `guard_receipt_write` 拒絕（`202611020001:96-97,104-141`），storage UPDATE 也被拒（`:74-76`）。因此無法以改 `storage_path` 的方式讓 join 失配。

#### M-4（P3，信心中，未實跑）

- **位置**：`projects_write_policy` 對 editor 為 FOR ALL（`202603160001:594-600`）；uploaded_documents 與 drafts 對 projects 為 `on delete cascade`（`:133-134,166-167`、`202610310004:11-19`）。RI cascade 以表 owner 身分、不套 RLS 執行，因此 restrictive retention policy 不會被求值。`protect_manual_draft` 以 `current_user` 判斷（`:8`），cascade 中 current_user 是 owner，所以放行。
- **觸發**：editor 發 `DELETE /rest/v1/projects?id=eq.<project>`。
- **影響**：MANUAL 收件列、draft（含 provenance 與 confirmation）、activity、calc、報告一起被刪；storage bytes 留下成為孤兒（`original_can_delete` 因 project 已不存在而拒絕刪除 bytes）。這是收件與 provenance 的 retention 被繞過，不是 bytes 被刪。
- **最小重現**：建立 MANUAL draft → editor JWT 刪除 project → `select count(*) from extracted_document_drafts where id=<draft>` 得 0。
- **ba2c7a5**：`005 receipt_guard`（`202611060005:84-85`）改用 `current_setting('role')`。這個 GUC 在 RI cascade 中仍是 `authenticated`，所以 uploaded_documents 的 DELETE 一律被拒，cascade 中止。`003:9` 的 verifications→projects FK 是 NO ACTION，也會擋下。因此整合版可視為關閉（推論）。`005 references_clear`（`:41-59`）在文件有任何 draft 時拒絕受控刪除，`object_guard`（`:123`）拒絕 authenticated 直接刪 storage。

#### 其他

- 跨服務原子性維持 OPEN（交付文件已自承）。
- **已讀測試（未重跑）**：`sql.test:69-78`；`http.test:89`（ba2c7a5 版本改為受控刪除）；整合版 `document-deletion-sql/http.test.js` 只讀檔名與交付描述，未逐行審。
- **缺少的回歸**：project 或 org 刪除經 cascade 對 MANUAL 收件的影響（06bad08）。

---

### Q5 缺資料、缺係數、同分歧義、跨期、不同 canonical 輸入是否拒絕或保留未知；是否可能用 0／kg／假 OCR／雙人覆核假成功？

**判定：MANUAL 路徑本身有來源支持。跨路徑風險見 M-2；可用性缺陷見 M-6（P3）。**

#### 來源支持

- **缺資料**：contract（`manual-transcription.js:11-19`）與 SQL `validate_input`（`:77-104`）都要求全部欄位明示、拒絕未知欄位。quantity 必須是 JSON number（`:87`），不接受空白或預設 0；unit 必須在白名單；included 必須有 scope；excluded 必須有原因。
- **0**：明填的 0 會保留為 0（`manual-transcription.test.js:7`），屬於使用者明示，不是補值。
- **缺係數**：`calculate-emission-activity.js:59-82` 給 `pending_factor`、co2e NULL、`FACTOR_NOT_FOUND`。
- **同分歧義**：`resolve-emission-factor.js:76-78` 前兩名同分時給 `pending_factor`／`FACTOR_AMBIGUOUS`，不任選。
- **跨期**：活動日期或文件期間超出專案盤查期間即拒絕（`:98,103`），不做分攤。
- **不同 canonical 輸入**：create 時 `normalized_payload` 不同會 conflict（`:122`）；confirm 時 overrides 只允許改 `review_note`（`manual-transcription.js:32`），confirm 用的是保存的 normalized_payload（`:147`）。
- **假 OCR**：provider 固定為 `MANUAL_TRANSCRIPTION_NO_OCR`，不設 confidence，OCR status 維持 pending（`sql.test:26`）。
- **雙人覆核**：UI 與文件都明示「允許同人、非雙人覆核」（`ManualTranscriptionPage.tsx:50,70,79`），沒有假稱雙人覆核。

#### 跨路徑

同一收件可被 process-document 的 direct-input draft 取代，並經舊路徑以 `quantity ?? 0`、`unit ?? 'kg'` 確認（M-2）。MANUAL 自身不會產生 0／kg 假成功，但舊路徑沒有被 MANUAL 存在所阻擋。

#### M-6（P3）錯誤的 MANUAL 無法更正

- **位置**：`202611060002:125`；`manual-transcription.js:13`。
- **觸發**：
  - 轉錄打錯（canonical 不可變）時只能駁回。駁回後 draft 仍是 `is_latest`，新的 create 一律得到 `manual_document_latest_conflict`；前端也沒有重新轉錄入口。06bad08 因 `(project_id, sha256_hash)` 唯一索引，無法重新上傳同一檔案；ba2c7a5 有 draft 時受控刪除也會拒絕。
  - quantity 合法（< 1e12），但正規化後超過 `numeric(20,8)` 範圍（例如 `1e9 MWh` 得 `1e12 kWh`），或 co2e 超過 `numeric(20,10)` 範圍（≥ 1e10 kg）。confirm 會以 22003 rollback，永遠無法確認，只能駁回。
- **影響**：資料安全（rollback 正確，沒有假成功），但該收件永久無法透過 MANUAL 產生正確活動，使用者被迫改走 M-2 的舊路徑。
- **已讀測試（未重跑）**：`manual-transcription.test.js:7-22`；`http.test:61,72`；前端 `manualTranscription.test.ts:16`。
- **缺少的回歸**：駁回後重新轉錄；正規化溢位的邊界值。

---

### 歷史（06bad08）與整合（ba2c7a5）狀態

- `202611060002`、`manual-transcription/index.ts`、`confirm-draft/index.ts`、`classify-document`、`process_document_atomic`、`confirm_draft_atomic` 在 `06bad08..ba2c7a5` 之間**都沒有改動**。所以 M-1、M-2、M-3、M-5、M-6 在整合版中原樣存在。
- **003**：MANUAL `require_scope` 沒有接上 hash 驗證（見 Q2 證據不足）。003 對 storage 與收件的 retention trigger 進一步保護了原件。
- **005**：
  - `reference_guard`（`:60-77`）讓 MANUAL 的 create（draft INSERT）與 confirm（draft UPDATE、activity INSERT）都受刪除 fence 約束。
  - `references_clear` 讓有任何 MANUAL draft 的文件無法受控刪除。
  - `receipt_guard` 與 `object_guard` 拒絕 authenticated 的 DELETE，關閉 M-4。
  - process-document 改經 lease，但 `finish_document_processing`（`:254-273`）仍呼叫 `process_document_atomic` 而不檢查 MANUAL，所以 M-2 未關閉。
- **005 鎖序（P3 註記，證據不足，未實跑）**：MANUAL create／confirm 的取鎖順序是「`manual:` advisory → doc 列 `for update`（`require_scope`）→ trigger 取 `document-delete:` advisory」；`document_deletion_request` 是「`document-delete:` advisory（`:161`）→ doc `for update`（`:176`）」。兩者順序相反，可能產生 40P01 deadlock。PG 會中止其中一方並整筆 rollback，不致造成資料不一致，但真並行沒有驗證。
- **006**：只保護 `report_generations`，不碰 MANUAL draft、activity、calc；M-3 的 activity／calc 竄改仍可在報告產生前影響報告內容。

### 既有 OPEN／NOT_RUN 與需 CTO 裁定事項

- **OPEN**：
  - 整表防竄改（M-3 屬此類，但新增 activity_code 占位 DoS 這個具體面向）。
  - 跨服務 atomic delete。
  - server hash 防偽（M 未接上 003）。
- **NOT_RUN**：本報告所有測試、真 Supabase JWT／Storage／Deno、真獨立 SQL 並行、RI cascade 實測（M-4）、005 鎖序並行。
- **請 CTO 裁定**：
  1. 舊 classify／process／confirm 路徑是否要對 MANUAL provider 拒絕，或檢查「同文件已有 MANUAL」（M-1、M-2）。
  2. MANUAL activity_code 是否要改用不與 client 共用的命名空間，或為 activity／calc 加 server-managed trigger（M-3）。
  3. 駁回後是否允許以新 draft 重新轉錄（M-6）。
  4. MANUAL 是否限定 server_verified 收件。
  5. confirm replay 是否應先於 stale／期間檢查（M-5）。

此審查不構成雲端操作、合併或解除 HOLD 的核准。


## I 組：完整報告保存權威（I1–I6）唯讀審查

- 固定程式 SHA：`ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde`（核心 `6974e18`，對 `6974e18^` 的 diff；`6974e18..ba2c7a5` 僅 2 檔：`backend/tools/product-preview/worker.js` 合成預覽 CORS allowlist 加入 `127.0.0.1/localhost:4207`、`tenant-revocation-integration.test.js` 加一段 Origin 斷言，皆為本機合成工具／測試，無正式執行路徑影響）。
- 文件依據：`docs/delivery/CLAUDE_REPORT_INTEGRITY_TARGETED_REVIEW_20261107.md`、`CLAUDE_INTEGRATION_REVIEW_START_HERE_20261107.md` @ `9839e1f`。
- 方法：只用 `git show/diff/grep` 讀來源；**所有測試皆未重跑**；真 Supabase／JWT／Deno／兩連線 SQL 並行 NOT_RUN。行號以 `ba2c7a5` 為準；`006` = `backend/supabase/migrations/202611060006_report_snapshot_integrity.sql`。

### 總結

提交者所說「006 之前 OPEN」的兩項——一般角色能直接 INSERT/UPDATE/DELETE completed 報告列，以及只有非空 hash 的歷史列能匯出——從來源看，**一般 client 路徑都已關閉**。006 有三層防護：RESTRICTIVE policy、以 `role` GUC 判斷的 trigger、只有 owner 能寫入的 private 封存（seal）。三層互相獨立，任何一層都足以擋下 PostgREST 直寫。匯出／replay 時一律比對整列 `to_jsonb` 與 private 封存，沒有封存的列（歷史列、v1 RPC 列、service 直插列）一律以 `REPORT_SNAPSHOT_UNVERIFIED` 拒絕。沒有找到 P1／P2。共 4 項 P3：P3-1 為競態造成的暫時性誤判，P3-2 為封存契約脆弱，P3-3 為專案刪除行為改變，P3-4 為 UI busy 卡住（既有問題）。此外列出數項非缺陷的界線說明。

---

### I1 普通寫入／marker／GUC／audit／舊 v1 RPC／permissive policy／RLS 漂移；ACL 與 definer search_path

**判定：來源支持**（副作用見 P3-3）

證據：
- `006:32-34`：在 `public.report_generations` 上建立 `as restrictive ... to public` 的 INSERT `with check(false)`、UPDATE `using(false) with check(false)`、DELETE `using(false)`。RESTRICTIVE 與 core schema 的 permissive `report_generations_write_policy for all`（`202603160001_v1_core_schema.sql:634-640`）是 AND 關係，所以任何非 BYPASSRLS 的角色都寫不進去，無論有多少額外的 permissive policy。
- `006:18-31` trigger `protect_report`（BEFORE INSERT/UPDATE/DELETE，FOR EACH ROW）：
  - `:21`：`current_setting('role',true) in ('authenticated','anon')` 時一律 42501。PostgREST／pg_graphql 用 `set_config('role',…)` 切換角色，而 SECURITY DEFINER 不會改變 role GUC，所以 authenticated 即使透過任何 definer RPC 間接寫入也會被擋。
  - 這層也涵蓋 RLS 被停用的漂移情況（測試 `report-integrity-sql.test.js:40-43`）。
  - `:22-26`：把 marker 設為 `server_verified`（INSERT 或改值）時，要求 `current_user` 等於表 owner，所以 service_role 不能自己蓋 marker（測試 `:58`）。
- marker 本身不是權威：`verified_row`（`006:59-77`）要求 `cocal_report_private.snapshots` 裡存在封存，而且與整列 `to_jsonb` 相等，另外還要求 ledger 綁定。private schema 對 `public,anon,authenticated,service_role` 全數 revoke（`006:4,16,142`），唯一寫入者是 owner 擁有的 publisher（`006:112-113`）。006 沒有任何 GUC／flag 門檻，測試 `:59` 中 `cocal.report_publisher` GUC 無效；client 可寫的 `audit_logs` 也不被讀為權威（`:73-81`）。
- 舊 v1 `generate_report_atomic`：只授權給 service_role（`202610310003_atomic_rpc_service_role_only.sql:23-25`）。它插入的列 marker 為預設 `legacy_unverified`（`006:5-6`），也沒有封存，所以匯出／lookup 會得到 `REPORT_SNAPSHOT_UNVERIFIED`。authenticated 呼叫任何 definer 寫入都會被 `:21` 擋。
- ACL／search_path：
  - 新的 public 函式全部是 `security definer set search_path=''`，全限定名稱（`006:37,57,60,91,121,135`）。
  - `revoke ... from public,anon,authenticated` 之後只 `grant execute ... to service_role`（`006:143-144`），create 與 revoke 在同一 transaction（`begin…commit`），沒有暴露窗口。
  - 被搬進 private 的舊 v2 實作保留 `search_path=public`（`202611060001:26`）。但 private schema 沒有開放 USAGE，函式也已 revoke（`006:81-82`），只有 owner 的 wrapper 能呼叫，可接受。
  - `protect_report` 為 invoker、`search_path=''`，`regclass` 全限定，可接受。
- 以下屬殘留界線，不是缺陷：
  - service_role（BYPASSRLS）仍可 UPDATE／DELETE 報告內容。這是設計上的「maintenance」，結果會被 `verified_row` 偵測成 MISMATCH（測試 `:47-53`）。
  - TRUNCATE 不觸發 row trigger、也不受 RLS 管，但 PostgREST 沒有提供 TRUNCATE 端點，找不到 client 觸發路徑。

測試（已讀、未重跑）：`report-integrity-sql.test.js:15-20,33-45,55-64`；`report-integrity-http.test.js:13-19,30-41`。

缺少的回歸：
- authenticated 透過「某個 owner 的 SECURITY DEFINER RPC」間接寫入報告的負向測試。來源推論會被 `:21` 擋，但沒有直接測試。
- v1 `generate_report_atomic` 由 service 直接呼叫後的匯出負向測試。HTTP 測試 `:21-28` 用的是 service REST 直插，屬於等價路徑，但不是 v1 RPC 本身。

---

### I2 v2 INSERT → snapshot patch → 最終 marker → 封存／request／audit 是否同一 transaction；失敗能否全部 rollback

**判定：來源支持**

- 整條流程都在單一 SQL 函式呼叫內完成，PostgREST 對單一 RPC 只開一個 transaction：
  - `006:94` 先做 `require_write`。
  - `:96` 取 advisory xact lock，key 與內層 `202611060001:38` 相同，同一 transaction 內可重入。
  - `:104-107` 呼叫內層：v1 INSERT（`status='completed'`、`legacy_unverified`）→ snapshot UPDATE → ledger INSERT → audit INSERT（`202611060001:47-62`）。
  - `:108-111` 設 marker，並以 `returning *` 取回經 `set_updated_at` 等 BEFORE trigger 處理後的最終列。
  - `:112-113` 封存。
  - `:115` 重讀並驗證。
- 中途任何一步 raise 都會讓整個 transaction rollback。半成品（completed 但還沒蓋 marker）在 commit 前對其他連線不可見，不存在「先標可信」的窗口。
- 測試 `report-integrity-sql.test.js:66-71`：用合成 CHECK 讓 marker 步驟失敗，四張表計數皆為 0，同一 request 可以重試成功。
- 注意：generate handler 在 RPC commit 之後，另外用一個 transaction 呼叫 `read_verified_report_snapshot`（`generate-report/index.ts:248-251`）。如果在兩者之間撤權，client 會收到 403，但報告已經 commit；regrant 後用同一 request_id replay 會回到同一份報告（`006:97-101`），不會產生重複報告。action log 是 best-effort（`:255-272`），不是權威。

測試（已讀、未重跑）：上述測試，以及 `:22-31`（replay 不新增 audit）。

缺少的回歸：真 PostgREST transaction 邊界（NOT_RUN）。

---

### I3 lookup／replay／export 的完整列、UTC 正規化，以及 request／actor／scope／claim／contract 綁定；maintenance 竄改／刪除時的處理；legacy 列

**判定：來源支持**（P3-1、P3-2）

- 封存內容：`row_snapshot` = `to_jsonb(整列)`，並在函式層級 `set timezone='UTC'`（`006:56-57`）。JSON 對 timestamptz 輸出固定是 ISO 格式，只受 timezone 影響，所以 session 時區不同也能比對；測試 `:29` 用 Asia/Taipei 驗證過。比對使用 jsonb 語意相等（`:71`）。
- **這裡沒有雜湊／簽章**：權威來自 private 表裡的整列副本，不是 hash。`payload_hash` 是 handler 對 JS 物件算的 `sha256(JSON.stringify(payload))`（`generate-report/index.ts:215`）。jsonb 存入後會重排 key，所以無法從已存的 payload 重算出同一個 hash，006 也不驗它。匯出 HTML 自己也寫明「本次未重新驗證其雜湊」。因此 `server_verified` 只代表「目前這一列與封存當下的列完全相同」。一般角色無法寫入，自然無法偽造一組能通過的「payload+hash」。匯出檔本身沒有伺服器簽章，下游拿到檔案無法獨立驗證，這是界線說明，不是缺陷。
- 綁定：`verified_row` 要求封存的 org／project 與 report_id 相符、marker 為 `server_verified`、`status='completed'`、`contract_version='20261107.report.1'`、整列相等，且 ledger 存在相符的 `request_id/actor/version/claim/report_generation_id`（`006:70-75`）。
  - lookup（`:130`）與 publisher replay（`:99`）額外核對 actor／version／claim。別人的 request_id 只會得到 `report_request_intent_conflict`。
  - export（`:134-141`）不要求「匯出者就是產生者」，同組織的任何寫入角色都可以匯出（tenant_write_v1）。
- maintenance：
  - service 竄改列：MISMATCH。
  - 刪除列（含 FK cascade）：封存不設 FK（`006:7-8`），會落在「有封存、沒有列」的分支（`:65-66`），結果是 MISMATCH。
  - 刪除 ledger：service 只有 select／insert 權限（`202611060001:13`）；owner 刪除時 `:72-75` 判為 MISMATCH。
  - 有 ledger、沒有封存：`:103,:127` 判為 UNVERIFIED。
  - 以上全部是拒絕，不會補簽，也不會另建新報告（測試 `:47-53,73-81`；HTTP `:43-50`）。
- legacy：006 之前的所有列都被加上 `legacy_unverified`（`006:5-6`），SELECT policy 不變，所以仍然可讀。匯出時 `verified_row:69` 判為 UNVERIFIED，`report-export.js:10` 也做了二次防線。006 之前已存在的 ledger request 也無法 replay（`report-request-boundary.test.js` diff）。**部署後，所有既有報告都無法匯出**，必須用新版本重建；這屬於營運決策，需要 CTO 確認。

#### P3-1 並行重試時暫時誤判為 `REPORT_SNAPSHOT_UNVERIFIED`（信心：中）
- 位置：`006:125-127`（`report_snapshot_request_v2`），同樣的模式也在 `verified_row` `006:63-64`。
- 觸發：READ COMMITTED 下，每個 statement 各自取 snapshot。`:125` 讀封存時，原始 publisher 尚未 commit（看不到封存）；`:127` 讀 ledger 時對方剛好 commit（看得到 ledger）。結果判定為 UNVERIFIED。lookup 不取 advisory lock，所以同一 request 的重送（逾時重試或雙擊）落在 commit 瞬間時就會發生。
- 影響：fail-closed。handler 回 409 `REPORT_SNAPSHOT_UNVERIFIED`（`generate-report/index.ts:85`），語意上像是「舊報告缺證據」，容易誤導使用者；再重試即可恢復。不會產生錯誤的報告。
- 最小重現（兩連線，未執行）：T1 呼叫 publisher，停在 `:112` 之後尚未 commit；T2 呼叫 `report_snapshot_request_v2`，在 `:125` 之後、`:127` 之前讓 T1 commit。
- 建議：lookup 也先取同一個 advisory lock，或者單一 statement 同時讀取封存與 ledger。

#### P3-2 封存契約對 schema 變更與 no-op UPDATE 非常脆弱（信心：高；影響在未來）
- 位置：`006:56-57,70-71`。
- 觸發：
  - 任何之後的 `alter table report_generations add/drop column`。歷史上已有 4 次加欄位：`202603180001:36`、`202604070003:376`、`202605080001:87`，以及 006 本身。
  - service／owner 對任一已封存列做 no-op UPDATE：`trg_report_generations_updated_at` 會改寫 `updated_at`（core `:475-477`）。
- 影響：所有 `server_verified` 報告會同時變成 MISMATCH，匯出與 replay 一律 409。沒有 migration 守門機制，也沒有 re-seal 流程。`contract_version` 只比對固定字串，無法區分正當的 schema 演進。fail-closed，但屬於全面可用性風險。
- 缺少：migration 預檢或測試（例如在 schema 變更後斷言封存仍可驗），或改為只封存明確列出的欄位清單。

測試（已讀、未重跑）：SQL `:22-31,47-53,55-64,73-81`；HTTP `:21-50`；`report-request-boundary.test.js:114-122`。

---

### I4 服務端是否以最新資料核對組織／角色／project／訂閱；handler→RPC 窗口內撤權

**判定：來源支持**（兩連線並行屬「證據不足」，NOT_RUN）

- 三個 RPC 都會先呼叫 `require_write`（`006:36-53`；呼叫點 `:94,:124,:138`）。它在 SQL 內以最新資料檢查：
  - project 屬於該 org（`for key share`）；
  - org 的 `status='active'`（`for share`）；
  - 成員 active 且角色為 owner／admin／editor（`for share`）；
  - 依 `period_end desc, created_at desc, id` 取「最新」一筆訂閱（`for share`），並處理 `period_start`、grace、readonly。
- handler 端：
  - export 在 RPC 前後各呼叫一次 `authorize()`（`export-report-snapshot/index.ts:23,32`）；
  - generate 在 handler 內先檢查（`generate-report/index.ts:42-67`），SQL 再檢查一次。
  - viewer：handler 回 403（`authz.ts` WRITE_ROLES），SQL 也拒（`006:44`）。
  - 撤權：SELECT policy 為 `is_active_org_member`，所以撤權後也讀不到。
  - 唯讀或過期訂閱：可以讀（SELECT policy 不檢查訂閱），但不能匯出。這延續既有 tenant_write_v1 的政策，不是退步。
- 撤權窗口（來源推論）：
  - 撤權在 RPC 的 statement 開始前 commit：`require_write` 看得到，回 42501／403（合成 beforeDispatch 測試 `tenant-revocation-integration.test.js:72-78`）。
  - 撤權與 RPC 並行：`for share` 會讓成員／org 列的 UPDATE／DELETE 等到 RPC transaction 結束，所以 RPC 被序列化在撤權之前；export 的第二次 `authorize()` 接著會拒絕。
  - 新插入一筆唯讀訂閱是 phantom，不會被 `for share` 擋，RPC 會以舊 snapshot 完成。這仍是可序列化的順序，可以接受。
  - 以上全部只是 SQL 鎖語意推論，**沒有兩連線證據**。
- 界線說明：SQL 比 JS 嚴格。`enforce-subscription-readonly.js:4-14` 只依 `period_end` 排序、不看 `period_start`，SQL 會檢查 `now()<period_start`。兩者都必須通過，所以結果是 fail-closed，而且與 002–004 的寫法一致。另外，三層都沒有檢查 project 的 `status`（closed/archived）；目前 repo 也沒有這項政策，此處屬於證據不足，不判為缺陷。

測試（已讀、未重跑）：SQL `:83-92`；`tenant-revocation-integration.test.js:70-105,107-125`（合成 Auth、依序交錯，不是並行）。

缺少的回歸：兩連線的「撤權與 RPC」並行測試（NOT_RUN）；future-start 訂閱與 JS／SQL 不一致的案例。

---

### I5 報告來源映射能否被刪改而釋放附件引用；與 005 刪除 fence、MANUAL 的交集；新 guard 是否破壞合法流程

**判定：來源支持**（一般角色；service 路徑與 P3-3 見下）

- 005 的引用 fence 以 `public.report_generations.payload->'appendix_mappings'` 為準（`202611060005:48-58`），寫入時由 `deletion_report_reference` 再加鎖檢查（`:68-78`）。006 之前，editor 可以透過 FOR ALL policy 改 payload 或刪除報告列，進而釋放引用。006 之後一般角色已無法 UPDATE／DELETE（`006:21,33-34`），測試 `report-integrity-sql.test.js:94-104` 顯示刪除時得到 `DOCUMENT_HAS_REFERENCES`。
- publisher 的 marker UPDATE 會再觸發一次 005 的 reference_guard。由於同一 transaction 已持有該文件的 advisory lock，不會死結，也不會誤擋。
- 殘留（資訊）：005 只看 public 列，不看 private 封存。service／maintenance 刪改已封存列之後，文件就能被刪除，但封存仍記載原本的引用；之後匯出會 409 MISMATCH，所以不會產出錯誤報告。這需要 service 權限。刪除細節由 D 組審查。

#### P3-3 006 trigger 使已有報告的專案無法從 UI 刪除（信心：高，機制推論，未執行）
- 位置：`006:21`；FK `report_generations.project_id ... on delete cascade`（core `:355`）、`organization_id ... cascade`（`:354`）；UI `frontend/readdy-app/src/pages/admin/projects/ProjectListPage.tsx:74-77` 以 user JWT 執行 `from('projects').delete()`（`projects_write_policy for all`，core `:594-595`）。
- 觸發：owner／admin／editor 在 UI 刪除一個帶有任何報告列（包括 legacy）的專案。FK cascade 的 DELETE 會觸發 row trigger，而 role GUC 仍是 `authenticated`，所以 `REPORT_SERVER_PUBLICATION_REQUIRED`（42501）讓整個刪除 rollback。UI 只顯示泛用的 `delete_failed`。
- 對比：002 的 `protect_manual_draft` 用 `current_user`（cascade 時是 owner，會放行），006 用 role GUC，兩組語意不同。含已驗證或保留附件的專案原本就會被 003／005 擋，但「有報告、沒有保留附件」的專案是 006 新增的阻擋。
- 影響：可用性與行為改變。從保護封存報告的角度看大概是預期的，但沒有文件、錯誤碼或測試說明，需要 CTO 裁定。
- 缺少：「刪除專案 × 已存在報告」的回歸測試與明確錯誤訊息。

---

### I6 UI 的舊 load／generate／export 回覆在切換單位、同一人重新登入、A-B-A、unmount 時是否失效；preflight 刷新是否讓 busy 永久卡住；marker 不當作伺服器權威

**判定：仍有缺陷（P3-4；屬既有程式，非本次引入）**

- load：`ReportPreviewPage.tsx:90-123` 以 sequence 加上 `isAuthenticationCurrent(authEpoch,user)` 丟棄過期回覆；unmount 時 cleanup 會遞增 sequence。A-B-A 與重新登入都會失效。來源支持。
- generate：`:85-88,169-235` 只依身分與範圍（不含 exportBlock）判斷是否為目前操作，所以 preflight 刷新不會讓 busy 卡住。但 **`handleGenerateReport` 在本頁只有定義（`:169`），沒有任何元件呼叫它**（grep 結果只有定義行），因此本頁這段生成邏輯目前執行不到，修正無法在 UI 驗證。實際的生成入口在 `ReportGenerationHistoryPage.tsx:139,152` 與 `manualWorkflow.ts:96`，不在本次 diff 範圍。
- export：`:302-311` 的 `isCurrent` 包含 `exportContext`，其中含 `exportBlock`，而 006 起 exportBlock 也包含 integrity（`:81`）。

#### P3-4 匯出 busy 在範圍或身分變更後永久卡住（信心：高）
- 位置：`ReportPreviewPage.tsx:311` `finally{if(isCurrent())setExporting(false);}`，搭配 `:303`（`if(exporting…)return`）與 `:365,:596`（按鈕 `disabled={exporting…}`）。
- 觸發：按下匯出後、回覆抵達前，在同一個已掛載的路由內切到另一份報告或單位，或同一人登出再登入（authEpoch 改變）。之後 `isCurrent()` 為 false，`exporting` 永遠維持 true，換到新範圍（或 A-B-A 回到 A，因為 useMemo 產生的是新物件）都無法再匯出，提示文字也一直停在「正在向伺服器確認…」，直到元件 remount。
- 正確性：過期回覆確實不會存檔（`reportDownload.ts:20-23`），伺服器權威不受影響；這純粹是 UI 可用性問題。`useSubscriptionStatus` 只在 org 變更時重新抓取，沒有定時刷新，所以「preflight 刷新造成卡住」只會隨範圍變更發生。
- 建議：在範圍變更時重設 `exporting`，或比照 generation 的做法，把 busy 狀態跟 export 的 context 綁在一起。
- marker：`reportIntegrity.ts:2-8` 只用於顯示；`reportExportRead.ts:28-29` 對伺服器回傳的 snapshot 再擋一次；沒有任何自動補簽路徑。`readPersistedReportSnapshot`（`reportExportRead.ts:6-20`，user SELECT、不檢查 integrity）目前只有測試在用，沒有 UI 呼叫，但它是保留下來的旁路 helper，建議移除或加上 integrity 檢查（hardening，不判為缺陷）。

測試（已讀、未重跑）：`frontend/readdy-app/tests/reportIntegrity.test.ts`；`tenant-revocation-integration.test.js:107-125`（A-B-A／重新登入／token refresh，以服務函式模擬，不是 React 元件）。

缺少的回歸：React 元件層「匯出進行中切換範圍或重新登入後仍可再次匯出」；ReportPreviewPage 生成按鈕是否應存在。

---

### Findings 一覽

| ID | 等級 | 位置 @ba2c7a5 | 觸發 | 信心 |
|---|---|---|---|---|
| P3-1 | P3 | `006:125-127`（另有 `:63-64`） | 同一 request 重送剛好碰到原 transaction commit，兩個 statement 的 snapshot 不一致 | 中 |
| P3-2 | P3 | `006:56-57,70-71` | 未來任何 report_generations 欄位增刪，或 service 做 no-op UPDATE（updated_at trigger） | 高（未來觸發） |
| P3-3 | P3 | `006:21` × core FK `:354-355` × `ProjectListPage.tsx:74-77` | UI 刪除有報告列的專案或組織 | 高（推論） |
| P3-4 | P3 | `ReportPreviewPage.tsx:303,311,365,596` | 匯出中切換範圍或重新登入 | 高 |

既有 OPEN／NOT_RUN：
- 真 Supabase／JWT／Deno／Storage 與兩連線並行皆 NOT_RUN。
- 部署後所有既有報告無法匯出（需 CTO 決策）。
- `payload_hash` 未被驗證，匯出檔沒有伺服器簽章。
- v1 `generate_report_atomic` 仍授權給 service_role，建議 revoke（hardening）。
- project status 沒有任何層級的政策。

本審查不核准合併、雲端操作或解除 HOLD。
