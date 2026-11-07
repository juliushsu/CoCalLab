# Supabase 唯讀盤點回執 — 2026-11-07

**READONLY_COMPLETE_WITH_SCOPE_LIMITS；RELEASE HOLD；WAITING_OWNER。** Owner授權並自行完成PC登入後，已核對指定CoCalLab的metadata與aggregate。應用固定ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde，正式UAT仍7dccd5452152f2495d10ad1437d5d03215166065；沒有部署或合併。此公開版不包含精確live DB／安全／用量細節。

| 分類 | 結果與證據取得方式 |
|---|---|
| VERIFIED | 專案身分／region／方案、平台服務版本、期間aggregate用量、public資料表estimated count、可見migration history／Functions、backup與branch metadata已在Dashboard觀察。精確值、UTC時間、各頁URL保留Owner受限本機報告及原始JSON；名稱／history不代表內容checksum一致 |
| UNVERIFIED | 業務用途、資料是否真實或fixture、總Auth使用者數、完整RLS／trigger內容、部署SHA、現有Readdy／其他外部呼叫方、managed runtime／實際JWT設定。未以MAU當總使用者，未以四捨五入0GB當空資料 |
| MISSING_IN_VISIBLE_LIST | 來源固定清單與live可見migration／Function名稱有落差，逐項列在受限比較JSON；這不等於完整schema或對應服務一定不存在 |
| BLOCKED | 既有專案不能證實為安全空白UAT；恢復正確性／Storage原件復原未驗；原生Deno14FAIL及真服務／兩獨立SQL／原生選檔下載仍未關閉 |
| OWNER_ACTION_REQUIRED | 確認現有用途／相依；選擇測試環境並核准具體費用、資源建立、migration／bucket／合成帳號／上傳／撤權及專用備份還原範圍。本次唯讀授權未包含 |

## 具體可選路徑（尚未執行）

Owner於2026-11-07已選「同一付費組織另建獨立Micro UAT」，保留既有main。**PATH_SELECTED／WAITING_OWNER_BUDGET_AND_RETENTION**：回覆尚未包含預算或保留期限，已請Owner補充；不把選項中的「請填預算／期限」視為已提供數值。尚未建立資源或啟動計費，target ref仍UNKNOWN；到期刪除亦未授權。CTO／原生相容性阻礙與其餘雲端操作核准界線沿用。

| 選項 | 增量估算與條件 |
|---|---|
| 沿用既有main | 不新增compute的理論增量0；流量／資料仍可能增加費用。因用途、真資料及外部相依未明，目前不建議寫入驗收。需Owner完成分類、明確核准受影響範圍與復原方案 |
| 同一付費組織新建獨立Micro UAT（工程建議） | 官方額外專案約US$10/月compute、按時數；disk／egress／Storage超額另計，不假定可用credit。不另開付費組織或加購PITR／domain／IPv4；專案／Auth／bucket／credentials獨立，僅合成資料；既有main保留。這是待核准提案 |
| 建無資料preview／persistent branch | Micro起US$0.01344/hour，168h約US$2.26、730h約US$9.81，另計用量。Branch compute不適用compute credit且不受Spend Cap保護。預設不複製資料／Storage原件，但會繼承部分設定與既有Functions；Dashboard branch由基底migration history建schema，不會自動取得本候選完整來源。Include data／真資料seed禁用；不接自動production merge/deploy |

價格核對2026-11-07：[官方多專案計費](https://supabase.com/docs/guides/platform/billing-faq)、[branch費率與界線](https://supabase.com/docs/guides/platform/manage-your-usage/branching)、[branch建立內容](https://supabase.com/docs/guides/deployment/branching)。以上是公開費率估算，不是帳戶實際帳單、稅後報價或消費上限；未讀卡號／發票／付款內容。

## 受限回執與核准後操作包

Owner報告檔名OWNER_SUPABASE_READONLY_REPORT_20261107.md，與SUPABASE_READONLY_OBSERVATIONS.json、SOURCE_LIVE_METADATA_COMPARISON.json及SHA256.json位於此PC的repo／OneDrive以外受限暫存資料夾。明確ACL僅Owner、Codex執行帳戶與SYSTEM／Administrators；取得本機可點連結由本輪聊天交付，不將live精確值貼Git。尚無跨Mac共享位置，未上傳第三方；TEMP有清理風險，Owner需保留時另選受限目的地。

核准後才確認新UAT唯一ref與target allowlist，固定經CTO裁定的可驗收SHA，確認41來源／38schema候選＋3歷史fixture HOLD的history方案，逐項套migration、驗NOT VALID、設私有bucket、Auth redirects/CORS/JWT、合成A/B/shared/viewer並跑手冊。憑證留受限未追蹤位置；只對明確專用UAT做DB與合成Storage bytes備份／reset／restore／hash核對，不碰既有main，不宣稱跨服務原子復原。這些均未授權或執行。

## 驗證與下一條命令

本次只作Dashboard唯讀觀察與來源清單離線比對，沒有新增產品測試通過數、沒有Cloudflare／Railway新盤點。既有工具／文件固定142dba990537b0750d1b7f4d82a415ade0def848的Verify CI已success；原生Deno0/14 PASS、14FAIL仍有效，不能互抵。Claude四類P2見[收件摘要](CLAUDE_REVIEW_RECEIPT_20261107.md)，仍WAITING_CTO。

下一條不依賴雲端的重現命令（repo root）：

```powershell
node backend/tools/deployment-preflight/verify.mjs verify
```

當前預期exit2=BLOCKED_OR_PARTIAL；無需為增加數字重跑。其他交接與人工步驟見[真服務準備交付](REAL_SERVICE_PREPARATION_DELIVERY_20261107.md)及NEXT_ACTION.md。
