# Storage 審查修復交付：S3／S4 與六項 P3

2026-11-02。**來源修復候選，S3／S4 仍 OPEN；PR #14 未放行，發布 HOLD。**
沒有合併、雲端 migration、bucket 建立、既有物件清理或真實上傳。
UAT 基準仍是 `7dccd5452152f2495d10ad1437d5d03215166065`，不與功能候選混用。

## 版本與完整審查

- 修復分支：`codex/secure-upload-review-fixes-20261102`。
- 分支基底：`f76368953d4f952632f4356c4d7ccbccd46cd5c2`。保留使用者新增的完整審查原文，未修改或改寫歷史。
- 原受審程式：`71ffcf47defef31236181f8b938fc005f46dcb71`。
- [完整 Claude 審查（固定 f763689）](https://github.com/juliushsu/CoCalLab/blob/f76368953d4f952632f4356c4d7ccbccd46cd5c2/docs/delivery/CLAUDE_STORAGE_REVIEW_REPLY_20261102.md)。
- 本次只交同一上傳／收件功能的修復 PR，base 為 PR #14 分支；固定修復 SHA 與複審範圍見同目錄 `CLAUDE_STORAGE_FIX_REREVIEW_20261102.md`。外部複審尚未執行。

## 逐項來源與回歸

下表的「修復」只指來源與下述替身環境，並非 CTO 關閉裁定或正式服務驗收。

| 項目 | 修復行為與來源 | 已執行證據／新增回歸 |
| --- | --- | --- |
| P2-S4 token refresh | `authContinuity.ts`、`AuthProvider.tsx` 將操作世代綁定使用者與登入 session family。正常刷新／同 session 的 focus SIGNED_IN 保留世代；明確登入意圖、登出、另一登入 session、使用者切換使舊操作失效。UploadPage 綁定世代與專案／路由，回呼查最新 session 有效期。 | `authContinuity.test.ts` 5 項；保留 sessionGate／持久登出的既有測試；Chrome 正常刷新物件 1／收件 1，登出／重登入／換人／換專案均 1／0。 |
| P2-S4 明確恢復 | `completeIntakeRegistration` 先重新取得身分／可寫契約、查原 ID 與同內容既有回執，再核對本機原參考及原物件大小、MIME、SHA，最後 INSERT 原 ID/path。無 bytes upload、無新 documentId、無 DELETE。UI 分開「唯讀核對」「補登記」「放棄本機參考」。 | `documentIntake.test.ts` 涵蓋補登記、另一分頁已完成、遺失成功回應、錯誤 actor／viewer／舊契約／缺檔／壞 bytes／MIME／參考竄改，失敗不得 INSERT；Chrome 原 ID 9c7d1f8e…，物件維持 1、收件 POST 1→2 後成功。 |
| P2-S3 metadata 綁定 | 增量 `202611020002_storage_receipt_review_fixes.sql` 的 `guard_receipt_metadata` 在直接 authenticated INSERT 比對該物件 metadata size/mimetype；缺少、無效、不一致均 42501。保留 001 原有身分／租戶／角色／物件擁有者檢查。 | SQL RED：錯誤 size、MIME、NULL metadata 原本被接受；GREEN：直接 SQL／非超級使用者拒絕，涵蓋 JSON 型別、範圍、零／負／小數、大小不符、MIME 不符及合法角色。未經 UI。 |
| P3-a 路徑大小寫 | 新 INSERT 的專案段必須等於小寫 canonical UUID，與 receipt 一致；保留原 legacy project parser。 | SQL 三個 bucket 的大寫新路徑拒絕；既有大寫合法舊路徑同租戶讀／刪除仍成功。無舊物件搬移。 |
| P3-b 未送出參考 | 上傳階段先再次確認情境，再寫 checkpoint；寫入後若情境已失效則清除該尚未送出參考。 | SDK 在 uploading 階段使情境失效：Storage／receipt 寫入 0，本機參考 0。Storage 本身不可用時不得傳 bytes。 |
| P3-c 另一分頁已完成 | 先查已保存、可讀且原檔核對通過的同內容回執，再處理本機殘留；第二次查詢的競態也保留原 orphan 的獨立恢復參考。 | SDK 先有舊參考及查詢中途另一分頁完成兩種情況；UploadPage 的 upload／recheck 成功接線都使用 recoveryReference 優先，放棄指向原 attempt。無自動伺服器清理。 |
| P3-d 損壞 journal | 逐筆保留原始值到同使用者的本機 quarantine，確認備份後才移走原值；單筆損壞不阻塞有效參考。備份失敗保留原值並只略過該筆。 | SDK 壞 JSON＋有效紀錄、quarantine 無額度及移除未持久化；UI 顯示隔離筆數。實際無法清除時不得假報成功。 |
| P3-e 真實 uploader | `intakeReference` 的 verified JSON 取 persisted record 的 uploader／type／OCR 狀態；未確認 attempt 使用 requested_by_user_id，SHA 標 client_sha256。 | SDK 既有回執由其他使用者上傳，匯出不會標成本次使用者；不執行 OCR。 |
| P3-f 部署漂移 | 002 安裝 owner-only 相容性 baseline，檢查 policy expressions／roles／mode／command、trigger 定義／事件／timing／WHEN、helper body／owner／ACL／search_path、相關 schema ACL 等；契約升到 20261102.2。 | SQL 同名放寬 policy、改 trigger、helper、ACL、search_path／NULL 等均 can_write=false；正常 true、app 無 baseline 權限。前端拒絕舊契約，真正權限仍由每筆 RLS／trigger 控制。 |

登入 JWT 的 session_id 只用作 UI 操作連續性，未驗證 JWT，也不授予權限。
其 claim 與事件語意參考 [Supabase JWT fields](https://supabase.com/docs/guides/auth/jwt-fields)、
[onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)；
實際身分仍由 getUser、RLS 與 trigger 決定。已送出的請求不能由 UI 世代變更回溯取消。

## 實測清單

| 版本／環境 | 命令／操作 | 實際結果 | 證據位置 | 未驗範圍 |
| --- | --- | --- | --- | --- |
| f763689 的原頁面＋明示合成 SDK fixture，Chrome／localhost:4189 | 上傳途中替換同使用者 session（TOKEN_REFRESHED） | RED：物件 1，收件 0，保留未知參考 | [red-token-refresh.ax.txt](evidence/storage-review-fixes/red-token-refresh.ax.txt) | 非真實 Auth；舊來源重現 |
| 001 原 SQL，PGlite 0.5.13／PostgreSQL 18.6 | 設 STORAGE_REVIEW_BASELINE=1 執行新增 review suite，排除 002 | RED：9 個缺陷子測試失敗，含 parent 共 10 failures；exit 1 | [red-sql.txt](evidence/storage-review-fixes/red-sql.txt)、後端 README | Storage catalog/auth.uid 替身 |
| 本修復來源，Node 24.22.1 | frontend `node --test tests/*.test.ts` | 131/131 PASS，其中 intake 27、auth continuity 5 | [green-frontend.txt](evidence/storage-review-fixes/green-frontend.txt) | 無實際 Supabase／原生檔案選擇器 |
| 本修復來源，Node 24.22.1 | backend `node --test tests/*.test.js` | 16/16 PASS，保留既有測試 | 本輪執行命令回執與 GitHub CI；測試原碼在 backend/tests | 既有 provider mock 測試不證明真實 AI |
| 本修復來源，PGlite 0.5.13／PostgreSQL 18.6 | `PGLITE_RUNTIME_ROOT=<runtime> node --test backend/tests/integration/*.test.js` | 183/183 PASS；新增 review 61、原 Storage 32 皆通過 | [SQL 細節與重現](../../backend/tests/integration/storage-receipt-review-fixes.README.md)；本輪命令回執，GitHub CI 另查 | 沒有 Storage bytes／HTTP、真實 JWT、PostgREST、正式 PostgreSQL |
| 本修復來源，前端既有依賴 | type-check、完整 lint（max-warnings 0）、build | 全 PASS | 同批命令紀錄；GitHub CI 另查最新版 SHA | 本機 build 並非部署 |
| 本修復頁面，Chrome／localhost:4189、SDK fetch 全攔截至 .invalid | 正常 token refresh | GREEN：物件 1／收件 1 | [green-token-refresh.ax.txt](evidence/storage-review-fixes/green-token-refresh.ax.txt) | useAuth fixture 使用同一 continuity helper，未 mount 真實 AuthProvider／Auth 服務 |
| 同上 | 對 RED 留下的物件明確補登記 | 原 ID 40d03565…，物件 1／收件 0→1 | [原 ID 恢復](evidence/storage-review-fixes/green-original-id-recovery.ax.txt) | 非真實服務交易 |
| 同上 | 檔案成功／收件拒絕，再僅允許下一次 INSERT，按「補登記」 | 原 ID 9c7d1f8e…，物件 1 不變，收件 POST 1→2；row saved=true | [恢復 AX](evidence/storage-review-fixes/green-row-retry.ax.txt)、[截圖](evidence/storage-review-fixes/green-row-retry.png) | 沒有使用 fixture 的直接 commit-row 按鈕 |
| 同上 | 上傳中登出、同帳號明確重登入、換使用者、延遲回應前換專案路由 | 每項物件 1／收件 0；不把舊結果套進新畫面 | [登出](evidence/storage-review-fixes/green-logout-boundary.ax.txt)、[重登入](evidence/storage-review-fixes/green-relogin-boundary.ax.txt)、[換人](evidence/storage-review-fixes/green-user-switch-boundary.ax.txt)、[換專案](evidence/storage-review-fixes/green-project-switch-boundary.ax.txt) | 無法撤銷已送出請求 |
| 同上 | 放棄單一恢復參考，確認提示後重載 | 無參考；物件計數仍 1、收件 0，不刪 server 檔案 | [放棄與重載](evidence/storage-review-fixes/green-local-abandon-reload.ax.txt) | 瀏覽器清除／遺失資料不提供跨裝置恢復 |
| 主機原生選檔 | 先前已確認 extension file URL 存取限制；本輪不重試／不改權限 | BLOCKED | 沿用 PR #14 瀏覽器限制紀錄 | 真實原生選檔、相機／相簿選取未驗 |
| 真實 Supabase／隔離 UAT | JWT、Storage metadata、上傳、migration／backup／restore | NOT_RUN／BLOCKED | 本文件與 NEXT_ACTION | 尚無授權可寫隔離環境，不能替代為 CI／PGlite |

本機瀏覽器使用真實 DocumentUploadPage／intake／recovery 模組，但 layout、useAuth 和資料服務在測試入口被明確替換。
檔案是瀏覽器記憶體產生的 42-byte SYNTHETIC PDF，經頁面原 input change 與 Upload 按鈕；沒有讀取主機檔案、傳送企業資料或接回正式流程。
啟動命令（frontend/readdy-app）：
`node node_modules/vite/bin/vite.js --config tests/browser/upload-intake/vite.config.mjs`。
僅 loopback 4189、獨立 envDir、不讀正式 .env。測試服務完成後停止。

## 尚未關閉的限制與部署申請

1. **OPEN：server byte／SHA256 attestation 與 hash 唯一索引占用。** metadata 一致不等於內容類型或 hash 經伺服器驗證。直接 API 仍可填入格式合法的假 hash；新增 SQL 正例保留其可占 unique key 的事實，第二筆 23505。不能將 S3 的 metadata 修復擴大為完整「收件不可偽造」。
2. 被 SELECT guard 隔離的歷史錯誤 row 若占 unique key，前端不能自行修正；恢復可能繼續失敗，保留／放棄本機參考並交 Owner 盤點。既有 NOT VALID 約束仍未驗證歷史資料。本輪未重寫或驗證任何現有資料。
3. 漂移 baseline 是**安裝時的相容性快照**，無法對抗 DDL owner，也不能證明安裝前的 policy/helper 可信。批准套用前必須比對完整已部署來源與先備版本。平台 helper／ACL 變更會 fail closed，須經審查更新 baseline，不能執行時自動接受。
4. 新增 002 的 private baseline table／functions／trigger／RPC version 都是待批准的雲端 schema／權限變更；本輪僅來源定義。其先備 001 若缺 `documents` 會建立 private bucket，**必須列入 Owner 資源建立申請**；兩個 staging bucket 及舊 public 配置亦須先查核，不默默改公開性。
5. 未授權的 bucket 建立、雲端 migration、真實上傳、既有物件清理、資料修補、費用、部署與流量切換均不執行。尚無新增服務或付費 AI。OCR／分類維持分離。

回復方案：先關閉新上傳入口並回退應用程式，保留 restrictive guard、物件與收件資料。舊 client 契約不符時停止傳 bytes。
不能把撤除 RLS／trigger 或刪 bucket 當作自動 rollback；任何雲端回復需 Owner 核准具體環境、備份、影響與驗證方式。
下一關僅安排固定修復 SHA 的定向來源複審，之後再決定已授權隔離環境實測，不能據此發布。
