# HTML／JSON 保存快照匯出整合

固定程式a868b2e283f9ba4ff0f7d4e6e9bc5802170014d7，branch codex/report-export-integration-20261106，疊PR22。沿用未合併PR9 1e93fee與PR10 0591626的純formatter/read/download/helpers及11測試，沒有整頁或整branch覆蓋。新增adjustment_manifest白名單且前後端清單測試相同。

CTO已明確回覆「核准方案A（本機開發／隔離測試）」。新export-report-snapshot以JWT解actor，active tenant owner/admin/editor、既有active/grace_period可寫subscription、精準org/project/completed保存報告；讀後重新確認角色/訂閱。viewer/readonly/跨單位/不存在/偽造actor/policy均拒絕。沒有REPORT_EXPORT_POLICY=tenant_write_v1時server預設拒絕；只在明示本機synthetic worker設定，雲端設定/部署未授權。

原報告頁HTML/JSON按鈕→server重讀保存快照→allowlist及ID核對→同步layout卸載/epoch/scope失效檢查→共享formatter與下載函式。kg來源不再轉回計算值；HTML顯示kg/t一次、escaping/CSP，JSON保留原kg及保存環境/測試標記。loading/error/成功提出下載請求分開，未支援PDF/Word明示，無Mock回退、不修改或重算報告。

測試：frontend184/184，type-check/lint/build PASS；新增實際handler/SDK/SQL policy4/4（合法、角色/租戶/偽身分/readonly、default disabled），舊匯出11例含臨時目錄真HTML/JSON寫檔重讀及失敗/晚到請求不產檔。獨立再跑同4+11是子集，不加總，未發現未解P1/P2。React卸載窗口已由useLayoutEffect同步失效，尚無真React race的獨立實測。

## 入口與操作

開發預覽仍依COMMERCIAL_M2_PREVIEW_20261106.md，API必須重啟載入新handler（舊4196尚在跑舊backend，不能拿404當功能成功）。API全合成、無持久資料，保留其他專案。整合M4將另用API4198/UI4199，部署來源與截圖再補固定SHA，不把工作樹當已部署版本。

在固定來源新runtime登入合成可寫者→打開completed保存報告→Export→HTML或JSON；server拒絕時顯示錯誤，沒有檔案。測試目錄 /tests/browser/report-export.html 僅共享formatter的合成下載頁，不是業務授權捷徑，不接正式資料。

## 未驗邊界

Chrome合成頁已實際按HTML，顯示提出下載請求；download事件仍逾時，指定Downloads檔案不存在。**原生瀏覽器存檔UNVERIFIED**，未將前端提示或Node寫檔當瀏覽器保存成功。沒有反覆重試該橋接能力；保留測試檔案讀回證據與UI觸發的不同範圍。真Supabase/JWT/Storage、Deno、雲端、正式並行/撤權商用驗收NOT_RUN。

發布HOLD、UAT7dccd545不變。這是來源候選，不代表Owner正式業務驗收、main合併或Production部署。M4 A繼續，不再以匯出待裁定阻擋；雲端/費用/外送仍停在授權邊界。

## 補充整合證據（固定06bad08，匯出業務程式a868b2e未改）

新版4199/4198已在原App走完MANUAL到保存報告並實際點HTML及JSON，server核對後UI顯示提出下載請求；截圖/DOM與同一真保存快照Node產檔連結見MANUAL_TRANSCRIPTION_DELIVERY_20261106.md。原生落盤仍UNVERIFIED，沒有把新截圖當已存檔證明。
