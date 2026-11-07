# 原生 Deno 相容性小修復 — 2026-11-07

**本機靜態相容性已修復；不是整合安全或真服務放行。RELEASE HOLD。**

應用候選固定 fc3be262bfe931ea37ea8ded194862c0145ce07e，前一應用ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde及其14FAIL原始證據不改；正式UAT仍7dccd5452152f2495d10ad1437d5d03215166065。新證據在[evidence](evidence/deployment-preflight-20261107-fc3be262bfe9/RESULTS.md)。

- D1/D2：所有Edge SDK經單一shared import使用精確npm:@supabase/supabase-js@2.49.4；create-organization不再浮動@2。npm路徑依[官方依賴指引](https://supabase.com/docs/guides/functions/dependencies)，沒有升SDK業務版本。npm自動解析的Node26宣告與這版Deno globals衝突，新增精確Node types22.12.0 reference；保留frozen dependency lock，不skipLibCheck/no-check。
- D3：兩個upload/delete handler對unknown做object/string/number narrowing，保留AuthzError、原始request/document ID與恢復訊息，不改權限／錯誤成功語意。
- D4：報告JS metadata參數JSDoc保留真實選取欄位與null預設；錯ID型別仍拒絕，runtime內容不變。
- graph工具納入npm及triple-slash type依賴；新candidate須完整40字SHA並寫獨立證據目錄，不覆蓋ba2。離線audit對錯SHA／錯hash降級status且非零退出，不沿用舊PASS標題。Mozilla CA是正常驗證信任庫，不關TLS；不用受限主機無權讀取的system store。

## 實際結果

| 範圍 | 結果 |
|---|---|
| 原生Deno2.9.8 fixed candidate check --all | 14/14 PASS、0診斷；SDK與handler皆實際檢查 |
| 靜態ESM bundle+map | 14/14產出、逐一SHA256讀回相符；非ESZIP |
| frozen lock | SHA256 5897f3dd1da8f61e76c7aa93463166ed5efd8bf2939e4efe222fd62698cd2725，打包前後未變 |
| 原生精確SDK／合成本機HTTP | 3/3 PASS：request JWT/public key與service key分離、無JWT不替換service key、缺env在HTTP前拒絕；不是Node映射SDK，也不是真JWT／Supabase |
| graph＋audit gate | 7/7 PASS；錯完整SHA及各hash失配負例保留；獨立重跑同範圍不加總 |
| metadata契約 | 2/2 PASS，含不合法ID型別負例及真metadata/50kg內容保留 |
| handler錯誤契約 | 1/1 PASS，覆蓋400/401/403、SDK錯誤、操作409及原ID恢復；本機Node/SQL合成adapter |
| backend unit | 29/29 PASS（包含metadata2，不能再加總） |
| 獨立審閱 | 相容性固定fc3無已證P1/P2；audit status／fullSHA的P3已修，離線7/7再次通過。不代表四P2已解 |

原生SDK test的punycode deprecation warning保留；不影響本次PASS，不隱藏。兩獨立SQL、managed Edge/runtime/gateway、真JWT/Storage、原生選檔／下載、完整restore及19+1驗收均NOT_RUN。未建資源／未呼雲端／未讀憑證。

## 重現入口（repo root）

```powershell
node --test backend/tools/deployment-preflight/graph.test.mjs backend/tools/deployment-preflight/audit.test.mjs
node backend/tools/deployment-preflight/verify.mjs verify fc3be262bfe931ea37ea8ded194862c0145ce07e
node backend/tools/deployment-preflight/summarize.mjs fc3be262bfe931ea37ea8ded194862c0145ce07e
```

固定CLI／Deno檔案沿deployment/README，原生compiler只分析不執行handler；native SDK test另以本機loopback限定網路及三個SYNTHETIC env執行，不擴為正式權限。大型source/cache/bundle在workspace tooling；repo只留lock/manifest/log與工具。後續安全候選必須另固定SHA再跑，不可沿用fc3的14入口結果。
