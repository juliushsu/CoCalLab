# 19+1 Commercial MVP
日期：2026-10-31。這是根據 CTO directive 與現有程式提出的 **待 owner／合作公司確認的交付範圍**，不是已簽合約或既定驗收標準。

## 目標與客群
協助合作公司服務 19+1 輔導案企業，交付能留存證據、支援人工審查的 ESG／AI 輔助採購工作流。先由 owner 確認「19 家企業 + 1 家合作／輔導單位」是否為正確模型；不可將其假設成已知名冊、20 個同等租戶或既定資料存取權。

目前產品主要是碳盤查文件→草稿→活動→計算→JSON 報告；supplier 字串、採購鋼鐵圖表、產品 CFP mock 不構成完整採購軟體。不得把首頁承諾或 demo 當交付。

## 最小可用工作流提案
| 步驟 | 必交付結果 | 現況／gap | 驗收 |
| --- | --- | --- | --- |
| 企業導入 | 獨立 workspace、受邀成員、顧問授權範圍、project reporting period | org/member 有基礎；無 19+1 cohort／授權驗收 | A06/A07/A22 |
| 採購資料輸入 | supplier、需求／品項、單位／數量／金額、來源附件與 hash | 只有 generic document/vendor；採購 domain 未建 | A23 |
| AI 擷取與建議 | 真實 provider、欄位來源、confidence、失敗可人工修正 | OCR／LLM mock-only | A12/A24 |
| 證據審核 | 人工接受／排除、修改理由、角色限制、追溯原檔 | 草稿與 confirm 有基礎；並行與重試未驗證 | A10/A11 |
| ESG 輔助比對 | 可解釋因子與 supplier evidence，比對可得數據，缺證據顯示未知 | 真實 factor sourcing／supplier evidence 未建 | A13/A23 |
| 採購決策 | 至少可審閱方案、記錄比較與人工決策、核准與留痕 | RFQ／比價／審批／PO 全部未建 | A23/A24 |
| 企業交付 | 真實數據摘要、清楚單位、version snapshot、可讀匯出 | DTO 混 mock、PDF exporter 未建 | A14–A17 |
| 顧問交付 | 個別企業進度、待辦／缺口、輔導紀錄與驗收簽認 | 無 cohort dashboard／acceptance domain | A22 |
| 營運 | 資源 owner、支援窗口、backup restore、incident runbook、權限撤回 | 無正式環境與營運驗收證據 | A25/A26 |

## 建議範圍優先序
P0：安全與來源版本確認；禁止 mock 混入正式資料；完成 tenancy/role deny cases、schema/API 對齊與文件→人工確認→計算→真實報告摘要的可靠閉環。

P1：由合作公司確認採購最小交易模型，再實作 supplier/requirement/quote-comparison/decision/audit；接 real AI 與成本／資料處理界線；完成所需匯出及顧問進度驗收。

P2：進階 RFQ／PO／ERP 整合、更多因子源、自訂 templates、SSO／billing、完整產品 CFP。若合約明定則提升為 P1；不得擅自移出必要採購交付。

可先把可靠碳盤查作為分期 milestone，但它不等於滿足本 directive 的採購商業目標。若 owner 同意縮小付費範圍，需書面改版需求與驗收，不得以「MVP」自行省略採購。

## 可交付與不得宣稱
可描述既有 source、mock demo、純函式測試與待驗證雲端資源。不可宣稱真實 AI 準確率、節省時間、已有客戶數、ISO/ESG/IFRS 符合性、正式扣抵、SSO/SLA 或 19+1 商用就緒，除非有對應驗收證據。AI 提供建議；人工簽認須保留，不能用未審模型輸出改寫正式碳排或採購核准。

## Release gates
| Gate | 放行證據 | 目前 |
| --- | --- | --- |
| G0 需求與責任 | 合作公司範圍、19+1 定義、名冊、交付日、sign-off 人與資料處理界線 | 未取得 |
| G1 安全 | credential 管理、grant/RLS/RPC 安全設計與 deny tests，取得 owner 安全簽認 | 未通過 |
| G2 來源與環境 | GitHub source 整併決策、Readdy export 對應、PC 可重現、隔離 staging | 未通過 |
| G3 真實功能 | 不含 mock fallback 的核心與採購閉環，provider error／timeout／quota 可控 | 未通過 |
| G4 正確性 | schema/DTO/unit、idempotency/concurrency、snapshot/backup、隔離驗收全通過 | 未通過 |
| G5 商業驗收 | 代表企業試用後逐家 acceptance，顧問對交付結果簽認 | 未執行 |
| G6 部署 | immutable artifact、rollback、監控與 owner 明確核准 | 未核准；H0 禁止部署 |

## Owner 待定事項
19+1 的角色／企業數量、實際採購流程及必要整合、可接受資料格式與量級、因子與報告責任、AI provider/預算/敏感資料政策、正式品牌／網域、時程與驗收人。機密需求與企業名冊保存受限 Drive；本公開文件只保留無敏感資訊的範圍與 gate。
