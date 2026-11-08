# Next action — 2026-11-08／F1 F2 N4-R1

- 專案目標：暫停／WAITING_CLAUDE_CTO；本批授權本機修復已交付，等待定向結果與CTO裁定。RELEASE HOLD，正式UAT基準7dccd5452152f2495d10ad1437d5d03215166065不變。未合併main／未部署／未操作雲端。
- PR35 draft：codex/replacement-provenance-fixes-20261108，產品固定040509777bb1cb60589a01ce7ec176a4ec54cee7；工具08162ca307f9336b635b77e7682de750e814a5f0。已fetch合併保留Claude b5772f4／4b00925。N1/N2/N5沿CTO來源關閉，N4僅原具名排程；F1/F2/R1此批候選待定向複審，不自行關閉。
- 已完成：私有ledger完整更正揭露／NULL confidence／report SQL核對，legacy只exclude且不升格，排除顯示不計入，分頁遺失後server找回原request／intent，普通draft先project鎖及fresh統計觀察。保留原前後台／路由／導覽／匯出及歷史列。
- 實測：backend44、FE241／type／lint／build；new SQL13／HTTP3。初全套390=386PASS/2錯誤碼FAIL/2NOT_RUN，窄修後受影響三檔41PASS（含13，不相加）；獨立原2fail→2PASS與SQL13、HTTP3／FE12／backend4同覆蓋。040原生PG主/獨立各4具名PASS/3真Lock，同範圍不加總。Deno16check/16staticbundle實跑99c233d，JS/TS/modules與040相同且hash核對。
- GitHub程式CI08162ca run42470929989 success：backend44／隔離整合388PASS+2NOT_RUN／FE241及type/lint/build。後續文件提交不偷換此程式CI版本。交付：REPLACEMENT_PROVENANCE_FIX_DELIVERY_20261108.md、evidence/replacement-provenance-20261108/EXECUTION.json；Claude入口CLAUDE_REPLACEMENT_PROVENANCE_REVIEW_20261108.md，只複審F1/F2/N4-R1與恢復／排除交集。請Owner轉交，未代發外部訊息。
- 現行預覽http://127.0.0.1:4217/login、API4216，040產品／081工具sourceDirty=false；final-preview-smoke-0405097.json列當次入口與ID。全合成factor1；100→120→exclude／3保存報告／6授權HTML JSON已實跑，最終120畫面有圖與DOM。99版實際關分頁／重登入找回原request另存，不能混稱最終版本同次UI實測。
- 啟動（repo root終端一）：先設定PGLITE_RUNTIME_ROOT為Resolve-Path '../tooling/sql-runtime'，再node backend/tools/product-preview/provenance-preview.js；終端二於frontend/readdy-app執行node node_modules/vite/bin/vite.js --config tools/local-preview/vite.replacement-provenance.config.mjs。兩服務只綁localhost且strict ports，不停他人程序；API重啟清本次記憶合成資料並有新IDs。
- 原生PG17.11/UTF8只127.0.0.1:55439，受限metadata ../tooling/native-pg17-20261108/ascii-runtime.json；密碼不進聊天/Git。新DB及raw evidence皆保留，既有5432/其他專案未動，不重試Docker/WSL。
- 49來源migration=46schema+3歷史fixture DML HOLD，清單deployment/uat/candidates/040509777bb1/。002/003未套雲端；既有專案須明確重算才能新報告，舊in-flight可能失敗；不自動重算／補簽／改歷史latest／覆寫報告。舊da5 backup/restore不是040完整復原證據。
- 未驗：UPDATE兩trigger間原生並行／其他鎖組合、真JWT/PostgREST/Storage bytes/Edge/ESZIP、原生chooser/下載落盤、現版完整backup/restore/cloud migration及NOT VALID歷史資料驗證、19+1。P3只排高精度witness／historical is_latest／effective view規範，不擴框架或改舊證據。
- Owner已選Micro／新增累計US$20／14天；最新CTO仍未授權雲端建立或費用操作，未建立且時鐘未起算，不重問同一預算。
- 下一條可執行命令（repo root，只讀）：git show 040509777bb1cb60589a01ce7ec176a4ec54cee7:backend/supabase/migrations/202611080002_replacement_provenance.sql。Claude/CTO回覆後先git fetch origin、核對工作樹並保留固定文件，再只重現新缺陷。真服務前另需具體target／操作授權；沒有新裁定不自開功能或重做整案。Session停止時保留此狀態，不承諾無限背景執行。
