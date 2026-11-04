# 真實兩單位驗收收件範圍

發布 HOLD；固定 UAT 基準 `7dccd5452152f2495d10ad1437d5d03215166065`，功能候選另記。沒有已確認且授權的隔離 Supabase 環境；既有候選專案是否含真實資料／使用者、實際部署與授權均不足以認定可寫。此文件不授權建立或操作雲端；不重試本機 Docker/WSL。

本機 PGlite、SDK transport fixtures、4192/4193預覽均只保留為來源／合成證據。真實案例一律 NOT_RUN（原因：環境／操作授權 BLOCKED）。

| 真實案例（各做A→B及B→A） | 成功判準 | 狀態 |
| --- | --- | --- |
| 不同組織／專案ID、網址與查詢、修改／刪除API | 拒絕或不可見，不能回他單位內容；合法角色操作成功 | NOT_RUN |
| 私有附件read/upload/delete/preview與receipt | 正確會員／角色／scope執行，偽造路徑拒絕；無public URL漏出 | NOT_RUN |
| 報告快照／HTML／JSON匯出及背景工作 | 只含被授權單位，job重新驗權，輸出scope可追溯 | NOT_RUN |
| 撤權與過期／無效JWT、RPC直接呼叫 | 後端/DB/Storage拒絕；不靠隱藏選單 | NOT_RUN |
| 登出重登入同帳號、切換單位／專案後舊回應 | 舊結果不顯示／不啟動後續寫入；已發送請求的伺服器結果另核對 | NOT_RUN |
| migration完整套用、NOT VALID逐項驗證、歷史不一致盤點 | 套用清單、definition/policy drift與實際歷史資料驗證分開 | NOT_RUN |
| 專屬備份、reset、還原及結果核對 | 只限授權目標；row counts/關聯/物件/報告前後一致 | NOT_RUN |

每項證據欄位：版本／checkout SHA、實際服務與migration清單、環境與非敏感資源識別、命令／操作、預期、實際狀態與結果、證據位置、未驗範圍。JWT／密鑰與企業資料不進聊天或公開Git；使用全合成A/B與必要角色。

Owner 決策包：指定全新隔離環境或確認既有資源可做UAT（需先查用途、真實資料與使用者）；界定費用上限、bucket建立／migration／seed、專屬backup/reset/restore範圍及回復方式；安全提供專用測試帳號。不把現有正式候選自動當可寫測試資源。部署SHA無法證實填UNKNOWN。

本批沒有雲端呼叫、migration、bucket建立、物件清理、正式資料複製、費用或production部署。取得具體授權後先回環境建立／選用回執，再逐項實測；這項阻礙不攔本機來源修復與整合。
