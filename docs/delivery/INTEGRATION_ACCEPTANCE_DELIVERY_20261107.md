# 整合候選交付 — 2026-11-07

**SOURCE_DONE_LOCAL／SYNTHETIC_INTEGRATION_PASS；發布HOLD。** 正式UAT基準仍7dccd5452152f2495d10ad1437d5d03215166065。未合併main、部署雲端、操作正式資料或新增費用；不是商用放行。

## 固定版本與保留

分支 `codex/integration-acceptance-20261107`；最終程式 **ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde**（6974e182518ade7ffed9aa9db53ca1e364380dbf為report核心；ba2c僅補專屬預覽CORS與回歸）。[PR21–27基線](INTEGRATION_CANDIDATE_BASELINE_20261107.md)已逐邊核對；初始e565為完整祖先鏈。原29路由／選單保留，MANUAL另增一路共30；本輪未刪減功能或引入中央平台。原ZIP、未提交工作及既有stash保留。

來源41 migrations、合成本機initializer套38（排除三份fixture）；[完整順序／SHA256](evidence/integration-acceptance-20261107/source-migrations.json)。新增006必在001–005之後。這不是雲端applied清單；NOT VALID歷史資料需另驗，未自動修改。

## 報告保存完整性

修前RED已重現普通editor直接INSERT completed、改payload／hash／來源／狀態及DELETE；只有非空payload_hash的legacy row亦可200匯出。新增006：

- 普通角色report INSERT／UPDATE／DELETE由restrictive policies與trigger拒絕，另加寬permissive policy及關RLS負例仍拒。SELECT仍按tenant RLS保留。
- 合法v2的INSERT、snapshot patch、request/audit及最終marker在同交易完成後，owner-only private authority封存完整DB JSONB row（UTC）。不以audit、client GUC、metadata或public marker代替權威。
- v2重送／lookup與service-only `read_verified_report_snapshot` 都fresh核對active組織、project、actor、最新可寫訂閱及完整row／request綁定。handler保存後與匯出均使用verified read。
- 既有row保留 `legacy_unverified` 可讀，缺authority回409 UNVERIFIED；維護改寫、刪row／request、marker／內容不一致回409 INTEGRITY_MISMATCH，不重簽或建替代report。private request不被public cascade刪除抹去。
- `server_verified`只表示新publisher的完整保存row與私有證據一致；不證明碳資料、係數、計算或原件業務真實性，不重設所有activity/calc/factor權限與輸入新鮮度。raw SELECT／marker本身不是verified read。
- UI舊資料明示歷史檢視／不可匯出；新資料每次由server重查。補舊生成回覆的auth/scope/unmount fence，generation不受export preflight刷新干擾；不宣稱真React競態已測。

## 租戶／撤權整合

新增一份串接實際handler／SDK／SQL的測試，非新安全框架：

| 情境 | 實際合成結果 |
|---|---|
| A-only／B-only ID、mixed org/project、API讀寫、私有附件／匯出 | 異租戶拒；raw DELETE可能回成功空陣列，另由真正owner重讀bytes證明未刪，不能只看HTTP成功 |
| shared A owner／B viewer；A viewer | 同tenant允許合法read；viewer不能verify／export；shared只在A有write/export |
| 初始handler授權後、SQL前撤權 | export、recalc commit、hash complete、delete finalize各拒；無新calc版／假收件／假finalized |
| 明確重授權後恢復 | 原request／document／bytes恢復；重算不重增版，partial刪除繼續，Storage寫入仍1次 |
| A→B→A、同人登出重登、routine refresh | 實際SDK讀完後helper丟棄過期匯出；refresh保留有效epoch；重新登入不恢復已撤tenant權限 |
| 4207新預覽origin | 實際CORS-protected export handler 200＋正確Allow-Origin；不修改正式CORS |

這些是單序列fault interleaving，不是獨立SQL交易並行或真JWT簽章驗收。

## 實跑與審閱

- 前端221/221、backend27/27；type-check、lint、最終build PASS。Vite主bundle502.20kB／Browserslist舊資料為warning，未當效能驗收。
- 完整SQL／HTTP **310 cases＝308 PASS／2 explicit NOT_RUN**，[完整實跑輸出](evidence/integration-acceptance-20261107/sql-http-run.txt)。兩項仍為recalc/delete獨立連線並行；不能加總skip為通過。
- Report target SQL9／HTTP4、tenant3已包含全套。預覽origin小修後tenant3另跑PASS，與全套重疊不加總。完整套件執行期間只新增test-only origin清單；正式006／handlers未改，後補origin正反例獨立驗證。
- 一名backend實作代理＋一名獨立reviewer；獨立讀來源、SQL/HTTP/tenant13與FE13及後增時區／來源保留各1案例實跑，均為重疊或子範圍，**不能累加**。兩項已證P3晚回覆／busy來源修正已複核，本定向範圍目前無未解已證P1/P2；不等於Claude裁定。

## 可操作入口與重現

目前本機 **http://127.0.0.1:4207/login** →API4206；a-owner@product-preview.invalid／synthetic-local-only僅本次合成登入，不能用於真Supabase。API session54957、UI77958，本次建立；重啟清合成資料、換IDs，不動其他預覽或5432。

repo root：

```powershell
$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path
node backend/tools/product-preview/delivery-demo.js --integration-acceptance
```

另終端在frontend/readdy-app：

```powershell
node node_modules/vite/bin/vite.js --config tools/local-preview/vite.acceptance.config.mjs
```

4206／4207被占用時先確認是否本次自己的服務，否則停止並回報，不能殺其他程序。舊preview命令及4204/4205保留。

操作：登入→專案View→Generate Report捷徑（開中心）→報告歷史→View Report。可見50kg／0.05t、十章來源／缺件、完整性提示及可用匯出入口。Chrome實際重載仍保留登入與同report；[截圖](evidence/integration-acceptance-20261107/saved-report.jpg)。

同一實際SDK scenario已完成可信收件→MANUAL轉錄／同人確認→calc v1／generic v2同request重送→保存完整50kg report→授權HTML/JSON實際Node產檔及讀回；引用拒刪、無引用tombstone／hash釋放、另保留可恢復pending。不是Mock OCR：[結果](evidence/integration-acceptance-20261107/actual-integration.json)、[HTML](evidence/integration-acceptance-20261107/actual-saved-report.html)、[JSON](evidence/integration-acceptance-20261107/actual-saved-report.json)。原生瀏覽器存檔未驗。

## 接續狀態

- READY_TO_FORWARD／WAITING_CLAUDE：[單一入口](CLAUDE_INTEGRATION_REVIEW_START_HERE_20261107.md)，五組舊固定SHA保留，新增本輪006定向增補；Codex未聯絡Claude。
- WAITING_CTO：新private report authority／RPC與完整性修正來源裁定；不因本機綠燈關閉外部審查。
- WAITING_OWNER：[隔離環境具體方案](ISOLATED_UAT_EXECUTION_PROPOSAL_20261107.md)，含帳戶分類、版本、migration／bucket、費用、備份reset還原目標及窗口；尚未建資源。
- BLOCKED／NOT_RUN：真Supabase Auth/JWT/Storage/PostgREST/Deno、獨立PG連線lock-wait／競態、live migration／drift、備份／復原generation一致性、原生chooser／存檔、代表使用者及19+1負載。chooser已知extension file URL權限阻礙，不擅自擴權。
- OPEN：Mock OCR／AI、legacy處理重送與未宣稱的商業完整性／輸入可信度；server report seal不代替業務驗收。不為累積PR擴功能，下一里程碑是真隔離環境驗收。
