# Acceptance test matrix — public source/local results
日期：2026-10-31；baseline main `0a90b7b9b499ae382c17293b7dd674b09b0ef020`。完整即時環境與安全測試紀錄留受限 owner packet；本文件只列公開 source 及本機測試。

## Actual local checks
| Check | Result | Scope |
| --- | --- | --- |
| Git baseline tree/commit parity | PASS | public baseline tracked source；本機未合併內容另核 |
| Backend npm test | PASS 13/13 | pure JS/mock assertions |
| Node experimental coverage | lines 82.45%、branches 47.18%、functions 79.31% | 只計被載入的 JS；不包含 Deno、SQL、UI |
| Frontend type-check | PASS | 不驗 runtime contract |
| Frontend build | PASS（Vite 7.3.3） | 無 cloud env、未部署、非 fresh install |
| Frontend lint | FAIL：0 errors、15 warnings | max-warnings=0 |
| Temporary Readdy homepage | 可唯讀載入 | owner 提供 URL；無登入、無 build SHA parity |

執行環境 Node 25.8.1/npm 11.11.0。最初 dependency symlink 指向唯讀目錄令 build EPERM；複製依賴至隔離副本後原 build script 成功。configLoader runner 試驗失敗不是最終配置；沒有修改程式。PC npm ci／runtime 尚未驗證。

## Existing tests
| Tests | Verified | Missing scope |
| --- | --- | --- |
| normalize/classify | OCR payload normalization、rule electricity classification | real OCR/LLM、全文件型別 |
| resolver/calculate/recalculate | selected factor、missing factor、included/excluded counters | 完整時效／單位／租戶矩陣、DB transaction |
| report payload | required fields、boundary/entity/site snapshot shape | SQL、PDF、immutable export |
| rule audit/subscription | structured multilingual output、grace-period readonly | real model、HTTP authorization |
| mock OCR/LLM adapters | stable provider/model/result shapes | real providers |
| request contracts | provider-driven payload、claim_purpose、Report Center request | full browser→Edge→DB flow |

共 13 tests。confirm-draft.js function coverage 0%（line 6.82%）；不能因被 import 宣稱已測。沒有 Edge handlers、RLS、SQL RPC、storage、race、browser interaction、PDF 或 production 自動化覆蓋證據。

## Acceptance backlog — not executed in H0
所有 mutation test 僅可在本機或明確授權的隔離 staging 執行。每項 PASS 需 SHA、環境、fixture version、測試者、時間與 evidence artifact。

| ID | Scenario | Required result | H0 local/source status |
| --- | --- | --- | --- |
| A01 | PC fresh clone/npm ci/test/type/build/lint | 可重現 baseline，無未記錄差異 | NOT_RUN |
| A02 | source/export intake | owner 決 canonical，保留原檔 | 受限 intake |
| A03 | owner security gate | credential、access、資料政策簽認 | 受限紀錄 |
| A04 | table/RPC least privilege + tenant deny | 未授權操作拒絕 | NOT_RUN |
| A05 | local migrations/upgrade/recovery | 相容、無 fixture 污染、可恢復 | NOT_RUN |
| A06 | owner/admin/editor/viewer + cross tenant | 最小權限及 last-owner 保護 | NOT_RUN |
| A07 | organization/project create/edit/reload | 真實持久化、錯誤不假成功 | source edit stubs |
| A08 | browser CORS/JWT matrix | allowlist success、invalid auth deny | NOT_RUN |
| A09 | file format/size/hash/private preview/delete failure | tenant isolation、可恢復 | NOT_RUN |
| A10 | accept/exclude/duplicate/concurrent confirmation | 正式 activity 唯一、審核人留痕 | NOT_RUN |
| A11 | RPC failure/retry/race | 無 partial state、idempotency | NOT_RUN |
| A12 | real OCR + timeout/quota | 可驗輸出、未知保留、無 silent mock | mock-only source |
| A13 | factor/date/unit/double count | 正確因子、kg/tCO2e、trace | 少數 pure JS PASS |
| A14 | analytics/adjustment contract | method/keys/types/units 相符 | source mismatch |
| A15 | report transaction/version/hash | 完整一致 snapshots | NOT_RUN |
| A16 | report/history/summary totals | 逐值一致，無 mock 混值 | source DTO mismatch |
| A17 | report export/version | 完整可開檔、immutable version | source 未建 |
| A18 | adjustment approve/lock/consume | 合格量、不重複使用 | NOT_RUN |
| A19 | subscription rules/error/role | server policy 與 UI 明確一致 | NOT_RUN |
| A20 | AI audit/explanation/regeneration | 真 provider／證據／人工審核 | mock/missing source |
| A21 | zh/en/ja/keyboard/mobile | 無 raw keys、critical flow 可操作 | NOT_RUN |
| A22 | 19+1 advisor onboarding/UAT | 每家隔離、進度、撤權與簽認 | 需求待確認 |
| A23 | procurement end-to-end | supplier→requirement→comparison→approval→record | source 未建 |
| A24 | AI uncertainty/conflict/prompt injection | 不越權，保留人工決策 | NOT_RUN |
| A25 | backup restore/load/cost/incident drill | 約定 RPO/RTO、監控與預算 | NOT_RUN |
| A26 | release manifest + owner approval | 核准前不 deploy | NOT_RUN |
