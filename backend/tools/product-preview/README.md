# Local synthetic product HTTP runtime

This tool runs the checked-in product REST contract and the actual `recalculate-project`, `generate-report`, and `enforce-subscription-status` Edge handler source against a new, in-memory PGlite database. Optional showcase mode also loads the real `confirm-draft` handler. It is a local integration fixture, not a cloud deployment or UAT approval. Production builds must not import this directory.

From the repository root, with Node 24.22.1 and the existing pinned PGlite runtime installed:

```powershell
$env:PGLITE_RUNTIME_ROOT='C:/Users/User/OneDrive/文件/ChatGPT/CaCalLab/local-uat/CoCalLab-UAT-LOCAL-01/tooling/sql-runtime'
node backend/tools/product-preview/run.js
```

The default M1 API listens only on `http://127.0.0.1:4194`. Startup fails if this port is occupied; it does not kill another process or choose a misleading substitute. Stop with Ctrl+C. All synthetic data disappear when the runtime stops. Each restart produces new UUIDs; fetch the current configuration instead of retaining old project IDs.

For a **separate fresh M2 showcase** alongside M1, run `node backend/tools/product-preview/run.js --showcase --port=4196` using the same PGlite runtime variable. Without `--port`, showcase also defaults to 4196. It does not connect to or change the existing 4194 database. `createProductRuntime({scenario:'showcase',port:0})` provides the same scenario on an OS-selected safe port for tests. Configured ports never fall back; when the OS supplies a Fetch-blocked ephemeral port, only that newly created listener is closed and retried at most twice.

Start its original product UI in a second terminal (from `frontend/readdy-app`):

```powershell
node node_modules/vite/bin/vite.js --config tools/local-preview/vite.showcase.config.mjs
```

Open `http://127.0.0.1:4197/login`; use one of the clearly synthetic accounts below. This mode proxies only to 4196 and has a separate cache; existing 4192/4193/4195 modes are unchanged. The bottom banner links to current synthetic config. For each `manifest.fixtures.a` / `b`, original pages accept `?organization_id=<organizationId>&projectId=<projectId>`: `/admin/activities`, `/admin/documents/list`, `/admin/documents/drafts`, and saved `/admin/reports/<reportId>`. Use the current config IDs after every restart. A-only owner cannot read B; shared owner has B viewer access. An absent endpoint is an explicit error, not fabricated success.

Showcase config includes `scenario:'showcase'` and `manifest.{fixtures,cases,notRun}` with current A/B/project/activity/report/document/draft IDs. An extra `aOwner` account (`a-owner@product-preview.invalid`, password `synthetic-local-only`) is A-only owner; the existing `owner` remains shared A-owner/B-viewer. A/B saved totals (50 kg / 10 kg), a genuinely empty project, `pending_factor`, and unsupported-unit `error` are generated through normal REST INSERT and actual calculation/report handlers. No activity/calculation/report row is inserted directly by scenario setup.

Only showcase receipt/draft/catalog rows are explicit setup fixtures: `extraction_provider='SYNTHETIC-REVIEW-FIXTURE'`, OCR `pending`. The existing product UI confirmation guard rejects this provider; the real handler can reject the draft without creating an activity. This is **not** the missing production non-Mock document-to-draft entry. The handler's general direct-confirm contract is not claimed to reject every synthetic provider.

Showcase provides small, valid, visibly synthetic PDFs. Private GET `/storage/v1/object/{bucket}/{path}` (and `/object/authenticated/{bucket}/{path}`) first queries actual `storage.objects` under the caller's SQL role/RLS, then reads the fixture byte map. SHA/size/signature checks run in the real document-library service. Public URLs and cross-tenant/anonymous access fail; upload/delete return 405. This is a read-only Storage substitute, not real Supabase Storage HTTP or a server hash-attestation implementation.

```text
GET  /health
GET  /__synthetic/config
POST /auth/v1/token?grant_type=password
GET  /auth/v1/user
POST /auth/v1/token?grant_type=refresh_token
POST /auth/v1/logout
GET/HEAD/POST/PATCH/DELETE /rest/v1/<allowlisted-table>
POST /rest/v1/rpc/<allowlisted-rpc>
POST /functions/v1/recalculate-project
POST /functions/v1/generate-report
POST /functions/v1/enforce-subscription-status
```

`/__synthetic/config` returns `{synthetic:true,baseUrl,publicKey,scope,accounts}`. It contains no service key. The public key is the literal `SYNTHETIC-PRODUCT-PUBLIC-KEY`. Frontend preview may use the same-origin `/product-api` proxy to port 4194; its Supabase URL is `location.origin + '/product-api'`. The runtime does not alter production Vite configuration; the separate local-only showcase wrapper selects the 4196 proxy.

All following credentials are invented fixture strings, not real accounts:

| Account | Email | Password | Membership |
|---|---|---|---|
| `owner` | `owner@product-preview.invalid` | `synthetic-local-only` | A owner, B viewer |
| `otherOwner` | `b-owner@product-preview.invalid` | `synthetic-local-only` | B owner only |
| `viewer` | `viewer@product-preview.invalid` | `synthetic-local-only` | A viewer only |
| `outsider` | `outsider@product-preview.invalid` | `synthetic-local-only` | None |

The password grant takes JSON `{"email":"owner@product-preview.invalid","password":"synthetic-local-only"}` and returns the normal session shape: `access_token`, `refresh_token`, `token_type`, `expires_at`, `expires_in`, and `user`. Send `Authorization: Bearer <that synthetic token>` and `apikey: SYNTHETIC-PRODUCT-PUBLIC-KEY`. Tokens are accepted only from this runtime's in-memory allowlist; this does not verify real JWT signatures, revocation, or Supabase Auth behavior. They cannot authenticate to a real service.

`scope.organizationId/projectId/userId` identify A and the shared user; `otherOrganizationId/otherProjectId/otherOwnerId` identify B. In default M1, initial setup only installs the schema and synthetic organizations, projects, memberships, subscriptions, and a clearly named **SYNTHETIC custom factor: 0.5 kg/kWh** for each tenant. Activities must be inserted through the product REST route; calculations and reports must pass the actual handler/RPC path. The runtime calls `createLocalWorkflow` only for initialization, never its `receive`, `review`, `calculate`, or `snapshot` lab operations.

For a normal manual activity, the user explicitly chooses `activity_type=electricity`, `quantity=100`, `unit=kWh`, `final_scope=2`, and `inclusion_status=included` in the product form. With the synthetic factor, the saved result is 50 kg CO2e, or 0.05 t CO2e. These are fixture results, not actual company emissions or a production factor recommendation. No document/OCR/classification success is invented. Default M1 has no Storage original; its Storage paths return 404.

Run the focused integration tests:

```powershell
$env:PGLITE_RUNTIME_ROOT='C:/Users/User/OneDrive/文件/ChatGPT/CaCalLab/local-uat/CoCalLab-UAT-LOCAL-01/tooling/sql-runtime'
node --test backend/tests/integration/product-preview.test.js
node --test backend/tests/integration/product-preview-scenarios.test.js
```

Tests create dedicated workers with random loopback ports (`port:0`) and close each database/server. They run the actual frontend `manualWorkflow.ts` services through the installed Supabase SDK, ordinary manual REST INSERT, the original handler source, and real SQL RPCs. Coverage includes saved readback and units, same-UUID activity recovery after a committed response loss, conflicting retry rejection, scope invalidation before writes, no-calculation/pending-factor report rejection, role/RLS/RPC ACL denials, pre-RPC failure/retry, and committed report response loss with same-request recovery. `failNext` is an in-process test API only; it has no HTTP endpoint.

Boundaries and remaining verification:

- The worker maps only the handler's remote `esm.sh/@supabase/supabase-js@2.49.4` import to the **locally installed frontend SDK**; it blocks other remote module imports. This is Node's TypeScript execution with a minimal `Deno.env/serve` bridge, not the real Deno Edge runtime or the CDN artifact. The installed version can be inspected in the frontend lockfile.
- `Deno.env` exposes only local fixture values. No `.env`, real Supabase key, company data, Docker, or cloud service is read or contacted by the adapter. Its database is new and in-memory.
- The PostgREST adapter is a limited allowlist implementation. It executes real SQL with `SET LOCAL ROLE` and synthetic `auth.uid()`, handles the filters/order/pagination/count/single-row semantics required by this workflow, and converts PostgreSQL numeric/date values to their JSON wire representations. It does not claim general PostgREST compatibility or nested join projection coverage. Unknown tables, RPCs, handlers, and storage paths fail explicitly.
- Migration setup uses the existing local-workflow initialization chain, including the incremental report V2 migration. Three historical cloud data-fixture migrations are explicitly omitted by that initializer; no migration is applied to a cloud or existing database. The local-workflow's old lab gap strings are not this runtime's handler evidence.
- No real Supabase Auth/JWT/HTTP Storage, remote PostgREST, real browser native upload/download, cloud migration/restore, production concurrency, or deployment is validated by these tests. Recalculation can create another version on a new invocation; full production idempotency is not claimed. The report V2 same-request test is narrower than general distributed retry guarantees.
- `enforce-subscription-status` runs its existing handler, including its normal audit/possible subscription writes, only on these dedicated fixtures. Loading it is not a finding that its public production authorization contract has been redesigned.

Publication remains HOLD. These local results do not approve merge, production deployment, or traffic switching.
