# RAG Governance V1

Status: canonical retrieval-augmented generation governance.

Parent governance:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_GENERATION_GOVERNANCE_V1.md

## Core Rule

RAG does not make AI factual by itself.

RAG is governed only when retrieval sources are controlled, cited, scoped, permissioned, and auditable.

## Source Types

| Source Type | Definition | Examples | AI Use |
| --- | --- | --- | --- |
| Fact Source | Source of record for a fact | Database row, official statute, property feed, calculation result | AI may restate/summarize; cannot override |
| Evidence Source | Supporting document or artifact | Uploaded bill, judgment PDF, listing source, certificate | AI may cite/explain with ID |
| Reference Source | Contextual source not necessarily source of record | Help docs, methodology guide, product docs | AI may use for explanation |
| User Input | User-provided text or instruction | Prompt, uploaded note, questionnaire answer | AI may draft from it but must not treat as verified unless reviewed |
| Model Memory | Latent model knowledge | General language/world knowledge | Not allowed as citation in governed workflows |

## Fact Source Rules

Every governed generation must identify:

- Fact source owner.
- Source ID.
- Source version or timestamp.
- Access-control scope.
- Whether the source is authoritative or contextual.
- Whether the source is complete, partial, or missing.

If a fact source is missing, AI must say it is missing.

## Evidence Source Rules

Evidence sources must preserve:

- Stable document/evidence ID.
- Original filename or source label where safe.
- Extracted text span or structured row reference.
- Retrieval score when available.
- Created/uploaded timestamp.
- User/workspace/project scope.

AI may summarize evidence but must not silently upgrade evidence into a final fact.

## Citation Rules

Allowed citations:

- Stable source IDs.
- Document IDs.
- Page/section/paragraph references where available.
- Database row IDs.
- Official source URLs.
- Retrieval IDs.

Forbidden citations:

- Model memory.
- Generic "according to sources" without IDs.
- Citations to unavailable documents.
- Fabricated page/paragraph references.

Citation display should include:

- Source label.
- Source type.
- Retrieval timestamp or source version.
- Confidence/relevance indicator when helpful.

## Confidence Rules

Confidence is not truth.

Confidence may describe:

- Retrieval match strength.
- Extraction quality.
- Draft-generation uncertainty.
- Missing-data level.

Confidence must not be used to claim:

- Legal correctness.
- Regulatory compliance.
- Verification status.
- Official filing readiness.
- Financial/property correctness.

Use language such as:

- "Source coverage: high/medium/low."
- "Extraction confidence: 82%."
- "Missing required source: emission factor version."

Avoid:

- "This is compliant."
- "This legal answer is correct."
- "This property price is verified" unless a source-of-record verified it.

## Missing Data Rules

AI must not fill missing governed facts.

When data is missing:

- Show the missing field.
- Show why it matters.
- Show which source is required.
- Draft a user-facing explanation only if it clearly states missingness.
- Do not generate synthetic values.

Examples:

| Product | Missing Data | Allowed AI Output |
| --- | --- | --- |
| CoCalLab | Missing factor source | "This report cannot explain factor provenance until a factor source is selected." |
| LexForge | Missing judgment text | "Case comparison is unavailable because the judgment text was not retrieved." |
| Hoshisumi | Missing property area | "Area is not available in the source feed; confirm before publishing." |
| Lemma | Missing benchmark source | "The score cannot be explained because the benchmark result ID is missing." |

## Retrieval Governance

Retrieval must respect:

- Product permissions.
- Workspace/project scope.
- User role.
- Data environment.
- Source retention policy.
- Jurisdiction/domain constraints.

Retrieval must not cross:

- Tenant boundaries.
- Customer workspaces.
- Legal matter boundaries.
- Property owner/client boundaries.
- Staging/production data boundaries.

## Generation Package

A governed RAG generation should receive a structured package:

```json
{
  "task": "draft_summary",
  "generation_level": 2,
  "output_classification": "Draft",
  "facts": [
    {
      "id": "source-row-id",
      "type": "Fact Source",
      "owner": "calculation_engine",
      "value": "..."
    }
  ],
  "evidence": [
    {
      "id": "document-id",
      "type": "Evidence Source",
      "excerpt": "...",
      "retrieval_id": "..."
    }
  ],
  "missing_data": [
    {
      "field": "factor_source",
      "required_for": "report factor explanation"
    }
  ],
  "forbidden_claims": [
    "official filing readiness",
    "third-party verification"
  ]
}
```

## Prompt Governance

Prompts must include:

- Role boundary: controlled draft generator.
- Fact ownership statement.
- Forbidden claims.
- Citation requirements.
- Missing-data behavior.
- Output classification.
- Human-review requirement.

Prompts must not include:

- Secrets.
- API keys.
- Raw credentials.
- Unnecessary personal data.
- Cross-tenant data.

## Audit Trail Requirements

RAG systems must preserve:

- Prompt template ID and version.
- Prompt variables.
- Retrieval query.
- Retrieval index/version.
- Source IDs.
- Evidence IDs.
- Retrieved chunks/spans.
- Model/provider/version.
- Generation settings.
- Output hash.
- User ID.
- Workspace/project/matter/listing scope.
- Human reviewer/approver if any.

## Architecture Modes

| Mode | Description | Best For | Risk |
| --- | --- | --- | --- |
| Local RAG | Retrieval and optionally generation stay within product-controlled infrastructure | Sensitive customer data, legal/source archives, compliance workflows | Requires more platform investment |
| External LLM | External model generates from prompt/context | Low-risk drafting, copy editing, generic explanation | Data leakage and auditability risk |
| Hybrid Mode | Product-controlled retrieval with external generation, or external enrichment over redacted data | Most SaaS draft workflows | Requires strict source/audit controls |

## Product-Specific Application

### CoCalLab

RAG may retrieve:

- Report payload.
- Calculation results.
- Factor source metadata.
- Documents/drafts/activity mappings.
- Canonical methodology docs.

RAG must not invent:

- Emission totals.
- Factors.
- Boundary.
- Compliance status.
- Verification status.

### LexForge

RAG may retrieve:

- Statutes.
- Regulations.
- Judgments.
- Editorial notes.
- Question banks.

RAG must not invent:

- Legal text.
- Case number.
- Judgment facts.
- Legal effect.
- Legal advice finality.

### Hoshisumi

RAG may retrieve:

- Property records.
- Listing feed data.
- CRM notes.
- Approved area/location metadata.

RAG must not invent:

- Address.
- Price.
- Availability.
- Floor/area/building facts.
- Ownership or transaction status.

### Lemma

RAG may retrieve:

- Source documents.
- Benchmark results.
- Accepted answers.
- Knowledge-base entries.

RAG must not invent:

- Benchmark scores.
- Accepted answers.
- Source passages.
- User/account state.

## Release Checklist

Before shipping a RAG feature:

- Source ownership is documented.
- Retrieval scope is permissioned.
- Missing-data behavior is visible.
- Citation display is implemented.
- Audit trail is stored.
- Human-review path exists for high-impact output.
- Output classification is visible.
- Forbidden claims are tested.

