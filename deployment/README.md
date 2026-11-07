# 固定候選部署前置 — 本機準備，非部署授權

應用固定 **ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde**，PR28；正式UAT基準仍7dccd545。此目錄只提供可審閱設定與migration inventory，不連結project、不部署、不執行migration/seed/reset。後續文件／工具提交不改應用固定版本。

## 工具與產物

| 項目 | 固定值與來源 | 證據界線 |
|---|---|---|
| Supabase CLI | [2.122.1 maintenance v2](https://github.com/supabase/cli/releases/tag/v2.122.1)，Windows zip SHA256 254d141398da58b9acd273ff3f98c69b3efc89a077946715b1e4f7c22d4b0b99 | 避免直接跨到未驗的v3；CLI僅本機version/help／空資料夾init與local function config-load probe／打包準備，不login/link/list/deploy/db命令 |
| Deno CLI | [2.9.8](https://github.com/denoland/deno/releases/tag/v2.9.8)，Windows zip SHA256 cba84b26e0df5ae7f74fc66b86a95b866872a86292ebd84fa1e959927edd93bf | 只info/check/bundle；不得執行真business handler或以此當managed Edge實跑 |
| 參考Edge runtime | [1.78.1](https://github.com/supabase/edge-runtime/releases/tag/v1.78.1) | [deno/Cargo.toml](https://github.com/supabase/edge-runtime/blob/v1.78.1/deno/Cargo.toml)的fork crate標示2.1.4，與工具2.9.8不同；未啟動container，managed實際版本UNKNOWN，不能由本地CLI pin代替 |
| SDK | 前端lock SDK2.57.4；Edge shared URL精確2.49.4；create-organization仍@2浮動 | Node shim過往替換SDK不能證明Deno圖。以實際解析lock／bundle hash記錄；無法凍結時明列BLOCKED |

工具在repo外、同workspace的tooling/deployment-20261107；不改系統PATH／global、不重試Docker/WSL。cache和大bundle不進Git；產物manifest與精確lock／檢查結果見docs/delivery/evidence/deployment-preflight-20261107。**JS bundle不等於Supabase deploy ESZIP或managed執行相容性**；不打包成功就假稱雲端可部署。

## 設定樣板

- [settings.example.json](uat/settings.example.json)：planned本機真服務origin4211（未啟動），target ref尚未選；Owner對既有Supabase只授權唯讀盤點。
- [supabase.config.toml.example](uat/supabase.config.toml.example)是function/Auth設定片段；另已用固定CLI在全新本機空資料夾產生[完整config草稿](uat/full-config.cli-2.122.1.toml.example)，合併此片段、停用auto seed與signup，通過CLI local function config-load probe。[產生與parser證據](uat/config-generation-evidence.json)。未啟動stack／DB或連remote。DB major_version=17只是CLI預設，不是目標PG已驗；不能直接拿此值覆寫既有專案。
- Auth Site URL計畫為http://127.0.0.1:4211，additional redirect只列精確/login。現程式password登入→/admin/projects，未有OAuth／magic-link／重設callback驗收；不捏造/auth/callback。[Auth官方說明](https://supabase.com/docs/guides/auth/redirect-urls)。
- CORS_ALLOWED_ORIGINS計畫為http://127.0.0.1:4211；真正核准UAT domain後再明列exact origin，無path／尾斜線／wildcard。原source預設只允許5173/5174，4207是合成preview，不能直接當真服務設定。CORS OPTIONS204只證預檢，不證JWT／tenant授權。
- 全部function gateway verify_jwt=true；不因401停用。不把anon/publishable API key當user JWT；呼叫仍須真user Authorization→getUser→membership／SQL fresh scope。現有key model、簽章演算法與gateway支援須授權後讀metadata及真UAT驗證；不將未驗相容性解為可開false。[官方headers](https://supabase.com/docs/guides/functions/auth-headers)／[設定](https://supabase.com/docs/guides/functions/function-configuration)。
- server APP_ENV=staging、REPORT_EXPORT_POLICY=tenant_write_v1；server-only SUPABASE_URL／ANON_KEY／SERVICE_ROLE_KEY不寫值。前端只VITE_PUBLIC_SUPABASE_URL與VITE_PUBLIC_SUPABASE_ANON_KEY，不能把service key放Vite。部署時設定key需另有授權，唯讀盤點不讀key。
- template的三個Mock功能僅列enabled=false作UAT啟用提案，來源與路由全保留；這不是關掉既有服務的操作授權。實際切換／縮減若影響既有入口須CTO裁定。完整MANUAL真流程優先，不能把Mock OCR/AI當真驗收。
- 任一function是否可部署／caller權限須沿其source與既有裁定，不把verify_jwt=true宣稱所有handler皆已tenant review。尤其唯讀盤點不能開啟可能呼叫enforce-subscription-status寫audit／變狀態的應用頁；只用管理儀表板metadata。

## Migration與環境辨識

[migrations.manifest.json](uat/migrations.manifest.json)鎖定41來源檔名／順序／SHA256。三份歷史fixture純DML另列HOLD，fresh UAT提案只套38份schema/governance後再明示合成seed；尚未執行或批准。既有專案不能套用「排除fixture」捷徑、不能repair/squash/history標記假已套用，必先與live applied對照。NOT VALID約束需獨立列catalog及資料驗證，成功套用不等於通過。

Owner尚未選UAT環境。wynqnvidepzzcwutexvn僅既有候選ref，不能因已付費或active就認定可寫。已授權唯讀盤點等待Owner登入；不讀業務列／Auth使用者列表／Storage內容／keys或改任何設定。[唯讀範圍](../docs/delivery/EXISTING_RESOURCE_READONLY_SCOPE_20261107.md)。

## 驗收入口與下一步

[人工驗收手冊](../docs/delivery/MANUAL_REAL_SERVICE_ACCEPTANCE_20261107.md)列角色、原生選檔、實際下載落盤、A/B/shared切換、撤權、舊分頁、六種進行中窗口及每案證據模板。PDF正例／空檔／無效PDF可用node deployment/uat/prepare-manual-fixtures.mjs本機生成，僅待人工選檔，不代表上傳成功。

[Claude固定入口9839e1f](https://github.com/juliushsu/CoCalLab/blob/9839e1f5ab6ab21f0e81975b1d43ff447cf692f7/docs/delivery/CLAUDE_INTEGRATION_REVIEW_START_HERE_20261107.md)維持不變；已收到遠端507a94e回覆，[收件／待裁定](../docs/delivery/CLAUDE_REVIEW_RECEIPT_20261107.md)區分歷史與整合版本，不重開整案。不以CLI檢查／bundle／文件完備解除發布HOLD。

後續：核對本機工具結果→Owner登入後唯讀分類→Owner另裁定具體UAT target/費用/寫入範圍→環境回執→真服務驗收。尚未核准前，雲端部署／migration／bucket／帳號／真實上傳／撤權／備份reset還原全部NOT_RUN。
