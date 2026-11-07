# Next action — 2026-11-07／四P2修復候選

- RELEASE HOLD；未合併main/部署/操作雲端。PR29相容性依賴已CI success（3c127cef223457dffa95b99d0e8a7babbd230622）；PR30 branch codex/cto-p2-source-integrity-20261107，程式/SQL固定9ebf5b13427edf8d228659a24269ddaaf86a84f0。正式UAT基線仍7dccd5452152f2495d10ad1437d5d03215166065，舊ba2失敗證據保留。
- 已實作四P2/七邊界：受控活動編輯/重送/失效、可信recalc ledger與current sources、oldRPC縮權、MANUAL交易/provider前保護、有效server-verified收件、來源保留與硬刪原因、v1/v2明確欄位及export busy。CTO_P2_INTEGRATION_DELIVERY_20261107.md為本輪入口。
- 原生9eb15/15check+15bundle與所有hash PASS；backend31/31、FE225/225、type/lint/build PASS。9eb全整合337tests=335PASS/0FAIL/2NOTRUN，exit0；1f同範圍與獨立子集不加總。VALIDATION.json記實際版本；固定9eb的GitHub Verify source #42367239996已success；其後文件HEAD的CI另查，不以CI替代未驗真服務。
- 合成原App預覽http://127.0.0.1:4213/login，API4212；本輪browser固定b7：100→編輯120kWh→stale拒→重算→60kg/0.06t保存讀回，引用後edit121拒；截圖/未驗範圍已留。9eb後續marker/adapter增量有獨立測試，不混稱browser驗過。原4206/4207/5432/其他專案/stash/ZIP保留。
- WAITING_CLAUDE：CLAUDE_CTO_P2_REVIEW_START_HERE_20261107.md單一入口，只複審四P2及交集，不重開H0。已裁定方案不再WAITING_CTO停工；來源修復未代替Claude/CTO正式關閉。歷史匯出相容方案已具體提出，發布前Owner驗收影響。
- UAT_DEFERRED_NOT_AUTHORIZED：Owner累計預算/14天限制保留受限回執，不重問；最新CTO未授權建雲端資源，前置通過仍須具體操作授權，尚未建立/計費/起算，不自動續期或刪除。候選44migration/15function模板僅本機parser-load。
- NOT_RUN：2獨立SQL/鎖序、真JWT/Storage/managedEdge/ESZIP、原生chooser/save、cloud migration/NOT VALID/DB+Storage復原、19+1。合成HTTP/PGlite不替代，無Mock正式成功回退。
- 下一條可執行命令（repo root，需重現時）：node backend/tools/deployment-preflight/verify.mjs verify 9ebf5b13427edf8d228659a24269ddaaf86a84f0。全整合另需PGLITE_RUNTIME_ROOT指向既有../tooling/sql-runtime；不重試Docker/WSL、不新增費用、不宣稱無限背景運行。
