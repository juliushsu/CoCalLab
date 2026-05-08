# Platform Governance Isolation

Status: platform/tenant IA boundary definition. This is not a backend implementation plan.

## Core Distinction

`/admin/*` is tenant governance and workflow administration.

`/platform/*` is internal CoCalLab platform governance.

The two surfaces must not share implicit role inheritance. A user can be a workspace owner and still have zero platform access. A platform admin can inspect/support workspaces only through explicit, audited platform procedures.

## `/admin/*`

Purpose: tenant-facing workspace administration and project workflow.

Scope:

- workspace settings
- workspace members
- legal entities
- sites
- projects
- documents and activities
- analytics
- report generation/history
- subscription status
- tenant-visible factor snapshots or workspace custom factors when enabled

Primary roles:

- `workspace_owner`
- `workspace_admin`
- `consultant`
- `auditor`
- `editor`
- `viewer`

Governance type:

- tenant governance
- project workflow
- report governance

## `/platform/*`

Purpose: internal platform operations and system governance.

Scope:

- platform tenant support diagnostics
- environment governance
- seed governance
- AI governance
- provider governance
- global methodology registry
- global factor lifecycle
- system feature flags
- incident and audit operations

Primary role:

- `platform_admin`

Governance type:

- platform governance
- internal operations
- environment and seed control
- cross-workspace support with audit trail

## AI Governance Placement

AI Governance is not tenant workflow.

AI governance belongs to `/platform/*` because it controls:

- model/provider selection,
- prompt/version governance,
- safety and audit policy,
- evaluation policy,
- system-wide AI behavior,
- environment-specific AI configuration,
- fallback and provider risk controls.

Tenant users may see AI-generated outputs, AI audit results, or report recommendations inside workflow pages, but they must not see or mutate platform AI governance controls.

Allowed tenant AI surfaces:

- report AI audit result preview,
- project-level recommendations,
- data quality warnings,
- readonly explanation of generated content.

Forbidden tenant placement:

- `/admin/ai-governance` as a tenant workflow page,
- workspace-level model/provider control without a platform governance policy,
- seed/model evaluation controls inside tenant navigation.

## Seed Governance Placement

Seed governance is platform/internal.

It controls:

- canonical seed packs,
- staging reproducibility,
- scenario activation,
- migration verification fixtures,
- test data purging flows.

Seed governance must not appear in tenant workspace navigation.

## Environment Governance Placement

Environment governance is platform/internal.

It controls:

- staging vs production behavior,
- external action blocking,
- provider keys,
- feature flags,
- closed-beta toggles,
- support diagnostics.

Tenant users may see environment banners, but they must not control environment behavior.

## Isolation Rules

- `/platform/*` requires `platform_admin`.
- `/admin/*` requires workspace membership or assignment.
- Workspace role never grants platform role.
- Platform role never silently grants tenant mutation authority.
- Cross-workspace support views must be audit logged.
- AI, seed, and environment governance are internal-only by default.

## Migration Guidance

Existing tenant pages under `/admin/*` may remain until a routing cleanup phase. Any page governing platform AI, seed, environment, or provider behavior should be moved or documented as future `/platform/*` ownership before implementation.
