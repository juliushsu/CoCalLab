# M4 固定來源定向審查（待CTO轉交，非已通知）

固定06bad0818625bd9d4f3b685dff50994157b52757。僅讀manual-transcription contract/handler、202611060002 migration、confirm-draft MANUAL分支、pending原件retention與相關SQL/HTTP tests；前端journal/專用確認僅作觸發證據。不重做H0、整案或非MANUAL既有票。

逐項回覆：來源支持／仍有缺陷／證據不足，附固定SHA、位置、觸發條件、影響及測試範圍；沒實跑就寫未重跑。

1. 普通會員能否偽造MANUAL provider、raw provenance、server actor/time或確認決定，或藉其他可寫表／舊RPC改變其權威？
2. 兩RPC是否核對同org/project/doc、活躍可寫角色、真正latest訂閱/到期、合法私有原件；new latest、改intent、不同actor與stale journal是否被正確處理？
3. create/confirm重送或失回覆是否只產生一份draft/activity/calc；真正SQL錯誤是否連audit rollback，重送回的是保存計算與警示而非重算/空警示？
4. MANUAL原件/收件retention是否AND完整policy鏈且無跨租戶scope oracle；不能把此保護說成跨服務atomic delete。
5. 缺資料、缺係數、同分歧義、跨期、不同canonical輸入是否拒絕/保留未知；是否可能用0/kg/假OCR/雙人覆核假成功？

既有本機191前端/21backend/239 SQL+HTTP、M4 target SQL8/HTTP9/contract4及獨立定向子集在MANUAL_TRANSCRIPTION_DELIVERY_20261106.md；不要加總重複範圍。真JWT/Storage/Deno、真獨立SQL並行、雲端與Owner業務驗收NOT_RUN。server hash/整表防竄改/跨服務刪除等OPEN不在此假關閉。

唯讀、不改程式/Git/schema/權限/資料、不操作雲端、不讀寫密鑰/企業資料、不建資源/付費/部署；不代表CTO或Owner放行。發布HOLD、UAT7dccd545不變。既有ledger定向文件固定18c0894，兩份來源不可混作同一受審版本。
