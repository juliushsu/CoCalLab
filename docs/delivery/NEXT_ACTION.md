# Next action — 2026-11-09

- **專案目標：準備繼續／加密檔案前置已交付，完整主備份 runtime 尚未完成；發布 HOLD。** 本輪結束後沒有代理持續背景執行。既有核准沿用，精確授權／資源／費用／期限與完整接續紀錄留本機 Owner 受限報告，不公開；不因公開歷史快照重問。
- 分支 codex/uat-watchdog-runtime-20261109、[PR #38](https://github.com/juliushsu/CoCalLab/pull/38)。固定程式與文件 hash 見 [去敏來源回執](evidence/uat-owner-delivery-20261109/DELIVERY_RECEIPT.json)。watchdog 固定54d6f245322eb0e69c8c03f1444e4b0b2fcf795b；產品候選fd7efcfc6450dbf10f54aa97b65fe48e431b277d不變。
- [PR #39](https://github.com/juliushsu/CoCalLab/pull/39) 固定a8f8f4c89f720d099d995ddaafb205cad4aa301a已按Owner獨立核准重核並合併main為94d01b9c9f081df494f805b41166599ccd73541e，僅一個維運workflow，無產品合併／部署。[合成通知run42552744150](https://github.com/juliushsu/CoCalLab/actions/runs/42552744150)按設計failure、observe skipped；Email送達UNVERIFIED，只攔該項驗收。
- 實測 **加密檔案13/13、Node syntax／PS parse、Owner ACL／空間／另存key後讀回／防覆寫／竄改拒絕通過**。source、manifest與private receipt hash見去敏回執；每批合成資料明示、無覆寫。同機不是異地備份，不能代簽Owner接收真備份。完整說明見UAT_OWNER_DELIVERY_IMPLEMENTATION_20261109.md；介面／移植見deployment/uat/lifecycle/ENCRYPTED_ARTIFACT.md。
- 下一項：沿用既有native-pg-recovery的pg_dump／pg_restore／完整row+catalog verifier，補Storage原件、設定、精確restore target與持久operation／互斥／失敗恢復。先做本機明示合成測試，不重寫已關閉產品功能；本輪沒有重啟舊native server或連既有DB、5432。
- 真DB／Storage還原、provider資格／實際排程、真服務驗收、真刪除與未具名SQL並行仍NOT_RUN／BLOCKED；前置未通過不建立付費環境。公開authorization-status／execution-proposal是歷史快照，不能替代Owner受限現行記錄。

下一條可執行命令（repo root；定位沿用點，不連線／讀憑證／建立資源）：

~~~powershell
rg -n 'runClient|pg_dump|pg_restore|requireEqual|capture' backend/tools/native-pg-recovery/run.mjs
~~~
