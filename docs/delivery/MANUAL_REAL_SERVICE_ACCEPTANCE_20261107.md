# 真服務人工驗收手冊 — 固定候選 ba2c7a56（2026-11-07）

**全部初始NOT_RUN；缺環境則BLOCKED。發布HOLD。** 此手冊可照步驟執行，不代表已授權建帳號、上傳、撤權或部署。程式固定ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde，正式UAT基準7dccd545不變；合成4207預覽不能填為真服務PASS。

## 執行前回執與角色

Owner先核准明確隔離環境、合成帳號／資料、真實上傳、撤權與恢復操作。只拿已核准專案的入口與受限帳密；不使用公開repo測試帳密登入真服務。記OS、瀏覽器版本、實際URL、前端build SHA／functions deployment ID、migration manifest／applied對照、實際JWT gateway與CORS設定，證據目錄使用受限位置，不上傳含JWT的HAR或DevTools畫面。

| 帳號標籤 | 單位A | 單位B | 正確預期 |
|---|---|---|---|
| A-only | owner（另測editor/admin） | 無會員 | 可操作A；不能讀B的ID/API/原件/匯出 |
| B-only | 無會員 | owner | 與A-only對稱 |
| shared | owner | viewer | 可讀A/B，僅A可寫／匯出 |
| viewer | viewer | 無會員 | 可讀A已授權報告／私有附件，不能上傳、確認、計算、刪除或匯出 |
| 管理操作者 | 僅受限管理端 | 依核准範圍 | 執行指定合成帳號撤權／恢復，不借service key給瀏覽器 |

A/B各建獨立專案、唯一合成文件與可追溯request IDs；「shared看得到B」不等於越權。不得用shared代替A-only隔離負例。記實際org/project/document/report UUID映射於受限回執，公開證據只用標籤。

前端planned真服務本機入口4211尚未啟動／配置；4207是既有合成預覽。現有登入僅password，/login成功轉/admin/projects；OAuth、郵件／重設回呼不在本輪，不能填未實作/auth/callback。來源：AuthProvider、LoginPage、router/config。

## 每案記錄模板

| 項目 | 填寫 |
|---|---|
| Case ID／候選SHA／實際部署ID | 必填；UNKNOWN不能填PASS |
| 環境／角色／org與project標籤 | 包含前置有效會員／訂閱與資料狀態 |
| 命令／操作與request/document/report IDs | 憑證只留受限工具，不進記錄 |
| 預期／實際 | 實際HTTP、UI文字、row/object有無與原ID／版本核對；拒絕不只看status |
| 證據位置／UTC時間 | 截圖、檔案hash、脫敏log關聯ID |
| 結果／未驗 | PASS／FAIL／BLOCKED／NOT_RUN，列具體缺口；不把單元或合成測試代填 |

## 合成檔案準備（不需連線）

repo root執行 `node deployment/uat/prepare-manual-fixtures.mjs`，只在repo外、同workspace的tooling/manual-fixtures-20261107建立740 bytes的SYNTHETIC-100kWh.pdf、空檔與無效PDF負例，以及SHA256 manifest；不覆寫不同內容的既存檔。正常PDF hash `0c6a8243d7377da2708a3847e4b1140117fb222d30a18b4ca914ee3ff9bf6d83`。這只是待選檔fixture，不代表已實際上傳；PNG/JPEG另以可讀全合成檔準備並記hash，未備妥就NOT_RUN。

## F：原生選檔與收件

1. F1 A-only登入→/admin/projects→選A專案→文件收件。確認頁面org/project與回執一致，使用全合成PDF（可讀文字100kWh、測試日期／來源），另準備合法PNG/JPEG與大小／SHA256清單。不得把企業原件拿來測試。
2. 透過頁面正常file input開啟**原生檔案選擇器**，從實際檔案選取，再按上傳。只看到檔名／input change不算上傳成功。分別記PDF/PNG/JPEG；相機、相簿屬其他能力，沒有則NOT_RUN。
3. 核對服務端verified收件的document ID、bucket/path、size/MIME及實際server SHA與本機原件SHA一致。保留原文件、receipt／server proof與audit的受限證據。這不是OCR或檔案業務真實性驗證。
4. F2 不合法型別、空檔、大於10MiB、缺少會員或readonly訂閱：UI／server明確拒絕，不能產生假成功收件。不得用改副檔名就視為有效格式。
5. F3 上傳後、receipt回覆前製造已核准故障或中斷，記同document/request／object generation；重新核對先查已有收件，再補登記原物件。不得重傳bytes、換ID或重佔hash；另一分頁先完成時應優先顯示既有收件。
6. F4 放棄本機恢復參考只清該user/project/attempt，明示不刪server檔案；不得把本機參考消失當作伺服器清理成功。
7. 若agent原生chooser因extension file URL權限受阻，記BLOCKED，由Owner手動選檔並提供脫敏結果；不擅自擴權、不以SDK File fixture充當原生選檔。

## D：下載落盤與可讀內容

1. D1 A-only在同專案完成人工轉錄／確認→計算→保存新report。MANUAL標示同人可確認，保留server轉錄／確認者，不假稱OCR或雙人覆核。測試因子若0.5kg/kWh，100kWh應保存50kg／畫面0.05t；其他實際測試因子依已保存結果核對。
2. 從報告歷史選**指定保存版本**→預覽，確認org/project/report/version及server完整性提示。legacy_unverified不能匯出，來源／authority漂移應明確409，不能補簽。
3. 選HTML下載；以OS確認新檔確實出現在選定資料夾，記完整路徑（受限）、mtime、bytes、SHA256；開檔檢查中文、來源ID、保存版本、單位及缺件提示。HTTP200、Blob click、download事件或舊同名檔都不能算落盤成功。
4. 同樣下載JSON，實際讀JSON核對snapshot的report/org/project、version、integrity_status、is_test及scope_totals/gross欄位。比較HTML與JSON為同一保存版本；前端畫面以t顯示，source kg只轉一次。
5. D2 viewer、shared在B、readonly／撤權或跨tenant：不可產生新檔；記拒絕前後資料夾新增檔數。PDF/Word明示未支援，不能以HTML改副檔名交差。
6. D3 延遲匯出讀取後切report／A→B→A／登出同帳號重登／換帳號；釋放舊回覆，不能落盤或導回舊scope。需要受控延遲代理／隔離fault，快速點一下不算race。未能控制窗口則NOT_RUN。
7. PowerShell僅核對Owner指定下載檔：`Get-Item -LiteralPath <實際新檔>`、`Get-FileHash -Algorithm SHA256 -LiteralPath <實際新檔>`；JSON用`Get-Content -Raw -LiteralPath <實際JSON> | ConvertFrom-Json`。不要列印整份真實報告，不將下載資料夾全部上傳。
8. 原生存檔bridge已知能力不足時由Owner手動驗，agent可保留Node產檔證據但此案仍NOT_RUN。

## T：切換、直接ID與附件邊界

1. T1 A-only正常讀A活動／計算／report／私有原件及合法匯出；B-only對稱。保存每個正例作對照。
2. 對A-only以直接B網址、report/document/activity UUID、API body/query、mixed A-org+B-project呼叫；反向也測。不可回B資料／原件／匯出。UI藏選單不是證據。
3. Storage分別測download、private preview、upload假B路徑、overwrite、delete；公開原件URL不可讀。raw DELETE可能200但空結果，必須由B-owner重讀原件／hash證明未刪，不能只看status。已驗證原件合法刪除須走受控handler，普通remove拒絕。
4. shared由A切B後只保留B可讀功能，不能承接A的upload／calculate/export權限；B再回A需fresh查權限與資料。切換時既有清單、預覽、recover journal及late callbacks不得殘留舊scope。
5. viewer可讀同tenant既有snapshot／私有bytes，但不能寫或export；viewer同租戶的原件download／preview是合法既有讀取；報告HTML／JSON export另受服務端授權而拒絕。不要把附件下載與報告匯出混為一談。

## R：撤權、舊分頁及進行中操作

1. R1 同A帳號開兩分頁，B-only另瀏覽器profile，避免共用auth storage混淆。由受限管理端只撤合成A帳號指定membership；此修改需環境明確授權，盤點唯讀授權不足以執行。
2. 在舊分頁不重載，使用舊session/JWT重新呼叫活動讀取、原件預覽、write、匯出／request lookup。舊token仍可能未過期，但server必因membership撤銷拒絕；不得因UI已顯示owner而放行。
3. 同帳號登出重載應仍在登入頁；重新登入不應恢復已撤會員權限。換B帳號後A的journal／recover／文件與匯出不能借用。日常同人同project token refresh則不得中斷原上傳。
4. R2 各自控制六種窗口：Storage bytes→verify complete、MANUAL create/confirm、recalc prepare→commit、report初始授權→publish/read、export讀取→回覆、delete bytes移除→finalize。另受限管理端撤權，再放行原請求。無法控制窗口標NOT_RUN。
5. 拒絕後核對：無偽成功receipt、無新增calc版本、無假completed report、無落盤；delete允許pending/object_absent且保留audit，不能假說跨服務rollback已復原bytes。
6. 明確重授權後使用原request/document ID恢復，核對同ID、版本、result IDs、Storage bytes寫入與audit不重增。不因lookup absent或資料變更自動用新ID；不同輸入應衝突或歷史狀態。
7. 兩獨立PG連線的lock-wait/競態另外驗，記不同pg_backend_pid；瀏覽器兩分頁、Promise.all與PGlite序列不是SQL並行證據。

## 直接API負例範本（僅核准後的全合成UAT）

在受限API client中使用**A-only的user JWT**與同UAT的public apikey，不用service key、不把token寫入此文件或HAR。先記UAT ref/URL與角色，下面只是操作模板，現在未執行：

- 讀B報告ID：GET /rest/v1/report_generations?id=eq.<B_REPORT>&select=id,organization_id,project_id,status。A-only應空結果或拒絕；B-only應讀到同筆合成row。
- B報告匯出：POST /functions/v1/export-report-snapshot，body為organization_id=<B_ORG>、project_id=<B_PROJECT>、report_id=<B_REPORT>。A-only/shared的B viewer均拒絕；B-only合法成功。另將body改A_ORG+B_PROJECT驗混合scope。
- B私有原件：GET /storage/v1/object/authenticated/<BUCKET>/<B_STORAGE_PATH>。A-only不可取得bytes，B-only及B viewer依既有read policy可讀；勿用public URL成功作私有正例。
- B附件收件登記：POST /functions/v1/verify-upload-receipt，沿B-only在本UAT一次合法verify的原完整request body（不是receipt資料列DTO），保留B scope/document/request/path與所有必要欄位，改用A-only JWT重送。應拒絕且B原件／收件不變，不產生新ID。
- raw Storage刪除：DELETE /storage/v1/object/<BUCKET>，body prefixes=[<B_STORAGE_PATH>]。不以200判成功，必由B-only重讀SHA證明未刪；應用合法刪除要走delete-uploaded-document，保留原request ID。

各負例先有同UAT同資料的合法正例；HTTP 401可能只是JWT/gateway尚未配置，不能直接宣稱tenant policy通過。所有讀取只限已核准合成測試資料，不得將本節用於現有專案的唯讀盤點。

## 收件與停止條件

先完成F1/D1/T1正例，再驗負例／故障，避免在部署尚不可用時把所有403當安全通過。跨tenant實際資料洩漏、未授權寫入、檔案假成功或資料不一致標FAIL，保存脫敏證據交CTO；不自行改權限／清bucket／重設專案。

本手冊全部是待執行步驟；真服務帳號、原生選檔／落盤、撤權／fault與復原仍需明確隔離環境授權。Claude使用既有[固定入口9839e1f](https://github.com/juliushsu/CoCalLab/blob/9839e1f5ab6ab21f0e81975b1d43ff447cf692f7/docs/delivery/CLAUDE_INTEGRATION_REVIEW_START_HERE_20261107.md)，只釐清最終整合差異，不重開整案。
