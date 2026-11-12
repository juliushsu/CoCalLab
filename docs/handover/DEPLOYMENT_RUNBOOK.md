# Deployment runbook — public procedure
日期：2026-10-31。此文件是公開 source 的接手與未來 release 程序；即時資源登錄、環境設定、migration parity 與安全結果只在 owner 受限 packet。**H0 未部署、未改雲端、未執行 migration/seed。**

Owner 已確認目前無正式網址，只有 Readdy 沙盒與 [臨時入口](https://afyfvg.readdy.co)。公開 source／temporary site 的存在都不能作 production-ready 證明。Cloudflare、Railway、Supabase 與其他帳號的資源對應及操作權由 owner 私下交接，禁止猜測或將 credential 放本 repo。

## Source environment names（只有公開程式中的名稱）
| Names | Source usage |
| --- | --- |
| VITE_PUBLIC_SUPABASE_URL / VITE_PUBLIC_SUPABASE_ANON_KEY | frontend client config；絕不能填 server secret |
| VITE_APP_ENV | frontend staging UI switch；不是資料隔離保證 |
| SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY | Edge service/request clients；service role 僅 server |
| APP_ENV / ENV | staging guard；預設 staging |
| OCR_PROVIDER / LLM_PROVIDER | provider choice；source 只有 mock adapter |
| BASE_PATH / IS_PREVIEW | Vite compile config |
| PROJECT_ID / VERSION_ID / READDY_AI_DOMAIN | Readdy compile metadata |

以上不表示任何目標環境已設定這些名稱或值。Credential 應由 owner 指定 secret manager；不貼到 public PR。任何部署前先核對目標環境、資源 owner、bundle 與資料政策。

## PC local baseline
```sh
git clone https://github.com/juliushsu/CoCalLab.git
cd CoCalLab
git fetch origin
git switch codex/handover-pc-agent-20261031
git rev-parse HEAD
git status --short --branch
cd backend
npm test
node --experimental-test-coverage --test tests/core-services.test.js tests/provider-adapters.test.js
cd ../frontend/readdy-app
npm ci
npm run type-check
npm run build
npm run lint
```
本次 Mac Node 25.8.1/npm 11.11.0；frontend type/build 使用既有 lock-matching dependencies 的隔離副本，沒有 fresh npm ci。PC 需自行重現、留下版本與 log。已知 lint 15 warnings 會因 max-warnings=0 失敗；不得把此結果列 PASS。

## Future staging and release procedure（需後續授權）
1. 接收 owner 受限資源／安全 packet，確認指定的隔離 staging，保留現有資料與工作。
2. 比對 public source、Readdy export/version 與目標環境 schema/function/config；不因 source migration 存在就推論已 applied。
3. 本機拋棄式 DB 審 migration 全鏈及 fixture/purge/delete；設計相容升級與還原，不一鍵 replay 到共用環境。
4. 先修 HTTP/DTO/unit、真實 empty/error state、持久化交易與 tenant permissions；獨立修復 PR。
5. 獲授權的隔離 staging 才做 JWT/CORS/role/storage、重試／並行、report snapshot、real provider tests。
6. 完成採購閉環與合作公司需求；輸出完整 acceptance 證據，不能以碳盤查 demo 取代採購交付。
7. 建立可追溯 artifact/SHA、schema diff、secret owner、環境對應、monitoring、成本限制、support 及 backup restore 證據。
8. 提供 release manifest：目標、變更、測試、風險、回滾、RPO/RTO、排程與 sign-off。
9. **owner 明確核准該正式 release 後**，由後續執行者操作。H0 不包含這一步。

## Rollback / operations
保留前版 frontend artifact/Edge bundle 與設定版本；資料庫用相容擴充、備份／還原演練或 forward fix，不用 destructive down migration/purge 當 rollback。監測 auth/tenant deny、function errors、provider latency/cost、report partial failures、storage orphan 與 backup；log 不記 credential 或敏感附件。商用環境與正式網址未定前不得宣稱 SLA 或正式上線。
