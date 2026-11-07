# Claude 定向複審：N1／N2 與來源見證交集

固定程式：33d3613487f42a7e9c5888ae312441e730d3d87e。PR #30；比較起點 b69684dc2c52cc4b062b78f1e7aa711043366956（保留原複審全文，程式同9ebf5b1）。RELEASE HOLD；只讀，不操作雲端、不改程式、不合併或部署。

請勿重開 H0／整案稽核；P2-1～P2-3 沿用 CTO 來源關閉，只有新差異交集有新證據才提出。

## 必答項目

1. N1：整份 MANUAL 文件歷史、latest／pending、REST INSERT／改綁、直接 RPC 與固定舊 handler 仍有旁路嗎？拒絕後活動、計算、audit 是否不增？合法 MANUAL／非 MANUAL 與重送查原結果是否成立？
2. N2：SQL trigger、handler、UI 是否使用一致 provider token／頂層 JSON 標記規則？新 canonical 與歷史未驗證資料是否正確分開？17-case corpus 正反例是否覆蓋？
3. 來源 witness：初讀100→普通角色改200→commit舊100是否拒絕？snapshot 獨立於操作 intent，完成 replay 是否仍回原ID？缺 witness 的舊 handler 新確認是否 fail closed？不要把合成序列交錯當獨立 SQL 並行。
4. N5：取消時提示與重試有無漏訊息或放寬授權？目前只驗 helper/受控刷新契約，未證實真 React foreground 觸發；請保留此界線。

每項回覆：已解決／仍存在／證據不足，附固定版檔案行號、觸發條件、實際執行範圍與新增回歸；若未跑測試請明說。N4 真連線鎖順序仍 OPEN／NOT_RUN；N3 活動取代另小PR，不混判此固定程式。

## 精準來源入口

- backend/supabase/migrations/202611070004_manual_document_confirmation_boundary.sql
- backend/supabase/functions/confirm-draft/index.ts
- backend/src/services/draft-confirmation-source.js
- backend/src/services/manual-source-guard.js、modules/document-provenance/
- frontend/readdy-app/src/services/draftReview.ts、reportDownload.ts
- frontend/readdy-app/src/pages/admin/documents/ExtractedDraftReviewPage.tsx
- frontend/readdy-app/src/pages/admin/reports/ReportPreviewPage.tsx
- backend/tests/integration/{cto-n1-n2-sql,draft-confirmation-http,legacy-confirm-handler-http}.test.js
- backend/tests/fixtures/confirm-draft-9ebf5b1.source.txt（原碼 SHA256 970ccc0d6bf79ae61290dc90c29d2577a74eb4f6cb2c304346b3be71dada96be）

固定交付與命令見 CTO_N1_N2_DELIVERY_20261107.md、evidence/cto-n1-n2-20261107/；過往337/335等數字不是本版實測，也不得加總獨立子集。本機 PGlite／Node SDK 替身、Deno 靜態檢查不代替真 Supabase／JWT／Storage／managed Edge、原生存檔或19+1驗收。
