# Infrastructure Verification Report — 2026-11-02

## Freeze and authority
Inventory baseline: `60677af8726e21033bda6302964a08386a7f46fe`, branch `docs/pc-agent-resource-inventory-20261102`.
Read first: PC_AGENT_RESOURCE_INVENTORY_20261102.md, README.md, AI_COLLABORATION.md, docs/PROJECT_OVERVIEW.md at that exact revision.
Existing UAT source baseline remains `7dccd5452152f2495d10ad1437d5d03215166065`. These are DIFFERENT application trees: `git diff --stat 7dccd545 60677af -- backend frontend` reports 92 changed paths. Inventory branch has 27 migrations; UAT baseline has 32. Do not deploy inventory branch in place of reviewed fixes. PR #6 candidate `4c34924b…` remains a separate proposed supplement, not an automatic baseline change.

Ruling: PARTIALLY VERIFIED; release HOLD. No cloud mutation, new project, migration execution, production deployment or secret access performed.

## Evidence ledger
All paths below refer to inventory baseline unless otherwise stated. Commands used: git fetch fixed SHA; git show SHA:path; git ls-tree -r --name-only SHA; git grep -l/n; git diff between the two pinned revisions. These establish source evidence, not live deployment.

| Item | Status | Actual evidence and limit |
|---|---|---|
| GitHub source and handover | VERIFIED | Exact commit fetched; three entrypoint documents and inventory read. README identifies backend/, frontend/readdy-app/, docs/ and excluded .env/.temp. |
| Supabase project existence | VERIFIED (inherited operator evidence) | Inventory reports connected-account listing: CaCalLab 架構指示稿 (via Readdy), ref wynqnvidepzzcwutexvn, ap-northeast-1, ACTIVE_HEALTHY. This run did not independently query the account. |
| Supabase code binding | UNVERIFIED | src/lib/supabase.ts uses VITE_PUBLIC_SUPABASE_URL and VITE_PUBLIC_SUPABASE_ANON_KEY. git grep of candidate ref finds ONLY the inventory document. Runtime build values, browser requests and project role are unavailable. Absence of hardcoded ref is not proof of mismatch. |
| Schema/migrations | VERIFIED source / UNVERIFIED live | 27 tracked SQL migrations in backend/supabase/migrations at inventory SHA; live catalog/applied history not obtained. No migration run. |
| RLS | VERIFIED declarations / UNVERIFIED live | Historical SQL policies exist; candidate live enabled/forced flags, policies, effective ACLs and additional grants not queried. Source fixes on PRs are not proof candidate project is patched. |
| Edge Functions | VERIFIED source / UNVERIFIED deployment | Ten index.ts entrypoints: adjustment-rule-result, analytics-emissions, classify-document, confirm-draft, create-organization, enforce-subscription-status, generate-report, process-document, recalculate-project, run-ai-audit. Live function versions/configuration and JWT/CORS behavior unknown. |
| Cloudflare Pages | UNVERIFIED | No tracked Cloudflare/wrangler config found by path scan. No account-management tools available in this session. Prior dashboard attempt reached sign-in; no authenticated project listing. Do not label cloud project absent. |
| Railway | UNVERIFIED | Owner reports paid Railway account. No Railway hosting config found in tracked path scan; paid subscription does not establish project binding. |
| Runway | UNVERIFIED | Distinct AI-media provider; no integration/config path found. Do not substitute it for Railway. |
| Readdy provenance | VERIFIED source | README calls frontend/readdy-app a Readdy Vite/React export; .env excluded. |
| Readdy backend integration | PARTIAL / UNVERIFIED live | Supabase client/service code exists; actual hosted build, environment binding, authenticated flow and deployment SHA not observed. |
| Resource verification access | BLOCKED | No Supabase, Cloudflare or Railway account-management tools exposed; Windows-local/private operator records unavailable. No credentials requested or guessed. |

## Functional reality: inspected failures and gaps
This is version-scoped source inspection, not business E2E. The inventory commit retains old behavior that was subsequently addressed in the unmerged review sequence; do not mislabel it as a regression in UAT SHA.

| Function | Classification | Evidence |
|---|---|---|
| OCR/LLM | MOCK | backend/src/providers/index.js imports only MockOcrProvider/MockLlmProvider; unsupported real providers throw. |
| Organization edit | BROKEN/stub | EditOrganizationPage.tsx:38,86 TODO read/update; simulated delay and navigation. |
| Project edit | PARTIAL/BROKEN | EditProjectPage.tsx:43,110 placeholder queries/update. |
| Report summary/snapshot | MOCK fallback / PARTIAL | reportSnapshotService.ts:18,45–69 imports and substitutes mockEmissionsSummary. |
| Report completion | PARTIAL / misleading count | reportService.ts:45 fixed total_sections:10 despite absent report_sections. |
| Product-carbon / AI-governance | MISSING implementation in routed app | router/config.tsx routes to NotFoundPage. |
| Analytics/adjustment contract fixes | Missing from this inventory application tree | Diff vs 7dccd545 shows absence of analyticsContract.ts/adjustmentContract.ts and reviewed service/UI changes. |
| Procurement/19+1 commercial workflow | UNVERIFIED delivery | No business UAT, signed requirements, tenant/advisor model or complete procurement evidence supplied. Prior source handover records these gaps; do not treat generic organizations or demo charts as delivery. |
| Export, real AI, recovery and operational acceptance | UNVERIFIED | No executable cloud/browser acceptance evidence supplied in this run. |

### Exhaustive mock-marker source candidates
The following is the complete case-insensitive tracked source-file search result for "mock" within frontend/readdy-app/src and backend/src. It is an evidence index, NOT a claim every occurrence is an active mock feature (some are labels or defensive comments). Each must be traced to runtime call sites before a definitive per-feature completion claim.

- backend/src/contracts/frontend-examples.ts
- backend/src/providers/index.js
- backend/src/providers/mock-llm-provider.js
- backend/src/providers/mock-ocr-provider.js
- frontend/readdy-app/src/components/feature/GovernanceBanner.tsx
- frontend/readdy-app/src/components/layout/AdminLayout.tsx
- frontend/readdy-app/src/contexts/AuthContext.tsx
- frontend/readdy-app/src/i18n/local/en/cocal.ts
- frontend/readdy-app/src/i18n/local/ja/cocal.ts
- frontend/readdy-app/src/i18n/local/zh/cocal.ts
- frontend/readdy-app/src/mocks/activities.fixture.ts
- frontend/readdy-app/src/mocks/carbonAdjustments.fixture.ts
- frontend/readdy-app/src/mocks/reports.fixture.ts
- frontend/readdy-app/src/pages/admin/activities/EmissionActivitiesListPage.tsx
- frontend/readdy-app/src/pages/admin/activities/EmissionActivityDetailPage.tsx
- frontend/readdy-app/src/pages/admin/ai-governance/AIGovernancePage.tsx
- frontend/readdy-app/src/pages/admin/analytics/EmissionsAnalyticsPage.tsx
- frontend/readdy-app/src/pages/admin/carbon-adjustments/CarbonAdjustmentsPage.tsx
- frontend/readdy-app/src/pages/admin/carbon-adjustments/components/ApplicationsTab.tsx
- frontend/readdy-app/src/pages/admin/carbon-adjustments/components/CertificatesTab.tsx
- frontend/readdy-app/src/pages/admin/carbon-adjustments/components/EmissionsSummaryPanel.tsx
- frontend/readdy-app/src/pages/admin/carbon-adjustments/components/ItemsTab.tsx
- frontend/readdy-app/src/pages/admin/carbon-adjustments/components/RuleResultTab.tsx
- frontend/readdy-app/src/pages/admin/emission-factors/EmissionFactorsPage.tsx
- frontend/readdy-app/src/pages/admin/emission-factors/FactorSourcesPage.tsx
- frontend/readdy-app/src/pages/admin/organizations/EditOrganizationPage.tsx
- frontend/readdy-app/src/pages/admin/product-carbon/ProductCarbonPage.tsx
- frontend/readdy-app/src/pages/admin/reports/ReportCenterPage.tsx
- frontend/readdy-app/src/pages/admin/reports/ReportGenerationHistoryPage.tsx
- frontend/readdy-app/src/pages/admin/subscription/SubscriptionManagementPage.tsx
- frontend/readdy-app/src/pages/home/components/DocumentIntelligenceSection.tsx
- frontend/readdy-app/src/services/adjustmentService.ts
- frontend/readdy-app/src/services/analyticsService.ts
- frontend/readdy-app/src/services/fixtureService.ts
- frontend/readdy-app/src/services/reportSnapshotService.ts
- frontend/readdy-app/src/types/activity.ts
- frontend/readdy-app/src/types/carbonAdjustment.ts

## Missing predeployment environment evidence
MISSING means required evidence not supplied, not that the cloud resource is proven nonexistent.
- Identified authorized account/project/environment owner and classification of candidate Supabase data (synthetic vs real); current users and upstream dependencies.
- Runtime frontend URL and actual build SHA; non-secret project URL binding evidence; authenticated browser request target.
- Read-only live schema/table/constraint/policy inventory, applied migration ledger and comparison against selected code SHA.
- Live Edge versions and secure configuration inventory (names only), JWT enforcement, exact staging CORS origins.
- Cloudflare account/Pages identifier, current plan/usage, preview access policy, domain and environment binding.
- Railway project/service/environment identifiers or explicit confirmation it is unused; Runway remains a separate question.
- Backup availability, retention, storage coverage and isolated restore target with a tested recovery procedure.
- Versioned release artifact, staging tests, representative business acceptance, monitoring, costs and rollback.

## OWNER_ACTION_REQUIRED / next actions
1. Authorized operator provides read-only account evidence for candidate Supabase, Cloudflare and Railway. Share identifiers, versions, plan/usage and evidence locations, not secrets or customer content.
2. Classify CoCalLab Supabase: existing independent project is NOT automatically disposable UAT. Until classified, prohibit reset/seed/migration.
3. Choose the application candidate explicitly: inventory SHA is documentation input, UAT SHA is reviewed source. Reconcile prerequisites/PRs through review, not a forced checkout or silent merge.
4. Prepare a scoped staging change proposal: exact migrations/functions, dry-run differences, data preflight, recovery target, lock/version requirements, incremental costs and approval boundary.
5. Four real acceptance groups remain BLOCKED/NOT_RUN where environment access is missing: browser logout/reload/storage failures; JWT/RPC; Storage isolation; migration/restore.
6. Continue local fixes and test preparation that do not depend on account access; do not repeat H0 wholesale. Do not claim old unit/CI results were rerun for this documentation-only verification.

## Engineering progress
This report completes source/intake verification and records cloud access blockers. It does not complete live infrastructure verification. Existing F1–F6 source closure, N1 source correction and N2 accepted-with-boundaries remain bounded to their reviewed SHAs. Production authorization remains absent. Return operator evidence into this ledger; update only changed rows with timestamps, environment, source and result.
