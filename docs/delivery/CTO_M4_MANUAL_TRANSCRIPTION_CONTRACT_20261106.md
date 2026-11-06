# M4 文件人工轉錄最小契約提案

狀態：**WAITING_CTO**。2026-11-06；RELEASE HOLD。這是待裁定提案，未實作、未套用 migration、未部署，亦未透過任何通知管道送達 CTO。
依據：[固定 CTO 隊列 M4](CTO_COMMERCIAL_EXECUTION_20261106.md#連續工作順序)；任務提供的指令版本為 `43cbb102`。既定 UAT 基準仍是 `7dccd5452152f2495d10ad1437d5d03215166065`；本機 M1 候選及合成證據不替代 UAT。

## 建議方案 A：既有文件、草稿、活動三表，明示人工且不分攤

從既有文件清單選取可讀、active、同 organization/project 的真實收件，查看私有原件後建立人工草稿，再走現有審核、活動、計算與保存報告鏈。不新增資料模型、OCR、AI、正式係數或跨期間分攤。
`extraction_provider='MANUAL_TRANSCRIPTION_NO_OCR'`；UI 必須顯示「人工轉錄，未執行 OCR／AI 分類」。`uploaded_documents.ocr_status` 保持 `pending`，不藉人工轉錄改成 OCR 成功。
人工轉錄只證明有人抄錄並留下責任來源，不證明原件真實、hash 經伺服器驗證或內容經外部稽核。

| 契約 | 沿用欄位及最小規則 |
|---|---|
| 來源文件 | `draft.uploaded_document_id`；伺服器依原件回填 org/project，不接受 client 偽造 scope。`raw_payload.source_locator` 記頁碼／欄位定位；原檔與收件身分不覆寫。 |
| 轉錄者 | `raw_payload.manual_transcription.{user_id,transcribed_at,request_id}` 由伺服器 JWT actor／時間寫入，並記既有 audit log；不把 client 自填 metadata 當身分證據。 |
| 原始值與解析 | `raw_payload.manual_transcription` 保留所見數字／單位／日期文字；`normalized_payload` 存明確 `quantity/unit/activity_date`、類別、activity_type、Scope 與納入選擇。`parsed_quantity/parsed_unit` 為對應摘要，不取代 canonical payload。 |
| 數量與單位 | 明填有限非負數，真零可用；空白不得套 `0`、單位不得套 `kg`。以既有 `normalizeUnit` 顯示原值及正規化結果；無法解析需修正，不能假稱可計算。 |
| 期間 | `raw_payload.manual_transcription.period_start/period_end` 保存文件期間；`activity_date` 由人明選且在 project 起迄內。缺期間明示未知；來源跨 project 期間時拒絕本期建檔，先走人工釐清，不自行切分／平均。 |
| 類別與 Scope | `suggested_category/suggested_scope` 只作提示；確認時明選 `final_scope` 與 `inclusion_status`。included 必須有 Scope 1/2/3；excluded 必填原因；pending 不宣稱盤查完成。 |
| 係數選擇與解析 | 沿用 resolver 的 org／全域可見、active、有效日期、activity_type、正規化 unit 篩選及既有排序；展示候選、實際選用來源／版本／單位。不是新增可持久釘選的 factor picker。 |
| 係數不足或不明 | 無候選維持 `pending_factor`、總量 NULL；同順位歧義須明示待確認，不能任選並假成功。人工需核對選用依據；若業務要求指定 factor_id，另提契約，不偷偷塞進活動不存在的欄位。 |
| 確認與責任 | 活躍 owner/admin/editor 且訂閱可寫者可轉錄／確認；保留轉錄 actor，審核 actor 寫既有 `reviewed_by_user_id/reviewed_at/review_note`。建議首版允許同人但明示，不能宣稱已有雙人覆核；業務正確性由確認人承擔。 |
| 保存來源鏈 | 確認產生 `activity.source_document_id/source_draft_id`；計算保留 `factor_id/factor_snapshot/input_snapshot`；報告 `appendix_mappings` 串回文件、草稿、活動及計算。 |

## 可審閱的最小 endpoint／RPC 設計（尚未實作）

1. 新增單一 `POST manual-transcription` handler；輸入 `organization_id/project_id/document_id/draft_id/request_id` 及明確人工欄位，禁止 client 指定 provider、轉錄者、審核者或成功狀態。
2. 沿用 request auth、角色／訂閱檢查；在交易內重查同 org/project active 收件、文件與 project 綁定。私有預覽失敗時 UI 阻止轉錄送件；服務端收件檢查不等於原件內容驗真。
3. 新增 **service_role-only** 小型 `create_manual_transcription_atomic` RPC，僅寫現有 `extracted_document_drafts` 及 `audit_logs`：`pending_review/unclassified`、無 AI confidence、provider 固定 MANUAL。固定 search_path、最小 ACL，app 不得直接呼叫；這是來源提案，不是雲端 schema 授權。
4. 用既有 `(uploaded_document_id, extraction_version)` 與 latest 唯一索引，鎖同文件並檢查待審狀態。首版每文件一份最新人工草稿；有 latest 時回既存或明確衝突，不暗中替換 OCR／已確認草稿。
5. `draft_id` 是固定重送識別；同 actor／文件／完全相同 canonical input 才回原草稿，不同內容回 409。request_id 留稽核，不把單純存在 audit metadata 當去重保證。任何未確認保存先讀回，不自動改新 ID 重送。
6. 後段沿用 `confirm-draft` handler／atomic RPC，但必須先補明確輸入檢查、pending 狀態鎖與重送去重，避免既有 helper 的缺值回退及重複 activity。確認前再次核對 org/project、MANUAL provider、來源、角色與 canonical input。
7. 計算走現有 resolver 與 recalculation；無可計算結果不能產成功報告。loading／空資料／失敗／保存未確認／可重讀各自可辨識，撤權或切換 scope 後舊結果不得套回。

## 現有來源證據（2026-11-06 唯讀工作樹）

| 來源 | 實際證明與限制 |
|---|---|
| `backend/supabase/migrations/202603160001_v1_core_schema.sql:131,163,205,331` | 文件 metadata／OCR 狀態；草稿 provider、raw/normalized payload、人工解析與審核欄位；活動雙來源 FK；計算 factor_id。草稿沒有獨立 transcribed_by 欄位，故建議 server JSON＋audit 沿用。 |
| `backend/src/services/confirm-draft.js:3` | 既有映射會產雙來源鏈，但 quantity 缺值可回退 0、unit 可回退 kg；本提案要求在入口與交易邊界拒缺值，不能把目前行為當已符合契約。 |
| `backend/supabase/functions/confirm-draft/index.ts:34` | 既有 auth、角色、訂閱、scoped draft 讀取與原子確認呼叫；actor 來自登入，非 client reviewer。它不是目前可用的非 Mock 文件轉錄入口。 |
| `backend/supabase/migrations/202603160011_v1_p0_confirm_atomic_fix.sql:3,33,61` | RPC 更新審核 actor／時間並建 activity；現有更新未要求 pending，request_id 只記錄，不能直接宣稱重試冪等。 |
| `backend/src/services/resolve-emission-factor.js:51` | 真正候選篩選、排序、factor snapshot；當前同分直接取第一筆，本提案的歧義提示仍待實作。 |
| `backend/src/services/calculate-emission-activity.js:48` | 不支援單位為 error、缺係數為 pending_factor 且 co2e_kg NULL；成功保存 factor/input snapshot。 |
| `backend/src/services/build-report-payload.js:54,209` | 係數來源快照與 appendix 來源鏈；不等於已驗證附件內容可信度。 |
| `frontend/readdy-app/src/services/draftReview.ts:25` | 已知 Mock/fixture/synthetic provider 的辨識；MANUAL provider 仍須加入明示文案及確認測試，不能靠未被 regex 擋住就冒稱流程完成。 |

## 替代方案、風險與回復

- **B：維持目前獨立人工活動建檔。** 無新增來源鏈能力，M1 可續用；M4 保持 MISSING。影響最小，但不能冒稱文件已轉錄。
- **C：新增轉錄表、期間分攤模型或人工指定係數模型。** 能容納更複雜責任／期間／係數語意，但超出本次最小方案；沒有裁定不展開。
- A 的主要風險：JSON 未經 server 控制會偽造 actor／語意；既有確認非冪等、latest 競態、resolver 同分、撤權期間請求、文件刪除與跨服務部分失敗。均須有直接 API／SQL 及 UI 回歸，不能只測 happy path。
- 回復方式：新入口預設停用，若驗證失敗關閉入口並保留既存收件／草稿／稽核，回到原 upload-only＋獨立人工活動流程；不自動刪資料、不搬移檔案、不做破壞性 rollback。任何雲端部署另待 Owner 授權。

## M3 剩餘來源小票（均未因本批報告局部 atomic 而關閉）

| 小票 | 狀態與來源依據 |
|---|---|
| 伺服器 hash／唯一索引占用 | OPEN：`202611020001_secure_upload_storage.sql:149` 僅 SHA 格式；core schema `:157` 是 project/hash unique。格式正確偽 SHA 仍可占用；須伺服器實讀 bytes 驗 hash，前端重算不能代替。 |
| 收件／metadata 信任 | OPEN（部分來源修正已有）：`202611020002_storage_receipt_review_fixes.sql:23-57` 綁定 Storage size/MIME；不驗真內容或 client metadata 中業務聲明。真 Storage metadata／MIME 行為未實測，不能稱所有 false metadata 已防止。 |
| 刪除跨服務部分失敗 | OPEN：`frontend/readdy-app/src/services/documentLibrary.ts:101-120` 先查直接／草稿引用，再 Storage remove，最後 receipt DELETE。檢查非交易，仍有 in-flight 引用競態及 bytes 成功／row 失敗；需要恢復／稽核策略，不能冒稱 atomic delete。 |
| Recalculate 重送 | OPEN：`202603160004_v1_hardening_recalculate_atomic_rpc.sql:7-128` request_id 記稽核但不去重；重試可能增加 calc_version。需獨立固定 intent／去重與失敗重讀契約。 |
| 報告快照一致性 | 本批僅局部候選：`202611060001_report_snapshot_atomic_v2.sql` 與 actual generate-report handler 的本機合成 HTTP/SQL 證據；不代表附件信任、所有重送／併發與真實部署已通過。 |

## 需 CTO 裁定的唯一問題

**是否核准方案 A 的範圍與責任語意：沿既有三表、MANUAL 明示、首版同人轉錄／確認可辨識、不自動分攤跨期、不新增係數釘選，以此契約補齊確認去重後實作？**
建議 A；若不接受上述邊界，先維持 B 並由 CTO 指定需要改變的語意。此文件不等於裁定或已通知；M4 受影響實作維持 WAITING_CTO，其他 READY 工作繼續。
