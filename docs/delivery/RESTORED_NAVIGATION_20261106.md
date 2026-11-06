# 五階段導覽與頁內捷徑交付

固定程式815315b121924f86066220b573284016a30d64eb，branch codex/restore-workflow-navigation-20261106；疊在PR20固定7666c2f。發布HOLD，UAT7dccd545不變；不含雲端、合併或部署。

本機入口http://127.0.0.1:4197/login，API4196；啟動同COMMERCIAL_M2_PREVIEW_20261106.md。登入合成a-owner@product-preview.invalid，測試密碼synthetic-local-only。config中fixtures.a提供當前org/project；重啟後ID變更。

操作：打開/admin/activities?organization_id=<A>&projectId=<P> →「前往報告中心」→GHG卡片的「View」→報告歷史。五階段及捷徑、側欄皆保留org/project；URL別名相衝突拒絕，缺少membership暫停流程跳頁，不擴大成所有單位。歷史依URL範圍查詢，直接報告URL先以目前JWT讀取保存row，缺少org/project則補齊後重新確認，提供錯誤範圍拒絕。

ProtectedRoute以authEpoch/user/path/query隔離頁面實例，換單位／專案／重新登入移除舊頁面狀態；normal token refresh不改authEpoch。導覽只標示目前頁面，沒有完成勾號、百分比或推定前階段完成。上傳頁改專案也同步URL，避免導覽仍指向舊專案。

驗證：frontend166/166（新增3），type-check/lint/build PASS。獨立審閱找到卡片CTA遺失scope、Analytics衝突別名、直接報告缺project三項，均已修正；獨立測試是同範圍子集，不加總。Chrome合成環境實際點擊活動→中心→卡片→歷史，同一A/P，保存報告0.05t；證據：[scoped-history.png](evidence/restored-navigation-20261106/scoped-history.png)、[DOM](evidence/restored-navigation-20261106/scoped-history.txt)。

未驗：真實Supabase/JWT撤權、跨tab原生Storage與雲端環境；Analytics後端端點未在此有限本機adapter提供，跳至該頁會明示錯誤，未假造分析成功。此批不更動後端ACL/RLS，導覽本身不是授權控制。

下一項：十章報告結構／真保存欄位的來源及缺件提示。人工轉錄方案A已獲CTO本機開發／隔離測試授權，排在匯出之後；回饋只做本機編寫／複製、明示未送出。
