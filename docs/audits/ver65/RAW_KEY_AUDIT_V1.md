# CoCalLab Ver65 Raw Key Audit V1

Date: 2026-05-30

Scope:
- Package: `/Users/chishenhsu/Downloads/CoCalLab-Ver065`
- Areas scanned: UI source, admin pages, components, i18n dictionaries under `src/i18n/local/{en,zh,ja}/cocal.ts`
- Method: static scan of `t('...')` usages against flattened locale dictionaries.

## Summary

Ver65 still has a severe i18n raw-key risk.

Observed counts:
- `t(...)` usages scanned: 1,226
- Unique translation keys referenced: 897
- Missing or incomplete keys: 299
- Missing in all locales: 230
- Partial locale gaps: 69
- Static missing keys without a complete fallback/default: 170

Risk level: High

Why it matters:
- Closed beta testers will see raw keys like `reports.previewPage.title`, `activities.detailPage.verifyButton`, or `documents.processingStatus.pending` on core pages if rendered in affected paths.
- The highest-risk raw keys are concentrated in the exact guided beta chain: Documents, Drafts, Activities, Analytics, Reports.

## Severity Definition

| Severity | Definition |
| --- | --- |
| P0 | Visible in closed-beta core journey and missing in all locales or missing without reliable fallback. Likely to render raw keys. |
| P1 | Visible in beta or adjacent admin route, partial locale gap, dynamic key risk, or undermines trust on important surfaces. |
| P2 | Internal, platform-only, hidden, coming-soon, or non-beta page. Should be fixed before public release but not a staging blocker. |

## Missing Key Count by Prefix

| Prefix | Missing / Partial Count | Severity |
| --- | ---: | --- |
| `organizations.*` | 45 | P1 |
| `activities.*` | 44 | P0 |
| `documents.*` | 43 | P0 |
| `reports.*` | 32 | P0 |
| `carbonAdjustments.*` | 26 | P1 |
| `projects.*` | 23 | P0/P1 |
| `subscription.*` | 16 | P2 |
| `drafts.*` | 13 | P1 |
| `factorSources.*` | 10 | P2/P1 if route remains visible |
| `aiGovernance.*` | 8 | P2 |
| `common.*` | 6 | P1 |
| `status.*` | 6 | P1 |
| `auth.*` | 6 | P2 |
| `analytics.*` | 5 | P1 |
| `productCarbon.*` | 5 | P2 if hidden, P1 if visible |
| `emissionFactors.*` | 3 | P2 |
| `dataOrigin.*` | 2 | P1 |
| `reportTypes.*` | 2 | P1 |
| `capabilities.*` | 2 | P1 |
| `errors.*` | 1 | P1 |
| `audit.*` | 1 | P2 |

## P0 Findings

### Activities

Representative keys:
- `activities.verifySuccess`
- `activities.detailPage.verifyButton`
- `activities.detailPage.recalculateButton`
- `activities.detailPage.editButton`
- `activities.detailPage.pendingInclusion`
- `activities.detailPage.notCalculated`
- `activities.detailPage.notVerified`
- `activities.detailPage.sections.basicInfo`
- `activities.detailPage.sections.emissionInfo`
- `activities.detailPage.sections.calculationInfo`
- `activities.detailPage.fields.activityDate`
- `activities.detailPage.fields.emissionScope`
- `activities.verifyDialog.*`

Evidence:
- `src/pages/admin/activities/EmissionActivityDetailPage.tsx`
- Example references: lines 128, 265, 627

Reality:
- This page is also mock-heavy. Raw keys here compound the trust problem because users may see both fake data and untranslated UI.

Required before beta:
- Either hide/disable Activity Detail during guided beta or fully translate/gate it as a mock-only page.

### Reports

Representative keys:
- `reports.previewSection.backToHistory`
- `reports.previewPage.title`
- `reports.previewPage.exportReport`
- `reports.generateError`
- `reports.regenerateError`
- `reports.generateWarnings`
- `reports.generating`
- `reports.currentSection`
- `reports.previewPage.version`
- `reports.previewPage.status`
- `reports.previewPage.generatedAt`
- `reports.previewPage.sections`
- `reports.statistics.title`
- `reports.statistics.totalEmissions`
- `reports.previewSection.noContent`
- `reports.previewPage.aiGenerated`
- `reports.previewPage.userModified`
- `reports.exportDialog.title`

Evidence:
- `src/pages/admin/reports/ReportPreviewPage.tsx`
- Example references: lines 368, 370

Reality:
- Report Preview is the highest-trust surface. Raw keys here make the system look non-credible.
- Report Preview already lacks persisted `report_sections`; raw keys should be treated as a P0 beta blocker.

Required before beta:
- Translate Report Center, Report History, and Report Preview core keys in all supported languages, or hide unsupported report preview actions.

### Documents

Representative keys:
- `documents.orgNotFound`
- `documents.selectProject`
- `documents.steps.uploading`
- `documents.steps.processing`
- `documents.steps.classifying`
- `documents.steps.completed`
- `documents.steps.failed`
- `documents.processingStatus.pending`
- `documents.processingStatus.processing`
- `documents.processingStatus.completed`
- `documents.processingStatus.failed`

Evidence:
- `src/pages/admin/documents/DocumentUploadPage.tsx`
- `src/pages/admin/documents/UploadedDocumentListPage.tsx`
- Example references: `DocumentUploadPage.tsx:334`, `UploadedDocumentListPage.tsx:265`

Reality:
- Documents are the first value moment. Raw keys here damage first-session confidence.
- The sidebar already points to a missing `/admin/documents` route, making this module especially fragile.

Required before beta:
- Fix missing keys for upload progress, processing status, project/org selection, and error states.

### Projects

Representative keys:
- `projects.edit`
- `projects.overview.basic_info`
- `projects.fields.project_type`
- `projects.overview.total_documents`
- `projects.overview.total_activities`
- `projects.overview.total_emissions`
- `projects.overview.completion_rate`
- `projects.overview.quick_actions`
- `projects.overview.upload_documents`
- `projects.overview.view_activities`
- `projects.overview.generate_report`

Evidence:
- `src/pages/admin/projects/ProjectOverviewPage.tsx`
- Example reference: line 149

Reality:
- Project Overview sits upstream of every beta journey. Raw keys here make the whole workspace feel unfinished.

Required before beta:
- Complete project overview translations or simplify the page for guided beta.

## P1 Findings

### Workspace / Organizations

Missing / partial keys:
- `organizations.*` is the largest missing prefix group.

Reality:
- This is also where canonical ontology is most sensitive. Raw keys combined with `organization` wording can revive workspace/legal_entity/site confusion.

Recommended action:
- Prioritize user-visible workspace, members, invitation, owner/editor/viewer labels.

### Carbon Adjustments

Representative keys:
- `carbonAdjustments.searchPlaceholder`
- Multiple summary, rule result, and tab labels are incomplete or fallback-heavy.

Evidence:
- `src/pages/admin/carbon-adjustments/components/ItemsTab.tsx:105`

Reality:
- Carbon Adjustments is not a core closed-beta entry point, but it appears in sidebar. If visible, its translations and mock warnings must be reliable.

Recommended action:
- Hide for beta or complete visible keys and reinforce preview-only language.

### Analytics

Reality:
- Analytics has fewer raw keys than reports or activities, but still includes mock labels and unsupported hotspot copy.

Recommended action:
- Keep GHG/ISO labels complete; hide or clearly label hotspot mock sections.

### Report Types / Capabilities

Reality:
- Report Center uses hardcoded front-end capability status and report type cards.

Recommended action:
- Complete `reportTypes.*` and `capabilities.*` keys if Report Center remains visible.

## P2 Findings

### Product CFP

Reality:
- Product CFP is out of closed-beta scope and should be hidden. If hidden, its raw keys are P2. If visible, they become P1.

Recommended action:
- Hide route and sidebar item for beta.

### AI Governance

Reality:
- Platform-only route with mock data. Raw keys should not affect tenant testers if properly gated.

Recommended action:
- Add route-level platform-only guard before treating this as safe.

### Factor Sources / Emission Factors

Reality:
- Mock-heavy and active. Raw keys are P2 only if hidden/internal; P1 if exposed.

Recommended action:
- Hide Source Governance or mark as internal demo until canonical API exists.

## Raw Key Blockers Before Closed Beta

Must fix or hide:
1. `reports.*` Preview/History/Center keys.
2. `activities.*` Activity Detail keys, or hide Activity Detail.
3. `documents.*` upload/list/status keys.
4. `projects.*` overview and quick-action keys.
5. Workspace/member visible keys that affect role and access understanding.

Should fix next:
1. `analytics.*` mock/source labels.
2. `carbonAdjustments.*` visible tab/search/summary labels.
3. `reportTypes.*` and `capabilities.*`.
4. `dataOrigin.*` badges and legend.

Can wait if hidden:
1. `productCarbon.*`
2. `aiGovernance.*`
3. `factorSources.*`
4. `subscription.*` plan comparison copy

## Recommendation

Do not merge Ver65 until the P0 raw keys are closed or the affected routes are hidden from the closed-beta sidebar. For a guided staging beta, raw keys are not cosmetic; they directly reduce trust in OCR, activity conversion, analytics, and report generation.
