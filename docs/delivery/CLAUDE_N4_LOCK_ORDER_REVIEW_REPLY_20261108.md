# Claude 定向唯讀補審回覆：N4 鎖序修復

- 入口文件：`docs/delivery/CLAUDE_N4_LOCK_ORDER_REVIEW_20261108.md` @ `b468a658dbd84b8663d2741a75823083c13e5203`。
- **受審產品 SHA：`da5a0990c8ec82d2b55064dd7e009b771409fa73`**（下稱 `da5a099`）。
  - 紅例產品為 `ed6ca9b`，兩者的產品差異只有 `backend/supabase/migrations/202611080001_document_lock_order.sql`。
  - 證據讀自 `b468a65` 的 `docs/delivery/evidence/native-pg-concurrency-20261108/`。
- 審查方式：
  - 一律以 `git show`、`git diff`、`git grep` 唯讀閱讀固定 SHA，沒有改用 branch HEAD。
  - **沒有重跑任何測試，也沒有啟動 PostgreSQL**。證據中的 PID、鎖等待觀察與 PASS 都是提交者的執行結果，本審查只讀其內容並與來源比對。
  - 沒有操作雲端、正式資料、資源或權限。
- 範圍：只看本次 N4 修復與其交集，不重開整案，也不重查 P2-1～P2-3。
- 本回覆不構成放行，發布維持 HOLD。
- 附帶說明：入口最後一行寫「Owner 已選 Micro／累計額度／14 天」。本審查不核對、也不依賴這項敘述。

## 總覽

| 題目 | 判定 |
|---|---|
| 1. delete prepare 與 MANUAL create 的鎖逆序 | **三支函式本身已解決**。但 ordinary 角色寫草稿的 trigger 鏈仍是「先 advisory、後 project」，是同類殘留（N4-R1，P3，推論，NOT_RUN） |
| 2. actor／tenant／subscription／service-only 執行邊界 | **已解決**（來源支持） |
| 3. migration 拒漂移、anchor 恰一次、只刷新三個 fingerprint | **已解決**（來源支持） |
| 4. 紅綠例的真實性與覆蓋 | **已解決**（就具名排程而言），附一個證據品質備註；具名排程以外的交錯仍是 NOT_RUN |

## 1. 鎖逆序是否收斂 — **三支函式已解決；殘留 N4-R1（P3）**

**修復來源（`202611080001_document_lock_order.sql`）：**

- `:11-32` 在三支函式中原本的錨點語句之後，插入 `perform 1 from public.projects p where … for no key update;`。
- **`document_deletion_request`：**
  - 錨點是 `assert_write`（`202611060005:158`）。
  - project 鎖插在 `:161` 的 advisory `document-delete:` 之前。
  - 之後依序是文件 `for update`（`:176`）、`attachment:` advisory（`:191`）、storage object（`:193`），最後 update 收件（`:204`）。這時 `report_retain_receipt` 再取 project 鎖，已經是自己持有的鎖，可以重入，不會等待。
- **`finalize_document_deletion`：** project 鎖在 `:214` 之後、`:216` 的 advisory 之前；`:227` 的 update 同理可重入。
- **`release_document_processing`：** project 鎖在 `:284` 的 actor 檢查之後、`:285` 的 advisory 之前；`:289` 的 update 同理。
- 結果：三支函式與 `cocal_manual_private.lock_document`（`202611070002:5-14`）都是「project → `document-delete:` advisory → 文件列」的順序，原本的 A↔B 逆序已經消除。
- `assert_write` 對 project 只取 `for key share`（`202611060003:38`），與 `for no key update` 不衝突，不會造成新的自我阻塞。

**其他會 update 收件的路徑：**

- ordinary 角色對 `uploaded_documents` 的 update，會被 restrictive policy `cocal_receipt_update_guard`（`202611020001:123-124`，條件 `using(false)`）擋下，不會觸發任何 trigger。
- 其餘 update 收件的 SQL 只有 005 的四處：三支已修，`begin_document_processing` 的 public wrapper 會先呼叫 `lock_document`。
- 本次變更沒有引入新的逆序。

### N4-R1（P3，推論，NOT_RUN）：ordinary 角色寫草稿時的 trigger 鏈仍是「先 advisory、後 project」

- `extracted_document_drafts` 上的 BEFORE INSERT／UPDATE trigger 依名稱字母序執行：
  1. `deletion_draft_reference`（`202611060005:76`）呼叫 `reference_guard`，再呼叫 `assert_unfenced(new.uploaded_document_id)`，**先取得 `document-delete:<doc>` advisory**（`:34-40`、`:64`）。
  2. `protect_manual_draft`（`202611070004:6-31`）對 authenticated／anon 角色呼叫 `lock_document`，**這時才取 project 的 `for no key update`**。
- 修復後，刪除流程與 `lock_document` 都是「先 project、後 advisory」，所以兩者會逆序。
- 可能死鎖的交錯：
  - T1：editor 以 REST insert 或 update 一筆草稿，綁定文件 D。T1 已在 trigger 1 取得 advisory(D)，正要進 trigger 2。
  - T2：同一 project 對文件 D 呼叫 `document_deletion_request` 或 `create_manual_transcription_atomic`。T2 已持有 project 鎖，正在等 advisory(D)。
  - T1 再等 project 鎖，形成 T1↔T2 死鎖，結果是 40P01。
- 影響：只發生在很窄的時間窗內，而且一方會乾淨中止，不破壞資料完整性。
- 這個逆序在 `33d3613`（N1 的 trigger）就已存在，不是本次 migration 造成；但本次修復把刪除端翻成「先 project」，所以逆序也延伸到刪除流程。
- 證據覆蓋：具名排程 `delete_prepare_waits_for_new_reference` 與 `draft_reference_waits_for_delete_prepare` 中，草稿交易都是「已完整持有兩把鎖」或「尚未取得任何一把鎖」，沒有覆蓋「在兩個 trigger 之間」的交錯。
- 最小修法（擇一）：
  1. 在草稿表新增一個名稱排在 `deletion_` 之前的 BEFORE trigger，例如 `a_draft_project_lock`，對 ordinary 角色先取 project 鎖。它不在刪除 baseline 的具名 trigger 之內，不會造成漂移。
  2. 把 `protect_manual_draft` 改名，使它排在 `deletion_draft_reference` 之前。
- 修好後，可用既有的三 PID 加 barrier 工具補一個具名排程：barrier 停在兩個 trigger 之間。

## 2. 執行邊界 — **已解決**

- 修改方式是以 `pg_get_functiondef` 取出原函式定義，替換錨點後 `execute`（`:23-30`），也就是 `CREATE OR REPLACE FUNCTION`。這個做法保留原 owner 與 ACL；`SECURITY DEFINER` 與 `SET search_path=''` 都包含在定義文字內，所以也保留。
- 撤銷授權的規則沒有被改動：`202611060005:292-293,304-305` 對 public、anon、authenticated 撤銷，只授權 service_role。
- `document_deletion_request` 與 `finalize_document_deletion`：
  - 錨點本身就是 `assert_write`，新插入的語句排在它之後。actor、tenant、subscription 的檢查順序與語意不變。
  - 意圖衝突比對（`:171-172`、`:219-220`）不變。
- `release_document_processing`：
  - 錨點是原本的 `lease.actor_user_id` 比對（`:284`），**沒有加入 `assert_write`**。原本捕捉的 actor 在被撤權後，仍可清理已結束的 lease，符合入口要求。
  - 不同 actor 仍回 `DOCUMENT_PROCESSING_LEASE_DENIED`。
- 證據（提交者執行，未重跑）：`CANDIDATE_N4.json` 的 `fixed_finalize_replay_and_revoked_actor_lease_cleanup_keep_authorization`，記錄 ordinary 角色三個入口都被拒、wrong actor 被拒、撤權後仍可 cleanup，並還原 `ocr_status`。
- 小備註（不列等級）：`lookup` 與 `locate` 兩個唯讀動作現在也會取 project 的 `for no key update`，會與同一 project 的重算、MANUAL 等寫入序列化。只影響效能，不影響正確性。

## 3. migration 守門 — **已解決**

- 入場檢查：`:5-9` 先呼叫 `cocal_delete_private.deployment_ready()`。若為 false，直接拒絕，不重新建立基準。
- 錨點檢查：`:24` 用「長度差必須等於錨點長度」驗證每個錨點恰好出現一次，0 次或 2 次以上都會拒絕。
- 刷新範圍：`:36-44` 只更新三個明確列出的 function fingerprint，`row_count<>3` 時拒絕；`:45-47` 刷新後再檢查一次 `deployment_ready()`。
- 涵蓋範圍：
  - 已核對 `cocal_delete_private.catalog_state`（`202611060005:339-345`）涵蓋這三支函式，所以刷新是必要的。
  - attachment 基準的具名清單（`202611060003:208-215`）不含這三支函式，不受影響。
- 證據（提交者執行，未重跑）：
  - `DRIFT_REJECTION.json`：以交易內修改 `search_path` 製造漂移，migration 被拒並整批回滾，且沒有重設無關的 fingerprint。
  - `LOCK_MIGRATION_NATIVE.json`：只有三個條目變更，`acl_owner_config_preserved: true`。
- 與入口一致：`deployment_ready` 只是相容性檢查，不等於授權。

## 4. 紅綠例 — **具名排程已解決；其餘交錯 NOT_RUN**

以下全部是讀證據檔的結果，未重跑。

- **三條真實連線：** `BASELINE_N4.json` 與 `CANDIDATE_N4.json` 都記錄 A、B、observer 三個不同的 PID；伺服器是 PG 17.0.11，在獨立 port 55439 的本機原生資料庫上執行。
- **鎖觀察：** `lockObservations` 由 observer 讀取 `wait_event_type='Lock'` 與 `pg_blocking_pids`，blocker 為另一個 actor 的 PID。
- **紅例 `N4_native_delete_manual_create_lock_inversion`（產品為 `ed6ca9b`）：**
  - 結果為 `40P01`，被中止的是 B，並驗證了 rollback 與重試狀態。
  - barrier trigger `native_race_barrier` 依名稱排在 `deletion_receipt_guard` 與 `report_retain_receipt` 之間。它讓 A 在已持有 `document-delete:` advisory、尚未取 project 鎖時暫停；釋放之後才形成 A↔B，**不是 barrier 本身造成的等待**，符合入口要求。
- **綠例 `N4_fixed_early_project_lock_serializes_delete_manual_create`（產品為 `da5a099`）：**
  - A 先取得 project 鎖，再停在 barrier；B 的 MANUAL create 在 project 列上等 A（顯示為 `transactionid`）。
  - 釋放 barrier 後，B 得到 `DOCUMENT_DELETION_FENCED`。MANUAL audit 為 0、delete audit 為 1，沒有死鎖。
  - finalize 另有一個獨立的鎖觀察：`fixed_finalize_early_project_lock_fences_manual_create`。
- **證據品質備註（P3）：**
  - 綠例的關鍵觀察 `N4_fixed_manual_create_waits_for_early_project_lock` 記錄的 `state` 是 `"idle"`，但同時有 `wait_event_type:"Lock"` 與 blocker。
  - 正在等鎖的 backend 不應是 idle。較可能的原因是 observer 在同一個交易內重複讀 `pg_stat_activity`，拿到快取的統計快照；`pg_blocking_pids` 則是即時結果。
  - 結論不受影響，因為 blocker 與後續的 FENCED 結果一致。但建議 observer 每次輪詢前呼叫 `pg_stat_clear_snapshot()`，或每次用新的交易讀取，以免日後誤判。
- **未覆蓋：**
  - N4-R1 的「草稿 trigger 之間」交錯。
  - 其他鎖組合：證據的 `notRun` 也自列「Other lock combinations beyond named cases」。
  - 真實的 Supabase、PostgREST、JWT、Storage、Edge。
  - runner 以 exit 0 結束，不代表 N4 或真實服務已全面關閉。

## 本次實際執行的命令（全部唯讀）

- `git fetch origin`。
- `git diff --stat ed6ca9b da5a099`。
- `git show da5a099:<path>`：涵蓋 `202611080001`，以及 `202611060005:34-110,152-310`、`202611060003:34-44,208-222`、`202611020001:118-125`、`202611070002:5-14`、`202611070004:6-31`、core schema 的 policy。
- `git grep`：查所有 update `uploaded_documents` 的路徑、草稿表上的 trigger、函式最新定義的位置。
- `git show b468a65:docs/delivery/evidence/native-pg-concurrency-20261108/{BASELINE_N4,CANDIDATE_N4,DRIFT_REJECTION,LOCK_MIGRATION_NATIVE}.json`。
- 沒有執行 node、npm、psql、PostgreSQL 或任何測試。

## 需 CTO 裁定

1. N4-R1 要在下一個小修中處理（建議），還是列為已知的 P3。處理之前，N4 只能算「具名排程已收斂」，不能算全面關閉。

---

本回覆不構成放行，也不核准雲端操作、合併或 Production；發布維持 HOLD。
