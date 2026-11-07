# Deno／Edge 相容性待辦 — 固定 ba2c7a56

**BLOCKED_OR_PARTIAL；不是部署通過或新安全稽核。** 應用固定ba2c7a56cdd6bfcfc7076543bf68d9c38ab5fdde，本輪沒有修改handler／migration／前端／業務module。

## 實際證據

本機原生Deno CLI2.9.8、TypeScript6.0.3；14支入口以frozen lock進行check，**0 PASS／14 FAIL**。同版工具另成功產生14份靜態ESM JS bundle（與typecheck分開），無遺失本機import。完整命令、逐function結果、來源／bundle hash與lock見[evidence manifest](evidence/deployment-preflight-20261107/manifest.json)。不要把bundle成功或先前Node shim測試當成原生型別／managed runtime已通過，也不要加總14份重複錯誤當不同缺陷。

| ID | 具體缺口 | 固定來源／實跑log |
|---|---|---|
| D1 遠端SDK宣告 | 13支使用shared SDK2.49.4的入口出現@types/ws@8.5.13 TS2303循環import alias（各18個共同宣告錯誤）；不是13個獨立產品缺陷 | shared/supabase-client.ts:1及authz.ts:1；check-export-report-snapshot.txt等 |
| D2 浮動SDK | create-organization原source引用@supabase/supabase-js@2，這次實際解析到2.119.0；其auth-js WebAuthn宣告出現TS2552／TS2304（29 errors）。目前lock只凍結本次解析，不代表原程式已改成exact pin | create-organization/index.ts:2；check-create-organization.txt、manifest redirects及deno.lock |
| D3 handler error型別 | delete-uploaded-document及verify-upload-receipt對推斷為{}的error讀code/message/status，另有各3個TS2339 | delete-uploaded-document/index.ts:16；verify-upload-receipt/index.ts:21–22；各check log |
| D4 JS／TS邊界 | generate-report傳workspace/legal_entity/site資料物件；被匯入JS函式的預設null參數推斷成null/undefined，另有3個TS2322 | generate-report/index.ts:139–141；check-generate-report.txt |
| D5 runtime差異 | bundle仍有node: builtins；靜態打包不能證明Supabase sandbox與API可用。ESZIP／managed runtime／真服務完全未驗 | 各bundle.remainingImports；不得執行app handler來假驗 |
| D6 版本界線 | 參考edge-runtime1.78.1的deno fork crate metadata是2.1.4，不等於本機CLI2.9.8，更非既有專案實際runtime已知 | [官方deno/Cargo.toml](https://github.com/supabase/edge-runtime/blob/v1.78.1/deno/Cargo.toml)；managed actual UNKNOWN |

D1–D4是這組原生工具下的可重現檢查失敗；不能直接推論每個failure都會在不同managed compiler/runtime重現，也不能因JS可bundle就忽略。

## 最小後續修正方案（尚未實作，不改本輪固定應用）

1. 先固定經驗證的Edge SDK解析與型別來源，處理create-organization浮動@2；沿用既有2.49.4契約評估，不無證據升到2.119.0或把前端2.57.4當可替代。
2. 對D1以可追溯、精確版本的依賴／型別解析方案重現，保留原生檢查；不以skipLibCheck／忽略所有type errors改稱PASS。
3. D3使用既有error-envelope／unknown narrowing；D4補精確的JS參數JSDoc或明確邊界型別，保留null與真實欄位。不要用廣泛any或更改錯誤／權限行為交差。
4. 只提交與本問題相關的小相容性修正，提供新固定SHA及同工具check/bundle差異供CTO採用；不得把它混稱原ba2已修改。回歸只跑受影響契約及原生檢查，不重開H0／整案。
5. 雲端runtime／JWT/key model仍需授權環境metadata及隔離實測。只讀盤點不能部署診斷函式、呼叫可能寫入的應用handler或變更gateway/CORS。沒有可讀版本欄位就UNKNOWN。

目前部署前置只能簽收版本／來源／靜態產物與失敗證據；**實際部署READY仍BLOCKED，發布HOLD**。此處是下一項技術工作界定，不要求新增費用或雲端資源。
