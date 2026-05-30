# AI Budget Allocation V1

Status: canonical AI budget planning document.

Scope: 100 USD/month OpenAI budget planning for early CoCalLab touchpoints.

Parent plan:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_TOUCHPOINT_IMPLEMENTATION_PLAN_V1.md

Parent governance:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_GENERATION_GOVERNANCE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/RAG_GOVERNANCE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_AI_TOUCHPOINT_PRIORITY_MATRIX.md

## Budget Principle

Spend AI budget where the model turns governed source packages into useful explanations.

Do not spend AI budget on decisions, calculations, permissions, routing, schema, DTOs, official compliance claims, or final report approval.

## Monthly Allocation: 100 USD

| Bucket | Allocation | Touchpoints | Why |
| --- | ---: | --- | --- |
| Draft review trust | 30 USD | Draft Review Explanation, Field Uncertainty Explanation | Highest readiness and immediate value in document-to-activity flow. |
| Missing-data clarity | 20 USD | Missing Data Explanation, Upload Completeness Guidance | Reduces false confidence and keeps gaps visible. |
| Factor provenance trust | 20 USD | Factor Explanation | High trust impact; requires source IDs and RAG package. |
| Report preview value | 15 USD | Report Executive Summary, Data Quality Explanation | Strong willingness-to-pay signal, but should remain capped until report payload matures. |
| Analytics interpretation | 5 USD | Analytics Insight Summary | Useful but should come after input data trust. |
| Evaluation and safety reserve | 10 USD | Prompt regression checks, fixed seed evaluations, reviewer QA | Prevents drift and catches overclaiming. |

## Priority Spend Order

| Spend Priority | Touchpoint | Monthly Cap | Reason |
| ---: | --- | ---: | --- |
| 1 | Draft Review Explanation | 25 USD | First production-shaped AI touchpoint; compact inputs and clear human review. |
| 2 | Missing Data Explanation | 15 USD | Low hallucination risk when generated from deterministic missing-field records. |
| 3 | Factor Explanation | 20 USD | Builds trust around factors, but must wait for source package and citations. |
| 4 | Report Executive Summary | 10 USD | High value but should be capped until report preview/review boundary is mature. |
| 5 | Data Quality Explanation | 5 USD | Good governance fit, useful with report preview. |
| 6 | Document Classification Explanation | 5 USD | Low cost, useful guidance, but not a core paid value. |
| 7 | Analytics Insight Summary | 5 USD | Helpful once analytics payload is stable. |
| 8 | Safety/evaluation reserve | 10 USD | Required for prompt quality and forbidden-claim checks. |
| 9 | Experimental buffer | 5 USD | Use only for manual tests, not automatic user-facing generation. |
| 10 | Compliance Gap Explanation | 0 USD | Not recommended now due to compliance-claim risk. |

## Touchpoints Worth Funding First

### 1. Draft Review Explanation

Funding rationale:

- Directly reduces reviewer confusion.
- Uses compact source package.
- Already has governed design.
- Output remains review-only.
- Cost can be controlled by generating once per draft/source package hash.

### 2. Missing Data Explanation

Funding rationale:

- Prevents false confidence.
- Uses deterministic missing-field records.
- Helps guided beta testers understand why a workflow is blocked.
- Does not require broad document context.

### 3. Factor Explanation

Funding rationale:

- Factor provenance is a major trust point.
- RAG citations can anchor source claims.
- Users are likely to question factor source and version.

### 4. Report Executive Summary

Funding rationale:

- Strongest paid-value signal.
- Should wait until canonical report payload and review labels are reliable.
- Start with low cap and staging-only use.

## Touchpoints Not Worth Funding Now

| Touchpoint | Budget | Reason |
| --- | ---: | --- |
| Compliance Gap Explanation | 0 USD | High risk that users interpret it as compliance validation. |
| Scope / Category Mapping Explanation | 0-5 USD after Phase 3 | Too close to governed classification decisions. |
| Report Section Narrative | 0-5 USD after Phase 3 | Large surface area and higher review burden. |
| Broad workspace assistant | 0 USD | Tenant scope, source control, and hallucination risks too high. |
| AI factor selection | 0 USD | Forbidden. |
| AI activity creation | 0 USD | Forbidden without human-confirmed fields. |
| AI official PDF generation | 0 USD | Blocked until canonical report renderer and approval flow exist. |

## Cost Controls

Future implementation should use the following controls:

- Generate only from structured source packages, not raw full documents by default.
- Cache output by source package hash.
- Regenerate only when source package, prompt template, or reviewer request changes.
- Use short prompts with explicit forbidden claims.
- Keep output length capped by touchpoint.
- Disable AI generation automatically if budget cap is reached.
- Log cost by workspace/project/touchpoint.
- Reserve budget for evaluation and safety checks.

## Suggested Output Length Caps

| Touchpoint | Suggested Max Output |
| --- | --- |
| Draft Review Explanation | 150-250 words. |
| Missing Data Explanation | 100-180 words. |
| Factor Explanation | 150-250 words. |
| Report Executive Summary | 200-350 words. |
| Data Quality Explanation | 150-250 words. |
| Document Classification Explanation | 80-150 words. |
| Analytics Insight Summary | 150-250 words. |

## Budget Stop Conditions

Stop or pause generation when:

- Monthly cap is reached.
- Forbidden claims appear in evaluation.
- Source package lacks required source IDs.
- Output omits missing data.
- Output implies compliance, verification, or final approval.
- Tenant/project scope cannot be guaranteed.

