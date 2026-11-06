# 受控刪除維運說明（source/local only）

程式1b1e82913ee593f4255eb33a92744d597c530b2c。RELEASE HOLD/UAT7dccd545不變，未授權雲端migration、bucket建立／搬移／清理、正式上線。以下是可審閱流程，不是對真環境已操作回執。

| 保存狀態 | 含義 | 可做的恢復 |
| --- | --- | --- |
| not_found | 沒找到該actor/request；存在欄位unknown/null | 保留doc與原ID；無local ref時用readonly locate，不猜測檔案有無 |
| pending/prepared | 已fence，未確認Storage absence | 同actor/scope/request/intent查核與重試；不重傳或改路徑 |
| pending/object_absent | 已確認Storage catalog absence，SQL封存未完成 | 同ID重試finalize；原bytes不會因DB rollback復原 |
| deleted/finalized | Storage absence及receipt封存/audit已確認 | readonly lookup；保留tombstone/request/proof，不能原ID重建 |

原件已缺會記original_missing；這是此adapter/catalog觀察，不代表雲端物理purge或企業資料已清除。空ACK、403、timeout及未知結果不能當作刪除成功。沒有跨服務atomic rollback、背景自動補傳或TTL解除fence。

正常receipt可從deletion_request_id恢復；orphan保留原intake及delete參考。損壞delete journal先保存資訊並明確清精準user/org/project/doc key，隨後locate只找同JWT actor/同mode/同path的舊作業。不因知道UUID接手其他actor，也不把放棄本機參考當作取消伺服器。已登記receipt的orphan cleanup被拒；只在確認server not_found後清自己該次local delete ref，實際recheck原回執。

先有draft/MANUAL/活動/report引用或processing時拒prepare；prepare後新引用拒。任何歷史draft先保留；uppercase UUID按語意比較，未知歷史report mappings會REFERENCE_INDEX_UNKNOWN，須Owner盤點而非自動修／刪。撤權／readonly後不得增加Storage副作用；恢復原權限或其他管理處理須Owner決策，不能在前端冒充actor。

process-document lease只涵蓋新版handler實際記錄的工作。已知工作結束才能正常精準release；crash/release失敗保持active、阻擋刪除。先唯讀保存lease/doc/actor/request及provider實際工作證據，確認遠端工作已停止後，才申請Owner批准具體環境與精準維護操作。不能因逾時或找不到前端頁面就自動解鎖，不自行執行雲端release。舊Mock provider與processing重送冪等仍OPEN，不是真OCR交付。

## 未來部署申請材料

先確認實際專案／服務／SHA、完整已套用migration／source差異、資料及物件路徑、未知歷史report mapping、現有及未追蹤工作、備份與object-store復原能力；NOT VALID約束另盤點驗證，不能把migration套用成功當歷史資料已驗證。source-migrations.json只記來源及本機initializer規則，不是cloud applied list。

部署需Owner核准003/004/005及其前置鏈的具體範圍；前置secure-upload migration在documents不存在時可建立bucket，須明列資源變更。新版schema/handler/adapter先具備，再切相容client並確認新cap；舊client直接INSERT/harddelete不相容，不能透明滾動而不安排版本切換。005交易先拒未知003漂移，僅更新已知函式/index fingerprint，不能runtime重學或關閉權限以求ready。

如新client或服務失敗，先停用受影響入口、保留schema/private authority/tombstones/原件與pending；以核對後roll-forward修正為原則。不回退到client SHA authority或舊兩步刪除，不drop私有作業/撤fence。DB restore不能復原已移除Storage bytes；跨服務還原需Owner對隔離備份／物件版本的另份明確授權。此repo沒有自動操作正式復原的腳本。

本機本次API exec60691/UI92729，只屬CoCalLab新4204/4205；Ctrl+C停止會清記憶體資料、下次換ID。保留其他419x/4200/4202與5432，不掃除其他專案。啟動命令見CONTROLLED_DOCUMENT_DELETION_DELIVERY_20261106.md。

維運重現命令（repo root，明示合成、全新測試runtime）：

    $env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path
    node --test --test-concurrency=1 backend/tests/integration/document-deletion-http.test.js backend/tests/integration/document-deletion-sql.test.js

獨立SQL連線並行、真Storage/JWT、備份復原、19+1負載與原生檔案保存均未驗；不得用本機CI替代。
