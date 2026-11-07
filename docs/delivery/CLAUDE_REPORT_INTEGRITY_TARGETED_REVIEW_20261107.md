# Claude 增補：完整報告保存權威與整合交集

WAITING_CLAUDE／WAITING_CTO，唯讀、發布HOLD。固定程式 **ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde**，基線e565b4fe19ebf088d71c4ab5c553e4c5306215c4。只審006、generate/export handler、必要frontend guard及003–005／ledger／MANUAL交集；五組原固定版本維持[單一入口](CLAUDE_INTEGRATION_REVIEW_START_HERE_20261107.md)，勿改用branch HEAD或重開整案。

來源：`backend/supabase/migrations/202611060006_report_snapshot_integrity.sql`、`backend/supabase/functions/{generate-report,export-report-snapshot}/index.ts`、`backend/src/services/report-export.js`、`backend/tests/integration/report-integrity-{sql,http}.test.js`、`tenant-revocation-integration.test.js`；frontend ReportPreviewPage／reportIntegrity／reportExportRead。

逐題「來源支持／仍有缺陷／證據不足」，附固定SHA、路徑行號、觸發、影響、最小重現、測試已讀／實跑及新增回歸：

1. I1 普通report INSERT/UPDATE/DELETE、marker／GUC／audit／舊v1 RPC／額外permissive policy／RLS漂移能否繞過？private schema/table/function ACL與definer search_path、owner/service權限是否適當？
2. I2 正常v2 INSERT→snapshot patch→最終marker→完整row proof/request/audit是否同交易？保存失敗是否全rollback；不能先把半成品標可信。
3. I3 lookup/replay/export的完整row、UTC canonical及request/actor/scope/claim/contract綁定是否完整？maintenance改row／刪row或ledger時是否拒絕而非補簽／建新報告？legacy可讀但不可假認證匯出。
4. I4 服務端是否fresh核對active組織／角色／project／最新訂閱？撤權於handler→RPC窗口的行為與SQL鎖來源推論，與尚無兩連線證據區分。
5. I5 report來源映射刪改是否仍可釋放附件引用？005刪除fence、MANUAL原件與private report權威交集；整合新增guard是否破壞合法保存或恢復。
6. I6 UI舊load／generate／export回覆在切單位、同人重新登入、A-B-A及unmount時是否失效？subscription preflight刷新是否讓busy永久卡住？marker不當serverauthority，舊報告不自動補簽。

`server_verified`只驗完整保存row一致，不驗碳資料、係數、計算或檔案業務真實性，不重做所有活動ACL／輸入新鮮度。真Supabase／JWT／Storage／Deno、獨立SQL並行與原生選檔存檔／復原仍NOT_RUN。Node/PGlite/合成Auth/Storage evidence不能替代；沒有執行請寫未重跑，提交者數字非Claude實測。

不要改程式／Git／資料／schema／權限，不操作雲端/migration/seed/reset/部署/費用，不讀密鑰或企業資料。不批准main合併或解除HOLD。
