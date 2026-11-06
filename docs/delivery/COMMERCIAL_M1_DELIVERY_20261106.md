# M1 原產品人工建檔、計算與報告保存交付

狀態：SOURCE_DONE 候選；RELEASE HOLD。固定程式 `18c0894cf9da42eb341ce5835ba36fdc3a7bedc9`；分支 `codex/commercial-m1-20261106`，起點為 CTO 指令 `43cbb102d5e291d9bd446f18354a9372753023da`。UAT仍固定 `7dccd5452152f2495d10ad1437d5d03215166065`，不是本機功能候選。

## 操作入口與啟動

從 repo root，第一個終端：

```powershell
$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path
node backend/tools/product-preview/run.js
```

第二個終端在 `frontend/readdy-app`：

```powershell
node node_modules/vite/bin/vite.js --config tools/local-preview/vite.product.config.mjs
```

瀏覽器 `http://127.0.0.1:4195/login`；API只監聽loopback4194。原4192／4193模式保留；未改production Vite設定、router、App、AdminLayout；未碰5432或其他專案，不重試Docker/WSL。
合成帳號 `owner@product-preview.invalid`、密碼 `synthetic-local-only`（全假資料）；此帳號A owner/B viewer，B-only owner及A viewer/outsider見[工具說明](../../backend/tools/product-preview/README.md)。不是Supabase真帳號，不接受／使用你的雲端憑證。

1. 登入後點底部「人工活動／計算／報告」，選 SYNTHETIC-LOCAL 專案。
2. 原 Add Activity 表單：名稱明示SYNTHETIC，類別energy、活動類型electricity、數量100、單位kWh、Scope2、納入狀態「已人工確認納入」，日期在2026年內，備註人工確認依據。可用單位欄Enter提交；原Create按鈕保留。
3. 送出後清單重讀出100 kWh／Included。空白不補零，缺專案不猜第一個組織；未知保存結果保留同UUID以重試／重新開啟核對。
4. 「計算並保存」呼叫原recalculate-project handler及真SQL RPC；未計算／待補係數明示狀態，不能生成已完成零報告。
5. 「保存報告快照／重試」呼叫generate-report handler及新service-only SQL V2；快照保存後再讀回，顯示50 kgCO₂e = 0.05 tCO₂e。0.5係數只在明示合成fixture，來源SYNTHETIC TEST ONLY／版本1，不是正式預設。
6. 「開啟已保存報告」進入原ReportPreviewPage；重載仍顯示v1／Completed／0.05 tCO₂e。活動View可檢視保存的計算輸入、係數來源與版本；空章節仍明示未提供，沒有假OCR或假報告章節。

本機記憶體資料庫在API停止後消失；重啟會換UUID，前端使用新的專用storage namespace。此重載證據是同一API生命期，不是磁碟備份／復原驗收。原生日期輸入的自動化填值未確認切換成功，本次Chrome實際活動日為2026-11-06；HTTP合成案例另測2026-01-15，均在保存的2026期間。

## 實際證據與範圍

| 層級 | 實際結果 | 證據／限制 |
|---|---|---|
| 前端 | 163/163；type-check、lint、build PASS | 新manualWorkflow3是子集；已保留既有160。新流程部分提示暫為中文，未宣稱三語商用驗收 |
| Backend helper | 17/17 | 原16+報告完整性1；真零可報，missing/pending/error/NaN/重複latest不補零 |
| 隔離SQL／HTTP整合 | 214/214 | 原197+product8+request-boundary9；新案例是子集，不與獨立代理數字加總 |
| 獨立代理 | product8、boundary9、manual3與tsc PASS；固定SHA已核對 | reviewer未改核心；boundary test由reviewer新增，不能冒稱其測試另經第三人審查 |
| Chrome原App | 人工表單→REST保存→計算→報告保存／readback→原報告重載 | 使用固定SHA及合成HTTP/Auth/PostgREST adapter；截圖／DOM見evidence/commercial-m1-20261106，不是真Supabase/Deno/JWT/Storage |

本機工具實載checked-in Deno handler，僅把SDK的esm.sh import映射到已安裝SDK，以worker提供Deno env/serve替身；SQL執行真migration/RPC及RLS。假JWT只由runtime的合成session allowlist接受；不驗真JWT簽章。初始資料只有組織、專案、會員、訂閱、測試係數，活動／計算／報告沒有test INSERT旁路，全部經正常產品REST與handler。未提供endpoint真失敗，不回Mock成功。

## 保存、恢復與信任邊界

原報告RPC後再PATCH快照，可能留下半份completed。本批改為V2同交易建立報告、寫附加快照、綁定請求、audit；SQL enum失敗已驗全部回滾。同請求先做auth／訂閱／project核對，再找已保存結果，後續新增未計算活動也不會阻斷恢復。不同actor／version／claim拒絕。未確認report journal會擋新計算；使用者可明確「放棄報告恢復參考」，只清自己的scope參考、不刪伺服器報告，再建立新版本。

**最小新增 operational ledger 的必要性**：一般會員可寫既有audit log，不能拿它作request權威。新增`report_snapshot_requests_v2`僅存org/project/request、actor/version/claim及report ID，不新增碳盤查業務模型；RLS啟用且無client policy/grants，兩RPC僅service執行，並核對report row真scope。初版可寫audit造成的跨scope代理風險已在全合成反例重現並修正；該不安全版未提交／部署。既有audit只留追蹤，不承擔授權。

**未關閉**：report_generations現有client寫權限代表整張報告仍非防竄改；相同request只保證這次受測綁定與保存／恢復行為，非完整不可變報告架構。既有V1 RPC保留相容，但仍service-only；其他新舊呼叫端、實際並行、撤權途中recalc、server hash／收件偽造、Storage跨服務刪除、原生下載、真實服務與商業UAT仍OPEN／NOT_RUN。

## WAITING_CTO：定向安全裁定，不阻擋其他READY工作

固定`18c0894...`新增ledger/RPC已經獨立代理審閱；交Owner協調Claude時只問：一般會員能否利用既有可寫資料表偽造／改變ledger權威綁定，或讓兩RPC回傳不屬於目前scope／actor／version／claim的報告？範圍限本批migration、generate-report handler及boundary tests，不重開整案。尚未宣稱Claude已收到、CTO已裁定或已放行。

部署候選需先套用新migration再部署新handler；缺V2時明確失敗，不退回舊二階寫入。雲端migration、資源、成本、schema／資料、main合併與Production仍未授權，沒有執行。回復方案為停用新生成入口、保留已保存報告與ledger，不刪資料、不自動降級到舊半交易路徑。

## CI 安裝順序修正

初次GitHub CI在SQL階段找不到前端SDK，原因為workflow尚未執行前端npm ci；本機214/214已安裝同一SDK，因此通過。已將既有lockfile的npm ci移至SQL／HTTP測試前，不跳過或降低任何測試，不新增套件。此為CI設定修正，固定業務程式仍為18c0894；最新版CI結果另以實際run收件。
