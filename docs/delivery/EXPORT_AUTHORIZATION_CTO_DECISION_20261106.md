> 最新裁定：CTO於2026-11-06明確核准方案A本機開發／隔離測試；已實作來源a868b2e，詳REPORT_EXPORT_INTEGRATION_20261106.md。以下保留提出方案時的歷史脈絡，不再是等待答覆；雲端與發布未授權。

# WAITING_CTO — 報告下載授權

目前工作順序第3項已讀固定PR9 1e93fee26e6d07a28e85089325ae5afa75d36160、PR10 059162660c588346e3cf36aec6ae1ca7dd8f1d39；皆未合併。可沿用3個純formatter/read/download helper與11個測試，不整頁覆蓋M1及導覽成果。

具體阻礙：PR10 reportDownload.ts中的reportExportBlockReason永遠回authorization pending；reportService正式下載入口直接throw。來源docs/closed-beta/CLOSED_BETA_PERMISSION_MATRIX.md將tester下載預設關閉、consultant/internalQA有條件、platform support需稽核；當前organization_members只有owner/admin/editor/viewer，現有report SELECT RLS僅表示可讀，沒有匯出角色/assignment映射。前一輪尚未裁定該語意，不可用前端拿掉guard默默改變授權。

## 方案A（建議供CTO裁定，尚未啟用）

本機工程候選先採明確窄政策：新authenticated export-report-snapshot唯讀handler，只允許目前active tenant owner/admin/editor、subscription可寫（沿既有active/grace_period enforcement）、completed且同org/project的保存報告。viewer、無membership、跨租戶、readonly/未知subscription、platform角色本身均拒絕。由server用actor JWT驗證、重新查membership/subscription與report scope，只回欄位allowlist、不生成新內容、不寫報告。此為變更封測下載映射，需CTO確認；不是讓SELECT自動代表可下載。

本機合成測試可先驗formatter、檔案、拒絕/競態；真正UI入口只有server endpoint成功且操作仍屬目前scope才下載。PDF/Word明示未支援，不以alert假成功。部署/雲端不在授權範圍。

## 方案B

保留正式匯出停用，先由Owner/CTO指定tester/consultant/internalQA的assignment來源及稽核責任，再實作細分政策。HTML/JSON formatter及明示合成測試下載可持續；第4項已核准M4不受阻。

影響/回復：A不新增業務表或付款方案、不影響正常讀取；若未核准維持B。若來源候選發現缺陷，關閉export handler/UI並保留保存報告，不重算、不刪資料。任何server端新端點僅本機測試，雲端部署仍需Owner核准。

需裁定：是否接受方案A的角色與訂閱矩陣作為本機工程候選政策？此文件尚不代表核准或已啟用。發布HOLD、UAT7dccd545不變。
