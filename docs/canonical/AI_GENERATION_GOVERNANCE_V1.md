# AI Generation Governance V1

Status: canonical cross-project governance.

Applies to:
- CoCalLab
- LexForge
- Hoshisumi
- Lemma
- Future SaaS products

Core principle:

AI is not a decision maker.

AI is a controlled draft generator.

## Purpose

This document defines how AI-generated outputs are allowed to participate in product workflows. It is intentionally product-agnostic and should be treated as the baseline for future AI features across projects.

AI may help users understand, summarize, draft, compare, explain, and organize information. AI must not own facts, legal conclusions, compliance status, numerical calculations, financial values, property records, or final user-facing decisions unless a human and deterministic system layer have already established those facts.

## Generation Levels

| Level | Name | Definition | Examples | Governance Rule |
| ---: | --- | --- | --- | --- |
| 0 | Deterministic | Output produced by code, database, rules, calculations, or verified static source | Emission total, statute text, property address, subscription status | AI must not alter. |
| 1 | Retrieval | Output retrieved from controlled sources without generation | Citation snippet, document extract, source row, evidence item | AI may cite/summarize with source IDs. |
| 2 | AI Draft | AI-generated explanation, summary, narrative, recommendation, or comparison | Executive summary, legal issue explanation, trend explanation | Must be labeled draft/review unless human-approved. |
| 3 | Human Review | Human confirms, edits, rejects, or approves AI draft | Report reviewer, lawyer/editor, property ops reviewer | Required for high-impact outputs. |
| 4 | Final Output | User-facing or externally shared final output | Final report, legal answer, client deliverable, listing content | Must preserve source/audit trail and approval state. |

## Universal Rule

AI output can move from Level 2 to Level 4 only through Level 3 human review, unless the output is explicitly labeled as low-risk non-decision copy.

## Fact Ownership Matrix

These facts cannot be decided by AI. They must originate from deterministic systems, canonical data, controlled retrieval, or human-entered/approved facts.

| Product | Facts AI Must Not Decide | Canonical Owner |
| --- | --- | --- |
| CoCalLab | Emission amounts, activity quantities, emission factors, factor resolution, boundary, legal entity, site/facility, report period, compliance status, verification status, official filing readiness | Database, calculation engine, factor registry, boundary model, human reviewer |
| LexForge | Statute text, regulation text, judgment text, case number, court, date, legal effect, precedent status, authoritative holding, final legal advice | Legal source database, court/government source, editor/lawyer reviewer |
| Hoshisumi | Property record, address, price, rent, building area, land area, floor, year built, ownership/availability, listing status, coordinates | Property source feed, CRM/database, human ops reviewer |
| Lemma | Canonical research facts, source text, evaluation score, benchmark result, accepted answer, user identity, billing/entitlement state | Dataset/source registry, deterministic evaluator, product database |
| Future SaaS | Customer records, billing state, permissions, contractual status, regulatory claims, numeric calculations, source-of-record identity | Product database, deterministic rules, human approver |

## AI Allowed Tasks

AI may perform controlled drafting tasks when the factual substrate is provided by Level 0 or Level 1 sources.

Allowed task families:

- Summarize retrieved or computed facts.
- Explain why data is missing or incomplete.
- Draft narrative around deterministic results.
- Compare evidence from cited sources.
- Generate user guidance based on declared product rules.
- Translate or simplify already-approved content.
- Suggest questions for human review.

Forbidden task families:

- Create source facts.
- Alter deterministic values.
- Pick regulatory/compliance status.
- Invent citations, laws, cases, coefficients, addresses, prices, or records.
- Convert draft output into final output without human review.
- Hide missing data.
- Use confidence language as a substitute for source evidence.

## Product Examples

### CoCalLab

AI can:
- Draft executive summaries.
- Draft report narratives.
- Explain missing data.
- Explain emissions trends.
- Explain factor-source context from retrieved factor metadata.

AI cannot:
- Change emission values.
- Choose emission factors.
- Resolve factor priority.
- Set boundary/legal entity/site.
- Claim regulatory compliance.
- Claim third-party verification.
- Mark a report as officially ready for filing.

### LexForge

AI can:
- Explain exam questions.
- Summarize statutes from retrieved legal text.
- Compare cases from retrieved judgments.
- Draft issue-spotting structures.

AI cannot:
- Invent statutes.
- Invent judgments.
- Invent doctrinal consensus.
- Invent case numbers.
- Declare binding legal effect without source.
- Produce final legal advice without review.

### Hoshisumi

AI can:
- Draft listing descriptions from verified property records.
- Summarize neighborhood or amenity notes from approved sources.
- Explain differences between listings.
- Draft buyer/renter guidance.

AI cannot:
- Invent addresses.
- Change price/rent.
- Change building attributes.
- Claim availability without source feed.
- Invent ownership or transaction status.

### Lemma

AI can:
- Summarize retrieved research/source passages.
- Explain scoring results produced by deterministic evaluators.
- Draft learning or reasoning feedback.
- Compare source-backed concepts.

AI cannot:
- Alter benchmark scores.
- Invent source material.
- Change accepted answers.
- Decide user entitlements.

## Human Review Requirements

Human review is required when output is:

- Customer-facing and high-impact.
- Used for compliance, legal, financial, property, or audit workflows.
- Used in an externally shared report, opinion, listing, filing, or client deliverable.
- Based on incomplete data.
- Based on AI-drafted narrative around regulated or factual domains.

Product-specific examples:

| Product | Must Be Human Reviewed |
| --- | --- |
| CoCalLab | Report narrative, compliance statement, boundary explanation, factor explanation, missing-data explanation before external sharing |
| LexForge | Simulated answer, legal opinion, citation-based argument, final issue analysis |
| Hoshisumi | Public listing text, price/availability text, client-facing property summary |
| Lemma | Published explanation, official answer rationale, benchmark interpretation |

## Output Classification

| Classification | Meaning | Allowed Audience | Mutation Rule |
| --- | --- | --- | --- |
| Draft | AI-generated and not reviewed | Internal user only | Freely editable; cannot be final |
| Review | Under human review | Reviewer / authorized users | Editable with review log |
| Verified | Checked against source facts | Authorized users / internal release | Changes require new review |
| Final | Approved for intended use | Intended customer/client/user audience | Changes create new version |
| Immutable | Final snapshot retained for audit/history | Audit/legal/history access | Never mutate; create replacement version |

## Audit Trail Requirements

Every Level 2+ AI generation in governed workflows should preserve:

- Prompt or prompt template ID.
- Prompt variables.
- Model/provider.
- Model version where available.
- Temperature or generation settings where relevant.
- Retrieval source IDs.
- Retrieval query.
- Source document IDs.
- Citation IDs.
- Generated output hash.
- Human reviewer/approver.
- Approval timestamp.
- Rejection/revision reason.
- Environment (`staging`, `production`, etc.).

For privacy/security:

- Do not store secrets in prompts or traces.
- Redact credentials and regulated personal data when not necessary.
- Preserve enough traceability to reproduce why the output was generated.

## RAG Governance Summary

RAG is allowed only when source ownership is clear.

Minimum requirements:

- Fact sources must be named.
- Evidence sources must have stable IDs.
- Citations must point to retrieved sources, not model memory.
- Missing data must be displayed as missing, not filled by generation.
- Confidence must describe retrieval/generation quality, not legal/compliance truth.

Detailed RAG rules are defined in:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/RAG_GOVERNANCE_V1.md

## Future Architecture

| Mode | Definition | When To Use | Constraints |
| --- | --- | --- | --- |
| Local RAG | Retrieval and generation run against product-controlled/local data stores | Sensitive domains, customer data, regulated workflows, offline or private deployments | Requires source indexing, access control, audit trails |
| External LLM | Prompt sent to an external model provider | Low/medium-risk drafting, language transformation, general explanation | Must redact secrets; must not send restricted data without policy approval |
| Hybrid Mode | Local retrieval plus external generation or local generation plus external enrichment | Most SaaS workflows where source control and generation quality both matter | Retrieval IDs and provider trace must both be preserved |

Architecture selection rule:

- Use Local RAG when source confidentiality or access control dominates.
- Use External LLM when no regulated/customer-sensitive facts are included and output remains draft.
- Use Hybrid Mode when user value depends on source-grounded generation but generation quality benefits from an external model.

## Implementation Guardrails

- AI feature PRs must state generation level.
- AI feature PRs must state fact owners.
- AI feature PRs must define output classification.
- AI feature PRs must document human review requirements.
- AI feature PRs must specify audit-trail fields.
- No AI feature may bypass product permissions.
- No AI feature may silently transform missing data into confident prose.

## Related Matrices

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_AI_GENERATION_MATRIX.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/LEXFORGE_AI_GENERATION_MATRIX.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/RAG_GOVERNANCE_V1.md

