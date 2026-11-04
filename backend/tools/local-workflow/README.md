# 本機單一路徑：收件 → 人工確認 → 計算 → 快照

SYNTHETIC ONLY。這是 repo 內的 lab 工具，使用新記憶體 PostgreSQL 實際保存資料與 ID 鏈。
**正式「收件 → 非 Mock 草稿」入口仍 MISSING**；本工具明示採人工轉錄 adapter，receipt OCR 保持 pending，不執行 Mock provider。
這不是正式前端、Edge HTTP 或 Supabase 服務驗收。

## 啟動方式

從 repo 根目錄執行，Node 24，使用本工作區已安裝的 @electric-sql/pglite 0.5.13：

~~~powershell
$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path
node backend/tools/local-workflow/run.js
~~~

實際啟動後會列印 http://127.0.0.1:4191/、checkout SHA；頁面顯示啟動時是否有未提交差異。
不需要 Docker、WSL、5432、.env、Supabase key、OCR／AI provider 或新付費服務。4191 若被占用會明確失敗，不停止其他專案。

其他主機把 PGLITE_RUNTIME_ROOT 改為自己的固定 runtime 絕對路徑。若沒有 runtime，用既有 npm 在專用目錄安裝公開固定依賴：
~~~text
npm install --prefix <dedicated-runtime-directory> @electric-sql/pglite@0.5.13 --ignore-scripts --no-audit --no-fund
~~~
Linux/macOS：PGLITE_RUNTIME_ROOT=/absolute/runtime node backend/tools/local-workflow/run.js。
Ctrl+C 停止此記憶體實驗；停止後資料與 bytes 消失，不會 reset 或清理既有資料庫。

## 四步操作

1. 按「1 保存合成收件」。合成 PDF bytes、Storage catalog 與真正 uploaded_documents 寫入成功後讀回；OCR=pending，bytes 寫入一次。
2. 核對 100 kWh、2026-01-15，勾選人工確認，按「2 確認人工資料」。本機 bridge 寫入 provenance 為 LOCAL_MANUAL_TRANSCRIPTION_NO_OCR 的草稿，再執行既有確認 helper／原子 RPC。活動保存後，缺係數的計算為 pending_factor／NULL。
3. 按「3 套用合成係數並計算」。建立 SYNTHETIC custom 係數 0.5 kgCO₂e/kWh（不是官方係數），既有 recalculate_project＋原子 RPC 保存版本 2：100 × 0.5 = 50 kgCO₂e。
4. 按「4 保存報告快照」。核對來源 ID／原檔／唯一最新 calculated，既有 report helper＋原子 RPC 保存並讀回快照，顯示 50 kgCO₂e = 0.05 tCO₂e。可展開資料／migration，下載實際保存的 JSON。

先按 4 會 REPORT_NOT_READY，report 仍為 0。重按成功步驟核對同一 run 的 ID；改用不同人工數值則 REVIEW_CONFLICT。
合法 0 kWh 也必須完成真正計算才能顯示 0；缺係數不是 0。計算被改成 pending 後，舊 report 只標為歷史，不能當目前總量。
本例介面限於用電量、2026 日期、kWh、scope 2，不是通用 OCR／財會產品。

## CLI 與測試

~~~powershell
$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path
node backend/tools/local-workflow/run.js --run
node --test backend/tests/integration/local-workflow.test.js
~~~

--run 使用同一 engine 四步，輸出 JSON：checkout SHA/dirty、每步數量、latest 計算、真正資料列、scope、migration 清單與來源 SHA256、缺口。
不會另寫檔案。需要保留時自行將 stdout 導向專用證據檔。

## 實際來源與替身

| 階段 | 實際執行的既有來源 | lab adapter／未驗範圍 |
| --- | --- | --- |
| 收件 | 001／002 path、RLS、metadata／receipt trigger、version RPC，非 BYPASSRLS authenticated INSERT | bytes 在 Map，Storage catalog/auth.uid 替身；未執行正式 upload UI／SDK／Storage HTTP |
| 人工確認 | validateConfirmDraftInput、confirm_draft_to_emission_activity、calculate_emission_activity、confirm_draft_atomic | 明示人工轉錄 pending_review draft；本機 service_role，非真 JWT／Edge 授權 |
| 計算 | 實際因子選擇、recalculate_project、原子 recalc RPC、SQL version/latest | 合成係數；PGlite NUMERIC 字串只在 lab read adapter 轉 number，不修改 production helper |
| 快照 | build_report_payload、generate_report_atomic、DB 重讀與 lineage | lab gate 拒絕缺計算；lab transaction 包 RPC＋summary patch。正式 handler 是兩階段，本輪未證明它具相同原子性／guard |

載入所有 schema 行為 migration，僅排除三份既有資料 fixture seed；清單隨 inspect／CLI 輸出。這不是完整 Supabase cold-start／upgrade／restore。
fixture grants、auth subject 與 service_role 只存在新記憶體 DB；不修改原始 migration 或雲端權限。
fault hook 不暴露 HTTP。local queue／readback 只證明同程序同 run 防重送；production RPC request_id 仍只記 audit。
真正 SQL 錯誤會回滾並保留原錯誤碼，清理不以 25P02 遮蔽原因。

## 保留缺口

正式非 Mock 草稿入口、真 OCR／分類、server hash／內容辨識、production 冪等性、report RPC→patch 部分成功風險仍 MISSING／OPEN。
真 JWT／Storage／Edge HTTP／跨分頁持久化／雲端 migration／備份復原／UAT NOT_RUN。
發布 HOLD，UAT 基準仍 7dccd545…，未合併、雲端操作或增加費用。
固定版本、實測與獨立審閱見 docs/delivery/LOCAL_WORKFLOW_DELIVERY_20261104.md 及 NEXT_ACTION.md。
