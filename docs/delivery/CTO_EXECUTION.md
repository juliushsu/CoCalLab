# CTO delivery queue — 2026-10-31

## Authority and baseline

Owner authorized CTO-led implementation and small agent teams on 2026-10-31. The owner handles Ministry of Economic Affairs discussions. This authorizes source changes, isolated local verification and reviewable feature PRs; it does not approve commercial claims, spending, production data changes or a production launch.

Source baseline: `0a90b7b9b499ae382c17293b7dd674b09b0ef020`. H0 handover: PR #1 at `39d15df9d1ef9b8dc24ca1cd0c553e415405b1f1`. H0 is an input, not a request to repeat the full audit. PR #1 remains separate from implementation. Work runs in a Linux container; these results must not be described as Windows PC verification.

## Operating rules

- One integration owner maintains the queue and assigns disjoint file ranges. A separate agent reviews contract, tenant and failure boundaries.
- Finish a change, run relevant tests and integrate its evidence, then continue to the next unblocked item. Do not stop merely to request permission for reversible local fixes.
- Never substitute fixtures for failed or empty production reads. Pure adapter tests and an offline SDK test do not establish cloud persistence or authenticated business E2E.
- Keep credentials and company data out of the public repository. Do not replay seed/purge scripts against unclassified resources.
- Owner decisions stop only dependent work. Keep unrelated local implementation moving.
- Session execution is finite. Preserve the branch, results and next command here rather than claiming indefinite background execution.

## Queue and exit evidence

| Order | Work | Exit evidence |
| --- | --- | --- |
| 1 | Analytics, adjustment eligibility, report snapshots and POST/GET transport | Canonical fields and kg/t tests, real SDK request serialization, explicit error/empty UI, selected organization/project |
| 2 | Restore lint gate and source CI | No disabled rules; frontend test/type/lint/build plus backend test workflow |
| 3 | Organization/project editing | Allowlisted persisted fields, user-JWT queries, immutable tenant/lifecycle fields, real isolated RLS deny tests; cloud reload remains pending |
| 4 | Existing report data accuracy | No fabricated completed sections, consistent units and error states |
| 5 | Isolated full-stack acceptance | Fresh migration chain, upgrade/recovery, tenant/role/storage/RPC deny cases, document→review→calculation→snapshot persistence |
| 6 | First procurement workflow | Owner-confirmed requirements→quote comparison→human decision→evidence; reuse organizations/projects |
| 7 | Real AI and report export | Approved data/budget boundary, timeout/quota/human review, versioned export that opens correctly |
| 8 | SaaS launch candidate | Representative user acceptance, backup/restore, monitoring, immutable artifact, costs and rollback; owner approves launch |

## Decisions to present when their dependent work is ready

1. First paying workflow, representative acceptance owner and required report. The proposed procurement loop is requirements→quote comparison→human decision→evidence; the 19+1 customer/advisor access model still needs confirmation. Carbon inventory alone does not silently replace procurement scope.
2. Isolated staging ownership, authorized data, AI provider and budget cap. No production credentials are needed for local source repairs.
3. Brand/domain, pricing/support responsibilities and final launch approval, with a tested version, cost and rollback proposal.

Production release remains **HOLD** until corresponding evidence and owner decisions exist. Local development remains authorized.

## Current implementation checkpoint

Implemented on `codex/saas-contract-fixes-20261031`: the three read contracts and visible error/empty states, real SDK JSON transport fix, organization/project profile editing, scoped organization RLS migration and field guard, truthful report units/section counts, credential-free login source, unconfigured signed-out state, and a source verification workflow. Source changes remain proposed until the feature PR is integrated. The organization migration has not been applied to any cloud database.

The isolated PostgreSQL test uses synthetic data and a test `auth.uid()` function. It verifies the new organization policy using the core schema, staging-column migration and new profile migration, not the complete migration chain or real Supabase authentication. See `backend/tests/integration/README.md` for its exact command and limits.

Still unverified: authenticated browser/business E2E, real cloud write/reload, all-migration upgrade/recovery, Storage and privileged RPC tenant denial, real AI, export delivery and commercial acceptance. Browser smoke could not run because this environment lacked a working Chromium executable and the attempted runtime download failed; no browser PASS is claimed.

Next unblocked technical work is isolated full-stack/migration acceptance and remaining real workflow gaps. Before building the procurement domain and connecting paid AI/customer data, obtain decisions 1–2 above. Existing UI navigation still uses a mock role; it must be replaced by scoped membership before SaaS release. Removing source login shortcuts does not rotate credentials or erase prior Git history; resource-owner remediation remains separate.

## Verification and runtime configuration

Node 24.22.1 local verification: backend unit tests 16/16; frontend contract/adapter/SDK/CORS tests 35/35; type-check, lint (zero warnings) and Vite build pass. Isolated organization PostgreSQL policy tests: 13 child cases pass (14 including the test container). `git diff --check` passes. These results are local; GitHub CI and Windows runtime are separate evidence.

All ten Edge entry points now use an Origin/method/header preflight wrapper. Set `CORS_ALLOWED_ORIGINS` to comma-separated exact origins (scheme, host and optional port; no path/trailing slash/wildcard) for an authorized staging/release deployment. An absent value permits only localhost/127.0.0.1 on ports 5173/5174; malformed or unreadable configuration fails closed. No production origin has been selected or enabled. CORS does not replace JWT, membership or RLS authorization. Deployment of these handlers still requires the appropriate environment authorization.

Resume commands: `npm test --prefix backend`, `npm test --prefix frontend/readdy-app`, and the verification commands in `.github/workflows/verify.yml`. Install the pinned isolated SQL runtime as documented in `backend/tests/integration/README.md`; do not substitute a cloud database URL. Use this checkpoint and the feature PR diff; do not restart H0.
