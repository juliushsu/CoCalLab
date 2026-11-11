# CoCalLab 產業核算與交易碳排資料：結論與決策紀錄

日期：2026-11-11（Asia/Taipei）
狀態：方向收斂／工程計畫待按階段執行；本次交付只含文件。RELEASE HOLD。
文件 ID：CCL-CARBON-SERVICE-20261111-V1

## 1. 商業目標與範圍

讓企業從交通、住宿、物流與餐飲等日常交易取得有來源、可追溯、可審核的碳排資料，接入報帳與組織盤查；再讓服務提供者利用自己的營運資料開立交易碳排明細。
客戶產業選擇載入設定與流程，同一 workspace 可啟用多個產業設定。
物業／旅宿是未來開立端第一個示範；接收端先服務現有盤查企業，不等待飯店或交通平台合作。

本計畫整合 Owner 提出的產品構想、Owner 轉貼的 Claude 意見及本輪 GPT 核對結果。這是產品方向收斂，不代表 Claude 已對最終文件簽認，亦不代表工程、方法學或客戶驗收已完成。

## 2. 結論

| 議題 | 收斂決策 | 工程意義 |
| --- | --- | --- |
| 六個產業模組或一個引擎 | 共用核算核心＋可版本化的產業方法設定；不建六套重複系統 | 共用資料來源、版本、審核、單位、結果與匯出；方法設定包含輸入、功能單位、邊界、計算步驟、分攤及品質要求 |
| 是否只有分攤 | 支援活動量乘係數、直接歸屬、共用排放分攤、接收供應商排放結果 | 不將所有產業強制套成「總量除以交易數」；一次直接歸屬後不得再分攤同一排放 |
| 開發先後 | 接收端先行，物業／旅宿開立端次之，跨租戶交換另階段 | 手動輸入與附件先形成可用流程；OCR 非前置依賴 |
| 供應商提供 kgCO2e | 獨立供應商排放聲明；不是一般活動量，也不自動成為直接監測資料 | 不重乘係數、不以虛構 factor=1 接入、不自動提升一次資料或查證狀態 |
| 物業地位 | 場所、計量點、帳單與分攤是可共用基礎 | 車輛、行程、貨件等可獨立存在；不要求所有交易先有建物 |
| 跨組織資料 | 先在接收者租戶內保存外部文件與採用決定，後建平台交換 | 外部供應商無須平台帳號；供應商 ID 不授予跨租戶存取權 |
| 產業優先序 | 企業接收 → 物業／旅宿 → 受控交換 → 交通／物流 → 製造／餐飲 | 每階段以已驗收能力進入下一階段；餐飲完整足跡須另具食材與方法資料 |
| 可移植性 | 程式碼模組與 adapter，不建必要中央 API | 首個案例做出可測介面，第二產品接用時再抽版本化 package |
| 責任與揭露 | 原始聲明、系統轉換、接收者採用分開留痕 | 不以 QR／hash 等同真實性查證；不宣稱任何指定大廠必然接受 |

## 3. 固定來源與權限

文件分支由 main 的 94d01b9c9f081df494f805b41166599ccd73541e 建立。
本輪 GitHub 可見工程參考分支為 codex/uat-watchdog-runtime-20261109，固定 e4562ed8cb404df6db97a870922ce561b6d4025f（PR #38）。
該分支 NEXT_ACTION 記載產品候選 fd7efcfc6450dbf10f54aa97b65fe48e431b277d；本輪沒有重新跑其測試或核准替換 UAT 基線。

已讀來源：
- [協作規則](https://github.com/juliushsu/CoCalLab/blob/94d01b9c9f081df494f805b41166599ccd73541e/AI_COLLABORATION.md)
- [workspace／法人／場所／盤查邊界](https://github.com/juliushsu/CoCalLab/blob/94d01b9c9f081df494f805b41166599ccd73541e/docs/architecture/BOUNDARY_CANONICAL_MODEL_V1.md)
- [活動量／直接排放／組織係數治理提案](https://github.com/juliushsu/CoCalLab/blob/94d01b9c9f081df494f805b41166599ccd73541e/docs/org-owned-monitoring-custom-factor-proposal.md)
- [候選分支開發規則](https://github.com/juliushsu/CoCalLab/blob/e4562ed8cb404df6db97a870922ce561b6d4025f/AGENTS.md)
- [可移植模組規範](https://github.com/juliushsu/CoCalLab/blob/e4562ed8cb404df6db97a870922ce561b6d4025f/docs/development/PORTABLE_MODULES.md)
- [候選接續紀錄](https://github.com/juliushsu/CoCalLab/blob/e4562ed8cb404df6db97a870922ce561b6d4025f/docs/delivery/NEXT_ACTION.md)

main 不是最新產品整合候選。上述遠端紀錄也不證明涵蓋 PC 尚未推送的 11 月 11 日本機進度；執行前由 PC Codex 核對目前 HEAD、未提交差異、現行授權與 UAT 任務。
不得以此文件覆蓋 T2／歷史收件還原契約或既有 UAT 操作決策。

| 行動 | 本輪範圍 |
| --- | --- |
| 彙整結論、工程計畫、GitHub 文件分支與 PR | Owner 本輪明確要求；可執行 |
| 讀取來源／規劃方法／列驗收案例 | 可執行；不等於方法符合性認證 |
| 後續可逆本機實作與合成隔離測試 | 依執行 checkout 的既有開發授權與本計畫分階段接續，不需重問同一既有授權 |
| main 合併、雲端 schema／權限、付費資源、外部資料外送、正式部署 | 本文件不新增授權；沿用各項現行具體授權，缺少時僅停止受影響項目 |
| Release | HOLD；此文件不解除原有 gate |

## 4. 閱讀與接續入口

1. [接收端 V1 設計](SUPPLIER_EMISSION_INTAKE_V1.md)
2. [工程計畫、責任與驗收](ENGINEERING_PLAN.md)

下一步由 PC Codex 完成 E0 現況映射，PC Claude 做有範圍的語意／重複計入／租戶審查；保留既有 UAT 優先工作，不為新方向重新開啟已結案審查。
本文件不表示任何遠端 agent 已啟動，也不建立背景排程。

下一條唯讀定位命令（在實際工程 checkout 執行）：

~~~bash
rg -n 'calculate_emission_activity|build_report_payload|direct_emissions_data|factor_snapshot|replacement_provenance' backend/src backend/supabase frontend/readdy-app/src
~~~

## 5. 方法參考與適用限制

以下是設計依據，不代表 CoCalLab 已實作／取得第三方查證；方法版本須在對應產業實作時固定。
- [GHG Protocol Scope 3 計算指引](https://ghgprotocol.org/sites/default/files/standards/Scope3_Calculation_Guidance_0.pdf)：Category 6 出差交通；住宿為可選納入項。接收者需依自身政策決定分類與邊界。
- [HCMI](https://sustainablehospitalityalliance.org/resource/hotel-carbon-measurement-initiative/)：旅宿房晚與會議空間足跡；不得直接宣稱等於每位旅客當日實測。
- [GLEC v3 參考文件](https://www.smartfreightcentre.org/documents/328/GLEC_FRAMEWORK_v3_UPDATED_02_04_24.pdf)：物流噸公里及資料／方法揭露；材積不足以單獨決定排放。此為本輪已查閱版本，不宣稱最新。
- [GHG Protocol Product Standard](https://ghgprotocol.org/product-standard)：產品生命週期與邊界；餐點不能僅以店內用電代表完整足跡。
- [台灣高鐵站間碳足跡](https://www.thsrc.com.tw/ArticleContent/5a1f4c72-b564-4706-bcdd-efbda93c3d93)：示範供應商資料來源；不假設所有票券已含交易總量，也不在此固定實際排放係數。
