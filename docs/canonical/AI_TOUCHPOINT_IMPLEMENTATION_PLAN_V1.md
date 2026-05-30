# AI Touchpoint Implementation Plan V1

Status: canonical implementation planning document.

Scope: CoCalLab AI touchpoint planning only.

Parent governance:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_GENERATION_GOVERNANCE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_AI_GENERATION_MATRIX.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/LEXFORGE_AI_GENERATION_MATRIX.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/RAG_GOVERNANCE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_DRAFT_REVIEW_AI_V1.md

## Core Principle

AI is not a decision maker.

AI is a controlled draft generator.

This plan describes where AI may be introduced later. It does not implement AI, define APIs, define schema, create DTOs, or integrate OpenAI.

## Non-Goals

This sprint does not define or modify:

- Code.
- API endpoints.
- OpenAI integration.
- Database schema.
- DTO contracts.
- Prompt runtime.
- Vector database implementation.
- OCR implementation.
- Report PDF generation.
- Compliance validation.

## A. Touchpoint Inventory

### Documents

| Touchpoint | AI Role | Source Package | Preferred Mode | Governance Boundary |
| --- | --- | --- | --- | --- |
| Document Classification Explanation | Explain why a document appears to be an electricity bill, invoice, receipt, or unsupported file. | Document type candidate, OCR snippets, upload metadata, parser confidence. | Local + optional external LLM. | Classification is a candidate; AI cannot verify document facts. |
| Upload Completeness Guidance | Explain which expected fields are missing after upload/OCR. | Missing-field warnings, source span availability, document type candidate. | Local + external LLM. | AI must not synthesize missing values. |
| Evidence Source Explanation | Explain which document spans support extracted fields. | Source document ID, page/span IDs, extracted field references. | RAG + external LLM. | Every source-based claim needs citation. |
| Re-upload Guidance | Explain why a file may need re-upload. | Parser failure, low OCR coverage, unreadable fields. | Local + optional external LLM. | AI cannot reject evidence as final; user/system review controls state. |

### Draft

| Touchpoint | AI Role | Source Package | Preferred Mode | Governance Boundary |
| --- | --- | --- | --- | --- |
| Draft Review Explanation | Explain extraction results, uncertainty, missing fields, and next review actions. | Draft ID, document ID, extracted fields, source spans, confidence, warnings. | RAG + external LLM. | AI cannot approve draft, change values, or create activity. |
| Field Uncertainty Explanation | Explain why a field is low confidence or conflicting. | OCR confidence, parser warnings, validation warnings. | Local/RAG + external LLM. | Confidence is extraction confidence, not truth. |
| Missing Data Explanation | Explain missing fields and why they matter before activity/report use. | Missing-field records, workflow context, report requirements when available. | Local + external LLM. | Missing values must remain visible. |
| Duplicate/Conflict Explanation | Explain deterministic duplicate or period conflicts. | Duplicate signals, project period, draft metadata. | Local + optional external LLM. | AI cannot decide whether duplicate is true; human confirms. |

### Activity

| Touchpoint | AI Role | Source Package | Preferred Mode | Governance Boundary |
| --- | --- | --- | --- | --- |
| Activity Lineage Explanation | Explain how a human-confirmed draft became an activity. | Draft ID, activity ID, confirmed fields, source document references. | RAG + external LLM. | AI cannot create or alter activity facts. |
| Scope / Category Mapping Explanation | Explain why deterministic mapping suggests a scope/category. | Mapping rule result, activity type, source evidence, factor metadata if available. | Local/RAG + external LLM. | AI cannot decide final scope/category if governance rules require review. |
| Missing Metadata Questions | Suggest questions a reviewer should answer before activity finalization. | Missing activity metadata, validation rules. | Local + external LLM. | AI can ask questions, not fill answers. |
| Factor Candidate Context | Explain factor candidate metadata after deterministic retrieval. | Factor source IDs, factor version, activity context. | RAG + external LLM. | AI cannot choose factor or override factor priority. |

### Analytics

| Touchpoint | AI Role | Source Package | Preferred Mode | Governance Boundary |
| --- | --- | --- | --- | --- |
| Analytics Insight Summary | Explain hotspots, trends, and changes from computed analytics. | Deterministic analytics payload, category totals, period comparison. | Local + external LLM. | AI cannot alter metrics or claim compliance. |
| Anomaly Explanation | Explain why a computed anomaly may need review. | Deterministic anomaly flag, related activities, period comparison. | Local/RAG + external LLM. | AI cannot decide anomaly root cause as fact. |
| Reviewer Question Suggestions | Suggest questions for the user to investigate. | Analytics warnings, missing data, outlier signals. | Local + external LLM. | Questions are advisory only. |

### Report

| Touchpoint | AI Role | Source Package | Preferred Mode | Governance Boundary |
| --- | --- | --- | --- | --- |
| Report Executive Summary | Draft a concise report summary from canonical report payload. | Report payload, totals, warnings, missing data, source IDs. | RAG + external LLM. | Draft only; no compliance or verification claim. |
| Report Section Narrative | Draft section prose for report preview. | Section payload, calculation results, source IDs, missing fields. | RAG + external LLM. | Must be reviewed before external use. |
| Factor Explanation | Explain factor source, version, and provenance. | Factor source metadata, factor snapshot, retrieval IDs. | RAG + external LLM. | AI explains source; deterministic policy chooses factor. |
| Data Quality Explanation | Explain warnings, missing evidence, and review status. | Validation warnings, source coverage, review state. | Local/RAG + external LLM. | AI cannot mark data quality as final/verified. |
| Compliance Gap Explanation | Explain visible gaps against a checklist without declaring compliance. | Deterministic checklist status, missing sections, required evidence. | Local/RAG + external LLM. | AI cannot declare compliant, non-compliant, or filing-ready. |

## B. Priority Ranking

Priority is based on:

1. User value.
2. Implementation risk.
3. AI hallucination risk.
4. Cost.
5. Governance maturity.

| Priority | Touchpoint | Main Flow | Rationale |
| ---: | --- | --- | --- |
| 1 | Draft Review Explanation | Draft | Highest readiness: narrow source package, clear human review flow, strong value in OCR review. |
| 2 | Missing Data Explanation | Draft/Report | High trust value, low hallucination risk if driven by deterministic missing-field records. |
| 3 | Factor Explanation | Activity/Report | Core trust risk; requires RAG source IDs but has clear forbidden boundary. |
| 4 | Report Executive Summary | Report | Highest paid-value signal, but depends on canonical report payload and review labeling. |
| 5 | Data Quality Explanation | Report | Strong governance fit; useful before external report use. |
| 6 | Document Classification Explanation | Documents | Helpful, low-cost, but must remain candidate-only. |
| 7 | Analytics Insight Summary | Analytics | Valuable once analytics payload is stable; moderate risk of overclaiming causality. |
| 8 | Report Section Narrative | Report | Valuable but broader surface area and higher review burden. |
| 9 | Scope / Category Mapping Explanation | Activity | Useful but close to governed classification decisions; needs careful deterministic owner. |
| 10 | Compliance Gap Explanation | Report | High user interest but highest compliance-claim risk; should wait for mature checklist model. |

## C. Candidate Touchpoints

| Candidate | Recommended Phase | Ready Now? | Reason |
| --- | --- | --- | --- |
| Draft Review Explanation | Phase 1 | Yes, design-ready | Detailed governed design exists in `COCALLAB_DRAFT_REVIEW_AI_V1.md`. |
| Missing Data Explanation | Phase 1 | Partial | Needs deterministic missing-field package. |
| Factor Explanation | Phase 1/2 | Partial | Needs factor source IDs, versions, and retrieval package. |
| Analytics Insight Summary | Phase 2 | Partial | Needs stable analytics read model and prompt guardrails. |
| Report Executive Summary | Phase 2 | Partial | Needs canonical report payload and preview disclaimers. |
| Document Classification Explanation | Phase 1 | Partial | Needs document type candidate and OCR coverage source package. |
| Scope / Category Mapping Explanation | Phase 3 | Not first | Close to governed activity classification decisions. |
| Report Section Narrative | Phase 3 | Not first | Larger review surface and report section persistence/model dependency. |
| Data Quality Explanation | Phase 2 | Partial | Needs data quality warning package. |
| Compliance Gap Explanation | Phase 3 | Not first | Highest risk of users reading it as compliance validation. |

## D. Must / Should / Optional / Forbidden

Detailed per-touchpoint rules are canonicalized in:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_AI_TOUCHPOINT_PRIORITY_MATRIX.md

## E. Budget Model

Budget allocation for a 100 USD/month OpenAI budget is canonicalized in:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_BUDGET_ALLOCATION_V1.md

Planning summary:

- Spend first on narrow, source-backed, review-only explanations.
- Avoid spending on static UI copy, deterministic calculations, routing, permissions, factor selection, compliance decisions, and official PDF generation.
- Cap exploratory report narrative generation until report payload and review flow are mature.

## F. Human Review Requirement

Human review rules are canonicalized in:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/HUMAN_REVIEW_REQUIREMENTS_V1.md

Planning summary:

- AI may directly display low-risk guidance only when clearly labeled as draft/help text and not used as final fact.
- Report narratives, factor explanations, data quality statements, and compliance-gap explanations require human review before external sharing.
- Compliance, verification, factor selection, emissions totals, and official filing readiness can never be auto-published by AI.

## G. Implementation Order

### Phase 1: Narrow Guided Draft Assistance

Goal: reduce user confusion without touching final facts.

Recommended touchpoints:

1. Draft Review Explanation.
2. Missing Data Explanation.
3. Document Classification Explanation.
4. Factor Explanation, only if factor source package is available.

Exit criteria:

- Source packages exist for each touchpoint.
- Prompt template IDs are defined.
- Forbidden claims are explicit.
- Output labels show `AI Draft` and `Needs human review`.
- Outputs can be disabled without breaking the workflow.
- Audit trail plan exists.

### Phase 2: Trust and Report Preview Assistance

Goal: help users understand analytics/report preview while preserving review boundaries.

Recommended touchpoints:

1. Report Executive Summary.
2. Data Quality Explanation.
3. Analytics Insight Summary.
4. Factor Explanation expansion.

Exit criteria:

- Canonical report payload is stable.
- Missing data and source IDs are included in generation package.
- Report preview clearly says staging/internal review/non-official if applicable.
- Human review path exists before external sharing.

### Phase 3: Higher-Risk Narrative and Compliance-Adjacent Assistance

Goal: support advanced workflows only after deterministic owners are mature.

Recommended touchpoints:

1. Report Section Narrative.
2. Scope / Category Mapping Explanation.
3. Compliance Gap Explanation.

Exit criteria:

- Deterministic checklist/rule owners exist.
- Category/scope ownership is not AI.
- Compliance wording has legal/product approval.
- All outputs remain review-only until approved.

## First AI Touchpoint Recommendation

The first touchpoint to implement later should be:

Draft Review Explanation.

Reason:

- It directly reduces user confusion in the document-to-activity value chain.
- It is already governed by a dedicated design document.
- It can operate on a compact source package.
- It has lower hallucination risk than report narrative.
- It cannot create final facts when implemented with the required human review gate.

## Least Recommended Near-Term Touchpoint

The least recommended touchpoint right now is:

Compliance Gap Explanation.

Reason:

- Users may misread it as formal compliance validation.
- It depends on mature checklist/rule ownership.
- It has high regulatory wording risk.
- It should wait until report, boundary, factor, data quality, and human review paths are stronger.

