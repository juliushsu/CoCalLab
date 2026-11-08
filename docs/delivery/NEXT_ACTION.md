# Next action — 2026-11-08／本機原生SQL復原證據

- 專案目標暫停／WAITING_CLAUDE_CTO：已授權本機交付已完成，等待外部定向回覆及裁定；RELEASE HOLD。正式UAT基準7dccd5452152f2495d10ad1437d5d03215166065不變。未合併main/未部署/未操作雲端。Owner已選Micro/累計額度/14天；最新CTO未授權建立，費用與保留時鐘尚未起算，不重問同一預算。
- PR30 app33d3613487f42a7e9c5888ae312441e730d3d87e、PR31 apped6ca9bbfbc5581cdcacf2969340575217fcb8c4。P2-1～3沿CTO來源關閉；N1/P2-4與N3仍WAITING_CLAUDE/CTO。入口CLAUDE_N1_N3_REVIEW_QUEUE_20261107.md@a04a562ba869a2d079c3bcec1f9d45643f2b8055。
- PR32 docsddcc896612e57721f4116cbaef0290483321386f、CI42451102879 success。PR33 appda5a0990c8ec82d2b55064dd7e009b771409fa73、toolb7bf83d4ea0e038262af1e9f9988e83db91dac84、docs b468a658dbd84b8663d2741a75823083c13e5203、CI42453757126 success。N4 ed6真40P01紅例/da5具名8PASS/9Lock及獨立重跑已交付，不全域關閉。N4補審入口CLAUDE_N4_LOCK_ORDER_REVIEW_20261108.md@b468；需Owner交Claude，未代發外部訊息。
- PR34程式/交付固定b701ddbf2affb818c63e6c647012c494e0c94439，CI42455636617 success（backend/PGlite/frontend/type/lint/build）。後續僅文件等待狀態更新，不偷換此程式CI證據。
- 本輪branch codex/native-pg-recovery-20261108，tool固定a05cec8221568f0d7ac14029509fad726dfefdd2；產品仍da5（frontend/服務/SQL/Edge/modules完全無改）。本機37表全row/序列/schema/RLS/grants/func/constraint相等、真60kg completed/server_verified報告與private proof可查回/原ID重送無新audit；partial缺proof真拒絕。主輪9check/獨立9同覆蓋不加總，verifier5PASS另列。
- 原candidate、全新source clone與archive前後一致；archive實際NTFS owner-only已驗、dump/restore官方17.11 hash吻合。初rawACL差異與Get-Acl startup失敗保留；只修工具未改產品/基線。完整交付NATIVE_SQL_RECOVERY_DELIVERY_20261108.md及evidence/native-pg-recovery-20261108/。
- 專用原生PG17.11/UTF8只127.0.0.1:55439；密碼受限未追蹤，metadata在../tooling/native-pg17-20261108/ascii-runtime.json，不回報內容。所有source/restore/partial DB皆本次新建，無drop/reset/terminate。5432/其他專案保留，不重試Docker/WSL，不建立Windows service。
- 同cluster現成角色與合成Auth/Storagecatalog是測試前提；全archive僅留受限TEMP、不進Git。真Storagebytes/signedURL/objectgeneration、crosscluster roles/secrets/infra、真JWT/PostgREST/Edge/ESZIP、原生chooser/落盤、16 NOT VALID歷史資料驗證/cloud migration/managed備份復原/19+1仍NOT_RUN。
- 47source migration＝44schema/3歷史DML HOLD，16functions設定沿da5模板；此native archive不作managed Supabase初始化。既有專案須重算才能新報告；舊重算可能失敗，不自動重算/補簽/覆寫歷史。N5 React前景自動觸發亦仍未驗。
- 原ed6/PGlite預覽 http://127.0.0.1:4215/login +API4214 與native da5 DB分開；重啟有新ID，不拿舊圖冒充新操作。既有操作見ACTIVITY_REPLACEMENT_N3_DELIVERY_20261107.md。
- 下一條可執行命令（repo root，唯讀確認專用PG）：`node backend/tools/native-pg-concurrency/run.mjs --probe`。接續需收到N1/N3固定入口與N4補審的Claude回覆及CTO裁定；先fetch保留新文件，再只重現新缺陷。真服務須另有明確target/操作核准，預算與14天已記錄不重問。沒有新輸入時等待，不另起功能、重跑舊套件或重開整案。Session保存接續狀態，不承諾無限背景執行。
