# 安全檔案上傳與收件紀錄 — 2026-11-02

候選：PR #14／`codex/secure-upload-receipt-20261102`，基於 PR #13 固定版本 `be23b32654c222cb51d7458669cf6d93364fc0fd`。
本輪固定來源 commit：`71ffcf47defef31236181f8b938fc005f46dcb71`；之後僅補交接／審查文件。定向指令見 `CLAUDE_STORAGE_TARGETED_REVIEW_20261102.md`，尚未收到外部 Claude 審查結果。
只有來源與合成隔離測試；未合併、未部署。發布 HOLD，UAT 仍為 `7dccd5452152f2495d10ad1437d5d03215166065`。

## 可操作行為

- 專案選擇使用真實 JWT/RLS 查詢；URL 範圍衝突、無權限、讀取失敗、空資料分別顯示，不選第一個組織代替。寫入前驗證 `getUser` 與畫面使用者相符，再取得版本化、精確 project/org 的唯讀 capability；舊部署不具備完整新 Storage 邊界時不送 bytes。
- 原始 PDF/JPEG/PNG 具有檔案大小、MIME／副檔名／signature 檢查；計算實際 SHA256，使用預先生成的 UUID、安全物件名及 `upsert:false`。收件明填 env/is_test、使用者、org/project、檔案資訊，核對持久回傳結果後才成功。本次不呼叫 OCR／分類、Mock、計算或報告。
- 既存相同內容須核對私有原檔的大小與 SHA256 才重用；孤兒列或缺檔不報成功。回執分開保存本次 actor 與實際 record 上傳者／文件類型／OCR 狀態。摘要計數為已核對的選取項目，不偽稱新增多筆收件。
- bytes 前以每 attempt 獨立 localStorage key 保存恢復 metadata，讀回確認後才送出。重載／同使用者重新登入／切回專案可恢復未確認回執，其他使用者／專案不顯示。同內容有未確認 attempt 時只核對，不另送檔。清除一個回執不會覆蓋其他分頁的 checkpoint。
- 檔案可能已保存但資料列失敗時顯示未確認，保留 UUID/path 供下載參考與唯讀核對；不自動 DELETE、不盲目重送。回應遺失後找到正確列並核對原檔可恢復成功。已有送出請求可能仍提交，切換 context 不冒稱取消。
- UI 有 loading、空資料、拒絕、成功、失敗／未確認與核對操作；新增文案均有 zh/en/ja。保留拍照／相簿／檔案／拖放入口與既有人工活動建立導向，Excel 匯入仍明示未提供；僅移除上傳後自動 Mock 處理。

## Storage／資料庫來源

`202611020001_secure_upload_storage.sql`：三個專屬 bucket 的 restrictive PUBLIC guards 與現有 permissive policy 合成；讀取依專案所屬活躍組織會員，寫入／刪除依既有 owner/admin/editor 與訂閱可寫契約。新檔名 UUID v4；合法單 basename 舊路徑可讀與授權刪除，不搬移或改寫歷史物件。拒絕 UPDATE／rename／覆寫，其他 bucket 不改。

收件 trigger 校驗 uploader、ID/path/org/project、初始狀態、env/test、物件存在與 uploader ownership；authenticated 不能更新收件列，服務維護保持。SQL 只驗 SHA 格式，不能證明 hash 對應 bytes。來源 migration 定義缺少時的 private `documents` bucket，任何既存 protected public bucket 會原子中止；這不構成雲端建立授權。

一般新物件上傳僅需 INSERT，upsert 另需 SELECT／UPDATE，與此候選的不可覆寫設計相符；實際 Storage 版本行為尚待隔離環境驗收。[Supabase 官方存取控制文件](https://supabase.com/docs/guides/storage/security/access-control)

## 實際測試與證據

| 範圍 | 本機結果 | 實測內容 |
| --- | --- | --- |
| 前端 | 116/116 PASS（新增 17 項） | 安裝版 SDK 的 Auth／RPC／Storage／REST 請求、真 bytes/hash、三模式 bucket、錯誤與跨 scope、部分失敗／遺失回應、既存缺檔、恢復持久化與多分頁交錯、三語鍵 |
| 後端 JS | 16/16 PASS | 既有核心／契約服務回歸；未以 Mock provider 通過當成真 OCR 完成 |
| SQL 隔離全套 | 122/122 PASS，其中 Storage 32/32 | 新引擎中載入 30 份前置 migration（僅略 3 份 fixture data SQL），再載入本輪 migration；非 superuser／非 BYPASSRLS 實際角色操作 |
| Storage SQL | PASS | 三 bucket 同／跨租戶讀寫刪、viewer/inactive/invited/readonly/archived/suspended、路徑偽造、額外寬鬆 policy 不能放行、ownership／收件偽造、membership 中途撤銷、錯誤歷史 org/project/path 不讀不刪且原列保留、UPDATE／rename、public drift 與 capability 缺 guard/RLS/trigger |
| 品質檢查 | PASS | app type-check、全 src ESLint 零 warning、Vite build、diff check；build 有既有 Browserslist 資料過舊提示 |
| Chrome 真 React＋攔截 SDK | 合成流程 PASS | browser-memory File 經真 input change handler：成功 object/row 各一次；row failed 後重載同 UUID 仍在、唯讀核對成功寫入仍各一次；舊 contract 禁用且零寫入 |
| 主機檔案 chooser | BLOCKED | 擴充套件要求 Allow access to file URLs；未更改設定、未繞過安全限制，未宣稱主機檔案送出成功 |
| 真實 Supabase／Storage／JWT／正式資料 | NOT_RUN | 未授權雲端操作或真實上傳；沒有對既有 5432/Docker/WSL 重試 |

重現命令（repo root）：

```powershell
# 先將 PGLITE_RUNTIME_ROOT 指向 repo 外已安裝 @electric-sql/pglite@0.5.13 的專用目錄。
node --test --test-concurrency=1 backend/tests/integration/*.test.js
node --test backend/tests/*.test.js
```

前端從 `frontend/readdy-app` 執行 `node --test tests/*.test.ts`、`node node_modules/typescript/bin/tsc --noEmit --project tsconfig.app.json`、`node node_modules/eslint/bin/eslint.js src --ext ts,tsx --report-unused-disable-directives --max-warnings 0`、`node node_modules/vite/bin/vite.js build`。
瀏覽器明確合成 harness：`node node_modules/vite/bin/vite.js --config tests/browser/upload-intake/vite.config.mjs`（僅 127.0.0.1:4189，所有 SDK fetch 攔截，測試入口不載入正式 `.env`）。初始畫面與中途 loading 亦已觀察。

SQL 詳細範圍見 `backend/tests/integration/storage-upload-rls.README.md`。本機截圖／AX 保存在 repo 外 `../evidence/secure-upload/`；公開測試程式及此操作記錄足以重現，不含真實企業檔案或憑證。

## 保留限制與下一關

Storage／收件非原子，journal 不是全域交易／跨分頁同 hash 鎖；同時首次提交可能留下一個需要人工核對的物件。沒有自動 orphan 清理。瀏覽器清除／損毀 metadata 可能妨礙恢復；不可用時拒絕新傳檔，原始檔案及 token 不寫入 journal。

未驗真實 JWT 驗證、Storage HTTP／實際 ownership catalog／簽名預覽／刪檔 API、原生 chooser、OS 下載、既存資料盤點、完整 Supabase migration／備份還原。既有文件列表的 public URL／整體刪除流程不是本輪完成項目。PGlite 的 catalog/auth 替身不能替代上述服務驗收。

去敏感相容性文件：`UPLOAD_STORAGE_CTO_DECISION.md`。完成後只交 CTO 安排 Claude 定向審查本 PR 的 Storage／收件／恢復差異；不重做整案稽核。雲端 migration、bucket 建立、既有物件搬移／刪除、真實上傳及 Production 仍需 Owner 另行授權。
回復先停用入口、保留 restrictive guards 再準備 forward fix；不可把移除 guards／清除物件當安全 rollback。
