# WAITING_CTO — 附件hash定向審閱

固定來源 411a99d597046f65dd54fc134df5dc0d8346c346，business baseline06bad0818625bd9d4f3b685dff50994157b52757。僅審本批module／adapter／verify-upload-receipt／003 migration及前端信任整合，勿重做全案；不改程式／操作雲端。交付與實測見SERVER_ATTACHMENT_HASH_DELIVERY_20261106.md；獨立代理審閱不冒稱Claude裁定。

請逐題回已解決／仍存在／證據不足，附來源、觸發條件、測試與未驗範圍：

1. 服務端從受授權原件實算SHA，普通API不能偽造trusted proof或占可信唯一索引；legacy未自動升格。
2. begin/read/complete能否綁定object generation、owner、size/MIME、scope及當下角色／訂閱；是否仍有普通角色delete/recreate繞過。
3. 相同intent重送／回覆遺失／讀取失敗的持久恢復，duplicate proof歸屬既存receipt，跨env/封存衝突不回假成功。
4. catalog compatibility不是權限控制；private helper ACL、schema/table隔離與普通direct API是否足夠。service-role維護與獨立SQL連線race未實測，不得依Promise.all推論。
5. 舊client INSERT契約不相容／版本切換、可信原件暫時禁止舊刪除、未授權雲端套用是否明示。

RELEASE HOLD，真Supabase JWT/Storage/Deno、獨立SQL並行及正式驗收仍NOT_RUN；不要求擴展整案或通知第三方。
