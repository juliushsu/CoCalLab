# 固定 UAT 候選包 — fd7

**本機封裝可執行；來源裁定已收件；等待具體UAT環境授權；發布HOLD。** 這是可核對的本機交付包，不是雲端部署或真服務驗收通過。

| 對象 | 固定版本／用途 |
|---|---|
| 產品候選 | `fd7efcfc6450dbf10f54aa97b65fe48e431b277d` |
| 已關閉核心／SQL | `040509777bb1cb60589a01ce7ec176a4ec54cee7`；本候選server、SQL/RPC/RLS、handler/modules原件完全相同，封裝時git diff與逐hash核對 |
| 本次差異 |5檔10增8刪：報告／HTML／JSON明示「報告產生時」，活動即時查詢明示「本次查詢時」；保存payload不變，未擴權或新增migration |
| Claude固定回覆 | `e4fd606eff21e0641352aec1f97b51051542a4b7`；沿用CTO來源關閉，INSERT具名限範圍關閉；不重送同一份審查 |
| 正式UAT參考基準 | `7dccd5452152f2495d10ad1437d5d03215166065`仍保留；本候選未合併／部署／驗收 |
| Edge靜態產物 |99c233d原16check/16bundle，對fd7每個Edge相依檔比Git原件hash相同；這不是在fd7重跑Deno，更不是managed Edge/ESZIP |
| 費用／執行 | 累計USD20與14天已確認；具體資源及操作授權待核准。target ref=null；未操作雲端 |

## 本機實體包與重現命令

repo root執行（只本機，不讀.env、憑證、企業資料，不呼叫Supabase／psql／部署）：

```powershell
node deployment/uat/prepare-fixed-package.mjs build
node deployment/uat/prepare-fixed-package.mjs verify
```

固定來源SHA已寫在工具中，不接受任意ref／目標主機／連線字串。需既有Node24、frontend dependencies、既有核hash的16靜態Edge bundles與Deno frozen lock；缺少則明示失敗，不自動安裝、不下載、不連雲端。build只在全新專用 `../tooling/uat-package-fd7efcfc6450/` 寫入；已有完整包則只核對，遇部分產物／不一致則保留並停止，不刪除或覆寫。其他專案、5432、原生PG55439與舊預覽不變。

產物：`CoCalLab-UAT-candidate.zip`、`package-manifest.json`及payload；[公開封裝回執](evidence/uat-package-20261108/PACKAGE_RECEIPT.json) 記實際工具checkout、bytes／SHA256與結果。ZIP及大型產物留本機tooling、不提交Git。本次ZIP實際9,024,245 bytes，SHA256 `06d196296123eb07df6496179302e1bfba90a1335127ae459d38d0e94e590c74`；413份固定來源、189份payload，191份manifest項目核對通過。另一主機以固定產品Git來源、manifest與工具重建；ZIP容器含建置時間，不宣稱跨主機重建ZIP byte-identical。原封裝ZIP則必須符合公開回執SHA。

| 包內項目 | 實際用途與限制 |
|---|---|
| fixed-source.zip | git archive只收fd7的程式、原前後台／路由／資產、modules、tests與本機tools允許清單；不含.git/.env/私有交接/真實憑證；保留公開SYNTHETIC測試工具字串，不能用於雲端。保留原49migration歷史 |
| frontend-unconfigured | 真Vite編譯、原App與service、無synthetic adapter；service URL/key明確空白，未讀.env，未配置時拒絕連線。**不是可連真服務的預覽／部署包**，授權新ref/public config後才重建與記新artifact hash |
| edge-static |16份原有ESM／source maps與frozen lock，逐檔核hash；含3份保留來源的Mock/provider。明確deploy allowlist僅13，不可bulk deploy16，也不能靠config enabled=false推定CLI不會部署 |
| schema-proposal |46份增量schema依完整檔名排序及hash；尚未雲端套用 |
| held-history-NOT-APPLY |3份歷史fixture DML分開HOLD；不得對既有專案擅改history，不得db push source.zip中未過濾49份腳本 |
| proposed-config |精確Auth/CORS localhost4211、16 gateway JWT真、原CLI2.122.1 template、候選settings／source manifest／預算授權紀錄；全部NOT_APPLIED，ref=null |
| handover |本結案表、剩餘驗收、授權條件及本說明；不含密碼、JWT、帳號列表或企業資料 |

封裝器本輪實測為Windows／Node24／PowerShell／.NET與既有Deno靜態產物；另一主機重建須具備相同前置。Mac／Linux未驗，不宣稱此Windows封裝命令可直接使用。ZIP與Git來源可跨主機移交，先按公開SHA／manifest核對；不需因此建立雲端環境。

## 部署必備與回復

- **既有專案必須明確重新計算才能產生新版報告；進行中舊重算可能失敗。** 不自動重算、重封存、改歷史latest或覆寫報告。舊報告／原request replay沿原快照。
- 報告／匯出上的收據狀態是**報告產生時**保存值；活動查詢是本次查詢值。兩者都不能暗示原收據佐證人工更正新數值。JSON原snapshot.payload保持原內容。
- 新庫migration順序至001→002→003；46來源不是雲端applied清單。NOT VALID逐項驗證，不能以套用成功代替。現版完整DB＋Storage復原仍未驗；舊da5測試不能移用。
- 備份須涵蓋public及private hash/recalc/report/MANUAL/replacement ledgers/proofs、RLS/ACL/functions；Storage bytes／objectID／generation另備。回退不能只換舊client繞過SQL；不提供猜測逆向migration，不重新簽原件遮蔽識別差異。
- 實際部署需Owner核准的新ref／組織、費用與停止計費方案；不改既有wyn專案、Readdy入口、Production DNS、main或既有企業資料。到期不自刪。

## 驗證範圍

本輪僅重現並修正產生時標示：目標export／disclosure8PASS、type-check／lint與隔離設定的實際Vite build。封裝verify逐hash對來源、Edge與ZIP／payload，機讀回執記結果；沒有為增加數字在本機重跑已關閉SQL或native並行。另用實際React元件render核對保存報告／即時活動時點、payload不變，這不是瀏覽器E2E。

既有程式CI08162ca的44／388+2NOT_RUN／241和原生INSERT具名證據仍是原版本來源證據，不冒稱本輪重跑。新PR的[CI42478675372](https://github.com/juliushsu/CoCalLab/actions/runs/42478675372)已通過，固定head5d345281ed11674ba4b1bfea0010a838b08d001d：backend44／整合388PASS+2NOT_RUN／FE241及type/lint/build；這是本次自動CI實跑，與本機8目標有重疊不相加。[版本回執](evidence/uat-package-20261108/github-ci-result.json)。預算明確拆為OWNER_CONFIRMED與WAITING_UAT_ENVIRONMENT_AUTHORIZATION，詳細 [授權紀錄](UAT_AUTHORIZATION_RECORD_20261108.md)。

下一步依 [真服務剩餘清單](UAT_REMAINING_ACCEPTANCE_20261108.md) 與 [來源結案表](SOURCE_CLOSURE_20261108.md) 交Owner一次核准環境範圍；沒有重複Claude／CTO等待條件。
