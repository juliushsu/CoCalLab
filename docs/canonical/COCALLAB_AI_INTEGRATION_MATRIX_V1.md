# CoCalLab AI Integration Matrix V1

Status: canonical integration guidance.

Parent governance:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_GENERATION_GOVERNANCE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_AI_GENERATION_MATRIX.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/RAG_GOVERNANCE_V1.md

## Core Rule

AI in CoCalLab should be integrated only where it makes the user faster, clearer, or more confident without taking ownership of governed facts.

AI must not become the calculation engine, factor-resolution engine, boundary owner, compliance authority, or verification authority.

## Integration Vocabulary

| Category | Meaning |
| --- | --- |
| Must | Required to deliver the intended value moment safely or clearly. |
| Should | Strongly recommended once the deterministic path is stable. |
| Optional | Useful enhancement, but not required for closed beta or core value. |
| Forbidden | Not allowed under canonical governance. |

## Architecture Vocabulary

| Mode | Meaning | Use In CoCalLab |
| --- | --- | --- |
| Local | Deterministic code, database reads, local rules, local classification, or local UI logic. | Emissions totals, activity calculations, report status, permissions, routing, warnings. |
| RAG | Retrieval over controlled sources with source IDs and auditability. | Factor explanations, document evidence explanation, missing-data explanation, report section support. |
| External LLM | Draft generation by an external model provider. | Narrative drafting, executive summaries, user-facing explanations after source package is prepared. |

## Flow Matrix

| Flow | Must | Should | Optional | Forbidden | Preferred Mode |
| --- | --- | --- | --- | --- | --- |
| Documents | Preserve upload metadata, document IDs, file type, project/workspace scope, and upload status deterministically. | Extract visible text or structured bill fields into a draft package when OCR is available. | AI can explain what kind of document was uploaded and what fields may be missing. | AI must not invent bill values, billing period, supplier, meter data, or treat a document as verified without review. | Local for upload/status; RAG for evidence snippets; external LLM optional for explanation. |
| Draft | Show extraction as editable/reviewable draft, not final activity data. | Use AI to explain uncertain fields and ask for reviewer confirmation. | Suggest likely field mappings when backed by OCR evidence. | AI must not auto-approve drafts, hide low confidence, or convert missing values into synthetic values. | Local for review state; RAG for source/evidence spans; external LLM for review guidance. |
| Activity | Activity quantities, units, dates, and emission calculations must remain deterministic/user-confirmed. | AI can explain why an activity was generated from a draft and what evidence supports it. | AI can suggest missing activity metadata questions. | AI must not change activity values, choose emission factors, override factor priority, or create final activities without user confirmation. | Local for writes/calculation; RAG for evidence; external LLM limited to explanatory copy. |
| Analytics | Computed totals, charts, category breakdowns, and trend values must be deterministic. | AI can explain trends, hotspots, and anomalies using computed analytics payloads. | AI can create plain-language insight cards for internal review. | AI must not change totals, rank compliance risk as fact, or claim verified environmental performance. | Local for metrics; external LLM for draft explanation; RAG if sources/evidence are cited. |
| Report | Report payload, sections, totals, boundaries, reporting period, source IDs, and warnings must come from canonical data. | AI can draft executive summary, missing-data explanation, factor-source explanation, and section narrative with citations. | AI can generate reviewer questions or client-facing plain-language notes. | AI must not claim formal compliance, third-party verification, official filing readiness, or generate official PDF without approved report renderer and review. | Local for report snapshot/status; RAG for sources/citations; external LLM for draft narrative. |

## Touchpoint Detail

### Documents

AI posture:

- Must: preserve factual provenance and upload state outside AI.
- Should: use retrieval/extraction to create evidence-backed draft fields.
- Optional: explain document type and missing fields.
- Forbidden: turn raw upload into verified emissions data.

Budget posture:

- Do not spend external LLM budget on basic upload confirmation.
- Use OCR/extraction first; reserve external LLM for unclear document explanation or user guidance.

### Draft

AI posture:

- Must: keep draft state visible.
- Should: explain uncertainty and guide human review.
- Optional: suggest normalized field names.
- Forbidden: auto-approve or silently rewrite source facts.

Budget posture:

- Highest near-term value when users do not understand why OCR output needs review.
- Use small prompts over structured extraction payloads, not raw full documents unless necessary.

### Activity

AI posture:

- Must: keep activity creation deterministic and review-driven.
- Should: explain lineage from document to draft to activity.
- Optional: suggest missing metadata questions.
- Forbidden: choose factors, alter quantities, or decide final activity classification if governance rules do not support it.

Budget posture:

- Spend modestly on lineage explanation only when it increases trust.
- Keep calculations fully local.

### Analytics

AI posture:

- Must: compute all numbers locally.
- Should: explain hotspots and trend changes from computed data.
- Optional: draft "what changed" summaries for guided beta users.
- Forbidden: infer compliance, verification, or uncomputed performance claims.

Budget posture:

- High perceived value, but should come after Documents/Draft/Report because analytics explanation depends on trustworthy input data.

### Report

AI posture:

- Must: use canonical report payload and source IDs.
- Should: draft narrative sections with missing-data visibility.
- Optional: draft reviewer checklist or client-facing summary.
- Forbidden: official compliance claims, formal verification claims, or final filing language.

Budget posture:

- Highest willingness-to-pay touchpoint.
- External LLM should be used here only after deterministic report payload, missing-data warnings, and source package are available.

## OpenAI Budget: 100 USD / Month

With a 100 USD/month OpenAI budget, prioritize high-trust, high-visibility, low-token touchpoints.

| Rank | Touchpoint | Allocation | Reason |
| ---: | --- | ---: | --- |
| 1 | Report executive summary draft | 35% | Most visible value and closest to willingness-to-pay. |
| 2 | Draft review explanation | 20% | Reduces user confusion and supports document-to-activity trust. |
| 3 | Missing-data explanation in report preview | 15% | Prevents false confidence and supports guided beta. |
| 4 | Factor-source explanation | 15% | Builds trust where users are likely to challenge numbers. |
| 5 | Analytics hotspot explanation | 10% | Helpful, but depends on earlier data quality. |
| 6 | Document type / field guidance | 5% | Useful but should stay lightweight. |

Budget guardrails:

- Do not spend budget generating official PDF content.
- Do not spend budget on route/page copy that can be static.
- Do not send full documents when structured extracted fields are enough.
- Cache generation outputs by report/draft/source hash when possible in future implementation.
- Prefer short, structured prompts with explicit forbidden claims.

## Local vs RAG vs External LLM

| Capability | Local | RAG | External LLM | Notes |
| --- | --- | --- | --- | --- |
| Upload status | Must | No | No | Deterministic UI/system state. |
| OCR text extraction | Should | Optional for retrieval index | No | Extraction is not narrative generation. |
| Draft field review state | Must | No | No | Human review workflow owns state. |
| Draft uncertainty explanation | Should | Should | Optional/Should | External LLM only over source package. |
| Activity calculation | Must | No | Forbidden | AI cannot change calculation. |
| Factor resolution | Must | Optional for source lookup | Forbidden | AI may explain, never decide. |
| Factor explanation | Local source package | Must | Should | RAG source IDs are required. |
| Analytics numbers | Must | No | Forbidden | Computed facts only. |
| Analytics explanation | Local payload | Optional | Should | Draft narrative only. |
| Report payload | Must | Should | Forbidden | Payload is canonical fact package. |
| Report narrative | Local package | Must | Should | Human review required. |
| Compliance statement | Must be human/governed | Optional evidence | Forbidden as AI-only | No AI-only compliance claims. |

## Closed Beta Scope

For narrow, guided, staging-only closed beta:

- Enable AI only as draft/review assistance.
- Label AI output as draft or internal review.
- Prefer Report, Draft Review, and Factor Explanation over broad assistant chat.
- Keep Product CFP, CBAM, and formal compliance workflows outside AI scope.
- Do not expose any AI output as final, verified, or official filing-ready.

## Implementation Readiness

Before implementation, each AI touchpoint needs:

- Prompt template ID.
- Input package contract.
- Source IDs or explicit no-source label.
- Forbidden claims list.
- Missing-data behavior.
- Output classification.
- Human review step.
- Audit trail plan.

