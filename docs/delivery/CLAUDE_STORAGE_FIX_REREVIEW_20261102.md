# Claude 定向唯讀複審：Storage 修復差異

請只審以下固定修復來源，不使用移動中的 branch HEAD，也不重新展開整案稽核。

- Repository：`juliushsu/CoCalLab`
- 修復來源：[`8cf7525d60755ea8adbdf3ba818fb26635efb8b0`](https://github.com/juliushsu/CoCalLab/tree/8cf7525d60755ea8adbdf3ba818fb26635efb8b0)
- 差異基準：`f76368953d4f952632f4356c4d7ccbccd46cd5c2`，即原 PR #14 + 使用者上傳的完整 Claude 回覆。
- [固定差異](https://github.com/juliushsu/CoCalLab/compare/f76368953d4f952632f4356c4d7ccbccd46cd5c2...8cf7525d60755ea8adbdf3ba818fb26635efb8b0)
- [完整原審查](https://github.com/juliushsu/CoCalLab/blob/f76368953d4f952632f4356c4d7ccbccd46cd5c2/docs/delivery/CLAUDE_STORAGE_REVIEW_REPLY_20261102.md)，受審程式仍為原 `71ffcf4`。
- [修復矩陣、RED／GREEN、瀏覽器證據及未驗範圍](https://github.com/juliushsu/CoCalLab/blob/8cf7525d60755ea8adbdf3ba818fb26635efb8b0/docs/delivery/STORAGE_REVIEW_FIX_DELIVERY_20261102.md)
- 本文件只是複審請求；外部複審 **NOT_RUN**，S3／S4 **OPEN**，發布 **HOLD**，UAT `7dccd545…` 不變。S1／S2／S5 沿用 CTO 接受的來源範圍結論；僅對本次變更造成的新證據提出問題。

## 唯讀邊界

不修改程式，不留言、不合併、不部署、不連線雲端，不操作正式／既有資料，不做真實上傳。
可讀固定來源與合成測試、證據。若僅閱讀測試碼，請明確標記「未獨立重跑」，不能宣稱測試數量經獨立驗證。
不得使用憑證、JWT、金鑰或付款資料；來源內 synthetic test 值不是可用憑證。

## 只回答這些差異

| 編號 | 必答內容 |
| --- | --- |
| S4-refresh | 正常同使用者／同專案的 TOKEN_REFRESHED 或同 session focus SIGNED_IN 是否保留操作？登出、明確重登入（同帳號亦然）、new session family、換人／換專案／路由，是否使舊操作失效？檢查 AuthProvider 的既有 sessionGate／持久登出防護有無被削弱；UI 連續性不能當 JWT 驗證。 |
| S4-complete | 明確補登記是否先查既有回執及另一分頁勝出列、核對原私有物件及本機參考，再用原 documentId/path INSERT？缺檔、權限撤銷、MIME／size／SHA 不符、遺失成功回應或切換情境時，有無新 ID、bytes 重傳、錯誤成功或不當 DELETE？ |
| S4-discard | 本機放棄是否僅作用於目前 user/org/project/attempt？提示是否明示不刪除伺服器檔案、不撤銷已送出請求？失敗是否不假報成功？ |
| S3-metadata | 增量 metadata trigger 是否涵蓋繞過 UI 的 authenticated INSERT、拒絕缺少／無效／不一致的物件 size/mimetype，且保留既有合法角色與原 trigger？服務維護繞過既有不變量是否維持清楚？ |
| P3-a | 新路徑 project 段大小寫是否與 receipt 一致？legacy parser 未改，舊合法大寫路徑讀／授權刪除是否保持？ |
| P3-b | 情境在 checkpoint 前失效是否避免未送出紀錄？checkpoint 後 bytes 前失效是否只清除自己的參考？儲存不可用時是否停止 bytes？ |
| P3-c | 既存合法回執是否優先於本機殘留？若第二次查詢才有另一分頁勝出列，UI 是否仍保留原 orphan reference 供明確放棄，而非誤清勝出 UUID？ |
| P3-d | 損壞 journal 是否逐筆隔離、保留原值、不阻塞有效筆？quarantine 失敗有無丟失原值／整頁阻塞或錯誤成功？ |
| P3-e | verified reference JSON 是否反映真實 uploader/type/OCR，與 requested actor 分離？ |
| P3-f | 新相容性 baseline 是否偵測同名 policy expression／mode／ACL／helper／trigger event/timing/WHEN 等漂移？前端是否要求 20261102.2？明確評估「安裝時快照不能證明安裝前可信、不能對抗 DDL owner」，不能把 preflight 當權限控制。 |

**SHA256 占唯一索引維持另一張 OPEN 問題**：metadata 一致不證明內容類型或 server SHA 驗證。測試刻意保留格式合法偽造 hash 可占 unique key 的正例。
請核對此邊界仍如實記錄；不要因 metadata 修復關閉整個 S3 防偽議題，也不要將已知且另列 OPEN 的 hash 缺口誤稱本次新增。

## 主要檔案

- `backend/supabase/migrations/202611020002_storage_receipt_review_fixes.sql`（001 未修改）
- `backend/tests/integration/storage-receipt-review-fixes.test.js` 與 README（原 001 測試不刪改）
- `frontend/readdy-app/src/services/authContinuity.ts`
- `frontend/readdy-app/src/contexts/AuthProvider.tsx`、`authContextValue.ts`
- `frontend/readdy-app/src/services/documentIntake.ts`、`intakeRecovery.ts`、`documentService.ts`
- `frontend/readdy-app/src/pages/admin/documents/DocumentUploadPage.tsx`、zh/en/ja 文案
- `frontend/readdy-app/tests/authContinuity.test.ts`、`documentIntake.test.ts`
- `frontend/readdy-app/tests/browser/upload-intake/`（全部合成 fetch fixture；不是正式成功回退）
- `docs/delivery/evidence/storage-review-fixes/`（合成紀錄；檔案路徑／日誌尾端空白已正規化）

本機報告：前端 131/131、後端 16/16、隔離 SQL 183/183（review 61、原 Storage 32）、type/full lint/build PASS。
Chrome 的真實頁面搭配 useAuth／SDK fixture 驗證正常刷新、登入世代與專案邊界、原 ID 補登記及本機放棄。
原生選檔 BLOCKED；真實 AuthProvider＋Supabase Auth、JWT／Storage HTTP、實際 metadata、雲端 migration／backup／restore 全部 NOT_RUN／BLOCKED。請與來源缺陷分開回報。

## 回覆格式

每一列（S4-refresh、S4-complete、S4-discard、S3-metadata、P3-a～f）標示 **已解決／仍存在／證據不足**，附固定 SHA 的檔案行號、觸發條件、最小重現、現有／新增回歸與尚缺證據。
若有新 P1/P2，只限這些差異引入者，獨立列出；已接受的其他範圍不重開，除非有具體新證據。

治理提醒：001 缺 documents 時會建立 bucket，002 定義 private baseline table／functions／trigger／RPC 版本變更。套用均需 Owner 另行批准，不可由此文件或測試推定雲端授權。
複審完成不等於發布放行，最終裁定交 CTO。
