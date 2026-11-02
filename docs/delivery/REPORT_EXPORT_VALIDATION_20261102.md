# Report export local validation and authorization decision

## Fixed inputs and workspace

- Feature candidate: PR #9, `1e93fee26e6d07a28e85089325ae5afa75d36160`, branch `feat/report-export-v1-20261102`; open and unmerged when inspected.
- UAT remains `7dccd5452152f2495d10ad1437d5d03215166065`. Its clean detached checkout under `CaCalLab/local-uat/CoCalLab-UAT-LOCAL-01/source` was only read, not switched or modified.
- Development uses a separate checkout `CoCalLab` under the current writable workspace, branch `codex/report-export-validation-20261102`. Initial HEAD exactly matched PR #9, with no local changes. Remote candidate matched the owner-supplied SHA. No main merge, deployment or acceptance is implied.
- Read `AI_COLLABORATION.md`; no applicable repository `AGENTS.md` was found. No Docker, WSL, cloud database, real account, production environment file or seed was used.

## Changes and actual results

Existing HTML/JSON formatting is retained. A shared download routine and a scoped persisted reader now support meaningful isolated tests. Tests use actual Supabase SDK request serialization with an injected synthetic transport; they do not contact Supabase and do not establish real RLS behavior.

- Exact report/project/organization filters, completed status, user Authorization header and field allowlist verified.
- Empty row, 403 permission denial, 503 read failure and mismatching response identities reject without saving a file. No fixture fallback was added.
- A deferred read invalidated by report/session/subscription switching does not download. This tests the shared operation and invalidation predicate, not a mounted authenticated React E2E.
- Both HTML and JSON are actually written and re-read in an isolated temporary test directory. HTML shows 2250 kgCO2e / 2.25 tCO2e; JSON preserves 1500 kg for scope_1. Missing totals/categories remain unknown. All data is marked synthetic and confined to tests.
- Frontend tests: **63/63 PASS** (57 existing + 6 new). Type-check, full ESLint with zero warnings and Vite build PASS on Windows, Node 24.22.1. The initial sandbox Vite attempt failed to read ancestor directories; the same local build succeeded on the host without changing security policy. Existing lockfile was used by npm 10.9.4, with install scripts disabled; no project dependency changes.
- Browser fixture: `frontend/readdy-app/tests/browser/report-export.html`, served only on 127.0.0.1:5319. Chrome displayed both synthetic download controls and the corresponding download-request notices after clicks. **Actual browser file saving remains UNVERIFIED**: the download event timed out and the targeted default Downloads filename was absent. Access to chrome://downloads was rejected by browser URL policy; no alternate surface or workaround was used. No download SUCCESS or authenticated browser UAT is claimed.

## Export authorization is BLOCKED, not implemented by SELECT

PR #9 review identified that ordinary active membership SELECT access is not the repository's conditional export entitlement. Evidence:

- `docs/closed-beta/CLOSED_BETA_PERMISSION_MATRIX.md`, role table: export testing disabled by default for tester, conditional for consultant/internal QA, audited for platform support.
- `backend/supabase/migrations/202603160001_v1_core_schema.sql`, `report_generations_select_policy`: active membership grants report SELECT. It does not encode those separate export conditions.
- `backend/supabase/functions/_shared/authz.ts`: existing read/write authorization, no export-entitlement operation.
- `frontend/readdy-app/src/hooks/useSubscriptionStatus.ts`: error fallback is active, so export must also reject loading/error rather than infer permission.
- Existing subscription documentation preserves read operations; PR #9 removed the prior export readonly guard. Whether downloads count as these permitted reads requires an explicit CTO ruling; this change preserves the stricter existing restriction pending that ruling.

The production download UI and service currently fail closed with an explicit unavailable reason. Loading, subscription errors and readonly status are also denied. There is no client feature flag, mock approval, assumed owner-role grant or test path that enables production downloads. The test fixture uses only the shared formatter/download helper and is not linked into application routes or the production build.

### Concrete CTO decision request

1. Define export eligibility by existing tenant role/workspace assignment, subscription state, environment and test provenance; specify whether readonly may download.
2. Choose whether current report SELECT legitimately includes unrestricted snapshot downloads, or approve a separate server-enforced export entitlement. The current closed-beta matrix supports the latter; do not silently redefine it in frontend code.
3. If separate entitlement is required, assign backend owner to an authenticated, read-only export endpoint using resolved report/project/organization and explicit policy. Test viewer, inactive, cross-tenant, readonly/error, platform-support and assigned-test cases. Any needed cloud permission/schema application is a separate approval; none was applied here.

Impact: only report-download activation is held. HTML/JSON formatting and isolated validation remain usable, normal report preview remains readable, and activity-detail work can proceed. Reversal is an ordinary source revert of this guard proposal on the feature branch; it must not be used to enable the unclosed authorization behavior in production. No data migration or recovery is needed.

## Next

Proceed with real read-only activity detail and current calculation snapshot. Export server entitlement, authenticated React/browser downloads and real tenant-denial tests remain separately pending. UAT baseline unchanged.
