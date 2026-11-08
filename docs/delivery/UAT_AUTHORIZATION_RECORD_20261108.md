# UAT 預算與執行授權紀錄

**預算條件已由Owner確認；具體UAT環境／操作授權待核准。** 本輪本機修正、封裝與文件已獲授權，不等待Claude或CTO重複回覆。

| 欄位 | 正確紀錄 |
|---|---|
| Owner已選方案 | 同一已付費且經核准的組織中，另建獨立Micro UAT；不沿用含資料的既有CoCalLab專案 |
| Owner原話 | 「本次新增費用累計 US$20、保留 14 天」；本chat回覆call_627d6e5bd6db410eb35930efb5ee1274 |
| 預算狀態 | OWNER_CONFIRMED；**累計**新增USD20，非每月20、非每日20、非無上限訂閱 |
| 支出範圍 | 指定UAT的新增compute、storage、egress、核准備份及實際收取稅費均計入；新付費AI／PITR／add-on不因低於20便自動授權 |
| 保留期 | 14天，從首次獲授權建立資源的實際UTC時間T0起；記T0與T0+14天。此刻未由代理建資源，T0／expiry均為null |
| 計費起點 | 以供應商實際開始計費為準；不能等部署完成才開始算。未查本輪供應商帳單，不宣稱帳戶全體費用為零 |
| 硬上限 | 此紀錄不是平台硬性扣款上限；建立前須核對console費用、credits與14天估算，未知或預計／實際超過20時停止受影響付費操作並交Owner |
| 雲端執行 | WAITING_UAT_ENVIRONMENT_AUTHORIZATION；最新CTO仍未授權資源建立、migration、上傳或其他雲端變更 |
| 目前代理操作 | 只本機；0個代理新建雲端資源、未啟用付費項目，未開始本次保留／計費時鐘 |
| 到期處理 | 不自行刪除。**建立前一併核准**該測試資源的停止計費／暫停或刪除與備份保留方案；到期停止測試／新工作，只執行該具體已授權方案 |

更正：舊NEXT_ACTION曾將「尚未核准雲端建立／操作」籠統寫成「費用未授權」。本紀錄將兩者拆開；不撤回既有USD20／14天條件，也不把預算條件誤認為所有雲端操作皆可執行。歷史估價的每月USD35或其他數字不是本次授權；舊文件保留為當時提案，不能覆蓋Owner上述原話。此輪未重新詢價，舊價格不作現在報價。

機讀單一紀錄：[authorization-status.json](../../deployment/uat/authorization-status.json)。公開紀錄只含上述Owner已在chat提供的預算與條件；帳戶／帳務原始證據、憑證、付款資料不放此處。

## 完成本機包後提交的一次環境授權範圍

| 操作 | 具體提案與尚缺欄位 | 界線／回復 |
|---|---|---|
| 新環境 | CoCalLab-UAT-CLOUD-01、Micro、ap-northeast-1提案；**組織ID待Owner指定／確認**，實際新ref建立後回報 | 新ref必須不同於wynqnvidepzzcwutexvn；不複製main或企業資料；超出USD20／14天先決策 |
| 設定與部署 | 固定fd7候選、Auth/CORS精確localhost4211、13允許functions；16來源中3個Mock/provider不部署 | 不關JWT、不設萬用CORS、不接正式DNS/Readdy；前端僅核准public URL/key後重建 |
| Schema與buckets |46 schema逐hash順序；可能建立documents、staging-receipts、staging-attachments三個private buckets |3歷史fixture HOLD、不自動repair history；套用前checkpoint；不對舊ref執行 |
| 合成驗收 | 新ref的A/B/shared/viewer、必要角色、專用帳號與合成檔；授權包含指定撤權／恢復／故障與原ID重送 | 不發客戶邀請、不匯入真資料、不接外部OCR/AI |
| 升級／復原 | 專用UAT的checkpoint與**另明確指定還原目標**、DB＋Storage備份／核對 | 備份含private ledgers/proofs；物件ID變化不能補簽；不對既有正式DB reset/restore |
| 到期／費用控制 | 建立前確認console估價與實際計費方式，記T0/expiry與檢查人；Owner一併選停止計費方式與證據保留 | 未有明確核准不自行刪除；不把平台budget alert當hard cap；額外備份資源費用仍須納入20 |

Supabase Dashboard登入帳戶不會自動成為CoCalLab產品測試會員；新ref中的Auth測試帳號與單位角色須按上述核准範圍配置，不能拿公開本機fixture密碼登入真服務。

批准上述精確目標與操作後，先交建環境回執再開始四組驗收。實際ref／入口／PG／Edge版本目前UNKNOWN／NOT_CREATED，不預填PASS。Production、main合併與流量切換不在本次授權申請。
