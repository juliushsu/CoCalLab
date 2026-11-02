# Local real-AuthProvider / upload integration

Synthetic-only browser entry. Start from frontend/readdy-app:

```powershell
node node_modules/vite/bin/vite.js --config tests/browser/auth-upload/vite.config.mjs
```

Loopback: http://127.0.0.1:4190/. This config uses its own envDir, does not load production .env, and intercepts every SDK request to a .invalid origin.
It mounts the actual AuthProvider, useAuth, session gate/continuity/persistence helper, documentService and DocumentUploadPage.
Only the Supabase connection factory/configuration, layout and staging value are test adapters. No cloud request or real credential is used.

- `?case=failed-login`: fail synthetic login, confirm the provider remains usable for the retained valid session, select a browser-memory image/jpg JPEG fixture, then Upload. Expect 1 object / 1 receipt / stored MIME image/jpeg.
- `?case=expiry`: provider-only probe avoids document reads auto-refreshing a short session. Start a 12-second synthetic session; fail login while it is current. Expect operation current=true under a new epoch, then session=none on expiry.
- `?case=refresh`: Upload the synthetic JPEG. The intercepted object POST calls actual SDK refreshSession before returning. Expect refreshes=1, unchanged epoch, 1 object / 1 receipt.

The header file button creates a tiny synthetic JPEG signature in browser memory and invokes the real input change handler; it does not read host files or test the native chooser.
The synthetic header is not a decodable photograph and does not establish server content validation.
Auth storage is a per-page Map wrapped in the real logout-safe adapter. Reload persistence, actual JWT verification, real Auth/Storage API, database RLS and cloud migration/restore remain NOT_RUN.
No OCR or AI provider is invoked. Stop the local server after testing.

Evidence and the independent review scope: docs/delivery/UPLOAD_N1_N2_DELIVERY_20261102.md.
