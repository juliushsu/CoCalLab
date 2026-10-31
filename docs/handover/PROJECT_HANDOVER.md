# CoCalLab — PC Agent handover（public source edition）
日期：2026-10-31（Asia/Taipei）。本次範圍為 H0 唯讀稽核與文件 PR；沒有正式部署、雲端資料／權限變更或 migration/seed 執行。

## 交付分層
本公開 PR 只保留既有公開 Git source、純本機測試結果與接續工作指引。完整七份稽核文件、完整來源清單、即時資源／資料庫對照與安全結果保存在 owner 的受限本機交接包，不發布到公開 GitHub。機密資料與 credential 不應複製進本 repository。

## GitHub baseline
- Repository：[juliushsu/CoCalLab](https://github.com/juliushsu/CoCalLab)，public。
- Base branch：main。
- Base HEAD：`0a90b7b9b499ae382c17293b7dd674b09b0ef020`。
- Public baseline：267 tracked files、26 commits。
- Handover branch：`codex/handover-pc-agent-20261031`；只新增 docs/handover，不修改 main。
- 原有本機 tracked tree 與此 GitHub baseline 相符；本機另有未合併來源，具體 manifest 留 owner packet，原檔保留。
- 本次執行環境為 Mac；PC clone/runtime 尚未實測。PR head SHA 以 GitHub PR 為準。

Owner 已確認沒有正式網址，現以 Readdy 沙盒及 [臨時入口](https://afyfvg.readdy.co) 對外。該首頁本次可在瀏覽器唯讀載入；此證據不代表 hosted build 與 source SHA 相同，也不是商用驗收。

## Source-level conclusion
現有公開 source 的主要工作流為碳盤查 documents→drafts→activities→calculations→report payload，含真實純函式、部分資料存取、mock provider、UI stubs 與契約差異。尚不能將其認定為完整 ESG／AI 輔助採購商用軟體。逐功能判定限於公開 source，雲端與安全判定另見受限 packet。

## 文件入口
- [FUNCTION_REALITY_AUDIT.md](FUNCTION_REALITY_AUDIT.md)：公開 source 逐功能判定。
- [DATABASE_AND_API_MAP.md](DATABASE_AND_API_MAP.md)：公開 migration／handler／service 架構。
- [COMMERCIAL_MVP.md](COMMERCIAL_MVP.md)：依 CTO directive 提出的待確認交付範圍。
- [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md)：本機接手與未來受核准 release 程序。
- [ACCEPTANCE_TEST_MATRIX.md](ACCEPTANCE_TEST_MATRIX.md)：本機結果與待執行驗收。
- [PC_AGENT_EXECUTION_PLAN.md](PC_AGENT_EXECUTION_PLAN.md)：PC 工作順序與 gate。
- [EVIDENCE_INVENTORY.md](EVIDENCE_INVENTORY.md)：公開來源與受限 packet 邊界。

## Google Drive proposed structure
正式專案資料與權限確認由 owner 的受限盤點紀錄交接。本次只提出結構，未建立或改分享權限：
```text
CoCalLab/
  00_Project_Handover/
  01_Product_Requirements/
  02_Architecture/
  03_19plus1_Commercial/
  04_Test_and_Acceptance/
  05_Deployment/
  06_Operations/
```
Credential 用 secret manager；受限 Drive 存取流程與文件，不將 credential、企業名冊、合約或實際附件放公開 repo。

## Completion fields（public scope）
| Field | Status |
| --- | --- |
| HANDOVER_SOURCE_STATUS | 公開 baseline 已定位；完整本機 manifest 由 owner 私下交接 |
| GITHUB_PARITY | baseline tracked tree 相符；不能外推所有本機來源已合併 |
| FUNCTION_REALITY_STATUS | source 混合 REAL／PARTIAL／MOCK／BROKEN／NOT_BUILT |
| DATABASE_STATUS | source map 已提供；即時 schema／migration／權限對照保留受限 packet |
| DEPLOYMENT_STATUS | owner 確認 Readdy temporary entry；未宣稱 production-ready |
| COMMERCIAL_MVP_GAPS | real AI、採購閉環、可交付匯出、完整隔離與營運驗收 |
| SECURITY_FINDINGS | 詳 owner 受限紀錄；不在 public PR 發布結果或值 |
| PC_AGENT_READY | 有條件可接手開發；PC runtime／商用 release 尚未驗收 |
| BLOCKERS | source 契約／stubs、real provider、採購需求與驗收；受限環境 gate 另核 |
| NEXT_ACTION | PC 重現本機檢查、接收 owner packet、提出分階段修復 PR；未批准不部署 |
