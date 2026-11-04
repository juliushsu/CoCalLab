# 原 App 本機預覽（合成、唯讀）

不需要 Docker／WSL，不讀專案 `.env`，不連接任何 Supabase／Readdy／Cloudflare／Railway。原 `main`、App、router、AuthProvider、LoginPage 與 AdminLayout 沿用；只有後台預覽的 Supabase import 換成明示測試 transport。正式 build 不引用這些工具。

在 `frontend/readdy-app`，使用既有 Node 與已安裝 node_modules，各開一個終端：

```powershell
node node_modules/vite/bin/vite.js --config tools/local-preview/vite.config.mjs
node node_modules/vite/bin/vite.js --config tools/local-preview/vite.backend.config.mjs
```

- 原公開首頁／登入：`http://127.0.0.1:4192/`。服務未設定時登入明確停用，後台仍由原 ProtectedRoute 阻擋。
- 原後台／選單：`http://127.0.0.1:4193/login`。測試專用 `a@preview.invalid`（A）、`b@preview.invalid`（B）、`shared@preview.invalid`（A owner/B viewer）；合成測試密碼 `SYNTHETIC-ONLY`，不是任何服務憑證。
- strictPort；占用時先檢查，不終止別的程序或換用5432。僅監聽 loopback；Ctrl+C只停止自己開啟的服務。兩個 optimizer cache 分開，原 production config 不變。

操作：登入 → 底部 A 文件／B 文件 → 原文件庫搜尋、篩選 → 查看私有原檔 → 關閉 → 下載。只有68bytes的合成PNG；每次私有讀取仍跑正式 library helper 的 metadata/user/scope/size/hash檢查。project-only URL 可使用 `?projectId=00000000-0000-4000-8000-000000000011` 核對解析後組織與唯讀提示。

所有資源寫入一律403，未知端點501（不回假成功）。清楚列出的空集合是測試fixture，不能當作實際業務空資料證據。組織／專案／文件／訂閱讀取及原檔為支援範圍；其他頁面入口保留，未提供的服務明示失敗。

此adapter在本分頁sessionStorage以 `cocal-synthetic-local-preview:` 前綴保存合成登入，重載可持續，登出會清除；不是跨分頁、真JWT或正式session驗收。CSP只允許本機連線與blob/data，外部圖示、字型、圖片會缺失。文件操作提供可見文字，不依賴遠端圖示才能點擊。

這是可重現介面預覽，不能取代真正的 Supabase／JWT／RLS／Storage、撤權、跨租戶直接API、復原或代表使用者UAT。正式流程沒有fixture fallback；真服務驗收保持NOT_RUN/BLOCKED，發布HOLD。
