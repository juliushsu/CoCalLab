# N1／N2 定向修復交付

RELEASE HOLD；P2-1～P2-3 沿用 CTO 來源關閉結論，不代替真服務驗收。P2-4／N1 仍待本修復固定版的 Claude 定向複審及 CTO 關閉。已 fast-forward 保留 Claude b69684dc2c52cc4b062b78f1e7aa711043366956 原文，不改寫受審歷史。

固定程式／SQL：**33d3613487f42a7e9c5888ae312441e730d3d87e**（PR #30）。

## 實際行為

- confirm 在交易內鎖定範圍與文件，查整份文件的 MANUAL 歷史；非 MANUAL 入口只接受 latest、pending_review／needs_clarification 且未處理的草稿。舊 signature 是受控 adapter，不是 ledger 旁路。
- 私有 confirmation_requests 綁定實際 actor、範圍、草稿、固定 request_id 與 decision/overrides。新 handler 在衍生 activity_code、時間、計算前先查回；完成重送使用原 activity/calculation IDs，沒有再插入活動。歷史未登記操作不自動補簽。
- 交易另比對初讀草稿的穩定來源快照；確認途中 normalized／分類等來源變更會拒絕，不能把舊活動綁到新來源。已完成請求仍先回原保存結果，來源快照不是衍生計算或操作意圖。
- 普通角色 INSERT 旁支、UPDATE 改綁 MANUAL 文件或偽造 MANUAL 標記均拒絕；同時核對新舊 receipt 的租戶／專案，避免只靠 draft RLS。
- MANUAL 判定以 SQL is_manual 與可移植純函式模組的同一 provider/JSON corpus 對齊。規則是 manual token（首尾、底線或連字號分段）或 JSON 頂層 manual_transcription；新 canonical 資料格式仍嚴格，不自動升格 legacy。
- N5 加入匯出情境失效時的明確取消原因、保留提示與可重試契約。已核實 hook 的顯式 refresh 會進 loading；來源未見 focus/visibility 自動 refresh，因此「切回前景」實際觸發仍 UNVERIFIED。測試替身不是 React／原生下載驗收。

## 相容與部署

新增 202611070004_manual_document_confirmation_boundary.sql，須依既有 001→002→003 後執行；僅本機候選，不含雲端套用授權。新 handler 要求非 MANUAL 確認提供穩定 request_id；缺少來源 witness 的舊 handler 新確認及新舊介面意圖不同時 fail closed，不聲稱所有混合版本可透明接手。

**既有專案需重新計算，才能產生新版報告；進行中的舊重算可能失敗。** 不自動重算或覆寫歷史報告；歷史報告維持原讀取及未驗證標示，匯出相容影響仍按 Owner 驗收流程。

## N4 鎖順序與恢復

來源可見刪除路徑採 document-delete advisory → receipt row → report retain project lock；MANUAL 路徑採 project lock → document-delete advisory → receipt row。不同連線交錯可能造成 40P01，仍是 OPEN／NOT_RUN，不能以 PGlite 序列操作或 Promise.all 宣稱已解。交易錯誤須完整 rollback，客戶端保留原 request_id 重新核對／重試；不能改 ID 或自行清理 bytes。獨立 SQL 鎖等待、真 Supabase/JWT/Storage 及管理型 Edge 另驗。

## 證據與下一步

驗證結果、來源固定 SHA 與命令記於同批 evidence／NEXT_ACTION；基準缺陷重現固定 through 003，與修復後正反例分開。新增單元與獨立審閱子集不得與全套加總。

下一步：提供固定版 Claude 定向入口，僅審 N1 殘留旁路、N2 判定與本差異交集；另分支依 ACTIVITY_REPLACEMENT_N3_CONTRACT_20261107.md 先契約及測試，再實作保留舊版的活動取代，不等待逐項批准。

## 固定版實測

- 獨立git archive固定全部925tracked blobs一致：整合358tests＝356PASS／0FAIL／2NOT_RUN，exit0；backend33/33、FE227/227、type/lint/build PASS（既有chunk size warning）。
- 原生Deno2.9.8：15/15 check、15 static bundle，工具／來源／bundle／lock雜湊均PASS。僅靜態分析，不是managed Edge執行。
- SQL單檔14/14、HTTP確認5/5、固定9eb原handler2/2均包含／重疊於全整合，不加總。獨立代理最終source witness6/6，固定版本對照一致，未發現其他已證未解P1/P2；不是Claude放行。
- 原handler fixture保留9eb原始bytes並hash檢查，確實載入舊handler；其依賴走本機SDK替身，因此不是舊managed deployment驗收。
- 所有命令、實際輸出與未驗界線見[evidence](evidence/cto-n1-n2-20261107/VALIDATION.json)。CI待本輪push後核對，不挪用舊版本CI。
