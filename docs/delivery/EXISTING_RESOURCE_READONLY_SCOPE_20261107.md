# 既有資源唯讀盤點範圍 — AUTHORIZED_READ_ONLY／READONLY_COMPLETE_WITH_SCOPE_LIMITS

此文件定義已授權的唯讀操作，**Owner已於2026-11-07授權並完成PC登入；限定範圍盤點已完成**。結果見[脫敏回執](SUPABASE_READONLY_INVENTORY_RECEIPT_20261107.md)，精確統計／版本／用量與差異保留受限本機Owner報告。不選擇UAT環境、不建立專案、不改設定、不讀業務資料內容；是否重用須另裁定。

## 核准後允許收集

- Supabase：帳戶內指定CoCalLab project的顯示名稱/ref/region、所屬organization、方案名稱、aggregate用量／費用摘要、PG版本、backup/PITR功能是否可用與保留期；不點下載備份或還原。ref wynqnvidepzzcwutexvn只為已知候選，須由Owner確認對應專案。
- 用途／資料分類：Owner說明用途、是否有真實企業資料／使用者、相依前端／服務；只看dashboard aggregate count或schema catalog／migration與function metadata，不開Table Editor列、Auth使用者清單、Storage物件列表／preview，不列email、文件名、row內容。無aggregate來源填UNKNOWN，不以source或空畫面推論無資料。
- 相依與隔離：可見project environment/branch metadata、functions名稱／deployment ID、schema/migration版本清單、Auth redirect／CORS／JWT的非secret設定摘要（僅讀，不切換）；無法確認live SHA填UNKNOWN。既有服務相依不明由Owner辨識，不能以未找到當不存在。
- 若Owner明確包含Cloudflare／Railway，才讀對應帳戶名稱／Pages/Workers或hosting project metadata、方案與aggregate用量；Runway影音與Railway hosting分開。此次Supabase授權不自動擴至其他帳戶。

## 不包含

不新增費用／資源、不下載企業資料／DB備份、不讀資料列或Storage檔案內容、不查／複製任何API key/JWT/secret，不改Auth／權限／RLS／functions／schema／DNS，不migration/seed/reset/還原/上傳/撤權，不操作Production。不得從本機.env試連或從browser擷取token作別用。盤點只開Supabase管理儀表板，不開可能自動呼叫enforce-subscription-status寫audit或更新狀態的CoCalLab/Readdy應用頁。

Owner自行登入指定帳戶；不在聊天貼帳密，不將帳戶權限交給未知第三方。若只能Mac端讀取，交受限、可跨主機讀取的脫敏盤點，不要求PC登入相同session。

## 證據與回報

受限回執記盤點者／UTC日期、帳戶/專案標籤、唯讀頁面／來源與每項VERIFIED/UNVERIFIED/MISSING/BLOCKED/OWNER_ACTION_REQUIRED。付款卡／發票／稅籍／聯絡人／帳單截圖及非必要金額不進公開Git／聊天；公開交接只記是否已核對與環境決策結論。需要比較費用時，Owner授權的aggregate估算另以受限方式分享。

結論只提供「既有專案是否可安全隔離／尚缺證據」「另建UAT的必要性與增量估算」供Owner選；唯讀授權不包含任何後續變更。證實有真實資料／相依不明時，不在既有專案做寫入驗收。
