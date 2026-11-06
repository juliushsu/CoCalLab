# M4 方案A本機交付 — 2026-11-06

固定程式06bad0818625bd9d4f3b685dff50994157b52757；branch codex/manual-transcription-20261106，疊在PR23 dd808ed。原29條路由保留，新增1條人工轉錄路由，沒有移除原前後台。發布HOLD、UAT7dccd545不變；全合成且僅本機，不是正式服務驗收。

## 可操作入口與啟動

[本機登入](http://127.0.0.1:4199/login)；[當前合成帳號／文件ID](http://127.0.0.1:4199/product-api/__synthetic/config)。本次專用API4198、UI4199；原4192/4193/4194/4195/4196/4197保留，既有5432及其他專案未操作。只可停止本次API exec76016、UI exec49898。API重啟會建立新ID並清除這批記憶體資料；session不保證永久執行。

repo root啟動API：

~~~powershell
$env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path
node backend/tools/product-preview/run.js --manual-transcription --port=4198
~~~

另一個terminal切至frontend/readdy-app啟動原App：

~~~powershell
node node_modules/vite/bin/vite.js --config tools/local-preview/vite.integration.config.mjs
~~~

帳號a-owner@product-preview.invalid／b-owner@product-preview.invalid／owner@product-preview.invalid（共享A owner/B viewer）／viewer@product-preview.invalid／outsider@product-preview.invalid；密碼synthetic-local-only。全部刻意公開的假帳號，不是雲端Supabase使用者或真憑證。

## 已實際走過的完整操作

1. A-only owner登入，原文件清單顯示SYNTHETIC-A.pdf、OCR pending；點「人工轉錄／確認（非OCR）」。本機Storage替身先以真SQL RLS核對storage.objects，再讀fixture bytes。原件可在原生PDF viewer檢視：SYNTHETIC / A manual entry 100 kWh / Not an invoice / OCR pending。
2. 人工明填活動名稱、100、kWh、2026-11-06、energy、electricity、Scope2、included、原件位置及人工摘錄；文件期間留空明示未知。不自動推今日、補0/kg或跨期分攤。
3. 「保存人工轉錄」經真manual-transcription handler＋service-only RPC建立MANUAL_TRANSCRIPTION_NO_OCR草稿。未seed草稿/活動/計算/報告，也沒有呼叫Mock OCR或分類。
4. 填確認備註，按「確認並保存活動」；server各記轉錄與確認actor/time，允許同人並明示非雙人覆核。真交易保存活動、來源doc/draft、計算50kg與確認結果。讀回資料顯示calculated／50kg／保存警示；缺係數或歧義則pending_factor/NULL。
5. 原「活動／計算與報告」頁看到1筆100kWh與Source Document，直接保存報告快照（不必重算一次）；原generate-report V2交易保存並重讀50kg=0.05t。開啟保存v1報告，十章導引與來源資料可查。
6. 原Report Preview→Export→HTML、JSON；每次先經server政策A核對並重讀同一保存快照，再用共用formatter產檔，UI明示提出下載請求。PDF/Word未提供。原生下載落盤仍UNVERIFIED，未用提示冒稱成功。

證據：

- [已確認原件／同人actor截圖](evidence/manual-transcription-20261106/confirmed.png)、[DOM](evidence/manual-transcription-20261106/confirmed.txt)。
- [保存報告與來源活動](evidence/manual-transcription-20261106/saved-report.png)、[DOM](evidence/manual-transcription-20261106/saved-report.txt)。
- [匯出選項](evidence/manual-transcription-20261106/export-options.png)、[完整報告／下載請求](evidence/manual-transcription-20261106/report-export-request.png)、[DOM](evidence/manual-transcription-20261106/report-export-request.txt)。
- [來源與本機receipt](evidence/manual-transcription-20261106/receipt.json)：固定SHA、已載handler、initializer migration清單/雜湊與3份歷史fixture省略、觀察IDs／量／單位／未驗範圍。不是雲端migration收據。
- [同一實際保存快照HTML](evidence/manual-transcription-20261106/actual-saved-report.html)、[JSON](evidence/manual-transcription-20261106/actual-saved-report.json)：額外以同一server授權讀取＋共用formatter在Node實際寫檔／讀回，hash列receipt；**這兩份不是原生瀏覽器存檔證據**。50kg/.05t、測試標記、MANUAL來源鏈保留。

## 恢復、權限與交易

固定draftId/requestId與不可變canonical輸入，保存前才寫本機恢復參考；按產品／user／org／project／document分區。未確認回覆只能同ID／原內容重試或先查server；不重傳bytes、不默換ID。損壞journal明示阻擋，手動放棄只清該key、不刪server原件/草稿。若journal指向舊draft而server已有新latest，停用確認並要求明確放棄舊參考，不移用舊決定。

MANUAL資料列直接authenticated偽造/更新/刪除被server-managed trigger拒，並不是只藏UI。建立/確認交易重查同tenant/project active會員、精確latest訂閱、active文件、私有bucket/路徑與原件；鎖文件、draft及會員/訂閱。確認同intent回既有activity/calculation、不同intent拒；rollback包含確認、活動、計算與audit。raw JSON保存provenance，非client聲明或可寫audit作授權。

MANUAL草稿已存在時，一般app不能直接刪其原件／收件：新restrictive DELETE guards與既有policy AND；前端也在觸bytes前拒絕。這是狹義保留保護，不是解決Storage/DB跨服務刪除原子性。舊非MANUAL路徑未全面重構。

## 測試（固定06bad08）

- 前端191/191；backend21/21；SQL/HTTP239/239；type-check/lint/build PASS。
- [前端完整log](evidence/manual-transcription-20261106/frontend.log)、[backend log](evidence/manual-transcription-20261106/backend.log)、[SQL/HTTP log](evidence/manual-transcription-20261106/sql-http.log)。
- M4目標SQL8、HTTP9、contract4、FE新7均包含於上述總數；獨立reviewer重跑HTTP9、SQL8、contract4、FE29與tsc都是同範圍子集，不能加總。
- 保留既有正反例。新增直接API/SQL偽actor/provider、client MANUAL寫入/刪除、寬permissive policy下retention仍拒、跨scope/viewer/JWT拒、固定UUID/replay/改intent/並發呼叫、最新訂閱拒、真SQL失敗rollback及回覆遺失恢復。
- 獨立重現並修正：舊active蓋過新readonly/suspended、pending原件先刪bytes、重送遺失保存警示、舊journal誤套新版本、本機hash敘述不精確。最終定向審閱未發現未解P1/P2；不把此結論當Claude已審、商用或真環境通過。

## 未驗與部署影響

真Supabase Auth/JWT/Storage HTTP/PostgREST/Deno、原生檔案保存、真獨立SQL連線並行、雲端migration/backup/restore/deploy、Owner業務責任／合規／19+1代表使用者驗收均NOT_RUN／WAITING_OWNER。PGlite單一序列化連線及HTTP Promise.all不能替代真並行交易證據。

server bytes/SHA防偽、收件hash唯一索引占用、in-flight跨服務刪除、整張report防竄改及generic recalc冪等仍OPEN；本機私有byte/hash/簽章比對不關閉它們。未知或缺hash在UI明示未比對。

未新增碳業務表；202611060002只對既有草稿JSON／RPC／trigger／retention policy增量來源修改，未建bucket、搬移/刪除既有物件或操作雲端。將來部署須先申請新migration、manual handler、confirm新分支及export政策設定，連同舊documents bucket可能建立行為一併申請，不可把source merge當雲端授權。

回復：關閉新人工/匯出入口，保留原件、草稿、audit與保存報告，不自動DROP/刪資料、不降級為Mock或舊非冪等MANUAL確認。新service-only RPC/JSON provenance/retention可交固定06bad08定向紅隊，問題見CLAUDE_MANUAL_TRANSCRIPTION_TARGETED_REVIEW_20261106.md；既有ledger18c0894審查指令仍有效。
