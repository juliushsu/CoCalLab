# CoCalLab 產業核算與交易碳排資料工程計畫

日期：2026-11-11（Asia/Taipei）
狀態：PLANNED；文件收斂不等於功能完成。RELEASE HOLD。
決策入口：[README](README.md)。接收端契約：[V1 設計](SUPPLIER_EMISSION_INTAKE_V1.md)。

## 1. 交付目標與排程原則

首個可交付成果：企業在自己租戶內接收一份供應商交易排放聲明，完成人工審核、排除重複、明確採用，產生可追溯且不改動舊版的新報告。
物業／旅宿開立端接續使用共用核心；平台跨租戶交換後置。
開發排程採依賴順序而非尚無證據的日期承諾。E0 完成後，PC Codex 依實際差異提供各批預估；不得宣稱背景工程或虛報開始／完成時間。

目前 UAT／還原／既有缺陷的既定優先工作繼續。新方向的現況映射與設計可立即進行；新增產品程式使用獨立工作分支／worktree，不改凍結 UAT 包，不把 main 當作最新應用候選。
只因雲端或人工決策阻塞時，停止該相依項目，繼續可完成的本機契約、測試或文件工作。

## 2. 責任分工

| 角色 | 責任 | 完成回報 |
| --- | --- | --- |
| Owner | 商業優先序、代表客戶驗收、成本與正式發布決策 | 決策與具體範圍 |
| PC Codex／工程執行者 | E0 映射、後端／SQL、前端、受控整合、測試與交接 | 固定 commit、差異、實測與未驗、下一步 |
| PC Claude／獨立 reviewer | 方法語意、來源可信度、重複計入、租戶邊界、版本快照的定向審查 | 具名 finding、來源與觸發條件、複審結論 |
| CTO 協調角色 | 依證據關閉對應 gate，處理跨端契約衝突 | ruling、owner、closure condition；不代簽真人／真環境驗收 |
| Readdy／前端協作者（如使用） | 在已凍結 DTO 與狀態契約內完成表單與呈現 | 真實資料狀態、錯誤／待審／未知可見；不提供 mock 成功 |

上述為責任配置，尚不代表各端已 ACK 或已啟動。每批須記錄實際執行者／覆核者；同一執行者的自檢不得標為獨立覆核。

## 3. 工作分解與依賴

| ID | 工作包／產出 | 前置 | 完成條件 | Owner |
| --- | --- | --- | --- | --- |
| E0 | 固定實際工程 HEAD；schema／API／UI／報告／guard 映射；沿用／新增／不適用差異表；定版契約與 migration 設計 | 本文件 | 來源路徑＋完整 SHA；確認現行 UAT 與本機未推送狀態；所有接入點有處置 | PC Codex，PC Claude 定向核對 |
| E1 | 供應商聲明接收儲存：來源與採用分離、版本、證據綁定、scope、原 ID 重送／恢復 | E0 契約固定 | 成功／拒絕／重送／競態／錯租戶測試；合成隔離 migration 可重建 | PC Codex |
| E2 | supplier_declared 結果路徑、單位正規化、唯一採用、受控重算與報告快照揭露 | E1 | 不乘第二次係數；與一般路徑相容；舊報告不變；真兩連線驗證關鍵競態 | PC Codex；PC Claude 審核交集 |
| E3 | 前端接收→審核→採用→報告：手動輸入／附件、總量／強度辨識、更正／排除與未知狀態 | E1／E2；畫面可在 DTO 固定後平行準備 | 固定候選瀏覽器完整流程、錯誤與權限撤銷；實際 HTML／JSON 下載回讀 | PC Codex／前端協作者 |
| E4 | 獨立定向覆核、候選封包、環境差異與受影響真服務 UAT 清單 | E1–E3 | 指定 finding 關閉或明示處置；真服務／客戶未驗不得用合成證據補上 | PC Claude＋PC Codex |
| E5 | 共用場所／設備／計量點、帳單、排放池與分攤 primitive；物業＋旅宿第一個開立端 | 接收契約穩定；E0–E4 形成可用候選 | 直接歸屬＋分攤＋未分配可對帳；房晚／會議邊界、預估期與更正鏈可驗 | PC Codex，方法 reviewer |
| E6 | 平台內受控簽發與跨租戶交換 | E5；獨立交換契約 | 指定收件人、簽發者證據、版本／作廢通知、權限撤銷、重送及資訊最小化 | PC Codex＋PC Claude |
| E7 | 交通／物流設定與資料 adapter | 共用核心穩定 | 人公里／噸公里、實際路徑邊界與來源版本；無合作時可明示估算 | PC Codex，方法 reviewer |
| E8 | 製造／餐飲設定 | 具體案例與可用原料／製程方法資料 | 食材／BOM 直接歸屬與共用能源分攤分開；生命週期邊界與缺口明示 | PC Codex，方法 reviewer |

E5–E8 為後續路線圖，不代表一次核准所有資源與外部資料接入。
E1–E3 可拆小 PR，按依賴整合；不得為了抽象引擎而延後第一個接收案例，或全面重構已可用程式。

## 4. E0 具名沿用點

參考 checkout：e4562ed8cb404df6db97a870922ce561b6d4025f；執行者必須對實際最新 checkout 重核差異。

| 路徑／區域 | 現有依據與待核對項 |
| --- | --- |
| backend/src/services/calculate-emission-activity.js | 已讀：一般換算需 quantity／factor；新增總量路徑不能偽裝 factor=1 |
| backend/src/services/build-report-payload.js | 已讀：included 結果完整性與 factor_sources_used；需新增聲明來源揭露且保留 guard |
| backend/src/services/confirm-draft.js、draft-confirmation-source.js | 可信原件與確認 witness；核對可沿用哪些控制 |
| backend/src/services/verify-upload-receipt.js | 服務端收件與內容來源；不將碳明細文件取代現有上傳收件安全契約 |
| backend/src/contracts/activity-replacement.js、backend/supabase/functions/replace-emission-activity/ | 活動取代與原 ID 恢復；聲明更正須映射既有不可變快照 |
| backend/src/services/recalculate-project.js、backend/supabase/functions/generate-report/ | 可信結果 ledger、有效版本與報告原子性 |
| backend/supabase/migrations/ | 查找實際表、FK、RLS、guard、指紋及鎖順序；新增 migration，不改已發布歷史 migration |
| frontend/readdy-app/src/services/activityReplacement.ts、reportSnapshotService.ts、reportExport.ts | 更正、狀態恢復及匯出 adapter；完整來源清單與三語狀態另核對 |
| docs/development/PORTABLE_MODULES.md | 跨產品可移植規範；核心不綁特定 UI／資料表／tenant／部署 |

本表是入口索引，不表示所有列已讀完或已支援需求。E0 要產出完整端到端映射，尤其 SQL trusted write 與 report snapshot 不能漏掉。
文件分支本身基於 main，可能沒有以上候選程式；不得在文件分支直接假設依賴齊備。

## 5. 接收端最低驗收矩陣

下列全為待執行案例，沒有既存 PASS。

| ID | 情境 | 預期結果／證據 |
| --- | --- | --- |
| T01 | 12.5 kgCO2e 總量與 0.0125 tCO2e | 均為 12.5 kg，只轉一次；保存原值與換算版本 |
| T02 | 強度 0.05 kgCO2e／人公里 × 100；以及缺活動量 | 前者 5 kg，後者 pending；不把強度直接當交易總量 |
| T03 | 缺值、零、負值、超範圍、非有限值、CO2／CO2e 混用 | 未知不補零；有來源零可審；非法輸入拒絕或待補且不入正式總量 |
| T04 | 同 request ID 同內容／異內容、未知結果後查詢、兩連線同時重送 | 同內容一個結果；異內容衝突；恢復用原 ID；無重複寫入 |
| T05 | 相同交易多檔／多報帳來源，以及合法不同交易行項 | 疑似重複可關聯；同邊界同組成不雙計；合法行項不誤合併 |
| T06 | 供應商 12.5 與本機估算 15 同時採用；並行競爭 | 可比較，只有一個有效採用；交易與 guard 保護，兩連線證據 |
| T07 | 更正 12.5→13、排除、收到作廢證據 | 舊報告原樣；新採用／重算明確；新報告不可默默用已知無效版本 |
| T08 | A／B workspace、錯 project／document、撤權、舊 session／A→B 切換 | 服務端拒絕越界；UI 不回填舊範圍；他租戶附件不可讀 |
| T09 | 篡改附件／關聯、前端偽造 accepted／verified／結果 | 可信來源與受控寫入拒絕；hash 不冒充簽發者查證 |
| T10 | 邊界未知、供應商 Scope 與接收者不同、全生命週期與部分邊界 | 可以收件待審；不能自動映射或無證分拆；採用決策可追溯 |
| T11 | 一般 factor-based 舊流程與新聲明共同報告 | 既有結果相容；統計／報告／HTML／JSON一致，聲明來源不遺漏 |
| T12 | 舊 snapshot、缺結果、未重算、網路失敗、重開頁面恢復 | 舊 JSON 不變；不以零／mock 生成成功；可查回操作狀態 |
| T13 | 代表使用者完整操作與真 JWT／Storage／managed function | 實際環境另列證據；合成瀏覽器不能代替真服務 UAT |

E5 再新增分攤專屬案例：直接歸屬不重分、分母為零、缺帳單／上期強度、分表與公區重疊、多人同房／房晚語意、排放池期間不相容、捨入差與未分配量。
對同一池與期間應能解釋「直接歸屬＋分攤＋未分配＝總量」；排除／不同邊界另記，不用調整係數掩蓋差額。

## 6. 執行 LOOP

每批依序：
1. 核對 repo／branch／HEAD／dirty diff／既有授權；固定輸入來源。
2. 選取一個可完成工作包，宣告實際 owner 與檔案範圍，保留其他工作。
3. 實作最小差異，跑有意義的正反例；變更涉及可信寫入／報告則包含對應 SQL／服務端測試。
4. 依變更跑 type-check、lint、build 與受影響回歸；並行不變量需兩連線實測。
5. 定向獨立覆核 → 修復 → 只重驗受影響交集；不重啟無新證據的全案審查。
6. 提交小 PR、固定受測 commit、更新本機工程分支 docs/delivery/NEXT_ACTION.md 與此任務狀態；自動接下一個已授權且前置完成的工作包。

任一人工／外部阻塞只停受影響依賴，回報 blocker、owner、解除條件；不反覆索取已存在授權，也不自行擴張為雲端操作。
本計畫未建立排程或遠端代理程序；持續推進依實際執行 session／既有 orchestration。

## 7. Gate 與交付證據

| Gate | 本輪狀態 | 關閉條件 |
| --- | --- | --- |
| G0 文件交付 | PENDING（GitHub 寫入與回讀後由 PR 紀錄確認） | 三文件、相對連結、固定分支與內容回讀 |
| G1 契約／來源映射 | PENDING | E0 差異表、欄位／狀態／資料庫／DTO 定版； reviewer 結論 |
| G2 接收端本機候選 | PENDING | E1–E3；T01–T12 及適用兩連線測試、瀏覽器與匯出證據 |
| G3 獨立覆核 | PENDING | 阻塞 finding 關閉；其餘明確處置與 owner |
| G4 真服務／客戶 | PENDING | 精確環境、部署 SHA、受影響 UAT 與代表客戶驗收；沿用現行環境授權 |
| Release | HOLD | 既有主線 gate 與本功能適用 gate 關閉，Owner 正式發布決策 |

每批證據至少包含：需求 ID、來源／受測完整 commit、實際命令與結果、環境性質（static／synthetic／native／managed／human）、原始證據位置、未驗邊界、reviewer 與下一步。
測試子集不得與全套加總；歷史 PASS 不冒充本輪實測。文件變更只驗文件，不需重跑整套產品測試。

## 8. 本輪交付邊界與接手動作

本輪只提交計畫與設計，不新增 schema、程式、排程、費用或測試結果；不改 main、不改既有 UAT NEXT_ACTION。
接手第一項為 E0；已有授權的本機工作沿用 repo 指示繼續。若實際 HEAD 與本文件參考 SHA 不同，記錄差異與沿用點，不退回舊版覆蓋現行成果。
尚未配置客戶試點、計價或時程承諾；可先觀察完成一筆報帳碳資料採用所需時間、待補比例與來源可追溯性，作為第一階段商業驗證指標。
