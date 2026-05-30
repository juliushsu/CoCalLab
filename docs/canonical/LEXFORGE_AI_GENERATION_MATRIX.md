# LexForge AI Generation Matrix

Status: product-specific matrix under AI Generation Governance V1.

Parent governance:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_GENERATION_GOVERNANCE_V1.md

## Core Rule

AI in LexForge is a controlled legal-learning and legal-drafting assistant. It is not the owner of legal sources, legal effects, case holdings, statutes, judgments, or final legal advice.

## Fact Ownership

| Fact | AI May Decide? | Owner | Notes |
| --- | --- | --- | --- |
| Statute text | No | Official legal source / controlled legal database | AI may summarize retrieved text only. |
| Regulation text | No | Official legal source / controlled legal database | No model-memory law text. |
| Judgment text | No | Court source / controlled database | AI may quote/summarize with citation IDs. |
| Case number | No | Court source / database | Never hallucinate. |
| Court/date/party metadata | No | Court source / database | AI can restate. |
| Legal effect | No | Source law/judgment + reviewer | AI cannot declare legal consequence without source. |
| Precedent/authority status | No | Jurisdiction-specific source model + reviewer | Must be source-backed. |
| Dominant doctrine / common view | No | Editorial/legal source curation | AI cannot invent "通說". |
| Simulated answer | Draft only | AI + reviewer/user | Must be labeled draft or educational. |
| Legal opinion | Draft only | Lawyer/human reviewer | Must be reviewed before use. |

## Allowed AI Tasks

| Task | Level | Allowed Output | Required Sources | Human Review |
| --- | ---: | --- | --- | --- |
| Question analysis | 2 | Draft explanation | Prompt + retrieved legal sources where factual | Required for published answer |
| Statute summary | 2 | Source-backed summary | Retrieved statute text | Review for publication |
| Case comparison | 2 | Source-backed comparison | Retrieved judgments/case IDs | Review required |
| Issue spotting | 2 | Draft issue list | User question + source pack | Review if final |
| Argument structure | 2 | Draft outline | Cited sources | Review required |
| Study explanation | 2 | Educational draft | Source-backed if citing law | Review for published materials |

## Forbidden AI Tasks

| Forbidden Task | Reason |
| --- | --- |
| Invent statute text | Source of law must be official/controlled. |
| Invent judgment text | Court record must be source-owned. |
| Invent case number | Case identity is source-owned. |
| Invent "通說" / consensus | Requires editorial/legal source basis. |
| Declare legal effect without citation | High-stakes legal accuracy. |
| Provide final legal advice without human review | Human professional responsibility. |
| Hide uncertainty or missing authority | Missing source must remain visible. |
| Use model memory as citation | Citations must come from retrieval/source IDs. |

## LexForge Generation Levels

| Workflow Step | Level | Current / Target |
| --- | ---: | --- |
| Source retrieval | 1 | Retrieve statute/judgment/excerpt by ID. |
| Legal explanation draft | 2 | AI drafts from source pack. |
| Simulated answer | 2 | AI draft, educational label. |
| Editorial review | 3 | Human/legal reviewer approves. |
| Published explanation | 4 | Final version with citations. |
| Legal opinion | 3/4 only | Must be human reviewed. |

## Output Classification

| Output | Classification Before Review | After Review | Immutable? |
| --- | --- | --- | --- |
| Statute summary | Draft | Verified if citation checked | Published source-backed version should be versioned |
| Case comparison | Draft | Verified if case citations checked | Versioned |
| Simulated answer | Draft/Review | Final educational answer | Versioned |
| Legal opinion | Draft/Review | Final only with human lawyer approval | Immutable/client record when delivered |

## Required Human Review

Human review is required for:

- Published simulated answers.
- Legal opinions.
- Case-law comparisons used for client/work output.
- Any statement about legal effect.
- Any statement that claims doctrinal consensus.
- Any answer where source retrieval is incomplete.

## Audit Trail

LexForge AI generation should store or reference:

- Prompt template ID.
- Prompt variables.
- Model/provider/version.
- Retrieval query.
- Statute IDs.
- Judgment IDs.
- Case numbers.
- Citation spans.
- Generated output hash.
- Reviewer ID.
- Approval/rejection timestamp.
- Jurisdiction.
- Source database version.

## Product Copy Rule

LexForge AI output must be labeled according to use:

- Educational draft.
- Source-backed summary.
- Reviewed answer.
- Legal opinion draft.
- Final legal opinion.

No AI-only output may be marketed as authoritative legal advice.

