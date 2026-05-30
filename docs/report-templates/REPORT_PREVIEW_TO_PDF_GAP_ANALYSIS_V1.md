# Report Preview To PDF Gap Analysis V1

Date: 2026-05-30
Canonical baseline: `24881a800792a3d389e3432b630cac733e49fb76`

Status: analysis only. No PDF implementation, no UI change, no schema change, no compliance claim.

## Current Answer

CoCalLab cannot currently produce a real preview PDF.

The current Report Preview has an export dialog with PDF / Word / HTML buttons, but the export handler only logs the selected format and closes the dialog. There is no canonical HTML print template, no server export endpoint, no storage artifact, and no PDF generation pipeline.

Source:
- https://github.com/juliushsu/CoCalLab/blob/24881a800792a3d389e3432b630cac733e49fb76/frontend/readdy-app/src/pages/admin/reports/ReportPreviewPage.tsx

## Current Preview Renderer Reality

| Area | Current State | PDF Impact |
| --- | --- | --- |
| Report metadata | Reads `report_generations` row | Usable for cover/header. |
| Project name | Joins `projects(name)` | Usable. |
| Reporting period | Persisted in `report_generations` | Usable. |
| Scope totals | Persisted as `scope_totals` | Usable for summary table. |
| Category totals | Persisted as `category_totals` | Usable for appendix/summary, but renderer incomplete. |
| Factor sources | Persisted as `factor_sources`; payload includes factor source snapshots | Not rendered in Preview. |
| Boundary snapshots | Persisted for new rows | Not rendered as report sections. |
| Report sections | No persistence | Blocks chapter PDF. |
| Section edits | Local React state only | Cannot be exported reliably. |
| Export action | Console-only TODO | Blocks PDF. |
| Watermark/disclaimer | Governance banner exists on page | Needs PDF-level persistent watermark/header/footer. |

## Why PDF Is Blocked

PDF export requires a stable render contract. CoCalLab currently lacks:

1. Canonical report section list.
2. Persisted sections or deterministic section derivation from `report_generations.payload`.
3. Print-safe report HTML layout.
4. Export endpoint or browser export implementation.
5. Download/storage response contract.
6. Watermark/footer contract.
7. Renderer-level missing-data handling.
8. Formal distinction between real snapshot, partial data, and mock fallback.

## Minimal PDF Preview Version

The first acceptable PDF preview must be explicitly labeled:

`非正式申報 / 非第三方查驗 / Staging Preview Only`

It should be called:

`Taiwan GHG Inventory Preview PDF`

It must include:

| PDF Section | Minimum Data | Current Availability | Gap |
| --- | --- | --- | --- |
| Cover / watermark | Project name, report version, generated timestamp, disclaimer | Partial | Need print header/footer and template. |
| Basic data | Workspace/project/reporting entity/site where available | Partial | Renderer must read snapshots from payload/snapshot columns. |
| Purpose | Internal/staging purpose and claim purpose | Partial | Need template copy and mapping from `claim_purpose`. |
| Boundary | Boundary type, reporting period, included/excluded/pending counts | Partial | Need renderer for `boundary_snapshot` and boundary summary. |
| Emissions summary | Scope totals, category totals, total CO2e | Supported / partial | Scope totals supported; category renderer needed. |
| Activity summary | Included/excluded/pending activity summary | Partial | Data exists in payload but not rendered. |
| Factor sources | Factor source table | Partial | Data exists in payload/factor_sources but not rendered. |
| Data gaps | Warnings/pending items | Partial | Data exists in payload; renderer needed. |
| Appendix mappings | document/draft/activity/calculation mapping | Partial | Data exists in payload; renderer needed. |

It must exclude:

- Verification statement.
- Formal filing declaration.
- Third-party assurance conclusion.
- Official Ministry submission wording.
- ISO 14064 / GHG Protocol compliance claim.
- CBAM/Product CFP workflow language.

## Required PDF Disclaimers

Every preview/PDF surface must show:

1. `非正式申報`
2. `非第三方查驗`
3. `僅供封測 / 內部盤查流程驗證`
4. `不得作為環境部正式登錄、查驗聲明或第三方查證文件`
5. `資料完整性與查證狀態需由使用者及合格查驗機構另行確認`

Recommended English/Japanese equivalents:

- `Not for official filing`
- `Not third-party verified`
- `Closed-beta internal inventory preview only`
- `This preview must not be used as a regulatory submission or verification statement`
- `正式申告用ではありません`
- `第三者検証済みではありません`

## Data Preconditions For PDF Preview

PDF preview button should remain disabled or clearly unavailable unless:

- `report_generations.id` exists.
- `payload_hash` exists.
- `payload` exists.
- `reporting_period_start` and `reporting_period_end` exist.
- `scope_totals` exists and can be rendered.
- At least one of these exists:
  - `included_activities_summary` in payload,
  - `included_activity_count` > 0,
  - explicit empty-state copy saying no included activities.
- `factor_sources` or `payload.factor_sources_used` is available, or an explicit no-factor-source warning is rendered.
- Template version is displayed.
- Watermark/disclaimer is rendered.

## Gap Matrix

| Gap | Severity | Why It Matters | Owner Before Implementation |
| --- | --- | --- | --- |
| No `report_sections` persistence | P0 | Cannot export edited/generated chapters reliably | Canonical backend/schema decision |
| No canonical template version | P0 | PDF layout can drift between Readdy/backend | Canonical docs |
| No export endpoint | P0 | PDF button cannot produce a file | Backend |
| No print-safe renderer | P0 | Browser preview does not equal PDF output | Readdy after canonical approval |
| No PDF artifact storage/download contract | P1 | Users need deterministic download/history | Backend |
| No data provenance labels per section | P1 | Users may trust partial/mock data as formal | Readdy/backend |
| Factor-source renderer missing | P1 | Taiwan report needs method/source transparency | Readdy renderer |
| Evidence appendix renderer missing | P1 | Activity/document traceability is hidden | Readdy renderer |
| Uncertainty/verifier fields missing | P2 | Must be excluded from preview rather than invented | Backend/schema later |

## Readdy Next Sprint UI Tasks

These tasks are allowed only as renderer/preview tasks. They must not claim compliance.

1. Add a report preview template shell with canonical section order from:
   https://github.com/juliushsu/CoCalLab/blob/main/docs/report-templates/TAIWAN_GHG_INVENTORY_REPORT_STRUCTURE_V1.md
2. Add persistent preview watermark text: `非正式申報 / 非第三方查驗 / Staging Preview Only`.
3. Render supported sections first: basic data, reporting period, scope/category totals.
4. Render partial sections with explicit `資料不足 / 尚未完成` states.
5. Render blocked sections as disabled/empty states, not fake content.
6. Add provenance labels: `real snapshot`, `partial`, `mock fallback`, `missing`.
7. Keep PDF/Word/HTML export disabled or marked `coming soon` until backend export exists.
8. Do not invent report_sections, verification, uncertainty, CBAM, or Product CFP sections.
9. Use canonical field names from `report_generations.payload`; do not introduce new DTOs.
10. Add Readdy handoff note linking this file and the structure file with full GitHub URLs.

Required Readdy input URLs:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/report-templates/REPORT_TEMPLATE_REALITY_AUDIT_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/report-templates/TAIWAN_GHG_INVENTORY_REPORT_STRUCTURE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/report-templates/REPORT_PREVIEW_TO_PDF_GAP_ANALYSIS_V1.md

## Backend Alignment Notes

Backend should later decide whether sections are:

1. Persisted as `report_sections`, or
2. Deterministically rendered from `report_generations.payload`, or
3. Stored as versioned `report_render_snapshot`.

Until that decision is canonical, Readdy must not assume section persistence.

## Closed-Beta Recommendation

For closed beta:

- Keep Report History available.
- Keep Report Preview available as staging preview.
- Keep generation available only if guided and edge function is configured.
- Disable or label export as unavailable.
- Require all report pages to show beta/non-formal disclaimers.

