# CoCalLab Ver66 P0 Containment Integration Review

Date: 2026-05-30

Scope:
- Canonical source: GitHub repo `juliushsu/CoCalLab`, commit `e9b8ed977ad075a0c71be0a270c123f937fcb537`
- Readdy package reviewed: `/Users/chishenhsu/Downloads/CaCalLab-Ver066`
- Canonical frontend comparison path: `frontend/readdy-app`
- Mode: review only. No merge, no business logic change, no schema change, no feature addition.

## Executive Verdict

Ver66 improves several Ver65 P0 containment issues, but it is not safe for direct package merge.

Selective merge is possible only if we cherry-pick the containment hunks and explicitly exclude package-level hazards. The package still contains `.env`, does not include canonical `package-lock.json`, would delete `auto-imports.d.ts` if copied wholesale, still lacks a `/admin/documents` redirect, and still leaves `/admin/ai-governance` reachable by direct URL for any authenticated user.

Recommendation: conditional selective merge after Readdy fixes remaining P0/P1 items, or manually cherry-pick only the safe UI/i18n/report-copy hunks.

## 1. Security / Package Hygiene

| Check | Result | Severity | Notes |
| --- | --- | --- | --- |
| `.env` present | Fail | P0 | Ver66 root still contains `.env` (`146 bytes`). Do not merge or copy package root. |
| Secret-like files | Fail/P0 by `.env` | P0 | No other obvious `*secret*`, `*key*`, or `*token*` files found in max-depth scan, but `.env` alone is a blocker. |
| `package-lock.json` | Risk | P0 | Canonical `frontend/readdy-app/package-lock.json` exists, but Ver66 package omits it. Wholesale sync would delete lockfile. |
| `.gitignore` | No Ver66 change | Low | Ver66 package has no `.gitignore`; canonical root `.gitignore` must be preserved. |
| `auto-imports.d.ts` | Risk | P1 | Canonical frontend contains `auto-imports.d.ts`; Ver66 package omits it. Wholesale sync would delete it. |
| `package.json` | No diff found | Low | Ver66 `package.json` matches canonical frontend package in this comparison. |

Conclusion:
- Full package merge is blocked.
- Selective merge must explicitly exclude `.env`, preserve `package-lock.json`, preserve `.gitignore`, and preserve `auto-imports.d.ts`.

## 2. Broken Route Fix

| Check | Result | Severity | Notes |
| --- | --- | --- | --- |
| Sidebar Documents route | Pass | P0 fixed | `AdminLayout.tsx` changed Documents from `/admin/documents` to `/admin/documents/upload`. |
| `/admin/documents` route exists | Fail | P1 | Route config still has no `/admin/documents` route. Direct URL still falls through to NotFound. |
| Redirect needed | Yes | P1 | Add explicit redirect from `/admin/documents` to `/admin/documents/upload` or `/admin/documents/list`. |
| Documents list route | Exists | Low | `/admin/documents/list` exists. |
| Draft route | Exists | Low | `/admin/documents/drafts` exists. |

Verdict:
- The sidebar P0 is fixed.
- The route-level containment is incomplete because old links/bookmarks to `/admin/documents` still 404.

## 3. Product CFP / CBAM Gating

| Check | Result | Severity | Notes |
| --- | --- | --- | --- |
| Sidebar Product CFP | Pass | P0 fixed | Product CFP is now `path: '#'`, `comingSoon: true`. |
| Sidebar CBAM | Pass | P0 fixed | CBAM remains `path: '#'`, `comingSoon: true`. |
| `/admin/product-carbon` direct URL | Partial pass | P1 | Route now renders `NotFoundPage`, so it is not an active workflow. |
| Product CFP workflow file | Still present | P1 | `ProductCarbonPage.tsx` still exists and imports Product CFP DTO/stub types. Do not merge as an active page. |
| Report Center Product CFP card | Mostly safe | P2 | `REPORT_TYPES` still contains Product CFP route, but capability status marks it `coming_soon` and click only navigates when available. |
| Active CBAM workflow | Pass | Low | No active CBAM route found. |

Verdict:
- Product CFP/CBAM gating is materially improved.
- `/admin/product-carbon` is not productized, but Product CFP code remains in package and should not be treated as canonical workflow.

## 4. Raw Key Cleanup

Targeted keys requested for validation:

| Key Group | zh | en | ja | Verdict |
| --- | --- | --- | --- | --- |
| `reports.previewPage.*` | Present | Present | Present | Fixed for requested keys |
| `reports.statistics.*` | Present | Present | Present | Fixed for requested keys |
| `reports.previewSection.*` | Present | Present | Present | Fixed for requested keys |
| `projects.overview.*` | Present | Present | Present | Fixed for requested keys |
| `projects.fields.project_type` | Present | Present | Present | Fixed |

Static scan result:
- Total static `t('...')` usages scanned: 1,132
- Unique translation keys referenced: 815
- Missing or incomplete keys: 169
- Missing in all locales: 106
- Partial locale gaps: 63

Remaining missing / partial keys by prefix:

| Prefix | Count | Risk |
| --- | ---: | --- |
| `activities.*` | 36 | P0 if Activity Detail remains reachable |
| `documents.*` | 40 | P0/P1 |
| `organizations.*` | 42 | P1 |
| `drafts.*` | 12 | P1 |
| `subscription.*` | 12 | P2 |
| `status.*` | 6 | P1 |
| `projects.*` | 6 | P1 |
| `common.*` | 5 | P1 |
| `auth.*` | 6 | P2 |
| `reports.*` | 2 | P1 |
| `audit.*` | 1 | P2 |

Representative high-risk remaining keys:
- `activities.verifySuccess`
- `activities.detailPage.verifyButton`
- `activities.detailPage.recalculateButton`
- `activities.detailPage.editButton`
- `activities.warnings.pendingInclusion`
- `activities.fields.activityDate`
- `activities.fields.emissionScope`
- `activities.verifyDialog.*`
- `documents.orgNotFound`
- `documents.selectProject`
- `documents.steps.uploading`
- `documents.steps.processing`
- `documents.processingStatus.pending`
- `documents.processingStatus.completed`
- `projects.workspaceOrgNote`
- `projects.fields.siteFacility`
- `projects.betaNoticeDesc`
- `reports.generateProgress`
- `reports.exportDialog.title`

Verdict:
- Requested report/project raw key cleanup is successful.
- Ver66 still has high-risk raw keys in Activity Detail and Documents.
- If Activity Detail remains reachable, raw key cleanup is not complete enough for guided beta.

## 5. Report Reality

| Check | Result | Severity | Notes |
| --- | --- | --- | --- |
| Report Preview downgraded | Pass | Low | Adds staging preview disclaimer: not official filing, internal review only, no complete sections. |
| Report History downgraded | Pass | Low | Adds snapshot trust signal and AI audit disclaimer. |
| Report Center warning | Partial pass | Medium | Beta/governance warning exists, but carbon-adjustment summary still uses mock fixture values. |
| Export clarity | Partial pass | Medium | Export dialog disables PDF/Word/HTML choices and says export unavailable, but the header button still says "Export Report" and opens a modal. |
| Compliance claim risk | Reduced, not eliminated | Medium | Report copy has disclaimers, but i18n still contains report type descriptions mentioning GHG Protocol / ISO 14067. Product/ESG/IFRS cards must stay disabled. |
| `report_sections` reality | Unchanged | High | `reportService.ts` still states `report_sections` does not exist and returns empty sections. |

Verdict:
- Report reality containment is improved and is selectively mergeable as UI/copy.
- Export should be visually disabled or renamed to "Export unavailable" to avoid creating a false expectation.
- Report Center should avoid displaying mock carbon-adjustment totals as if they are report-ready outputs.

## 6. Regression Risk

### Routes

No new active routes were added. Product CFP route was downgraded to `NotFoundPage`.

Remaining route risks:
- `/admin/documents` still 404s instead of redirecting.
- `/admin/ai-governance` remains protected only by login through `ProtectedRoute`.
- `/admin/emission-factors/sources` remains active and mock-heavy.
- `/admin/activities/:activityId` remains active and still has mock / untranslated detail-page risk.

### Entity / DTO / Type Risk

Ver66 changes type files:
- `src/types/activity.ts`
- `src/types/report.ts`
- `src/types/organization.ts`
- `src/types/project.ts`

These changes mostly remove Readdy UI compatibility fields that canonical frontend currently carries. This may be an attempt to move closer to DB schema, but it is not safe to merge without type-checking the full frontend because many pages still reference UI compatibility fields.

Examples:
- `activity.ts` removes UI compatibility fields such as `emission_scope`, `emission_factor_name`, `source_document_name`, `metadata`, and other detail-page fields.
- `report.ts` removes report-section compatibility fields such as `report_id`, `section_title`, `ai_prompt_used`, `section_status`, and report metadata fields.
- `organization.ts` removes contact/address/industry UI fields.
- `project.ts` removes `ProjectType`, `legal_entity_id`, `site_id`, and other UI/form fields.

Verdict:
- Do not merge type/DTO file changes in this sprint unless the frontend passes type-check and the removed fields are confirmed unused.
- Readdy should not independently redefine canonical DTOs. DTO changes need canonical approval.

### AI Governance

Sidebar visibility is platform-only, but direct route access remains possible for any authenticated user because `ProtectedRoute` checks only `user`, not role.

Risk: P0/P1 depending on beta account roles.

Required fix:
- Add route-level role guard or replace route with `NotFoundPage` / disabled placeholder for non-platform builds.

## A. Files / Hunks That Can Be Selectively Merged

Safe or mostly safe if cherry-picked manually:

| File | Merge Scope | Notes |
| --- | --- | --- |
| `frontend/readdy-app/src/components/feature/ValueChainProgress.tsx` | Full file | Aligns with canonical value chain. |
| `frontend/readdy-app/src/components/feature/BetaFeedbackButton.tsx` | Full file | Useful closed-beta feedback entry point. |
| `frontend/readdy-app/src/components/layout/AdminLayout.tsx` | Partial hunk | Merge Documents route fix and Product CFP/CBAM coming-soon gating. Preserve final newline. |
| `frontend/readdy-app/src/router/config.tsx` | Partial hunk | Merge `/admin/product-carbon -> NotFoundPage`; do not accept misleading AI Governance comment as a real guard. |
| `frontend/readdy-app/src/i18n/local/zh/cocal.ts` | Partial hunk | Merge report/project closed-beta raw key additions. |
| `frontend/readdy-app/src/i18n/local/en/cocal.ts` | Partial hunk | Merge report/project closed-beta raw key additions. |
| `frontend/readdy-app/src/i18n/local/ja/cocal.ts` | Partial hunk | Merge report/project closed-beta raw key additions. |
| `frontend/readdy-app/src/pages/admin/reports/ReportPreviewPage.tsx` | Partial hunk | Merge staging preview disclaimer, no-section disclaimer, export-unavailable modal. Consider disabling/renaming export button. |
| `frontend/readdy-app/src/pages/admin/reports/ReportGenerationHistoryPage.tsx` | Partial hunk | Merge snapshot/AI audit disclaimer. |
| `frontend/readdy-app/src/pages/admin/projects/ProjectOverviewPage.tsx` | Partial hunk | Merge beta/value copy only if keys are complete. |
| `frontend/readdy-app/src/pages/admin/activities/EmissionActivitiesListPage.tsx` | Partial hunk | Merge value/data-origin cues only; do not rely on Activity Detail. |
| `frontend/readdy-app/src/pages/admin/analytics/EmissionsAnalyticsPage.tsx` | Partial hunk | Merge mock/source labeling only after visual review. |

## B. Files That Must Not Be Merged As-Is

| File / Path | Reason |
| --- | --- |
| `.env` | P0 package hygiene blocker. |
| Missing `package-lock.json` from Ver66 package | Do not delete canonical lockfile. |
| Missing `auto-imports.d.ts` from Ver66 package | Do not delete canonical generated type file without build-system review. |
| `frontend/readdy-app/src/types/activity.ts` | Removes compatibility fields; type/regression risk. |
| `frontend/readdy-app/src/types/report.ts` | Removes compatibility fields; report preview/regeneration type risk. |
| `frontend/readdy-app/src/types/organization.ts` | Removes UI fields; organization edit/list regression risk. |
| `frontend/readdy-app/src/types/project.ts` | Removes project form fields including legal_entity/site placeholders; canonical approval needed. |
| `frontend/readdy-app/src/pages/admin/product-carbon/ProductCarbonPage.tsx` | Product CFP remains out of closed-beta scope. |
| `frontend/readdy-app/src/pages/admin/emission-factors/FactorSourcesPage.tsx` | Still mock-heavy source governance; not part of containment success. |
| `frontend/readdy-app/src/pages/admin/activities/EmissionActivityDetailPage.tsx` | Still mock/raw-key heavy and should not be beta-facing. |
| Ver66 package root copy | Would introduce `.env` and delete canonical files if synced wholesale. |

## C. Still Required Readdy Fixes

P0:
1. Remove `.env` from package handoff.
2. Preserve canonical `package-lock.json`; do not ship packages that imply lockfile deletion.
3. Add route-level AI Governance guard or make `/admin/ai-governance` NotFound/disabled for beta tenant accounts.
4. Hide or fix Activity Detail because it still has mock behavior and missing keys.

P1:
1. Add `/admin/documents` redirect to `/admin/documents/upload` or `/admin/documents/list`.
2. Finish remaining document upload/list raw keys across zh/en/ja.
3. Finish organization/workspace raw keys that affect member/workspace comprehension.
4. Rename or disable the Report Preview export button so users do not think PDF export is available.
5. Keep Factor Sources / Source Governance hidden or internal-only until canonical API exists.
6. Do not merge DTO/type deletions until type-check passes.

P2:
1. Clean remaining Readdy image `seq=cacallab-*` identifiers in landing assets.
2. Keep report type descriptions from implying implemented ISO/GHG workflows when cards are disabled.

## D. Merge Recommendation

Do not merge Ver66 as a package.

Selective merge recommendation: Yes, but only after manual cherry-picking and two extra containment fixes:
1. Add `/admin/documents` redirect.
2. Add route-level AI Governance protection or disable the route.

If those two fixes are not included, merge only the safest UI atoms and i18n additions:
- `ValueChainProgress`
- `BetaFeedbackButton`
- report/project i18n keys
- report staging-preview copy
- sidebar Product CFP/CBAM coming-soon hunk

## E. Minimal Merge Plan

1. Create a canonical frontend branch from GitHub `main`.
2. Do not copy Ver66 root. Never include `.env`.
3. Preserve:
   - `frontend/readdy-app/package-lock.json`
   - root `.gitignore`
   - `frontend/readdy-app/auto-imports.d.ts`
4. Cherry-pick only approved containment hunks:
   - Documents sidebar route to `/admin/documents/upload`
   - Product CFP sidebar coming soon
   - `/admin/product-carbon` route to NotFound
   - value-chain and feedback components
   - report staging/internal-review copy
   - requested report/project i18n keys
5. Add missing containment fixes before merge:
   - `/admin/documents` redirect
   - route-level AI Governance guard
6. Exclude DTO/type deletions unless type-check proves safe.
7. Run before merge:
   - install using canonical lockfile
   - `npm run type-check`
   - `npm run lint`
   - `npm run build`
   - closed-beta smoke test for login, workspace, project, document upload, draft, activity list, analytics, report history/preview, permission denied, beta warning.

## Final Decision

Ver66 is a useful containment iteration, not a merge-ready package.

Status:
- Full merge: No
- Selective merge: Conditional
- Immediate blockers: `.env`, AI Governance direct route, no `/admin/documents` redirect, remaining high-risk raw keys
- Safest value to bring forward: value-chain visibility, beta feedback, report reality disclaimers, Product CFP/CBAM sidebar gating, requested report/project i18n cleanup
