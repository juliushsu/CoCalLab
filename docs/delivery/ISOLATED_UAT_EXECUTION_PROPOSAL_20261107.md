# 隔離環境整合驗收方案 — 2026-11-07

**WAITING_OWNER／NOT_CREATED／NOT_RUN；發布HOLD。** 供一次核准，未建立或修改資源。正式UAT仍7dccd545；候選固定程式SHA為ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde，見[本輪交付](INTEGRATION_ACCEPTANCE_DELIVERY_20261107.md)，不使用移動branch HEAD。[初始相依基線](INTEGRATION_CANDIDATE_BASELINE_20261107.md)。

## 已知資源與選項

[Mac固定盤點60677af](https://github.com/juliushsu/CoCalLab/blob/60677af8726e21033bda6302964a08386a7f46fe/docs/handover/PC_AGENT_RESOURCE_INVENTORY_20261102.md)只確認候選Supabase wynqnvidepzzcwutexvn存在、ap-northeast-1。其程式綁定、用途、真實資料／使用者、PG版本、applied migration/functions、復原能力皆未證實；不可當空白UAT，不向其寫入。Cloudflare帳戶／Pages、Railway hosting及Runway影音皆UNKNOWN，不混稱；本輪未新增登入盤點，帳單／用量未取得。

2026-11-07官方USD月費估算，稅金／匯率／超量另計，非實際帳單：

| 選項 | 環境／入口 | 預估增量與限制 |
|---|---|---|
| A推薦 | 新CoCalLab-UAT-CLOUD-01，建議ap-northeast-1；獨立DB/Auth/private Storage/Edge。前端先localhost；跨主機才新增獨立Pages UAT | 新Pro organization首個Micro約$25；既有paid organization額外Micro約$10，實際方案／credits未知。Free有名額可$0，但無自動備份、可能暫停。建議月上限$35，超過先停新增支出再申請，不保證硬上限 |
| B | Owner提供獨立Docker主機，CoCalLab-UAT-REMOTE-01專用stack/network/volumes、綁該機localhost或已有受控tunnel | 軟體$0，主機／網路／儲存UNKNOWN；需固定CLI/container digest。不重試本Windows Docker/WSL。不能當managed backup驗收 |
| C暫不推薦 | 沿用現有CoCalLab Supabase；先唯讀證明無真實資料、其他服務依賴與隔離，再另核准 | 基礎增量可能$0，方案／用量／歷史資料及復原風險UNKNOWN；目前未具寫入授權 |

Pro每日備份保留7天，額外專案compute按時數計費。[Supabase價格](https://supabase.com/pricing)／[多專案計費](https://supabase.com/docs/guides/platform/billing-faq)。**DB備份不含Storage bytes**，須另備份原件。[官方備份限制](https://supabase.com/docs/guides/platform/backups)。

純靜態Pages請求增量$0；Free 500 builds/月、單檔25MiB，帳戶剩餘配額UNKNOWN。不啟用Functions／Workers／付費Access／新網域。[Pages價格](https://developers.cloudflare.com/pages/functions/pricing/)／[限制](https://developers.cloudflare.com/pages/platform/limits/)。

Railway不是必要資源，backend使用Supabase Edge，不將合成Node adapter搬上雲端。若另選，Hobby $5／Pro $20為最低承諾並抵用當月用量、超額另付，需再申請具體配置。[官方計費](https://docs.railway.com/pricing/understanding-your-bill)。Runway影音不啟用。

## Owner一次核准清單

| 操作 | 唯一目標／允許範圍 | 回復 |
|---|---|---|
| 新專案 | 僅CoCalLab-UAT-CLOUD-01；指定帳戶／區域／方案／上限，先回報實際ref/API URL/PG版本，不預填可用入口 | 停UAT／撤前端連接，先保存證據；不自動刪專案 |
| UAT部署 | 固定候選SHA的Edge及靜態前端；跨主機才建cocallab-uat-01 Pages（名稱可用性未知）。不接正式DNS／Readdy／main，關自動部署 | 留前版bundle/dist；先驗資料相容，不能單切舊client |
| migration | 僅新ref的public/private schemas；逐份SHA256及結果 | 專屬checkpoint還原，不猜逆向migration |
| bucket／帳號／seed | 明確包含migration可能建立documents private bucket及staging-receipts。全合成A/B/shared/viewer/editor/admin/owner；Admin API只建該project帳號 | 停用UAT帳號、保留audit；不發客戶邀請，不匯入正式資料 |
| 備份reset還原 | 僅該新ref的一次明確窗口與列出的UAT row/object IDs；先驗checkpoint及Storage備份 | 還原自身checkpoint；差異未解停止。刪專案不在預設授權 |
| 真隔離與並行 | 真JWT/PostgREST/Edge/Storage、兩獨立PG連線、人工原生選檔／存檔 | 留FAIL/BLOCKED與log關聯ID，不以合成填PASS |

不包含main合併、正式部署、舊ref寫入、正式資料匯入、付費PITR／網域、OCR/AI／外送、中央API或自動清理。憑證僅密碼管理器或受限未追蹤檔案，位置／方式留受限回執，不進公開Git／聊天。前端只含UAT public URL/anon key；service_role／DB／Admin API僅server。不可用公開repo測試帳密登入真服務。

## 版本及migration前置

Node24.22.1、SDK2.57.4／lockfile為本機實測；PGlite0.5.13／PG18.6只是合成證據。managed PG精確版本UNKNOWN，先讀select version()，不能假定相同。Supabase CLI／Deno／Storage版本、Edge bundle及deployment ID尚UNVERIFIED，部署前固定並記錄；不把Node shim當Deno驗收。

尚無已核實可直接執行的部署config；補Auth redirects／CORS／JWT gateway及相依bundle檢查。不因401關閉JWT檢查。前端source設定為VITE_PUBLIC_SUPABASE_URL／VITE_PUBLIC_SUPABASE_ANON_KEY；APP_ENV=staging、REPORT_EXPORT_POLICY=tenant_write_v1僅UAT server，SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY不輸出值。

同SHA必要functions：verify-upload-receipt、manual-transcription、confirm-draft、recalculate-project、generate-report、export-report-snapshot、delete-uploaded-document及_shared、backend/src、modules/file-verification；路由需要的analytics／adjustment／organization／subscription handlers亦同版。process-document/classify-document/run-ai-audit含Mock，不作真OCR成功，不接外部provider。

migration按完整檔名排序，初始40份加006報告完整性。三份歷史fixture seeds不可直接灌雲端；先核對DDL／history及資料副作用，準備fresh專案套用清單。本機排除fixture不等同Supabase history對齊。每份檔名／SHA256隨候選交付。

## 受控次序（此刻全部NOT_RUN）

1. 先回報建環境回執：主機／入口、實際ref、固定SHA、資源、憑證取得方式、隔離證據、唯一備份還原目標；ref不能是wynqnvidepzzcwutexvn。非新空專案或識別不明則BLOCKED。
2. 乾淨固定checkout，記差異、lockfile、migration SHA256、bundle/dist manifest。CLI顯式指定授權ref／安全連線，不用殘留default link；實際redacted命令寫回執，不提供可能誤指正式的一鍵reset。
3. fresh完整套用／合成seed；pg_constraint.convalidated=false逐項列資料不一致筆數及獨立VALIDATE結果。套用成功不等於歷史驗證成功。合成因子標測試用途，100kWh→50kg只驗單位／契約。
4. 四組真服務：瀏覽器登出重載、延遲後重登、storage disabled；無效過期JWT、撤權、跨tenant／viewer、合法正例；附件私有讀寫預覽刪除及partial恢復；migration/drift/upgrade/backuprestore。A/B/shared/viewer逐項驗ID、網址、API、附件、匯出、換單位、舊分頁及進行中窗口。
5. 兩獨立PG連線記不同pg_backend_pid()，timeout測recalc同request／異輸入及delete-reference先後／lock-wait／rollback/audit。Promise.all或同queue不算並行。
6. 升級前加密checkpoint：roles/schema/public＋所有private ledger（含report authority）與必要auth；記migration/schema hash、table count、PK排序digest。另備Storage bytes/path/object UUID/metadata/SHA與服務設定/functions bundle。公開repo只留脫敏摘要。
7. 在專屬UAT由核准前版升級固定候選，驗legacy不升trusted、引用/audit保留；再於明確窗口還原。重新上傳可能改object UUID，必須實測generation與private proof一致；不一致應fail closed標BLOCKED，交CTO定restore/re-attestation，不能手動補簽或假報復原成功。
8. 還原後核對附件／recalc／report／delete ledgers與audit、NOT VALID、ACL及原件digest，驗sameID查回、跨tenant拒絕、合法匯出。不推論跨服務atomic或未測RPO/RTO。
9. 每項列版本、環境、實際命令／操作、結果、證據位置、未驗範圍。未跑NOT_RUN、缺環境BLOCKED；保留／關閉UAT依Owner決定，不自動刪資源。

請Owner選A/B/C，指定帳戶或主機、上限／期限，明確核准上表操作。部分核准則其餘WAITING_OWNER；來源工作繼續。目前未取得具體授權，未建立環境／操作雲端，不宣稱真驗收或商用完成。
