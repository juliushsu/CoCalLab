# Role Governance Matrix V1

Status: governance registry only. This document does not implement an auth system or rewrite RLS.

## Role Principles

- Roles describe governance intent before backend enforcement.
- Current production-compatible enforcement may still use `organization_members`.
- Future auth work must preserve workspace isolation and avoid accidental cross-workspace data exposure.
- Platform roles are internal and must not be mixed with tenant roles.

## Canonical Roles

| Role | Visible Scope | Editable Scope | Report Generation Permission | Factor Governance Permission | Cross-Workspace Access | Invitation Authority | Audit Visibility |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `platform_admin` | Platform surfaces, environment/seed/AI governance, support diagnostics, limited workspace support views. | Platform governance records, seed governance, environment flags, global methodology registry. | No tenant report generation by default; may impersonate only through audited support procedure. | Global methodology/factor governance. | Yes, internal-only and audited. | Can invite platform users; does not manage tenant invites unless support procedure allows. | Full platform audit; limited tenant audit for support/governance. |
| `workspace_owner` | Entire workspace: members, subscription, legal entities, sites, projects, reports, exports. | Workspace settings, members, billing/admin fields, legal entities, sites, projects, reports. | Yes, for workspace projects subject to subscription status. | Workspace-owned factors/rules when enabled; no global factor governance. | No. | Full workspace invitation authority. | Full workspace audit visibility. |
| `workspace_admin` | Entire workspace except owner-only billing/security operations if later separated. | Legal entities, sites, projects, members except owner transfer; report operations. | Yes, for workspace projects subject to subscription status. | Workspace-owned factor governance when enabled. | No. | Can invite consultant/editor/viewer/auditor depending workspace policy. | Full workspace audit visibility except platform-only logs. |
| `consultant` | Assigned workspaces/projects/entities. | Assigned project data, evidence, activity review, draft preparation; no billing. | Optional, only when workspace admin grants report generation. | Usually readonly; may propose factors but cannot approve without governance role. | Yes only by separate membership in each workspace; no implicit global access. | No default invitation authority. | Audit visibility for assigned projects and own actions. |
| `auditor` | Assigned reports, report boundaries, evidence trail, calculation snapshots, audit logs. | Comments/review outcomes only; no source data mutation by default. | No default report generation; may request regeneration or review generated versions. | Readonly factor/methodology snapshots. | No, unless invited to multiple workspaces. | None. | High readonly audit visibility for assigned scope. |
| `editor` | Assigned workspace/project/entity/site workflow surfaces. | Documents, drafts, activities, project data within assigned scope. | Yes only if report generation permission is enabled for editor role. | No approval rights; may select existing factors in workflow where allowed. | No. | None by default. | Own actions and project-level audit context. |
| `viewer` | Readonly assigned workspace/project/report surfaces. | None. | No. | Readonly factor labels/snapshots used by reports. | No. | None. | Limited readonly audit context when useful for report traceability. |

## Permission Domains

### Workspace Governance

Primary roles:

- `workspace_owner`
- `workspace_admin`

May govern:

- member access
- subscription visibility
- legal entity/site master data
- project lifecycle
- report generation policy

### Methodology / Factor Governance

Primary roles:

- `platform_admin` for global methodology/factors
- `workspace_owner` / `workspace_admin` for workspace-owned custom factors if enabled

Readonly roles:

- `auditor`
- `viewer`
- `consultant`
- `editor`

### Report Governance

Primary roles:

- `workspace_owner`
- `workspace_admin`
- `editor` when explicitly allowed

Review roles:

- `auditor`
- `consultant` when assigned

### Platform Governance

Primary role:

- `platform_admin`

Tenant roles must not receive `/platform/*` by role inheritance.

## Role Conflict Rules

- Platform role does not automatically make a user a tenant workspace owner.
- Workspace owner does not grant platform visibility.
- Consultant cross-workspace access must be represented as explicit membership/assignment per workspace.
- Auditor access should be readonly-first and report/evidence scoped.
- Editor can mutate workflow data but should not approve methodology governance.

## Future Implementation Notes

Implementation may later introduce role tables or claims, but Phase 1 governance requires only:

- stable role names,
- route visibility expectations,
- audit responsibility,
- least-privilege defaults.
