# 真服務驗收準備交付 — 2026-11-07

> 後續狀態（2026-11-07）：CTO四P2與七項邊界已正式裁定並完成本機修復候選；不再等待同一裁定。最新入口為[四P2交付](CTO_P2_INTEGRATION_DELIVERY_20261107.md)及[定向複審入口](CLAUDE_CTO_P2_REVIEW_START_HERE_20261107.md)。下文保留當時固定來源／盤點證據；新候選、未驗項及雲端授權以最新交付為準。

**準備產物已交付；部署仍BLOCKED／發布HOLD。** PR28應用固定ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde、正式UAT仍7dccd545。本輪只新增本機工具、設定草稿、manifest及手冊，未改已裁定應用來源／功能，未合併main。

## 可操作入口與實際結果

| 項目 | 結果／證據 |
|---|---|
| 固定工具 | 原生CLI2.122.1、Deno2.9.8；官方ZIP與解壓binary SHA256核對。[工具／來源manifest](evidence/deployment-preflight-20261107/manifest.json) |
| 原生Deno依賴與打包 | 固定ba2的46個本機source blob、14入口／各自closure及remote resolutions已列；14/14靜態ESM JS＋map實際產出與hash核對，留workspace tooling；frozen lock在打包後未變 |
| **原生Deno型別** | **0/14 PASS，14 FAIL**；SDK宣告與三支handler共九個來源診斷，並非全部第三方問題。[逐function結果](evidence/deployment-preflight-20261107/RESULTS.md)／[具體相容性待辦](DENO_EDGE_COMPATIBILITY_BLOCKERS_20261107.md) |
| Managed Edge／ESZIP | NOT_RUN；bundle仍有node: builtins，不能推論Edge sandbox相容。參考edge-runtime1.78.1／fork deno crate2.1.4與本機工具不同，managed實際版本UNKNOWN |
| Auth／CORS／JWT草稿 | [設定入口](../../deployment/README.md)，精確origin4211（未啟動），現有password登入／精確redirect，14functions gateway verify_jwt=true。未讀或修改既有帳戶設定 |
| 完整CLI config | 在全新本機空資料夾以固定CLI init產生、合併functions/Auth、關auto seed／global signup，再以local function config-load probe通過解析；只產生檔案，未啟動stack／Docker／DB。[完整草稿與證據](../../deployment/uat/config-generation-evidence.json)。PG17是CLI預設，不是目標版本 |
| Migration | [41份固定順序／hash](../../deployment/uat/migrations.manifest.json)，三份歷史fixture純DML另列HOLD／fresh-UAT排除提案；未套雲端、不偽造applied history。NOT VALID另驗 |
| 人工驗收 | [逐案手冊](MANUAL_REAL_SERVICE_ACCEPTANCE_20261107.md)：原生選檔、落盤／hash、A/B/shared/viewer、直接API／Storage、撤權／舊分頁／六種進行中窗口、sameID恢復；全部待實測 |
| 合成選檔fixtures | 實際本機產生740-byte PDF／空檔／無效PDF並核對hash，重跑保留既存同內容檔；不同檔／manifest拒覆寫。[證據](../../deployment/uat/manual-fixture-evidence.json)。不是原生選檔或真實上傳PASS |
| 獨立審閱 | 沿一名實作、一名獨立review；41 migration與ba2 blob逐一核對、fixture hash／界線審閱；兩P3（manifest覆寫、附件download與報告export文字混淆）已修。工具graph target及離線hash另保留實跑結果；不加總或重跑無關產品測試 |

## Windows本機重現

工具位於repo外的同workspace tooling/deployment-20261107；不改PATH或安裝全域。依deployment/README的精確URL／SHA準備兩native工具後，在repo root：

```powershell
node --test backend/tools/deployment-preflight/graph.test.mjs
node backend/tools/deployment-preflight/verify.mjs verify
```

verify只取固定ba2來源、原生version/info/check/bundle，不執行handler／Deno serve、不讀.env、不呼Supabase cloud/login/link/deploy/db命令。當前預期exit2（BLOCKED_OR_PARTIAL），不能將此非零改成PASS；詳細結果在manifest／check-*.txt。此命令可能為未cache的公共依賴解析而連官方程式碼CDN，沒有專案資料；native命令各30秒上限。大型bundle/map/cache都留tooling，repo只留來源工具／lock／脫敏證據。

原生file chooser人工檔案準備：

```powershell
node deployment/uat/prepare-manual-fixtures.mjs
```

輸出tooling/manual-fixtures-20261107；Owner在已核准寫入的隔離UAT手動選檔。Mac可讀同固定manifest／手冊；本輪Windows .exe工具不能宣稱Mac原生已驗，需另核對相應官方asset。

## Supabase唯讀盤點狀態

Owner已授權並完成PC登入，**READONLY_COMPLETE_WITH_SCOPE_LIMITS**。指定專案的metadata／aggregate、方案／用量、schema統計、migration／function清單及backup／branch metadata已唯讀核對；沒有讀業務列、Auth名單、Storage檔案、keys或付款資訊，也沒有任何雲端寫入。

[公開脫敏回執與環境選項](SUPABASE_READONLY_INVENTORY_RECEIPT_20261107.md)已備；精確版本、統計、部署落差與證據URL保留repo外的Owner受限本機報告。既有專案不能證實為安全空白UAT，實際用途／真實資料性質／外部相依仍需Owner分類；部署SHA仍UNKNOWN。備份存在不等於復原已驗。

Cloudflare／Railway不在此次新增授權內。Owner已選獨立Micro UAT並補齊本次累計新增費用額度及14天保留期；精確額度留受限授權回執。WAITING_CTO_PREREQUISITES：先解決CTO／原生相容性阻礙，再按已核准條件建立；尚未建立資源，期限尚未起算。其餘雲端寫入授權未擴大，本次未讀正式內容。

## 下一關與未驗

1. OWNER_BUDGET_RETENTION_RECORDED／WAITING_CTO_PREREQUISITES：已選獨立Micro UAT，預算與14天期限已提供，不重問；先處理下列CTO／相容性前置。實際建立時才記起訖時間與target ref，不動既有main、不自動續期或刪除，不把費用額度誤稱平台硬性限額。
2. WAITING_CTO：採用前先處理[原生Deno相容性缺口](DENO_EDGE_COMPATIBILITY_BLOCKERS_20261107.md)，對相關依賴與三支handler邊界作最小修正、另固定新候選SHA；不修改本輪ba2來混淆版本。
3. CLAUDE_RECEIVED／WAITING_CTO：遠端507a94e的[回覆原文](CLAUDE_INTEGRATION_REVIEW_REPLY_20261107.md)已保留合入，見[收件摘要](CLAUDE_REVIEW_RECEIPT_20261107.md)。沿[固定入口9839e1f](https://github.com/juliushsu/CoCalLab/blob/9839e1f5ab6ab21f0e81975b1d43ff447cf692f7/docs/delivery/CLAUDE_INTEGRATION_REVIEW_START_HERE_20261107.md)，區分歷史與ba2整合版本；回覆沒有重跑測試；四類P2為審查者評級，尚待CTO裁定，不推定放行或重開整案。
4. NOT_RUN：真JWT／PostgREST／Storage／Deno Edge、原生選檔與落盤、兩獨立PG連線、live migration／NOT VALID資料驗證、備份復原及19+1代表使用者驗收。原生chooser權限阻礙沿用，不擅自擴權／重試Docker/WSL。

前一輪FE221／backend27／SQL308 PASS+2 NOT_RUN及CI是既有來源證據，本輪沒有重跑或與新preflight加總；它們不能抵銷此次原生Deno失敗。即使一般CI通過，部署仍BLOCKED／發布HOLD。

補充：工具／文件固定142dba990537b0750d1b7f4d82a415ade0def848的GitHub Verify已實際success；未重跑產品測試、未將CI抵銷原生Deno失敗。此回執更新只改文件與授權註記，不改應用ba2。
