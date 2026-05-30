# CoCalLab I18N Raw Key Cleanup Plan V1

Date: 2026-05-30

Baseline:
- Canonical commit before cleanup: `81dc81bab8d61c71ef8fbdb7ec6bcfed330bf829`
- Scope: `frontend/readdy-app/src`
- Dictionaries scanned: `zh`, `en`, `ja`
- Mode: i18n cleanup plan only. No UI redesign, no schema, no backend, no DTO, no route changes.

## Summary

Static scan after this patch:

| Metric | Count |
| --- | ---: |
| Static `t('...')` usages | 1,095 |
| Unique static i18n keys used | 786 |
| Missing / partial keys remaining | 200 |
| Missing in all three locales | 146 |
| Partial locale gaps | 54 |
| Missing / partial keys without default fallback | 161 |

This round intentionally fixes only one small P1 report-flow key:
- `reports.generateProgress`

All other report-flow raw keys are tracked below but deferred to avoid broad UI/i18n churn.

## Severity Rules

| Severity | Meaning |
| --- | --- |
| P0 | Raw key can appear in the core guided closed-beta path and can block trust or task completion. |
| P1 | User-visible in closed beta or report flow, but not always on the happy path or has nearby workaround/default. |
| P2 | Internal, low-frequency, hidden, non-beta, or non-blocking copy. |

## Module Matrix

| Module | Remaining Keys | P0 | P1 | P2 | User Visible? | Must Fix Before Closed Beta? | Notes |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- |
| Reports | 28 | 0 | 27 | 1 | Yes | Partial | Report Preview still has many visible keys missing; fix in a focused report pass. |
| Activities | 39 | 36 | 3 | 0 | Yes | Yes if Activity Detail remains reachable | Activity Detail is the highest raw-key risk. |
| Documents | 55 | 15 | 40 | 0 | Yes | Yes for upload/list/draft happy path | Many keys are partial locale gaps, especially upload/list status. |
| Organizations | 36 | 0 | 30 | 6 | Yes | Partial | Workspace/member copy affects tester comprehension. |
| Projects | 25 | 0 | 20 | 5 | Yes | Partial | Project overview/create placeholders need a focused pass. |
| Navigation | 0 | 0 | 0 | 0 | Yes | No | No missing static navigation keys found in this scan. |
| Misc | 17 | 0 | 8 | 9 | Mixed | No | Includes common/status/auth/audit/subscription leftovers. |

## Reports

Current status:
- Remaining missing / partial keys: 28
- Most are visible in `ReportPreviewPage.tsx`.
- `reports.generateProgress` was fixed in this patch.

Deferred visible report keys:

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

Recommended next report batch:
1. Fix Report Preview header/metadata/statistics/export keys.
2. Fix generation error/progress/warning keys.
3. Fix no-content and section badge/action keys only if section UI remains visible.

## Activities

Current status:
- Remaining missing / partial keys: 39
- 38 are missing in all locales.
- Most are in `EmissionActivityDetailPage.tsx`.

Examples:
- `activities.verifySuccess`
- `activities.detailPage.verifyButton`
- `activities.detailPage.recalculateButton`
- `activities.detailPage.editButton`
- `activities.warnings.pendingInclusion`
- `activities.fields.activityDate`
- `activities.fields.emissionScope`
- `activities.verifyDialog.*`

Classification:
- P0 if Activity Detail remains reachable.
- P1 if Activity Detail is hidden or mock-gated.

Recommended action:
- Either hide/mock-gate Activity Detail for beta, or fix all Activity Detail labels in one focused batch.

## Documents

Current status:
- Remaining missing / partial keys: 55
- Most are user-visible in upload, list, and draft review flows.

Examples:
- `documents.orgNotFound`
- `documents.selectProject`
- `documents.steps.uploading`
- `documents.steps.processing`
- `documents.steps.classifying`
- `documents.steps.completed`
- `documents.processingStatus.pending`
- `documents.processingStatus.completed`
- `drafts.*`

Classification:
- P0: upload progress/status keys on the guided path.
- P1: duplicate warnings, list filters, draft labels.

Recommended action:
- Fix document upload/list status keys before closed beta.
- Fix draft review labels in the next batch.

## Organizations

Current status:
- Remaining missing / partial keys: 36
- User-visible in workspace/member management.

Examples:
- `organizations.members.*`
- `organizations.workspaceNoticeDesc`
- member role/status/testability labels.

Classification:
- P1 for guided tester workspace/member visibility.
- P2 for lower-frequency edit/remove flows.

Recommended action:
- Prioritize member visibility, role labels, invitation/testability state, and workspace clarification copy.

## Projects

Current status:
- Remaining missing / partial keys: 25
- `projects.types.undefined` was already fixed in canonical patch `81dc81b`.

Examples:
- `projects.workspaceOrgNote`
- `projects.fields.siteFacility`
- `projects.siteFacilityNote`
- `projects.betaNoticeDesc`

Classification:
- P1 for project creation/overview copy.
- P2 for disabled placeholder details if not in primary test script.

Recommended action:
- Fix project creation/overview helper copy in one small batch after Documents.

## Navigation

Current status:
- No missing static navigation keys found.

Recommendation:
- No immediate action.

## Misc

Current status:
- Remaining missing / partial keys: 17.

Examples:
- `common.*`
- `status.*`
- `auth.*`
- `subscription.*`
- `audit.*`

Classification:
- P1 if shown in core error/status paths.
- P2 otherwise.

Recommendation:
- Fix opportunistically after module-specific batches.

## Batch Plan

| Batch | Scope | Priority | Beta Required? |
| --- | --- | --- | --- |
| Batch 1 | `reports.generateProgress` | P1 | Done in this patch |
| Batch 2 | Report Preview visible metadata/export/error/progress keys | P1 | Yes |
| Batch 3 | Documents upload/list/draft happy path keys | P0/P1 | Yes |
| Batch 4 | Activity Detail keys or Activity Detail beta-gating | P0 | Yes if route remains reachable |
| Batch 5 | Organizations member/workspace labels | P1 | Partial |
| Batch 6 | Project helper/placeholders and disabled legal entity/site copy | P1/P2 | Partial |
| Batch 7 | Misc status/auth/subscription/audit leftovers | P2 | No |

## Guardrails

- Do not modify schema, backend, DTO, routes, or business logic during i18n cleanup.
- Do not auto-generate translations in bulk without reviewing user-visible tone.
- Keep changes grouped by module so regressions are easy to review.
- Prefer fixing keys that are already referenced by UI over adding unused dictionary entries.
