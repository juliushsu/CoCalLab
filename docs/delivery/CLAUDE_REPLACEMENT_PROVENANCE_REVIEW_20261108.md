# Claude 定向複審入口：F1／F2／N4-R1

只讀 [PR35](https://github.com/juliushsu/CoCalLab/pull/35)，固定產品 **`040509777bb1cb60589a01ce7ec176a4ec54cee7`**；工具固定 `08162ca307f9336b635b77e7682de750e814a5f0`，後續只有交付文件。請勿改用移動 branch HEAD，不修改程式／帳戶／雲端。發布 HOLD。本入口由 Owner 轉交，Codex 未代送 Claude 或發 PR 留言。

先讀 [CTO 本輪裁定及交付](REPLACEMENT_PROVENANCE_FIX_DELIVERY_20261108.md)。保留的歷史回覆：[N1／N3](CLAUDE_N1_N3_REVIEW_REPLY_20261108.md) 固定 b5772f4、[N4](CLAUDE_N4_LOCK_ORDER_REVIEW_REPLY_20261108.md) 固定4b00925。N1／N2／N5 沿 CTO 來源關閉；N4 只關已驗具名排程。不要重新展開 H0、舊授權裁定或整案安全稽核。

## 唯一複審範圍

| 問題 | 固定來源／必要判定 |
|---|---|
| F1 人工更正來源失真 | `backend/supabase/migrations/202611080002_replacement_provenance.sql`：NULL confidence、新舊 successor投影、完整 private ledger provenance、trusted inputs、兩處 publisher metadata 核對。`backend/src/services/build-report-payload.js`，FE `replacementDisclosure.ts`／`reportExport.ts`／`ReplacementDisclosurePanel.tsx`、報告及活動頁。原件只作歷史來源，未暗示佐證120；舊報告不回填／補簽。 |
| F2 legacy exclude | 同 migration 的 mode-bound require_source；exclude 原值、有效前版／latestconfirmed source／租戶／角色／subscription／衝突仍受控；correct仍有效原件驗證。legacy_unverified不得升格。 |
| 恢復交集 | `recover_activity_replacement`、原 replace handler 的 strict recover DTO、FE activityReplacement／activityReplacementRecovery／CreateActivityModal。關閉分頁後依 server actor恢復原 request／intent，不新建ID；外actor不得取得私有意圖，撤權即時拒絕。 |
| 排除呈現交集 | `activityDetail.ts`、EmissionActivityDetailPage：保留 quantity120，醒目「已排除／不計入」，不能誤稱0排放；歷史計算保留。 |
| N4-R1 | `202611080003_draft_project_lock_order.sql`：普通draft INSERT／UPDATE早於document advisory先鎖project，權限與rollback不變。工具 `run.mjs`／`draft-trigger-race.mjs`：fresh統計、barrier順序、真A↔B cycle、不把observer製造的等待當產品死鎖。 |
| 相容小修 |040相對99c233d僅六增一刪：先保留source mapping ID multiset的舊錯誤碼，再驗provenance。普通來源拒絕／metadata偽造均未放寬；原兩個負例未刪改。 |

## 最小重現與證據

[EXECUTION.json](evidence/replacement-provenance-20261108/EXECUTION.json) 是各版本、命令、結果與未驗範圍索引；[獨立代理回執](evidence/replacement-provenance-20261108/independent-review.json) 與 native紅綠證據同資料夾。作者、獨立代理及CI的重疊結果不能加總。未自行重跑時請明示只讀來源，勿把引用測試寫成親自重跑。

```powershell
$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path
node --test --test-concurrency=1 backend/tests/integration/replacement-provenance-sql.test.js backend/tests/integration/replacement-provenance-http.test.js
node --test --test-concurrency=1 backend/tests/integration/cto-p2-source-authority-sql.test.js backend/tests/integration/report-integrity-sql.test.js
node backend/tools/native-pg-concurrency/run.mjs --draft-r1-fixed 040509777bb1cb60589a01ce7ec176a4ec54cee7
```

第三條只適用已存在的本 PC 專用 PG17.11／55439 與受限metadata；別台缺環境標BLOCKED，不連既有5432或雲端、不自行找帳密。PGlite是合成Auth/Storagecatalog，並非真JWT／Storage／Edge。沒有新增環境建立授權。

交付驗收例：100→120 後 new report只120，old report／活動／計算／proof全JSON不變；服務端清 confidence並保存完整chain。直接 SQL 分別偽理由、actor、時間、模式、diff、祖先順序／漏列及原件狀態，均不得發布可信報告。legacy exclude→重算→保存且仍legacy；correct拒絕。重開分頁 recover同request、活動列數不增；外租戶／viewer／readonly／外actor／撤權拒絕。完整 HTML／JSON產檔與 UI畫面可查，但原生下載落盤未驗。

原生 da5 RED兩trigger間40P01、040 GREEN四具名／3Lock；獨立重跑另有不同PID／DB。UPDATE兩trigger間並行與其他組合仍 NOT_RUN；不能據此全域關閉N4。managedJWT／Storage bytes／Edge／雲端 migration、現版完整備份復原與代表使用者驗收仍未執行。

## 請回覆

逐項 F1／F2／N4-R1 及上述交集：**已解決／仍存在／證據不足**；附固定SHA、來源檔與行號、必要觸發條件、實際讀到或執行的測試範圍、最小重現、影響與最小修法。新缺陷僅報與此次差異直接相關的來源證據，分開列真服務未驗；不要把 NOT_RUN 誤當來源漏洞或把來源通過當發布通過。

P3 明確留OPEN：高精度witness、歷史 `is_latest` 語意與effective view使用規範；不改寫歷史計算以整理標記，不擴成新安全框架。由 CTO 收件裁定後才關阻擋；此複審不構成Production核准。
