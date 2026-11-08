# Next action — 2026-11-08／N4原生SQL修復候選

- 專案目標進行中；RELEASE HOLD。正式UAT仍7dccd5452152f2495d10ad1437d5d03215166065，不合併main／不操作雲端。Owner已選Micro/預算/14天，最新CTO未授權建立，費用與保留時鐘未啟動。
- PR30 app33d3613487f42a7e9c5888ae312441e730d3d87e、PR31 app/SQL ed6ca9bbfbc5581cdcacf2969340575217fcb8c4；既有P2-1～3沿CTO來源關閉。N1/P2-4、N3仍WAITING_CLAUDE/CTO，固定原入口CLAUDE_N1_N3_REVIEW_QUEUE_20261107.md@a04a562ba869a2d079c3bcec1f9d45643f2b8055。
- PR32 tooling3bf945e2fef243472f9800de5708197c79fa3150／docs ddcc896612e57721f4116cbaef0290483321386f；CI42451102879 success。合成PDF/PNG/JPEG＋負例與現版驗收入口已交付，未真上傳或原生選檔。
- 新branch codex/native-pg-concurrency-20261108：產品da5a0990c8ec82d2b55064dd7e009b771409fa73僅加202611080001，delete request/finalize/release先project鎖後doc鎖，保留actor/ACL與撤權cleanup。工具b7bf83d4ea0e038262af1e9f9988e83db91dac84；前端/服務/Edge/modules與ed6相同。47來源＝44schema/3歷史fixture DML HOLD，模板deployment/uat/candidates/da5a0990c8ec/。
- 真PG17.11本機能力已具備：官方免安裝ZIP/hash驗證，中文路徑initdb失敗保留，ASCII-only專屬受限TEMP成功；127.0.0.1:55439/SCRAM、無系統service或PATH變更，5432/其他專案不動、不重試Docker/WSL。受限metadata位置../tooling/native-pg17-20261108/ascii-runtime.json，密碼不輸出。這不是Supabase UAT。
- baseline ed6真重現40P01，barrier釋放後兩actor天然cycle、observer不在cycle；candidate da5與獨立新DB各8namedPASS/9Lock（重疊不加總），guard2PASS另列。相關既有SQL/HTTP72＝71PASS/0FAIL/1SKIP，PGlite skip不替換native證據。catalog恰3變更/ACL-owner-config不變、漂移拒絕/rollbackPASS。兩個harness初敗22P02及provider-MANUAL命中均保留。
- N4只收斂具名本機schedule，仍WAITING_CLAUDE/CTO，不自行全域關閉。新補審入口CLAUDE_N4_LOCK_ORDER_REVIEW_20261108.md；Owner需轉交Claude，主代理未代發外部訊息。完整結果NATIVE_POSTGRES_CONCURRENCY_20261108.md及evidence/native-pg-concurrency-20261108/。
- 真JWT/Storage/managedEdge/ESZIP、其他鎖組合/負載、N5 React前景觸發、原生chooser/落盤、cloud migration/16 NOT VALID資料驗證/復原/19+1仍NOT_RUN。既有專案須重新計算才能新報告，舊重算可能失敗；不自動重算/補簽/覆寫歷史。
- 既有ed6/PGlite原App合成預覽（本輪GET登入與health皆200；不是da5 native DB入口） http://127.0.0.1:4215/login +API4214（重啟新ID）；不是Supabase登入帳號。操作及原固定截圖見ACTIVITY_REPLACEMENT_N3_DELIVERY_20261107.md。
- 下一條可執行命令（repo root，僅核對已建立專用本機PG，不造新DB）：`node backend/tools/native-pg-concurrency/run.mjs --probe`。接續核對新PR CI；無新缺陷/裁定不反覆跑舊套件。其後可沿已授權專用本機資源補DB備份還原證據，真Storage bytes另驗。Session保存接續狀態，不承諾無限背景運行。
