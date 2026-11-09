# Next action — 2026-11-09

- **專案目標：暫停／WAITING_RAILWAY_LOGIN_THEN_OWNER_PLAN；發布 HOLD。** 指定 Supabase 帳戶唯讀前置已完成，不再等相同登入／UAT 組織／US$20／14 天或已選到期處理。Railway 登入頁已交 Owner；實際工作區／資源未核實。Mac 無本次可用管理連線，不能假定電腦連續在線。
- [PR #37](https://github.com/juliushsu/CoCalLab/pull/37)，分支 `codex/uat-lifecycle-preflight-20261109`。產品固定 **`fd7efcfc6450dbf10f54aa97b65fe48e431b277d`**；原生排程 probe 程式固定 `d7a95a512e746c3d047f894f2bb331659a07bbd5`；新 dry-run 固定提交見本檔後續版本紀錄與 PR。正式 UAT 參考基準 `7dccd5452152f2495d10ad1437d5d03215166065` 不變，沒有合併 main 或正式部署。
- **本輪實作**：scheduler-neutral pure decision dry-run，17/17 合成測試通過，實際 TAP／來源 hash 在 `evidence/uat-lifecycle-20261109/LIFECYCLE_DRY_RUN_RECEIPT.json`。涵蓋 T-48h／到期前後、備份／還原失敗、錯 ref／組織／lease／版本、缺物件／proof、後續寫入、漏跑、未來 heartbeat、重送／進行中與回覆遺失、未知／超額費用。不是真 DB／Storage／簽章驗證、原生並行或真服務驗收；不與既有排程10次或其他測試加總。
- **唯讀盤點**：GitHub 有成功的 public CI run 42543530695／452282f；候選 verify.yml 只有 PR／push-main，讀 main workflow 目錄回404、schedule event歷史0。PC Task Scheduler可用，既有10個合成tasks已停用；只有時點證據。Railway 無可用CLI、Dashboard待登入；Mac runtime UNVERIFIED。見 `SCHEDULER_INVENTORY_PUBLIC.json`，不把缺登入當不存在付費資源。
- **建議方案入口**：`UAT_LIFECYCLE_SCHEDULER_OPTIONS_20261109.md`：Railway小型cron主執行、GitHub Actions獨立watchdog＋原生失敗通知；有公開單價推算、逾時／漏跑／備份失敗處置、備份保留與停費、精確新ref及必要權限。這是待核實／核准提案；default-branch watchdog、備份存放／保留及任何新服務／token／通知都需具體批准，不搭便車修改main或既有服務。
- **新 Owner 邊界**：只唯讀及本機 dry-run。實際排程／憑證／通知配置與付費 UAT 暫不建立；不以之前的整體 UAT 範圍授權跳過本次生命週期方案批准。本輪 cloudCalls／新建資源／新建排程／通知均0，新ref／T0／expiry為null。過往10個Windows測試tasks早已停用，這次沒有新增或啟用。
- **資料保護**：自動審查拒絕把詳細帳戶／帳務／用量資訊推上GitHub；安全替代版只發布去敏進度與合成證據。詳情放Git／OneDrive以外、Owner＋SYSTEM ACL的本機報告，位置另交Owner；不在repo複製帳單、付款、key或企業資料。`authorization-status.json` 是公開去敏狀態，詳細live結論在Owner報告，不再用歷史BLOCKED_LOGIN覆蓋本次已完成的指定帳戶檢查。
- **保留成果**：固定ZIP仍沿先前核包191項／SHA256 `06d196296123eb07df6496179302e1bfba90a1335127ae459d38d0e94e590c74`，未重建或再次跑無關產品套件。Claude e4fd606來源結案沿用，N4-R1 UPDATE／其他並行未驗。既有專案須重算才能新報告，收據狀態是報告產生時；不改歷史證據。
- **仍未驗**：21個真服務案例維持 BLOCKED／NOT_RUN；provider排程、故障通知送達、真備份／還原／刪除、分散式互斥及真租戶隔離驗收均未由本dry-run關閉。
- **下一步**：Owner完成Railway既有付費帳戶登入後唯讀核實可用工作區、cron／備份資源、通知及增量費用，細節存Owner受限報告；據此補同一具體方案的精確目標／scope／退出方式，一次交Owner核准。未授權不建立任何計費資源、憑證或實際排程。不承諾session結束後無限背景運行。

下一條可執行命令（repo root，明示合成、無網路／憑證／排程副作用）：

```powershell
node deployment/uat/lifecycle/lifecycle-dry-run.mjs --scenario expired-missing-backup
```
