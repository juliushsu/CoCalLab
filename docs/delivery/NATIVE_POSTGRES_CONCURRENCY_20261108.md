# 原生 PostgreSQL 並行驗證 — 2026-11-08

工具固定 `b7bf83d4ea0e038262af1e9f9988e83db91dac84`；產品修復固定 `da5a0990c8ec82d2b55064dd7e009b771409fa73`。

RELEASE HOLD；本機 SQL 測試能力新增，不是完整 Supabase UAT 或雲端授權。紅例產品固定 `ed6ca9bbfbc5581cdcacf2969340575217fcb8c4`；修復候選固定 `da5a0990c8ec82d2b55064dd7e009b771409fa73`；N1/N2 基礎固定 `33d3613487f42a7e9c5888ae312441e730d3d87e`，正式 UAT 基準仍 `7dccd5452152f2495d10ad1437d5d03215166065`。

## 環境回執

- PostgreSQL 17.11 Windows x64，免安裝 ZIP；[PostgreSQL 官方入口](https://www.postgresql.org/download/windows/)指向 [EDB binaries](https://www.enterprisedb.com/download-postgresql-binaries)。精確 archive 與 [官方 checksum](https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip.sha256) 已實際下載，比對 SHA256 `80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f`，381531864 bytes。
- 第一個 initdb 在中文 workspace 路徑失敗，原錯誤 `invalid byte sequence for encoding UTF8: 0xa4` 保留。使用全新 ASCII-only OS temp 專屬目錄後 UTF-8 initdb 成功；沒有改成 SQL_ASCII 掩蓋問題。
- 只解壓 bin/lib/share；未執行系統 installer、未建立 Windows service、未修改系統 PATH、未重試 Docker／WSL。原9.5.4與既有5432未使用或修改。
- 專屬 server 僅 `127.0.0.1:55439`，SCRAM-SHA-256；temp root 停用繼承、只有目前 Windows 使用者 FullControl。SQL 測試帳號 `cocal_uat_admin` 不是 Supabase／產品登入帳號。憑證在受限、未追蹤 `password.txt`，script 從 local launch metadata 取得，值不進輸出或 Git。
- workspace tooling/native-pg17-20261108/ascii-runtime.json 指向該受限目錄，內有 launch.json/data/password.txt。測試只在這個專屬 cluster 建立唯一 `cocal_sql_race_*` 資料庫；不重用其他資料庫、不 drop/reset。
- 已用實際 client 確認兩個不同 backend PID（100116、68756）與 UTF8／PG17／loopback；這一筆只是連線能力證據，不是鎖等待通過。Windows 程序／port 枚舉偶爾空值，實際 SQL probe 仍 live，不因觀察空結果重建。
- driver 固定實際 `pg@8.16.3`，放同 workspace tooling/native-pg17-20261108/driver；以既有 npm CLI、`--ignore-scripts`安裝，無全域依賴／新費用。套件 lock 與 native binary 原件留 tooling。

來源與 setup 脫敏證據在 [native-pg-concurrency-20261108](evidence/native-pg-concurrency-20261108/download.json)：archive／binary hash、初始化失敗與成功、ACL 與基本連線能力；download 時 executed=false 是當時快照，後續實際執行以本回執與結果為準。

## 實測結果

### 首兩組重算已實測（含獨立複核）

`node backend/tools/native-pg-concurrency/run.mjs --run` 是顯式授權本機造合成測試資料的入口；沒有 flag 只印 help，不讀憑證或連線。`--probe` 只連專用 cluster 核對 PG17.11/UTF8/data_directory/loopback，不建立資料庫。預設 backend test suite 不會啟動 runner。

| 案例 | 實際結果 | 邊界 |
|---|---|---|
| 同ID重算並行提交 | PASS；A89052執行真commit RPC後暫持外層交易，B31512呼叫同RPC；observer61828看到B的transactionid Lock及blocking_pids=[A]。A提交後B回原calculation_result_ids；最後1筆計算、calc_version1、1筆重算audit | 沒有外加row/advisory鎖；刻意控制交易commit窗口，不宣稱真HTTP網路競態已驗 |
| 已提交回覆不被採用後查回 | PASS；不採用原commit回覆，以原request lookup查回原ID | 應用層刻意丟棄結果，不是真TCP封包遺失 |
| 受控編輯與舊重算交錯 | PASS；A受控save200後持鎖，B舊100輸入commit真Lock等待；A提交後B以P0001/RECALCULATION_INPUT_CHANGED拒絕。rollback後0計算，fresh request重算得100kg（測試係數0.5） | 沒有將舊結果誤用為新結果；不是正式係數 |

首輪新DB `cocal_sql_race_20261108054749614_5f6f3c48`；[結果摘要](evidence/native-pg-concurrency-20261108/NATIVE_RECALC_RESULT.json)／[真SQL時間線](evidence/native-pg-concurrency-20261108/SQL_TIMELINE.json)。DDL以固定ed6路徑+SHA256引用，完整原始440139bytes與hash留workspace tooling，沒有刪除或覆寫。

首個runner出現22P02（pg把JS陣列當SQL array，而jsonb參數須明確JSON序列化），只修測試wire encoding後新DB重跑；[初敗保留](evidence/native-pg-concurrency-20261108/INITIAL_RUNNER_FAILURE.json)，沒有更改產品SQL或reset/drop掩蓋錯誤。

另在全新獨立 `cocal_concurrency_20261108` nativeDB實際套43份schema成功、3歷史fixture DML未套，16個NOT VALID仍待資料驗證；[逐檔hash與catalog](evidence/native-pg-concurrency-20261108/NATIVE_SCHEMA.json)。成功套用不代表歷史資料合法。

### 已重現N4並修復同一排程

基線ed6：主代理整合及獨立代理各在新DB跑出6個具名案例PASS＋N4真40P01（不是7項全部成功）。A刪除先持document fence/receipt，B人工轉錄先持project lock；test-only trigger barrier只暫停A，釋放後observer不在cycle，實際A等B的transactionid、B等A的advisory。受害交易rollback；winner只留1筆delete operation/audit，manual同ID retry以DOCUMENT_DELETION_FENCED拒絕，沒有假成功。

[基線結果](evidence/native-pg-concurrency-20261108/BASELINE_N4.json)／[獨立紅例](evidence/native-pg-concurrency-20261108/INDEPENDENT_BASELINE_N4.json)／[紅例SQL時間線](evidence/native-pg-concurrency-20261108/N4_SQL_TIMELINE.json)。原始完整命令與hash保留tooling；公布的時間線只以固定source/hash代替重複DDL本文，未改操作結果。

修復 `da5a0990c8ec82d2b55064dd7e009b771409fa73` 只新增 `202611080001_document_lock_order.sql`：delete request／finalize在原assert_write後、doc fence前先鎖精確project；release processing在原lease actor檢查後先鎖lease所屬project，**不新增write檢查阻斷撤權cleanup**。migration先證整體舊catalog ready、唯一anchor、只更新3個已知function fingerprint並要求post-ready；ACL/owner/config與其他指紋不變。[native metadata核對](evidence/native-pg-concurrency-20261108/LOCK_MIGRATION_NATIVE.json)／[故障注入漂移拒絕與rollback](evidence/native-pg-concurrency-20261108/DRIFT_REJECTION.json)。

候選工具操作：

`node backend/tools/native-pg-concurrency/run.mjs --candidate da5a0990c8ec82d2b55064dd7e009b771409fa73`

它建立全新專用race DB，固定44 schema/3歷史DML HOLD；`--run`仍固定ed6重現紅例，不能因exit0就當N4放行。

| 修復候選具名範圍 | 實際結果 |
|---|---|
| 同ID重算與回覆未採用後lookup、受控編輯使舊輸入拒絕／fresh retry | PASS，見前述重算；失敗request保持未完成 |
| delete/reference兩向交錯 | PASS；winner先提交後另一方拒絕，未同時留下新引用與刪除operation |
| N1同確認ID並行 | PASS；同原活動／計算ID，1 activity/1 calculation/1 audit/1 ledger |
| N3競爭後繼 | PASS；僅一有效leaf；另一意圖拒絕，原ID可replay，原活動／計算完整JSON不變，重算只採120kWh=合成60kg |
| 原N4同barrier位置 | PASS；B改等待A已提前取得的project鎖，釋barrier後A提交、B由fence42501拒絕，該排程未有40P01 |
| finalize/replay、撤權cleanup與普通角色拒絕 | PASS；真獨立finalize/MANUAL等待，2個delete audits/0draft；authenticated執行3個RPC拒絕、foreign actor release拒絕、撤權原actor仍可結束lease恢復pending |

主輪及獨立輪各8具名案例/9個真Lock觀測，不相加成16項。[候選結果](evidence/native-pg-concurrency-20261108/CANDIDATE_N4.json)／[候選SQL時間線](evidence/native-pg-concurrency-20261108/CANDIDATE_SQL_TIMELINE.json)／[獨立候選](evidence/native-pg-concurrency-20261108/INDEPENDENT_CANDIDATE_N4.json)。另相關既有SQL/HTTP regression **72=71PASS/0FAIL/1SKIP**，skip仍是PGlite單連線限制；[實際log](evidence/native-pg-concurrency-20261108/RELATED_REGRESSIONS.txt)。不將PGlite與native／獨立重跑相加。

runner的兩次初始harness失敗均保留：前述22P02 wire encoding，以及測試provider名稱含MANUAL token正確被來源guard拒絕，改為明示synthetic OCR fixture後重跑（[第二次初敗](evidence/native-pg-concurrency-20261108/SECOND_RUNNER_FIXTURE_FAILURE.json)）。另獨立審閱發現role bootstrap mutex須統一在maintenance postgres DB（advisory鎖具DB範圍），已修tool；沒有因此改產品角色。guard測試採exclusive mkdir、不recursive刪除既存目錄。這些是測試工具修正，不包裝為產品缺陷。

**N4仍待Claude／CTO接受，只證已列出的本機原生SQL排程。** 其他lock組合、跨服務中斷、managed Supabase／JWT／Storage、網路封包遺失與真服務負載仍NOT_RUN。原PGlite兩項skip保留；不是全案並行關閉。最新部署提案 [47來源／44schema候選](../../deployment/uat/candidates/da5a0990c8ec/README.md)；未操作雲端。

## 保留的邊界

本機 auth.uid/Storage catalog 是明示合成測試 adapter；PG 本身為原生多連線，不代表真 Supabase JWT、Storage HTTP／bytes、managed Edge、ESZIP、完整服務部署、雲端 migration/NOT VALID、備份還原、原生選檔／落盤或19+1使用者已驗。這些仍另行 NOT_RUN。

既有 PGlite suite 的兩個 skip 留原樣；新的真 PG 證據分開列，不將不同環境／案例數相加，也不自行宣稱 CTO／Claude 已接受。N1/P2-4與N3的定向來源審查仍沿 [固定審查入口](https://github.com/juliushsu/CoCalLab/blob/a04a562ba869a2d079c3bcec1f9d45643f2b8055/docs/delivery/CLAUDE_N1_N3_REVIEW_QUEUE_20261107.md)。

PR32 固定 `ddcc896612e57721f4116cbaef0290483321386f` 的 GitHub Verify source run42451102879 已 success（backend／PGlite整合／frontend／type/lint/build，見 [CI回執](evidence/native-pg-concurrency-20261108/PR32_CI.json)）。此為 Ubuntu CI 證據，與本輪新增原生PG鎖驗證不同。
