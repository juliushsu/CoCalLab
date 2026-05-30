# Report Template Reality Audit V1

Date: 2026-05-30
Canonical baseline: `24881a800792a3d389e3432b630cac733e49fb76`

Status: canonical report-template audit only. No UI change, no schema change, no PDF implementation, no compliance claim.

## Purpose

This document records the real state of CoCalLab report surfaces before any Readdy report-template work. Readdy must not infer a formal report format from the current UI. Backend and UI work should align to this report-template pack first.

## Source Evidence

Canonical GitHub source references:
- Report Center: https://github.com/juliushsu/CoCalLab/blob/24881a800792a3d389e3432b630cac733e49fb76/frontend/readdy-app/src/pages/admin/reports/ReportCenterPage.tsx
- Report History: https://github.com/juliushsu/CoCalLab/blob/24881a800792a3d389e3432b630cac733e49fb76/frontend/readdy-app/src/pages/admin/reports/ReportGenerationHistoryPage.tsx
- Report Preview: https://github.com/juliushsu/CoCalLab/blob/24881a800792a3d389e3432b630cac733e49fb76/frontend/readdy-app/src/pages/admin/reports/ReportPreviewPage.tsx
- Report read adapter: https://github.com/juliushsu/CoCalLab/blob/24881a800792a3d389e3432b630cac733e49fb76/frontend/readdy-app/src/services/reportService.ts
- Report snapshot adapter: https://github.com/juliushsu/CoCalLab/blob/24881a800792a3d389e3432b630cac733e49fb76/frontend/readdy-app/src/services/reportSnapshotService.ts
- Backend payload builder: https://github.com/juliushsu/CoCalLab/blob/24881a800792a3d389e3432b630cac733e49fb76/backend/src/services/build-report-payload.js
- Generate report edge function: https://github.com/juliushsu/CoCalLab/blob/24881a800792a3d389e3432b630cac733e49fb76/backend/supabase/functions/generate-report/index.ts
- Core schema: https://github.com/juliushsu/CoCalLab/blob/24881a800792a3d389e3432b630cac733e49fb76/backend/supabase/migrations/202603160001_v1_core_schema.sql

Regulatory reference points:
- 環境部事業溫室氣體排放量資訊平台盤查作業指引頁: https://ghgregistry.moenv.gov.tw/epa_ghg/GuideAndCalculation/GuideAndCalculation.aspx
- 溫室氣體排放量盤查登錄及查驗管理辦法: https://oaout.moenv.gov.tw/Law/LawContent.aspx?id=GL005954
- 溫室氣體排放量盤查作業指引 113 年版: https://ghgregistry.moenv.gov.tw/upload/Tools/%E6%BA%AB%E5%AE%A4%E6%B0%A3%E9%AB%94%E6%8E%92%E6%94%BE%E9%87%8F%E7%9B%A4%E6%9F%A5%E4%BD%9C%E6%A5%AD%E6%8C%87%E5%BC%95113%E5%B9%B4%E7%89%88.pdf

## Executive Finding

CoCalLab currently has a real report generation/history foundation through `report_generations`, but not a complete report-document renderer.

Report History is the strongest report surface: it reads persisted report rows, projects, snapshot columns, and can invoke the `generate-report` and `run-ai-audit` edge functions.

Report Preview is partial: it reads one `report_generations` row and derives statistics from `scope_totals` / `category_totals`, but `report_sections` persistence does not exist. The preview sections therefore render empty unless populated only in the current browser session by a future response shape.

Report Center is mostly a capability/navigation shell plus an adjustment-summary panel that still uses mock data in its current implementation.

PDF export is not implemented. The current export dialog offers PDF / Word / HTML buttons, but the handler only logs the selected format and closes the dialog.

## Surface Reality Matrix

| Surface | True Data | Snapshot | Mock | Placeholder / TODO | Current Risk |
| --- | --- | --- | --- | --- | --- |
| Report Center | Hardcoded report type gating for `carbon_inventory`; navigation to history | None rendered from `report_generations` in the current page | `mockEmissionsSummary` from carbon adjustments fixture | ESG / IFRS / Product CFP cards are coming-soon / disabled shells | Medium: can look like a report product center while only carbon inventory is usable |
| Report History | Reads `report_generations` and `projects`; can invoke `generate-report`; can invoke `run-ai-audit` | Reads latest global snapshot through `fetchLatestGlobalSnapshot` if snapshot columns exist | Falls back to `mockEmissionsSummary` when no real snapshot | Generate dialog response copy is optimistic; AI audit depends on deployed edge function | Medium: history is real, but snapshot panel may be mock |
| Report Preview | Reads one `report_generations` row and project name; derives statistics from persisted `scope_totals` / `category_totals` | Existing payload/scope/category/factor/source snapshots live in `report_generations`, but preview does not render full payload sections | No fixture fallback in `getReportData`, but sections are empty | Section edit persistence, regenerate section, export are TODO / unimplemented | High: can appear like a formal report preview while key sections are missing |

## Real Data Inventory

Real persisted report data currently exists in `report_generations`:

| Field Area | Persistence | Used By UI | Notes |
| --- | --- | --- | --- |
| `organization_id`, `project_id`, `report_version`, `status` | Yes | History, Preview | Core report identity and status are real. |
| `payload`, `payload_hash` | Yes | Not rendered by Preview today | Backend builds payload from project, activities, calculation results, factor snapshots, boundary snapshots. |
| `reporting_period_start`, `reporting_period_end` | Yes | History; Preview metadata indirectly | Required for basic report period. |
| `included_activity_count`, `excluded_activity_count`, `pending_activity_count` | Yes | History; Preview statistics total | Good closed-beta signal. |
| `scope_totals`, `category_totals` | Yes | Preview statistics | Supports basic emissions summary. |
| `factor_sources` | Yes | Not rendered by Preview today | Needed for factor-source report sections, but UI renderer does not expose it. |
| `gross_emissions_snapshot`, `adjustment_summary`, `claim_results`, `adjustment_manifest`, `claim_purpose` | Yes | History snapshot panel only; Center currently not wired | Useful for adjustment/claim snapshot, not formal compliance output. |
| `legal_entity_snapshot`, `site_snapshot`, `boundary_snapshot` | Yes for new generated rows after migration | Not rendered as full report sections | Critical for future template; legacy rows may be empty. |

## Snapshot Inventory

Snapshot support exists at the database and backend-output level:

- `build_report_payload` builds `workspace_snapshot`, `legal_entity_snapshot`, `site_snapshot`, and `boundary_snapshot`.
- `generate-report` persists adjustment and claim snapshots after atomic report insertion.
- `reportSnapshotService` reads the latest completed report snapshot and adapts it into the carbon-adjustment summary shape.

Snapshot limitations:

- Report Preview does not render `payload` into report chapters.
- Snapshot columns are not a formal template contract.
- Historical rows may lack newer snapshot fields.
- Snapshot adapter falls back to mock values, so the UI must label mock/preview states.

## Mock Inventory

| Mock | Location | Current Usage |
| --- | --- | --- |
| `mockEmissionsSummary` | Carbon adjustment fixture | Report Center summary panel; Report History fallback snapshot. |
| `mockReport`, `mockSections`, `mockStatistics` | `mocks/reports.fixture.ts` | Fixture still exists; current `getReportData` no longer uses it for preview read path. |
| Hardcoded capability gates | Report Center | ESG / IFRS / Product CFP are hardcoded coming-soon or disabled, not subscription/API-driven. |

## Placeholder / TODO Inventory

| Placeholder | Location | Reality |
| --- | --- | --- |
| `report_sections` | `reportService.ts`, `ReportPreviewPage.tsx` | Table does not exist; sections return empty from read path. |
| Edit report section | `ReportPreviewPage.tsx` | Updates React state only; no persistence. |
| Regenerate section | `ReportPreviewPage.tsx` | Calls `regenerate-section`, but this is not documented as a canonical backend contract and depends on an unavailable section ID model. |
| Export PDF / Word / HTML | `ReportPreviewPage.tsx` | Dialog exists; handler logs format only. |
| Report template chapters | Entire report flow | No canonical report-template renderer yet. |

## `report_sections` Persistence

Current answer: no usable `report_sections` persistence exists in canonical schema.

Evidence:
- Core schema creates `report_generations`, not `report_sections`.
- `reportService.ts` explicitly documents that `report_sections` does not exist and returns `sections: []`.
- Report Preview can display section cards only when `sections` state is populated in the current browser session after a future generate/regenerate response.

Implication:
- Readdy must not design UI assuming persisted sections exist.
- Backend must not be assumed to store user-edited report paragraphs.
- A PDF renderer cannot rely on `report_sections` until schema/API exists.

## PDF Export Reality

Current answer: PDF export is not available.

What exists:
- Export button in Report Preview.
- Export dialog with PDF / Word / HTML options.
- Readonly guard before export.

What does not exist:
- No `export-report` edge function implementation.
- No browser PDF generation library usage.
- No server PDF renderer.
- No stable report HTML template contract.
- No generated file URL, storage object, or download response.

Current risk:
- The UI affordance can make a tester believe formal PDF export exists. For closed beta, it must be labeled as preview/internal only or hidden until renderer exists.

## Current Closed-Beta Position

| Capability | Status | Beta Label |
| --- | --- | --- |
| Report History list | Partial | Can be used in guided staging as report-generation history. |
| Report generation | Partial | Can create `report_generations` snapshots if edge function/env are connected. |
| Report Preview metadata/statistics | Partial | Can preview metadata and scope/category totals. |
| Report sections | Missing | Do not claim chapter-level report generation. |
| AI Audit / preflight | Partial | Internal review / preflight only. |
| PDF export | Missing | Hide or mark as unavailable; no compliance claim. |
| Formal Taiwan inventory report | Not ready | Requires template, renderer, missing sections, verification wording, and evidence mapping. |

## Minimum Canonical Next Step

Before UI or PDF implementation, canonical must define:

1. Report section ontology.
2. Minimum report payload fields per section.
3. Renderer states for missing / partial / mock data.
4. Preview watermark and disclaimers.
5. PDF export preconditions.

The companion files in this pack define those requirements:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/report-templates/TAIWAN_GHG_INVENTORY_REPORT_STRUCTURE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/report-templates/REPORT_PREVIEW_TO_PDF_GAP_ANALYSIS_V1.md

