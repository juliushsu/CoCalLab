# AI Touchpoint Priority V1

Status: canonical prioritization guidance.

Parent governance:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_GENERATION_GOVERNANCE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/RAG_GOVERNANCE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_AI_INTEGRATION_MATRIX_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/LEXFORGE_AI_INTEGRATION_ARCHITECTURE_V1.md

## Priority Principle

Spend AI budget where it creates visible user value without making AI the owner of facts.

The best first AI touchpoints are:

- Close to a user pain.
- Grounded in deterministic or retrieved sources.
- Easy to label as draft/review.
- Cheap enough to run repeatedly.
- Valuable even when the final workflow remains human-approved.

## Priority 1-10

| Priority | Touchpoint | Product | Mode | Why It Matters | Governance Boundary |
| ---: | --- | --- | --- | --- | --- |
| 1 | Report executive summary draft | CoCalLab | RAG + external LLM | Converts calculations into a deliverable narrative, closest to willingness-to-pay. | Draft only; no compliance/verification claim. |
| 2 | Draft review explanation | CoCalLab | RAG + external LLM | Helps users understand OCR output and confirm activity data. | Cannot auto-approve or create final facts. |
| 3 | Source-backed question analysis | LexForge | RAG + external LLM | First value moment for legal learning and research. | Educational/source-backed draft only. |
| 4 | Missing-data explanation | CoCalLab | Local + external LLM | Builds trust by making gaps understandable instead of hidden. | Must not synthesize missing values. |
| 5 | Statute summary from retrieved text | LexForge | RAG + external LLM | High-value legal comprehension with strong citation control. | Must cite source/version; not official text. |
| 6 | Factor-source explanation | CoCalLab | RAG + external LLM | Addresses a core trust risk in emissions reporting. | AI explains source; factor choice remains governed. |
| 7 | Simulated answer draft | LexForge | RAG + external LLM | Strong paid-learning value. | Educational/review label; no final legal advice. |
| 8 | Analytics hotspot explanation | CoCalLab | Local + external LLM | Helps users interpret deterministic charts and emissions hotspots. | Cannot alter metrics or claim compliance. |
| 9 | Case comparison | LexForge | RAG + external LLM | Valuable for advanced users, but citation/token-heavy. | Retrieved judgments and spans required. |
| 10 | Document type / missing-field guidance | CoCalLab | Local/RAG + optional external LLM | Reduces confusion during uploads. | Cannot verify document facts. |

## 100 USD / Month Budget Recommendation

If total OpenAI budget is 100 USD/month across early experiments, allocate by value and risk:

| Bucket | Allocation | Touchpoints |
| --- | ---: | --- |
| CoCalLab report value | 35 USD | Report executive summary, missing-data report text. |
| CoCalLab trust repair | 25 USD | Draft review explanation, factor-source explanation. |
| LexForge learning value | 25 USD | Source-backed question analysis, statute summary. |
| Experimental reserve | 10 USD | Analytics hotspot explanation or simulated answer draft. |
| Safety/evaluation reserve | 5 USD | Manual evaluation runs, prompt regression checks. |

If only one product can receive budget first:

1. CoCalLab should receive first production-shaped budget because the AI narrative can support a clear paid report workflow while staying draft-only.
2. LexForge should receive the next budget after source registry and citation retrieval are stable.

## Mode Priority

### Should Be Local

Use local/deterministic systems for:

- Permissions, users, workspaces, projects, matters, and sessions.
- Emission totals, activity calculations, factor resolution, analytics metrics.
- Statute/judgment/source identity and version metadata.
- Output status: draft, review, verified, final, immutable.
- Human approval and audit trail state.
- Billing/subscription/entitlement decisions.

### Should Be RAG

Use RAG for:

- CoCalLab factor-source explanation.
- CoCalLab document evidence explanation.
- CoCalLab report section support and citations.
- LexForge statute summary.
- LexForge judgment/case comparison.
- LexForge issue analysis tied to legal sources.
- Any output requiring source IDs or citations.

### Should Be External LLM

Use external LLM for:

- Draft narratives.
- Plain-language explanations.
- Executive summaries.
- User-facing missing-data explanations.
- Legal-learning explanations over retrieved source packages.
- Comparison prose after source facts are retrieved.

External LLM should not receive:

- Secrets.
- Cross-tenant data.
- Full raw documents when structured source packages are enough.
- Unscoped legal/property/customer data.
- Requests to decide facts, compliance, legal effect, or final status.

## Forbidden Global AI Touchpoints

Do not use AI to:

- Decide CoCalLab emissions totals.
- Choose CoCalLab emission factors.
- Declare CoCalLab compliance or verification status.
- Generate official filing-ready reports without canonical renderer and approval.
- Invent LexForge statutes, judgments, case numbers, or doctrinal consensus.
- Produce final legal advice without human review.
- Decide customer permissions, billing, or entitlement.
- Substitute confidence scores for evidence.

## First Implementation Sequence

Recommended first sequence when engineering begins:

1. Define source package contracts.
2. Define prompt template IDs and forbidden claims.
3. Implement audit trail capture.
4. Pilot CoCalLab report executive summary draft in staging.
5. Pilot CoCalLab draft review explanation in staging.
6. Evaluate output quality with fixed seed data.
7. Pilot LexForge source-backed question analysis after source registry exists.
8. Add statute summary after citation display is reliable.
9. Expand to analytics/case comparison only after evaluation.
10. Keep all outputs draft/review until human approval workflow exists.

## Success Criteria

An AI touchpoint is ready for closed beta only when:

- It has a source package.
- It has an output classification.
- It has explicit forbidden claims.
- It preserves prompt/model/source/audit metadata.
- It displays missing data.
- It does not overwrite governed facts.
- It can be disabled without breaking the workflow.

