# Historical checkpoints retained on 2026-11-06

以下為本輪前的接續紀錄，保留來源、版本及證據；目前狀態以NEXT_ACTION.md為準。

# Integrity / retry / deletion round — 2026-11-06

- Business baseline06bad0818625bd9d4f3b685dff50994157b52757; retained later docs throughbfb51c4. RELEASE HOLD/UAT7dccd545 unchanged; no cloud/main/deploy/cost actions.
- 1 SOURCE_DONE候選：411a99d597046f65dd54fc134df5dc0d8346c346, branch codex/server-attachment-hash-20261106, Draft PR25, docs86ceb011f3599bb438f8657a5ef5592f64c9da64/CI42200533556 success。server actual bytes SHA、private authority/可信partial unique、legacy不升格不占位、固定ID恢復及跨tenant拒絕；lifecycle/env不相容409。交付SERVER_ATTACHMENT_HASH_DELIVERY_20261106.md。
- 實跑FE197/197、backend27/27、tsc/lint/build PASS；SQL/HTTP回歸245/245，最終附件SQL7+HTTP6=13/13另跑PASS（重疊不可加總）；獨立定向審閱無待修P1/P2。實際SDK合成PDF→server proof、同內容writes=1、Chrome可信收件顯示／截圖。
- 入口 http://127.0.0.1:4201/login，API4200獨立合成記憶體DB；重啟會換ID。只屬本次API exec62791/UI10632，其他預覽/5432保留。原生chooser因extension file URLs權限BLOCKED，未改權限；不算實際原生選檔通過。
- 2 SOURCE_DONE候選：67e546fa6894303ccbff66d829d077b93c5fb8e2, branch codex/recalculation-idempotency-20261106。通用重算冪等性（同intent不增版本、不同輸入拒舊結果、丟回覆查回）；第3項NEXT：受控刪除部分失敗／引用fence／保留稽核。可信原件目前舊delete明確拒，未冒稱跨服務原子。
- 第2項實跑FE207/207、backend27/27、tsc/lint/build PASS；相關SQL/HTTP27 PASS/1 NOT_RUN及最後新增負例1/1。最終target HTTP8/SQL8；均有重疊不加總。actual SDK同ID重送/lookup維持版本1、50kg，UI4203明細已核對。交付RECALCULATION_IDEMPOTENCY_DELIVERY_20261106.md；新ledger定向CLAUDE_RECALCULATION_TARGETED_REVIEW_20261106.md WAITING_CTO。
- WAITING_CTO：CLAUDE_ATTACHMENT_HASH_TARGETED_REVIEW_20261106.md固定411a99d597046f65dd54fc134df5dc0d8346c346；尚未通知Claude或推定裁定，不阻一般來源開發。
- NOT_RUN：真JWT/Storage/Deno、獨立PostgreSQL SQL連線lock-wait並行、雲端migration/真上傳/備份復原。PGlite序列與Promise.all不是獨立SQL證據。舊client版本切換/雲端套用/維護清理需Owner具體授權。
- 下一條可執行命令（repo root）：node backend/tools/product-preview/upload-demo.js（先確認4200現有專屬服務）。下一開發命令：git switch -c codex/controlled-document-deletion-20261106（第2項小PR提交後）；核對工作樹，保留stash。

# Next action — 2026-11-06

- RELEASE HOLD；UAT固定7dccd5452152f2495d10ad1437d5d03215166065。未合併main、部署、操作雲端/正式資料或新增費用。
- 本輪第1項SOURCE_DONE候選：815315b121924f86066220b573284016a30d64eb，PR21；scope導覽/捷徑、auth/query換頁清舊狀態。第2項70b9d738a9bcb011a17124ca35542a5c300b419e，PR22；十章真保存欄位/缺件/來源＋本機回饋未送出。
- 第3項SOURCE_DONE候選：a868b2e283f9ba4ff0f7d4e6e9bc5802170014d7，PR23；CTO已明確核准政策A本機測試，server角色/可寫訂閱/同scope completed核對，HTML/JSON保存快照，PDF/Word未提供。原生瀏覽器存檔UNVERIFIED。
- 第4項SOURCE_DONE候選：06bad0818625bd9d4f3b685dff50994157b52757，branch codex/manual-transcription-20261106；原件→真人工轉錄→同人確認server actor/time→計算50kg→保存/重讀報告.05t→server授權HTML/JSON請求。沿既有三表，不假OCR/雙人覆核，不跨期分攤、不係數釘選。
- 最終固定來源實測：frontend191/191、backend21/21、SQL/HTTP239/239、type-check/lint/build PASS。獨立target子集不加總。CLI/瀏覽器步驟、截圖、原件/轉錄/活動/報告IDs及本機receipt：MANUAL_TRANSCRIPTION_DELIVERY_20261106.md。
- 本輪PR21/22/23 CI各固定HEAD success；M4新HEAD CI依實際run收件。主流程新版 http://127.0.0.1:4199/login →自建API4198，當前合成ID見4199/product-api/__synthetic/config。僅可停止自建API exec76016/UI49898，舊模式/其他專案/5432保留；重啟API清合成資料與新ID。
- 下一驗收缺口：原生瀏覽器實際保存檔案尚無證據，不重試已失效download事件橋接；shared formatter的實際保存快照HTML/JSON寫檔/讀回是另份Node證據，不能代替原生下載。真JWT/Storage/Deno、獨立SQL並行、備份/復原與代表使用者驗收WAITING_OWNER環境/操作授權。
- WAITING_CTO：ledger18c0894固定L1–L5文件CLAUDE_REPORT_LEDGER_TARGETED_REVIEW_20261106.md；新增MANUAL RPC/JSON權威/retention定向文件CLAUDE_MANUAL_TRANSCRIPTION_TARGETED_REVIEW_20261106.md固定06bad08。均已準備可轉交，未通知Claude、未宣稱已裁定。其他已核准來源開發不因等待全面停工。
- M3 OPEN：server hash/唯一索引占用、in-flight跨服務刪除/恢復、全report防竄改、generic recalc冪等；不得將本輪局部修正假關閉。Scope規則擴充/真回饋收件服務仍待業務範圍。
- 下一條本機重現命令（repo root）：$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path; node --test backend/tests/integration/manual-transcription-http.test.js。啟動入口詳交付文件；4198已執行時用現有4199，不重複啟動或殺其他服務。
- 原ZIP SHA256 f6e909dc801a6785b7be453a53da24bde38efa20be3b5357cda1a19e2e309325與來源盤點保留；保留stash pc-export-browser-harness-preserved-20261102。此為有限session接續點，不宣稱永久背景執行。
