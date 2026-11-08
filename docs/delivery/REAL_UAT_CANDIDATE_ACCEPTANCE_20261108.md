# 現版隔離 UAT 驗收入口 — 2026-11-08

> 最新候選為 PR35／產品 `040509777bb1cb60589a01ce7ec176a4ec54cee7`：[F1／F2／N4-R1交付](REPLACEMENT_PROVENANCE_FIX_DELIVERY_20261108.md)。依CTO，N1／N2／N5來源關閉、N4僅具名排程；新差異等待定向複審，發布HOLD。49來源migration＝46schema＋3歷史fixture HOLD；本機040具名原生並行已有證據，真服務及現版完整復原未驗。下文保留原ddcc／ed6時點，不將當時的OPEN／NOT_RUN或PASS移用為最新裁定；前往NEXT_ACTION接續。

> 後續證據（2026-11-08）：[da5原生SQL鎖序修復](NATIVE_POSTGRES_CONCURRENCY_20261108.md)與[本機SQL備份/復原](NATIVE_SQL_RECOVERY_DELIVERY_20261108.md)已交付；原生PG能力已新增。下文保留ddcc/ed6當時狀態，雲端/真服務門檻不變。

**RELEASE HOLD；本文件是待授權的執行清單，不是部署或驗收通過。** 正式 UAT 基準仍為 `7dccd5452152f2495d10ad1437d5d03215166065`。本輪只補本機合成選檔產物、工具測試與現版對照，不改應用、SQL、權限、選單或既有功能。

## 固定版本與前置狀態

| 對象 | 固定版本／狀態 |
|---|---|
| 本輪 fixture 工具 | `3bf945e2fef243472f9800de5708197c79fa3150`；獨立代理7/7與backend42重疊，未修改應用 |
| PR30 N1/N2 | 程式 `33d3613487f42a7e9c5888ae312441e730d3d87e`；P2-4/N1 尚待 Claude／CTO，不能自行關閉 |
| PR31 N3 整合應用／SQL | `ed6ca9bbfbc5581cdcacf2969340575217fcb8c4` |
| PR31 測試修正／文件 | `d761e46e26e2625551781da2120641e8e18c2d1c`／`a04a562ba869a2d079c3bcec1f9d45643f2b8055`；應用樹與 ed6 相同 |
| 部署設定 | [ed6 候選模板](../../deployment/uat/candidates/ed6ca9bbfbc5/README.md)：CLI 2.122.1、Deno 2.9.8、16 functions 的 gateway JWT 開啟、三項 Mock/provider 停用提案；target ref=null，沒有建立環境 |
| Migration | 46 份來源 manifest＝43 schema/governance＋3 歷史 fixture DML HOLD。最後依序 070001→070002→070003→070004→070005；不是 live applied 清單。新環境排除歷史 fixture 的提案不得用於既有專案 migration history repair |
| 原生本機證據 | ed6 的 16 check／16 靜態 bundle 已有固定證據；不是 managed Edge／ESZIP 實跑，本輪不重跑無關檢查 |
| Owner 已選路徑 | 獨立 Micro UAT；預算／14 天期限已有受限授權回執，不重問選項。最新 CTO 尚未授權雲端執行；費用／保留時鐘尚未啟動，不建立資源 |
| 本機真 PG | [唯讀能力回執](evidence/uat-acceptance-preparation-20261108/local-pg-capability.json)：PATH 無 psql/postgres/pg_ctl，只確認舊 postgres.exe 9.5.4 檔案 metadata。未啟動或連線；模板 PG17 不代表主機或目標版本。保留 5432，不重試 Docker／WSL |

[Claude 單一固定入口](https://github.com/juliushsu/CoCalLab/blob/a04a562ba869a2d079c3bcec1f9d45643f2b8055/docs/delivery/CLAUDE_N1_N3_REVIEW_QUEUE_20261107.md) 分開審 33d N1/N2 與 ed6 N3 交集。舊 ba2 部署與人工手冊保留為歷史；使用本頁補足現版及 N1/N3，不能把歷史 UNKNOWN/PASS 套到新版本。

## 現在可操作的本機入口

```powershell
node deployment/uat/prepare-manual-fixtures.mjs --candidate
node --test backend/tests/manual-uat-fixtures.test.js backend/tests/file-verification.test.js
```

第一條只寫 repo 外的同 workspace `../tooling/manual-fixtures-20261108/`。7 個全合成檔：可讀 PDF／PNG／JPEG，空 PDF、文字冒充 PDF、PNG 冒充 PDF、10MiB+1 的超限 PDF。manifest 列實際 bytes／SHA256／預期；圖片標示 SYNTHETIC UAT ONLY、100 kWh、2026/01，沒有公司資料。圖片是隨 repo 交付的固定 bytes，執行工具不需 System.Drawing 或外部供應商。

預先核對全部既存檔與 manifest，差異時不覆寫／不先加其他檔；寫入採 exclusive create，可重跑續備。不是跨檔原子交易；寫到一半中斷可保留已相同的檔再重跑。預設不帶參數仍用原 20261107 目錄／原三檔／相同 manifest。不接受自訂 CLI 輸出路徑。

圖片實際解碼 900×360 並目視可讀，verifier 從 bytes 計算 hash；這不是文件內容真實性或 OCR 驗證。負例的 MIME／signature 測試使用明確宣告 PDF；真瀏覽器如何偵測 MIME 另驗。每個負例用沒有同 hash 收件的專用測試專案，避免已存在正例的去重回覆遮蔽該檢查。

本機既有合成 UI：<http://127.0.0.1:4215/login>，API 4214；測試帳號與啟動方式見 [N3 交付](ACTIVITY_REPLACEMENT_N3_DELIVERY_20261107.md)。預覽重啟會有新 ID，舊截圖只證原次操作；不得拿本機 synthetic login 當 Supabase 真帳號。預覽程序停止時依該文件重啟，沒有無限背景執行承諾。

## 環境建立前的單次具體授權包

WAITING_CLAUDE／WAITING_CTO：先收 N1/N3 定向結果與剩餘來源裁定。WAITING_OWNER_EXECUTION_SCOPE：其後才提交精確組織、region、Micro 規格、實際 target ref 的建立方式、前端 origin、bucket、function 啟用清單、43 migration 提案與 fixture 初始化、專用帳號／撤權／上傳、備份復原目標及已記錄預算／14天起算與通知方式；Owner 明確核准後才執行。既有 main／業務資料不納入操作。

`documents`、`staging-receipts`、`staging-attachments` 若不存在，來源 migration 可能建立 bucket，須列入資源變更；不能只核准 schema 便默認 bucket 建立。不得為 401 關 JWT 或放寬 CORS。實際 PG／managed runtime／計費與可用備份能力在目標核准後查證，舊價格不作新報價。

## 四組真服務驗收（目前全部 NOT_RUN）

沿用 [原人工步驟](MANUAL_REAL_SERVICE_ACCEPTANCE_20261107.md) 的選檔／落盤與角色表，加上以下現版路徑。所有帳號／文件為合成、A／B／shared／viewer 由已核准 UAT 專用帳號建立，不匯入正式資料。shared 在兩單位的角色分開記錄，不能以同帳號代替權限檢查。

| 組別 | 操作與必要結果 | 狀態／範圍 |
|---|---|---|
| 瀏覽器／登出 | 原生選 PDF/PNG/JPEG、負例拒絕；HTML/JSON 下載落盤並重新讀取 hash、單位及保存快照；登出重載、storage 不可用拒登入提示、延遲回應後同帳號重登入、切單位／舊分頁；舊回應不能套用新 scope；取消匯出顯示原因且可重試 | NOT_RUN；目前僅合成 SDK／瀏覽器來源證據，React 前景自動觸發 N5 仍未證 |
| JWT／RPC | invalid/expired JWT、viewer/readonly、A→B IDs、撤權後 lookup/replay、舊 handler/RPC 拒絕；合法流程成功。N1 整份文件 MANUAL 歷史、REST 側枝 INSERT／改綁拒絕、latest/pending 與 witness；同確認原 ID 重送查回原結果，不增加活動／計算／audit。N3 同 ID 同意圖重送、改意圖／舊前版衝突與回覆遺失恢復 | NOT_RUN；真 getUser/gateway/PostgREST/SQL 權限鏈不能以 fixture 模擬取代 |
| Storage | A 合法收件／服務端原件 hash、B 直接路徑讀寫刪除與 signed preview 拒絕；MIME/size 不符與偽 hash 拒絕，偽 hash 不占可信唯一性；檔案成功／收件失敗用原 documentId 補登，不重傳 bytes；放棄本機參考不刪伺服器檔案；引用中與刪除部分失敗可恢復 | NOT_RUN；未建立 bucket、未真上傳／刪除。資料庫 metadata 一致不等於內容真實 |
| Migration／復原 | 記 applied 與 source 差異、NOT VALID catalog 及個別資料驗證、完整 DB 與 Storage 備份、獨立目標升級／還原與逐項核對；N1/N3／可信來源／有效末端與舊報告皆可查回 | NOT_RUN；不能以成功套用或本機 SQL 序列測試視為完成 |

N3 完整正例：受驗原件→人工轉錄／確認100kWh→重算／保存 v1→理由更正120kWh→未重算新報告拒絕→重算／保存 v2只採120→明確排除（仍保留120用量）→重算／保存v3列excluded。記每版 IDs、實際係數與 kgCO2e／tCO2e；真 UAT 不硬寫本機合成係數0.5。原活動／原計算／v1保存來源完整 JSON 比對不變，v2不得同時計入100+120。交易失敗 rollback、撤權、跨租戶、來源改綁、偽造計算與普通 REST 寫 lineage 另測拒絕後列數不增。

## 備份、復原與並行的證據邊界

- DB 備份涵蓋 public 業務／收件／草稿／活動／計算／報告、現有 private hash/operation/proof ledgers、004 的 `cocal_manual_private.confirmation_requests` 及005的 `cocal_activity_private.replacements`，連同 grants/RLS/functions/constraints 與完整 schema。不能只匯出 public 表。
- Storage 另保留 bytes、bucket/path、原 object ID／generation、metadata 及 hash 對照。DB dump不包含檔案。restore 若物件識別變化導致原可信證明不符，記 BLOCKED 並由 CTO 決定相容方案；不得自動補簽／把重新上傳當原件。
- 只在 Owner 指定的專用 UAT／還原目標執行 backup/reset/restore；先給出每項確切 target、命令與預期影響再核准。保留歷史報告為未驗證版本，不重封存或覆寫掩飾差異。
- 既有專案須重新計算才能產生新版報告；進行中舊重算可能失敗。不自動重算或改寫歷史。新confirm與004 witness成套部署。
- N4 兩個獨立 PG 連線仍 NOT_RUN。核准環境後須用兩個不同 `pg_backend_pid()`，實測同源 confirm/replacement/recalc/報告/刪除的交易交錯、鎖等待、40P01或其他實際錯誤、rollback與原ID retry，記完整時間線及最終有效集合。不能以同一連線、序列測試或 Promise.all 宣稱並行通過。

## 每案收件欄位

```text
case_id / status: PASS | FAIL | BLOCKED | NOT_RUN
app_sha / migration_source_manifest / applied_migrations / handler_bundle_hash
actual_target_ref / region / PG / Edge_runtime / browser / exact_origin
actor_alias / A_or_B_scope / role_before_after (no JWT, keys or user list)
command_or_manual_steps / request_id / document_activity_report_ids
actual_result / before_after_counts_hashes / evidence_location
not_run_scope / blocker / next_authorized_action
```

敏感原始證據保留受限 Owner 位置；公開 Git 只脫敏結果與合成資料。每案記實際結果，不預填 PASS。

本輪執行證據：[fixture 13項](evidence/uat-acceptance-preparation-20261108/fixture-tests.txt) 與 [backend 42項](evidence/uat-acceptance-preparation-20261108/backend-node-tests.txt) 重疊不相加；[manifest](evidence/uat-acceptance-preparation-20261108/candidate-manifest.json)、[圖檔解碼](evidence/uat-acceptance-preparation-20261108/image-decode.json)。npm 不在本輪 PATH，命令解析失敗已記入 [執行紀錄](evidence/uat-acceptance-preparation-20261108/EXECUTION.json)，隨後以實際 Node 執行 package 的同組 `backend/tests/*.test.js`，不是宣稱 npm 已通過。FE/type/lint/build/SQL/nativeDeno 本輪未重跑（產品來源未變）；既有固定版證據另見 N3 交付。
