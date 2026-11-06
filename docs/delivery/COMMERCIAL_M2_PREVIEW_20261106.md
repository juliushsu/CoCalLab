# M2 本機合成情境交付 — 2026-11-06

固定程式版本：5a59b2afa1f1d9bf2d1126a0f026f8d72503831a。分支codex/commercial-m2-preview-20261106，疊在PR #19的CI修正版bb1d035之上；未合併／部署，發布HOLD，既定UAT仍7dccd545。

## 可操作入口

本機原App：[登入](http://127.0.0.1:4197/login)，專用API4196。當前合成設定／每次重啟後的新ID：[config](http://127.0.0.1:4197/product-api/__synthetic/config)。本機資料只在記憶體，停止API即消失。

從repo root啟動：

```powershell
$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path
node backend/tools/product-preview/run.js --showcase --port=4196
```

另一個terminal切到frontend/readdy-app：

```powershell
node node_modules/vite/bin/vite.js --config tools/local-preview/vite.showcase.config.mjs
```

假帳號a-owner@product-preview.invalid／b-owner@product-preview.invalid／owner@product-preview.invalid（共享A owner/B viewer）／viewer@product-preview.invalid／outsider@product-preview.invalid。密碼全部為刻意公開的合成字串synthetic-local-only；不是Supabase帳號或可用雲端憑證。

登入後依config.manifest.fixtures中a、b、empty、pendingFactor、error的organizationId/projectId帶入原頁查詢參數organization_id、projectId。原活動列表、文件列表、待審草稿、報告歷史及/admin/reports/<reportId>皆沿用原App；選專案後可查看scope。已有4194/4195 M1服務保留，4192/4193也未替換。僅本次建立API exec40362、UI exec3857可停止，禁止終止其他專案服務。

## 實際行為與證據

- A 100kWh、B 20kWh經正常REST建活動、實際recalculate／generate-report handler與SQL RPC保存50kg／10kg報告；不以SQL直接插入計算／報告結果。
- A-only/B-only/shared/viewer/outsider依實際SQL RLS讀到所屬資料；shared的B viewer不能計算。私有合成PDF先以caller role查storage.objects RLS，再讀本機fixture bytes；匿名／跨租戶／public拒絕，上傳及刪除明確405。
- 空專案無活動／計算／報告；缺係數pending_factor與不支援單位error保存NULL，拒絕生成成功報告。未知handler明確404。
- 收件／草稿／storage catalog是明示的setup fixture，provider SYNTHETIC-REVIEW-FIXTURE、OCR pending。現有UI阻擋確認；真confirm-draft handler可駁回並保存，不產生活動。不代表正式文件轉草稿或OCR完成。
- Chrome原Login以A-only owner登入，打開已保存A報告顯示Completed、v1、總量／Scope2 0.05t，章節無內容明示。截圖：[synthetic-report.png](evidence/commercial-m2-20261106/synthetic-report.png)。此為合成瀏覽器結果，並非真服務隔離驗收。

## 測試與未驗範圍

- 新product-preview-scenarios.test.js **4/4 PASS**；獨立代理另跑同4/4，屬相同範圍，不加總。涵蓋角色讀取、cross-scope拒絕、空／錯誤／缺係數、草稿駁回與private byte read/hash一致。
- 原M1 product-preview.test.js **8/8 PASS**，確認default mode回歸。新增本機config與showcase JS語法檢查PASS；原App瀏覽器登入／報告讀取PASS。
- production src未變；沿用M1固定18c0894的frontend163/backend17/SQL214與type-check/lint/build結果，不宣稱對新fixture重跑全部。PR #19 CI bb1d035 run42179691073 success；本批CI須依新HEAD另收件。
- 實際Supabase Auth／簽章JWT／Storage HTTP、Deno runtime、雲端migration／備份還原、原生選檔下載及正式併發NOT_RUN。此adapter有限allowlist，未提供的API不假成功。
- 目前M1報告匯出仍TODO；PR #9/#10其他候選尚未接入。報告章節／識別與期間展示、最新Readdy遺漏導航與資訊介面仍READY，不以這批fixture宣稱補完。

## 最新Readdy保留核對

見[READDY_FINAL_FEATURE_PARITY_20261106.md](READDY_FINAL_FEATURE_PARITY_20261106.md)：29路由、6群22選單保留，但五階段導航、十章報告資訊UI、回饋入口及多處頁內捷徑尚未接入。原ZIP已保留、未執行或覆蓋；附原檔SHA及逐檔清單。這是來源比對，不冒稱ZIP瀏覽器驗收。

下一個READY：逐項恢復帶租戶／專案scope的流程導覽與頁內捷徑，保留真服務及失敗狀態；不得原樣恢復Mock完成度或假回饋成功。M4人工轉錄／回饋實際收件服務WAITING_CTO，真服務環境WAITING_OWNER。
