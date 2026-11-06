# 服務端附件 hash 驗證候選 — 2026-11-06

基準：06bad0818625bd9d4f3b685dff50994157b52757；保留後續文件至 bfb51c4e2e1929ba98c0b1d595792ff53d2527b2。來源固定版本：411a99d597046f65dd54fc134df5dc0d8346c346（來源候選；未合併／部署／正式驗收）。RELEASE HOLD，正式 UAT 基準仍為 7dccd5452152f2495d10ad1437d5d03215166065。

## 實際行為與相容性

新上傳先核對版本化 upload_verification_contract（20261106.hash.1），不具備來源相容條件時停止於傳送 bytes 之前。Storage 原件仍以原本的獨立 documentId／路徑存放，不 upsert。瀏覽器 hash 僅供選檔比對與本機恢復，前端不再直接 INSERT 收件，也不將前端聲明作為可信證明。

verify-upload-receipt 經實際登入者／角色／訂閱與同單位專案驗證後，先以持久 reservation 綁定原件的 bucket、path、Storage object ID、owner、size／MIME，再由產品 adapter 讀取受授權的私有原件。可移植 modules/file-verification v1.0.0 計算實際 bytes 的 SHA-256，限制讀取至 10 MiB、核對長度及 PDF／PNG／JPEG header，支援取消／逾時。完成交易重新核對 scope、權限與物件身分，保存可信回執及私有 authority。

舊收件不批次改 hash、不移動物件，保留原列並標 legacy_unverified。唯一索引僅包含 server_verified；舊的偽造 hash 不再占用新可信回執的位置。同 ID 舊收件拒絕自動升級（LEGACY_RECEIPT_REQUIRES_OWNER_REVIEW），需保留供 Owner 核對。新流程的直接 authenticated 收件 INSERT 被拒絕，不能自行寫入「已驗證」。

同 request／document ID 重送重用持久 reservation；bytes 不重傳、不產生新 ID。已提交但回覆遺失可依原 ID 重讀；原件成功、讀取／登記失敗則保留恢復參考，明示未確認。同內容不同 ID 由服務端計算後回傳已有可信回執與該回執的 proof；新 attempt 原件不自動刪除。本機「放棄參考」不刪伺服器檔案。

已 reserved／verified／duplicate 的原件禁止一般角色改寫、刪除或 delete/recreate；可信回執由私有 authority 綁定。舊的前端兩步刪除流程不適用新可信原件，先明確拒絕，於本輪第3項接續受控刪除／恢復，不能冒稱跨服務原子操作。舊資料合法瀏覽與私有讀取保留。

SHA-256 僅證明服務端讀到的 bytes，header 檢查不等於完整檔案解析、惡意檔案掃描、OCR／業務真實性或合規認證；人工轉錄與核准仍使用既有流程。

## 部署與維運範圍

新增 source-only migration 202611060003_server_attachment_verification.sql、Edge Function verify-upload-receipt 及產品 adapter；無新雲端服務、費用或憑證。增量 migration 依賴已核准的 Storage／MANUAL 來源基線，拒絕未知既有 policy 漂移。新增的 catalog fingerprint 前置檢查只辨識相容性；權限由資料庫、Storage 及服務端執行。

Owner 未核准前，不在雲端套用 migration、建立 bucket、清理 reservation、搬移／刪除既有物件。部署申請須列實際專案、既存資料盤點、備份／還原目標、已套用 migration 與待套用差異，先部署相容後端再啟用新客戶端。新客戶端缺少新契約時拒絕上傳；舊客戶端在新 schema 不能直接登記，須安排明確版本切換。不可只回退前端或撤銷保護來恢復舊的偽 hash 寫入。

失敗後保留 document/request ID、reservation 與原件，用原 ID 補登記。hash 或 object binding 不符時停止並交管理員核對；不得自動解除 fence、重建相同路徑、重新命名既有檔案或信任舊 client hash。受控刪除尚待第3項；trusted service-role 維護、Supabase Storage 引擎實際鎖定／bytes 一致性及管理員繞過不在普通角色保證內。

## 實測與未驗範圍

主代理實跑：前端197/197、backend27/27、型別／lint／build PASS；回歸SQL/HTTP245/245（加入最後lifecycle負例前），最終附件SQL7＋HTTP6=13/13另跑PASS。最終新增目標由實作代理跑module6＋SQL7＋HTTP6=19/19 PASS；與前述範圍重疊，不加總。獨立審閱跑FE57/57、舊SQL6/6、core6/6、再只跑新lifecycle SQL/HTTP2/2，未見未修P1/P2；這些也是子集。

可重現缺陷：新增migration之前，普通authenticated偽hash INSERT未被拒（Missing expected rejection）；修正後包含額外permissive policy仍42501。lifecycle/env負例亦先出現Missing expected rejection，修正後409且reservation保留。見backend/tests/integration/attachment-verification-{sql,http}.test.js與backend/tests/file-verification.test.js。

本機API4200在固定來源411a99d597046f65dd54fc134df5dc0d8346c346重新啟動，使用原App服務的實際SDK multipart上傳合成PDF；服務端重讀bytes並保存可信回執，第二次同內容重用同ID，actual-sdk-receipt.json記錄writes=1、reads=2。Chrome登入／專案範圍／收件清單顯示server proof與OCR pending；verified-receipt.jpg保存畫面。原生選檔BLOCKED：Chrome ChatGPT擴充功能未Allow access to file URLs；未改擴充功能權限，不將SDK證據算作原生選檔通過。

所有測試資料均為明確合成測試 fixture，沒有接回正式成功流程。

NOT_RUN：真 Supabase JWT／Storage／Deno、獨立 PostgreSQL SQL 連線鎖等待／並行、雲端 migration、真實檔案上傳、服務備份／復原。PGlite 的序列 SQL、模擬 HTTP 或 Promise.all 不代替這些證據。

## 可操作入口

現行本機入口：http://127.0.0.1:4201/login；API http://127.0.0.1:4200。只綁loopback、獨立記憶體資料庫；既有預覽及5432保留。合成帳號 a-owner@product-preview.invalid／密碼 synthetic-local-only（不是任何雲端帳號）。ID每次重啟改變，當前值讀 /product-api/__synthetic/config。

從repo root啟動API：

    $env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path
    node backend/tools/product-preview/run.js --verified-upload --port=4200

從frontend/readdy-app啟動UI：

    node node_modules/vite/bin/vite.js --config tools/local-preview/vite.verification.config.mjs

使用已登入合成帳號選專案後可讀收件。無原生選檔權限時，從repo root執行 node backend/tools/product-preview/upload-demo.js，正常SDK／產品服務會送同一份明示合成PDF，再次執行重用既有可信收件；不使用service-role繞過收件。頁面仍保留原有查看、下載、人工轉錄與刪除入口；可信原件刪除先顯示受控流程未接入，下一項序列第3項處理。

最終target命令：

    node --test --test-concurrency=1 backend/tests/file-verification.test.js backend/tests/integration/attachment-verification-sql.test.js backend/tests/integration/attachment-verification-http.test.js

舊trusted hash若屬另一環境或已封存，server actual hash後明確409 HASH_EXISTS_DIFFERENT_LIFECYCLE_OR_ENV，不回假duplicate，本次reservation保留；未改project/hash去重商業範圍，不自動清理舊資料。

## 下一項

本項驗證及小 PR 後，接續通用重算冪等性，再做受控刪除部分失敗／恢復。定向審閱僅覆蓋本批 trust chain，不重新展開全案稽核。
