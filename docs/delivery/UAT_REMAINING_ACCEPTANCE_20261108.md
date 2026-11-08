# 真服務剩餘驗收清單 — 固定候選fd7

**尚未執行；環境操作授權待核准；發布HOLD。** 本文件不重開來源審查。候選 `fd7efcfc6450dbf10f54aa97b65fe48e431b277d`＝已結案040核心＋報告產生時標示；正式UAT參考基準仍 `7dccd5452152f2495d10ad1437d5d03215166065`，未冒稱它已升版／部署／驗收。

先依 [環境授權申請](UAT_AUTHORIZATION_RECORD_20261108.md) 確認新ref／組織與費用，再回報建環境回執：實際入口、前後端SHA／bundle hash／deployment IDs、49來源與46提案／實際applied清單、PG與managed runtime版本、Auth redirects/CORS/JWT、private buckets、合成帳號取得位置與唯一備份／還原目標。沒有密碼／token／key。4217合成預覽、PG55439與既有wyn專案均不是此真服務UAT。

每案狀態現在皆 **BLOCKED（缺已授權真服務環境）／實際結果NOT_RUN**。只有實測後可更新PASS／FAIL；先有同環境同資料的合法正例，再做負例，避免把未配置服務的401當隔離成功。

| ID／驗收組 | 必要實測與成功條件 | 目前證據界線 |
|---|---|---|
| B01 瀏覽器／登出 | 登出→重載仍登出；同帳號重登、換帳號與A→B→A後舊回應失效；例行token refresh同人同專案操作可續 | 來源／合成測試，非真Auth |
| B02 storage相容性 | storage不可用拒絕登入並清楚提示；不使用新Map假稱持久登出；損壞journal可隔離／明確放棄 | 真瀏覽器相容性未驗 |
| B03 原生選檔 | PDF/PNG/JPEG實際chooser→上傳成功；空檔／超限／偽副檔名拒絕；記bytes/MIME/hash | fixture備妥不等於chooser完成；權限不足由Owner手測，不自行擴權 |
| B04 原生下載 | HTML與JSON落實際新檔，記mtime/bytes/SHA並重讀同保存report/version、kg/t單位、產生時狀態與缺件 | Node產檔／Blob click不算原生落盤；PDF/Word未提供 |
| B05 進行中匯出 | 延遲匯出→切報告／換單位／登出重登／撤權；舊回覆不產檔，取消有具體原因可重試 | 含React前景刷新觸發，控制不了窗口就NOT_RUN |
| J01 JWT／gateway | 無效、過期、缺JWT拒絕；合法user JWT成功；不為排錯關verify_jwt | 真getUser/gateway/SQLclaims均須留證 |
| J02 租戶／角色 | A-only/B-only正反向直接ID、網址、REST/RPC、mixed org/project；shared A-owner/B-viewer分別處理；viewer/readonly拒絕寫入與報告匯出 | 附件同租戶viewer合法讀取與報告匯出權限要分開 |
| J03 撤權／舊分頁 | 在上傳verify、MANUAL確認、recalc prepare/commit、report publish/read、export、delete finalize窗口撤權；舊JWT不可沿用會員身分 | 拒絕後row/object/audit不假增；明確恢復授權後原ID續查 |
| J04 MANUAL歷史 | REST INSERT旁支、改綁文件、舊handler／direct RPC、確認前後與重送不得另生活動／計算／audit；合法MANUAL／非MANUAL可用 | 已來源關閉，這是實際服務部署回歸，不重新裁定來源 |
| J05 更正／排除 | 合成factor1：100→120→明確重算→新報告只120；old100及proof全JSON不變。legacy只exclude保留原值／legacy狀態，correct拒絕；排除不重複計入 | 理由／lineage偽造直接API/SQL拒絕；狀態是報告產生時，不是更正時 |
| J06 原請求恢復 | 寫入後丟回覆／關分頁再登入，服務端找回同request/intent/successor；不同actor不取得私有意圖；撤權拒絕 | 不能遺失session journal就新request；比前後筆數／audit |
| J07 重算與報告來源 | 同ID重送不增版本；不同輸入不誤用舊結果；直接改活動／計算、偽造版本／reason/lineage、舊RPC不產可信報告；合法編輯→重算→保存成功 | 舊request查回原結果與目前有效性分開；不改歷史latest證據 |
| S01 私有原件 | A合法upload/read/preview/delete受控流程，B路徑偽造、覆寫、刪除、signedURL越權拒絕；B原件重讀SHA仍相同 | raw DELETE200空結果不能算成功，public URL不能取得private bytes |
| S02 伺服器hash | 真Storage受授權原件→服務端SHA；偽hash不佔可信unique、size/MIME不一致拒；跨租戶與直接REST偽造拒 | metadata一致不等於內容真實／SHA驗證；需真bytes證據 |
| S03 部分收件失敗 | bytes成功/row失敗：先查既有回執／原物件，再原documentId補登、不重傳；另一分頁已完成優先查回 | 放棄本機參考只清該user/project/attempt，不刪server檔 |
| S04 部分刪除失敗 | Storage失敗／空ACK／物件不在／finalize丟回覆；pending可恢復且保留audit；引用／處理中拒刪，原ID重試不重複 | 不宣稱DB＋Storage原子交易；準備清理先驗exact target |
| M01 Migration | 全49來源hash對實際history，依批准46schema提案套用；3歷史DML保留HOLD，不能自動CLI history repair；核RLS/RPC/trigger/ACL/bucket drift | source清單不是live清單；不得db push未過濾49檔 |
| M02 NOT VALID | 列每個convalidated=false約束，記不一致筆數與明確的逐項VALIDATE結果；既存不一致資料不自動修復 | 套migration成功不算歷史資料驗證 |
| M03 備份／復原 | 新候選完整public＋private hash/recalc/report/MANUAL/replacements/proofs與schema/RLS/ACL/functions；Storage bytes/path/objectID/generation另備；指定獨立還原目標逐row/hash核對 | 舊da5同cluster復原不算此候選／managed復原；識別漂移不得重新補簽 |
| M04 N4剩餘並行 | **UPDATE兩draft trigger間**獨立PG連線＋observer，fresh stats、實際PID／Lock/blocker／40P01或其他結果；rollback、原ID恢復、權限與合法更新 | INSERT具名來源已限範圍關閉；其他未具名confirm/recalc/report/delete／特權組合逐案列，沒有測就NOT_RUN |
| O01 代表使用者 | 合作公司與19+1代表依核准範圍用合成資料走操作、角色、報告與復原，Owner確認業務驗收標準／未支援功能 | 工程候選不作合規、OCR或商業承諾 |

## 操作與記錄

沿用 [原生選檔／落盤詳細步驟](MANUAL_REAL_SERVICE_ACCEPTANCE_20261107.md) 的F/D/T/R操作方法；其ba2版本與初始狀態是歷史，本表固定fd7與最新裁定優先。不要重跑整案來源稽核或用舊PASS代填此表。

每案記：case ID、固定產品/前端/Edge SHA、實際ref/PG/runtime/browser與精確origin、actor別名/A或B及角色前後、操作或命令、request/document/activity/report ID、HTTP/SQL真結果、row/object/audit前後筆數與hash、證據位置、UTC時間、結果及未驗範圍。JWT/HAR/原件與帳號列表只留已授權受限位置，公開Git只放脫敏合成結果。關聯ID不能省略，失敗後原ID查回不能換新成功掩蓋。

發現跨租戶洩漏／未授權寫入／假成功／來源斷鏈：標FAIL、保存受限證據，停止受影響操作交CTO；其他不受阻本機工作可續。任何新增費用、雲端schema／既有資料變更、reset/seed/restore都依已核准精確範圍，不將此清單當授權。全部必要真服務證據與Owner驗收完成前，發布仍HOLD。
