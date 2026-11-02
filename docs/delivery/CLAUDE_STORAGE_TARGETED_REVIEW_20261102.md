# Claude 定向唯讀審查指令：安全上傳與收件

請僅審查 [PR #14](https://github.com/juliushsu/CoCalLab/pull/14) 的固定來源版本：

- Repository：`juliushsu/CoCalLab`
- 固定 commit：`71ffcf47defef31236181f8b938fc005f46dcb71`
- 比較基準：PR #13 `be23b32654c222cb51d7458669cf6d93364fc0fd`
- [固定差異](https://github.com/juliushsu/CoCalLab/compare/be23b32654c222cb51d7458669cf6d93364fc0fd...71ffcf47defef31236181f8b938fc005f46dcb71)
- 後續文件提交不改此來源版本；不得改用移動中的 branch HEAD 代替。

只讀取來源與測試證據，不修改程式、不連線既有資料庫／雲端、不送出真實檔案、不搬移或刪除物件。不要重做 H0 或重審無新證據的已關閉結論；只追蹤本差異直接相關的呼叫鏈。
發布 HOLD；原 UAT 基準 `7dccd5452152f2495d10ad1437d5d03215166065` 未改。

先讀 `UPLOAD_STORAGE_CTO_DECISION.md`、`SECURE_UPLOAD_DELIVERY_20261102.md` 及 `backend/tests/integration/storage-upload-rls.README.md`。

## 逐項回覆

1. **S1：policy 合成與身分邊界。** restrictive guards 是否真的約束完整既有 permissive 鏈？跨租戶讀／寫／刪、viewer／非活躍會員、readonly、匿名、偽造 path 是否拒絕？合法同租戶操作是否仍可行？檢查 private helper ACL／SECURITY DEFINER／search_path，不以缺表權限代替 RLS 證據。
2. **S2：路徑與歷史相容性。** 三個 bucket 新 UUID path、合法舊 basename、未知 prefix、大小寫及 URL 正規化歧義是否有清楚邊界？NOT VALID 前不一致 org/project/path 是否被隔離保留？private bucket／public drift／缺 bucket 的來源處置是否可能破壞既有資料？本 migration 只是來源提案，不能視為已獲雲端建立授權。
3. **S3：真實收件與不可偽造。** 實際 user/org/project/ID/path/bucket/ownership/env/test 與初始 pending 狀態是否一致？可否用 client UPDATE 或錯誤回傳偽造 OCR／成功？既存 receipt 是否核對原檔 bytes/hash 並記錄實際 uploader/type，而非表單假值？不要把 SQL 的 hash 格式檢查當作 server bytes attestation。
4. **S4：部分失敗與恢復。** object 成功、row 拒絕／回應遺失、session／scope 切換、重載、雙分頁 save/clear、同內容再選取時，是否會丟失參考、重送、盲刪或假成功？檢查每 attempt checkpoint；它不是跨分頁同 hash 交易鎖，不能宣稱完整後端冪等或原子保存。是否仍有本差異應修的 P1／P2？
5. **S5：版本前置與未驗範圍。** 缺少新 contract、RLS／guard／trigger／private flag 漂移時是否在 bytes 前停止？既有版本／未知 Storage catalog ownership 是否保守處理？PGlite／攔截 SDK／browser-memory File 的證據是否被誤當真實 Supabase Auth／Storage HTTP／原生 chooser／OS 下載／雲端 migration 驗收？

每項回答 **來源通過／仍有缺陷／證據不足**，附固定 commit 的檔案與行號、觸發條件、受影響操作、測試名稱及其實際覆蓋／未覆蓋；有缺陷時列 P1/P2 與最小合成重現。
請把真實服務未驗與可證實來源缺陷分開，不要求任何憑證或正式資料。沒有 Claude 回覆前，不宣稱外部紅隊已完成或放行。
