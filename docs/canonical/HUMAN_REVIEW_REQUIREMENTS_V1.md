# Human Review Requirements V1

Status: canonical human review requirements for governed AI output.

Scope: CoCalLab AI touchpoints.

Parent plan:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_TOUCHPOINT_IMPLEMENTATION_PLAN_V1.md

Parent governance:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_GENERATION_GOVERNANCE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_AI_GENERATION_MATRIX.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/RAG_GOVERNANCE_V1.md

## Core Rule

AI output may help a human review faster.

AI output must not become final product truth without the required deterministic owner or human review gate.

## Review Classes

| Class | Meaning | Display Rule |
| --- | --- | --- |
| Direct Display Allowed | AI output can be shown immediately as low-risk draft guidance. | Must be labeled as AI/help/draft where appropriate. |
| Human Review Required | AI output may be shown internally but must be reviewed before external sharing, finalization, or report use. | Must show review status. |
| Never Auto-Publish | AI output can never be automatically published or treated as final decision. | Requires deterministic owner, formal workflow, or human approval. |

## AI Can Directly Display

These outputs may be shown to an authorized user immediately if they are labeled as draft/help text and do not overwrite facts.

| Touchpoint | Conditions |
| --- | --- |
| Draft Review Explanation | Internal review display only; must cite draft/source fields and show human review requirement. |
| Missing Data Explanation | Allowed when generated from deterministic missing-field records and clearly says data is missing. |
| Document Classification Explanation | Allowed when classification is candidate-only and not verification. |
| Upload/Re-upload Guidance | Allowed when based on parser/OCR warnings. |
| Reviewer Question Suggestions | Allowed when phrased as questions, not conclusions. |
| Analytics Insight Summary | Allowed for internal dashboard interpretation if it does not claim compliance or causality as fact. |

Required labels:

- `AI Draft`
- `For review`
- `Not verified`
- `Does not change source data`

## Human Review Required

These outputs require human review before external sharing, report inclusion, customer delivery, or final workflow use.

| Touchpoint | Human Review Requirement |
| --- | --- |
| Factor Explanation | Reviewer must confirm factor source/version/provenance and wording before report use. |
| Report Executive Summary | Reviewer must approve before external report sharing. |
| Report Section Narrative | Reviewer must approve every section before final report use. |
| Data Quality Explanation | Reviewer must confirm warnings and final wording before report use. |
| Activity Lineage Explanation | Reviewer must confirm if used in a report or audit trail narrative. |
| Scope / Category Mapping Explanation | Reviewer must confirm category/scope if used beyond advisory explanation. |
| Missing Data Explanation in Report | Reviewer must approve if included in report preview/export. |
| Analytics Insight Summary in Report | Reviewer must approve if included in report narrative. |

Review must verify:

- Source IDs are present.
- Missing data remains visible.
- No values were changed by AI.
- No forbidden claims appear.
- Output classification is correct.
- The user-facing context matches the workflow state.

## Never Auto-Publish

The following must never be automatically published by AI:

| Output | Reason |
| --- | --- |
| Emission totals | Calculation engine owns totals. |
| Activity quantities | User-confirmed activity records own quantities. |
| Emission factor selection | Factor resolution policy/engine owns factor choice. |
| Scope/category final classification | Deterministic rules and/or human review own final classification. |
| Boundary/legal entity/site determination | Canonical project/boundary records own reporting subject. |
| Compliance status | Formal governed workflow and human/legal review required. |
| Verification status | Qualified verifier/evidence workflow required. |
| Official filing readiness | Formal product/legal/compliance workflow required. |
| Official PDF/final report | Requires canonical renderer, versioning, and approval. |
| Product CFP or CBAM claim | Out of current AI scope. |

Forbidden auto-publish phrases:

- `compliant`
- `verified`
- `third-party verified`
- `official filing-ready`
- `approved by MOE`
- `ISO 14064 compliant`
- `GHG Protocol compliant`
- `final`
- `audited`

These phrases may appear only in controlled contexts where the source-of-record and approval workflow support them.

## Human Review Flow By Touchpoint

| Touchpoint | Direct Display? | Review Before External Use? | Never Auto-Publish? |
| --- | --- | --- | --- |
| Draft Review Explanation | Yes, internal | Yes if exported/shared | Final activity approval |
| Missing Data Explanation | Yes, internal | Yes in report | Any synthetic value |
| Factor Explanation | Internal draft only | Yes | Factor selection/compliance claim |
| Analytics Insight Summary | Yes, internal | Yes in report | Metrics/causality/compliance claim |
| Report Executive Summary | Internal draft only | Yes | Final report wording |
| Document Classification Explanation | Yes, candidate-only | Yes if used as report evidence | Document verification |
| Scope / Category Mapping Explanation | Internal draft only | Yes | Final mapping decision |
| Report Section Narrative | Internal draft only | Yes | Final report section |
| Data Quality Explanation | Internal draft only | Yes | Verified data quality status |
| Compliance Gap Explanation | Internal preflight only | Yes, with strict wording | Compliance status |

## Reviewer Roles

| Review Type | Suggested Reviewer |
| --- | --- |
| Draft field review | Workspace owner/editor or assigned reviewer. |
| Activity confirmation | Workspace owner/editor. |
| Factor explanation review | Carbon/accounting domain reviewer. |
| Report narrative review | Report owner/editor. |
| Data quality review | Report owner or audit-support reviewer. |
| Compliance-adjacent wording | Product/legal/compliance approver. |

## Review Outcomes

| Outcome | Meaning |
| --- | --- |
| Accept | Human accepts AI draft wording for the intended internal/external use. |
| Edit | Human edits output; edited version becomes reviewed text. |
| Reject | Human rejects output; it must not be used. |
| Request Regeneration | Human requests new draft from same or updated source package. |
| Block | Human blocks output because source package, evidence, or governance is insufficient. |

## Audit Requirements

Every reviewed AI output should preserve:

- Prompt template ID and version.
- Source package hash.
- Source IDs and evidence IDs.
- Model/provider/version.
- Generated output hash.
- Reviewer ID.
- Reviewer action.
- Review timestamp.
- Rejection/edit reason when applicable.
- Environment.

## Closed Beta Rule

During closed beta:

- AI outputs are internal draft/review assistance only.
- Report-related AI output must not imply formal compliance.
- AI output must be disable-able for any workspace.
- Users should see beta/staging/non-official warnings near report AI output.

