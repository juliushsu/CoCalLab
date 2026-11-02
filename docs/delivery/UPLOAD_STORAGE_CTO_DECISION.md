# 安全上傳與收件紀錄：CTO 核對文件

日期：2026-11-02。來源基準：`be23b32654c222cb51d7458669cf6d93364fc0fd`。
下列為 PR #14 的原相容性方案；後續審查修復改用契約 `20261102.2`，具體修正與 OPEN 邊界見 [修復交付](STORAGE_REVIEW_FIX_DELIVERY_20261102.md)。S3／S4 及發布 HOLD 未解除。完整原審查已由使用者公開至固定版本 [f763689](https://github.com/juliushsu/CoCalLab/blob/f76368953d4f952632f4356c4d7ccbccd46cd5c2/docs/delivery/CLAUDE_STORAGE_REVIEW_REPLY_20261102.md)，不需依賴跨主機本機路徑。
本公開版本只含 repo 來源、通用路徑與工程方案；不含帳戶、專案 ref、企業資料、憑證、JWT、金鑰或付款資料。

## 授權與驗證邊界

CTO 已授權本機來源修正、增量 migration、合成隔離測試及一個功能 PR。
雲端 migration、既有物件搬移／刪除、真實上傳、建立雲端資源與 Production 部署均未授權。
發布維持 HOLD；UAT 基準仍為 `7dccd5452152f2495d10ad1437d5d03215166065`。
正式環境的 bucket、policy、物件、資料內容及部署版本皆未經本輪驗證。

## 已有來源與路徑

| 來源 | 可證實內容 | 本輪處置 |
| --- | --- | --- |
| `202603180005_v1_staging_storage_isolation.sql` | 定義 private `staging-receipts`／`staging-attachments`；租戶邊界需補強 | 增量修正並檢查完整 policy 合成效果 |
| `documentService.ts` | receipt 使用 `staging-receipts`，其他類型使用 `staging-attachments`；路徑 `staging/{projectId}/{filename}` | 保留 prefix；新檔用唯一收件 UUID 檔名 |
| 同上 Production 分支 | bucket `documents`，路徑 `{projectId}/{filename}` | 雲端存在與權限 UNKNOWN，不自行建立或啟用 |
| `202603160001_v1_core_schema.sql` | `uploaded_documents` 已有收件欄位；同專案 SHA256 唯一 | 沿用資料模型，不提供假的重複覆寫成功 |
| `202603180001_v1_staging_hardening_columns.sql` | 存在 `env`／`is_test`；有 staging 預設 | 新收件兩種模式皆明填，避免 Production 誤標 |
| `202610310004_tenant_relationship_integrity.sql` | 新寫入具有 org/project 關聯檢查，約束為 NOT VALID | 不宣稱歷史資料已驗證，不修補既存資料 |
| 本輪 `202611020001_secure_upload_storage.sql` | 來源定義租戶 guard、收件防偽及唯讀版本契約；缺少 `documents` 時定義 private bucket | 只在合成隔離引擎執行；雲端建立／套用仍未授權 |

以上檔案均位於 `backend/supabase/migrations/`；前端服務位於 `frontend/readdy-app/src/services/`。

## 單一功能範圍

1. 用現有使用者 session 上傳原始 PDF／影像，保存並核對 `uploaded_documents` 收件回執。畫面明示「檔案已保存，OCR／分類尚未執行」；不呼叫 Mock、不產生草稿、計算或報告。
2. 新物件保持既有 bucket/project prefix，檔名為 `{documentId}.{extension}`，`upsert:false`。真正計算檔案 SHA256；核對 org/project/user、MIME、大小、bucket、path、回傳 ID 與 hash 後才顯示成功。
3. Storage 依現有專案所屬組織及活躍會員判定。讀取與寫入角色分開；寫入／刪除沿用 owner/admin/editor 與組織可寫訂閱契約。用 restrictive guard 防止其他 permissive policy 合併後放寬本專案 bucket。
4. 不覆寫／重新命名已存在物件；不搬移、刪除或重標歷史資料。不符合安全路徑的歷史物件先盤點，再由 Owner 決定，不以自動修復處理。
5. Storage 與資料列並非同一交易。檔案已保存而資料列失敗時保留唯一 attempt/document ID 與路徑；回應遺失先唯讀核對。結果不明則鎖定重送，不假報未保存，也不盲刪可能已被引用的檔案。
6. 傳 bytes 前必須取得 `upload_intake_contract(project)` 的固定版本 `20261102`、相符 org/project 與可寫結果。舊部署缺少 RPC 或 bucket／RLS／guard／trigger 不完整時，前端停止傳檔；不靠開關假設 migration 已套用。
7. 每個 attempt 有獨立、按使用者與專案讀回的瀏覽器恢復 key，先核對持久保存才送 bytes；跨分頁保存／清除不重寫其他回執。未確認同內容先核對原 attempt。既存收件重用還須以私有 download 核對原檔大小及 SHA256，回執保留實際上傳者與文件類型。

## 相容性與驗收

- 保留合法舊路徑的同租戶讀取；新增路徑限制只適用新寫入。未知命名、大小寫 UUID、歷史孤兒物件與已不一致紀錄須各自列出是否支援，不能冒稱已盤點正式資料。
- 舊合法單一 basename 的讀取／授權刪除保持相容；未知 `staging/fixtures/` 類前綴與巢狀目錄不猜租戶。前端不自動重用含反斜線／百分號等可能有 URL 正規化歧義的舊 path，交 Owner 盤點；不搬移或刪除。
- 新收件一律先保存 `pending`／`active`，前端不得更新收件列以宣稱 OCR 成功；服務維護角色仍可處理。新 Storage UPDATE／rename／upsert 被拒絕，既有檔案不被覆寫。
- 增量 migration 不執行物件搬移或歷史資料重寫。若發現既有 bucket 為 public 或來源預期不符，採明確停止，先交 Owner 核對；不得默默改變既有公開性。
- 合成 SQL 測試涵蓋雙租戶讀／寫／刪除、合法角色、viewer／inactive／readonly、路徑偽造、覆寫／rename 與額外 permissive policy。SDK 測試涵蓋實際請求、拒絕、檔案成功但資料列失敗及回應遺失。
- PGlite 的 Storage catalog 替身只證明來源 SQL／RLS 行為；不能替代真實 Supabase Storage HTTP、JWT 驗證、簽名網址、物件內容、瀏覽器上傳或完整 migration／復原驗收。未執行者仍標 NOT_RUN／BLOCKED。
- 本機恢復參考只保存必要 metadata／hash／路徑，不含原始檔案或憑證；不是跨分頁同內容交易鎖，也不保證使用者清除瀏覽器資料後仍能復原。兩分頁同時首次提交相同內容仍可能留下需核對的孤兒物件；DB 同專案 hash 唯一性保護收件列，不自動清理物件。

## 定向審查與回復方式

完成後以固定 PR commit 交 CTO 安排 Claude，只審 Storage／收件差異：完整 policy 合成、合法舊路徑、跨租戶與角色拒絕、收件身分不可竄改，以及部分失敗／不明結果的處理。
尚未核准的雲端套用、正式 bucket 配置、既有物件清理及真實上傳均留在獨立授權關卡。

回復先停用新上傳入口並回退應用程式；已保存物件與資料列不會隨程式回退消失。
任何資料補救都需先盤點本次收件 ID／路徑，取得對具體環境與對象的授權；不得以測試名義 reset、seed、刪除或還原既有資源。
