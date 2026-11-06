# Next action

- RELEASE HOLD；UAT固定7dccd5452152f2495d10ad1437d5d03215166065。未合併main、部署或操作雲端。
- M1 SOURCE_DONE候選：程式18c0894cf9da42eb341ce5835ba36fdc3a7bedc9；PR #19 HEAD bb1d0351fda82167fdbfb626e98c9ed69ac79ab9，CI run42179691073 success（僅修依賴安裝順序）。人工活動→實際handler→保存／重讀報告100kWh→50kg→.05t；163前端／17後端／214 SQL+HTTP、tsc/lint/build PASS。
- M2合成情境 SOURCE_DONE候選：程式5a59b2afa1f1d9bf2d1126a0f026f8d72503831a；branch codex/commercial-m2-preview-20261106。新增4/4、M1 HTTP回歸8/8 PASS；獨立4/4重跑不加總。原App瀏覽器A-only登入／保存報告讀取PASS。完整啟動與限制：COMMERCIAL_M2_PREVIEW_20261106.md。M2整體仍RUNNING。
- 入口M2 http://127.0.0.1:4197/login →本次API4196；M1 4195→4194保留。當前合成帳號／ID見4197/product-api/__synthetic/config。僅自建API exec40362／UI3857可停止，其他專案及5432保留。
- 使用者最新Readdy ZIP已保留，SHA256 f6e909dc801a6785b7be453a53da24bde38efa20be3b5357cda1a19e2e309325。來源比對：29路由、6群22選單仍在；五階段導覽、十章報告資訊、回饋入口與頁內捷徑確實缺少。見READDY_FINAL_FEATURE_PARITY_20261106.md；未覆蓋工程、執行ZIP、沿用.env或憑證。
- 第1項SOURCE_DONE：815315b121924f86066220b573284016a30d64eb，branch codex/restore-workflow-navigation-20261106；五階段／捷徑／側欄scope、歷史範圍與直接報告補scope，166前端與tsc/lint/build PASS，Chrome操作截圖見RESTORED_NAVIGATION_20261106.md。
- 下一RUNNING：第2項十章結構與真保存欄位；其後局部接入PR9/10匯出helpers，最後M4方案A。CTO已核准人工轉錄本機開發與隔離測試；允許同人轉錄／確認，不冒稱OCR／雙人覆核。回饋只做本機編寫／複製，明示尚未送出。
- WAITING_CTO：18c0894新ledger/RPC定向紅隊問題；Scope規則、回饋真收件服務。其他READY可繼續。Hash防偽、全報告防竄改與跨服務刪除OPEN。
- WAITING_OWNER：真實隔離環境／Auth JWT Storage E2E、雲端migration資源資料與費用／發布；均NOT_RUN。PGlite／合成瀏覽器不替代真服務驗收。
- 下一條命令（repo root，只跑專屬本機測試）：`$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path; node --test backend/tests/integration/product-preview-scenarios.test.js`。要預覽先用現有4197，依README只在未啟動時啟動，禁止重複占用或殺其他服務。
- 保留stash pc-export-browser-harness-preserved-20261102；此為有限session接續點，不宣稱無限背景執行。
