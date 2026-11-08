# Next action — 2026-11-07／N1 N2＋N3本機整合候選

- RELEASE HOLD；未合併main、未部署、未操作雲端或新增費用。正式UAT基線仍7dccd5452152f2495d10ad1437d5d03215166065。Owner原回執保留；最新CTO未授權建立UAT，不啟動費用/期限，不重試Docker/WSL。
- PR30 N1/N2程式33d3613487f42a7e9c5888ae312441e730d3d87e，文件23f49ada664d4d37290e5712cf068d2c55f8bd89及CI42383511177 success。保留b69684dc2c52cc4b062b78f1e7aa711043366956 Claude原文；P2-1～P2-3沿CTO來源關閉，P2-4/N1仍WAITING_CLAUDE，不能自行宣稱關閉。
- PR31 branch codex/activity-replacement-20261107：app/SQL固定ed6ca9bbfbc5581cdcacf2969340575217fcb8c4；test-only d761e46e26e2625551781da2120641e8e18c2d1c僅修overflow fixture，應用樹相同。更正/排除明確新版本、server actor/reason/來源繼承/單一有效末端、原ID重送/撤權/rollback、有效統計與報告，原UI/選單/路由/歷史保留。
- N3最終整合374=372PASS/0FAIL/2NOT_RUN，backend35/35、FE236/236、type/lint/buildPASS；ed6 native16check+16靜態bundle/hashPASS。初輪1個舊DDL fixture失敗與其真22003修正保留證據；不把獨立子集加總。完整證據evidence/activity-replacement-20261107/VALIDATION.json；固定d761 GitHub CI42386465225 success；其後文件HEAD狀態另核對，不借舊版冒稱。
- Chrome固定ed6＋sourceDirty=false已跑人工來源100/50kg→更正120→STALE拒新報告→明確放棄該本機報告參考→重算/報告60kg→排除仍120kWh→1excluded/v3；原v1仍50kg，6筆原始row完整JSON不變。9張截圖與三版actor/reason鏈已留。不是managedSupabase或原生存檔驗收。
- 可用原App http://127.0.0.1:4215/login ，專用合成API4214；a-owner@product-preview.invalid / synthetic-local-only僅本機測試。啟動/操作/實際URLs見ACTIVITY_REPLACEMENT_N3_DELIVERY_20261107.md及PREVIEW_RECEIPT.json；重啟生成新ID。原4206/4207、4212/4213、5432及其他專案保留。
- WAITING_CLAUDE：CLAUDE_N1_N3_REVIEW_QUEUE_20261107.md單一入口，A固定33d的N1/N2/witness/N5，B固定ed6的N3及交集，不重開整案。主代理未代發外部訊息；未有需新增人工裁定的工程方案。
- N4 OPEN/NOT_RUN：兩獨立SQL連線/鎖等待/40P01；N5僅取消提示與helper重試已驗，真React前景自動觸發未證。真JWT/Storage/managedEdge/ESZIP、原生chooser/落盤、cloud migration/NOT VALID/復原與19+1仍NOT_RUN。
- 部署模板候選46migration=43schema+3歷史fixture HOLD，16functions均JWT、3Mock停用、CLI2.122.1只本機parser scaffold。目標ref=null，沒有雲端授權。既有專案須重新計算才能新報告；進行中的舊重算可能失敗。不自動重算/補簽/覆寫歷史；004與newconfirm需成套，oldconfirmed缺witness failclosed。
- 下一條可執行命令（repo root，收到定向審查後重現相關路徑時）：$env:PGLITE_RUNTIME_ROOT=(Resolve-Path ../tooling/sql-runtime).Path; node --test --test-concurrency=1 backend/tests/integration/activity-replacement-sql.test.js backend/tests/integration/activity-replacement-http.test.js。Session無無限背景執行承諾；現有本機預覽程序保留供操作。
