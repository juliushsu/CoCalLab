# Readdy Import Analysis

Last updated: 2026-05-08

## Imported source

Source directory:

`/Users/chishenhsu/Downloads/cacallabt-8094808`

Imported destination:

`frontend/readdy-app`

Excluded from import:

- `.env`
- `.env.*`
- `node_modules`
- `dist`
- `.git`
- `.DS_Store`

## App shape

The Readdy export is a Vite/React/TypeScript app with Supabase and Firebase dependencies. It includes admin pages for organizations, projects, documents, emission activities, reports, product carbon, emission factors, analytics, AI governance, carbon adjustments, and subscription management.

Important entry points:

- `frontend/readdy-app/src/router/config.tsx`
- `frontend/readdy-app/src/pages/admin/emission-factors/FactorSourcesPage.tsx`
- `frontend/readdy-app/src/types/emissionFactor.ts`
- `frontend/readdy-app/src/services/*`
- `frontend/readdy-app/src/i18n/local/*/cacal.ts`

## Factor source UI status

`FactorSourcesPage` already exists and includes:

- Dedicated factor source cards.
- A featured source section for special sources such as CFP_P_02.
- Organization-internal source grouping for monitored/org-specific sources.
- Data level filtering using `primary | secondary | hybrid | fallback`.
- Platform-managed source status language.

## Alignment notes

Already aligned:

- `DataLevel` matches the Codex canonical enum: `primary | secondary | hybrid | fallback`.
- The UI separates organization monitoring sources, direct activity data, and organization-specific factors.
- The page has a source status legend that tells tenants updates are platform-managed.

Needs canonical mapping before backend integration:

- Readdy `SourceUpdateStatus` uses `active_latest`, `new_version_detected`, and `legacy_reference`; canonical docs use `active_current`, `newer_version_detected`, and `retained_for_traceability`.
- Readdy `ApplicableModule` uses `ghg_inventory`; canonical docs use `org_inventory`.
- Readdy `ApplicableModule` includes `lca`, `esg_report`, `scope2_market`, and `ifrs_s1_s2`; these may be UI-facing modules but need backend canonical mapping.
- Readdy `FactorSourceType` uses UI-oriented codes such as `official`, `global`, `industry`, `fallback`, `org_specific`, and `monitored`; backend governance proposes more specific source types such as `official_registry`, `official_guideline`, `lca_database`, `supplier_specific`, and `internal_measured`.

Recommended integration path:

1. Keep Readdy display codes where they improve UX, but add a DTO mapper from backend canonical codes.
2. Add explicit mapping tests for source lifecycle, data level, and applicable modules.
3. Do not let the frontend invent factor priority; display `resolution_trace` and platform-provided priority fields.
4. Treat CFP_P_02 as an independently identifiable source card, not as a generic Taiwan factor source.
