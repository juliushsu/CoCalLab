# CoCalLab AI Generation Matrix

Status: product-specific matrix under AI Generation Governance V1.

Parent governance:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_GENERATION_GOVERNANCE_V1.md

## Core Rule

AI in CoCalLab is a controlled report-draft assistant. It is not the owner of emissions facts, factor resolution, boundary decisions, compliance status, or verification status.

## Fact Ownership

| Fact | AI May Decide? | Owner | Notes |
| --- | --- | --- | --- |
| Emission amount | No | Calculation engine / stored calculation result | AI may explain a value but cannot change it. |
| Activity quantity | No | User-confirmed activity / document extraction review | AI may draft extraction, but human confirmation controls final activity. |
| Emission factor | No | Factor registry / factor resolution engine | AI may explain factor metadata after retrieval. |
| Factor resolution priority | No | Deterministic factor-resolution policy | AI cannot choose "best" factor independently. |
| Boundary | No | Project/boundary model + human reviewer | AI may explain boundary implications. |
| Legal entity | No | Workspace/legal entity records | AI cannot infer official reporting subject. |
| Site/facility | No | Site/facility records | AI cannot invent facility scope. |
| Reporting period | No | Project/report metadata | AI can restate only. |
| Compliance status | No | Human reviewer / formal compliance workflow | AI cannot declare compliant. |
| Verification status | No | Verification workflow / qualified verifier | AI cannot claim third-party verification. |
| Report narrative | Draft only | AI + human reviewer | Must remain reviewable before final output. |

## Allowed AI Tasks

| Task | Level | Allowed Output | Required Sources | Human Review |
| --- | ---: | --- | --- | --- |
| Executive summary | 2 | Draft narrative | Report payload, totals, warnings | Required before external sharing |
| Report narrative | 2 | Draft section prose | Report payload and section DTO | Required |
| Missing data explanation | 2 | Draft explanation | Data gaps, pending activities, warnings | Required before final |
| Trend explanation | 2 | Draft explanation | Analytics/read model | Required for report |
| Factor explanation | 2 | Source-backed explanation | Factor source metadata and factor snapshot | Required for report |
| Data quality explanation | 2 | Draft quality note | QA flags, warnings, review states | Required |
| Translation/simplification | 2 | Draft copy | Approved source text | Review if external |

## Forbidden AI Tasks

| Forbidden Task | Reason |
| --- | --- |
| Change emission totals | Deterministic calculation must own values. |
| Change activity quantities | User-reviewed activity data owns quantities. |
| Choose emission factor | Factor resolution must be deterministic/governed. |
| Override factor priority | Governance policy owns priority. |
| Infer legal entity/site | Boundary records must own reporting subject. |
| Declare compliance | Human/legal/regulatory process required. |
| Claim ISO/GHG Protocol/MOE compliance | Requires formal controls and review. |
| Claim third-party verification | Requires verifier and evidence. |
| Fill missing documents with prose | Missing data must remain visible. |
| Generate official filing PDF | PDF/export requires canonical renderer and approval. |

## CoCalLab Generation Levels

| Workflow Step | Level | Current / Target |
| --- | ---: | --- |
| OCR extraction draft | 2 | AI may create draft; user confirms. |
| Draft review confirmation | 3 | Human confirms/rejects. |
| Activity calculation | 0 | Deterministic calculation. |
| Factor resolution | 0 | Deterministic/governed. |
| Analytics summary | 0/1 | Computed/read model. |
| Report summary draft | 2 | AI draft over deterministic report payload. |
| Report review | 3 | Human review required. |
| Report final snapshot | 4/Immutable | Requires approval/versioning. |
| Compliance statement | 3/4 only | Must not be AI-only. |

## Output Classification

| Output | Classification Before Review | After Review | Immutable? |
| --- | --- | --- | --- |
| Extracted draft | Draft | Review / accepted activity | Activity record becomes governed data |
| Report section prose | Draft | Verified or Final | Final report version should be immutable |
| AI audit/preflight | Review | Verified if reviewer approves | Audit result should be retained |
| Factor explanation | Draft | Verified if source-backed and approved | Snapshot in report should be immutable |
| Missing-data explanation | Draft | Verified if reviewer accepts | Snapshot in report should be immutable |

## Required Human Review

Required before external sharing:

- Report narrative.
- Executive summary.
- Factor explanation.
- Boundary explanation.
- Missing-data explanation.
- Any compliance-related statement.
- Any PDF/exported report.

Required before finalization:

- Inclusion/exclusion rationale.
- Adjustment narrative.
- Data quality statement.
- Evidence appendix wording.

## Audit Trail

CoCalLab AI generation should store or reference:

- `organization_id` / workspace ID.
- `project_id`.
- `report_generation_id` where applicable.
- `source_document_id` / `draft_id` / `activity_id` / `calculation_result_id`.
- `factor_id` / factor version / source ID.
- Prompt template ID.
- Prompt variables.
- Model/provider/version.
- Retrieval source IDs.
- Generated output hash.
- Reviewer ID.
- Approval/rejection timestamp.
- Environment.

## Closed-Beta Rule

During closed beta:

- AI report content is draft/review only.
- Report Preview must show `非正式申報 / 非第三方查驗 / Staging Preview Only`.
- Export/PDF must not imply formal filing readiness.
- Missing data must remain visible.

