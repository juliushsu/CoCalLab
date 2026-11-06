# Local synthetic product HTTP runtime

This tool runs the checked-in product REST contract and the actual `recalculate-project`, `generate-report`, and `enforce-subscription-status` Edge handler source against a new, in-memory PGlite database. It is a local integration fixture, not a cloud deployment or UAT approval. Production builds must not import this directory.

From the repository root, with Node 24.22.1 and the existing pinned PGlite runtime installed:

```powershell
$env:PGLITE_RUNTIME_ROOT='C:/Users/User/OneDrive/文件/ChatGPT/CaCalLab/local-uat/CoCalLab-UAT-LOCAL-01/tooling/sql-runtime'
node backend/tools/product-preview/run.js
```

The API listens only on `http://127.0.0.1:4194`. Startup fails if this port is occupied; it does not kill another process or choose a misleading substitute. Stop with Ctrl+C. All synthetic data disappear when the runtime stops. Each restart produces new UUIDs; fetch the current configuration instead of retaining old project IDs.

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

`/__synthetic/config` returns `{synthetic:true,baseUrl,publicKey,scope,accounts}`. It contains no service key. The public key is the literal `SYNTHETIC-PRODUCT-PUBLIC-KEY`. Frontend preview may use the same-origin `/product-api` proxy to port 4194; its Supabase URL is `location.origin + '/product-api'`. This tool does not alter Vite configuration.

All following credentials are invented fixture strings, not real accounts:

| Account | Email | Password | Membership |
|---|---|---|---|
| `owner` | `owner@product-preview.invalid` | `synthetic-local-only` | A owner, B viewer |
| `otherOwner` | `b-owner@product-preview.invalid` | `synthetic-local-only` | B owner only |
| `viewer` | `viewer@product-preview.invalid` | `synthetic-local-only` | A viewer only |
| `outsider` | `outsider@product-preview.invalid` | `synthetic-local-only` | None |

The password grant takes JSON `{"email":"owner@product-preview.invalid","password":"synthetic-local-only"}` and returns the normal session shape: `access_token`, `refresh_token`, `token_type`, `expires_at`, `expires_in`, and `user`. Send `Authorization: Bearer <that synthetic token>` and `apikey: SYNTHETIC-PRODUCT-PUBLIC-KEY`. Tokens are accepted only from this runtime's in-memory allowlist; this does not verify real JWT signatures, revocation, or Supabase Auth behavior. They cannot authenticate to a real service.

`scope.organizationId/projectId/userId` identify A and the shared user; `otherOrganizationId/otherProjectId/otherOwnerId` identify B. No fixture activity, calculation, or report is pre-inserted. Initial setup only installs the schema and synthetic organizations, projects, memberships, subscriptions, and a clearly named **SYNTHETIC custom factor: 0.5 kg/kWh** for each tenant. Activities must be inserted through the product REST route; calculations and reports must pass the actual handler/RPC path. The runtime calls `createLocalWorkflow` only for initialization, never its `receive`, `review`, `calculate`, or `snapshot` lab operations.

For a normal manual activity, the user explicitly chooses `activity_type=electricity`, `quantity=100`, `unit=kWh`, `final_scope=2`, and `inclusion_status=included` in the product form. With the synthetic factor, the saved result is 50 kg CO2e, or 0.05 t CO2e. These are fixture results, not actual company emissions or a production factor recommendation. No document/OCR/classification success is invented, and no Storage original is seeded. Storage paths return a real failure (404) rather than a fake download.

Run the focused integration tests:

```powershell
$env:PGLITE_RUNTIME_ROOT='C:/Users/User/OneDrive/文件/ChatGPT/CaCalLab/local-uat/CoCalLab-UAT-LOCAL-01/tooling/sql-runtime'
node --test backend/tests/integration/product-preview.test.js
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
