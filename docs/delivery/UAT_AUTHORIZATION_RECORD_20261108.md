> 2026-11-09最新：兩平台與通知偏好唯讀盤點已完成，細節僅在Owner-only核准包。方案A已備，現等Owner核准新資源／限範圍權限／費用及備份退出；main維運workflow仍另交固定差異批准。以下舊提案與登入前快照保留歷史，現行以NEXT_ACTION與execution-proposal.json為準。

> 同日後續：指定帳戶的 Owner 協助唯讀前置已完成，詳細證據僅存本機受限 Owner 報告；不再等待相同登入。最新 Owner 要求先盤點既有排程選項、提交具體方案並測 dry-run；實際排程／憑證／通知配置與付費 UAT 待方案核准。以下登入前的描述保留當時範圍，現行狀態以 authorization-status.json 與 NEXT_ACTION.md 為準。

# UAT 預算與執行授權紀錄

更新 2026-11-09：Owner 已補齊組織 ID 與到期選項。**範圍已核准；建立仍須通過 live preflight 與生命週期條件；發布 HOLD。** 舊版 11/08 的環境待核准文字已被本次明確指示取代，不重問相同範圍。

| 欄位 | 現行紀錄 |
|---|---|
| 組織 | Owner 指定候選 `empvseawywarugdnyhzl`；實名登入後讀取，不另建或猜填。公司付費資格仍未現場核實 |
| 環境／版本 | 新 `CoCalLab-UAT-CLOUD-01`，Micro／東京 `ap-northeast-1`，固定 `fd7efcfc6450dbf10f54aa97b65fe48e431b277d`；不表示已部署或驗收 |
| 預算原話 | 「本次新增費用累計 US$20、保留 14 天」；本 chat call_627d6e5bd6db410eb35930efb5ee1274 |
| 額度 | 累計 USD20，非每月／每日，非平台硬上限；compute、storage、egress、核准備份、實收稅費均計入。額度內不自動包含額外 AI／PITR／scheduler／add-on |
| 保留期 | 實際建立 UTC T0 起 14 天，不能從文件或部署完成才算。真 T0／expiry 均 null |
| 到期 | **備份驗證後刪除該 UAT**；T0+12 天準備並驗受限備份，T0+14 天停測，只刪精確新 ref，驗後續資源／帳務，不自續 |
| 新專案允許操作 | 46 schema migration 提案、13 允許 functions、private buckets、專用 Auth 帳號及合成驗收；3 歷史 DML／3 Mock 或 provider functions 不部署 |
| 保護範圍 | 不改既有 `wynqnvidepzzcwutexvn`／其他專案／正式 DNS／Readdy／main；前端 localhost。不匯入企業資料或發客戶邀請 |
| 復原 | **先列精確 source／target 再執行**；尚未指定，不默認第二個付費專案，不對既有 DB reset／restore；DB、private ledgers/proofs、Storage 原件與必要設定皆需可還原 |
| 異常 | 備份／復原／刪除失敗、預估超支立即報 Owner；不假報成功、不靜默續費，也不跳過備份驗證刪除 |
| 代理操作 | 新建雲端資源 0，本次計費未開始；實際帳單未查，不聲稱整個帳戶為零。10 個本機合成排程已實測並停用，不是真 lifecycle 已 armed |

機讀現行紀錄：[authorization-status.json](../../deployment/uat/authorization-status.json)。完整條件與實證：[生命週期執行方案](UAT_LIFECYCLE_EXECUTION_PLAN_20261109.md)。[最初未填模板收件](UAT_ENV_APPROVAL_RECEIPT_20261109.md) 保留歷史，不能覆蓋後續欄位。固定 ZIP 內舊授權快照同屬歷史，不為改文字重建封包。

現在缺 live 登入／公司付費組織與估價核對、真執行器與告警送達；不是預算或整體範圍未授權。公開紀錄不含帳務原始資料、憑證、付款資訊或真備份。Dashboard 帳戶不會自動成為產品測試會員；專用 Auth 帳號與單位角色須在新 UAT 配置。
