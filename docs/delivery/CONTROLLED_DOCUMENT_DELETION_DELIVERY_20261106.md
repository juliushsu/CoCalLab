# 受控刪除與完整本機流程交付 — 2026-11-06

固定程式 **1b1e82913ee593f4255eb33a92744d597c530b2c**，branch codex/controlled-document-deletion-20261106。Business baseline06bad0818625bd9d4f3b685dff50994157b52757；保留後續文件，沿hash411a99d、recalc67e546f接續。這是本機來源候選；未合併main／部署／操作雲端或正式資料。**RELEASE HOLD，UAT仍7dccd5452152f2495d10ad1437d5d03215166065。**

## 可用行為

刪除改用服務端持久操作：prepare保存scope/JWT actor/固定request UUID/物件generation、owner、完整metadata與intent，先fence新引用，再精準處理Storage原件，最後同SQL交易封存回執、完成作業與audit。保留receipt row、舊hash證明及刪除request ID；不宣稱把回執硬刪，也不宣稱跨服務atomic。所有普通角色的protected Storage直接DELETE/overwrite及receipt硬刪均拒絕，舊client兩步刪除無fallback。

pending會區分prepared與object_absent；原件可能已移除，不能假成功或宣稱SQL rollback已復原bytes。403、空ACK、錯誤及丟回覆均保留原作業，lookup/retry不換ID。original_missing明示開始時已缺原件；not_found的存在欄位為null，不推定原件有無。正常receipt path由server取得；未登記原件必須本人owned/canonical路徑或本人reservation，模糊及其他人裸物件拒絕。

未登記清理綁expected_receipt_absent:true：另一分頁已完成收件時409，不刪新回執；prepare先到則後續verify/receipt/MANUAL寫入拒絕。corrupt delete journal可精準captured-raw明確放棄，保留原intake參考；之後readonly locate只找同actor/scope/doc/mode/path的原request，不建新作業、不接手別人的操作。正常pending receipt亦提供server deletion_request_id；知道UUID不會取得權限。

引用保護涵蓋所有版本／狀態draft（含全部MANUAL歷史）、直接及draft間接活動、保存report appendix、processing及共用receipt path。INSERT/UPDATE與service流程均fence；報告UUID按語意處理大小寫，歷史缺失／畸形來源索引failclosed，不自動修資料。process-document在provider/read之前取得持久lease，finish重查權限／latest subscription／doc fence再call既有RPC並釋放；已知結束的失敗精準release，crash或release失敗保留阻擋，無TTL。這沒有啟用OCR／AI或外部provider；既有Mock及其重試語意仍OPEN。

只有完成受控deleted的tombstone釋放可信hash unique位置；其他archived／跨環境衝突保持既定語意。舊ID／原路徑不可重建或verify復活。前端保留原入口，新增核對／重試與精準本機參考恢復，pending/deleted不能預覽、下載或新轉錄。歷史hash明示為曾驗證，不當作原件仍可用。

## 實測

主代理完整本機驗證：**FE219/219、backend27/27；SQL/HTTP294 cases＝292 PASS／2 explicit NOT_RUN；type-check、lint、build PASS。** 最後lint的control-regex改為char-code判斷後，對應delete15/15及lint另跑PASS。兩個skip分別為recalc與delete的獨立SQL連線lock-wait／競態，不能因Promise.all或PGlite序列宣稱通過。Vite主bundle502.20kB有資訊性體積warning；未作商業負載／效能驗收。

實作代理與獨立審閱各跑新delete SQL/HTTP24 PASS／1 NOT_RUN；獨立FE18/18及先前63/63與全套重疊，**不加總**。定向複審修正已重現的uppercase report來源漏檢P2及同path不同bucket誤擋P3；目前本批無未解已證P1/P2。不等於Claude裁定或商用放行。

RED先證舊鏈authenticated可直接刪legacy原件（Missing expected rejection）；新source拒絕並保留正反例。涵蓋Storage failure/403/empty ACK、delete/finalize response loss、SQL rollback、same-ID retry、cross tenant/role/revoke、引用先到/prepare先到兩種序列、missing/orphan/duplicate、mode偽造、locate、processing provider/read/write/empty ACK/release故障。

舊11個前端兩步DELETE sequence案例改以新server-only契約與實際SQL/HTTP證明：auth/scope/path/context在documentDeletion.test.ts；草稿／間接活動／MANUAL／報告及引用順序在document-deletion-sql.test.js；Storage與finalize partial/loss在document-deletion-http.test.js。原13個library讀取邊界保留。舊「無引用草稿可級聯硬刪」不沿用：本批按保留稽核／原件引用，任何歷史draft先拒；其他清理商業政策待CTO另裁，沒有操作既有資料。

## 可重現完整流程與入口

最新本機入口 **http://127.0.0.1:4205/login**，API4204（Node checked-in Edge handler＋專用記憶體PGlite／合成Auth及Storage adapter）。本機載入來源1b1e82913ee593f4255eb33a92744d597c530b2c；這不是雲端部署SHA。合成帳號a-owner@product-preview.invalid／密碼synthetic-local-only，不是Supabase帳號。實際scope/ID每次重啟改變，讀/product-api/__synthetic/config或本次actual-integration.json。

Repo root啟動完整scenario（4204已執行時直接使用，不重啟或占用第二次）：

    $env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path
    node backend/tools/product-preview/delivery-demo.js

frontend/readdy-app另一terminal：

    node node_modules/vite/bin/vite.js --config tools/local-preview/vite.deletion.config.mjs

此scenario的業務列皆經正常SDK/產品handler，沒有直接SQL塞活動、計算或報告：真bytes→server SHA→明示MANUAL轉錄→同人確認server actor/time→計算version1→通用重算version2、同ID重送仍2→保存50kg/.05t報告→server授權HTML/JSON實際產檔。被引用原件拒刪；無引用原件完成tombstone與same-ID replay/locate，同hash新ID可重收。

另用明示local-only故障使新原件已移除、首次finalize RPC失敗，留下pending object_absent。**Chrome已從原文件頁按重試/確認，採用server原request ID完成封存**；SDK重讀確認同request、receipt archived/deleted、沒有新ID/新上傳（全scenario4個original寫入仍4）。pending.jpg／recovered.jpg記錄前後；saved-report.jpg為同流程保存快照。這不是跨服務復原，沒有重新生成bytes。

本次實際入口：report9a9af5e3-0d38-4fad-8a0f-8298d4bf62f8；恢復document dcc87d06-2888-4593-acab-8935473a16c2，request5896e715-965b-4107-960b-28e409b33630。完整URL在actual-integration.json／demo啟動輸出；重啟請勿沿用舊IDs。

證據：[actual-integration.json](evidence/controlled-deletion-20261106/actual-integration.json)、[browser-recovery-readback.json](evidence/controlled-deletion-20261106/browser-recovery-readback.json)、[HTML](evidence/controlled-deletion-20261106/actual-saved-report.html)、[JSON](evidence/controlled-deletion-20261106/actual-saved-report.json)、[來源migration manifest](evidence/controlled-deletion-20261106/source-migrations.json)。HTML/JSON是實際授權snapshot經既有formatter的Node存檔／讀回證據，**不是原生瀏覽器保存檔案證據**。

## 未驗、維運與下一項

NOT_RUN：真Supabase Auth/JWT/Storage/Deno、獨立SQL連線鎖等待／並行／deadlock、實際Storage generation與物理purge、雲端migration／bucket／備份復原／正式部署、代表使用者驗收及19+1負載。原生chooser因extension未Allow file URLs而BLOCKED；原生download事件橋接既已失效，不重試或冒稱存檔成功。

[維運步驟](CONTROLLED_DELETION_OPERATIONS_20261106.md)包含版本切換、pending恢復與無TTL lease處理。005只source/local套用；正式／雲端動作均待Owner具體授權。舊未追蹤工作需先盤點/停止，不能假設新lease已捕捉。一般來源修改可繼續；本輪三項已交付候選，固定SHA定向審閱WAITING_CTO、真服務隔離驗收WAITING_OWNER。
