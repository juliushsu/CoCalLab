# Next action — 2026-11-07／N1 N2 與活動取代

- RELEASE HOLD。正式UAT基線仍7dccd5452152f2495d10ad1437d5d03215166065；未合併main、未部署、未操作雲端或新增費用。Owner原有預算／期限回執保留，最新CTO仍未授權建立UAT。
- CTO：P2-1～P2-3來源關閉；P2-4/N1待修復後定向複審。已fetch並ff保留Claude原文b69684dc2c52cc4b062b78f1e7aa711043366956，沒有覆蓋或重寫歷史。
- PR30 fixed program/SQL 33d3613487f42a7e9c5888ae312441e730d3d87e：whole-document MANUAL/latest/pending fences、ordinary側枝/改綁拒絕、private確認ledger及原ID重送、統一MANUAL corpus、source witness TOCTOU拒絕、N5取消提示/重試。舊handler缺witness新confirmed failclosed，真9eb原碼fixture已測；不是所有混版透明相容。交付入口CTO_N1_N2_DELIVERY_20261107.md。
- 固定archive全部925個tracked blobs核對一致，33d backend33/33、FE227/227、type/lint/build PASS；Deno15/15 checks+15 static bundles/hash PASS。完整整合358tests=356PASS/0FAIL/2NOT_RUN、exit0，見evidence/cto-n1-n2-20261107/VALIDATION.json；先前witness前351不冒稱final。獨立review witness6/6，子集重疊不加總。
- WAITING_CLAUDE：CLAUDE_N1_N2_REREVIEW_START_HERE_20261107.md，僅審N1/N2及source witness/N5交集，fixed33d；無需重開P2-1～3/H0。請Owner將固定入口交Claude；代理不代發外部訊息。
- N3開發接續，不等待Claude：最小契約ACTIVITY_REPLACEMENT_N3_CONTRACT_20261107.md，先案例再實作，另小PR。保留被取代活動/其計算/原稿/保存報告，server建更正或排除版本、明確reason/actor、單一有效末端、重送查原、取代後須重算；其他未取代活動沿既有latest語意，不擴版本平台。
- 部署注意：既有專案需重新計算，才能產生新版報告；進行中的舊重算可能失敗。不自動重算、不補簽、不覆寫歷史報告。歷史匯出相容影響仍待上線前Owner接受。
- N4 OPEN/NOT_RUN：project/document advisory/row鎖可能逆序與40P01；交易rollback後用同request核對，不新ID、不force release他人lease。N5前景自動觸發/真React未證；獨立SQL雙連線、真JWT/Storage/managedEdge/ESZIP、原生選檔/落盤、cloud migration/NOT VALID/復原與19+1均NOT_RUN。
- 既有4206/4207、4212/4213、5432與其他專案保留；新活動取代候選預留4214API/4215原App，建立後才回報已可用，不混稱舊b7瀏覽器涵蓋新程式。不重試Docker/WSL。
- 下一條可執行命令（repo root，本機合成）：$env:PGLITE_RUNTIME_ROOT=(Resolve-Path ../tooling/sql-runtime).Path; node --test --test-concurrency=1 backend/tests/integration/cto-n1-n2-sql.test.js backend/tests/integration/draft-confirmation-http.test.js backend/tests/integration/legacy-confirm-handler-http.test.js。
