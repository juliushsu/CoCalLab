# UAT watchdog 來源交付 — 2026-11-09

Owner 已核准固定 ca081cc 的方案 A 及受限核准包；不再等待同一方案決策。備份由 Owner 接收，交付位置另已確認。main 維運 workflow 仍要獨立固定差異核准，未合併／啟用，尚無新計費資源。產品候選 fd7efcfc6450dbf10f54aa97b65fe48e431b277d 不變，發布 HOLD。

## 已可操作的行為

```powershell
node --test deployment/uat/lifecycle/railway-watchdog.test.mjs
node --test deployment/uat/lifecycle/render-watchdog-workflow.test.mjs
node deployment/uat/lifecycle/railway-watchdog.mjs
```

預設最後一條回報 `DISABLED_NOT_ARMED`／0 provider reads，明示未啟用。授權配置完成後，程式只向固定 Railway GraphQL endpoint 發送兩組只讀 query；先核 project-token 的 project/environment IDs 與已批准名稱，再核 service 與最近 cron executions。

使用 [官方 project-token header](https://docs.railway.com/integrations/api) 與 [CLI cron execution query](https://github.com/railwayapp/cli/blob/master/src/gql/queries/strings/DeploymentInstanceExecutions.graphql)；**deployment SUCCESS 不是 cron EXITED**。程式不取 variables、logs、deploymentMeta、備份或 Supabase，亦不含 mutations。

實際失敗、SKIPPED、停滯、未知狀態、錯 scope、缺完成時間、過長執行、無最近成功、未來時鐘或 provider 錯誤都回 nonzero。只輸出固定去敏代碼，不列 token、IDs、原始 response／error。redirect 禁止、每次讀取有 timeout 與256KiB上限。T0之前或14天＋2小時的有限只讀觀察窗結束後不讀provider並要求Owner處置；不自行延長資源保留，不把觀察窗結束當作UAT已刪。

這只證明程序執行情形，**不證明 DB／Storage 備份有效、刪除完成或 UAT 通過**。相應驗證仍由主執行器及後續真環境驗收負責。

## main 固定差異契約

render-watchdog-workflow.mjs 只接受40位固定source SHA，輸出一個待送 main 的 workflow。checkout/setup-node都釘完整commit，checkout僅固定Ops版本、無persist credentials，不安裝產品依賴。secrets只傳給observer那一步，採獨立欄位，不使用JSON secret。

watchdog只接受main、同repo、明確enable才執行，排程UTC41分；沒有PR觸發。手動notification-failure-probe為明示合成失敗、完全不讀secret／provider，用於Owner核准後驗收原生failed-email。實際main變更只含這一個workflow，產品、migration、前端、DNS、Readdy均不在main差異中。

## 實測與未驗

- watchdog **23/23**：合成scope/cron正反例、去敏錯誤、實際loopback HTTP header/body、拒絕redirect及timeout。
- workflow契約 **3/3**，另以既有js-yaml實際parse，確認main／activation／固定SHA／權限與secret隔離。
- [實際TAP與來源hash回執](evidence/uat-watchdog-20261109/RUNTIME_RECEIPT.json)。這兩組不同範圍不與既有17項dry-run或10次Windows probe加總。
- 真Railway API／scoped credential／原生排程／email送達、完整備份／還原、主執行刪除與native並行均 **NOT_RUN**；未取得新ref／T0，不使用企業資料或既有服務試寫。
