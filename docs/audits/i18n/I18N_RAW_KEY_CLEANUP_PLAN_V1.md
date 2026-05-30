# CoCalLab I18N Raw Key Cleanup Plan V1

Date: 2026-05-30

Baseline:
- Canonical commit before cleanup: `81dc81bab8d61c71ef8fbdb7ec6bcfed330bf829`
- Scope: `frontend/readdy-app/src`
- Dictionaries scanned: `zh`, `en`, `ja`
- Mode: i18n cleanup plan only. No UI redesign, no schema, no backend, no DTO, no route changes.

## Summary

Static scan after P1 Batch 3:

| Metric | Count |
| --- | ---: |
| Static `t('...')` usages | 1,095 |
| Unique static i18n keys used | 786 |
| Missing / partial keys remaining | 0 |
| Missing in all three locales | 0 |
| Partial locale gaps | 0 |
| Known object/string structure conflicts | 1 |

Previous round intentionally fixed one small P1 report-flow key:
- `reports.generateProgress`

P1 Batch 1 fixed the most common user-visible Documents and Activities value-chain keys without changing UI logic.

P1 Batch 2 fixed the user-visible Reports and Projects keys most likely to appear in report preview/history, report generation, project overview, and project create/edit flows. The batch also added generic top-level status labels required by those screens.

P1 Batch 3 fixed the remaining user-visible Organizations and Misc keys used by workspace creation/editing, login, subscription, and generic not-found/error states.

## Severity Rules

| Severity | Meaning |
| --- | --- |
| P0 | Raw key can appear in the core guided closed-beta path and can block trust or task completion. |
| P1 | User-visible in closed beta or report flow, but not always on the happy path or has nearby workaround/default. |
| P2 | Internal, low-frequency, hidden, non-beta, or non-blocking copy. |

## Module Matrix

| Module | Remaining Keys | P0 | P1 | P2 | User Visible? | Must Fix Before Closed Beta? | Notes |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| Reports | 0 | 0 | 0 | 0 | Yes | No remaining static raw keys | P1 Batch 2 added report preview/history/generation/export and audit confidence labels. |
| Activities | 0 | 0 | 0 | 0 | Yes | No remaining static raw keys | P1 Batch 1 added camelCase aliases for Activity Detail fields/actions/dialogs. |
| Documents | 0 (+1 structural conflict) | 0 | 1 structural | 0 | Yes | No for happy path | `common.actions` remains a known object/string structure conflict, not a missing locale key. |
| Organizations | 0 | 0 | 0 | 0 | Yes | No remaining static raw keys | P1 Batch 3 added organization create/edit validation, field, message, and workspace notice labels. |
| Projects | 0 | 0 | 0 | 0 | Yes | No remaining static raw keys | P1 Batch 2 added project create/edit/overview and generic status labels. |
| Navigation | 0 | 0 | 0 | 0 | Yes | No | No missing static navigation keys found in this scan. |
| Misc | 0 | 0 | 0 | 0 | Mixed | No remaining static raw keys | P1 Batch 3 added login, subscription camelCase aliases, and `errors.notFound`. |

## Reports

Current status:
- Remaining missing / partial keys: 0
- P1 Batch 2 fixed the visible report preview/history/generation/export keys.
- `reports.generateProgress` was fixed in the previous small P1 report-flow patch.

Fixed in P1 Batch 2:

| Key | Severity | User Visible? | Must Fix Before Closed Beta? | Notes |
| --- | --- | --- | --- | --- |
| `reports.generateError` | P1 | Yes | Yes | Error state in report generation. |
| `reports.regenerateError` | P1 | Yes | No if regenerate is hidden | Visible if section regeneration is used. |
| `reports.previewSection.backToHistory` | P1 | Yes | Yes | Header navigation in preview. |
| `reports.previewPage.title` | P1 | Yes | Yes | Preview H1. |
| `reports.previewPage.exportReport` | P1 | Yes | Yes | Export affordance, trust-sensitive. |
| `reports.generateWarnings` | P1 | Yes | Yes | Warning state. |
| `reports.generating` | P1 | Yes | Yes | Generation progress state. |
| `reports.currentSection` | P1 | Yes | Yes | Appears next to `generateProgress`; should be fixed in next report pass. |
| `reports.previewPage.version` | P1 | Yes | Yes | Report metadata. |
| `reports.previewPage.status` | P1 | Yes | Yes | Report metadata. |
| `reports.previewPage.generatedAt` | P1 | Yes | Yes | Report metadata. |
| `reports.previewPage.sections` | P1 | Yes | Yes | Report section progress. |
| `reports.statistics.*` | P1 | Yes | Yes | Report stats panel. |
| `reports.previewSection.noContent` | P1 | Yes | Yes | Empty section state. |
| `reports.previewPage.aiGenerated` | P1 | Yes | No if sections remain hidden/empty | Badge copy. |
| `reports.previewPage.userModified` | P1 | Yes | No if sections remain hidden/empty | Badge copy. |
| `reports.previewPage.editSection` | P1 | Yes | No if edit hidden | Tooltip/action. |
| `reports.previewPage.regenerateSection` | P1 | Yes | No if regenerate hidden | Tooltip/action. |
| `reports.exportDialog.title` | P1 | Yes | Yes | Export dialog title. |
| `reports.exportDialog.selectFormat` | P1 | Yes | Yes | Export dialog instruction. |
| `reports.betaReportWarningDesc` | P1 | Yes | No | Has code fallback, but should move into dictionaries. |
| `audit.confidence_score` | P2 | Yes | No | AI audit/preflight detail. |

Recommended action:
- No remaining static report raw keys were found after Batch 2.
- Keep report compliance wording and staging-only preview status tracked separately; this i18n batch does not change report behavior.

## Activities

Current status:
- Remaining missing / partial keys: 0
- P1 Batch 1 added user-visible aliases for `EmissionActivityDetailPage.tsx`.

Fixed examples:
- `activities.verifySuccess`
- `activities.detailPage.verifyButton`
- `activities.detailPage.recalculateButton`
- `activities.detailPage.editButton`
- `activities.warnings.pendingInclusion`
- `activities.fields.activityDate`
- `activities.fields.emissionScope`
- `activities.verifyDialog.*`

Classification:
- No remaining static raw keys in Activities.

Recommended action:
- Keep Activity Detail mock/reality status tracked separately; this i18n batch does not change backend or mock behavior.

## Documents

Current status:
- Remaining missing / partial keys: 0
- P1 Batch 1 fixed upload, list, draft review, duplicate warning, processing status, and readonly message keys.

Fixed examples:
- `documents.orgNotFound`
- `documents.selectProject`
- `documents.steps.uploading`
- `documents.steps.processing`
- `documents.steps.classifying`
- `documents.steps.completed`
- `documents.processingStatus.pending`
- `documents.processingStatus.completed`
- `drafts.*` happy-path review/confirm/reject keys
- `subscription.readonlyBanner.message`

Classification:
- Remaining `common.actions` is P1 because it is user-visible in table headers, but it is a structure conflict rather than a missing locale key: `common.actions` is already an object containing nested action labels.

Recommended action:
- Do not convert `common.actions` to a string without refactoring callers; use `common.table_actions` in UI in a separate UI cleanup if needed.

## Organizations

Current status:
- Remaining missing / partial keys: 0
- P1 Batch 3 fixed user-visible workspace create/edit labels, validation messages, and workspace clarification copy.

Fixed in P1 Batch 3:
- `organizations.workspaceNoticeDesc`
- `organizations.edit`
- `organizations.validation.*`
- `organizations.messages.sessionExpired`
- `organizations.messages.createFailed`
- `organizations.messages.updateFailed`
- `organizations.fields.*` camelCase labels and placeholders used by create/edit pages.

Classification:
- No remaining static organization raw keys in this scan.

Recommended action:
- Keep workspace/legal_entity/site wording tracked under canonical governance; this i18n batch only adds copy.

## Projects

Current status:
- Remaining missing / partial keys: 0
- `projects.types.undefined` was already fixed in canonical patch `81dc81b`.

Fixed in P1 Batch 2:
- `projects.workspaceOrgNote`
- `projects.fields.siteFacility`
- `projects.siteFacilityNote`
- `projects.betaNoticeDesc`
- `projects.overview.*`
- `projects.fields.project_type`
- `status.*` labels used by project overview/create/edit screens.

Classification:
- No remaining static project raw keys in this scan.

Recommended action:
- Keep legal entity/site placeholder behavior tracked under feature gating; this i18n batch only adds copy.

## Navigation

Current status:
- No missing static navigation keys found.

Recommendation:
- No immediate action.

## Misc

Current status:
- Remaining missing / partial keys: 0.

Fixed in P1 Batch 3:
- `errors.notFound`
- `auth.*`
- `subscription.*`

Classification:
- No remaining static misc raw keys in this scan.

Recommendation:
- No further missing-key cleanup is required before closed beta. Keep `common.actions` as a separate UI cleanup because it is an object/string structure conflict.

## Batch Plan

| Batch | Scope | Priority | Beta Required? |
| --- | --- | --- | --- |
| Batch 1 | `reports.generateProgress` | P1 | Done |
| Batch 1A | Documents + Activities value-chain visible keys | P1 | Done |
| Batch 2 | Reports + Projects visible preview/history/overview/create/edit keys | P1 | Done |
| Batch 3 | Organizations + Misc visible workspace/login/subscription/error keys | P1/P2 | Done |
| Separate UI cleanup | `common.actions` object/string conflict | P1 | No for happy path |

## Guardrails

- Do not modify schema, backend, DTO, routes, or business logic during i18n cleanup.
- Do not auto-generate translations in bulk without reviewing user-visible tone.
- Keep changes grouped by module so regressions are easy to review.
- Prefer fixing keys that are already referenced by UI over adding unused dictionary entries.
