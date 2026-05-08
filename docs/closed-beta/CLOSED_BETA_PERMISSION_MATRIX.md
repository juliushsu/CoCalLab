# Closed Beta Permission Matrix

Status: closed-beta governance registry. This document does not implement auth.

## Closed Beta Roles

| Role | Visible Pages | Editable Pages | Report Permissions | Export Permissions | Factor Governance Access | Platform Visibility |
| --- | --- | --- | --- | --- | --- | --- |
| `tester` | Assigned workspace/project pages, documents, activities, analytics, report preview/history, known limitation pages. | Limited project workflow data if explicitly granted; otherwise readonly. | Can generate reports only when assigned an editor-like test profile. Can preview seeded reports. | Disabled by default unless export testing is assigned. | Readonly factor labels/snapshots used by reports. | None. |
| `consultant` | Assigned workspace/project/entity/site workflow pages, report pages, analytics, evidence review. | Assigned documents, drafts, activities, and project preparation where granted. | May generate draft/test reports only if workspace admin grants permission. | May export only if workspace policy and test plan allow. | Readonly by default; may propose factor issues outside product flow. | None. |
| `internal_qa` | Closed-beta workspace/project pages, QA scenarios, validation checklist docs, report previews. | Staging/test records only; may reseed only through approved internal procedure. | Can generate test reports in staging if assigned. | Can test exports in staging only. | Readonly or test-only factor validation; no global production factor governance. | Limited internal QA diagnostics, not full `/platform/*` unless also platform admin. |
| `platform_admin` | `/platform/*`, seed/environment/AI governance, support diagnostics, and closed-beta workspaces through audited support views. | Platform governance records, staging seed governance, environment toggles, support remediation. | Does not generate tenant reports by default except audited support/test procedure. | Can test platform export controls; tenant export actions must be audited. | Global methodology/factor governance. | Full platform visibility. |

## Page Groups

### Tenant Workflow Pages

Examples:

- project list/detail
- document upload/review
- activity list/detail
- analytics
- report history/preview

Closed-beta visibility:

- `tester`: visible when assigned
- `consultant`: visible when assigned
- `internal_qa`: visible in staging
- `platform_admin`: support visibility only, audited

### Tenant Governance Pages

Examples:

- workspace settings
- members
- legal entities
- sites
- project boundary
- subscription status

Closed-beta visibility:

- `tester`: mostly hidden or readonly
- `consultant`: readonly unless explicitly assigned
- `internal_qa`: visible for QA scenarios
- `platform_admin`: support visibility only, audited

### Methodology / Factor Pages

Examples:

- factor source list
- factor snapshot views
- methodology references

Closed-beta visibility:

- `tester`: readonly report-linked snapshots
- `consultant`: readonly
- `internal_qa`: readonly/test validation
- `platform_admin`: editable global governance

### Platform Pages

Examples:

- `/platform/ai-governance`
- `/platform/seed-governance`
- `/platform/environments`
- `/platform/support-diagnostics`

Closed-beta visibility:

- `tester`: hidden
- `consultant`: hidden
- `internal_qa`: hidden unless separately granted platform role
- `platform_admin`: visible and editable according to platform policy

## Closed Beta Defaults

- No public signup.
- No public multi-tenant rollout.
- No consultant marketplace.
- No production destructive migration.
- No tenant access to AI governance controls.
- No tenant access to seed or environment governance.

## Permission Risk Notes

- Tester roles can accidentally look like workspace admins in seed data; QA scripts must verify actual route visibility.
- Consultant access must be assignment-based, not global.
- Internal QA must be staging/test scoped.
- Platform admin support access must be explicit and audit logged.
