# PC Agent execution plan — public edition
日期：2026-10-31。本計畫不擴張 H0 授權。H0 僅唯讀稽核與文件 PR；後續修復、schema 或部署須依 owner 授權，不從舊文件中的操作指令推論許可。

## Intake
Clone 既有 juliushsu/CoCalLab，讀 handover branch/PR，核對 base main `0a90b7b9b499ae382c17293b7dd674b09b0ef020` 與 PR head，確認只改 docs/handover。先讀七份文件與 evidence index，再由 owner 私下交接完整本機／即時環境／安全 packet。不要將 secret 或非公開環境資料貼進 public PR。

## Execution order
| Phase | Work / dependency | Exit evidence |
| --- | --- | --- |
| H0 intake | PC fresh clone、npm ci、test/type/build/lint；受限 source/export 比對 | PC runtime log、owner canonical-source 決策、保留既有工作 |
| Owner scope | 確認 19+1 定義、採購閉環／報告範圍、deadline、驗收人、Drive/root/resource owners | 需求與責任簽認；名冊／合約只留受限位置 |
| Security gate | 接收受限 findings，提出 credential/access/RLS/RPC/tenant test 計畫 | owner 安全處置與 least-privilege 驗收；H0 不改雲端 |
| Local baseline | 建立 local runtime、修 lint、CI 與必要掃描 | 可重現且不削弱 gates |
| Contract fixes | analytics/adjustment method/DTO/unit、snapshot adapter、明確 empty/error | shared contracts/adapters、A08/A14/A16 |
| Schema/persistence | 本機驗 migration 全鏈與受限環境差異、report atomic snapshot | upgrade/recovery/idempotency/race evidence |
| Existing workflow | org/project edits、activity detail、private preview、review/confirm | 真實 persistence 與 deny tests，保留 working pure functions |
| Real AI | owner 選 provider/data policy/budget，接 OCR/LLM、timeout/quota、review evidence | real integration tests、無 silent mock |
| Procurement | 合作公司先簽最小需求，再建 supplier/requirement/quotes/comparison/approval/record | schema/API/role/UI/acceptance 同一閉環 |
| Reports | 真實 summary/versions/必要章節/export，去掉假完成章節數 | 可開交付檔、immutable version |
| Commercial pilot | 代表企業試辦，再按核准名冊逐家 | 各家 UAT、顧問進度與簽認 |
| Operations/release | restore、monitoring、support、cost、artifact/SHA/rollback | 全 gates + owner 明確批准，之後才正式部署 |

角色責任尚待 owner 指派，沒有虛構工期。source sync、security、contracts、schema、AI、procurement、report delivery 分成小 PR，各列行為、驗證、限制與回復方式。不在文件 PR 混入程式修復。

## Completion gates
PC_AGENT_READY 目前只可解讀為「有文件可接手開發」，不是 PC 已測或商用已驗收。逐項更新 HANDOVER_SOURCE_STATUS、GITHUB_PARITY、FUNCTION_REALITY_STATUS、DATABASE_STATUS、DEPLOYMENT_STATUS、COMMERCIAL_MVP_GAPS、SECURITY_FINDINGS、PC_AGENT_READY、BLOCKERS、NEXT_ACTION。環境與安全細節保留受限紀錄，公開只列 source／流程資訊。

NO MOCK AS DONE。NO UNVERIFIED PRODUCTION CLAIMS。NO SECRET EXPOSURE。NO DESTRUCTIVE MIGRATION。NO PRODUCTION DEPLOYMENT WITHOUT OWNER APPROVAL。保留既有資料、working functionality 與歷史 snapshot。
