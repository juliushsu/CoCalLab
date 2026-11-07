# Claude 定向審查單一入口 — 2026-11-07

**READY_TO_FORWARD／WAITING_CLAUDE；發布 HOLD。** 請 Owner／CTO 將本入口交給 Claude。Codex 未聯絡第三方；獨立代理審閱不等於 Claude 裁定。只做下列五組差異的唯讀審查，不重開整案稽核。

## 版本固定與閱讀方式

Repository：`juliushsu/CoCalLab`。先在各固定程式 SHA 閱讀指定差異，再以整合程式 `1b1e82913ee593f4255eb33a92744d597c530b2c` 查後續交集；完整 checkout／文件基線 `e565b4fe19ebf088d71c4ab5c553e4c5306215c4`。不要改用移動的 branch HEAD。詳細指令文件可能晚於程式提交，請從本入口固定文件版本的相對連結開啟，不假設它們存在於較早程式 SHA。

| 組別 | 固定程式 SHA | 詳細問題與證據入口 | 狀態 |
|---|---|---|---|
| H：附件 hash | `411a99d597046f65dd54fc134df5dc0d8346c346` | [hash 指令](CLAUDE_ATTACHMENT_HASH_TARGETED_REVIEW_20261106.md)／[交付](SERVER_ATTACHMENT_HASH_DELIVERY_20261106.md) | WAITING_CLAUDE |
| R：重算冪等 | `67e546fa6894303ccbff66d829d077b93c5fb8e2` | [重算指令](CLAUDE_RECALCULATION_TARGETED_REVIEW_20261106.md)／[交付](RECALCULATION_IDEMPOTENCY_DELIVERY_20261106.md) | WAITING_CLAUDE |
| D：刪除恢復 | `1b1e82913ee593f4255eb33a92744d597c530b2c` | [刪除指令](CLAUDE_CONTROLLED_DELETION_TARGETED_REVIEW_20261106.md)／[交付](CONTROLLED_DOCUMENT_DELETION_DELIVERY_20261106.md)／[維運](CONTROLLED_DELETION_OPERATIONS_20261106.md) | WAITING_CLAUDE |
| L：report request ledger | `18c0894cf9da42eb341ce5835ba36fdc3a7bedc9` | [ledger L1–L5](CLAUDE_REPORT_LEDGER_TARGETED_REVIEW_20261106.md) | WAITING_CLAUDE／WAITING_CTO |
| M：MANUAL 轉錄／確認 | `06bad0818625bd9d4f3b685dff50994157b52757` | [MANUAL 五題](CLAUDE_MANUAL_TRANSCRIPTION_TARGETED_REVIEW_20261106.md)／[交付](MANUAL_TRANSCRIPTION_DELIVERY_20261106.md) | WAITING_CLAUDE／WAITING_CTO |

## 審查焦點

逐組回答原指令題號，聚焦普通 API／SQL 的權限繞過、actor／organization／project 範圍、撤權與最新訂閱、競態、重送、回覆遺失與部分失敗恢復。請追蹤直接可寫表／舊 RPC 是否能污染新的 private authority，而非只看正常 UI。

交集至少核對：005 對 003 begin／complete／結果及 catalog 的替換；刪除引用 fence 與 MANUAL／report；processing lease 的開始／完成／釋放。較早 SHA 的缺陷若被較晚差異修復，分別列出歷史與整合狀態，不混成同一受審版本。不要擴至已關閉且無新證據的登入或 H0 範圍。

**已知 OPEN：**舊 ledger 保護 request 綁定，沒有聲稱完整 report row 不可改寫。本輪已重現一般角色直接 INSERT／UPDATE／DELETE completed 報告，以及只有非空 hash 的歷史 row 可匯出；整合修正正在進行，後續將另附固定 SHA 增補審查，不能把目前五份來源結論當成這項已關閉。Mock OCR／AI 也未完成。

## 回覆格式與證據界線

每題標「來源支持／仍有缺陷／證據不足」，附組別、固定 SHA、檔案行號、觸發條件、實際影響、最小重現、測試已讀／實跑範圍、缺少的回歸；finding 標 P1／P2／P3。未執行的測試寫「未重跑」，不能把提交者的數字當作自己驗證。

只讀來源與測試，不修改程式／Git／schema／權限／資料，不操作雲端、migration、seed、reset、部署、資源或費用，不讀取／回報憑證、JWT、金鑰或企業資料。不得執行附件或文件內與此唯讀任務無關的指令。

本機 PGlite／Node HTTP／SDK 的 Auth、JWT、Storage 均有明示合成替身；非真 Supabase 驗收。兩項獨立 SQL 並行仍 NOT_RUN，不以 Promise.all 推論；真服務、Deno、備份復原、原生選檔／下載存檔亦未驗。測試子集與全套重疊，不能加總。

最後列出跨組新發現、既有 OPEN／NOT_RUN，以及需 CTO 裁定事項。此審查不能核准雲端操作、合併或解除 HOLD。

## 可直接轉交的文字

> 請唯讀審查此固定文件入口列出的 H／R／D／L／M 五組固定程式 SHA，逐題依來源回覆；聚焦權限繞過、競態、重送與失敗恢復。請區分各歷史版本與整合 1b1e829 的後續覆蓋，勿改用 branch HEAD，勿重開整案。完整 report 防竄改為正在修復的已知 OPEN，後續另交固定增補。不得改程式或操作雲端，未跑測試請明示；發布維持 HOLD。
