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

## Recalculation request recovery (local candidate)

Run `node backend/tools/product-preview/run.js --port=4202` for a fresh dedicated manual fixture; its optional UI wrapper uses 4203. Existing 4194/4196/4198/4200 services are not stopped or reused. Both actions use the actual checked-in `recalculate-project` handler and new `202611060004_recalculation_requests.sql`. Before HTTP requests, clients must read authenticated `recalculation_contract(p_project_id)` and require exact project/organization, version `20261106.recalc.1`, and `can_recalculate=true`. Missing/old capability fails closed; this is compatibility detection, not the authorization boundary.

Body: `{organization_id,project_id,actor_user_id,force_recalculate,request_id,action?,formula_version?}`. `request_id` is a durable nonempty string (maximum 200 characters), action defaults to `calculate` and may be `lookup`; formula defaults to the only implemented `v1.0.0`. JWT actor is authoritative. Same actor/scope/request/force/formula plus unchanged complete current activity/factor inputs returns original IDs/counters without another version or audit. A changed input/intent or superseded/tampered saved result rejects calculation with 409. A new explicit request may calculate a new version.

Both actions return the original flat counters plus `request_id`, `replayed`, `input_matches_current`, `results_are_latest`, `calculation_result_ids`, and `operation_status`. Lookup `not_found`/`pending` returns null counters and empty IDs; pending input equality may be true or false. `historical` preserves saved counters/IDs but is not current success: inputs changed, a later completed request exists (including an empty project), IDs disappeared/were superseded, or their saved row content changed. Lookup creates no ledger entry, calculation, audit, or action log. Service-only prepare binds intent and complete SQL aggregate input arrays before calculation; commit compares fresh inputs and allocates DB max+1 versions in one transaction. Private ledger/saved rows, not mutable audit records or caller counters, establish replay authority.

Commit holds the project lock and short SHARE table locks on activity/factor sources to prevent insert/update phantoms during compare+save. These locks can delay source writes in other projects; throughput and independent SQL-connection lock/wait behavior are **NOT_RUN**. SQL roles/catalog and HTTP Auth/Storage are synthetic local substitutes, not real Supabase UAT. Existing direct calculation-row mutation privileges are not redesigned here; saved full row snapshots detect mutation for recovery/currentness. Trusted service maintenance and old service-only RPC use remain outside this handler's request protocol.

```powershell
$env:PGLITE_RUNTIME_ROOT='C:/Users/User/OneDrive/文件/ChatGPT/CaCalLab/local-uat/CoCalLab-UAT-LOCAL-01/tooling/sql-runtime'
node --test --test-concurrency=1 backend/tests/integration/recalculation-idempotency-sql.test.js backend/tests/integration/recalculation-idempotency-http.test.js
```

Before the new migration/handler, the HTTP regression `same scoped request returns original result IDs without another version or audit` failed with `same request must not allocate another calc_version: 2 !== 1`. RED command: `node --test backend/tests/integration/recalculation-idempotency-http.test.js` against pre-fix source. New cases cover response loss, read-only pending/history lookup, changed quantity/factor/new candidate/intent, latest subscription or membership revocation after prepare, actual SQL rollback, private ledger/RPC ACLs, scope/payload omissions, DB version allocation, 1,101-row input aggregation, saved-row tampering, and installed SDK frontend service recovery.

## Manual-transcription scenario (M4 local candidate)

Run `node backend/tools/product-preview/run.js --manual-transcription --port=4198` with the existing `PGLITE_RUNTIME_ROOT`. Default M1 4194 and showcase 4196 are unchanged. The separate UI may proxy 4199 to 4198; this tool does not start the UI or stop an existing service. `createProductRuntime({scenario:'manual-transcription',port:0})` creates the same fresh fixture for tests. Config `manifest.fixtures.a/b` provides scoped **SYNTHETIC** original/receipt IDs, readable synthetic PDF bytes, and the existing five synthetic role accounts. It seeds no draft, activity, calculation, or report.

The actual `manual-transcription` handler accepts fixed organization/project/document/draft/request IDs plus explicit `transcription` fields; see `backend/src/contracts/manual-transcription.js`. Unknown actor/provider/status inputs are denied. Optional text uses null rather than an empty string; the source locator is mandatory. Quantity is a JSON number matching numeric(20,8), never a default zero; units/dates/Scope/inclusion are explicit. A known source period must fit the project, and no cross-period allocation is attempted. Source period may instead be two nulls.

The incremental `202611060002_manual_transcription_v1.sql` writes only existing tables/JSON: server JWT actor/time and input in protected provenance, provider `MANUAL_TRANSCRIPTION_NO_OCR`, pending/unclassified draft, and audit. OCR remains pending. Same fixed IDs, actor and canonical input replay the saved row; changed intent or an existing document latest conflicts. The normal `confirm-draft` handler routes MANUAL to its service-only V2 transaction, locking source/draft and rechecking tenant/project/active membership/latest subscription/private original. Same-person transcription/review is allowed and recorded. Confirm uses immutable draft input, an explicit review note/request, and the real factor/calculation helpers; equal-ranked candidates remain `pending_factor`/NULL with an ambiguity warning rather than silently choosing one. No factor pinning is introduced.

Authenticated clients cannot directly forge/update/delete MANUAL provenance, including under an additional permissive RLS policy. Two restrictive DELETE guards retain original/catalog and receipt rows once a protected MANUAL draft exists, even while pending with no activity. Trusted service maintenance keeps its prior authority. In this scenario only, the synthetic Storage DELETE endpoint executes actual SQL RLS and removes fixture bytes only for returned catalog rows; showcase remains read-only. This is **not** atomic Storage/database deletion or recovery; concurrent cross-service races remain M3 OPEN. Server byte/hash attestation and hash-unique poisoning also remain OPEN.

Focused commands (fresh in-memory database, source migration chain, synthetic Auth/Storage adapter):

```powershell
node --test backend/tests/manual-transcription.test.js
node --test backend/tests/integration/manual-transcription-sql.test.js
node --test backend/tests/integration/manual-transcription-http.test.js
```

Evidence scope: contract 4 cases; SQL 8 cases; HTTP 8 cases. Coverage includes create/replay, direct-role forgery with permissive-policy drift, tenant/role denials, canonical conflicts, same-document/concurrent confirmation, committed-response loss recovery, true SQL rollback after activity insertion, stale drafts, latest readonly/suspended/canceled versus old active subscriptions, expired/grace enforcement, pending-factor/ambiguity NULL, and pending source retention plus legitimate unprotected deletion. These are local source tests, not real Auth/JWT/Storage/Deno UAT, historical-data attestation, cloud migration approval, or a production release. No cloud resource or existing database is modified.

## Controlled document deletion (source/local candidate)

Start a new dedicated API with `node backend/tools/product-preview/run.js --verified-upload --port=4204`; the separate UI wrapper uses 4205. Existing preview listeners remain unchanged. Verified-upload now also loads the actual MANUAL transcription/confirmation handlers. The HTTP integration includes actual installed SDK byte upload, server SHA receipt, explicit MANUAL/no-OCR transcription, confirmation (calculation version 1), same-request generic recalculation (version 2 only once), and saved report readback 100 kWh → 50 kg → 0.05 t. Its referenced original is refused deletion. Fixtures are synthetic; no OCR result, company emissions, real Auth/JWT/Storage or deployment is validated.

Before delete/lookup/locate, authenticated clients require exact scope and `document_deletion_contract(p_project_id)` version `20261106.delete.1`, `can_delete=true`. This is compatibility gating; SQL rechecks actual active membership, write role and latest subscription. `POST /functions/v1/delete-uploaded-document` takes organization/project/document UUIDs, stable request UUID and `action:'delete'|'lookup'` (default delete), plus optional paired exact bucket/path descriptor. Normal receipts derive the path server-side. No-receipt objects require a matching server reservation or exact document UUID basename and the caller's actual object ownership. Ambiguous or other-owner orphans are retained.

Orphan cleanup passes `expected_receipt_absent:true`, bound into immutable intent. If another tab registers the same receipt first, cleanup returns 409 `RECEIPT_ALREADY_REGISTERED`; if prepare wins first, new receipt/verification/reference writes are fenced. Optional descriptor omission versus the same correct descriptor does not change intent. Changed actor, mode, scope, request or path cannot take over an operation. Read-only `action:'locate'` omits request_id and recovers the original request only for the same JWT actor/scope/document/mode/exact optional descriptor; otherwise returns not_found with null request_id and existence fields. It never creates an operation or sends Storage DELETE.

Prepare durably records actor, object generation/owner/full catalog metadata and intent, marks a receipt pending, and fences references before byte removal. All versions/statuses of drafts (including MANUAL), direct/indirect activities, processing work, shared receipt paths, and saved report appendix references are considered; unknown historical report mappings fail closed. Reference INSERT/UPDATEs and processing leases use the same document advisory fence, including service flows. Protected pending/deleted bytes are hidden from ordinary Storage SELECT. All ordinary protected Storage DELETE/overwrite and receipt hard deletion are rejected, including legacy originals; unrelated buckets retain their prior behavior. This supersedes earlier raw unprotected-delete examples above.

The service requires a precise Storage ACK or a subsequent SQL-confirmed absence, then finalizes a tombstone/archive and audit in SQL. It retains the receipt row, historical hash proof, request ID and audit. `deleted` means byte absence plus confirmed finalization, not receipt-row deletion or cross-service atomicity. Empty ACK/403/error is not success; delete or finalize response loss keeps the same operation for lookup/retry. `pending` may mean bytes remain or are already absent. No automatic undo/re-upload, new ID, fence expiry, or assumption that bytes were restored occurs. A missing original is explicitly recorded. Only completed controlled tombstones stop occupying the trusted hash unique index; other archived/cross-environment hash conflicts are unchanged. Deleted/reserved paths cannot be reused by ordinary clients, and old verification cannot revive a fenced ID.

The legacy `process-document` handler now acquires a durable server-only processing lease before provider/read work and saves through a wrapper that rechecks actor/latest subscription/document/fence and releases in the same transaction. Known ended failures release only their own lease; crash/failed release keeps it blocking deletion without TTL. Owner investigation must establish work has actually stopped before any separately authorized maintenance. Pre-existing untracked work must be drained/inventoried before future deployment. This does not enable or replace the existing mock provider, establish real OCR, or make legacy processing retries idempotent. Explicit mock-provider failure injection exists only inside the local worker test harness.

005 first asserts the known 003 deployment fingerprint, then updates only the explicitly changed approved verification definitions/index fingerprints and installs a separate deletion baseline. There is no runtime re-learning endpoint. DDL administrators and trusted service maintenance remain outside source compatibility attestation. No cloud migration is authorized here.

```powershell
$env:PGLITE_RUNTIME_ROOT='C:/Users/User/OneDrive/文件/ChatGPT/CaCalLab/local-uat/CoCalLab-UAT-LOCAL-01/tooling/sql-runtime'
node --test --test-concurrency=1 backend/tests/integration/document-deletion-sql.test.js backend/tests/integration/document-deletion-http.test.js
```

Initial RED on pre-005 source: `node --test backend/tests/integration/document-deletion-sql.test.js` failed with `Missing expected rejection` because ordinary authenticated legacy Storage deletion succeeded. New fixtures retain the direct-API assertion and add broad-policy, scope/role, reference-ordering, uppercase UUID/unknown report history, exact bucket binding, partial failure, missing/orphan/duplicate originals, private authority, lost-response, immutable mode, locate and processing-lease cases. **Independent SQL-connection contention/lock-wait races remain NOT_RUN**; sequential ordering and the adapter's serialized connection are not concurrency proof. Cloud, real Storage generation behavior, production restore/migration and deployment remain unverified; publication HOLD.
