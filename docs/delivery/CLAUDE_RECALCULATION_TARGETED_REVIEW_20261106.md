# WAITING_CTO — 冪等重算定向審閱

固定程式 67e546fa6894303ccbff66d829d077b93c5fb8e2；base hash411a99d，business baseline06bad0818625bd9d4f3b685dff50994157b52757。僅審recalc handler/contracts、004 migration/private ledger、前端穩定request/lookup/recovery差異與必要測試；勿重開全案、勿修改或操作雲端。

請逐題已解決／仍存在／證據不足，附來源位置、觸發條件、測試與新增負例：

1. 同scope/JWT actor/request/force/formula及有效輸入重試是否原ID/原版本、不重audit，失回覆能否查回。
2. canonical activity/factor完整快照、fresh compare、DB max+1及actual result IDs/content是否避免舊輸入／被改結果假current；pending/not_found/historical是否正確。
3. private authority/ACL、SQL scope/member/latest subscription與rollback是否完整，普通direct API不能偽造request權威。
4. 短表SHARE鎖＋project NO KEY UPDATE的已知範圍／負載限制、004交易包覆，以及未驗獨立SQL連線並行是否如實。
5. 前端durable範圍／舊context、損壞journal明確放棄、不取消server、舊client相容性與report pending gate是否正確。

本機正反例與入口見RECALCULATION_IDEMPOTENCY_DELIVERY_20261106.md。獨立代理review不冒稱Claude裁定；真Supabase/JWT/Deno、真並行仍NOT_RUN，RELEASE HOLD/UAT不變。未通知第三方。
