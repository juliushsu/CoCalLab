# Claude 定向唯讀審查：報告 request ledger／privileged RPC

狀態：**待 CTO 裁定／待外部審查；發布 HOLD。** 本文件可直接交付審閱，不代表已通知 Claude、已取得裁定、已合併或已部署。

## 固定版本及唯一安全設計問題

- Repository：`juliushsu/CoCalLab`
- 唯一受審程式版本：`18c0894cf9da42eb341ce5835ba36fdc3a7bedc9`（M1 候選）。
- 請使用固定 SHA，不改用目前 branch HEAD。後續 M2 預覽／導覽變更不屬本次。

**一般會員能否利用既有可寫資料表或直接 API，偽造／改變新 ledger 的權威 request 綁定，或使兩支 privileged RPC 回傳不屬於目前 organization／project／actor／version／claim 的報告？**

僅審下列差異及理解它們所必需的既有授權契約，不重做 H0、Storage、登入、整案 RLS 或商業功能稽核。既有審查結論沿用；只有與本次差異有直接因果關係的新證據才列 finding。

## 固定來源

| 範圍 | 固定來源及重點位置 |
|---|---|
| 新 ledger、產生與查回 RPC | [202611060001_report_snapshot_atomic_v2.sql](https://github.com/juliushsu/CoCalLab/blob/18c0894cf9da42eb341ce5835ba36fdc3a7bedc9/backend/supabase/migrations/202611060001_report_snapshot_atomic_v2.sql)：2–13 ledger／ACL／RLS；17–66 `generate_report_snapshot_atomic_v2`；69–85 `report_snapshot_request_v2` |
| 正式報告 handler | [generate-report/index.ts](https://github.com/juliushsu/CoCalLab/blob/18c0894cf9da42eb341ce5835ba36fdc3a7bedc9/backend/supabase/functions/generate-report/index.ts)：42 actor 授權；44–81 subscription／project；83–88 早期 request lookup；137 payload 建立；217–250 RPC／保存重讀；272–289 回覆保存資料 |
| 專用安全回歸 | [report-request-boundary.test.js](https://github.com/juliushsu/CoCalLab/blob/18c0894cf9da42eb341ce5835ba36fdc3a7bedc9/backend/tests/integration/report-request-boundary.test.js)：35 偽造 audit；43 ledger ACL；56 RPC ACL；69 合法保存／重試；84 獨立 RLS 測試；96 intent 衝突；106 rollback；114 錯誤 ledger scope |
| 本機 handler／HTTP 回歸 | [product-preview.test.js](https://github.com/juliushsu/CoCalLab/blob/18c0894cf9da42eb341ce5835ba36fdc3a7bedc9/backend/tests/integration/product-preview.test.js)：91 回覆遺失；155 已保存後新增未計算活動仍可恢復原請求；182 snapshot SQL 失敗完整回滾 |

必要背景僅供查明呼叫邊界：同一 SHA 的 `backend/supabase/functions/_shared/authz.ts`、`backend/src/services/enforce-subscription-readonly.js`、既有 `202603160005_v1_hardening_generate_report_atomic_rpc.sql`，及既有 report／audit policies。測試初始化的 `backend/tools/local-workflow/engine.js`、`backend/tools/product-preview/{runtime,worker}.js` 是替身／SQL harness，不是正式 Auth、JWT、Storage 或部署證據。

## 設計意圖與已知限制

新表是最小 operational request ledger，不是新增報告業務模型：主鍵為 `(organization_id, project_id, request_id)`，保存 actor、version、claim、report ID。啟用 RLS、沒有 client policy，撤銷 PUBLIC／anon／authenticated 的資料表權限，僅授予 service_role SELECT／INSERT。兩支 security-definer RPC 亦只授予 service_role EXECUTE。

正式 handler 必須先完成使用者、組織可寫狀態及 project 所屬核對，再 lookup 已提交的同 request。已存在時回傳保存 row；尚未存在才建立目前 payload。這讓「資料已提交、回覆遺失」可以恢復，即使後來新增了未計算活動；它不允許新報告繞過計算完整性檢查。

產生 RPC 對同 scope／request 取 transaction advisory lock，將既有 v1 RPC 的報告／audit、新 snapshot 欄位、新 ledger 及記錄 audit 放在同一 SQL 交易。重試核對 ledger 與實際 report 的 scope、actor、version、claim，回傳原 report ID。不同 request 撞到既有 project/version 時應明確失敗，不能覆寫或偷換成別人的報告。

**保護對象是 request 綁定；沒有宣稱整張 report_generations 或 payload 已防竄改。** 既有一般角色對 report row 的寫入能力、內容 hash／全報告防竄改屬 M3 OPEN。請核對它是否直接破壞本次 request 安全邊界；不要把已聲明的整表防竄改缺口當成已關閉，也不要因此另開全案稽核。

## 請逐項回答

| ID | 必須回答的具體問題 |
|---|---|
| L1 權限與偽造 | anon／authenticated 是否能直接操作 ledger 或 EXECUTE 任一新 RPC？角色繼承、PUBLIC 權限、security-definer lookup 是否留下繞路？使用者自行寫入 audit 的 action／metadata／entity_id，是否仍能影響 request 的權威綁定？ |
| L2 唯一綁定與 scope | ledger 主鍵與實際 report 的雙重 scope fence 是否足夠？已知另一租戶歷史 report UUID、已失去該租戶會員資格，能否用自己目前租戶的 audit／request 讀回它？ledger 誤指向另一 project／organization 的 report 時是否 fail closed？ |
| L3 actor 與 intent | handler 的 actor 是否來自驗證後身分，而非相信 body 內 actor？目前會員／role／project 核對是否先於早期 lookup？已撤權、viewer、另一 actor、不同 version 或 claim 的重試能否借用舊 request？同使用者的合法恢復能否維持原保存結果？ |
| L4 競態與衝突 | 同一 request 的兩個並行呼叫、不同 request 的相同 project/version，以及 lookup 未命中後另一交易先提交，是否會重複保存、覆寫、錯綁或回覆新的未保存 payload？請區分 SQL 來源推論與實際並行交易證據。 |
| L5 部分失敗與恢復 | snapshot 更新、ledger INSERT、audit INSERT 任一步失敗時，報告及相關寫入是否整體 rollback？RPC 提交後 HTTP 回覆／讀回失敗時，重送是否可取得同一保存 row，且不因目前活動改變而重建另一份報告？ |

## 現有證據及不可擴張的結論

- 修前曾於全合成本機 PGlite 重現：A editor 正常 SELECT 看不到 B 的歷史 report；該 editor 自行 INSERT A audit 指向 B report；舊 audit-based service lookup 卻回傳 B payload。**這是修前反例，不是宣稱固定 SHA 仍有此缺陷。** 固定版測試保留同一攻擊輸入，要求 lookup 回空，合法新保存仍只能產生 A report。
- 固定來源的專用 boundary suite 已由獨立代理編寫並執行 **9/9 PASS**（包含父測試；8 個子測試）；這名代理沒有實作 ledger／handler 核心。不能把它描述為「另一位 reviewer 已審過該代理自己寫的測試」。
- 固定來源的 product HTTP suite 已由該獨立代理執行 **8/8 PASS**。使用 installed SDK、實際 checked-in handler 及 SQL；Auth HTTP、JWT 身分和部分 transport 是合成替身，非真 Supabase E2E。
- 專用 boundary test 除驗 client table ACL 外，還在專用記憶體 DB 暫時加入測試 SELECT／INSERT grant，實際驗證 RLS 仍拒絕，並在 finally 撤回。這不是雲端 grant、migration 或授權變更。
- SQL snapshot 失敗的回歸核對 report／ledger／audit 沒有殘留。HTTP 回覆遺失案例核對只有一份 report，並能在新增未計算活動後回復原 request。
- **NOT_RUN**：真 Supabase Auth／JWT／PostgREST／Edge 部署與權限漂移、雲端套用 migration、真獨立連線的並行 SQL 交易、雲端備份／還原。PGlite／替身與單一序列化測試連線不能替代上述驗收。

以上是交付證據，不是 Claude 已獨立重跑。請只聲明你實際閱讀／執行的範圍；沒跑的測試標明未重跑。

## 唯讀邊界與回覆格式

本指令只要求固定版本來源唯讀審查。不要改程式、測試、Git、schema、權限、資料或雲端資源；不要執行 migration／seed／reset／部署／清理，不建立資源或新增費用，不讀取或回報憑證／JWT／金鑰／真實企業資料。不要求執行測試；測試來源可作審閱證據，但不能冒稱執行通過。

請逐項回覆 L1–L5：**來源支持／仍有缺陷／證據不足**，附固定 SHA、檔案與行號、觸發條件、實際影響、最小重現及測試覆蓋／缺口。若有 finding，標明 P1／P2／P3 及最小修正方向；沒有時明示「本定向範圍未發現」，不可寫成全案通過。需要擴大範圍時先說明與本次差異的直接因果關係。

最後單獨列出真服務／並行交易等 NOT_RUN、既有 M3 OPEN 與需 CTO 決策的邊界。**CTO 對新 ledger 尚未裁定；此審查不能批准雲端套用或解除發布 HOLD。**
