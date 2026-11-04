# 本機單一流程交付

2026-11-04。基底 327cba227a403737131fdf82012c57f28802151b，PR #15 候選保留。
新分支 codex/local-workflow-20261104，PR base 為 PR #15 分支；只新增 lab 工具、必要測試及文件，不修改 production helper、schema、權限或雲端。
固定程式 SHA、證據版本及下一條命令見 NEXT_ACTION.md。發布 HOLD；UAT 仍為 7dccd5452152f2495d10ad1437d5d03215166065。

[啟動與四步操作](../../backend/tools/local-workflow/README.md)：瀏覽器 http://127.0.0.1:4191/，或相同 engine 的 --run。
合成原始收件 → 明示人工轉錄／確認 → 實際計算 → SQL 報告快照。
100 kWh × SYNTHETIC custom 0.5 = **50 kgCO₂e = 0.05 tCO₂e**。各步真正保存並重讀 receipt/draft/activity/calculation/report 及來源 ID，缺計算不補零，合法零有正例。

**正式缺口 MISSING**：既有 upload-only 不會建立可確認的非 Mock draft。本頁用明示的 LOCAL_MANUAL_TRANSCRIPTION_NO_OCR 測試 adapter 接續人工資料，receipt.ocr_status 保持 pending。
沒有執行 Mock OCR／分類；不把人工橋接當成已完成的正式入口。

## 分工與測試

- 主代理串接既有 Storage／receipt SQL、確認／計算／report helpers 與 SQL atomic RPC，提供四步本機頁面與 CLI。
- 子代理 /root/review_export 只新增 local-workflow.test.js。
- 獨立代理 /root/review_upload_n 未參與實作，唯讀審閱 engine/server/UI/tests，獨立執行測試及拒絕型 HTTP 檢查；不是外部 Claude 審查。

獨立 reviewer 發現一項 P3：SQL overflow 後 RESET ROLE 的 25P02 遮蔽原始 22003。
新增測試先 RED，再修復清理程序保留原錯誤；交易、role 回復與合法 retry 都通過。修復後未再發現本輪可證明的新增 P1／P2／P3。

| 實測 | 結果 | 界線 |
| --- | --- | --- |
| node --test backend/tests/integration/local-workflow.test.js | **14/14 PASS**，測試代理及獨立 reviewer 均跑過 | 14 是下列 197 的子集，不加總 |
| PGLITE_RUNTIME_ROOT=<runtime> node --test --test-concurrency=1 backend/tests/integration/*.test.js | **197/197 PASS** | 合成 SQL，非真 Supabase |
| node --test backend/tests/*.test.js | **16/16 PASS** | 既有 mock provider 測試不證明真 AI；lab 沒呼叫 provider |
| node --check engine.js / run.js；git diff --check | PASS | 未修改前端 app，不把舊 134 項當成本輪本機重跑；CI 另核固定 HEAD |
| loopback HTTP | state 200；錯 Host／跨 Origin／缺 Origin／錯 Content-Type 拒絕；外帶 scope 拒絕 | 固定本機程序，非正式 Auth／RLS HTTP |
| Chrome 四步、CLI --run | 固定版本的實際 IDs、pending→calculated、snapshot 證據隨後收錄 | lab UI，未驗正式前端／Edge handler |

14 項包含 persisted roundtrip、pending_factor NULL、真零、補登記不重傳、review/recalc/report 交易回滾、SQL overflow、commit 後回應遺失、同 run 並行 review、不一致輸入、歷史 report 與 service-only RPC ACL。
檢查真正 DB rows／數量／is_latest／factor／report，沒有把 fault 轉成假成功。
local queue/reconciliation 不能外推 production 跨程序冪等性。

## 來源與驗證邊界

收件跑真正來源 SQL guard，但 bytes 是 Map、Storage catalog/auth.uid 是替身，沒有執行正式 upload UI／SDK／Storage HTTP。
確認／計算／報告使用本機 service_role 呼叫原子 RPC，不是部署的 Edge handler／JWT 授權驗收。
PGlite NUMERIC 字串只在 lab adapter 轉數值。沒有更改 core model 或為共用而重構。

既有 report helper 對缺計算有變零風險，lab gate 拒絕缺值；正式報告 handler 未因此修復。
正式 generate-report 是 RPC 先建立 completed row 再 patch summary；lab 把兩者包在本機交易，不能把 rollback 證據外推正式兩階段。
Hash 防偽、正式重送、真實服務驗收、migration／復原仍 OPEN／NOT_RUN；bucket/baseline/雲端寫入未授權。

停止程序即結束本次記憶體實驗；不連既有 5432、不重試 Docker／WSL、不清理其他專案。
回復只需停止本機工具並切回 PR #15 候選，沒有雲端 migration／資料還原。

## 固定版本實測證據

固定程式 **a4d28ed7cd6302bb89f7af7253335228ee3e6801**。CLI 與 Chrome 皆在此 SHA、啟動時 checkoutDirty=false 實測；本節及 evidence/NEXT_ACTION 是後續文件提交，不修改工具程式。

- [CLI 完整四步與資料列](evidence/local-workflow-20261104/cli-run.json)：每步數量、pending_factor／NULL → calculated／50、32 份已載入 migration 及來源 SHA256；三份 fixture seed 排除清單同檔保留。
- [瀏覽器 run 的 DB 重讀](evidence/local-workflow-20261104/browser-run.json)、[實際保存的 report JSON](evidence/local-workflow-20261104/saved-report.json)。CLI 與瀏覽器是兩個獨立新 run，ID 不同，不混用。
- 瀏覽器 ID 鏈：receipt 3988a89e-cca3-4cbf-b2c9-f61a6d8bea10 → draft 6c4e735d-e963-4a32-a6ce-133474201bf5 → activity b2ff3cbf-2ba6-4cea-bc6c-01bed62c8682 → report 47ddb83d-8c3b-4799-8d4c-589eae0f2ed5；完整 calculation IDs 在 JSON。全部為合成隨機 ID。
- [人工確認後 NULL](evidence/local-workflow-20261104/02-manual-pending.ax.txt)、[報告拒絕](evidence/local-workflow-20261104/03-report-blocked.ax.txt)、[四步完成 AX](evidence/local-workflow-20261104/04-complete.ax.txt)、[完成截圖](evidence/local-workflow-20261104/04-complete.png)。Chrome 操作由主代理執行，不算獨立 reviewer 操作。
- 獨立 reviewer 已把相同來源差異與審閱結論對照至此固定 SHA；實跑 14/14 及 HTTP 拒絕案例，未發現其他本輪可證實 P1／P2／P3。

本輪啟動的 loopback 示範可在執行主機查看；不是遠端／正式網址。停止程序後可依 README 以同一 SHA 重新產生新 run。
