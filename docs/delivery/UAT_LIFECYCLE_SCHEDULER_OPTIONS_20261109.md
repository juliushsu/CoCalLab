# UAT 生命週期排程方案 A — 唯讀核對完成，待 Owner 核准

**本輪只唯讀盤點與 dry-run；付費 UAT 暫不建立。** 不新增實際排程、憑證、通知設定，不假定 PC／Mac 連續在線。產品固定 `fd7efcfc6450dbf10f54aa97b65fe48e431b277d`，發布 HOLD。帳戶／帳務／用量細節僅留 Owner 受限本機報告，不提交公開 Git。

## 既有能力與證據

| 位置 | 實際查核 | 判定 |
|---|---|---|
| GitHub Actions | repo metadata 為 public、default branch `main`；[現有 Verify source](https://github.com/juliushsu/CoCalLab/blob/452282f61a106206574723c084b3d69af7773326/.github/workflows/verify.yml) 只有 PR／push-main，ubuntu-latest；[run 42543530695](https://github.com/juliushsu/CoCalLab/actions/runs/42543530695) 在固定 452282f 完成 success。REST 讀 main 的 `.github/workflows` 回 404，schedule event 歷史筆數為 0 | 已有 CI 執行證據，**尚無已證實可接用的生命週期 schedule**；未讀或配置 secrets |
| Railway | Owner 已完成登入並唯讀核對可見工作區、Plans／Usage、既有服務的 Cron Schedule 與通知偏好；精確資源、費用及勾選狀態只存 Owner 受限回執 | **唯讀前置完成，不再等登入**。沒有把既有服務挪作本 UAT；未證明有可立即接用的專用生命週期執行器／備份位置；這是 Railway，不是 Runway |
| PC | Task Scheduler 可運作，先前 10 個測試任務已實際觸發並停用；目前服務狀態只是一個時點。Interactive/Limited 依賴登入及供電，當前電源設定也不是未來可用性承諾 | 不建議作唯一到期控制／提醒；未修改睡眠、登入、服務或 Windows 版本 |
| Mac | 本次沒有可用的已授權 Mac 主機管理連線，歷史移交檔不是目前 runtime 證據 | **UNVERIFIED**；不能宣稱已適合常駐，也不因此阻擋其他盤點 |

[GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) 只從 default branch 執行，可能延遲或被丟棄；原生失敗通知也不會自動證明「完全沒啟動」已被偵測。[Railway Cron](https://docs.railway.com/cron-jobs) 前次不退出會跳過下次，且不保證分鐘級準時。不能單靠任一平台宣稱到期停費保證。

## 一個建議方案：Railway 執行，GitHub Actions 獨立監看

此為**具體待核准提案**，不是已部署架構。指定的候選工作區精確 ID 及核對細節在 Owner-only `OWNER_LIFECYCLE_APPROVAL_PACKET_20261109.md`，不將帳戶、帳務或用量資料公開；以下新名稱都是提案，實際 IDs 仍為 null。

| 元件 | 最小提案與權限 |
|---|---|
| 主執行 | 提案獨立 project `CoCalLab-UAT-LIFECYCLE-01`、environment `uat-lifecycle`、service `uat-lifecycle-cron`，UTC `7,22,37,52 * * * *`；每 15 分鐘檢查 UTC lease、跑完退出並限時。既有其他產品的 service／volume 保持不動 |
| 備份 | 提案同一隔離 project 的 private bucket `uat-lifecycle-backups`；建立／寫入及保留／停費範圍待核准。client-side 加密 archive＋manifest，Owner 另保留解密 key。原件／proof／key 不進 public repo、Actions artifact 或 log |
| 獨立 watchdog | GitHub 標準 Ubuntu runner 每小時避開整點檢查主執行的 heartbeat／上次結果，只讀狀態與報警，**不持有 Supabase 刪除／DB／Storage 憑證，也不執行刪除**。需核對可用的最小 Railway／備份讀取權限，不假定 provider 支援真正 read-only token |
| 主失敗通知 | 提案沿用 [Railway 原生 email＋in-app](https://docs.railway.com/overview/production-readiness-checklist)；偏好核對結果在受限回執，不改其他產品的全域偏好。核准後須測專用 job 故障與實際收件；尚未寄測試信 |
| 漏跑通知 | watchdog UTC `41 * * * *`，只讀主執行 deployment 時間／狀態；超過 1 小時未更新、超時或失敗即令 workflow 失敗，使用 [GitHub Actions 失敗 email](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)。偏好已唯讀核對、送達仍 NOT_RUN；不假定 web 通知已啟用 |
| 依賴限制 | 現在 main 沒有可接用的 workflow。若採本方案，**須明確核准僅維運 watchdog 的 default-branch 變更**，不因此合併產品候選或批准正式部署；不在當前 PR 加入 schedule／dispatch 來偷偷啟用 |

依 [Supabase scoped PAT 文件](https://supabase.com/docs/guides/platform/personal-access-tokens)，刪除權限提案只選**實際新 UAT ref** 的 Project Settings Read-write；它也能修改該 UAT 設定，**不是 delete-only**。禁止 Legacy／All projects／組織全權 token。backup 所需 DB／Storage 資格同樣僅限新 UAT，不能把可寫資格說成只讀。

[Railway project token](https://docs.railway.com/integrations/api) 只限新的維運 project/environment，但可能具有 deployment 變更能力，不能把 watchdog 的程式只讀誤寫成憑證只讀；watchdog 不拿 Supabase、DB 或備份解密資格。實際 token scope 與 cleanup 能力要在核准後驗證，不能用 workspace/account 全權 token 默認替代。公用 repo 只執行經審閱固定 Ops SHA，不能讓任意 PR 程式拿 secret。

## 公開單價推算，不是帳戶報價

依 [Railway 公開費率](https://docs.railway.com/pricing/plans)，以每次檢查最多 1 分鐘、最多 1 GB RAM／1 vCPU、14 天 1,344 次，以及備份／驗證額外合計 90 分鐘推算：`(1344+90) × (0.000231+0.000463) ≈ US$1.00`；假設 service egress 2 GB 約 US$0.10。[私有 bucket](https://docs.railway.com/storage-buckets/billing) 另依 GB-month 向上進位計費，例 1 GB-month 約 US$0.015。**Railway 示例約 US$1.12，建議提案額度最多 US$2，包含在總 US$20 內**；超出上述時間／流量／容量或需要升級訂閱就重新估價，未核實的剩餘 credits 一律不假定可用。

[GitHub public repo 的 standard hosted runner](https://docs.github.com/en/billing/concepts/product-billing/github-actions) 為免費 compute，提案不使用 larger runner、付費通知、artifact 或 cache 保存真備份；實際帳戶限制仍須核對。既定 Supabase Micro 14 天 compute 公開推算約 US$4.52，合併上述示例約 **US$5.64、未含稅及未確立的其他用量**。這是有前提的估算，**不是總額保證、不是新增 US$20 額度，也不是零增量費用承諾**。

T0 提案取**第一個本次新增計費資源**的建立時間，含輔助 service／bucket，不能部署完成才起算；總保留仍最多 14 天。T0+12 天準備最終備份，建議 Owner／指定人於 T0+13 天前在受限最終位置接收 archive、manifest 及解密 key，驗 hash／可解密，T0+14 天停測及退出。這不要求 PC／Mac 連續在線，但需要核准接收責任與一次交接窗。

[Railway bucket](https://docs.railway.com/storage-buckets) 不支援原生 SSE、versioning／object lock 或 bucket lifecycle；不能宣稱 WORM 或自動 TTL。新 service／bucket 的退出須另綁實際精確 ID，且備份已交接；不將「只刪 UAT ref」授權泛化成任意其他資源刪除。未交接不得刪唯一備份，若需延長保管或費用必須在期限前交 Owner 明確裁定，不能無限或靜默續期。

## 精確目標、失敗與漏跑處理

1. 先完成固定來源／workflow 差異與 Owner 核准，才配置隔離輔助資源、secret 與合成 probe，記首個計費資源 T0；排程、通知、scope 及連線前置通過後，才建立 Supabase UAT。新 ref／org／名稱、候選 SHA、T0、T0+12 天、T0+14 天寫入受限 lease，未綁定不能執行。刪除前重新 GET **同一 ref**，不以名稱查找後刪除。
2. T0+12 天停止會改變 checkpoint 的測試寫入，備份 DB、private ledgers/proofs、Storage 原件與必要設定；manifest/hash 與還原讀回全部通過才能產生有效驗證紀錄。任何後續寫入使該紀錄失效，必須重做對應備份。
3. 真還原先列精確 target。建議優先評估**專用 job 內的臨時隔離 PostgreSQL／檔案目錄**，不碰 PC 5432 或既有服務；版本、extensions、Auth／Storage catalog、proof／物件 ID、原件 bytes 與設定可還原性均須驗證。這不是完整 managed Supabase Auth／Storage E2E。新 UAT 的真備份只能在它建立後實測，須於部署／初始化後立即做 baseline 還原，不等 T0+12 天才發現缺口；失敗停下報 Owner，不能拿本 dry-run 補上。
4. 備份或還原失敗，主執行應 nonzero、立即通知、限次重試並記原 operation ID；沒有有效驗證紀錄就**不刪 UAT**。watchdog 同時檢查 failure 狀態，不只看新鮮 heartbeat。
5. 以 `now >= dueAt` 判斷到期，漏跑後可 catch up；前次仍進行時先核對／恢復原操作，不另建 request。真正的持久 ledger／互斥、憑證及通知 adapter 尚未實作驗收；模型測試不等於分散式鎖通過。
6. 過期但未驗證備份：停止測試，補救備份並立即升級 Owner，仍不刪。已驗證且未過期：不提前刪。已驗證且過期：只提交精確新 ref；回覆遺失先查同 ref 的不存在狀態與後續帳務，不重建或改刪其他同名專案。
7. GitHub 與 Railway 都可能不可用；cloud watchdog／email 降低單一失效風險，不能保證精準 deadline 或 US$20 硬 cap。備份／告警／漏跑處置失敗須在到期前升級值班 Owner，列目前費用風險與剩餘時間，不靜默續期。

Railway [公開網路事件](https://status.railway.com/incident/QBCLHG1V) 在本次查核仍列 Identified／Partial Outage；Dashboard 可開不等於新 runner 到 Supabase／備份位置、GitHub 到 Railway 的路徑已驗。這些 probe 尚未獲配置授權，維持 NOT_RUN，不因該公告擴大修改既有網路或關閉 TLS。

新 service 不依賴已棄用的 `railway.toml/json` Config as Code；[官方限制](https://docs.railway.com/config-as-code) 表示新服務不能 opt in。核准後採現行 Dashboard／API 或經核對的 IaC 介面，這次沒有部署配置或執行 provider mutations。

## 已實作 dry-run、未驗與批准入口

```powershell
node --test deployment/uat/lifecycle/lifecycle-dry-run.test.mjs
node deployment/uat/lifecycle/lifecycle-dry-run.mjs --scenario expired-missing-backup
```

[實際 TAP 與來源 hash 回執](evidence/uat-lifecycle-20261109/LIFECYCLE_DRY_RUN_RECEIPT.json)：本輪 **17/17** 合成決策測試通過：T-48h、到期前後、錯 ref／org、錯 lease／版本、缺 proof／物件、備份／還原失敗、checkpoint 後寫入、漏跑補救、未來 heartbeat、重送／進行中及回覆遺失、未知／超額費用。`cloudCalls=0`、不建立排程／配置憑證／寄通知；這是對輸入 claim 的決策測試，**不是實際備份簽章、資料完整性、原生並行、兩個雲端排程或通知送達驗收**。

Railway 與 GitHub 通知偏好已完成能取得的唯讀核對，細節保留 Owner-only 回執；Mac runtime 未驗，不作唯一常駐依據。本次沒有重跑既有17項測試或產品套件。待核准的具體項目為：新隔離 Railway 資源與最多 US$2 分配、上述實際憑證 scope／合成故障通知測試、Owner／指定人的備份接收與精確輔助資源退出。main 維運 workflow 另交固定差異核准，沒有因此獲准合併產品或正式部署。未核准前不建付費 UAT，不再詢問相同登入、UAT 名稱／組織／US$20／14 天或已選到期處理。
