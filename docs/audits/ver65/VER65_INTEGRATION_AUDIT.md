# CoCalLab Ver65 Integration Reality Audit

Date: 2026-05-30

Scope:
- Canonical source: GitHub repo `juliushsu/CoCalLab`, commit `b89a99baa6514ff1342edd0ba0baf39ae99a33d4`
- Readdy package audited: `/Users/chishenhsu/Downloads/CoCalLab-Ver065`
- Mode: reality audit only. No merge, no code change, no schema change, no feature addition.

Important canonical note:
- GitHub canonical currently contains `PROJECT_WORLD_MODEL_V1`, `PRODUCT_NARRATIVE_CANONICAL_V1`, `VALUE_MOMENT_CANONICAL_V1`, `READDY_ALIGNMENT_PACK_V1`, and `MULTI_AI_CANONICAL_RULES_V1`.
- The request also references `READDY_HANDOFF_BRIEF_V1` and `BRAND_GOVERNANCE_V1`, but these files are not present in the GitHub canonical repo at the audited commit. They must be treated as local draft references only until committed to GitHub.

## Executive Verdict

Ver65 is visibly closer to the canonical product narrative than earlier Readdy packages. The strongest improvement is value-chain visibility: `Documents -> Draft -> Activity -> Analytics -> Report` is now represented through `ValueChainProgress`, beta feedback entry points, governance banners, data-origin badges, and clearer staging/test-mode framing.

However, Ver65 is not safe to merge as-is. It still contains route drift, active non-beta surfaces, P0 raw i18n keys, mock-heavy report and factor-source pages, an active Product CFP route, a broken sidebar Documents route, and a packaged `.env` file. The recommended path is selective merge after gating and i18n cleanup, not direct merge.

Overall risk: High

## A. Canonical Alignment Audit

| Area | Status | Evidence | Risk |
| --- | --- | --- | --- |
| GitHub as source of truth | Aligned in audit approach | Ver65 was compared to GitHub canonical commit `b89a99b`; local handoff/brand drafts are not treated as binding canonical docs. | Medium |
| Core value chain | Aligned | `ValueChainProgress` explicitly maps Documents, Draft, Activity, Analytics, Report. | Low |
| Product narrative | Partial | UI now emphasizes upload, review, analytics, report, but many pages still expose engineering/platform concepts and mock states. | Medium |
| Readdy allowed scope | Partial | Ver65 improves UI/copy/success/trust signals, which is allowed. It also adds/keeps active route ownership for Product CFP and Factor Sources, which is outside allowed Readdy scope. | High |
| Workspace ontology | Partial | UI labels say Workspace, but code/routes still use `organizations`; Members sidebar points to `/admin/organizations` instead of a concrete members page. | High |
| Legal entity / site | Aligned | Project creation shows disabled placeholders for Reporting Entity and Site / Facility. | Low |
| Product CFP | Drift | `/admin/product-carbon` exists and is in sidebar as an active route. Canonical closed-beta gating requires hidden or coming soon. | High |
| CBAM | Aligned | Sidebar shows CBAM as coming soon `#`; no visible implementation route found. | Low |
| Self Monitoring | Aligned | Sidebar shows coming soon only. | Low |
| Methodology | Aligned/Partial | Methodology route itself is coming soon, but Emission Factors and Source Governance remain active mock-heavy routes. | Medium |
| AI Governance | Partial | Sidebar restricts Platform section to `platform_admin`, but route `/admin/ai-governance` is protected only by login, not an explicit route-level role guard. | High |
| Report validation | Aligned | Validation is coming soon and no formal compliance claim is presented from the sidebar. | Low |
| Brand governance | Partial | Package uses `CoCalLab`, `碳計算實驗室`, `コカラボ`; no `CaCalLab` or `カカラボ` text found. Readdy image query `seq=cacallab-*` remains in landing images. | Medium |
| Data origin / beta warnings | Aligned | `StagingBanner`, `GovernanceBanner`, `DataOriginLegend`, `DataOriginBadge`, `BetaFeedbackButton` exist. | Low |
| Secrets hygiene | Regression | Ver65 package root contains `.env`. This must never be merged. | P0 |

## B. Route Reality Audit

| Sidebar Item | Route | Route Exists? | Page Exists? | Real Data? | Mock / Placeholder? | Reality |
| --- | --- | --- | --- | --- | --- | --- |
| Workspace | `/admin/organizations` | Yes | Yes | Partial Supabase read path | Organization naming drift | Partial |
| Members | `/admin/organizations` | Yes | Wrong target | No member-specific sidebar target | Badge only | Broken/Partial |
| Subscription | `/admin/subscription` | Yes | Yes | Partial usage query | Hardcoded capability gate and mock usage fallback | Partial |
| Projects | `/admin/projects` | Yes | Yes | Partial Supabase read/write | Some edit/update TODOs | Partial |
| Documents | `/admin/documents` | No | No route | No | Sidebar link only | Broken |
| Document Upload | `/admin/documents/upload` | Yes | Yes | Upload + edge functions | Manual entry placeholder | Partial |
| Drafts | `/admin/documents/drafts` | Yes | Yes | Edge function review actions | Depends on draft backend availability | Partial |
| Activities | `/admin/activities` | Yes | Yes | Supabase `emission_activities` list/create | Data origin inferred, detail mocked | Partial |
| Activity Detail | `/admin/activities/:activityId` | Yes | Yes | No | Hardcoded mock activity and TODO API | Not Ready |
| Analytics | `/admin/analytics` | Yes | Yes | `analytics-emissions` edge function | GHG/ISO fallback mock; hotspot mock | Partial |
| Carbon Adjustments | `/admin/carbon-adjustments` | Yes | Yes | Reads `calculation_results`, adjustment tables, rule edge function | Fallback fixtures and mock rule results | Partial |
| Report Center | `/admin/reports` | Yes | Yes | No complete report center API | Hardcoded capability gate, mock summary | Partial |
| Report History | `/admin/reports/history` | Yes | Yes | Reads `report_generations` and `projects`; invokes generate/audit | Snapshot fallback mock | Partial |
| Report Validation | `#` | No | No | No | Coming soon | Aligned placeholder |
| Emission Factors | `/admin/emission-factors/list` | Yes | Yes | No confirmed backend adapter | Mock data comment in page | Not Ready |
| Source Governance | `/admin/emission-factors/sources` | Yes | Yes | No | Mock data aligned to expected schema | Not Ready |
| Self-Monitoring | `#` | No | No | No | Coming soon | Aligned hidden |
| Methodology | `#` | No | No | No | Coming soon | Aligned hidden |
| Product CFP | `/admin/product-carbon` | Yes | Yes | No | Mock stub data | Not Ready, should hide |
| CBAM | `#` | No | No | No | Coming soon | Aligned hidden |
| AI Governance | `/admin/ai-governance` | Yes | Yes | No | Mock data | Platform-only UI, route guard gap |

## C. Value Chain Audit

Canonical value chain:

`Documents -> Draft -> Activity -> Analytics -> Report`

| Stage | Improved in Ver65? | Still Missing | Risk |
| --- | --- | --- | --- |
| Documents | Yes | Sidebar route broken at `/admin/documents`; upload flow has P0/P1 missing i18n keys; manual entry is placeholder. | High |
| Draft | Yes | Review actions depend on edge functions; raw keys and backend availability need verification. | Medium |
| Activity | Partial | Activity list is real-ish, but detail page is hardcoded mock and verify/recalculate are TODO paths. | High |
| Analytics | Yes/Partial | GHG/ISO adapters exist; mock fallback is labeled; hotspot remains mock and unsupported. | Medium |
| Report | Partial | Report history reads real rows; preview lacks persisted sections; center uses mock/hardcoded capability cards. | High |

Value moments now visible:
- User can see the canonical flow as a staged journey instead of isolated pages.
- Beta feedback is available from core surfaces.
- Mock/data-origin language appears on analytics, activities, reports, and carbon adjustments.
- Report Center warns that reports are beta/internal and not formal compliance output.

Value moments still weak:
- Upload success does not reliably communicate "what became usable downstream."
- Draft review does not clearly prove why an extracted field should be trusted.
- Activity creation does not consistently show source document, factor source, and calculation trace as one trust chain.
- Analytics still includes mock hotspot sections that may dilute trust.
- Report Preview can look like a real report while `report_sections` persistence is explicitly absent.

Missing success states:
- Document upload -> extraction queued / extraction complete / draft ready.
- Draft confirmed -> activity created / activity not created with reason.
- Activity verified -> visible recalculation state and audit trace.
- Report generated -> snapshot captured, report sections stored, export availability stated.

Missing trust signals:
- OCR confidence by field, extraction source highlight, and review history.
- Emission factor source citation and factor resolution level.
- Report boundary, reporting entity, site/facility, methodology, and exclusion rationale.
- Compliance disclaimer for EPA Taiwan inventory guidance, ISO 14064, and GHG Protocol.

Missing next-step guidance:
- Documents page should route to upload/list/drafts instead of a broken path.
- After draft review, next action should be activity review or analytics.
- After analytics, next action should be report generation/history.
- After report generation, preview should explain what is snapshot, mock, editable, and non-compliant.

## D. Backend / DTO / Mock Gap Summary

| Module | UI Exists | Backend/Schema/API Reality | DTO Drift / Canonical Risk | Mock Dependency |
| --- | --- | --- | --- | --- |
| Workspace | Yes | Partial organization services | `organization` route/code still carries workspace/legal-entity ambiguity | Medium |
| Members | Yes | Members page exists but sidebar cannot reach a specific workspace members route | Workspace member lifecycle incomplete | Medium |
| Documents | Yes | Upload/list edge function paths exist | Processing/status i18n and data origin need hardening | Medium |
| Draft Review | Yes | Edge function review paths exist | Draft -> activity contract needs canonical confirmation | Medium |
| Activities | Yes | List/create real-ish; detail mock | Activity detail DTO/actions not canonicalized | High |
| Analytics | Yes | `analytics-emissions` adapter exists | Hotspot dimension not canonical API yet | Medium |
| Reports | Yes | `report_generations` read path; no `report_sections` persistence | Report sections/statistics/compliance DTO incomplete | High |
| Factor Sources | Yes | No real adapter found | Source governance ontology may look canonical but is local mock | High |
| Carbon Adjustments | Yes | Some real tables + edge function adapter | Rule engine result still fallback/mock | High |
| AI Governance | Yes | Mock page | Platform-only governance not route-enforced | High |
| Product CFP | Yes | Mock page | Non-canonical workflow should be hidden | High |
| CBAM | No active route | Hidden | No issue if it stays hidden | Low |

## E. Closed Beta Readiness Re-score

| Module | Status | Reason |
| --- | --- | --- |
| Workspace | Partial | Usable as workspace overview, but route/code naming still uses organizations and members navigation is wrong. |
| Documents | Partial | Upload/list flows exist, but sidebar route broken and raw keys remain. |
| Draft Review | Partial | Review UI exists; trust hints and backend contract need verification. |
| Activities | Partial | List/create can be guided; detail is mock and should not be used for beta claims. |
| Analytics | Partial | Core charts have adapter/fallback labels; hotspot remains mock. |
| Reports | Partial | History and generation exist; preview/report sections/compliance are not production-like. |
| Carbon Adjustments | Partial | Useful as internal preview only; still fallback-heavy. |
| Factor Sources | Not Ready | Active but mock/static; should be hidden or clearly internal/demo. |
| AI Governance | Not Ready for testers | Platform-only concept is correct, but direct route lacks route-level role guard. |
| Product CFP | Not Ready | Active mock route; canonical says hide/coming soon. |
| CBAM | Not Ready | Correctly hidden/coming soon; no beta use. |

## F. Governance Risk

P0:
- Ver65 package contains `.env`.
- Active Product CFP route conflicts with closed-beta scope.
- Activity Detail page presents mock activity/verify/recalculate paths behind a real route.
- P0 raw i18n keys can render key strings in visible beta journeys.

P1:
- Workspace remains implemented through `organization` routes and services; this can recreate workspace/legal_entity/site confusion.
- AI Governance is sidebar-hidden for non-platform roles but route-level access is only authentication.
- Report Preview can be mistaken for formal compliance output despite missing `report_sections` persistence and compliance validations.
- Factor Sources and Source Governance look more official than their backend reality.

P2:
- Landing page Readdy image query identifiers still use `seq=cacallab-*`, which violates brand hygiene if treated as brand metadata.
- Several pages expose hardcoded or engineering-oriented labels like API names and mock fallback notes. Useful for staging, but should be controlled for external testers.

## G. Recommended Merge Classification

Can merge after normal review:
- `ValueChainProgress`
- `GovernanceBanner`
- `DataOriginBadge`
- `DataOriginLegend`
- `BetaFeedbackButton`
- Staging/test-mode visibility patterns
- Disabled Legal Entity and Site placeholders in Project creation

Needs adjustment before merge:
- Admin sidebar route for Documents
- Workspace/Members navigation and wording
- Raw key/i18n gaps across core flows
- Report Center capability gate copy and visibility
- Analytics mock hotspot visibility
- Carbon Adjustments mock/fallback labeling and beta gating
- AI Governance route-level authorization or explicit non-tenant hiding

Should not merge as-is:
- Root `.env`
- Active `/admin/product-carbon` route/sidebar exposure
- Active mock-heavy Factor Sources / Source Governance for closed beta
- Activity Detail mock implementation as a normal route
- Any UI copy implying formal EPA Taiwan / ISO 14064 / GHG Protocol compliance

## H. Closed Beta Impact

Most likely to affect first testers:
1. Clicking Documents from sidebar lands on a missing route.
2. Activity Detail appears real but is mock, causing trust loss.
3. Report Preview lacks persisted sections and export implementation, causing report expectation mismatch.
4. Raw keys on report/activity/document/project pages will make the product feel unfinished.
5. Product CFP is visible despite being out of closed-beta scope.
6. Factor Sources appear authoritative despite mock-only data.
7. Workspace vs organization naming may confuse accounting firm / consultant testers.
8. AI Governance could be accessed directly by URL if a logged-in user knows the route.
9. Carbon Adjustments looks advanced but still depends on fallback fixtures and rule-engine mock paths.
10. `.env` in the package creates immediate merge hygiene risk.

## I. Priority and Effort Estimate

| Priority | Work | Estimate |
| --- | --- | --- |
| P0 | Remove `.env` from merge candidate and add package hygiene check | 0.5 day |
| P0 | Hide/gate Product CFP, Factor Sources, AI Governance direct route, and mock Activity Detail for beta | 1-2 days |
| P0 | Fix core raw keys for Documents, Activities, Reports, Projects | 1-2 days |
| P0 | Fix Documents sidebar route to upload/list/drafts decision | 0.5 day |
| P1 | Clarify Workspace/Members route and copy without schema changes | 1 day |
| P1 | Add report non-compliance / snapshot / mock state language consistently | 1 day |
| P1 | Reduce analytics hotspot and carbon adjustment mock exposure | 1 day |
| P2 | Clean brand metadata/image sequence identifiers | 0.5 day |

Estimated stabilization: 1 focused sprint for P0 gating/i18n/route blockers, 2-3 sprints for credible guided closed beta hardening.
