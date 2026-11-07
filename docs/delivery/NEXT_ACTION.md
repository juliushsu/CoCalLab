# Next action — 2026-11-07

- RELEASE HOLD；正式UAT固定7dccd5452152f2495d10ad1437d5d03215166065。未合併main、部署或操作雲端／正式資料。
- 整合分支codex/integration-acceptance-20261107；程式固定ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde（report核心6974e18，ba2c7a5僅本機預覽origin）。PR21–27祖先鏈核對完成，原29路由／選單保留＋MANUAL一路共30。完整交付INTEGRATION_ACCEPTANCE_DELIVERY_20261107.md。
- SOURCE_DONE_LOCAL：006完整report權威，普通直接寫入／刪除拒絕，legacy不補簽；合法v2整交易保存，lookup/export完整row與request fresh核對；內容或authority漂移409，不建替代報告。server_verified不是碳資料／業務認證。
- SYNTHETIC_PASS：A/B/shared/viewer ID/API/Storage/exports；handler→RPC間revoke四流程拒絕／sameID重授權恢復不重傳；A-B-A／同人重登舊下載丟棄，routine refresh保留。真React延遲生成競態只來源複核，不冒稱瀏覽器已測。
- 實跑FE221/221、backend27/27、SQL/HTTP310 cases＝308 PASS／2 NOT_RUN；type-check/lint/build PASS。subset與獨立審閱13＋13及時區／來源各1皆不加總；兩獨立SQL並行仍未驗。
- 專屬預覽http://127.0.0.1:4207/login →合成API4206；a-owner@product-preview.invalid／synthetic-local-only只本機。API54957／UI77958為本次服務；重啟會清資料／換IDs。其他預覽／既有5432保留。Chrome已走原專案→中心→歷史→report且重載，50kg/.05t與來源提示可見。
- 同SHA實際SDK可信收件→MANUAL同人確認→calc v1/generic v2同ID重送→完整保存report→授權HTML/JSON實際Node產檔；引用拒刪／無引用封存／pending恢復scenario保留。evidence/integration-acceptance-20261107含JSON/HTML/截圖/完整SQL輸出及41份migration manifest（本機套38，非雲端清單）。
- READY_TO_FORWARD／WAITING_CLAUDE：CLAUDE_INTEGRATION_REVIEW_START_HERE_20261107.md，五組原固定SHA保留；新增CLAUDE_REPORT_INTEGRITY_TARGETED_REVIEW_20261107.md固定ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde。已提示Owner轉交，未聯絡第三方；WAITING_CTO新authority/RPC裁定。
- WAITING_OWNER：ISOLATED_UAT_EXECUTION_PROPOSAL_20261107.md，推薦新獨立Supabase UAT／純靜態前端，列資源、成本、migration/bucket/帳號／backup-reset-restore窗口供一次核准。現wynqnvidepzzcwutexvn只name match，不寫入；Cloudflare帳戶/Pages、Railway/Runway分類未新增證實，不建資源。
- BLOCKED/NOT_RUN：真Auth/JWT/Storage/PostgREST/Deno、live migration/drift／NOT VALID資料驗證、兩獨立PG連線、備份還原object generation/proof一致性、原生chooser/存檔、代表使用者及19+1負載；不擴browser權限、不重試Docker/WSL。Mock OCR/AI及未宣稱輸入可信度仍OPEN。
- 下一條可執行命令（有新變更或需要重現時，repo root）：$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path; node --test --test-concurrency=1 backend/tests/integration/report-integrity-sql.test.js backend/tests/integration/report-integrity-http.test.js backend/tests/integration/tenant-revocation-integration.test.js
- 完整預覽重建：node backend/tools/product-preview/delivery-demo.js --integration-acceptance；另在frontend/readdy-app跑node node_modules/vite/bin/vite.js --config tools/local-preview/vite.acceptance.config.mjs。先核對4206/4207占用，只停止本次自有服務。舊NEXT保留NEXT_ACTION_HISTORY_20261107.md；有限session交接，不宣稱無限背景執行。
