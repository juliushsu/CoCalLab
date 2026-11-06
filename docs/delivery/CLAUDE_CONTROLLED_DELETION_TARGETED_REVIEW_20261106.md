# WAITING_CTO — 第3項定向審閱

固定程式1b1e82913ee593f4255eb33a92744d597c530b2c；base recalc67e546f，business baseline06bad0818625bd9d4f3b685dff50994157b52757。只讀本批005 migration、delete service/handler、provider前lease最小變更、必要verify DTO、前端server-only刪除/recovery差異及測試；勿重做全案、勿操作雲端或改程式。獨立代理不是Claude裁定，尚未通知第三方。

逐題回已解決／仍存在／證據不足，附來源、觸發條件、測試與新增回歸：

1. 同actor/scope/doc/request/mode/path及object generation綁定，ordinary raw DELETE/overwrite/harddelete與他人orphan拒絕，locate不能接手別人的操作。
2. 所有draft/MANUAL/直接及間接活動/report/processing引用，prepare前後INSERT/UPDATE與service流程的fence；uppercase與畸形歷史來源是否failclosed。
3. file/receipt不同步、403/empty ACK、delete/finalize loss/error、sameID retry/lookup/locate；是否保留audit而非宣稱跨服務atomic或rollback復原bytes。
4. 只完成controlled deleted才釋放trusted unique，舊verify/原路徑不能復活；catalog基線不重學未知漂移，前置檢查不當權限控制。
5. provider前durable lease、finish的角色/最新訂閱重查、失敗release/noTTL與舊未追蹤工作；並未啟用OCR/外送或關閉Mock缺口。
6. 前端corrupt journal/原ID查回/another-tab receipt priority、pending/deleted原件可用性、租戶context；舊client相容切換及未驗限制。

實際證據/入口/維運：CONTROLLED_DOCUMENT_DELETION_DELIVERY_20261106.md與CONTROLLED_DELETION_OPERATIONS_20261106.md。全套FE219、backend27、SQL/HTTP292 PASS/2 NOT_RUN；子集不加總。獨立SQL連線並行、真Supabase/Storage/JWT、雲端及商業驗收仍未驗，發布HOLD。
