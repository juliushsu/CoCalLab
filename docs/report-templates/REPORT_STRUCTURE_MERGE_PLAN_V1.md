# Report Structure Merge Plan V1

Date: 2026-05-30
Canonical baseline: `bfea060e67ee0d7ea654183acee3d71857c9eb65`
Readdy package reviewed: `/Users/chishenhsu/Downloads/CaCalLab-Ver068`

Status: audit only. No code merge, no schema change, no backend change, no UI modification.

## Canonical Inputs

GitHub canonical repo is the only source of truth:

- https://github.com/juliushsu/CoCalLab

Report-template canonical docs:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/report-templates/REPORT_TEMPLATE_REALITY_AUDIT_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/report-templates/TAIWAN_GHG_INVENTORY_REPORT_STRUCTURE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/report-templates/REPORT_PREVIEW_TO_PDF_GAP_ANALYSIS_V1.md

Ver68 files inspected:

- `/Users/chishenhsu/Downloads/CaCalLab-Ver068/src/pages/admin/reports/components/ReportOutlinePanel.tsx`
- `/Users/chishenhsu/Downloads/CaCalLab-Ver068/src/pages/admin/reports/ReportPreviewPage.tsx`
- `/Users/chishenhsu/Downloads/CaCalLab-Ver068/src/services/reportService.ts`
- `/Users/chishenhsu/Downloads/CaCalLab-Ver068/src/types/report.ts`
- `/Users/chishenhsu/Downloads/CaCalLab-Ver068/src/i18n/local/{zh,en,ja}/cocal.ts`

## Executive Decision

Ver68 is directionally aligned with the canonical report-template sprint, but it is not safe for whole-package merge.

Recommended merge posture:

- Selectively merge the `ReportOutlinePanel` concept only after small corrections.
- Selectively merge the Report Preview disclaimer/export-disabled treatment after i18n alignment.
- Do not merge Ver68 `types/report.ts`.
- Do not merge Ver68 locale files wholesale.
- Do not merge any direct assumption that `report_sections` exists or that report chapters are persisted.
- Wait for `REPORT_SECTION_CANONICAL_MODEL_V1` before merging anything that models editable/persisted report sections.

## A. Aligned With Canonical

| Area | Ver68 Behavior | Canonical Alignment | Merge Status |
| --- | --- | --- | --- |
| Staging disclaimer | Adds Report Preview warning: staging snapshot, not formal filing, not third-party verification | Matches required non-formal positioning | Merge after i18n key cleanup |
| Export reality | Export dialog is visually disabled and says export is not deployed | Matches `REPORT_PREVIEW_TO_PDF_GAP_ANALYSIS_V1` | Merge after copy/i18n cleanup |
| No persisted sections message | Empty section state says `report_sections` is required before section content is available | Matches reality audit | Merge after wording cleanup |
| Report structure outline concept | Adds section-by-section coverage preview | Matches allowed renderer/preview task | Merge after data wiring and status corrections |
| Uses status vocabulary | Uses `supported`, `partial`, `missing`, `coming_soon` | Mostly aligned; canonical does not require `coming_soon` for report sections | Merge with minor adjustment |
| Does not implement PDF | Leaves export unavailable | Aligned | Merge export-disabled UI only |

## B. UI Placeholder Only

These are acceptable as placeholder UI only if clearly labeled and not treated as data-backed report sections.

| Section | Ver68 State | Why Placeholder |
| --- | --- | --- |
| Basic Data | Always `partial`; only references generic `project_id`, `report_version`, `generated_at` | Does not render legal entity/site/boundary snapshots. |
| Inventory Purpose | Always `partial`; references `claim_purpose (partial)` | `claim_purpose` is not a full inventory purpose narrative. |
| Boundary | Always `partial`; `boundarySnapshot` is passed as `null` from Report Preview | No real boundary snapshot is wired into component. |
| Emission Sources | Always `partial`; uses counts as proxy | Counts do not equal source-unit/process/GHG type detail. |
| Activity Sources | Always `partial`; points to `payload.appendix_mappings` but does not read payload | UI hint only. |
| Factor Sources | Always `partial`; `factorSources` is passed as `null` | UI hint only. |
| Quality | Always `partial`; uses warning/pending counts conceptually | No quality-management table renderer. |
| Evidence | Always `partial`; no attachment/certificate/document renderer | UI hint only. |

## C. Drift / Regression Risks

| Risk | Evidence | Severity | Decision |
| --- | --- | --- | --- |
| i18n key path mismatch | Component calls `reports.structure.*`, but locale files define top-level `reportStructure.*` | High | Do not merge as-is. Fix to canonical `reports.structure.*` or adjust calls before selective merge. |
| Canonical i18n regression | Ver68 locale files appear older than canonical Batch 3 and remove many keys such as `auth.*`, `organizations.*`, `subscription.*`, `common.comingSoon` | High | Do not merge locale files wholesale. Cherry-pick only new report keys after preserving canonical keys. |
| DTO compatibility regression | Ver68 `types/report.ts` removes optional compatibility fields from canonical `ReportSection` / `ReportVersion` | High | Do not merge. Keep canonical DTO compatibility fields. |
| False completeness | `calcCompleteness` gives every `partial` section `0.4`, so a mostly placeholder report can look 40% complete | Medium | Merge only if label says UI coverage, not report/compliance completeness. Consider renaming to `preview coverage`. |
| Incorrect data wiring | Report Preview passes `reportingPeriodStart={null}`, `boundarySnapshot={null}`, `factorSources={null}`, `categoryTotals={null}` even though `report_generations` can contain some of these | Medium | Merge only after extending read adapter or passing available fields correctly. |
| Misleading activity counts | Uses `report.completed_sections` as `includedActivityCount` and `total_sections - completed_sections` as pending activity count | High | Do not merge this wiring. Needs DTO/read-path fix. |
| Incomplete disclaimer wording | Panel says `非正式申報 / Internal Review Only`, but canonical requires `非正式申報 / 非第三方查驗 / Staging Preview Only` | Medium | Merge after copy correction. |
| New dependencies on ValueChainProgress/BetaFeedbackButton | ReportPreview imports extra components that may be unrelated to report-structure patch | Low/Medium | Merge separately only if already canonical and desired; not required for report structure. |
| Package contains `.env` | Ver68 package includes `.env` in root | High hygiene risk | Never copy package wholesale. |

## D. Section-by-Section Audit

### Third Chapter: Boundary

Canonical requirement:

- Show organizational/report boundary, workspace, legal entity, site/facility where available.
- Label boundary engine limitations.
- Use `boundary_snapshot` when available.

Ver68:

- `ReportOutlinePanel` defines `inventoryBoundary` as chapter 3.
- It correctly labels missing boundary and missing boundary engine.
- Report Preview passes `boundarySnapshot={null}`, so it never shows real boundary support even when `report_generations.boundary_snapshot` exists.

Status: partial placeholder.

Can merge: component row concept and missing-state language.

Cannot merge: current data wiring.

Needs DTO/read path: `boundary_snapshot`, `legal_entity_snapshot`, `site_snapshot`.

Needs persistence: no new persistence; use `report_generations` snapshot first.

### Fourth Chapter: Reporting Period

Canonical requirement:

- `reporting_period_start`, `reporting_period_end`.
- This is one of the few currently supported sections.

Ver68:

- Defines `inventoryPeriod`.
- Status can be `supported` if start/end are passed.
- Report Preview passes both as `null`, so the section appears missing even though canonical `report_generations` has these fields and `reportService.ts` reads them indirectly for statistics/history.

Status: aligned concept, wrong wiring.

Can merge: component logic after props are wired.

Cannot merge: current `reportingPeriodStart={null}` / `reportingPeriodEnd={null}` integration.

Needs DTO: ReportVersion or a report preview DTO should expose reporting period.

Needs persistence: already in `report_generations`.

### Fifth Chapter: Emission Sources

Canonical requirement:

- Activity/source category, scope, inclusion status, source-unit/process/GHG type where available.

Ver68:

- Defines `emissionSources` with partial status.
- Correctly notes source-unit/process/GHG type detail is incomplete.
- Current Preview wiring uses report section counts as activity counts, which is incorrect.

Status: placeholder with unsafe current wiring.

Can merge: row definition and missing-state copy.

Cannot merge: mapping `completed_sections` to included activities.

Needs DTO: report activity summary from `payload.included_activities_summary` and excluded/pending summaries.

Needs persistence: existing `report_generations.payload` may be sufficient for preview; `report_sections` not required for this row.

### Sixth Chapter: Calculation

Canonical requirement:

- Calculation methods, formula/version, unit conversion, scope/category totals, factor version.

Ver68:

- Defines `calculationMethod`.
- Uses `scopeTotals` and `categoryTotals` as support signals.
- Report Preview passes scope totals from statistics but always passes `categoryTotals={null}`.
- It does not render formula/method/factor version details.

Status: partial.

Can merge: basic coverage indicator.

Cannot merge as formal calculation section.

Needs DTO: calculation method summary / formula version / unit conversion / per-source method text.

Needs persistence: existing `calculation_results` and `report_generations.payload` can support a preview summary; formal sections need canonical model.

### Seventh Chapter: Activity Sources

Canonical requirement:

- Activity data sources, documents, drafts, manual edits/review status, appendix mappings.

Ver68:

- Defines `activityDataSources`.
- Correctly states document traceability renderer is not connected.
- Does not read `payload.appendix_mappings`.

Status: UI placeholder.

Can merge: placeholder row.

Cannot merge as data-backed.

Needs DTO: appendix/activity-source mapping DTO from `report_generations.payload.appendix_mappings`.

Needs persistence: existing payload can be enough for preview; formal rendered sections wait for canonical model.

### Eighth Chapter: Factor Sources

Canonical requirement:

- Factor source name, reference/version, source URL/reference, quality tier.

Ver68:

- Defines `emissionFactorSources`.
- Correctly says renderer is missing.
- Does not read `factor_sources` or `payload.factor_sources_used`.

Status: UI placeholder.

Can merge: placeholder row and warning copy.

Cannot merge as data-backed.

Needs DTO: factor source summary shape.

Needs persistence: already partially present in `report_generations.factor_sources` and payload; renderer still needed.

### Ninth Chapter: Quality

Canonical requirement:

- Data gaps, pending/excluded counts, warnings, QA notes.

Ver68:

- Defines `dataQuality`.
- Uses warning/pending concepts, but current props are not wired from real report data.
- Does not render `warning_count` or `payload.data_gaps_and_warnings`.

Status: placeholder.

Can merge: row definition.

Cannot merge current pending-count wiring.

Needs DTO: quality summary from `warning_count`, pending/excluded counts, data gaps, validation flags.

Needs persistence: `report_generations` already has partial data; formal quality tables need canonical model.

### Tenth Chapter: Evidence

Canonical structure originally has:

- Section 10: 不確定性 / 保守性說明
- Section 11: 查證資訊
- Section 12: 附件 / 憑證 / 圖說

User-requested special check labels chapter 10 as Evidence. Ver68 uses `annexEvidence` as chapter 10.

Ver68:

- Collapses canonical uncertainty, verification, and appendix/evidence concepts into one chapter.
- Correctly warns that verification statement is not applicable before formal filing.
- Does not include uncertainty/conservatism as a separate canonical section.

Status: partial drift.

Can merge: evidence/appendix row only if relabeled as "附件 / 憑證 / 圖說" and not treated as canonical chapter 10.

Cannot merge: collapsed 10-chapter model as final canonical report structure.

Needs `REPORT_SECTION_CANONICAL_MODEL_V1`: yes.

Needs DTO: evidence appendix DTO, uncertainty DTO, verification DTO later.

Needs persistence: evidence may use existing documents/activities/payload; uncertainty and verification require new schema/API if later supported.

## E. Needs DTO

These should wait for a report preview DTO or `REPORT_SECTION_CANONICAL_MODEL_V1`:

- `ReportPreviewDTO.reporting_period`
- `ReportPreviewDTO.boundary_snapshot`
- `ReportPreviewDTO.legal_entity_snapshot`
- `ReportPreviewDTO.site_snapshot`
- `ReportPreviewDTO.scope_totals`
- `ReportPreviewDTO.category_totals`
- `ReportPreviewDTO.factor_sources`
- `ReportPreviewDTO.activity_source_mappings`
- `ReportPreviewDTO.data_gaps_and_warnings`
- `ReportPreviewDTO.evidence_appendix`
- `ReportPreviewDTO.section_coverage`

Do not add these inside Readdy independently. Define them canonically first.

## F. Needs Persistence

| Area | Persistence Needed? | Notes |
| --- | --- | --- |
| Reporting period | No | Already in `report_generations`. |
| Scope/category totals | No | Already in `report_generations`; pass them correctly. |
| Boundary snapshots | No for preview | Already in `report_generations` for new rows; renderer/read adapter needed. |
| Factor sources | No for preview | Already in `report_generations.factor_sources` / payload; renderer/read adapter needed. |
| Activity/evidence mappings | No for preview | Payload has appendix mappings; formal model may need stronger DTO. |
| Editable report sections | Yes | Requires `report_sections` or alternate canonical render snapshot model. |
| User-modified section content | Yes | Must wait for `REPORT_SECTION_CANONICAL_MODEL_V1`. |
| Verification statement | Yes, later | Must not be invented for closed beta. |
| Uncertainty/conservatism | Yes, later | Missing canonical schema/API. |
| PDF artifact | Yes, later | Requires export endpoint/storage/render contract. |

## Merge Decision

### Can Merge After Small Adjustments

Selective candidates:

1. New `ReportOutlinePanel.tsx` as renderer-only component.
2. Report Preview staging disclaimer.
3. Report Preview no-sections disclaimer.
4. Export dialog disabled/unavailable UI.

Required adjustments before merge:

- Change i18n key namespace to match canonical, preferably `reports.structure.*`, and add keys into canonical locale files without deleting existing Batch 1-3 keys.
- Replace "Report Completeness" wording with "Preview Coverage" or make compliance disclaimer more prominent.
- Use exact canonical disclaimer: `非正式申報 / 非第三方查驗 / Staging Preview Only`.
- Do not pass fake values for activity counts.
- Pass real `reporting_period_start/end` if available, or leave period missing honestly.

### Cannot Merge

Do not merge:

1. Ver68 `src/types/report.ts`; it removes canonical compatibility fields.
2. Ver68 locale files wholesale; they regress previous i18n cleanup and contain duplicate/nested issues.
3. Any route/config/package files from Ver68.
4. Any `.env` file from Ver68.
5. Current Report Preview wiring that maps report section counts to activity counts.
6. Any implication that `report_sections` or PDF export exists.

### Wait For `REPORT_SECTION_CANONICAL_MODEL_V1`

Must wait:

- Editable/persisted sections.
- Section regeneration workflow.
- Formal 12-section report model.
- Section-level status persistence.
- User-modified report paragraph storage.
- PDF section ordering based on persisted content.
- Uncertainty and verification section representation.

### Wait For DTO

Must wait:

- Boundary section with real snapshot data.
- Emission sources table.
- Calculation method table.
- Activity/document traceability table.
- Factor source table.
- Data quality table.
- Evidence appendix renderer.
- Preview coverage computed from real report fields rather than hardcoded section status.

## Selective Merge Strategy

### Phase 0: Do Not Merge Package

Reject whole-package merge because:

- `.env` exists in Ver68 package.
- `types/report.ts` regresses canonical compatibility.
- Locale files regress canonical i18n cleanup.
- Report Preview wiring has fake/null values for available data.

### Phase 1: Extract UI Shell Only

Manually cherry-pick:

- `src/pages/admin/reports/components/ReportOutlinePanel.tsx`

But patch before commit:

- Rename/align i18n namespace.
- Adjust disclaimer copy.
- Rename completeness label.
- Remove `coming_soon` if unused.
- Keep it renderer-only and prop-driven.

### Phase 2: Patch Report Preview Safely

Manually add:

- Staging preview disclaimer.
- No-sections disclaimer.
- Export unavailable state.
- `ReportOutlinePanel` placement.

Do not add:

- `ValueChainProgress` unless already intended in a separate value-chain UI sprint.
- `BetaFeedbackButton` unless feedback entry points are being merged separately.
- Fake `includedActivityCount` from `completed_sections`.

### Phase 3: DTO / Read Adapter Alignment

Wait for a canonical DTO, then update `reportService.ts` to expose:

- reporting period,
- boundary/legal entity/site snapshots,
- factor sources,
- category totals,
- activity counts,
- data gaps/warnings,
- payload appendix mappings.

### Phase 4: Renderer-Only Expansion

After DTO exists, expand the outline rows into real preview tables, still without claiming compliance.

### Phase 5: PDF Later

PDF remains blocked until:

- canonical report renderer,
- export endpoint,
- artifact storage/download contract,
- PDF watermark/footer,
- no mock data in exported artifact.

## Final Recommendation

Do not merge Ver68 directly.

Approve a selective, corrected merge of the report structure preview concept only. Treat Ver68 as a useful Readdy UI draft, not as canonical model or DTO source.

Priority:

1. Fix namespace and copy.
2. Remove unsafe fake data wiring.
3. Preserve canonical `types/report.ts`.
4. Preserve canonical locale files.
5. Wait for `REPORT_SECTION_CANONICAL_MODEL_V1` before persisted sections or formal report chapters.

