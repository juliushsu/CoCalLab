# UAT 生命週期排程方案 — 待實際資源核對與 Owner 核准

**本輪只唯讀盤點與 dry-run；付費 UAT 暫不建立。** 不新增實際排程、憑證、通知設定，不假定 PC／Mac 連續在線。產品固定 `fd7efcfc6450dbf10f54aa97b65fe48e431b277d`，發布 HOLD。帳戶／帳務／用量細節僅留 Owner 受限本機報告，不提交公開 Git。

## 既有能力與證據

| 位置 | 實際查核 | 判定 |
|---|---|---|
| GitHub Actions | repo metadata 為 public、default branch `main`；[現有 Verify source](https://github.com/juliushsu/CoCalLab/blob/452282f61a106206574723c084b3d69af7773326/.github/workflows/verify.yml) 只有 PR／push-main，ubuntu-latest；[run 42543530695](https://github.com/juliushsu/CoCalLab/actions/runs/42543530695) 在固定 452282f 完成 success。REST 讀 main 的 `.github/workflows` 回 404，schedule event 歷史筆數為 0 | 已有 CI 執行證據，**尚無已證實可接用的生命週期 schedule**；未讀或配置 secrets |
| Railway | 已開啟官方 Dashboard，仍在登入頁；不能核實既有工作區、服務、cron、備份位置或通知設定，也不能把官方價目表當作本帳戶實際費用 | **BLOCKED_LOGIN**；已請 Owner 自行登入，不另建帳號、服務或猜選 workspace；這是 Railway，不是 Runway |
| PC | Task Scheduler 可運作，先前 10 個測試任務已實際觸發並停用；目前服務狀態只是一個時點。Interactive/Limited 依賴登入及供電，當前電源設定也不是未來可用性承諾 | 不建議作唯一到期控制／提醒；未修改睡眠、登入、服務或 Windows 版本 |
| Mac | 本次沒有可用的已授權 Mac 主機管理連線，歷史移交檔不是目前 runtime 證據 | **UNVERIFIED**；不能宣稱已適合常駐，也不因此阻擋其他盤點 |

[GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) 只從 default branch 執行，可能延遲或被丟棄；原生失敗通知也不會自動證明「完全沒啟動」已被偵測。[Railway Cron](https://docs.railway.com/cron-jobs) 前次不退出會跳過下次，且不保證分鐘級準時。不能單靠任一平台宣稱到期停費保證。

## 一個建議方案：Railway 執行，GitHub Actions 獨立監看

此為**具體待核准提案**，不是已部署架構；Railway 實際帳戶核對後才能決定既有資源是否適用。

| 元件 | 最小提案與權限 |
|---|---|
| 主執行 | 既有已付費 Railway 工作區內，一個獨立 UAT lifecycle cron service，每 15 分鐘檢查 UTC lease；跑完退出，外層 timeout 限制。不得重用或改寫其他產品的 production service |
| 備份 | 優先核對是否已有可用的私有備份位置。若無，提案一個專用 private S3-compatible Railway bucket；**建立／寫入及保留／停費範圍均需 Owner 核准**。加密 archive＋manifest，解密金鑰另存 Owner 受限位置，原件／proof／憑證不進 public repo、Actions artifact 或 log |
| 獨立 watchdog | GitHub 標準 Ubuntu runner 每小時避開整點檢查主執行的 heartbeat／上次結果，只讀狀態與報警，**不持有 Supabase 刪除／DB／Storage 憑證，也不執行刪除**。需核對可用的最小 Railway／備份讀取權限，不假定 provider 支援真正 read-only token |
| 主失敗通知 | 提案 [Railway 原生 email＋in-app](https://docs.railway.com/overview/production-readiness-checklist) 的失敗事件，作用於專用 service；設定及實際故障通知送達測試均待批准，沒有寄出任何測試信 |
| 漏跑通知 | watchdog 發現 heartbeat 超過 1 小時未更新即讓 workflow 明確失敗，由 [GitHub Actions email＋web](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs) 通知 Owner 指定接收者；設定後必須實測收件。實際通知偏好／接收者未核實，不能宣稱已可用 |
| 依賴限制 | 現在 main 沒有可接用的 workflow。若採本方案，**須明確核准僅維運 watchdog 的 default-branch 變更**，不因此合併產品候選或批准正式部署；不在當前 PR 加入 schedule／dispatch 來偷偷啟用 |

Railway 需要的 provider token 作用域、是否會涵蓋其他 project，必須先核實；不以工作區／Supabase 全權 token 默認替代最小範圍。到期實際刪除仍只有主執行器可操作唯一新 UAT ref；watchdog 只監看。公用 repo 必須使用受控固定程式，不能讓 PR 任意程式取得這些憑證。

## 公開單價推算，不是帳戶報價

依 [Railway 公開費率](https://docs.railway.com/pricing/plans)，以每次檢查最多 1 分鐘、最多 1 GB RAM／1 vCPU、14 天 1,344 次，以及備份／驗證額外合計 90 分鐘推算：`(1344+90) × (0.000231+0.000463) ≈ US$1.00`；假設 service egress 2 GB 約 US$0.10。[私有 bucket](https://docs.railway.com/storage-buckets/billing) 另依 GB-month 向上進位計費，例 1 GB-month 約 US$0.015。**Railway 示例約 US$1.12，建議提案額度最多 US$2，包含在總 US$20 內**；超出上述時間／流量／容量或需要升級訂閱就重新估價，未核實的剩餘 credits 一律不假定可用。

[GitHub public repo 的 standard hosted runner](https://docs.github.com/en/billing/concepts/product-billing/github-actions) 為免費 compute，提案不使用 larger runner、付費通知、artifact 或 cache 保存真備份；實際帳戶限制仍須核對。既定 Supabase Micro 14 天 compute 公開推算約 US$4.52，合併上述示例約 **US$5.64、未含稅及未確立的其他用量**。這是有前提的估算，**不是總額保證、不是新增 US$20 額度，也不是零增量費用承諾**。

Backup 存放不能無期限計費。提案：T0+12 天驗證後交 Owner 接收受限備份，T0+14 天停止 UAT 及專用執行。**備份最終存放位置／保留期限，以及新 Railway service／bucket 的停費與移除，須在建立前單列精確目標核准**；未完成交接不得刪掉唯一備份。若只有付費位置能保留備份，先列有限期限與費用供 Owner 裁定，不靜默延長或刪除既有資源。

## 精確目標、失敗與漏跑處理

1. 建立後把實際新 project ref／org／名稱、候選 SHA、T0、T0+12 天、T0+14 天寫入受限 lease，保護既有專案。刪除前重新 GET **同一 ref** 比對，不以名稱查找後刪除。未綁定 lease 不允許執行。
2. T0+12 天停止會改變 checkpoint 的測試寫入，備份 DB、private ledgers/proofs、Storage 原件與必要設定；manifest/hash 與還原讀回全部通過才能產生有效驗證紀錄。任何後續寫入使該紀錄失效，必須重做對應備份。
3. 真還原先列精確 target。建議優先評估**專用 job 內的臨時隔離 PostgreSQL／檔案目錄**，不碰 PC 5432 或既有服務；版本、extensions、Auth／Storage catalog、proof／物件 ID、原件 bytes 與設定可還原性均須驗證。這不是完整 managed Supabase Auth／Storage E2E；若缺少必要能力，驗證不得通過，不能拿本 dry-run 補上。
4. 備份或還原失敗，主執行應 nonzero、立即通知、限次重試並記原 operation ID；沒有有效驗證紀錄就**不刪 UAT**。watchdog 同時檢查 failure 狀態，不只看新鮮 heartbeat。
5. 以 `now >= dueAt` 判斷到期，漏跑後可 catch up；前次仍進行時先核對／恢復原操作，不另建 request。真正的持久 ledger／互斥、憑證及通知 adapter 尚未實作驗收；模型測試不等於分散式鎖通過。
6. 過期但未驗證備份：停止測試，補救備份並立即升級 Owner，仍不刪。已驗證且未過期：不提前刪。已驗證且過期：只提交精確新 ref；回覆遺失先查同 ref 的不存在狀態與後續帳務，不重建或改刪其他同名專案。
7. GitHub 與 Railway 都可能不可用；cloud watchdog／email 降低單一失效風險，不能保證精準 deadline 或 US$20 硬 cap。備份／告警／漏跑處置失敗須在到期前升級值班 Owner，列目前費用風險與剩餘時間，不靜默續期。

## 已實作 dry-run、未驗與批准入口

```powershell
node --test deployment/uat/lifecycle/lifecycle-dry-run.test.mjs
node deployment/uat/lifecycle/lifecycle-dry-run.mjs --scenario expired-missing-backup
```

[實際 TAP 與來源 hash 回執](evidence/uat-lifecycle-20261109/LIFECYCLE_DRY_RUN_RECEIPT.json)：本輪 **17/17** 合成決策測試通過：T-48h、到期前後、錯 ref／org、錯 lease／版本、缺 proof／物件、備份／還原失敗、checkpoint 後寫入、漏跑補救、未來 heartbeat、重送／進行中及回覆遺失、未知／超額費用。`cloudCalls=0`、不建立排程／配置憑證／寄通知；這是對輸入 claim 的決策測試，**不是實際備份簽章、資料完整性、原生並行、兩個雲端排程或通知送達驗收**。

Railway 實際工作區／資源盤點待登入；Mac runtime 未驗。完成這些能取得的資訊後，將同一建議的確切資源、權限、通知對象、備份保留與停費清單交 Owner 一次核准。需要決策的是這份具體生命週期方案，不再詢問既有 UAT 名稱／組織／US$20／14 天或已選到期處理。
