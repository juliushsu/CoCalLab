# Value Moment Canonical V1

Date: 2026-05-30
Status: canonical value moment ranking
Scope: documentation alignment only; no feature, schema, or migration change

## Purpose

This document defines the canonical value moments for CoCalLab.

AI agents and Readdy should prioritize these moments when improving product clarity, copy, journey flow, success states, or trust signals.

## Core Value Chain

The most important CoCalLab value chain is:

> Documents -> Draft -> Activity -> Analytics -> Report

Expanded:

1. User uploads or reviews evidence.
2. CoCalLab helps produce draft structured data.
3. User reviews/corrects the draft.
4. Reviewed draft becomes an emissions activity.
5. Activities support calculations and analytics.
6. A report is generated as a reviewable output.

This chain is the first paid product story.

## Priority Ranking

| Priority | Value Moment | User Value | Trust Requirement |
|---:|---|---|---|
| 1 | Document -> Draft | User does not have to retype evidence manually | OCR/provider mode, confidence, and source context must be clear |
| 2 | Draft -> Activity | Reviewed evidence becomes usable inventory | Confirm/reject consequences and created activity link must be clear |
| 3 | Activity -> Calculation / Factor | User sees a number with a reason | Factor, unit, and calculation context must be explainable |
| 4 | Activity List -> Analytics | User gets aggregation without spreadsheet pivots | Analytics data source and units must be labeled |
| 5 | Analytics -> Report | Insights become deliverable output | Report must not mix mock/live data without warning |
| 6 | Report Generation -> Report History | User gets a durable output record | Generated snapshot/id/timestamp must be visible |
| 7 | Evidence -> Report Trace | Reviewer can explain where numbers came from | Lineage must connect documents, drafts, activities, and report |
| 8 | Role -> Permission Boundary | Users know who can review or edit | Role-aware states and permission messages must be clear |
| 9 | Adjustment -> Gross/Net Explanation | Advanced users can understand claims | Fixture/mock adjustment status must be labeled |
| 10 | Workspace -> Collaboration | Teams work together without email chaos | Workspace/client/legal entity boundary must remain clear |

## Highest-Value Moments For Closed Beta

Closed beta should emphasize:

1. Document -> Draft.
2. Draft -> Activity.
3. Activity -> Analytics.
4. Analytics -> Report.
5. Report -> History/Snapshot.

Closed beta should avoid over-emphasizing:

- CBAM.
- Product CFP.
- Formal report validation.
- Full legal entity/site governance.
- Full factor source governance.
- Platform AI governance.

## Persona Value Mapping

| Persona | Most Important Value Moment |
|---|---|
| SMB | Upload bill -> reviewed draft -> generated report |
| Manufacturing | Activity with calculation/factor context -> analytics -> report snapshot |
| Accounting Firm | Evidence review -> correction -> immutable report history with caveats |
| ESG Consultant | Client workspace -> review queue -> analytics -> report review package |
| Exporter | Ordinary carbon inventory foundation -> honest non-CBAM boundary |

## Value Moment Copy

Use value copy that describes user relief:

- "No need to retype every bill."
- "Review before it becomes inventory."
- "Trace report numbers back to evidence."
- "Understand the numbers without rebuilding a spreadsheet."
- "Generate a report package for discussion."

Avoid feature-only copy:

- "OCR module."
- "Activity module."
- "Analytics dashboard."
- "Report engine."

Feature names can appear in navigation, but value moments should explain why the feature matters.

## Trust Breakers

These issues break value moments:

- Mock/fallback analytics shown as real output.
- Report Validation described as formal compliance.
- Activity verify/recalculate shown as official if mock-heavy.
- Factor source pages shown as authoritative without backend support.
- Workspace/legal entity/site language mixed.
- Draft confirmation without explaining consequences.
- Report preview mixed with mock/live sections.
- CBAM/Product CFP language appearing as available capability.

## Canonical Priority

When tradeoffs arise, prioritize:

1. Traceability over breadth.
2. Reviewability over automation claims.
3. Honest caveats over impressive-sounding copy.
4. Evidence-to-report flow over new modules.
5. User value clarity over feature inventory.

## Final Value Thesis

CoCalLab's current value is:

> Faster, traceable evidence-to-report preparation.

The product should make the user feel:

- I saved time.
- I made fewer mistakes.
- I can explain the number.
- I can share a report package.
- I know what is draft, preview, generated, or unsupported.
