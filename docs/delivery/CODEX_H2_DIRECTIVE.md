# CTO → Codex：H2 執行指令

日期：2026-10-31。Owner 已指派持續實作與 agent 分工；本文件是當前工作指令，不代表已通過驗收。

## 版本與授權

- 起點：PR #2，`561ec86f0ac7416051f8fab2aa17e5e73b4db4ff`。H0／PR #1 不重做；先檢查 checkout、HEAD、未提交變更並保留既有工作。
- H2 分支：`codex/saas-h2-acceptance-20261031`。PR #2 尚未合併時，H2 PR 以該功能分支為 base，避免重複包入上一批。
- 允許：本機 source 修復、必要測試、全合成隔離 DB、提交功能 PR、獨立審查。
- 未授權：正式資料／權限變更、雲端 migration／seed、付費 provider、發布／流量切換。不得取用不明環境的憑證試連線。

## 分工與立即工作

| Owner | 任務與檔案邊界 | 完成證據 |
| --- | --- | --- |
| CTO／整合代理 | 固定契約、維護本指令、CI、整合與獨立差異審閱 | 各 agent 輸出、實測結果、reviewable PR、未驗範圍 |
| Codex A | AuthProvider／context／AdminLayout、scoped navigation hook、必要 helper/tests | 移除固定 owner 與 unknown→owner 回退；不跨組織借用角色；角色切換／登出失效測試 |
| Codex B | 隔離 project RLS tests、migration 相容性探測 | owner/admin/editor 正向、viewer/inactive/cross-tenant/readonly 拒絕、更新後重讀；精確指出未驗範圍 |
| 獨立 reviewer | 完成後只讀檢查 A/B 差異 | findings 含版本、檔案、觸發方式、影響與最小修復；不重做全案盤點 |

### A：租戶角色必須來自當前 scope

1. 不為登入者賦全域 tenant owner；organization owner/admin 不等於 platform admin。
2. 從明確 organization URL 或已讀取的 project 原 organization 解析 scope，再查當前 user 的 active membership。
3. 無 scope、無 membership、查詢失敗、登出或新 session 時，禁止保留舊高權限；保留可選組織／專案的基本入口。
4. 不以 localStorage／JWT 自稱角色、第一個組織或最高角色替代當前 scope。
5. 防止 org A 的晚回應覆蓋 org B；navigation 只是呈現，server authorization／RLS 仍是資料邊界。

### B：持久化與隔離必須測到真 SQL

1. 使用全新記憶體 PostgreSQL/PGlite、合成 auth subject 與 tenant fixtures；不得載入 `.env` 或資料庫 URL。
2. 測試角色必須不是 table owner/superuser/BYPASSRLS；不能用 service_role 的成功冒充客戶可用。
3. 檢查 project update 原 tenant 與新 tenant 的 USING/WITH CHECK；發現越權先報 CTO，提出最小增量 migration，不改寫歷史 migration 以掩蓋問題。
4. 完整 migration 鏈探測與單項 policy 驗收分開；若引擎不支援 extension 或缺少 Supabase schema，列出精確依賴，不能直接宣稱 production schema 壞掉。
5. 記錄可重現命令、實際 migration 集合、正反例結果；Storage/JWT/Edge/瀏覽器未測就保留 NOT_RUN。

## 節奏、測試與出口

- 每人只改指定範圍；跨檔依賴交 CTO 協調。完成一項接下一個無阻礙項目，不搭建大型 agent／通用框架。
- 已有基線不重做；本批依變更跑 meaningful tests，整合時一次完整 backend/frontend tests、type-check、lint、build、SQL tests。
- 不關規則、不刪測試、不用 fixture 補正式錯誤；新失敗需修正或精確標 blocker。
- 同一阻礙兩次無新證據則停止該路徑，回報最小所需資源，其他工作繼續。
- 回執：branch／HEAD、改動檔案、可用行為、測試命令與結果、未驗範圍、blocker、下一步。有命令結果才能標 RUNNING，有證據才能標 PASS。
- 每回合保存 checkpoint；不承諾對話結束後代理仍會執行。

## 後續商品化隊列

H2 後續按證據推進：真實文件→人工確認→計算→報告持久化、報告可開啟匯出、代表使用者驗收、復原／監控／部署候選。採購最小流程、驗收人、顧問跨企業權限仍待明確定案；AI provider／預算／資料外送需 Owner 決策。這些只阻擋依賴它們的工作，不阻擋本批權限修復。

涉及新的跨租戶權限或核心資料模型，完成具體修復 PR 後，交 Owner 引入 Claude 作獨立紅隊：固定 commit，只讀檢查權限升格、scope 混用、失敗與舊請求污染、測試是否過度聲稱。Claude 意見需附 source-level evidence，由 CTO 裁定；內部 Codex reviewer 不冒稱 Claude。

上架出口：自動檢查、隔離安全驗證、真實業務 E2E、資料正確性／復原及代表使用者驗收全具證據，再附版本、成本、rollback 供 Owner 核准正式發布。

## 本輪 checkpoint

- A/B 已取得命令結果並完成實作；使用者角色來自當前 scope membership，AuthContext 不再賦固定 owner。
- 真 SQL 重現舊 projects policy 允許雙租戶 owner 移動 project；新增 `202610310002_project_identity_guard.sql` 禁止一般使用者修改 project id／organization_id，未更動其他既有 policy/grant 權限。
- 兩組隔離 RLS 測試合計 28/28（含兩個 test containers）通過；並非整套 Supabase tenancy 驗收。
- migration cold-start diagnostic 前 15 份成功，第 16 份 `202603180005_v1_staging_storage_isolation.sql` 因缺 `storage.buckets` 停止。這是本機引擎與 Supabase schema 的依賴邊界，完整 migration 鏈仍 NOT_RUN/未完成；不得外推正式環境錯誤或已通過。
- 獨立 reviewer 指出的登出／重登入晚回應與相同 URL 回訪角色快取問題納入修復及回歸測試。
- React／瀏覽器登入 E2E、實際JWT、Storage、privileged RPC及正式環境均未驗；新 migration 未部署。

### 給 Claude 的只讀紅隊任務

Owner 可將 H2 PR 的最新完整 commit 交給 Claude。固定該版本、不使用正式憑證、不操作雲端，請回答：

1. 是否可藉 scope alias、project/org 不一致、租戶 admin、未知角色或登出／expiry 升格為其他租戶／platform 權限？
2. A→B→A 回訪、登出再登入失敗、舊 refresh／查詢回應是否能恢復過期角色？
3. project identity guard 是否可由一般使用者以 role/JWT 偽裝或直接 API 繞過？是否破壞既有合法 profile 更新？
4. 測試是否真的使用非 BYPASSRLS 角色？有哪些證據只能算 helper／隔離 SQL，不能宣稱 browser/Supabase E2E？

每項 finding 必須附路徑、固定版本、觸發條件與實際影響。沒有證據的改架構建議另列 proposal，不因此擴大本批。此處是審查指令，**尚未由 Claude 審查**。
