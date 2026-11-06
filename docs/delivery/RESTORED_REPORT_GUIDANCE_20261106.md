# 十章保存資料導引與本機回饋 — 2026-11-06

固定程式70b9d738a9bcb011a17124ca35542a5c300b419e；branch codex/restore-report-guidance-20261106，疊在第1項PR21 4a50c8b。發布HOLD、UAT7dccd545不變，沒有雲端、合併或部署。

入口http://127.0.0.1:4197/login；專用API4196，啟動同COMMERCIAL_M2_PREVIEW_20261106.md。以合成a-owner@product-preview.invalid / synthetic-local-only登入，依config fixtures.a的reportId/org/project打開原報告。展開十章可查看保存來源／缺件；報告中心未選快照時只列章節導引，不填內容。

新增ReportSavedSnapshot白名單，取保存payload及V2同交易欄位；顯示ID、版本、保存時間、期間、工作區／法人／據點／邊界、活動摘要、Scope kg/t、係數來源版本、附件追溯、警示與調整清單。column缺少才使用明示來源的舊payload，無效column不由fallback掩蓋。缺少／空清單／無效／內部不一致均可辨識；無完成百分比、無生成章節、無live資料補成歷史欄位、無AI placeholder冒充完成。

原App頁底封測回饋：展開→輸入文字→複製。只在當前頁面記憶體保留，換頁／單位／authEpoch卸載清除；無fetch、收件服務、遙測或跨產品持久儲存。複製後明示「尚未送出」。Chrome實際點擊複製後顯示成功的本機複製狀態；未宣稱收件。私密內容不要貼入測試草稿。

測試frontend173/173（新outline7），type-check/lint/build PASS；獨立outline7＋adapter4＋workflow3＝14個子集PASS，不加總。主代理Chrome實際打開保存A報告，十章顯示真ID、v1、期間2026-01-01～2026-12-31、合成標記及法人／據點空物件；原摘要50kg/.05t。截圖：[saved-outline.png](evidence/restored-report-guidance-20261106/saved-outline.png)、[local-feedback.png](evidence/restored-report-guidance-20261106/local-feedback.png)，[DOM](evidence/restored-report-guidance-20261106/saved-outline.txt)。另補第1項A-only直接切B歷史後空資料、未殘留A報告截圖，僅合成SQL RLS，不是雲端隔離驗收。

未驗：真Supabase/JWT/Storage、雲端部署與撤權、原生下載；保存SHA欄位不代表server驗真。內容是資料導引，不代表十章正式報告、合規或商用驗收。

下一項已核對PR9/10匯出formatter及依賴：舊封測下載矩陣未映射到現有tenant角色，因此啟用下載WAITING_CTO，具體server方案見EXPORT_AUTHORIZATION_CTO_DECISION_20261106.md；僅攔啟用，不攔合成檔案測試或M4。已按最新CTO核准接續M4方案A本機/隔離測試，無雲端授權。

新ledger定向審查交付：CLAUDE_REPORT_LEDGER_TARGETED_REVIEW_20261106.md，固定18c0894，L1～L5，只準備審查指令，未通知Claude或宣稱放行。
