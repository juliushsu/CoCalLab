# 通用重算冪等性候選 — 2026-11-06

Business baseline06bad0818625bd9d4f3b685dff50994157b52757，接續hash來源411a99d597046f65dd54fc134df5dc0d8346c346與文件86ceb01。固定程式SHA：67e546fa6894303ccbff66d829d077b93c5fb8e2。來源候選已完成本機驗證與獨立定向審閱；未合併／部署／正式驗收。RELEASE HOLD，UAT7dccd545不變。

## 行為

計算頁先持久保存產品／使用者／單位／專案範圍的request ID，失敗或重載沿用，不在每次按鈕產新ID。新client以版本化recalculation_contract 20261106.recalc.1阻擋舊的不冪等handler；compatibility不是權限控制。

服務端以真JWT actor、org/project/request、force/formula intent與完整SQL取得的active activities/factors輸入快照建立private request ledger；不使用可寫audit或client hash作authority。相同操作／相同輸入返回原結果/IDs，不增加calc_version；新request才產下一版。force目前仍沿既有計算行為，只納入intent避免誤重用，不新增「不強制」業務規則。公式僅現行v1.0.0，未知版本不冒稱可用。

來源變更時，舊request不能回舊成功或自行改綁新輸入。lookup只讀保存結果；input_matches_current與results_are_latest各自表示輸入及結果現況。曾被新操作取代、缺少或異動的保存結果只能作歷史追溯，不會重新設latest。not_found/pending沒有數值計數，不補零或假完成。

畫面新增核對待確認計算（不新增版本），及只清當前user/org/project本機參考、不取消或刪除server的放棄操作；包含損壞journal的明確恢復，captured raw比較與刪後readback保護較新參考。未核對計算先擋報告保存；原建檔／頁面／報告流程保留。

## 交易與限制

JS計算在短交易之外，SQL commit在project鎖內重查完整canonical input，並以DB歷史max+1分配版本；同交易保存results／request結果／audit，任何失敗不留下新latest或半筆ledger。project使用NO KEY UPDATE避免與來源INSERT的FK KEY SHARE形成已知鎖序循環（未作獨立連線驗證）。commit短暫SHARE鎖activities/factors來源表，防止compare至保存之間的來源phantom；會延後其他project來源寫入，這是已知吞吐限制，未宣稱商業負載驗收。SQL真實多連線鎖等待、deadlock及真服務延遲未實測。

普通角色不能直接寫request ledger或呼叫內部service RPC；prepare/commit/lookup都重查scope、member與latest subscription，不信前端preflight。撤權後的lookup亦拒絕，journal留供後續授權核對。API丟回覆不觸發自動新request，不取消已提交的寫入。

## 驗證、入口與維運

主代理實跑：FE207/207、backend27/27、type-check/lint/build PASS。相關SQL/HTTP28 tests=27 PASS／1 explicit NOT_RUN（新HTTP8+SQL7與既有product/showcase12）；最後新增result INSERT被抑制的SQL rollback負例1/1另跑PASS。實作代理最終本項HTTP8/8、SQL8/8；獨立審閱在最後小防護前跑FE10/10及新增SQL/HTTP15 PASS／1 NOT_RUN，來源未見待修P1/P2。這些是重疊範圍，不加總。

RED：舊handler對同scope/request重送，實際SQL保存2筆而非1，斷言2 !== 1。GREEN保持同ID/同輸入1個計算版本。新增負例涵蓋quantity/factor/force/formula/actor改變、空專案、latest被取代、普通REST修改保存結果、SQL插入錯誤或被trigger抑制、最新readonly覆蓋舊active、direct private/RPC拒與失回覆查回；prepared pending的真實SDK DTO亦實跑，無Mock成功回退。

本機API4202在固定來源啟動。實際SDK正常建檔100kWh→服務端50kg→同ID重送→lookup，均保存同一calc ID、版本1；證據actual-sdk-recalculation.json與operation-reference.json。Chrome從原活動頁開原明細，核對50kg/.05t、版本1、同保存ID，截圖controls.jpg／version-one.jpg。這不是瀏覽器失回覆／獨立SQL並行驗收。

所有fixture明示合成、只在專用本機runtime；不接回正式Mock成功。原calculation_results的直接寫入權限未於此項全面收緊；本項辨識保存結果異動，不代表全calc/report防竄改已關閉。新migration004以顯式BEGIN/COMMIT包覆，只提交來源，無雲端套用。先有相容schema/handler再切新client，舊client缺穩定request_id會拒絕，不能透過回退舊不冪等endpoint解決。

NOT_RUN：真Supabase/JWT/Deno、獨立PostgreSQL SQL連線並行／lock-wait／deadlock、雲端migration／正式資料／部署／備份復原。多HTTP Promise.all或單PGlite序列不是獨立SQL並行證據。

驗證與小PR後接第3項受控刪除部分失敗／引用fence／恢復與稽核。新ledger/權限差異準備固定SHA定向審閱WAITING_CTO，不重開全案。

## 可操作入口及下一條命令

http://127.0.0.1:4203/login（API4202）。明示合成帳號owner@product-preview.invalid，密碼synthetic-local-only；不是Supabase帳號。預覽的scope/ID讀 /product-api/__synthetic/config，重啟資料庫會改變。既有4194/96/98/4200及5432保留；本次API exec70772、UI78131。

Repo root：

    $env:PGLITE_RUNTIME_ROOT=(Resolve-Path '../tooling/sql-runtime').Path
    node backend/tools/product-preview/run.js --port=4202

frontend/readdy-app：

    node node_modules/vite/bin/vite.js --config tools/local-preview/vite.recalculation.config.mjs

Repo root：

    node backend/tools/product-preview/recalculation-demo.js

此demo先保存合成scope／activity／request參考，再正常SDK保存活動並以相同request計算兩次及lookup，斷言同結果ID且只有版本1；不使用service-role寫入計算。若此request已被另一次新操作取代會明確衝突，不自動換ID掩蓋。頁面選同scope可查活動明細；「計算並保存／重試」在無pending參考時建立新操作，這會產生新版本；失敗時保留同ID可核對或重試。「放棄」只清本機參考，不撤銷已提交的server操作。

本項target：

    node --test --test-concurrency=1 backend/tests/integration/recalculation-idempotency-http.test.js backend/tests/integration/recalculation-idempotency-sql.test.js

下一開發項：受控刪除部分失敗、進行中引用、重試與audit。此候選不授權任何雲端操作。
