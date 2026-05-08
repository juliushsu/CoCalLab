# Navigation Visibility Policy

Status: route visibility policy registry. This is not an auth implementation.

## Visibility States

| State | Meaning |
| --- | --- |
| `hidden` | Route/nav item is not shown and direct access should be denied by auth when implemented. |
| `readonly` | Route is visible but mutation/export/generation actions are disabled. |
| `internal-only` | Route belongs to CoCalLab platform operations and is never tenant navigation. |
| `audit-only` | Route exposes trace/review records without workflow mutation. |

## Route Policy Matrix

| Route Pattern | Canonical Layer | Default Visibility Policy | Notes |
| --- | --- | --- | --- |
| `/platform/*` | platform | `internal-only`; `platform_admin` only | Platform operations, seed, environment, AI governance, support diagnostics. |
| `/admin/*` | tenant/workspace governance | workspace member roles only | Existing Readdy admin shell currently hosts tenant workflow/governance. Must not be used for platform governance. |
| `/workspace/*` | governance | workspace member | Owner/admin editable; consultant/editor/viewer filtered by assignment and permissions. |
| `/workspace/:workspaceId/members` | governance | workspace owner/admin; readonly for auditors only if explicitly allowed | Invitations and membership changes are governance actions. |
| `/workspace/:workspaceId/legal-entities` | governance | workspace owner/admin; readonly for auditor/consultant if assigned | Legal entity is reporting subject governance, not ordinary workflow. |
| `/workspace/:workspaceId/sites` | governance | workspace owner/admin/editor if granted; readonly for assigned roles | Site visibility may later become entity/site scoped. |
| `/project/*` | workflow | project member | Project members include inherited workspace roles and explicit assignment roles. |
| `/project/:projectId/documents` | workflow | project editor/consultant/auditor/viewer by role | Editor/consultant can upload only if editable; auditor/viewer readonly. |
| `/project/:projectId/activities` | workflow | project member | Editor/consultant may edit assigned workflow data; auditor/viewer readonly. |
| `/project/:projectId/boundary` | governance | report boundary governance roles | Hidden or readonly for roles without boundary authority. |
| `/report/*` | workflow/governance | project/report member | Generated report pages render immutable snapshots. |
| `/report/:reportId/preview` | workflow | project/report member | Viewer/auditor readonly. |
| `/report/:reportId/generate` | workflow/governance | roles with report generation permission | Hidden for viewer/auditor by default. |
| `/factors/*` | governance | methodology governance roles | Tenant users see readonly factor snapshots where relevant. |
| `/methodology/*` | governance/platform | methodology governance roles; platform admin for global registry | Separate global methodology from workspace custom factors. |
| `/analytics/*` | workflow | workspace/project member | Readonly for viewer/auditor; scoped to project/workspace/entity/site permission. |
| `/subscription/*` | governance | workspace owner/admin | Viewer/editor hidden or readonly depending policy. |
| `/ai-governance/*` | platform | `internal-only` unless explicitly mounted under `/platform/*` | AI governance does not belong to tenant workflow. |
| `/seed-governance/*` | platform | `internal-only`; platform admin only | Seed pack operations are platform governance. |

## Policy Rules

### Hidden

Use `hidden` when:

- user has no membership or assignment for the route scope,
- route is platform-only and user is not `platform_admin`,
- action would imply governance authority the role does not have.

### Readonly

Use `readonly` when:

- user can inspect records but cannot mutate,
- subscription status prevents writes,
- auditor/reviewer needs traceability without workflow mutation,
- generated reports must be viewed from immutable snapshot data.

### Internal-Only

Use `internal-only` when:

- route governs environment, seed, platform AI behavior, provider configuration, or support diagnostics,
- route can affect multiple workspaces,
- route reveals system controls not intended for tenants.

### Audit-Only

Use `audit-only` when:

- route is used for assurance/review,
- user should inspect snapshots, logs, evidence chains, or report trace,
- user must not alter source records.

## Minimum Navigation Contract

Navigation must evaluate:

- route layer,
- workspace membership,
- project assignment,
- report permission,
- methodology governance permission,
- platform role,
- subscription readonly state.

Do not infer platform access from workspace roles.
