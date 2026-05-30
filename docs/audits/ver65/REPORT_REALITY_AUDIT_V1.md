# CoCalLab Ver65 Report Reality Audit V1

Date: 2026-05-30

Scope:
- Package: `/Users/chishenhsu/Downloads/CoCalLab-Ver065`
- Report surfaces audited:
  - Report Center: `src/pages/admin/reports/ReportCenterPage.tsx`
  - Report History: `src/pages/admin/reports/ReportGenerationHistoryPage.tsx`
  - Report Preview: `src/pages/admin/reports/ReportPreviewPage.tsx`
  - Report services: `src/services/reportService.ts`, `src/services/reportSnapshotService.ts`

## Executive Verdict

Ver65 reports are partial and staging-only. Report History has the strongest real-data footing because it reads `report_generations` and `projects`. Report Preview can load a `report_generations` row and statistics, but persisted report sections are explicitly absent. Report Center is mostly a capability/navigation shell with hardcoded gates and mock carbon-adjustment summary.

Report surfaces must not claim formal compliance with Taiwan Ministry of Environment inventory guidance, ISO 14064, or GHG Protocol.

Risk level: High

## Surface Classification

| Surface | Real Data | Snapshot | Mock | Placeholder | Verdict |
| --- | --- | --- | --- | --- | --- |
| Report Center | Minimal | No real global report center model | Yes, carbon adjustment summary and capability gates | Reporting entity/boundary placeholder | Partial |
| Report History | Yes, `report_generations` and `projects` | Yes, latest global snapshot adapter | Snapshot fallback mock | AI audit dialog depends on edge function | Partial |
| Report Preview | Yes, report row/statistics from `report_generations` | No complete snapshot display | Sections absent unless generated in session | Export and section edit persistence TODO | Not beta-ready as formal report |

## Report Center Reality

Evidence:
- `ReportCenterPage.tsx` uses a local `getCapabilityStatus` function.
- Comment states: `TODO: Replace with real capability gate from Codex subscription API`.
- Carbon inventory is available; ESG, IFRS S1/S2, and Product CFP are hardcoded as coming soon.
- Page imports `mockEmissionsSummary` and displays gross/adjustments/claimable values from fixture data.

What is real:
- Navigation to Report History for carbon inventory.
- Beta/governance warning copy.
- Disabled reporting entity / inventory boundary placeholders.

What is mock or hardcoded:
- Capability availability.
- Report type readiness.
- Carbon adjustment summary.
- Product CFP card path exists in config, although it is marked coming soon in the card.

Risk:
- The page looks like a productized reporting control center, but backend capability/entitlement API is not real.
- Report cards for ESG and IFRS exist but should not be interpreted as implemented reporting standards.

Required before beta:
- Keep Report Center visible only as an entry to carbon inventory report history.
- Ensure ESG, IFRS, Product CFP remain disabled and cannot be reached as implemented workflows.
- Avoid any copy implying official compliance output.

## Report History Reality

Evidence:
- Reads `report_generations` and `projects`.
- Invokes `generate-report` edge function.
- Fetches latest snapshot through `fetchLatestGlobalSnapshot`.
- Uses `mockEmissionsSummary` fallback.
- Includes AI audit flow through edge function.

What is real:
- A report generation list can be based on `report_generations`.
- Projects can be selected from `projects`.
- Generate action invokes an edge function.

What is snapshot:
- Snapshot service reads:
  - `gross_emissions_snapshot`
  - `adjustment_summary`
  - `claim_results`
  - `adjustment_manifest`
  - `claim_purpose`
- If snapshot fields exist, the snapshot summary can be treated as real snapshot data.

What is mock:
- If no snapshot exists, the summary falls back to `mockEmissionsSummary`.
- Carbon-adjustment summary still mixes real and fallback paths.

What is placeholder:
- AI audit result depends on the edge function and should be framed as preflight/review support, not formal validation.

Risk:
- Users may trust fallback summary values unless mock state is very visible.
- AI audit can be mistaken for compliance validation.

Required before beta:
- Label each report row/summary as real snapshot, fixture fallback, or unavailable.
- Use "preflight review" language, not "validated" or "compliant".

## Report Preview Reality

Evidence:
- `reportService.ts` states: `report_sections 表目前不存在，sections 回傳空陣列`.
- `getReportData` reads `report_generations`, maps it to `ReportVersion`, and builds statistics from `scope_totals` and `category_totals`.
- `total_sections` is hardcoded to 10.
- `completed_sections` is derived from status.
- Section edit save is a TODO for future `report_sections`.
- Export is a TODO for future `export-report`.
- Regenerate section invokes `regenerate-section`, but persistent section storage is not present in the read path.

What is real:
- Report metadata from `report_generations`.
- Scope/category statistics if stored in `report_generations`.
- Report generation edge function call path.

What is not real enough:
- Persisted report sections.
- Exported PDF/DOCX/HTML.
- User section edits.
- Formal section regeneration persistence.

What is mock/temporary:
- Section counts.
- Any section content shown only after in-session edge function response.
- Any generated text not persisted back to a canonical report-section table.

Risk:
- This is the highest-risk report surface because it can appear like a formal generated report.
- P0 missing i18n keys on preview title, statistics, section actions, export dialog, and generation states can expose raw keys.

Required before beta:
- Mark Report Preview as staging preview only.
- Disable or clearly mark export as unavailable.
- Make "no persisted sections" explicit if preview is accessible.
- Avoid section edit/regenerate affordances unless they are visibly experimental.

## Compliance Gap Analysis

### Taiwan Ministry of Environment Inventory Guidance

Missing:
- Formal reporting boundary declaration.
- Reporting entity and facility/site details.
- Activity data evidence linkage.
- Emission source classification and exclusion rationale.
- Factor citation and version/source.
- Reviewer/approver audit trail.
- Required report structure and language aligned to local guidance.

Status: Not compliant.

### ISO 14064

Missing:
- Organizational boundary methodology.
- Operational boundary methodology.
- Base year and recalculation policy.
- Uncertainty assessment.
- Data quality assessment.
- Verification statement / assurance workflow.
- Documented responsibilities and approval records.

Status: Not compliant.

### GHG Protocol

Missing:
- Scope 1/2/3 methodology clarity.
- Location-based vs market-based Scope 2 treatment.
- Category-level Scope 3 completeness.
- Emission factor provenance and versioning.
- Exclusion materiality rationale.
- Recalculation and restatement policy.
- Transparent inventory quality management.

Status: Not compliant.

## Report Trust Risks

1. Report Preview may look final despite missing persisted report sections.
2. Hardcoded section counts can imply completeness that is not proven.
3. AI audit can be mistaken for compliance validation.
4. Carbon adjustment snapshot can fall back to mock values.
5. ESG/IFRS/Product CFP report cards can imply broader report support.
6. Export button exists but export implementation is TODO.
7. Section edit/regenerate UX exists without persistent canonical section storage.
8. Report statistics depend on `report_generations` JSON fields and may be absent.
9. Reporting entity and inventory boundary are placeholders.
10. Missing i18n keys can show raw keys in the most trust-sensitive surfaces.

## Recommended Report Gating

Can expose in guided beta:
- Report History list for completed/generated report snapshots.
- Generate carbon inventory report only if the edge function is available in staging.
- Report Preview as "staging preview / not formal compliance report".

Should hide or disable:
- ESG report route/card.
- IFRS S1/S2 route/card.
- Product CFP report card path.
- Export actions.
- Section edit/regenerate actions unless clearly marked internal.

Should wait for canonical API/schema:
- `report_sections` persistence.
- Report export endpoint.
- Formal validation/preflight endpoint.
- Capability/entitlement API.
- Compliance-specific report templates.

## Beta Readiness Score

| Report Area | Score | Rationale |
| --- | --- | --- |
| Report Center | Partial | Good navigation shell and warnings; mock/hardcoded capability model. |
| Report History | Partial | Real report generation list possible; snapshot fallback must be visible. |
| Report Preview | Not Ready | Missing persisted sections, export, and compliance structure. |
| Report Validation | Not Ready | Should remain preview/preflight only. |
| Compliance Reporting | Not Ready | No formal EPA Taiwan / ISO / GHG Protocol support. |

## Required Copy Guardrail

Allowed:
- "Staging preview"
- "Internal preflight"
- "Draft report"
- "Snapshot summary"
- "Requires human review"

Forbidden:
- "Compliant with ISO 14064"
- "GHG Protocol verified"
- "環境部合規報告"
- "正式申報可用"
- "Assurance-ready"
- "Validated report"
