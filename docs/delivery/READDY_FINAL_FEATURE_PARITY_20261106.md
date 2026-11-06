# 最新 Readdy ZIP 功能保留核對 — 2026-11-06

**結論：主要路由沒有變少，但最新 Readdy 新增的部分資訊介面與頁內導航尚未接入目前工程候選，不能宣稱「功能完全沒有縮減」。** 另有大量Mock／假保存被撤回或改成真服務，不能把它們混算為已完成業務功能遭刪除。

## 固定來源與方法

- 使用者提供 `project-10369280 (2).zip`，SHA256 `f6e909dc801a6785b7be453a53da24bde38efa20be3b5357cda1a19e2e309325`；177個ZIP entries、約1.20MB解壓大小。
- 本次比較目前M1業務程式 `18c0894cf9da42eb341ce5835ba36fdc3a7bedc9`（PR #19候選），不是main或雲端部署；M2工具未提交差異不納入此基準。
- 保留原ZIP；只讀取並另存src/package/vite參考，不覆蓋工程、不執行ZIP scripts、不安裝其依賴、不連其環境設定。`.env`未拷入參考／工程或差異文件；內嵌測試憑證不重用、不刊載。
- 來源機械清單：[READDY_FINAL_SOURCE_DIFF_20261106.json](READDY_FINAL_SOURCE_DIFF_20261106.json)。比對112個src/config檔：54相同、54字面差異、4原路徑不存在；目前另有25檔。這是檔案數，**不是功能完成數或遺失百分比**。
- 4個缺少路徑中，AuthContext.tsx已拆為AuthContext.ts／AuthProvider.tsx等，有實際登入與session修復，非登入功能遺失；另外3個才是下列新增UI元件。
- 主代理及獨立代理均作來源核對。未執行ZIP版本的瀏覽器／真服務，未驗遠端部署；此報告不重做H0或整案安全審查。

## 路由與選單

| 項目 | 最新ZIP | M1候選 | 判定 |
|---|---|---|---|
| 明示path＋對應element | 29 | 29 | 逐條正規化相同；不是只比數量 |
| 登入保護路由 | 23 | 23 | 保留 |
| 公開首頁／登入 | 2 | 2 | 保留；固定測試密碼快捷登入未沿用 |
| 側邊選單定義 | 6群／22項 | 6群／22項 | 定義項目保留，真角色／選定單位會影響可見性 |
| comingSoon | 8 | 7 | 差額為Product CFP；ZIP明示未提供，M1可點但仍NotFound，並非少了一個可用CFP功能 |
| Product CFP／AI Governance | 原本NotFound | 同樣NotFound | 檔案存在不代表已接入可用路由 |
| Documents側欄落點 | upload | list | 兩頁均存在；導覽落點不同，不是刪上傳頁 |

ZIP router/config.tsx:57–174與M1同檔:55–168可核對。AdminLayout的角色不再固定Owner，改按目前組織會員判斷；未選單位或角色未確認時選單可能較少，不能以此判定頁面刪除。這也不能取代後端／RLS／Storage隔離驗收。

## 確認缺少／縮減的介面與真導航

表內行號皆為固定ZIP來源；M1不存在對應元件或呼叫，對照清單已保存。

| 項目 | ZIP來源證據 | M1狀態與建議 |
|---|---|---|
| 五階段流程導航：文件→草稿→活動→分析→報告 | `src/components/feature/ValueChainProgress.tsx:23–56`；上傳496、草稿272、活動201、分析560、報告中心183／歷史498／預覽353 | **尚未接入，屬真UI／導航缺少**。恢復org/project scope，不以目前頁面位置自動宣稱前階段已完成 |
| 活動→分析／報告中心 | `activities/EmissionActivitiesListPage.tsx:257、264` | **頁內通用捷徑缺少**。M1新增保存特定報告入口，但不能代替一般「前往分析／報告中心」 |
| 草稿確認→分析 | `documents/ExtractedDraftReviewPage.tsx:296` | **分析捷徑缺少**；活動列表入口仍保留 |
| 分析→報告 | `analytics/EmissionsAnalyticsPage.tsx:13、693–717` | **頁內報告捷徑缺少**；報告頁本身仍存在 |
| 報告中心→碳調整 | `reports/ReportCenterPage.tsx:252` | **捷徑缺少**。原按鈕放在Mock摘要中，導航可獨立恢復，不必恢復假排放數字 |
| 報告十章結構／資料缺件／欄位來源提示 | `reports/components/ReportOutlinePanel.tsx:38–160、212`；中心305、預覽551 | **資訊UI尚未接入**。恢復有用的十章導引，接實際保存欄位；原視覺完成度不得當成合規或商用驗收比例 |
| 封測回饋入口 | `components/feature/BetaFeedbackButton.tsx:25–40`；掛載八頁 | **入口缺少，但原收件未實作**。原程式console後顯示「已送出」，不能原樣恢復；可保留編寫／本機複製或保存，明示尚未送達任何人 |

原ReportOutline的hasFactors等布林、placeholder欄位與章節數映射也不能直接當可靠資料完整性檢查。導入時應保留缺件提示而驗證保存資料，不以虛構章節內容補齊。

## 不應誤判為已可用功能被刪除

| 差異 | ZIP實際來源 | 判定 |
|---|---|---|
| 分析圖表改成真資料表格／比例條 | analytics:37–68／523–546存在MOCK分布／趨勢回退；668–687熱點明示示範 | GHG／ISO分布能力仍在。外觀與圖表種類減少須列明；趨勢／熱點真服務仍未完成，不能恢復假值掩蓋失敗 |
| department／hotspot維度 | analytics:72、620–665為ComingSoon | 原本不是已可操作的真分析維度 |
| 上傳後自動OCR／分類與草稿完成通知 | DocumentUploadPage原流程與provider仍Mock；974草稿CTA依賴該完成狀態 | M1只保存原件與收件，不再假報OCR成功。可另保留「開啟待審清單」，明示上傳不代表已有草稿；非Mock人工轉錄契約WAITING_CTO |
| 組織／專案額外編輯欄位 | EditOrganizationPage:36–44／85–91；EditProjectPage:41–59／109–117讀寫仍TODO／延遲後假保存 | UI欄位確有差異，但不能稱真保存功能已完成。M1真schema保存與禁止跨租戶移轉屬補強；額外聯絡／baseline／target等商業欄位須另確立契約 |
| 人工驗證／編輯／重算活動明細 | 原detail固定Mock或alert，部分編輯路由未定義 | 現明示尚未提供；M1另在原活動列表提供真計算保存。未宣稱已有真人工驗證 |
| 登入快捷帳號／固定Owner | ZIP有內嵌固定測試憑證及固定角色 | 安全修正不應回退；合成預覽另有專用假帳號，未建立雲端帳號 |
| AuthContext.tsx不存在 | 現AuthContext.ts＋AuthProvider＋持久登出／競態處理 | 重構與修復，不是刪除登入 |
| 匯出 | ZIP和目前M1的ReportPreview handleExport仍TODO／console；目前對話另有未合併PR #9／#10候選 | **目前M1匯出仍未整合，不能冒稱已有HTML／JSON／PDF／Word交付**。其他分支成果須核對後接入，不與本分支混算 |

專案概覽、文件清單／篩選／私有原檔、草稿審核／駁回、活動來源鏈、組織／專案入口仍在；M1新增人工活動→真計算→保存／重讀快照，合成案例100kWh→50kg→0.05t。這不補回上述遺漏UI，也不表示所有商業功能完成。

## 復原順序與待裁定

1. **READY**：先接回帶scope的流程導覽及四處頁內下一步CTA；保留現有安全／真實資料服務。
2. **READY**：接回十章報告結構與缺件提示，展示實際保存期間、邊界、係數／來源，無資料明示未知，不復原假完成度。
3. **READY（本機能力）／WAITING_CTO（實際收件管道）**：回饋入口可恢復本機編寫／複製；若要「送出」，先指定可用接收服務、權限與資料責任，不先顯示已送達。
4. **WAITING_CTO**：額外業務欄位、廣義Scope規則與非Mock文件人工轉錄契約，見CTO_M4_MANUAL_TRANSCRIPTION_CONTRACT_20261106.md。
5. **WAITING_OWNER**：真環境、帳號、schema／migration／資料、費用及發布。此報告沒有授權或執行這些操作。

**本次是檢查與復原清單，不冒稱遺漏已修復。** 最新ZIP不應整包覆蓋目前成果；先保留來源與差異，再逐項接回。發布仍HOLD。
