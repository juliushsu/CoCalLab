# Claude 定向複審隊列（唯讀）

RELEASE HOLD。不要修改程式、帳戶、資料庫、Storage、雲端資源或部署；不要改用移動HEAD。CTO已來源關閉P2-1～P2-3，不重開整案/H0；只在差異交集有新證據時提出。

## A. PR30 — N1/N2與來源witness

固定程式33d3613487f42a7e9c5888ae312441e730d3d87e；比較b69684dc2c52cc4b062b78f1e7aa711043366956。入口[固定複審問題](https://github.com/juliushsu/CoCalLab/blob/23f49ada664d4d37290e5712cf068d2c55f8bd89/docs/delivery/CLAUDE_N1_N2_REREVIEW_START_HERE_20261107.md)。本機整合358=356PASS/2NOT_RUN、backend33/FE227/native15；CI文件23f49ad Verify source42383511177 success。這些是已跑來源證據，不代替你獨立執行。

請裁定whole-document MANUAL側枝/改綁、latest/pending/oldhandler、原ID查回、provider/JSON一致性、100讀取→改200→commit舊100的來源witness，以及N5取消提示/重試是否已解。N4保留NOT_RUN；真React前景自動refresh未證實。

## B. PR31 — N3保留前版、明確取代

固定應用程式ed6ca9bbfbc5581cdcacf2969340575217fcb8c4；比較基底23f49ada664d4d37290e5712cf068d2c55f8bd89。測試修正d761e46e26e2625551781da2120641e8e18c2d1c只改舊overflow fixture；SOURCE_EQUIVALENCE.json核對應用程式完全相同。不要把N3差異算成A固定版已存在。

優先讀：

- backend/supabase/migrations/202611070005_activity_replacements.sql
- backend/supabase/functions/replace-emission-activity/index.ts、analytics-emissions/index.ts
- backend/src/contracts/activity-replacement.js
- frontend/readdy-app/src/services/activityReplacement.ts、activityReplacementRecovery.ts、activityLineage.ts、manualWorkflow.ts、activityDetail.ts、projectStatistics.ts、activityService.ts
- frontend/readdy-app/src/pages/admin/activities/EmissionActivitiesListPage.tsx、EmissionActivityDetailPage.tsx與components/CreateActivityModal.tsx
- backend/tests/integration/activity-replacement-{sql,http}.test.js、frontend/readdy-app/tests/activityReplacement.test.ts
- ACTIVITY_REPLACEMENT_N3_CONTRACT_20261107.md、ACTIVITY_REPLACEMENT_N3_DELIVERY_20261107.md、evidence/activity-replacement-20261107/

必答：

1. 普通API/舊save/RPC能否原地修改或刪除退休前版、計算、來源或報告？relation-first及effective invalidator是否完整保留舊列？
2. effective集合是否涵蓋重算/權威結果判定/報告/analytics/清單/統計/明細？有無新舊雙算、排除歸零冒充、未算回假成功或讀取RLS旁路？
3. 同request失回覆/重送、後續取代historical回原、不同意圖、撤權、跨租戶、競爭前版與rollback是否由服務端處理？獨立PG競態未驗須如實保留。
4. MANUAL及非MANUAL來源繼承與原件仍有效驗證有無繞過？未重新辨識/人工核准的資料是否被冒稱升格？
5. frontend恢復參考是否綁user/org/project/pred/request，所選journal意圖與表單一致，損壞/多分頁/舊情境回應是否可安全核對或明確放棄？

A/B每項回覆已解決／仍存在／證據不足，附固定版來源行號、觸發條件、測試範圍與新增回歸。說明是否實際執行命令；不加總重疊子集，不把Node/PGlite/靜態bundle/本機Chrome當managedSupabase或原生落盤驗收。沒有合併、雲端套用或Production授權。
