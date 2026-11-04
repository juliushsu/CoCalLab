# 原選單、頁面與操作保留核對（2026-11-04）

本次固定比較 UAT 基準 `7dccd5452152f2495d10ad1437d5d03215166065` 與功能來源
`e737bc4b9f19cf6ce04bd13fe80e6bf3eeed03f3`。兩者不是「已合併／已部署／已驗收」的宣告。
範圍只含 routes、AdminLayout 與這段差異實際修改的五個頁面；不重做 H0，不重開已關閉的安全審查。
固定基線比較採原始碼與差異核對；本批另有6a0f76b的隔離瀏覽器證據，見下方更新，沒有登入雲端或宣稱業務驗收。

## 路由與選單的實際數量

`frontend/readdy-app/src/router/config.tsx` 與
`frontend/readdy-app/src/components/layout/AdminLayout.tsx` 在兩個版本**內容逐位元組相同**。
頁面實作變短不能據此判定路由被刪；操作是否縮減另列於下表。

| 項目 | UAT 基準 | e737bc4 | 結論 |
| --- | ---: | ---: | --- |
| 明示 `path` 宣告，含 wildcard | 29 | 29 | 沒有新增、刪除或換路徑 |
| `ProtectedRoute` 宣告 | 23 | 23 | 登入保護路由保留 |
| 公開首頁／登入 | 2 | 2 | `/`、`/login` 保留 |
| redirect | 1 | 1 | `/admin/documents` → `/admin/documents/upload` 保留 |
| `NotFoundPage`，含 wildcard | 3 | 3 | 原本就存在，見下一節 |
| AdminLayout 選單群 | 6 | 6 | Workspace、Carbon Inventory、Reporting、Methodology、Product & Supply Chain、Platform |
| 選單定義項目 | 22 | 22 | 是定義數，不是每個角色畫面都可見的數量 |
| 明示 `comingSoon: true` | 7 | 7 | 原本未實作的停用項目保留 |

29 條路由的來源位置為 router/config.tsx:57–167，完整路徑如下：

| 群組 | 路徑 |
| --- | --- |
| 公開 | `/`；`/login` |
| 組織 | `/admin/organizations`；`/admin/organizations/create`；`/admin/organizations/:id/members`；`/admin/organizations/:id/edit` |
| 專案 | `/admin/projects`；`/admin/projects/create`；`/admin/projects/:id`；`/admin/projects/:id/edit` |
| 文件 | `/admin/documents`；`/admin/documents/upload`；`/admin/documents/list`；`/admin/documents/drafts` |
| 活動 | `/admin/activities`；`/admin/activities/:activityId` |
| 報告 | `/admin/reports`；`/admin/reports/history`；`/admin/reports/esg`；`/admin/reports/ifrs`；`/admin/reports/:reportId` |
| 其餘 | `/admin/subscription`；`/admin/product-carbon`；`/admin/emission-factors/list`；`/admin/emission-factors/sources`；`/admin/analytics`；`/admin/ai-governance`；`/admin/carbon-adjustments`；`*` |

角色與單位範圍仍由既有 `useTenantNavigation`／`navigationItemAllowed` 決定；未知角色只保留組織／專案選擇入口。
Workspace 群有 owner/admin 限制，Platform 群有 platform_admin 限制；租戶角色不會自動變成平台管理員。
這些是 UAT 基準已有的行為，並非本段新增隱藏選單。
來源：AdminLayout.tsx:92–178、:332–353；navigationScope.ts、useTenantNavigation.ts。

## 原本就是 NotFound／comingSoon 的項目

| 項目 | 基準已有狀態 | 本次判定與來源 |
| --- | --- | --- |
| Product CFP `/admin/product-carbon` | 路由直接呈現 NotFound | 沒有被本次改成 NotFound；router/config.tsx:140–143 |
| AI Governance `/admin/ai-governance` | 路由直接呈現 NotFound | 沒有被本次改成 NotFound；router/config.tsx:156–159 |
| wildcard `*` | NotFound | 原有未匹配路徑行為；router/config.tsx:164–167 |
| Validation、Self-Monitoring、Methodology、CBAM、AI Providers、Feature Flags、Environment | `path: '#'` 且 comingSoon，非可操作頁面 | 七項均保留；AdminLayout.tsx:128、138–139、148、159–161 |
| 文件 Excel／CSV 匯入與模板 | 基準模板按鈕 disabled，沒有匯入處理器 | 現版保留「尚未提供」文字，沒有把可用匯入拿掉；基準 DocumentUploadPage.tsx:786–810；現版:258 |

`/admin/reports/esg`、`/admin/reports/ifrs` 在兩版都指向同一 ReportCenterPage；路由存在不等於對應報告已可產生。
其他未修改頁面的功能現況不在本輪重新驗收。

## 修改頁面的原操作 → 新行為

下列行號的「基準」指 7dccd545，「現版」指 e737bc4。頁面均位於 `frontend/readdy-app/src/pages/admin/`。

| 頁面／原操作 | 原來源證據 | e737bc4 的實際行為／來源 | 分類與處置 |
| --- | --- | --- | --- |
| DocumentUpload：拖放、選 PDF／圖片、多檔佇列、刪除未送出檔案 | 基準 documents/DocumentUploadPage.tsx:195–255、:743–782 | 真檔案佇列、拖放／file input、待處理／失敗項取消仍在；現版:135–173、:240–275 | **保留並補強**；0 bytes／格式標記／MIME／副檔名／10MB 明確檢查，並非刪除原來支援的格式 |
| DocumentUpload：拍照、相簿 | 基準:239–241、:644–685 的原生 file input；並非內建相機程式 | 現版:246–252 保留拍照 capture 與相簿 input | **入口保留／呈現改版**。拍照不保證每台桌機會開相機；現版拍照 input 不帶 multiple，相簿／一般選檔仍帶 multiple，列為原生操作差異待確認 |
| DocumentUpload：手動輸入 | 基準:6–42 為導引 modal，:455–467 轉往活動清單 `?create=true` | 現版:256–258 直接轉往同一既有建立活動 modal，補 projectId／organizationId；活動頁及 CreateActivityModal 未在本段修改 | **原導航保留、移除一層導引**。不宣稱正式「文件→非 Mock 草稿」入口已建成，也不把此導航當作商業流程驗收 |
| DocumentUpload：重複檔案仍要上傳 | 基準:256–268、:310–324 可選「仍要上傳」；原 schema 已有 project/hash 唯一限制 | 現版改核對既存 receipt 與私有原檔 size/MIME/SHA，再重用；錯誤不當不存在；services/documentIntake.ts:118–132、:156–174、:220–225 | **刻意收窄**，避免重覆寫檔／假成功；若商業上需同內容多版本，須 CTO 確認版本語意，不能擅自繞過現有唯一限制 |
| DocumentUpload：上傳後自動 OCR→分類→completed | 基準:350–393 呼叫 process-document／classify-document；provider factory 只有 Mock 實作 | 現版:219 明示 upload-only；不呼叫該兩個處理器，OCR pending；services/documentIntake.ts:179–204、:231–235 | **撤回未完成／Mock 自動操作，非真 OCR 完成功能被刪**。真 OCR、草稿建立與分類仍 MISSING；恢復真流程的產品時序待 CTO 排程 |
| DocumentUpload：進度百分比與完成彈窗 | 基準:329–410 用固定 20/40/50/70/80/100、:427–431 判斷完成 | 現版以 checking/uploading/recording/reconciling 和逐檔回執／錯誤表示；新增下載參考、唯讀核對、原 ID 補登記、只放棄本機參考；現版:264–279 | **替換呈現**。不把固定百分比或 OCR 假完成保留為真進度；未知結果不假報成功／未保存 |
| ExtractedDraftReview：單筆確認、駁回、批次確認、全選、備註／類別／範疇、AI explanation 展開 | 基準 documents/ExtractedDraftReviewPage.tsx:92–195、:327–632 | 原操作保留；confirm-draft 改成有 org/project/decision/overrides 的契約；三個對話框確實 open；現版:110–141、:403–438、:447–550，services/draftReview.ts:79–129 | **修契約與錯誤處理**。explanation 仍是既有規則式預覽，不升格成真 AI |
| ExtractedDraftReview：任何 provider 都可確認、錯誤後直接重送 | 基準全選／確認沒有 synthetic provider 檢查 | 現版排除 mock/fixture/synthetic 的確認與全選，可駁回；結果未確認須重讀；現版:35、:84–87、:334、:399–404 | **安全／真實性收窄**，保留原因。非 Mock 的完整生產草稿來源仍待建立 |
| UploadedDocumentList：草稿入口與其他篩選／下載／刪除 | 基準 documents/UploadedDocumentListPage.tsx:375 只有 document query | e737bc4 只有這一行改動：草稿連結同帶 document/org/project；其他列表操作來源未動 | **導航補 scope**，不是下載與刪除已驗證。列表私有檔案讀取與多單位 scope 缺口為本批主代理另行實作，不能提前算進固定來源成果 |
| ProjectOverview：編輯、上傳、活動清單、報告入口 | 基準 projects/ProjectOverviewPage.tsx:60–83、:250–280 | 四入口均保留並帶正確 org/project aliases；現版:54–75、:249–277 | **保留並補 scope** |
| ProjectOverview：總排放、完成率、專案類型 | 基準 services/projectService.ts:73–140 讀 co2e_total／零回退，活動納入率顯示為 completion；頁面:149–154、:219–245 | 最新 active+included 計算的 co2e_kg 一次換算；不完整為未知；「納入率」取代「完成率」，boundary_type 取代來源不存在的 project_type；現版:140–141、:210–241 | **修數值／欄位／語意**，不是隱藏真統計。若需另有商業完成率或專案產品類型，須 CTO 定義，不能以這個比例冒充驗收完成 |
| EmissionActivityDetail：活動內容與排放快照 | 基準 activities/EmissionActivityDetailPage.tsx:28–94 讀取 API 為註解，內容是固定 Mock | 現版:37–62、:90–123 讀真資料與最新計算／係數／輸入快照，新增重讀、無資料及錯誤；金額／標籤／舊 verified metadata 不再用固定值填入 | **Mock 替換為可證實欄位**；不宣稱原虛構欄位已商用交付。需要的金額／標籤等產品欄位可另列契約需求 |
| EmissionActivityDetail：人工驗證、編輯、重算 | 基準:99–151：驗證只 setState＋alert；重算只是 alert；編輯導向未定義的 `/admin/activities/:id/edit` | 現版:84–87 保留三個明示 disabled「尚未提供」按鈕 | **撤回假成功／未實作入口**。真人工驗證、編輯、重算仍待 CTO 排程；不恢復假 verified 狀態 |
| EmissionActivityDetail：查看來源草稿、來源文件 | 基準:154–165、:519–552 確有兩個導航；query 當時不保證精準定位 | e737bc4:125–131 只顯示 source IDs，移除了點擊導航 | **真導航縮減，須恢復**；不能因基準資料是 Mock 就把導航當假操作刪除。本批主代理已承接可逆恢復，待下節最終來源核對 |

Mock provider 證據限本功能相關來源：`backend/src/providers/index.js:1–18` 只建立 MockOcrProvider／MockLlmProvider，其他 hint 拋 Unsupported；`process-document/index.ts:80–87` 預設 provider 為 mock。
本表不推論任何遠端已部署 provider 狀態。

## 本批恢復與待 CTO 裁定

主代理已在本批工作樹恢復活動明細的來源導航，唯讀來源核對如下；只在真實來源 ID 存在時顯示：

| 恢復操作 | 本批實際目標 | 來源與限制 |
| --- | --- | --- |
| 查看來源文件 | `/admin/documents/list?organization_id=<org>&projectId=<project>&document=<source_document_id>` | EmissionActivityDetailPage.tsx:114；有 source_document_id 才提供，不造替代 ID |
| 開啟來源所在的待審清單 | `/admin/documents/drafts?organization_id=<org>&project_id=<project>`，有 source_document_id 時再帶 `document=<id>` | EmissionActivityDetailPage.tsx:115；有 source_draft_id 才提供，文案明示「已確認來源草稿不列於待審」；不冒稱來源草稿 detail page |

**固定累積比較仍是 e737bc4；本批導航恢復已固定於 `6a0f76bafb2864a436209d1b4e9c0d3651f9dffe`。活動來源鏈接只有來源證據，未做真服務瀏覽器回歸，不能冒稱已部署或驗收。**
文件列表的新 scope／私有下載服務另有合成 SDK 測試，該測試也不替代上述實際頁面導航驗收。

需要 CTO 確認的產品範圍為：真 OCR／分類的接入順序；活動人工驗證／編輯／重算的完成條件；是否需要同內容多版本；商業完成率／產品類型的獨立定義。
停止假成功、保留安全邊界與上述導航恢復不應等候逐項催辦。既有 Excel/CSV、NotFound 與 comingSoon 另列，不混算成本輪刪除。

多單位核對沿用 `organization_id + project_id`：單位與專案不是互相替代的 ID；顧問能看見多個已授權單位不等於跨單位合併讀寫。
未來每批需記錄「來源入口 → 頁面 → 操作 → 讀寫 scope → 失敗狀態」，不能只報路由數或把選單可見等同 RLS 已驗。

## 隔離預覽方案（最初來源評估；實作更新見下節）

**以下保留最初尚未建立入口時的方案；不作目前服務狀態聲明。** 不需要刪除首頁、改 AppRoutes 或把後台換成單頁 demo。
來源 `src/main.tsx:1–13 → App.tsx:8–18 → router/config.tsx` 已是原本完整入口；首頁 `pages/home/page.tsx:1–30`、登入 `pages/auth/LoginPage.tsx:1–50` 與 AdminLayout 均保留。

原 `vite.config.ts`：以 `BASE_PATH` 設 base、build outDir 為 `out`；dev server 是 `host: 0.0.0.0, port:3000`。
`package.json` 的 dev 是 `vite`，preview 是 `vite preview`。`IS_PREVIEW` 只被定義為 compile constant；目前 src 沒有資料隔離／登入替身實作，單純設旗標不會得到離線後端。
僅選 `--mode` 也不能保證不讀既有 `.env/.env.local`。

建議主代理另建明示本機預覽 launcher／設定 wrapper，不修改正式設定：

1. 沿用原 Vite config、main/App、29 條路由、真首頁／登入頁／AdminLayout；server 明確覆寫為 `127.0.0.1`、檢查後選擇未占用 port、strictPort，保留既有 5432 與其他專案。尚無可用 port／入口的聲明。
2. `envDir` 指向專用空目錄，程序只提供允許的本機／合成設定；不讀取正式 `.env`、雲端 URL、金鑰或企業資料。只加 `--host 127.0.0.1` 不會隔離來源服務設定。
3. 若只預覽公開 UI：服務未設定時呈現原首頁與原登入「尚未設定」狀態；ProtectedRoute 會阻擋後台，不能宣稱已預覽登入後操作。
4. 若要同時預覽登入後導覽：另用清楚標示的本機 Auth／API adapter 或攔截 transport，限制為合成兩租戶／必要角色；保留原頁面與 layout。必須明示 adapter、可用路徑與禁止寫雲端的網路邊界，不把替身登入當成真 Supabase/JWT 驗收。
5. 原 index.html 有外部字型、圖示與 Readdy 圖片 URL；隔離模式需阻擋或以明示本機資產替代非本機請求。外部資產未載入與桌面 chooser/camera 權限限制，需分別標示，不判成新增功能刪除。

以上為當時方案評估；後續本批實作如下，沒有雲端資源操作。

## 可重現的來源核對

```powershell
git diff --name-status 7dccd5452152f2495d10ad1437d5d03215166065 e737bc4b9f19cf6ce04bd13fe80e6bf3eeed03f3 -- frontend/readdy-app/src
git diff 7dccd5452152f2495d10ad1437d5d03215166065 e737bc4b9f19cf6ce04bd13fe80e6bf3eeed03f3 -- frontend/readdy-app/src/router/config.tsx frontend/readdy-app/src/components/layout/AdminLayout.tsx
```

第二條應無內容差異。路由數計算只計 config 的明示 path；選單數只計 menuSections 的定義，與角色實際畫面分開。
本文件不是瀏覽器完整驗收、雲端 parity、實際 tenant E2E 或發布核准。

## 本批固定實作更新

`6a0f76bafb2864a436209d1b4e9c0d3651f9dffe`保留原router/AdminLayout/main/App/home/login位元組不變；文件列表沿原入口補scope、私有原檔與可見操作文字，未刪除搜尋／專案、處理狀態、類型篩選／上傳／草稿／刪除確認。舊不安全或歧義物件路徑保留metadata但原檔操作明示unsupported，未搬移或刪除物件。

原首頁4192與合成唯讀原後台4193已用Chrome載入；project-only A、私有原檔dialog與切換B viewer有圖片／文字證據。初期冷載入曾短暫空白，分開Vite cache後已載入；原生download觀測逾時仍未驗，並非下載成功。遠端裝飾資產因隔離CSP阻擋，正式原頁面未刪。

詳見[本批交付與證據](SCOPED_DOCUMENT_LIBRARY_20261104.md)、[啟動與操作](../../frontend/readdy-app/tools/local-preview/README.md)。合成預覽不把首頁原有OCR準確率／客戶數／功能宣稱升格為已驗證；真實多單位隔離仍NOT_RUN/BLOCKED，發布HOLD。
