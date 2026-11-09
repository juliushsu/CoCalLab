# Local encrypted-file delivery — source evidence

**發布 HOLD。** 本文件只公開程式與合成驗證，不公開帳戶、帳務、資源配置或生命週期執行提案。產品候選仍為 fd7efcfc6450dbf10f54aa97b65fe48e431b277d。

- 新增 AES-256-GCM 檔案加密／讀回、可信 manifest 核對、作用域綁定、防覆寫與未驗證明文隔離。[介面、依賴與移植說明](../../deployment/uat/lifecycle/ENCRYPTED_ARTIFACT.md)；無 provider SDK／雲端呼叫。
- 本機加密檔案測試 **13/13**：多區塊／空檔、錯 key／scope、header／nonce／內容／tag 竄改、截斷／附加、可信 hash、現存目標保留、實際檔案並行發布一勝一拒、容量、硬連結／junction 拒絕。這不是 SQL 並行或真服務驗收。
- Windows Owner adapter 實測目錄及合成檔案 ACL、空間、另存 key 後解密讀回、防覆寫、錯 key／竄改拒絕；每批唯一目錄／UTC／manifest／SHA256，全部保留。原件、key、路徑、主機／磁碟／帳戶值與完整回執留本機受限報告。Node mode:0600 不代替 NTFS ACL 檢查。
- PowerShell parse／Node syntax 通過；[去敏回執與來源 hash](evidence/uat-owner-delivery-20261109/DELIVERY_RECEIPT.json)、TAP 保留。修正 temp ownership 與 ACL 旗標後另做唯一批次驗證，不把重跑加總。未重跑既有 watchdog23／workflow3／decision17／Windows10 或未變更產品套件。

同機 archive/key **不是異地備份**；全為明示合成資料，actual UAT ref=null，不能當成實際 DB/private-ledger/proof/Storage/settings 還原或 Owner 已接收真備份。本模組不授權刪除任何雲端備份。真備份、精確還原、持久 operation／互斥、provider scope／排程與人類送達驗收仍未完成。

公開 GitHub 維運結果另可直接核對：[PR #39](https://github.com/juliushsu/CoCalLab/pull/39) 固定 a8f8f4c89f720d099d995ddaafb205cad4aa301a；main merge 94d01b9c9f081df494f805b41166599ccd73541e，僅單一 workflow；產品候選未合併。[合成 run42552744150](https://github.com/juliushsu/CoCalLab/actions/runs/42552744150) notification-probe 按設計 exit1、observe skipped，jobs/log 無 provider 呼叫。此 GitHub 結果不能證明 Email 已送達，保持 UNVERIFIED；不要求地址、不讀信箱。

現行授權及精確環境／費用／期限界線僅以 Owner 受限核准包與另存執行回執為準，不因公開歷史快照覆蓋或重問既有核准。下一步沿用既有 native-pg-recovery verifier，補完整備份／還原與持久操作的可測實作；本模組不得替代。
