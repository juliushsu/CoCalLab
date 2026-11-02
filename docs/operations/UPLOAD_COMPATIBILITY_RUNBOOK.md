# 上傳相容性與登入故障處理

來源：PR #15 的 `202611020002_storage_receipt_review_fixes.sql` 及 Upload-N1／N2 修復。
契約仍為 `20261102.2`。本次前端小修復**未修改 migration、bucket、RLS、RPC 權限或 baseline**。
本文件是維運程序，不是雲端執行授權，也沒有建立監控或重新建立基準。

## 如何辨識

| 現象 | 先檢查 | 處置 |
| --- | --- | --- |
| 明確登入失敗後無法再上傳 | 目前 session 有效期、目前 auth epoch 與錯誤登入是否已結束 | N1 版本會在未被取代的失敗登入後恢復仍有效 session 並給新 epoch；舊操作持續失效。到期清除獨立判定畫面持有的 session。不得以忽略過期／繞過持久登出解決。 |
| image/jpg 可選但收件遭拒 | SDK multipart part 的 MIME 與實際 Storage metadata、receipt MIME 是否一致 | N2 保留驗證過的 bytes／原檔名，以 image/jpeg 的 File 傳送。不得放寬 metadata trigger／原物件核對或自動重傳舊孤兒物件。 |
| can_write=false／版本不符 | JWT／會員角色、org／project、訂閱可寫狀態、RPC 版本、bucket 私有性／RLS，再檢查已核准部署的 fingerprint | false 可能是正常拒絕或漂移，不能只憑布林值判定故障。保持拒絕；先診斷原因。 |
| 平台／PostgreSQL 升級後相容性失敗 | 升級前後平台與 PostgreSQL 版本、migrations、helper 定義／owner／ACL、schema ACL 及 trigger／policy 差異 | 依下列程序提出受審的 baseline 更新；不得即時自動接受。 |

應用程式一般帳號只能使用 scoped 契約探測，不應取得私有 baseline 或管理查詢權限。
比對部署 catalog 由已授權的維運者在指定環境唯讀收集；不在聊天或公開 Git 貼 JWT、key、付款或企業資料。

## 平台升級與 fingerprint 漂移

baseline 含 policy 表達式／命令／角色、trigger 定義／事件／WHEN，以及 helper body、owner、ACL、search_path 等。
其中 `auth.uid()` 與 auth/storage/public schema ACL 可能由 Supabase 管理；PostgreSQL 大版本也可能改變 `pg_get_functiondef` 等輸出格式。
因此合法平台變更也可能讓 `can_write=false`。這是預期的 fail closed；不能宣稱維運不可用性已由前置檢查解決。

取得隔離環境授權後，應把「契約版本及可寫狀態的合成探測」「升級前後 catalog 差異」「合法／拒絕案例」納入監控與變更驗收。
需同時保留一個已知合法測試角色與拒絕角色，避免把權限不足當漂移、或把拒絕改成成功。
目前真實環境監控、告警閾值／責任人、平台升級演練及完整備份／復原驗收均 NOT_RUN／待 Owner 指定；本輪沒有啟用或排程任何雲端探測。

## 經核准的重新建立基準流程

1. 記錄故障的應用 SHA、契約、實際 migration 清單、平台／PG 版本與時間；保存升級前已核准來源／catalog 證據。無法證明者標 UNKNOWN。
2. 保持寫入關閉，以具體授權帳戶在指定環境唯讀比對完整 policy／trigger／helper／ACL，不只看名稱。確認是預期平台變更或來源漂移；有異常權限變更先交 Owner。
3. 在 repo 提出**新的增量 migration**，只接受已查核的具體新定義／ACL／格式差異，記錄必要性、影響、版本相容性與回復方式。不要改寫已套用 migration，也不要把當前 catalog 不加審查地當成可信基準。
4. 在獲授權的全合成隔離環境驗證：健康狀態、刻意放寬 policy／改 trigger／helper／ACL 的拒絕、跨租戶／角色正反例、舊資料相容與升級／還原。保留前後 baseline／測試證據，不將重建當作歷史資料已驗證。
5. Owner 核准目標資源、備份／還原、套用 migration／schema／權限變更及需要的 bucket 建立後，由受權維運執行。此文件不授權上述操作。本機 SQL／CI 通過不能替代此核准。
6. 套用後核對版本、指定合法帳戶的實際上傳／收件與拒絕案例、監控及回復證據，再交 CTO 裁定是否恢復功能／發布。不要在探測中自動更新 baseline。

baseline 是安裝時相容性快照，不能證明安裝前可信，不能對抗 DDL owner；新增其他 trigger／其他權限路徑也需來源審查。
不以移除 RLS、guard、停用 trigger、授予 baseline 讀寫或放寬 JWT 驗證作為相容性修復。

## 失敗恢復與回復

Storage 物件與收件不是同一交易；失敗時保留原 attempt ID／path。先唯讀核對，再明確補登記原物件，不能自動重新傳 bytes 或清理伺服器。
放棄本機參考只移除該 user/project/attempt 的本機 journal，不刪物件／資料列，也不能撤銷已送出請求。

若回退應用版本與契約不符，保持新上傳停止；既有物件及收件保留。
資料補救、bucket 清理與 schema 回復需另行核准具體目標、備份、資料核對及維護窗口。001 缺 documents 時會建立 bucket，仍須列入資源變更申請。
SHA256／內容類型的服務端驗證與假 hash 占 unique key 仍 OPEN，不能由 N2 MIME 修復或重新建立基準關閉。
發布維持 HOLD，真實 JWT／Storage／雲端 migration／復原及 UAT 尚未驗證。
