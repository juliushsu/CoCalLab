# Next action — 2026-11-06

- RELEASE HOLD；UAT固定7dccd5452152f2495d10ad1437d5d03215166065。Business baseline06bad0818625bd9d4f3b685dff50994157b52757；後續文件/既有功能保留。未合併main、部署、操作雲端/正式資料或新增費用。
- SOURCE_DONE_LOCAL候選1：411a99d597046f65dd54fc134df5dc0d8346c346，codex/server-attachment-hash-20261106，Draft PR25；server bytes SHA／可信unique／legacy不升格／同ID恢復。docs86ceb01，CI42200533556 success。
- SOURCE_DONE_LOCAL候選2：67e546fa6894303ccbff66d829d077b93c5fb8e2，codex/recalculation-idempotency-20261106，Draft PR26；private intent/input/result authority，重送不增版本、歷史查回明示。docsa2ae19c，CI42203669999 success。
- SOURCE_DONE_LOCAL候選3：1b1e82913ee593f4255eb33a92744d597c530b2c，current codex/controlled-document-deletion-20261106；durable prepare/Storage/finalize＋audit tombstone、引用/processing lease fence、sameID lookup/locate、orphan/partial恢復；不宣稱跨服務atomic。
- 最終實跑FE219/219、backend27/27；SQL/HTTP294 cases=292PASS/2 explicit NOT_RUN；tsc/lint/build PASS。獨立review新delete24PASS/1NOT_RUN、FE18子集等與全套重疊不可加總；無待修已證P1/P2。兩skip為獨立SQL連線並行，不以Promise.all代替。
- 可操作最新入口http://127.0.0.1:4205/login →API4204，固定來源1b1e82913ee593f4255eb33a92744d597c530b2c的Node/PGlite/合成Auth/Storage；非雲端部署SHA。僅合成帳號a-owner@product-preview.invalid／synthetic-local-only。自建API exec60691/UI92729，Ctrl+C停止會清資料/換ID；其他預覽/5432保留。
- 實際SDK可信收件→MANUAL同人轉錄/確認→calc v1及generic v2重送不增加→保存50kg/.05t報告→server授權HTML/JSON產檔；有引用拒刪。另無引用tombstone/hash釋放，Chrome把真pending object_absent以原ID恢復封存，未重傳/產新ID。
- 證據/步驟/維運：CONTROLLED_DOCUMENT_DELETION_DELIVERY_20261106.md、CONTROLLED_DELETION_OPERATIONS_20261106.md及evidence/controlled-deletion-20261106。歷史NEXT保留NEXT_ACTION_HISTORY_20261106.md；原Readdy ZIP/stash均保留。
- WAITING_CTO：三份固定SHA定向CLAUDE_*_TARGETED_REVIEW_20261106.md；未通知Claude或推定裁定。一般來源開發可依既有隊列繼續；本輪三項候選已交付，不重開H0。
- WAITING_OWNER/NOT_RUN：真Supabase JWT/Storage/Deno、獨立SQL並行/lock-wait、隔離服務migration/備份復原/19+1負載/代表使用者；雲端/Production仍未授權。原生chooser缺extension file URLs權限BLOCKED，未擴權；原生download存檔未驗。Mock OCR/AI與legacy processing重送冪等、全report防竄改仍OPEN，不冒稱商用完成。
- 下一條可執行命令（repo root，需重現或有新變更時跑對應範圍）：$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path; node --test --test-concurrency=1 backend/tests/integration/document-deletion-http.test.js backend/tests/integration/document-deletion-sql.test.js。
- 最新完整預覽重建：node backend/tools/product-preview/delivery-demo.js（先確認4204自建服務已停止；不殺其他程序）；UI命令見交付文件。此為有限session交接，不宣稱代理無限背景運作。
