# 人工更正來源／舊收據排除／草稿鎖序修復

> 最新CTO裁定已收件：F1/F2、恢復／排除呈現及相容小修來源關閉；N4-R1僅INSERT具名排程關閉。請依 SOURCE_CLOSURE_20261108.md 與 UAT_FIXED_CANDIDATE_20261108.md 接續，不再等待同一份Claude/CTO回覆。下文保留原交付當時的版本與待審狀態。預算USD20累計／14天已確認，僅具體雲端操作待授權。

RELEASE HOLD；本機來源候選，等待 Claude 對 F1／F2／N4-R1 與修復交集複審。沿 CTO 關閉 N1／N2／N5，N4 只接受具名排程證據；不以本文件自行關閉新阻擋。正式 UAT 基準仍是 `7dccd5452152f2495d10ad1437d5d03215166065`。沒有雲端、費用、main 合併或正式部署。

## 固定來源與保留

- Branch：`codex/replacement-provenance-fixes-20261108`。
- 整批程式：`040509777bb1cb60589a01ce7ec176a4ec54cee7`；主要修復 `99c233de70f02b8d3aca5b5e7262526d5bf5312d`，後續只恢復報告來源錯誤碼的相容順序，既有拒絕測試未刪改。
- N4-R1 早期鎖：`7abe03d21fcfd05bc0e99f26183c061f65bffcc9`；工具／預覽初版：`9481fa3969f9fc3af9529267183b8ea1845fb83f`。各證據記各自實際版本，不拿較早版本冒充最終全批。
- 先 fetch，合併保留 Claude `b5772f4de7eacadaad63eb323cc0904656e03934` 與 `4b0092596de5eb82f09e1500a4eb00e5b18975ee`；原回覆是唯讀來源審查，Claude 當時未重跑測試。
- 保留 29 路由、原前後台入口、五階段導覽、十章資料導引及 HTML／JSON 匯出。沒有刪除既有操作、引入 OCR 假成功或擴建共用平台。

## 實際行為

F1：新取代活動的 `confidence_score` 寫入 NULL；既有後繼活動只在讀取／可信輸入投影移除繼承信心值，不改寫舊列、ledger 快照、計算或報告。SQL 從私有 `replacements`、前版活動與不可變 successor snapshot 產生完整祖先鏈；逐步保存前／後版 ID、模式、理由、服務端 actor／時間及欄位 before／after。原收據保留來源關係，明示只作歷史來源、不佐證新值。

`report_calculation_inputs` 提供服務端 provenance；既有報告 builder 寫入 `appendix_mappings[].replacement_provenance` 及版本化 `correction_disclosures`。publisher 兩處均與私有 ledger 比對，不能靠 client 改理由、actor、時間、模式、diff、順序、漏列或偽造原件狀態。來源 ID 漏列／重複仍回舊 `REPORT_SOURCE_MAPPING_MISMATCH`；同 ID 的偽 provenance 回 `REPORT_REPLACEMENT_PROVENANCE_MISMATCH`。報告頁與 HTML／JSON 使用保存 payload，不接目前活動回填舊報告。舊契約缺揭露時明示未知，不推定當時沒有更正。

F2：只對 `exclude` 放寬「原件必須先 server-verified」，仍檢查有效前版、租戶、即時角色／訂閱、相同來源及 latest／confirmed 草稿、不可變原數量與取代衝突。`correct` 仍必須通過有效原件證明。舊收據維持 `legacy_unverified`，排除不補簽、不輸入新數值；失敗畫面保留具體來源驗證原因。排除活動保留原 quantity／unit，醒目計算顯示「已排除／不計入」，不將它宣稱為零排放。

恢復：沿既有 `replace-emission-activity` handler 增加 `action: recover`，由服務端 JWT 身分調用 service-only RPC。以原 predecessor 查回同 actor 原 request／保存意圖，再走原 lookup、讀回原 successor；關閉分頁遺失本機參考不構成建立新 request 的理由。其他 actor 只能收到 superseded，不取得私有 request／intent；撤權／唯讀即時拒絕。UI 查回前禁止送新操作，情境切換後丟棄舊回應。

N4-R1：普通角色 draft INSERT／UPDATE 的 `a_draft_project_lock` 在 `deletion_draft_reference` 前先做既有即時授權與 project 鎖；沒有取消既有 RLS、MANUAL／來源保留或刪除 fence。新 helper 不開放普通／service 直接 EXECUTE。觀察端每次 poll 清除 `pg_stat_clear_snapshot()`，只接受 `active + Lock + 真 blocker PID`，避免快取誤讀。

## 可重現本機入口

僅 localhost 合成環境：前端 <http://127.0.0.1:4217/login>、API <http://127.0.0.1:4216>。保留其他預覽、既有 5432 與專用 native PG 55439。沒有讀 production .env 或連既有 Supabase。

在 repo root 的兩個終端依序啟動；PGlite 0.5.13 與 frontend dependencies 須已存在，缺少時明示失敗：

```powershell
$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path
node backend/tools/product-preview/provenance-preview.js
```

```powershell
Set-Location frontend/readdy-app
node node_modules/vite/bin/vite.js --config tools/local-preview/vite.replacement-provenance.config.mjs
```

兩服務 strict port／只綁 127.0.0.1，佔用即失敗，不停止他人程序。API 重啟會建立全新合成 IDs／資料，必須用當次啟動回執的 activitiesUrl／reportUrl。測試登入 `a-owner@product-preview.invalid`／`synthetic-local-only`，這是公開合成 fixture，不能用於真 Supabase。合成係數明確為 1 kg/kWh，只存在測試 adapter；其他舊預覽預設仍 0.5，未改產品係數。

1. 啟動時，透過實際 verifier→人工轉錄→確認→通用重算→報告 handler，建立 100 kWh／100 kg 的原報告。
2. 開 activitiesUrl，按「更正／排除（保留原版）」，理由明示人工更正，quantity 改 120；保存後原 100 列仍在，只有 120 為有效版本。
3. 明確按「計算並保存」，再「保存報告快照」；開新報告，總計 120 kg＝0.12 t，查看保存的更正鏈、理由／actor／時間／差異及「不佐證」提示。原 reportUrl 仍 100 kg。
4. 關閉分頁、重開並以同 actor 登入。原 100 歷史列按「核對原取代請求」，必須查回原 request 與意圖；核對不新增活動。
5. 對目前 120 版本選 exclude、填理由。數量保持 120；重算結果一筆排除，活動明細醒目顯示「已排除／不計入」。舊計算與兩個已保存報告不改寫。
6. HTML／JSON 須經既有匯出授權服務重讀保存快照。此次實測真 handler 授權後本機產檔並重新解析；原生瀏覽器下載落盤另留人工驗收，沒有擴張下載／選檔權限。

本次瀏覽器證據用產品 `99c233d`／工具 `9481fa3`，啟動 sourceDirty=false。最終後續差異僅 publisher 拒絕錯誤碼順序，JS／FE／Edge 與本次畫面相同；後續啟動使用當次 checkout 的 migration，不冒稱舊截圖在新版本重跑。實際 IDs／產檔／hash 見 [API 查回回執](evidence/replacement-provenance-20261108/preview-api-observations.json)，圖片及 DOM 同資料夾。授權 export／recover 前後全 report／activity row JSON 不變；恢復同 request、總 activity 仍三筆，一個有效 excluded 末端。

定稿後只重啟本次專用4216程序，保留上述證據；現行入口已是產品040／工具08162ca、sourceDirty=false。另用實際 SDK／前端服務重現100→120→排除，保留原列／原報告，查回同request，保存三版報告並經授權產出六份HTML／JSON：[最終入口與產檔hash](evidence/replacement-provenance-20261108/final-preview-smoke-0405097.json)。Chrome重新登入、讀取此最終120報告，核對0.12t及完整揭露；[最終截圖](evidence/replacement-provenance-20261108/final-lineage-0405097.jpg)與final-report-120-dom.txt同資料夾。最終版的重開分頁恢復屬SDK證據；實際關分頁操作是前一99版，不混稱一次測試。

## 測試證據與邊界

見 [實測彙整](evidence/replacement-provenance-20261108/EXECUTION.json)。[GitHub CI42470929989](https://github.com/juliushsu/CoCalLab/actions/runs/42470929989) 實測08162ca成功：backend44／整合388PASS+2NOT_RUN／FE241及type/lint/build；[完整版本收據](evidence/replacement-provenance-20261108/github-ci-result.json)。後續文件提交不冒稱使用不同CI版本。作者、獨立代理與全套 CI 的同覆蓋不相加。

- 後端 44／44、前端 241／241、type-check／lint／標準 build 通過。build 保留原 chunk-size warning，沒有以修改限制掩蓋。
- 新 SQL 13／13、實際 SDK→原 handler→PGlite HTTP 3／3；獨立審閱同範圍通過，未發現新 P1／P2。原始作者早期輸出只有工具回執，其結構化摘要明示不是完整 raw stdout。
- verified MANUAL 100→120：raw builder 直送 SQL，新報告只120；前版活動、計算、報告／private proof、收據、草稿完整 JSON 不變。兩個 payload 位置 12 種偽造拒絕。legacy exclude→重算→保存報告且不升格；correct 拒絕。完整多步 chain、舊 successor 投影、UTC 正例、actor／role／subscription／scope、rollback／ACL 與同 ID 恢復均有正反例。
- 初次全套固定99c233d：390 項＝386 PASS／2 FAIL／2 SKIP。兩 FAIL 都是既有 source-mapping 錯誤碼相容，被實際拒絕但分類提前；保留原始失敗紀錄，窄修後不刪改負例，重跑受影響兩舊檔與新 SQL。
- 原生 PG17.11／pg8.16.3：da5 baseline 在兩個 draft trigger 之間重現自然 A↔B cycle／真 40P01；observer barrier 已釋放且不在 cycle。全批綠例四具名案例、三個真 Lock observations，含 rollback、原 UUID／request replay、外單位／viewer／readonly 拒絕與合法 UPDATE。主代理與獨立代理不同 DB／三個不同 PID 實跑，不以 Promise.all 代替並行。
- native UPDATE「兩 trigger 之間」的並行與其他未具名鎖組合仍 NOT_RUN；普通 UPDATE 僅序列合法／改綁拒絕已驗。不能全域關閉 N4。
- 本機 Deno2.9.8 16 check／16 static bundle，frozen lock、原件／工具／bundle hash 校驗通過。起初 sandbox bundler denied ancestor-directory read，失敗日誌另保留；以已授權本機編譯重跑成功，不改來源或關閉保護。不是 managed Edge／ESZIP 實跑。

## 部署與復原限制

[固定候選清單](../../deployment/uat/candidates/040509777bb1/README.md)：49 tracked migration＝46 schema/governance＋3 歷史 fixture DML HOLD。002 在001後、003在002後；不修改已套用記錄，不把來源 manifest 當 cloud applied 清單。新 helper／recovery RPC 和同版 handler／UI／builder 成套。

**既有專案必須重新計算，才能建立新版可信報告；進行中的舊重算可能失敗。** 新 provenance 進入可信輸入，使舊 authority 自然失效；不自動重算、不改歷史 is_latest、不補簽、不覆寫歷史報告。已封存原 request replay 保留原 payload；新 report 缺新版揭露而有 replacements 時 fail closed。回退舊 client／handler 不能繞過 SQL；回退前須核對完整 schema／private ledgers/proofs 與版本，不提供猜測逆向 migration。

NOT VALID 必須另盤點與驗證；本機新庫套用成功不代表既存資料一致。DB backup 仍須包含 private hash／recalc／report／manual／replacement ledgers；Storage bytes／object IDs／generation 另備。舊 PR34 的 backup/restore 證據屬 da5，不能冒充此新增002／003已做全備份復原。

雲端 target=null，未建立專案／bucket、未上傳／套 migration。Owner 已選 Micro 及累計預算／14天，費用時鐘未啟動；最新 CTO 無執行授權，不重問同一預算，也不先建立。四組真服務 JWT／Storage／瀏覽器／migration復原與19+1驗收仍 NOT_RUN／BLOCKED。原件 hash 驗證不代表內容真實，更正理由也不代表更正值已經查證。

## 明確後續佇列

先交 [Claude 定向入口](CLAUDE_REPLACEMENT_PROVENANCE_REVIEW_20261108.md)，只審 F1／F2／N4-R1 及恢復／排除呈現交集，不重開整案。收到回覆後保留固定提交，再依新證據修復；不自行宣告 CTO 關閉。

以下 P3 保留 OPEN，沒有用改寫歷史證據來處理：高精度 witness；歷史 calculation `is_latest` 與「目前有效」的不同語意；effective views 的使用規範。未具名鎖組合獨立排驗。參見 NEXT_ACTION 的下一條命令。
