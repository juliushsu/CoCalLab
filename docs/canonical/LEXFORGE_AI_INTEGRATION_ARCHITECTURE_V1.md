# LexForge AI Integration Architecture V1

Status: canonical integration architecture.

Parent governance:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_GENERATION_GOVERNANCE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/LEXFORGE_AI_GENERATION_MATRIX.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/RAG_GOVERNANCE_V1.md

## Core Rule

LexForge AI is a controlled legal-learning and legal-drafting assistant. It may organize, explain, compare, and draft from controlled legal sources. It must not invent law, invent cases, decide legal effect, or produce final legal advice without human review.

## Architecture Layers

| Layer | Purpose | AI Role |
| --- | --- | --- |
| Source Registry | Owns statutes, regulations, judgments, case IDs, source metadata, jurisdiction, and versioning. | No AI ownership. |
| Retrieval Layer | Retrieves controlled source passages and citation spans. | AI may consume retrieved source package. |
| Draft Generation Layer | Produces educational explanations, issue maps, summaries, and comparisons. | External LLM or local model may draft with constraints. |
| Review Layer | Human/editor/lawyer verifies citations, legal effect, and final wording. | AI output remains draft until reviewed. |
| Publication Layer | Delivers reviewed answers, study materials, or legal opinion drafts/finals. | Must preserve citation and audit trail. |

## Integration Vocabulary

| Category | Meaning |
| --- | --- |
| Must | Required to avoid hallucination or legal-source drift. |
| Should | Strongly recommended for product value and trust. |
| Optional | Useful after source and review architecture are stable. |
| Forbidden | Not allowed under canonical governance. |

## Legal Workflow Matrix

| Workflow | Must | Should | Optional | Forbidden | Preferred Mode |
| --- | --- | --- | --- | --- | --- |
| Question Intake | Capture user question, jurisdiction, topic, and intended use. | Classify whether the request is educational, drafting, research, or legal advice. | Ask clarifying questions. | Treat user facts or desired answer as verified law. | Local for metadata; external LLM optional for classification. |
| Source Retrieval | Retrieve statutes, regulations, judgments, and editorial sources by stable IDs. | Show source coverage and missing-source warnings. | Rank sources by relevance. | Use model memory as citation or fabricate unavailable source text. | RAG. |
| Issue Spotting | Identify legal issues from question and retrieved source pack. | Tie each issue to source IDs or mark as uncited draft reasoning. | Generate study-oriented issue maps. | Declare final legal effect or authority status without source/review. | RAG + external LLM. |
| Statute Summary | Summarize retrieved statute text. | Preserve article numbers, source IDs, and version date. | Produce plain-language explanations. | Rewrite statute as if it were official text. | RAG + external LLM. |
| Case Comparison | Compare retrieved judgments and holdings. | Cite case numbers, courts, dates, and relevant spans. | Produce comparison tables or argument outlines. | Invent case numbers, holdings, or "common view". | RAG + external LLM. |
| Simulated Answer | Draft educational answer from source package. | Label as draft or educational unless reviewed. | Suggest scoring/structure improvements. | Market AI-only answer as authoritative legal advice. | RAG + external LLM + human review. |
| Legal Opinion Draft | Draft structure and source-backed discussion for human lawyer/editor. | Require explicit human review and approval state. | Generate risk checklist. | Produce final legal opinion without reviewer approval. | RAG + external LLM + mandatory human review. |

## Local vs RAG vs External LLM

| Capability | Local | RAG | External LLM | Notes |
| --- | --- | --- | --- | --- |
| User/session/permission state | Must | No | No | Deterministic access control. |
| Jurisdiction/topic metadata | Must | Optional | Optional | AI may classify, but metadata remains reviewable. |
| Statute text | No as generation | Must | Forbidden as source | Source registry/RAG owns law text. |
| Judgment text | No as generation | Must | Forbidden as source | Court/source DB owns judgments. |
| Case number/court/date | Must/RAG | Must | Forbidden as source | AI may restate only. |
| Citation extraction | Local/RAG | Must | Optional for formatting | Must preserve source spans. |
| Issue spotting | Optional | Should | Should | Draft only. |
| Statute summary | No as source | Must | Should | Summary must cite retrieved statute. |
| Case comparison | No as source | Must | Should | Must cite retrieved cases. |
| Simulated answer | Optional structure | Must | Should | Educational/draft label. |
| Legal opinion | Local workflow | Must | Optional draft only | Human review is mandatory. |

## OpenAI Budget: 100 USD / Month

With a 100 USD/month OpenAI budget, prioritize source-backed legal learning outputs that are short, repeatable, and clearly labeled.

| Rank | Touchpoint | Allocation | Reason |
| ---: | --- | ---: | --- |
| 1 | Source-backed question analysis | 30% | Core user value; helps users understand what the problem is asking. |
| 2 | Statute summary from retrieved text | 20% | High trust when citations are visible. |
| 3 | Simulated answer draft | 20% | Strong paid value, but must remain educational/reviewed. |
| 4 | Case comparison from retrieved judgments | 15% | Valuable but token-heavy; use selectively. |
| 5 | Issue spotting / outline | 10% | Useful and low cost when source package is compact. |
| 6 | Clarifying questions | 5% | Cheap, helpful, but not core monetization. |

Budget guardrails:

- Do not use external LLM as source of law.
- Do not spend budget retrieving or restating full source text when excerpts are enough.
- Avoid long case comparisons unless the user explicitly requests them.
- Cache source-backed summaries by source version and prompt template.
- Keep legal-opinion generation behind human review.

## Required Source Package

Every governed LexForge generation should receive:

- User question.
- Jurisdiction.
- Intended use label: educational, drafting, research, legal opinion draft.
- Retrieved statute IDs and spans.
- Retrieved judgment IDs and spans.
- Source version/date.
- Missing sources.
- Forbidden claims.
- Output classification.
- Human review requirement.

## Output Labels

| Output | Default Label |
| --- | --- |
| Question analysis | Educational draft |
| Statute summary | Source-backed draft |
| Case comparison | Source-backed draft |
| Simulated answer | Educational draft / reviewed answer after approval |
| Legal opinion draft | Lawyer review required |
| Final legal opinion | Human-approved final |

## Architecture Risks

| Risk | Containment |
| --- | --- |
| Model invents law | Never allow model memory as citation; require source IDs. |
| User mistakes draft for legal advice | Clear labels and review gates. |
| Case comparison hallucinates holding | Retrieved judgment spans required. |
| Outdated law | Source version/date displayed and tracked. |
| Cross-matter leakage | Retrieval must respect matter/user scope. |
| Token budget overrun | Use compact source packages and cached summaries. |

## Implementation Readiness

Before implementation, LexForge needs:

- Controlled source registry.
- Retrieval index with stable IDs.
- Citation span model.
- Prompt template registry.
- Output classification.
- Human review workflow.
- Audit trail for source package, model, output hash, and reviewer.

