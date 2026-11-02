# Upload-N1／N2 小修復與本機整合

2026-11-02。沿用 `codex/secure-upload-review-fixes-20261102`／PR #15。
基底 `049e5d69dc66e541981841c37683e44ecedbfc3b`：在原修復後加入完整 Claude 複審，只有文件，已 fast-forward 保留。
原審查與複審回覆未修改。本輪不是整案重稽核；發布維持 **HOLD**，UAT 仍為 `7dccd5452152f2495d10ad1437d5d03215166065`。
固定小修復來源與下一命令見 `NEXT_ACTION.md`。

## 可用行為

- **Upload-N1**：錯誤登入結束後，若沒有被其他登入／登出／到期或持久化失敗取代，恢復畫面原先仍有效的 session，並建立新的操作 epoch 使頁面重新讀取；登入前的上傳不會復活。action 與 epoch 兩道比對不容許舊錯誤覆蓋新的 session。已過期的 retained session 轉成 null。
- 到期清除使用與 React state 同步更新的 `publishedSession` 身分，而不依賴曾為登入意圖失效的 continuity。即使登入仍在進行／失敗，持有的 session 到期仍會清除；更新後的 session 不受舊 session 計時器影響。原 sessionGate、持久登出及 captured-session 撤銷機制保留。
- **Upload-N2**：對驗證、雜湊過的同一份 bytes 建立 canonical MIME 的新 File，保留原始 filename／lastModified；實際 SDK FormData part 的 type 與 receipt MIME 一致。PDF／PNG／JPEG 不變，瀏覽器回報 `image/jpg` 的 JPEG 使用 `image/jpeg` 上傳。沒有放寬 SQL、MIME metadata guard、既存原檔核對或伺服器授權。
- 補上 [維運 runbook](../operations/UPLOAD_COMPATIBILITY_RUNBOOK.md)：平台／PG 升級後 fingerprint 漂移、診斷、保持 fail closed、經審查與 Owner 核准的增量 baseline 更新、監控未驗邊界與回復程序。
- CTO 可移植模組規範已寫入 [AGENTS.md](../../AGENTS.md) 及 [開發規範](../development/PORTABLE_MODULES.md)：各產品獨立配置執行、provider/storage adapter、完整 OCR 輸出與產品層判讀、可獨立升級版本、移交保存。未建立中央 API／新套件平台，也未全面重構既有程式。

## RED／GREEN 與測試界線

| 版本／環境 | 命令／操作 | 實際結果與證據 | 未驗範圍 |
| --- | --- | --- | --- |
| 049e5d6 原 Provider＋新增全合成整合入口，Chrome／localhost:4190 | 已登入後執行錯誤登入 | RED：session present/current=true，但 operation current=false，上傳頁 Failed to load；[AX](evidence/upload-n1-n2/red-failed-login.ax.txt) | 非真實 Auth server |
| 同上，expiry scenario | 取得 12 秒合成 session、錯誤登入、等待到期 | RED：session 仍 present/current=false；[AX](evidence/upload-n1-n2/red-expiry-after-failed-login.ax.txt) | 不呼叫真實 provider，不做外網 JWT 驗證 |
| 舊 documentIntake＋新增 multipart 測試 | `node --test --test-name-pattern=Upload-N2 tests/documentIntake.test.ts` | RED：1/1 失敗，image/jpg 的 FormData part.type 實為 image/jpg，預期 image/jpeg；其他三格式先通過 | storage-api 實際 metadata 行為未驗 |
| 本小修復，Node 24.22.1／既有 lock 依賴 | `node --test tests/*.test.ts` | **134/134 PASS**；比上批新增 N1 2 項、N2 1 項（四格式） | 不等同真實 RLS／JWT 或商用驗收 |
| 本小修復 | `tsc --noEmit --project tsconfig.app.json`、完整 `eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0`、`vite build` | **全 PASS**，未關規則 | build 不是部署 |
| 本小修復，真實 AuthProvider/useAuth/documentService／installed SDK，Chrome 合成 fetch | 錯誤登入後再選 image/jpg 合成檔並按 Upload | GREEN：恢復有效 session；物件 1／收件 1、stored MIME=image/jpeg，原 filename 保留；[AX](evidence/upload-n1-n2/green-real-provider-upload.ax.txt)、[截圖](evidence/upload-n1-n2/green-real-provider-upload.png) | 原生選檔仍 BLOCKED，合成 JPEG 只有測試 header，不證明完整影像解碼 |
| 同上，expiry scenario | 短效 session、錯誤登入、等待到期 | 失敗後 operation current=true；到期 session none；[恢復](evidence/upload-n1-n2/green-failed-login-valid-session.ax.txt)、[清除](evidence/upload-n1-n2/green-expiry-after-failed-login.ax.txt) | session 由本機 fixture 產生 |
| 同上，refresh scenario | Storage 回應前以真正 SDK refreshSession 產生 TOKEN_REFRESHED | epoch 維持 1；refreshes=1、物件 1／收件 1、MIME=image/jpeg；[AX](evidence/upload-n1-n2/green-real-sdk-refresh-upload.ax.txt) | HTTP／JWT server 全被攔截；不是 Supabase E2E |

實際執行模組與前一批不同：本次沒有替換 useAuth 或 documentService，掛載真實 AuthProvider／sessionGate／continuity／持久登出 storage wrapper 及 SDK。
只替換 lib/supabase 連線工廠／測試設定、layout 與 staging 來源；用已安裝 SDK 的全攔截 fetch，僅接受 `https://synthetic-auth-upload.invalid`。
合成 session 儲存在測試 Map；檔案由瀏覽器記憶體建立，沒有取用主機企業檔案、正式 .env、真實憑證或外網資料。
這補強了既有本機整合的 AuthProvider 邊界，不能替代真實持久儲存／跨分頁或授權環境驗收。

## 獨立代理審閱

`/root/review_upload_n` 未參與本批實作，只讀基底 049e5d6 以後的核心差異、測試、合成入口與上述兩份指示／runbook。
未發現可證明的新增 P1／P2／P3。獨立執行
`node --test tests/authContinuity.test.ts tests/authSessionGate.test.ts tests/authPersistence.test.ts tests/documentIntake.test.ts`：
**42/42 PASS**；type-check PASS。42 是 134 的子集，不另加總。
該代理未操作 Chrome、未獨立執行完整 134 項或雲端驗收；瀏覽器證據由主代理執行，並非外部 Claude 複審或 CTO 放行。
N2 實作代理與這位 reviewer 為不同代理。

## 保留限制與後續

本輪未修改 backend/migration。先前 SQL 183／backend 16 保留為原來源證據；本輪 CI 的新版本結果另查，不以舊數字冒稱新實測。
N1／N2 是來源修復與本機證據；原 S3／S4 最終關閉仍由 CTO 裁定，SHA／內容型態的伺服器 attestation、假 hash 占用唯一索引及歷史不一致資料仍 OPEN。
沒有雲端 migration、bucket 建立、資料／物件清理、真實上傳、費用、main 合併或部署。

接續已完成真實 Provider＋SDK＋upload 的本機整合；下一項沿既有流程補 document→人工確認→計算→report snapshot 的本機契約／合成隔離整合證據。
不將 synthetic draft 當 OCR 成功，不自動啟動 Mock 分類／正式處理；新外部 provider、資料外送及真正環境寫入仍需獨立決策。
