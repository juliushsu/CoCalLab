# CoCalLab AI Touchpoint Priority Matrix

Status: canonical touchpoint prioritization matrix.

Parent plan:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_TOUCHPOINT_IMPLEMENTATION_PLAN_V1.md

Parent governance:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_GENERATION_GOVERNANCE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_AI_GENERATION_MATRIX.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/RAG_GOVERNANCE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_DRAFT_REVIEW_AI_V1.md

## Scoring Model

Scores use 1-5.

| Score | User Value | Implementation Risk | Hallucination Risk | Cost | Governance Maturity |
| ---: | --- | --- | --- | --- | --- |
| 1 | Low | High risk | High risk | High cost | Immature |
| 3 | Medium | Manageable | Manageable | Medium cost | Partial |
| 5 | High | Low risk | Low risk | Low cost | Mature |

Priority rank is not a pure value ranking. It weights implementation readiness and governance containment heavily.

## Priority 1-10

| Priority | Touchpoint | Flow | User Value | Implementation Risk | Hallucination Risk | Cost | Governance Maturity | Recommended Phase |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Draft Review Explanation | Draft | 5 | 4 | 4 | 4 | 5 | Phase 1 |
| 2 | Missing Data Explanation | Draft/Report | 5 | 4 | 4 | 5 | 4 | Phase 1 |
| 3 | Factor Explanation | Activity/Report | 5 | 3 | 3 | 4 | 4 | Phase 1/2 |
| 4 | Report Executive Summary | Report | 5 | 3 | 3 | 3 | 3 | Phase 2 |
| 5 | Data Quality Explanation | Report | 4 | 3 | 4 | 4 | 4 | Phase 2 |
| 6 | Document Classification Explanation | Documents | 3 | 4 | 4 | 5 | 3 | Phase 1 |
| 7 | Analytics Insight Summary | Analytics | 4 | 3 | 3 | 3 | 3 | Phase 2 |
| 8 | Report Section Narrative | Report | 5 | 2 | 2 | 2 | 2 | Phase 3 |
| 9 | Scope / Category Mapping Explanation | Activity | 4 | 2 | 2 | 4 | 2 | Phase 3 |
| 10 | Compliance Gap Explanation | Report | 4 | 1 | 1 | 3 | 1 | Phase 3 |

## Must / Should / Optional / Forbidden Matrix

### 1. Draft Review Explanation

| Category | Rule |
| --- | --- |
| Must | Use a compact source package with draft ID, source document ID, extracted fields, source spans, extraction confidence, warnings, and missing fields. Label as `AI Draft`. |
| Should | Explain uncertainty, missing fields, and next human review action. Cite field/source references. |
| Optional | Suggest reviewer questions or re-upload guidance when source coverage is weak. |
| Forbidden | Approve the draft, change values, create activity, choose factors, claim verification, or claim compliance. |

### 2. Missing Data Explanation

| Category | Rule |
| --- | --- |
| Must | Use deterministic missing-field records or validation warnings. State what is missing and why it matters. |
| Should | Explain the next practical user action and whether the missing data blocks activity/report use. |
| Optional | Group missing items by document, activity, report section, or source type. |
| Forbidden | Fill missing values, imply missing data is harmless without deterministic rule, or hide missing evidence. |

### 3. Factor Explanation

| Category | Rule |
| --- | --- |
| Must | Use retrieved factor source metadata, factor ID/version, source ID, and applicable activity context. |
| Should | Explain provenance, factor source type, version, and why the factor appears in the context. |
| Optional | Explain alternatives only if deterministic factor resolution exposes candidate metadata. |
| Forbidden | Choose the factor, override priority, change factor value, declare factor legally compliant, or invent source provenance. |

### 4. Report Executive Summary

| Category | Rule |
| --- | --- |
| Must | Use canonical report payload, deterministic totals, warnings, missing data, source IDs, and preview/finality label. |
| Should | Summarize emissions, material gaps, data quality warnings, and review status in plain language. |
| Optional | Draft internal reviewer notes or client-facing draft copy after review gating is clear. |
| Forbidden | Claim official filing readiness, ISO/GHG Protocol/MOE compliance, third-party verification, or final approval. |

### 5. Data Quality Explanation

| Category | Rule |
| --- | --- |
| Must | Use deterministic quality warnings, source coverage, review status, missing evidence, and validation results. |
| Should | Separate evidence gaps, review gaps, calculation gaps, and report-section gaps. |
| Optional | Suggest a review checklist for the user. |
| Forbidden | Mark data quality as verified, suppress warnings, or transform warnings into final compliance statements. |

### 6. Document Classification Explanation

| Category | Rule |
| --- | --- |
| Must | Treat document type as candidate unless human/system verification exists. Use upload metadata, parser result, OCR snippets, and confidence. |
| Should | Explain why the document appears to be a certain type and what fields the user should expect. |
| Optional | Suggest re-upload if OCR coverage is too low. |
| Forbidden | Verify the document, infer unsupported bill values, or classify cross-tenant documents. |

### 7. Analytics Insight Summary

| Category | Rule |
| --- | --- |
| Must | Use deterministic analytics payload only: totals, scopes/categories, periods, trends, and warnings. |
| Should | Explain hotspots, changes, and likely review areas without changing numbers. |
| Optional | Draft "what changed" summaries for internal review. |
| Forbidden | Recalculate totals, invent causes, claim performance verification, or declare compliance risk as fact. |

### 8. Report Section Narrative

| Category | Rule |
| --- | --- |
| Must | Use canonical report section payload, source IDs, missing fields, deterministic values, and section label. |
| Should | Draft concise prose tied to each section's evidence and review state. |
| Optional | Generate multiple tone variants for internal review. |
| Forbidden | Create unsupported report sections, invent evidence, hide placeholders, or produce final filing text without approval. |

### 9. Scope / Category Mapping Explanation

| Category | Rule |
| --- | --- |
| Must | Use deterministic mapping results, activity type, source evidence, and rule/source IDs when available. |
| Should | Explain why a mapping was suggested and what user should verify. |
| Optional | Show alternate candidate categories only if deterministic mapping exposes them. |
| Forbidden | Decide final scope/category independently, override rule engine, select emission factor, or change activity facts. |

### 10. Compliance Gap Explanation

| Category | Rule |
| --- | --- |
| Must | Use deterministic checklist/gap records only. Label as internal review/preflight, not compliance validation. |
| Should | Explain missing evidence, missing sections, or unreviewed items in plain language. |
| Optional | Suggest a reviewer checklist for guided staging beta. |
| Forbidden | Declare compliant/non-compliant, filing-ready, ISO/GHG Protocol/MOE approved, or third-party verified. |

## Touchpoints Not Worth Implementing Now

| Touchpoint | Reason |
| --- | --- |
| AI factor selection | Forbidden: deterministic factor resolution must own factor choice. |
| AI compliance decision | Forbidden: human/governed process must own compliance status. |
| AI official PDF generation | Blocked until canonical renderer, report payload, and approval flow are mature. |
| Broad chat over workspace data | Too much source-scope and tenant-leakage risk for early beta. |
| AI auto-create activity | Forbidden without human-confirmed fields. |

