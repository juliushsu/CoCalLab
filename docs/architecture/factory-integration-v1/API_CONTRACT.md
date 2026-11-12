# 工廠資料匯入 API 草案 V1

日期：2026-11-12。狀態：PROPOSED；所有 endpoint／欄位待 PC 定稿，尚未實作。基準與範圍見 [README](README.md)。

## 1. 相容與信任邊界

- 邏輯介面以 `/factory/v1` 表達；實際部署到既有 Edge Functions 或其他 adapter 的路徑由 PC 決定。不能將本文件 URL 當作目前可呼叫的服務。
- 回應沿用 `backend/supabase/functions/_shared/http.ts` 的 `{success,data,error,meta}` envelope。新功能使用 workspace 語意；銜接舊 `organization_id` 只在 adapter 轉換，不全域改名。
- 人員操作沿用既有登入／workspace membership；機器連線另定可撤銷的 connection credential，限定 workspace、廠區與 feed。授權範圍由伺服器決定，不信任 payload 內的 workspace／site 作授權。
- 匯入只能建立 staging／待覆核資料；不能透過外部 credential 核准因子、調整分攤規則或發布產品結果。connection、mapping、覆核、結果讀取皆做範圍與角色檢查。
- secret、token、真實工單、BOM 與企業憑證不得入公開 repo；日誌不含認證 header。所有以下值均為合成範例。

## 2. 介面集合

| Method／邏輯 path | 作用／語意 |
| --- | --- |
| `POST /factory/v1/ingestions` | 匯入單一 feed、建立 job；驗證與寫入正規化資料分開；成功收件回 202 |
| `GET /factory/v1/ingestions/{job_id}` | 回 job 與逐筆狀態、錯誤、replay／revision 資訊；分頁讀取大量明細 |
| `POST /factory/v1/mappings` | 經授權人員建立 mapping 新版本；資料衝突回 409，不覆寫已使用版本 |
| `POST /factory/v1/reconciliations` | 指定資料版本／期間與規則版本，產生核對 run；不修改來源數值 |
| `POST /factory/v1/reconciliations/{run_id}/decisions` | 人員覆核差異，使用 `expected_version` 避免覆寫並行決策 |
| `POST /factory/v1/product-calculations` | 建立製造階段或明定邊界的產品計算 run；輸入為核准資料／規則版本，異步回 202 |
| `GET /factory/v1/product-calculations/{run_id}` | 回執行狀態、總量／單位結果、邊界、缺口及追溯清冊 |

CSV 必須走相同 schema validation、mapping、deduplication、revision 與覆核流程；不能直接寫最終活動表。檔案匯入 UI 不先依賴外部廠商連線。

## 3. 匯入 envelope 與範例

必要 headers：`Authorization`、`Content-Type: application/json`、`Idempotency-Key`；可選 `X-Request-ID`。connection 由認證綁定且需與 body 相符。`schema_version` 與 `mapping_version` 必須是伺服器支援／核准的版本。

```json
{
  "schema_version": "factory.v1",
  "workspace_id": "11111111-1111-4111-8111-111111111111",
  "connection_id": "22222222-2222-4222-8222-222222222222",
  "mapping_version": 1,
  "feed_type": "resource_measurements",
  "records": [
    {
      "external_record_id": "synthetic-meter-01-20261101T0000Z",
      "source_revision": 1,
      "operation": "upsert",
      "source_updated_at": "2026-11-01T01:01:00Z",
      "payload": {
        "external_site_id": "DEMO-SITE-01",
        "external_meter_id": "DEMO-METER-01",
        "resource_type": "electricity",
        "interval_start": "2026-11-01T08:00:00+08:00",
        "interval_end": "2026-11-01T09:00:00+08:00",
        "reading_kind": "interval_consumption",
        "quantity": "100.00000000",
        "unit": "kWh",
        "measurement_basis": "measured"
      }
    }
  ]
}
```

數量使用十進位字串避免傳輸浮點誤差；計算採固定精度，依定稿的單位與精度規則四捨五入。最大筆數與 payload 大小設為可配置並公開契約；超出回 413，不靜默截斷。

## 4. Feed 必要欄位

所有 record 共用 `external_record_id`、單調遞增的正整數 `source_revision`、`operation=upsert|void`、含 offset 的 `source_updated_at`。若廠商無 revision，adapter 依穩定自然鍵與內容 hash 產生持久化版本；不能每次拉取都生不同事件 ID。

| feed_type | payload 最少欄位與驗證 |
| --- | --- |
| `production_actuals` | external site／order／batch／process run ID、實際起訖、設備／產線使用明細、outputs 陣列（料號／產品版本、良品／不良品／副產品數量與單位）、工單／批次狀態；拆併另帶明確關聯，產量不能以排程量代替 |
| `resource_measurements` | external site／meter ID、resource type、interval 起訖或累積讀值時間、reading kind、quantity、unit、measurement basis；儀表 mapping 連到設備／拓樸 |
| `material_movements` | external site／movement ID、batch／process run、material ID／version、movement type、quantity／unit、event time、供應商批號與證據參照（若有）；退料事件以類型表示，不允許任意負值 |
| `inventory_receipts` | external site／receipt ID、order／batch、product ID／version、入庫數量／單位、event time、入庫／沖銷類型；作核對證據，不另算生產排放 |
| `utility_controls` | external site／document ID、資源種類、帳單或控制總量、起訖、單位、evidence reference、來源依據；用於總量核對，不能直接與同源表計耗用相加 |

累積表讀值必須有 `reading_at` 與累積量，adapter 經前後讀值產生 interval；reset、溢位、換表與倍率變更需事件及證據。無法解釋的負差額進待處理，不自動轉為零。不得對沒有速率證據的稀疏累積讀值默認做精確工單切分。

時間使用 UTC 儲存並保留原 offset／site timezone；區間 `[start,end)` 且 start < end。連續／重疊／缺漏依 meter 與有效 mapping 判定；瞬時功率 kW 不可直接當 kWh，體積／質量／標準體積換算需要對應條件。

## 5. 防重複、修正與交易

1. 請求層唯一鍵為 connection＋Idempotency-Key，保存 canonical request hash。同鍵同內容回原 job／結果；同鍵異內容回 409 `IDEMPOTENCY_CONFLICT`。即使前次已完成亦不可再寫。
2. 紀錄層唯一鍵為 workspace＋connection＋feed type＋external record ID＋source revision。同 revision 同內容為 `replayed`；內容不同為 409 `SOURCE_REVISION_CONFLICT`。修正需新 revision 和新請求 key。
3. 最新有效狀態依 source revision 決定，不依到達時間；較舊版本晚到保存 provenance 並標 `stale`，不能蓋過新版。`void` 建立撤回版本，保留歷史與受影響結果清單。
4. `received → validating → staged/needs_mapping/rejected` 為收件與逐筆處理流程；`staged → reviewed → promoted` 為資料採用流程。job 可為 `received/processing/completed/completed_with_errors/failed`；完成匯入不等於完成覆核或碳計算。
5. 單筆原始紀錄、正規化版本及處理狀態必須原子一致；批次可逐筆成功，但需回報每筆結果及計數，重試靠逐筆鍵去重。補傳失敗紀錄需新 request key，不會重算已成功紀錄。
6. 缺失 mapping 可留待對應，但不可進計算。mapping 修正建立新 processing version，不修改原 payload；重新處理同 source record 不得新增第二筆同源活動。
7. 多個 connection／文件可能代表同一實體耗用。另需 consumption/source lineage 與有期間的權威來源政策辨識重疊；不能只靠 API 唯一鍵避免跨來源重複。
8. 計算 run 固定所有輸入 revision／mapping／rule 版本與 canonical hash；相同計算請求可重用結果。來源更新只使最新 working result 標 stale，不能改動完成報告。

## 6. 收件回應範例

```json
{
  "success": true,
  "data": {
    "job_id": "33333333-3333-4333-8333-333333333333",
    "job_status": "received",
    "received_count": 1,
    "processed_count": 0
  },
  "error": null,
  "meta": {
    "request_id": "44444444-4444-4444-8444-444444444444",
    "timestamp": "2026-11-01T01:02:00Z",
    "status": "accepted",
    "reason": null,
    "warnings": []
  }
}
```

job 查詢需提供各 record 的 `external_record_id/source_revision/status/error_code`、normalized ID、processing version，以及 staged／replayed／stale／needs_mapping／rejected 的分項數量；不可只回「成功」而隱藏失敗列。

## 7. 錯誤與產品結果

| HTTP | 代碼例 | 行為 |
| --- | --- | --- |
| 400/422 | `INVALID_SCHEMA`、`INVALID_INTERVAL`、`UNSUPPORTED_UNIT` | 修正輸入；結構不合法不建立已接受的 job，逐筆語意錯誤則在 job 明細列出 |
| 401/403 | `UNAUTHENTICATED`、`CONNECTION_SCOPE_DENIED` | 拒絕且不寫資料；避免洩露其他租戶物件是否存在 |
| 404 | `RESOURCE_NOT_FOUND` | 僅在授權範圍內查詢；不回傳其他租戶物件內容 |
| 409 | `IDEMPOTENCY_CONFLICT`、`SOURCE_REVISION_CONFLICT`、`VERSION_CONFLICT` | 明確指出衝突類型；不靜默覆寫 |
| 413/429 | `PAYLOAD_TOO_LARGE`、`RATE_LIMITED` | 拆批或依 retry-after/backoff 重試；重試保留原 idempotency key |
| 500/503 | `INGESTION_FAILED`、`TEMPORARILY_UNAVAILABLE` | 可安全重試；不把半成功標為全部失敗後重複寫入 |

產品結果最少回傳：`run_id/status`、assessment／product／batch version、boundary／stages、期間、functional／declared unit、reference flow、total kgCO2e、quantity／unit、per-unit kgCO2e 或 null、分攤與未分配量、缺資料／估算／核對例外、source／factor／rule snapshot references、created/reviewed timestamps。run 狀態與資料完整性分開；`completed` 只代表工作完成，不代表查證通過。

`pending_factor`、零產出、缺耗用或重大未解對應時，結果保留 null／缺口與具體原因。使用 decimal 字串或明定精度的既有 DTO 轉換，不透過前端缺值 fallback 變成零。完整產品 CFP 入口仍依實作與驗收 gate 管理。
