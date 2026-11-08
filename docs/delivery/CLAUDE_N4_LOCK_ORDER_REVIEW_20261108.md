# Claude 定向補審入口 — N4鎖序 — 2026-11-08

工具固定 `b7bf83d4ea0e038262af1e9f9988e83db91dac84`；產品修復固定 `da5a0990c8ec82d2b55064dd7e009b771409fa73`。

RELEASE HOLD；只複審本次N4修復與交集，不重開整案。原N1/N2與N3等待事項沿[既有固定審查入口a04](https://github.com/juliushsu/CoCalLab/blob/a04a562ba869a2d079c3bcec1f9d45643f2b8055/docs/delivery/CLAUDE_N1_N3_REVIEW_QUEUE_20261107.md)，P2-1～P2-3已裁定來源關閉，不重查無改動部分。

- 紅例產品：`ed6ca9bbfbc5581cdcacf2969340575217fcb8c4`。
- 修復產品：`da5a0990c8ec82d2b55064dd7e009b771409fa73`；只新增[202611080001_document_lock_order.sql](https://github.com/juliushsu/CoCalLab/blob/da5a0990c8ec82d2b55064dd7e009b771409fa73/backend/supabase/migrations/202611080001_document_lock_order.sql)。原UI／tenant／ledger／歷史快照模型不變。
- 固定證據與工具版本：以本文件所在固定commit及[NATIVE_POSTGRES_CONCURRENCY_20261108.md](NATIVE_POSTGRES_CONCURRENCY_20261108.md)的工具SHA為準；受審產品始終da5，不能因文件HEAD前進偷換來源。

請回覆下列四題各自 **已解決／仍存在／證據不足**，附固定來源行號、觸發條件、實際覆蓋與未驗；只讀來源/脫敏證據，不操作雲端、正式資料、資源或權限。未獨立重跑須明說，不能借用主代理數字當自己的測試。

1. delete prepare與manual create的天然鎖逆序，是否由project-before-document收斂？finalize與release是否仍有本次變更可見的逆序或回歸？別把test-only barrier自身造成的等待當產品死鎖；紅例必須釋barrier後剩A↔B。
2. 三函式原actor／tenant／subscription／service-only執行邊界是否保持？release保留原captured actor在撤權後清理已結束工作，且foreign actor/ordinary角色拒絕；不得為cleanup新增寫權檢查而卡住lease。
3. migration是否先拒舊來源漂移、每個anchor恰一次，只刷新三個明示function fingerprints，且ACL/owner/config未放寬？deployment_ready只是相容性檢查，不當真正授權。
4. 紅/綠測試是否有真三PID、真Lock/pg_blocking_pids、rollback／原ID重送／唯一有效leaf與保留舊資料斷言？哪些交錯尚未驗，是否有fixture/測試本身掩蓋來源缺陷？不要因runner退出0就宣布N4或真服務全面關閉。

主要證據：[紅例](evidence/native-pg-concurrency-20261108/BASELINE_N4.json)、[獨立紅例](evidence/native-pg-concurrency-20261108/INDEPENDENT_BASELINE_N4.json)、[修復候選](evidence/native-pg-concurrency-20261108/CANDIDATE_N4.json)、[獨立候選](evidence/native-pg-concurrency-20261108/INDEPENDENT_CANDIDATE_N4.json)、[metadata與ACL](evidence/native-pg-concurrency-20261108/LOCK_MIGRATION_NATIVE.json)、[拒漂移](evidence/native-pg-concurrency-20261108/DRIFT_REJECTION.json)、[原始相關回歸](evidence/native-pg-concurrency-20261108/RELATED_REGRESSIONS.txt)。SQL時間線把重複DDL本文換成固定Git路徑與SHA，所有業務SQL/params為明示合成；原始full log另留tooling且列hash，不含秘密。

真Auth/JWT/Storage/managed Edge、完整UAT部署/NOT VALID資料驗證/備份還原/19+1仍未驗。既有雲端只曾有限唯讀，未授權本次建立、migration、bucket、真上傳或Production。Owner已選Micro/累計額度/14天，尚未開始計費/保留時鐘；不重問同選項。
