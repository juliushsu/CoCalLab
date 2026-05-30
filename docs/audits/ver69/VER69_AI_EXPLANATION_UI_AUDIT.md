# Ver69 AI Explanation UI Audit

Status: audit only.

Canonical source:

- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_GENERATION_GOVERNANCE_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_AI_GENERATION_MATRIX.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_DRAFT_REVIEW_AI_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/AI_TOUCHPOINT_IMPLEMENTATION_PLAN_V1.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/COCALLAB_AI_TOUCHPOINT_PRIORITY_MATRIX.md
- https://github.com/juliushsu/CoCalLab/blob/main/docs/canonical/HUMAN_REVIEW_REQUIREMENTS_V1.md

Reviewed package:

- `/Users/chishenhsu/Downloads/CaCalLab-Ver069`

Reviewed focus:

- `src/pages/admin/documents/components/DraftAIExplanationPanel.tsx`
- `src/pages/admin/documents/ExtractedDraftReviewPage.tsx`
- `src/i18n/local/zh/cocal.ts`
- `src/i18n/local/en/cocal.ts`
- `src/i18n/local/ja/cocal.ts`
- route/package/security hygiene around the Readdy package

## 1. Summary

Ver69's `DraftAIExplanationPanel` is directionally aligned with the canonical AI governance model: it frames the output as draft/review assistance, displays missing data, labels confidence as extraction confidence, and explicitly says AI does not approve drafts, create activities, select emission factors, or claim compliance.

However, it is not safe for direct merge.

The panel is currently a rule-based UI preview built from existing draft fields, not a real AI response. The current title and robot affordance can make users believe OpenAI/AI API is already connected. The component also reads from `draft.raw_payload` and emits synthetic citations that look like source citations even though no page/span model is present. Those issues must be corrected before selective merge.

Package-level merge is unsafe because Ver69 still includes `.env`, carries route drift, and the locale files are older than canonical in many sections. Full-file i18n merge would delete previously cleaned-up keys and reintroduce raw-key risk.

Build reality:

- `npm run type-check` on a temp copy failed.
- `npm run build` on a temp copy passed, but emitted duplicate-key warnings from i18n files.

Recommendation:

- Do not full merge Ver69.
- Selective merge is acceptable only after copy/source/citation fixes and only for the minimal AI explanation UI files/keys.

## 2. Alignment with `COCALLAB_DRAFT_REVIEW_AI_V1`

| Canonical Requirement | Ver69 Observation | Status |
| --- | --- | --- |
| AI explains extraction results only. | Panel derives explanations from `draft` fields and does not call confirm/create APIs. | Aligned |
| AI is not a decision maker. | Trust bar and reminder say AI does not approve drafts, create activities, select factors, or claim compliance. | Aligned |
| Must label AI Draft / human review. | Subtitle, level badge, trust chips, and review reminder include AI Draft and human review language. | Aligned |
| Must show not verified / not third-party verified. | Trust chip includes `notVerified`; English says `Not Third-Party Verified`, Chinese says `非第三方查驗`. Japanese wording is less precise. | Partial |
| Missing data must remain visible. | Missing vendor/quantity/unit/scope/category/activity date are shown as missing chips. | Aligned |
| Confidence describes extraction quality only. | Confidence disclaimer says OCR/parser quality, not compliance truth/final correctness. | Aligned |
| Source package should be minimal and controlled. | Component reads `draft.raw_payload.document_type` by casting the whole `raw_payload`. It renders only one value but still depends on raw payload. | Partial |
| Factual source claims require source citations. | Field rows have citations, but they are synthetic field references; there are no actual page/span IDs. The freeform reasoning row has no citation. | Partial |
| Must not imply real AI if no AI API exists. | UI title says `AI Explanation` and uses robot icon; no explicit "UI preview" or "rule-based placeholder" label. | Drift |
| Output must be review-only. | Review reminder is clear; confirm/edit/reject actions remain human actions. | Aligned |

## 3. Risks

### P0: Package Hygiene

Ver69 includes:

- `/Users/chishenhsu/Downloads/CaCalLab-Ver069/.env`

This file must not be merged or copied. The package should be treated as unsafe for full merge.

### P0: Full i18n File Regression

The Ver69 locale files are not safe to merge as whole files.

Observed risks:

- Ver69 `zh/en/ja` files are older than canonical in many sections.
- Whole-file merge would remove previous i18n cleanup keys, including reports/projects/organizations/documents/activity keys.
- Ver69 locale files contain duplicate object keys that fail type-check and produce build warnings.

Concrete type-check failures:

- `src/i18n/local/en/cocal.ts(1461,5): TS1117 duplicate key`
- `src/i18n/local/ja/cocal.ts(153,7), (161,7), (172,7), (1481,5): TS1117 duplicate key`
- `src/i18n/local/zh/cocal.ts(153,7), (157,7), (163,7), (1459,5): TS1117 duplicate key`

Only the `aiExplanation` key subtree should be considered, and it must be manually merged into current canonical locale files.

### P1: UI May Mislead Users Into Thinking Real AI Exists

The panel currently appears as:

- `AI Explanation`
- robot icon
- "reasoning" language
- "AI extraction evidence" wording

But no OpenAI/AI API integration exists in this sprint. This creates a trust risk: closed-beta testers may believe the explanation is a live AI model response rather than a deterministic/rule-based preview.

Required containment:

- Label as `AI Explanation UI Preview`.
- State `Rule-based placeholder until AI API exists`.
- State `No OpenAI / AI API is connected in this version`.

### P1: Citation Overstatement

The component generates citations such as:

- `[doc:${draft.uploaded_document_id} field:document_type]`
- `[draft:${draft.id} field:suggested_category]`
- `[warning:missing_scope]`

These are useful field references, but they are not real source-span citations. Canonical `COCALLAB_DRAFT_REVIEW_AI_V1` requires every factual source claim to cite source spans or field references. If no source spans exist, the UI should say `field reference` or `draft reference`, not imply document page/span evidence.

Required containment:

- Rename citation footer from "source traceable" to "draft field references only" until source spans exist.
- Do not display synthetic `doc:... field:...` as if it is a document citation.
- Add citation/reference for the freeform reasoning row or remove factual claims from that row.

### P1: `raw_payload` Boundary

The panel casts `draft.raw_payload` and reads `rawPayload.document_type`.

This does not expose the full raw payload in UI, but it is a governance smell. Canonical design says AI should receive a controlled source package, not raw payload. Future AI integration must not pass raw payload through as prompt input.

Required containment:

- Use an explicit, whitelisted `document_type_candidate` or `safe_document_type` field when available.
- If still reading `raw_payload.document_type` for UI-only preview, label it as parser-derived candidate and never send `raw_payload` to AI.

### P1: Route Drift

Ver69 `src/router/config.tsx` differs from canonical by importing:

- `ProductCarbonPage`
- `AIGovernancePage`

The routes remain blocked by `NotFoundPage`, but the lazy imports are not needed for closed beta containment and should not be merged. Build output still included chunks for these pages, which is an unnecessary exposure/drift signal.

### P1: Type-Check Fails

`npm run type-check` was run on a temp copy under `/private/tmp/cocalab_ver69_audit_run`, using the same package scripts and canonical `node_modules`.

Result: failed.

Representative failures:

- duplicate i18n keys in `zh/en/ja`
- legacy fixture/type drift in activities and reports mocks
- `ConfirmDialog` prop mismatch: `isProcessing` does not exist
- organization/project DTO drift

This means Ver69 is not merge-ready as a package.

### P2: Japanese Copy Quality

Japanese i18n has wording issues:

- `levelBadge: 'AI Draft（人工標準必要）'` should be corrected to `AI Draft（人によるレビューが必要）` or equivalent.
- `subtitle: '正式検証不可'` should be more precise as `第三者検証ではありません / 内部レビュー用`.

### P2: Unrelated UX Additions Mixed Into Draft Review Page

`ExtractedDraftReviewPage.tsx` includes unrelated changes:

- `ValueChainProgress`
- `BetaFeedbackButton`
- success toast copy and journey CTA changes

These may be good product UX, but they are not part of the AI Explanation UI audit scope. They should not be bundled with the AI panel merge unless separately reviewed against canonical closed-beta/value-chain docs.

## 4. Required Copy Changes Before Merge

Minimum required copy changes:

| Current / Missing | Required Before Merge |
| --- | --- |
| `AI Explanation` | `AI Explanation UI Preview` or `Draft Review Explanation Preview` |
| Missing no-API disclosure | Add `Rule-based placeholder until AI API exists. No OpenAI / AI API is connected in this version.` |
| `source traceable` footer | Change to `Draft field references only; source spans not yet connected` unless real source spans are present. |
| `Reasoning` | Prefer `Parser-derived explanation` or `Draft-field explanation`. |
| `AI extraction evidence` | Prefer `Parser/draft evidence for human review` until real AI output exists. |
| `Suggested Activity` | Prefer `Candidate Activity` or `Suggested Activity (candidate)` |
| `Suggested Scope` | Prefer `Candidate Scope` or `Suggested Scope (candidate)` |
| `Suggested Category` | Prefer `Candidate Category` or `Suggested Category (candidate)` |
| Japanese `人工標準必要` | Correct to `人によるレビューが必要`. |
| Japanese `正式検証不可` | Correct to `第三者検証ではありません / 内部レビュー用`. |

Required trust labels:

- `AI Draft`
- `Needs Human Review`
- `Not Third-Party Verified`
- `Does Not Create Activity`
- `Rule-based preview; no AI API connected`

Required forbidden-claim wording:

- Does not approve drafts.
- Does not create activities.
- Does not select emission factors.
- Does not determine compliance.
- Does not verify documents.

## 5. Selective Merge Recommendation

Selective merge recommendation: yes, but only after P1 copy/source/citation changes.

Do not merge Ver69 as a package.

Acceptable selective merge shape:

1. Add `DraftAIExplanationPanel.tsx` after copy/source/citation changes.
2. Add minimal toggle/render integration to `ExtractedDraftReviewPage.tsx`.
3. Add only `aiExplanation` i18n subtree into current canonical `zh/en/ja` locale files.
4. Preserve canonical i18n files and existing keys; do not replace whole locale files.
5. Do not touch route config, package files, DTOs, schema, backend, or lock files.

Recommended merge gate:

- `npm run type-check` must pass after selective merge.
- `npm run build` must pass without duplicate-key warnings introduced by this merge.
- UI copy must state preview/placeholder/no-AI-API status.
- `raw_payload` usage must be removed or constrained to a whitelisted candidate field.

## 6. Files Allowed / Forbidden To Merge

### Allowed After Required Changes

| File | Recommendation | Conditions |
| --- | --- | --- |
| `src/pages/admin/documents/components/DraftAIExplanationPanel.tsx` | Selective merge after edits | Add preview/no-AI-API labels; fix citation/reference language; avoid raw payload dependency. |
| `src/pages/admin/documents/ExtractedDraftReviewPage.tsx` | Minimal selective merge | Only import/toggle/render the panel. Do not bundle unrelated value-chain/success/feedback changes in this AI merge. |
| `src/i18n/local/zh/cocal.ts` | Manual partial merge only | Add `aiExplanation` subtree into current canonical file; preserve all existing canonical keys. |
| `src/i18n/local/en/cocal.ts` | Manual partial merge only | Add `aiExplanation` subtree into current canonical file; preserve all existing canonical keys. |
| `src/i18n/local/ja/cocal.ts` | Manual partial merge only | Add corrected `aiExplanation` subtree; fix Japanese wording. |

### Not Allowed To Merge

| File / Area | Reason |
| --- | --- |
| `.env` | Secret/environment file present in Readdy package. Never merge. |
| Whole `src/i18n/local/*/cocal.ts` files | Would delete canonical cleanup keys and contains duplicate-key issues. |
| `src/router/config.tsx` | Contains unrelated Product CFP / AI Governance lazy import drift. Canonical containment routes should remain the source of truth. |
| `package.json` | No needed diff; avoid churn. |
| lock files | None found in Ver69; do not introduce. |
| DTO/type files | No required AI panel DTO change; avoid schema/DTO drift. |
| backend/schema/API files | Out of scope. |
| Product CFP / CBAM / AI Governance routes | Out of scope and must remain gated/blocked per canonical governance. |

## Test Results

Commands were run against a temp copy:

- Source: `/Users/chishenhsu/Downloads/CaCalLab-Ver069`
- Temp copy: `/private/tmp/cocalab_ver69_audit_run`
- Dependencies: canonical `frontend/readdy-app/node_modules`

| Command | Result | Notes |
| --- | --- | --- |
| `npm run type-check` | Failed | Duplicate i18n keys and broader Ver69 type drift. |
| `npm run build` | Passed with warnings | Vite/esbuild warned about duplicate i18n keys; build output included ProductCarbonPage and AIGovernancePage chunks due route import drift. |

## Final Decision

Ver69's AI explanation UI concept is aligned enough to continue, but it is not merge-ready.

Recommendation:

- Do not full merge.
- Do not merge current package files.
- Ask Readdy for a minimal Ver69.1 containment patch, or manually apply a corrected selective merge, limited to the AI explanation panel, minimal page integration, and corrected i18n subtree.

