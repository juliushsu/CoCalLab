# Claude 定向複審：CTO 四項 P2 修復 — 2026-11-07

## 固定版本與範圍

- PR #30：https://github.com/juliushsu/CoCalLab/pull/30，branch codex/cto-p2-source-integrity-20261107。
- **固定程式／SQL／增量測試SHA：9ebf5b13427edf8d228659a24269ddaaf86a84f0**。只讀此版本，不改用移動HEAD；其後證據／文件提交不代表程式又變更。
- 原紅隊回覆固定507a94ea334c3a65f06d75955a365218112df84d，原應用ba2c7a56；最新CTO裁定見[執行邊界](CTO_P2_EXECUTION_DECISIONS_20261107.md)。四P2皆發布阻擋，七邊界已批准，不再重問同一決策。
- 相容性PR29是相依，source fc3be262bfe931ea37ea8ded194862c0145ce07e已14/14 native PASS；不重新稽核其全部內容。最新15-entry原生結果另見[固定證據](evidence/deployment-preflight-20261107-9ebf5b13427e/RESULTS.md)。靜態bundle不是managed Edge。
- 只複審下列四P2與修復交集，唯讀、不改程式、不操作雲端、不讀密鑰或正式資料；不重開H0／整案。請清楚區分歷史缺陷、已修source、推論、實際重跑與未驗。

## 複審問題與來源

| ID | 要判定的具體問題 | 固定來源與測試 |
|---|---|---|
| P2-1 | ordinary REST/SQL能否直接偽造或改活動/calc而產新可信report？受控活動建立/編輯/重送是否綁scope、JWT actor、可寫訂閱並使舊calc失效？目前inputs含doc/draft新鮮度、result_snapshot及authority是否可繞？合法編輯→通用重算→可信report是否保留？ | [001 authority/controlled RPC](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/supabase/migrations/202611070001_calculation_source_authority.sql#L33)；[generate-report](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/supabase/functions/generate-report/index.ts#L121)；[save handler](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/supabase/functions/save-manual-activity/index.ts)；[SQL反例/正例](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/tests/integration/cto-p2-source-authority-sql.test.js)；[實際SDK/HTTP鏈](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/tests/integration/controlled-manual-report.test.js) |
| P2-2 | 舊recalc/report對外EXECUTE是否在核對真呼叫鏈後撤銷？004/006新wrapper的owner內部調用、lookup/replay、空project仍正常？舊handler/混合/回退是否明確fail closed而非繞ledger？ | [001 old RPC owner-only鏈](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/supabase/migrations/202611070001_calculation_source_authority.sql#L5)；[004既有wrapper](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/supabase/migrations/202611060004_recalculation_requests.sql)；新SQL P2-2、recalculation-idempotency SQL/HTTP |
| P2-3 | classify直接RPC或舊handler能否改MANUAL任何歷史status/review_note？provider前helper與SQL是否一致（embedded provider、canonical key、legacy top-level array/scalar）？ | [002 marker/classify](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/supabase/migrations/202611070002_manual_processing_fences.sql#L5)；[shared helper](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/src/services/manual-source-guard.js)；[classify handler](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/supabase/functions/classify-document/index.ts)；新SQL/controlled HTTP與manual-activity-contract |
| P2-4 | processing begin/oldprocess/finish與MANUAL create兩方向互斥是否在交易內有效？確認前後、重送、非latest/歷史稿不可被取消latest或另建活動；非MANUAL流程仍合法？新MANUAL是否只接受仍有效的server-verified收件，confirm再核對物件？ | [002 processing/create/confirm](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/supabase/migrations/202611070002_manual_processing_fences.sql#L42)；[process handler](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/supabase/functions/process-document/index.ts)；新SQL中的兩方向interleavings、object-binding、同人confirmation正例 |

## 必看修復交集（不擴為整案）

- [003 source retention](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/supabase/migrations/202611070003_report_source_retention.sql)：MANUAL／非MANUAL source、public report/private proof雙來源、legacy braced/hyphenless/missing/invalid mapping failclosed，不能刪改斷鏈或cascade。org/project有報告、保留來源或既有ledger FK拒絕時，錯誤需明確；真正空scope可刪。
- [001 explicit32-field v1/v2 seal](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/backend/supabase/migrations/202611070001_calculation_source_authority.sql#L131)：保留v1 verifier、不重簽舊proof，無關新欄位不使歷史報告失效。v1/server_verified只證保存一致性，不能冒稱已證新計算來源或文件內容真實。
- 新MANUAL marker只在新create附上；replay與歷史資料不補簽。receipt private authority與current object/metadata/generation須在確認時再核對。hash一致不是文件內容真實或雙人覆核。
- 002入場先核舊deletion readiness，再僅更新已批准begin/finish fingerprint；不能把未知部署漂移重新baseline成就緒。
- [export busy](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/frontend/readdy-app/src/pages/admin/reports/ReportPreviewPage.tsx#L83)／[attempt ownership](https://github.com/juliushsu/CoCalLab/blob/9ebf5b13427edf8d228659a24269ddaaf86a84f0/frontend/readdy-app/src/services/reportDownload.ts#L5)：切report/session/scope時舊busy解除、舊finally不能清新attempt；失敗可重試；權限仍fresh檢查。真正延遲React操作/原生下載與helper測試分開。
- 新增private activity_requests只綁受控編輯的request/actor/input/saved-row，以處理重送，不能把可寫audit當權威；沿既有recalc ledger驗可信計算，不另建大型框架。

## 證據與未驗邊界

最新[交付與操作入口](CTO_P2_INTEGRATION_DELIVERY_20261107.md)、[validation JSON](evidence/cto-p2-integration-20261107/VALIDATION.json)、[browser明示合成證據](evidence/cto-p2-browser-20261107/BROWSER_RESULTS.json)。full suite與subset重疊，不可相加；讀測試碼不是重跑。

固定9ebf5b1原生15/15與全整合337tests=335PASS/0FAIL/2NOT_RUN均已實跑收件，詳validation JSON；先前1f同範圍不加總。不得把未完成run或skip算PASS。瀏覽器證據程式b7ed0e8，之後只有歷史marker/測試adapter增量，另由新增HTTP/SQL/native驗證，不能冒稱同一次browser驗全部版本。

真Supabase JWT/PostgREST/Storage/managed Edge、兩獨立PG連線/鎖序、原生選檔/下載、雲端migration/NOT VALID/DB+Storage復原及19+1驗收仍NOT_RUN。鎖序可以列來源推論，不能用序列或Promise.all關閉。UAT未建立，發布HOLD。

## 回覆格式

逐項P2-1/P2-2/P2-3/P2-4與上列交集回覆「已解決／仍存在／證據不足」，每項附固定SHA、檔案行號、觸發條件、直接API/SQL或最小重現、正反例覆蓋、你實際跑過的命令與未驗範圍。新增問題需有本次差異的具體證據、影響與最小修法；歷史已修不再開同票。沒有重跑就明示。此複審不是Production、雲端操作或商用放行。
