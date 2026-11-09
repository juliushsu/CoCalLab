> 同日後續：指定帳戶的 Owner 協助唯讀前置已完成，詳細證據僅存本機受限 Owner 報告；不再等待相同登入。最新 Owner 要求先盤點既有排程選項、提交具體方案並測 dry-run；實際排程／憑證／通知配置與付費 UAT 待方案核准。以下登入前的描述保留當時範圍，現行狀態以 authorization-status.json 與 NEXT_ACTION.md 為準。

# UAT 建立條件與生命週期執行方案 — 2026-11-09

專案目標：本輪本機前置已完成；WAITING_LIFECYCLE_PLAN。發布 HOLD。Owner 已補齊指定組織與到期選項，不再等待同一範圍授權；**尚未建立付費 UAT**。

產品固定 `fd7efcfc6450dbf10f54aa97b65fe48e431b277d`，此批只增加生命週期測試與授權紀錄。固定包、既有功能、來源結案與 main 均不變。現行機讀狀態見 [authorization-status.json](../../deployment/uat/authorization-status.json)。

## 已確認的 Owner 決定

| 項目 | 決定／實際狀態 |
|---|---|
| 唯一候選組織 | `empvseawywarugdnyhzl`；歷史 60677af 盤點有相同 ID，但當時僅 NAME MATCH ONLY。公司指定付費組織與實名仍須登入核實 |
| 專案 | `CoCalLab-UAT-CLOUD-01`，Micro／東京 `ap-northeast-1`；不另建組織 |
| 預算／期限 | **累計新增 US$20**，建立時間 T0 起 14 天；不是每月額度或平台硬上限，沒有自動續期 |
| 到期處理 | **備份驗證後刪除該 UAT**；只限新 ref。備份不合格時不得假報完成或直接刪除 |
| 執行範圍 | 新專案內 46 schema migration 提案、13 允許 functions、private buckets、專用測試帳號與合成資料；3 歷史 DML／3 Mock 或 provider functions 保持 HOLD |
| 保護範圍 | 既有 `wynqnvidepzzcwutexvn`、其他專案、正式 DNS、Readdy、main 不變；前端 localhost |
| 實際新 ref／T0／expiry | 均為 null，未開啟本次計費或保留時鐘；不能用文件日期代填 |
| 處置責任 | Owner 負責預算／例外裁定；實際值班執行人、可送達的聯絡方式及常駐執行器待確認，不擅自將責任指派給未確認的人 |

## 現在阻礙建立的具體條件

| 狀態 | 條件與下一步 |
|---|---|
| BLOCKED_LOGIN | 指定組織 Dashboard 導向登入頁，已顯示並交 Owner 操作。官方 CLI 唯讀 `orgs list --output json` 也回報沒有 access token，未擷取瀏覽器 token。登入後只核公司實名、付費資格、Micro／東京與估價，不讀業務資料或金鑰 |
| UNVERIFIED_COST | 實際 console 增量估價、disk／Storage／egress／稅及備份費尚未核實；未知或預計超出累計 20 即停止受影響操作 |
| MISSING_LIVE_EXECUTOR | 以下真實備份／還原／精確目標刪除 adapter 與受限憑證尚未配置；已測試的程式刻意不接受真雲端模式，不能拿它當 production runner |
| MISSING_AVAILABILITY_AND_ALERT | Windows 測試採 Interactive/Limited，依賴 Owner 登入及 PC 在線；未驗斷電／登出後執行。`ALERT_REQUIRED.json` 只是本機標記，尚無已測試的人員通知送達。建立前要有可用執行主機、值班人及告警送達證據；新增付費排程服務另需授權 |
| UNBOUND_RESTORE_TARGET | 執行任何復原前先列出精確來源、目標、版本、可用空間與覆寫範圍。沒有默認第二個付費專案；不把既有舊版 PostgreSQL 證據或合成檔案複製稱作現版完整復原 |

前兩項依賴登入；其餘是明確技術前置，**不是要求再次核准既有預算／刪除範圍**。未通過前不啟動付費專案。登入可繼續唯讀核對；不能為了讓排程運作而修改 main、建立其他雲端服務或降級共用組織。

## 實際建立且觸發的排程測試

主機 `LENSBANKTCH-EDI`，以現有 Owner Windows 帳戶、Limited 權限執行；沒有新增帳戶、保存 Windows 密碼或修改安全設定。測試 run `20261109-512e414f`，Task Scheduler 路徑 `\CoCalLab-UAT-Lifecycle\20261109-512e414f\`。

| 合成情境 | backup／expire exit | 實際結果 |
|---|---|---|
| 正常 | 0／0 | 4 個明示 SYNTHETIC 檔案產生 manifest/hash、複製後讀回一致，僅本機資源標記轉為不存在一次 |
| 備份失敗 | 23／23 | 拒絕到期標記，保留原資源，產生本機告警標記 |
| 還原讀回失敗 | 23／23 | 拒絕到期標記，保留原資源 |
| 驗證後備份遭改動 | 0／23 | 到期重新核對 bytes 時拒絕，保留原資源 |
| 錯目標 | 23／23 | backup／expire 均拒絕，未變更其他資源 |

10 個已註冊任務均經一次性時間 trigger 自動執行，3 次 exit 0、7 次預期的 guard 拒絕；這是 **5 個情境，不是 10 個獨立完整驗收案例**。另外經 Task Scheduler 手動重送 happy-expire，事件為 `ALREADY_MARKED_ABSENT`、狀態轉換仍為 1。10 個測試任務已停用保留，沒有真實到期刪除排程被啟用。

原始查詢保留了 Task Scheduler `LastRunTime` 與 engine audit 的不同時間值；例如 backup 的 API 回報 00:44:44Z，audit START 為 00:44:22.243Z。未釐清差異前不推斷精準延遲，也不宣稱準時／常駐 SLA。自動執行證據見 [原始自觸發檢查](evidence/uat-lifecycle-20261109/automatic-trigger-inspection.json)、[最終停用檢查](evidence/uat-lifecycle-20261109/final-disabled-inspection.json) 及 [測試回執](evidence/uat-lifecycle-20261109/SCHEDULER_TEST_RECEIPT.json)。

本機原始紀錄位於 repo 同層 `../tooling/uat-lifecycle-20261109/20261109-512e414f/`；公開版將帳戶與絕對路徑替換為 placeholder。這些 JSON／PDF 都是測試文字，**沒有執行 pg_dump、真 Storage 備份／還原或雲端刪除**。實際操作說明見 [lifecycle README](../../deployment/uat/lifecycle/README.md)。

## 付費前估價與停止計費

2026-11-09 [官方 compute 表](https://supabase.com/docs/guides/platform/manage-your-usage/compute) 的 Micro 為 US$0.01344/h，14 天 336 小時的 compute 單項約 **US$4.52**。不假定組織尚有 credits，不將這個數字當總價；所有增量都計入 US$20，必須另記 console 計價／用量與預測。

[官方刪除說明](https://supabase.com/docs/guides/platform/delete-project) 表明只有 Free project 可暫停；付費 Micro 不能直接 pause。刪除停止新增用量，過往累積用量仍可能後續入帳。停止測試不會自動停止 compute；不以轉移其他專案、降級組織或未核准的帳務變更替代這次刪除方案。

## 真實生命週期的執行契約（尚未部署）

1. **建立前**：完成上列 gates，記錄固定候選、CLI／工具 hash、46 migration 與 13 function allowlist；證明通知可送達。準備只處理新 UAT 的 runner 與受限憑證位置，不把內容放 Git／聊天／命令列。若需新的付費 runner 或超出既有權限，先交具體方案。
2. **建立回執**：立即讀回實際 org ID／實名、新 ref、Micro／東京、建立 UTC T0、T0+12 天 backup_due、T0+14 天 expiry、計費起點與執行負責人。精確 ref 必須不同於保護名單；建立失敗或回覆遺失先查回，不按名稱盲目重建。部署前交出回執。
3. **實際排程**：新 ref 綁定後，註冊 backup／expiry 與失敗重試及通知；保留 scheduler ID、UTC trigger、程式 hash、參數範圍和狀態。用獨立合成 probe 測該執行器，不提前執行真刪除；記錄通知收件結果與逾期 catch-up。不能把本批已停用的測試 tasks 當成已綁定真專案。
4. **T0+12 天**：停止會改變備份一致性的測試寫入並取 checkpoint。受限且不依賴將刪除專案的備份要包含 DB 必要 schema／roles／Auth、private ledgers/proofs、Storage 物件原 bytes 與識別／metadata、部署與 Auth/CORS/JWT／bucket 設定。區分含秘密的還原設定與去敏 manifest；真備份不要放公開 Git、聊天、OneDrive 同步 repo 或臨時下載區。
5. **驗證復原**：先列精確隔離還原目標，再執行。逐檔 SHA256、列數／主外鍵／NOT VALID 約束、receipt/proof／物件識別關係與代表性報告核對；原 ID 無法保留時要判定既有 proof 是否仍成立，**不能自動補簽**。單有檔案 hash 或供應商「備份成功」不等於可還原。記錄還原 target、結果與可驗 manifest，備份與 proof 均妥善受限保存。
6. **T0+14 天**：停止測試。重新讀回實際新 ref／org／名稱，驗備份完整且復原驗證有效，確認目標精確符合後只刪該新 UAT。此處仍須使用授權執行方式；若透過瀏覽器永久刪除，遵守該工具當次確認要求。失敗／結果不明先查回同 ref，不擴大範圍或刪其他同名專案。
7. **刪除後**：查該 ref 已移除、部署與資源消失，記 provider 回執及後續帳務。應付的歷史用量不是「仍有資源」；不能宣稱帳務為零。提交去敏回執，保留備份位置與責任人，不自動刪備份或續期。
8. **異常**：備份／復原／刪除失敗、執行器失聯或預估超支立即通知 Owner 並標 `WAITING_OWNER`，列剩餘時間、已累積費用、精確目標與可選處置；不能靜默續費，亦不能跳過驗證直接刪除。現有平台不是 US$20 硬性 cap，須如實揭露不能保證斷電時自動停費。

## 本輪實測／未驗與下一步

本輪已重新核包 191 項 hash；ZIP SHA256 仍 `06d196296123eb07df6496179302e1bfba90a1335127ae459d38d0e94e590c74`。新測試只驗 lifecycle harness，沒有重跑來源結案或將合成結果填入 21 個真服務待驗案例。

真組織／估價、真 UAT 建立／migration／functions／JWT／Storage／瀏覽器／完整復原／刪除均為 BLOCKED 或 NOT_RUN。登入後先完成唯讀核對；已核准範圍不重問。下一條無秘密的本機命令：

```powershell
node deployment/uat/prepare-fixed-package.mjs verify
```
