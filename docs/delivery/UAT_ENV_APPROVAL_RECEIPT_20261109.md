# UAT 執行範圍核准收件 — 2026-11-09

> 後續已補齊：Owner提供org empvseawywarugdnyhzl，選「備份驗證後刪除該UAT」。下方未填欄位表保留初次收件時點，**不是現在待Owner再填**。現行建立條件及真排程測試見 [生命週期執行方案](UAT_LIFECYCLE_EXECUTION_PLAN_20261109.md)；現在缺live登入／計費核對與真正無人值守執行能力，不缺同一範圍授權。

## 初次未填模板的歷史快照（已由後續 Owner 回覆取代）

**以下僅保留初次收件；當時狀態 WAITING_OWNER_TARGET_AND_END_ACTION 已解除。發布 HOLD。** 不再請Owner重複核准預算／既有範圍，不重審Claude來源結論。

已接受：新專案CoCalLab-UAT-CLOUD-01、Micro、東京ap-northeast-1、固定產品 `fd7efcfc6450dbf10f54aa97b65fe48e431b277d`；新專案內46 schema提案、13允許functions、private buckets、專用測試帳號與合成資料驗收。3份歷史DML仍HOLD、3個Mock/provider不部署。前端localhost，既有專案／正式DNS／Readdy／main不變。累計新增USD20，從實際建立起保留14天；超支預估或目標不符即停下回報。

## 未填欄位，尚不能執行付費建立

| 欄位 | Owner本次送出的值 | 實際綁定 |
|---|---|---|
| Supabase組織 | `【Supabase 組織名稱／ID】` | 尚無實際名稱／ID，不能自行選帳戶或沿用未指定組織 |
| 到期處理 | `【備份後刪除該 UAT／另提停止計費方案供我核准】` | 兩方案未選定；未授權刪除，不假定付費專案可pause |
| 還原目標 | 要求先列精確目標，再執行 | 尚未指定；不建立第二個付費專案、不對既有ref做restore/reset |

已提出前兩個文字欄位的補充問題。收到後即依既有核准接續，先唯讀核對指定組織方案、建立畫面估價、停費方式與region，再交實際新ref／入口／SHA／T0及expiry／資源與安全憑證取得位置回執。還原另先列精確target；未將這項空白擴成所有本機工作都要等待。

## 已完成、不依賴空白欄位的前置

- 重新執行 `node deployment/uat/prepare-fixed-package.mjs verify`，191項hash通過；ZIP仍為9,024,245bytes、SHA256 `06d196296123eb07df6496179302e1bfba90a1335127ae459d38d0e94e590c74`。未重建／改寫固定包，未重跑已關閉來源測試。
- 2026-11-09核對官方：[Micro compute](https://supabase.com/docs/guides/platform/manage-your-usage/compute) 為USD0.01344/h，14天336h的**compute單項推算**為USD4.51584，約4.52。不假定可用credits；不包含disk／Storage／egress／稅與備份費。因組織未填，**該組織實際總估價尚未核實**，不能據此宣稱一定低於20。
- [官方刪除／暫停說明](https://supabase.com/docs/guides/platform/delete-project) 與 [暫停限制](https://supabase.com/docs/guides/platform/free-project-pausing)：付費專案不能直接pause；刪除停止新用量，已累積用量仍結算。停止測試或不部署不會自動停止compute費。不轉移其他專案、不降級共用付費組織來停費。
- 收件時機讀紀錄已區分 `scope_authorized_by_owner=true` 與目前 `authorized=false`（目標／到期未綁定，不能開始建立），見 [authorization-status.json](../../deployment/uat/authorization-status.json)。原11/08固定包內的授權快照是歷史，現行Owner指示與此機讀紀錄優先；不為更新核准文字而改ZIP hash。

目前仍0個代理新建雲端資源，未開始本次T0／保留期限或計費；沒有讀企業資料或操作既有wyn專案。供應商實際帳單本輪未查，不能將上述敘述解讀成整個帳戶費用為零。缺指定組織時不登入其他帳戶猜測目標。

下一條本機安全命令仍是核包verify。補齊組織與到期選項後才執行指定組織的建立前估價；不用再次等待同一份Claude／CTO回覆。首次還原前另列精確source/target／備份位置與核對方法，不先執行。Production仍HOLD。
