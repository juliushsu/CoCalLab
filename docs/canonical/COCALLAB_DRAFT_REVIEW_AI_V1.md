# CoCalLab Draft Review AI V1

Status: governed AI draft design.

Scope: Draft Review Explanation only.

Parent governance:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_GENERATION_GOVERNANCE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_AI_GENERATION_MATRIX.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_TOUCHPOINT_PRIORITY_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/RAG_GOVERNANCE_V1.md

## Core Rule

Draft Review AI explains extraction results so a human can review faster.

It does not approve drafts, create final activities, change quantities, select emission factors, resolve boundaries, or claim compliance.

## Intended User Value

The user should understand:

- What the OCR/extraction draft found.
- Which fields appear usable.
- Which fields are uncertain.
- Which missing fields matter before activity creation.
- What the user should review next.

The AI output is always a Level 2 `AI Draft` under the governance model. It must remain review-only until a human confirms, edits, or rejects the draft fields.

## 1. Data Provided To AI

Provide the smallest source package needed to explain the draft review state.

| Data | Allowed? | Purpose | Notes |
| --- | --- | --- | --- |
| Workspace/project scoped opaque IDs | Yes | Audit and scoping | Use IDs, not customer secrets. |
| Draft ID | Yes | Tie output to the draft being reviewed | Required for traceability. |
| Source document ID | Yes | Citation and provenance | Required. |
| Safe source label | Yes | User-readable citation | Example: `April electricity bill`, not sensitive local path. |
| Document type candidate | Yes | Explain what was likely uploaded | Must be marked as candidate if not human-confirmed. |
| OCR/extracted text spans | Yes, limited | Support citations | Provide only relevant snippets, not whole document by default. |
| Page/section/field references | Yes | Citation precision | Example: page 1, bill period field. |
| Extracted draft fields | Yes | Explain each review item | Include value, unit, period, supplier, meter/account field when relevant. |
| Extraction confidence from OCR/parser | Yes | Explain uncertainty | Confidence must be source/extraction confidence, not truth. |
| Validation warnings | Yes | Explain what needs attention | Example: missing unit, date mismatch, duplicate period. |
| Missing required fields | Yes | Guide user next step | Missing data must stay visible. |
| Review state | Yes | Explain current workflow stage | Example: pending review, edited by user, rejected. |
| Candidate activity mapping | Limited | Explain likely next step | Must be labeled candidate; cannot become final without review. |
| Related project/report period | Yes | Explain period mismatch | Must come from project metadata. |
| Existing duplicate signals | Yes | Warn user | Example: possible duplicate electricity bill for same period. |

Recommended minimum package:

| Field Group | Contents |
| --- | --- |
| Draft context | `draft_id`, project label, review state, created timestamp. |
| Source context | `source_document_id`, safe document label, page/field references. |
| Extracted fields | Field name, extracted value, unit, source span ID, extraction confidence. |
| Validation status | Missing fields, conflicts, duplicate warnings, parser warnings. |
| Review goal | Whether the user should confirm, edit, reject, or request re-upload. |

## 2. Data Not Provided To AI

Do not provide data that is unnecessary for explaining the draft review state.

| Data | Rule | Reason |
| --- | --- | --- |
| API keys, service tokens, secrets | Never provide | Security. |
| Raw `.env` values or infrastructure config | Never provide | Security. |
| Full source PDFs/images by default | Avoid | Use extracted spans unless full-document review is explicitly approved. |
| Cross-workspace documents | Never provide | Tenant isolation. |
| Documents from unrelated projects | Never provide | Scope containment. |
| User personal data not needed for review | Avoid | Data minimization. |
| Billing/subscription/payment data | Never provide | Irrelevant and sensitive. |
| Formal compliance status | Do not provide for draft explanation | AI must not reason about compliance. |
| Verification status | Do not provide as AI-decidable input | AI must not claim third-party verification. |
| Emission factor selection authority | Never provide as decision task | AI cannot choose factors. |
| Factor priority policy internals | Avoid unless explaining read-only warnings | AI cannot override policy. |
| Final report wording | Avoid | Draft Review is not report generation. |
| Hidden system/admin notes | Avoid | Prevent accidental disclosure. |

If a field is missing from the source package, the AI must say that the field is unavailable rather than infer it.

## 3. Prompt Structure

The prompt should be structured as a governed draft task, not an assistant chat.

| Section | Required Content |
| --- | --- |
| Role boundary | "You are a controlled draft generator for CoCalLab Draft Review." |
| Task | Explain extraction results and guide human review. |
| Governance | AI is not a decision maker; user review is required. |
| Allowed actions | Summarize extracted fields, explain uncertainty, show missing fields, suggest review questions. |
| Forbidden actions | Do not change values, approve the draft, choose factors, create activities, claim compliance, or invent missing data. |
| Source package | Draft ID, document ID, extracted fields, source spans, confidence, warnings, missing fields. |
| Citation requirement | Every factual statement about source content must cite a source span or field reference. |
| Confidence requirement | Confidence describes extraction/source coverage only. |
| Missing-data behavior | Explicitly state missing required fields and why they matter. |
| Output format | Short summary, field review list, warnings, next review action, citations. |
| Tone | Clear, cautious, non-legal, non-compliance, review-oriented. |

Recommended prompt order:

1. Governance boundary.
2. Task definition.
3. Source package summary.
4. Field evidence list.
5. Warnings and missing data.
6. Forbidden claims.
7. Output requirements.
8. Citation and confidence rules.

The prompt must never ask the model to decide whether the draft is correct. It may ask the model to explain what the system extracted and what the user should verify.

## 4. Citation Rules

Draft Review AI must cite the source package for source-based claims.

Allowed citations:

- `draft_id`
- `source_document_id`
- source span ID
- page number
- field reference
- OCR/parser extraction reference
- validation warning ID

Example citation forms:

- `[draft:drf_123 field:billing_period]`
- `[doc:doc_456 page:1 span:supplier_name]`
- `[warning:period_mismatch]`

Citation requirements:

| Claim Type | Citation Required? | Example |
| --- | --- | --- |
| Extracted supplier name | Yes | Cite document field/span. |
| Extracted billing period | Yes | Cite document field/span. |
| Extracted quantity | Yes | Cite document field/span and unit. |
| Missing field | Yes | Cite validation warning or missing-field record. |
| Duplicate warning | Yes | Cite deterministic duplicate signal. |
| Suggested next step | Prefer citation | Tie to warning or missing field when possible. |
| General product guidance | No source citation required, but must not claim fact. |

Forbidden citation behavior:

- Do not cite model memory.
- Do not cite unavailable pages or spans.
- Do not say "the document shows" without a source reference.
- Do not invent document IDs, page numbers, or field references.
- Do not cite a confidence score as proof of truth.

## 5. Confidence Rules

Confidence describes extraction quality or source coverage. It does not describe truth, compliance, or final correctness.

Allowed confidence labels:

| Label | Meaning |
| --- | --- |
| High extraction confidence | OCR/parser produced a clear field and source span. |
| Medium extraction confidence | Field appears plausible, but source span or format needs review. |
| Low extraction confidence | Field is uncertain, conflicting, incomplete, or weakly supported. |
| Missing | Required field is absent from the source package. |
| Conflict | Extracted field conflicts with project period, unit, duplicate check, or another deterministic signal. |

Confidence must be scoped:

- Use "extraction confidence" rather than "confidence".
- Use "source coverage" when describing whether evidence exists.
- Do not use "verified", "compliant", "correct", or "approved" for AI output.
- Do not convert confidence into automatic approval.

If numeric confidence exists from OCR/parser:

- The AI may restate it only as OCR/parser confidence.
- The AI must not recalculate it.
- The AI must not use it to override human review.

## 6. Human Review Flow

Draft Review AI sits between OCR/extraction and human confirmation.

| Step | Owner | Output |
| ---: | --- | --- |
| 1 | System/OCR/parser | Creates draft fields with source references and extraction confidence. |
| 2 | Deterministic validation | Adds missing-field warnings, conflicts, duplicates, and project-period checks. |
| 3 | AI Draft Review Explanation | Explains draft fields, uncertainty, missing data, and next review actions. |
| 4 | Human reviewer | Confirms, edits, rejects, or requests re-upload. |
| 5 | System | Creates or updates activity only from human-confirmed data. |
| 6 | Audit trail | Stores prompt template ID, source IDs, model/provider/version, output hash, reviewer action, and timestamp. |

Human reviewer actions:

| Action | Meaning | AI Role |
| --- | --- | --- |
| Confirm field | User accepts a field as review-confirmed. | AI may have explained it, but cannot confirm it. |
| Edit field | User corrects value/unit/period/category. | AI may explain why review was needed. |
| Reject field | User marks extraction as unusable. | AI may summarize why it was uncertain. |
| Request re-upload | User decides evidence is insufficient. | AI may explain missing or unreadable source. |
| Create activity | System creates activity from confirmed fields. | AI is not the actor. |

Required UI labels for future implementation:

- `AI Draft`
- `Needs human review`
- `Not verified`
- `Does not create activity until confirmed`

Audit trail requirements:

- Prompt template ID and version.
- Input source package hash.
- Draft ID.
- Source document IDs.
- Source span IDs.
- Model/provider/version.
- Generation timestamp.
- Generated output hash.
- Reviewer ID.
- Reviewer action and timestamp.

## 7. Output Example

Scenario:

- Source document: April electricity bill.
- Draft extracted supplier, billing period, electricity usage, and amount.
- One warning: billing period overlaps an existing draft.
- One missing field: meter number not found.

Example output:

> AI Draft Review Explanation
>
> This draft appears to be an electricity bill extraction. The supplier name, billing period, and electricity usage were found in the uploaded document, but the meter number was not found in the provided source spans. Please review the highlighted fields before creating an activity.
>
> Field review:
>
> - Supplier: Taiwan Power Company. Extraction confidence: high. Source: `[doc:doc_456 page:1 span:supplier_name]`
> - Billing period: 2026-04-01 to 2026-04-30. Extraction confidence: medium because the period should be checked against the project reporting period. Source: `[doc:doc_456 page:1 span:billing_period]`
> - Electricity usage: 1,240 kWh. Extraction confidence: high. Source: `[doc:doc_456 page:1 span:usage_kwh]`
> - Meter number: missing. The source package did not include a readable meter number span. Source: `[warning:missing_meter_number]`
>
> Review warnings:
>
> - Possible duplicate: another electricity draft exists for April 2026. Confirm whether this bill is a duplicate before creating an activity. Source: `[warning:possible_duplicate_period]`
>
> Suggested next action:
>
> Confirm the supplier, billing period, and usage if they match the bill. Add the missing meter number if it is visible in the document, or proceed only if your review policy allows activity creation without that field.
>
> This explanation is an AI draft for review only. It does not verify the document, create an activity, select an emission factor, or determine compliance.

## Non-Goals

This design does not define:

- OCR implementation.
- API contract.
- Database schema.
- Activity creation logic.
- Factor resolution logic.
- Report generation logic.
- Compliance validation.
- Product CFP or CBAM workflow.

## Readiness Checklist

Before any future implementation, Draft Review AI needs:

- Source package definition.
- Prompt template ID.
- Citation span model.
- Missing-field/warning model.
- Output classification label.
- Human review action model.
- Audit trail storage plan.
- Staging-only evaluation set.

