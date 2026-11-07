# Supabase 唯讀盤點回執 — 2026-11-07

> 後續狀態（2026-11-07）：CTO四P2與七項邊界已正式裁定並完成本機修復候選；不再等待同一裁定。最新入口為[四P2交付](CTO_P2_INTEGRATION_DELIVERY_20261107.md)及[定向複審入口](CLAUDE_CTO_P2_REVIEW_START_HERE_20261107.md)。下文保留當時固定來源／盤點證據；新候選、未驗項及雲端授權以最新交付為準。

**READONLY_COMPLETE_WITH_SCOPE_LIMITS；RELEASE HOLD；WAITING_CTO_PREREQUISITES。** Owner授權並自行完成PC登入後，已核對指定CoCalLab的metadata與aggregate。應用固定ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde，正式UAT仍7dccd5452152f2495d10ad1437d5d03215166065；沒有部署或合併。此公開版不包含精確live DB／安全／用量細節。

| 分類 | 結果與證據取得方式 |
|---|---|
| VERIFIED | 專案身分／region／方案、平台服務版本、期間aggregate用量、public資料表estimated count、可見migration history／Functions、backup與branch metadata已在Dashboard觀察。精確值、UTC時間、各頁URL保留Owner受限本機報告及原始JSON；名稱／history不代表內容checksum一致 |
| UNVERIFIED | 業務用途、資料是否真實或fixture、總Auth使用者數、完整RLS／trigger內容、部署SHA、現有Readdy／其他外部呼叫方、managed runtime／實際JWT設定。未以MAU當總使用者，未以四捨五入0GB當空資料 |
| MISSING_IN_VISIBLE_LIST | 來源固定清單與live可見migration／Function名稱有落差，逐項列在受限比較JSON；這不等於完整schema或對應服務一定不存在 |
| BLOCKED | 既有專案不能證實為安全空白UAT；恢復正確性／Storage原件復原未驗；原生Deno14FAIL及真服務／兩獨立SQL／原生選檔下載仍未關閉 |
| OWNER_ACTION_REQUIRED | 現有用途／相依仍未分類；Owner其後已選獨立Micro UAT並補齊累計費用額度及保留期，詳下。migration／bucket／合成帳號／上傳／撤權及專用備份還原仍沿用各自操作核准界線 |

## 具體可選路徑（尚未執行）

Owner於2026-11-07已選同一付費組織另建獨立Micro UAT，並補齊本次累計新增費用額度及14天保留期限；不是每月循環預算。**OWNER_BUDGET_RETENTION_RECORDED／WAITING_CTO_PREREQUISITES**：精確費用額度與原文留repo外受限OWNER_UAT_BUDGET_AUTHORIZATION_20261107.json，不公開財務授權值、不重問同一授權。期限從實際建立時間起算，created_at／expires_at／target ref仍空，尚未建立資源或啟動計費。沿已約定順序先處理CTO與原生相容性阻礙；平台硬性限額未驗證，不假稱有自動監控或保證封頂。既有main保持原樣，不自動續期，到期刪除仍未授權；其餘migration／bucket／帳號／上傳／撤權／還原界線沿用。

| 選項 | 增量估算與條件 |
|---|---|
| 沿用既有main | 不新增compute的理論增量0；流量／資料仍可能增加費用。因用途、真資料及外部相依未明，目前不建議寫入驗收。需Owner完成分類、明確核准受影響範圍與復原方案 |
| 同一付費組織新建獨立Micro UAT（工程建議） | 官方額外專案約US$10/月compute、按時數；disk／egress／Storage超額另計，不假定可用credit。不另開付費組織或加購PITR／domain／IPv4；專案／Auth／bucket／credentials獨立，僅合成資料；既有main保留。此路徑及預算／期限已由Owner確認，待CTO／相容性前置後執行 |
| 建無資料preview／persistent branch | Micro起US$0.01344/hour，168h約US$2.26、730h約US$9.81，另計用量。Branch compute不適用compute credit且不受Spend Cap保護。預設不複製資料／Storage原件，但會繼承部分設定與既有Functions；Dashboard branch由基底migration history建schema，不會自動取得本候選完整來源。Include data／真資料seed禁用；不接自動production merge/deploy |

價格核對2026-11-07：[官方多專案計費](https://supabase.com/docs/guides/platform/billing-faq)、[branch費率與界線](https://supabase.com/docs/guides/platform/manage-your-usage/branching)、[branch建立內容](https://supabase.com/docs/guides/deployment/branching)。以上是公開費率估算，不是帳戶實際帳單、稅後報價或消費上限；未讀卡號／發票／付款內容。

## 受限回執與核准後操作包

Owner報告檔名OWNER_SUPABASE_READONLY_REPORT_20261107.md，與SUPABASE_READONLY_OBSERVATIONS.json、SOURCE_LIVE_METADATA_COMPARISON.json及SHA256.json位於此PC的repo／OneDrive以外受限暫存資料夾。明確ACL僅Owner、Codex執行帳戶與SYSTEM／Administrators；取得本機可點連結由本輪聊天交付，不將live精確值貼Git。尚無跨Mac共享位置，未上傳第三方；TEMP有清理風險，Owner需保留時另選受限目的地。

核准後才確認新UAT唯一ref與target allowlist，固定經CTO裁定的可驗收SHA，確認41來源／38schema候選＋3歷史fixture HOLD的history方案，逐項套migration、驗NOT VALID、設私有bucket、Auth redirects/CORS/JWT、合成A/B/shared/viewer並跑手冊。憑證留受限未追蹤位置；只對明確專用UAT做DB與合成Storage bytes備份／reset／restore／hash核對，不碰既有main，不宣稱跨服務原子復原。路徑及預算／期限已收件；其餘操作核准界線未擴大，上述流程均尚未執行。

## 驗證與下一條命令

本次只作Dashboard唯讀觀察與來源清單離線比對，沒有新增產品測試通過數、沒有Cloudflare／Railway新盤點。既有工具／文件固定142dba990537b0750d1b7f4d82a415ade0def848的Verify CI已success；原生Deno0/14 PASS、14FAIL仍有效，不能互抵。Claude四類P2見[收件摘要](CLAUDE_REVIEW_RECEIPT_20261107.md)，仍WAITING_CTO。

下一條不依賴雲端的重現命令（repo root）：

```powershell
node backend/tools/deployment-preflight/verify.mjs verify
```

當前預期exit2=BLOCKED_OR_PARTIAL；無需為增加數字重跑。其他交接與人工步驟見[真服務準備交付](REAL_SERVICE_PREPARATION_DELIVERY_20261107.md)及NEXT_ACTION.md。
