# 本機原生 SQL 備份／還原驗證 — 2026-11-08

> 程式/交付固定 `b701ddbf2affb818c63e6c647012c494e0c94439` 已於CI run42455636617 success，見[CI回執](evidence/native-pg-recovery-20261108/PR34_IMPLEMENTATION_CI.json)。後續狀態文件不改程式。現在等待Claude/CTO定向結果及真環境操作範圍；發布HOLD。

**RELEASE HOLD。只完成本次專用本機 PG 的具名 SQL 復原檢核；不代表 Supabase／Storage／商用復原已驗收。**

- 產品固定 `da5a0990c8ec82d2b55064dd7e009b771409fa73`（PR33鎖序修復）；本輪沒有產品、schema、角色政策、前後台或既有功能變更。
- 工具固定 `a05cec8221568f0d7ac14029509fad726dfefdd2`；來源 `backend/tools/native-pg-recovery/`。
- 原始測試來源為先前獨立通過的 `20261108060154015-4430f35e`／da5 native candidate receipt，hash與已公開N4證據一致；僅讀取，所有寫入限新建clone/restore/negative DB。
- PR33文件HEAD `b468a658dbd84b8663d2741a75823083c13e5203` 的 CI run42453757126已success（backend/PGlite/frontend/type/lint/build）；[固定CI回執](evidence/native-pg-recovery-20261108/PR33_CI.json)。本輪工具及驗證另列，不借用此CI冒稱真服務通過。

## 可操作入口

從repo root，在原專用本機runtime仍可用時執行：

```powershell
node backend/tools/native-pg-concurrency/run.mjs --probe
node backend/tools/native-pg-recovery/run.mjs
node --test backend/tools/native-pg-recovery/verifier.test.mjs
node backend/tools/native-pg-recovery/run.mjs --run --source-run 20261108060154015-4430f35e
```

probe只核對原專用PG；recovery不帶flag只印help，不讀憑證、不連線。最後一條會建立全新三個資料庫、產出受限archive並執行正反例。每次有新ID，不能把舊證據IDs當成此次結果。

工具只接受已通過且明示synthetic的da5 candidate run receipt、47來源中的44 schema／3歷史fixture HOLD。實際連線核對PG17.11/UTF8、`127.0.0.1:55439`、`cocal_uat_admin`與精確專用data_directory；不接受連線字串／5432／其他host／其他資料庫名稱。run ID有嚴格格式，不接受路徑。

憑證取得方式：同workspace repo外 `../tooling/native-pg17-20261108/ascii-runtime.json` 指向限目前Windows使用者的TEMP runtime，該處launch.json提供password.txt位置。工具在記憶體讀取；不印值、不讀正式.env、不匯出全域角色或密碼。archive與完整private row snapshots繼承受限ACL，實際archive檔權限也已檢查。此SQL測試帳號與Supabase／產品登入帳號分開。

## 版本、環境與實際命令

| 項目 | 實際證據／操作 |
|---|---|
| 原生工具 | PG17.11／pg driver8.16.3；pg_dump與pg_restore逐檔比官方ZIP entry SHA與版本，[結果](evidence/native-pg-recovery-20261108/RECOVERY_BINARY_HASHES.json) |
| 原candidate | `cocal_sql_race_20261108060154015_4430f35e`；連線只讀capture，無活躍使用者才TEMPLATE，不終止其他session |
| 新source clone | 每次新 `cocal_recovery_source_<timestamp>_<id>`；先全snapshot核對原candidate，再用固定da5報告builder＋trusted inputs＋真正publisher RPC保存60kg合成報告，建立私有proof與request ledger；不直接插入假proof |
| 備份 | `pg_dump --host=127.0.0.1 --port=55439 --username=cocal_uat_admin --no-password --dbname=<new-source> --format=custom`；binary stdout導向exclusive新檔，密碼只在child env；不經shell |
| 完整還原 | 先CREATE全新 `cocal_recovery_restore_*`；`pg_restore`明確指向該DB並用`--exit-on-error`。不用clean/create/drop/reset，不改原candidate或source clone |
| 部分還原負例 | 另一全新 `cocal_recovery_partial_*`先schema-only；全驗證器必拒。再只恢復public資料使tenant/member/report實際存在、private proof仍空，verified read必明確REPORT_SNAPSHOT_UNVERIFIED |
| 負例trigger處理 | 只有新partial目標的public data COPY使用`--disable-triggers`，屬明示不完整還原實驗；完整restore沒有關閉trigger捷徑。partial永不當可用服務 |
| 失敗行為 | 任何CLI／資料比對／權限檢核失敗都不回報成功；保留新目標與artifact供核對，不自動清除、reset或修改baseline |

命令沒有secret參數；完整SQL及child argv時間線見[本輪紀錄](evidence/native-pg-recovery-20261108/SQL_CLIENT_TIMELINE.json)。`--exit-on-error`只代表遇錯停止，這裡沒有宣稱多服務或全restore過程原子化；官方[pg_restore說明](https://www.postgresql.org/docs/17/app-pgrestore.html)記錄此行為。

## 已實測結果

主輪 `20261108062802408-02f757c2`、獨立輪 `20261108062840367-7b9aab37`，各自建立新三DB；兩次各9具名檢查PASS，是相同覆蓋，不加總18。verifier單元5/5另列，[log](evidence/native-pg-recovery-20261108/VERIFIER_TESTS.txt)。

| 檢查 | 實際結果 |
|---|---|
| candidate→新source clone | 全row/catalog/sequence相等；原candidate前後一致 |
| 真保存鏈 | trusted計算來源的120kWh合成活動、0.5測試係數，publisher保存completed/server_verified 60kg報告；read＋request lookup可查回同row |
| 全表資料 | 37張public/auth/storage/cocal private表所有row以PostgreSQL JSONB文字排序比對，精確數值／時間／IDs保留；未只比總筆數或selected欄位 |
| Schema／權限 | 比schema/table/column owner/完整ACL、RLS/policies、function完整定義/config/安全屬性、trigger、constraint/deferral、index/view定義、enum/extensions/default privileges、sequence ownership與partition/inheritance。實際列於snapshot.mjs；不是整個cluster/所有平台設定盤點 |
| 序列與NOT VALID | last_value/is_called及序列定義相等；16個NOT VALID依舊false，資料合法性尚未驗證 |
| 私有來源鏈 | report完整row/proof/request一致；舊100／新120活動與計算ID、取代關係與其他private ledgers保持原值 |
| 還原後操作 | fingerprint contract仍ready；原report read/lookup/replay與calculation lookup正常，replay後無增加row/audit。錯tenant/viewer/ordinary RPC/private schema直接讀取拒絕 |
| 不完整還原 | schema-only被full verifier拒絕；補public資料後report已存在，但缺private proof仍由真RPC以REPORT_SNAPSHOT_UNVERIFIED拒絕，不把scope拒絕當作proof測試 |
| 原件保留 | 完整source clone前後snapshot、archive前後SHA與原candidate前後snapshot相同；archive實際NTFS權限只允許核准principal，值與機器SID不進公開證據 |

[主輪摘要](evidence/native-pg-recovery-20261108/AUTHOR_RESULT.json)／[獨立摘要](evidence/native-pg-recovery-20261108/INDEPENDENT_RESULT.json)／[獨立唯讀audit](evidence/native-pg-recovery-20261108/INDEPENDENT_AUDIT.json)。所有資料、帳號角色及係數均為測試合成；不是企業資料或正式排放計算驗收。

### 初次失敗與工具修正

第一輪已產archive／restore，但raw ACL文字把NULL default ACL與等價顯式owner ACL判為不同；原rows/functions/constraints相符、restored readiness也true。只修verifier：按object type用acldefault補NULL，完整保留並排序grantor/grantee/privileges；沒有刪除權限檢查或改產品fingerprint。[初敗原狀](evidence/native-pg-recovery-20261108/INITIAL_ACL_VERIFIER_FAILURE.json)保留。這個NULL語義可對照[PG17 ACL函式](https://www.postgresql.org/docs/17/functions-info.html#FUNCTIONS-ACLITEM-FN-TABLE)。

另一次startup的Get-Acl模組無法載入，尚未連原DB、建DB或dump；改為.NET唯讀ACL檢查，[回溯註記](evidence/native-pg-recovery-20261108/STARTUP_FAILURE.json)明說當時沒有tool hash，不假造原始證據。初失敗DB／archive／目錄都留存。

## 未驗與交接邊界

- 這是同一專用PG cluster的logical SQL恢復；cluster-wide角色／密碼／tablespace／平台設定與跨cluster角色OID/owner映射未備份或驗證。pg_dump的單資料庫範圍見[官方說明](https://www.postgresql.org/docs/17/app-pgdump.html)。
- Storage只有合成catalog rows，實體bytes／bucket服務／signed URL／object generation恢復仍NOT_RUN。真環境若原object ID改變，依既定契約停止信任並交CTO處理，不能自動重簽或用新上傳冒充原件。
- 本機archive含測試Auth／Storage catalog，只允許用於本工具新建的本機目標。managed Supabase UAT應採平台核准的備份／還原程序及範圍；本archive不是其初始化資料。
- 真Auth/JWT/PostgREST/Storage/managed Edge/ESZIP、原生chooser／落盤、實際歷史資料NOT VALID盤點、正式migration／備份／還原、負載與19+1代表使用者驗收仍NOT_RUN。
- N1/N3與N4仍待Claude／CTO裁定，沿[原N1/N3固定入口](https://github.com/juliushsu/CoCalLab/blob/a04a562ba869a2d079c3bcec1f9d45643f2b8055/docs/delivery/CLAUDE_N1_N3_REVIEW_QUEUE_20261107.md)與[N4補審固定入口](https://github.com/juliushsu/CoCalLab/blob/b468a658dbd84b8663d2741a75823083c13e5203/docs/delivery/CLAUDE_N4_LOCK_ORDER_REVIEW_20261108.md)。本輪沒有新產品變更需要另開整案稽核。
- Owner已選Micro與累計額度/14天，仍等前置與明確環境操作核准；未建立雲端資源、未啟動計費/保留時鐘，不重問同一預算。正式UAT基準7dccd545維持，不合併main、不部署Production。

完整archive及row snapshots留限目前使用者的 `<DEDICATED_RUNTIME>/recovery/<run>/`；原始工具result/SQL時間線在同workspace repo外tooling，公開版只留合成操作、counts/digests與raw檔SHA。重現操作／未驗項與下一命令已存NEXT_ACTION.md，沒有無限背景執行承諾。
