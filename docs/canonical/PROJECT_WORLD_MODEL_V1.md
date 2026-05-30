# Project World Model V1

Date: 2026-05-30
Status: canonical vocabulary and world model
Scope: documentation alignment only; no feature, schema, or migration change

## Purpose

This document defines the canonical CoCalLab product vocabulary for AI agents, Readdy, product copy, and implementation planning.

The main risk this document prevents is world-model drift:

- Workspace being treated as legal entity.
- Site being treated as workspace.
- Project being treated as report boundary engine.
- Report preview being treated as formal validation.
- Platform governance being placed in tenant navigation.

## Canonical Model Summary

| Concept | Canonical Meaning | Deprecated Wording | Forbidden Wording |
|---|---|---|---|
| `workspace` | Tenant/collaboration boundary where users, projects, documents, activities, and reports are organized | organization, org, company workspace | legal entity, reporting entity, facility, site |
| `legal_entity` | Legal/reporting subject; may be referenced by project/report boundary when supported | organization as legal entity, company record | workspace, tenant, customer account |
| `site` | Physical operating location/facility under a legal/reporting context | facility when used loosely | workspace, project, tenant |
| `project` | Work unit for preparing one carbon inventory/report package inside a workspace | assessment, campaign, report project | legal entity, site, workspace |
| `report_boundary` | The scope/snapshot used to explain what a generated report covers | boundary_type as if complete engine | formal compliance scope unless implemented |
| `report` | Generated report payload/history/snapshot used for review and delivery discussion | preview as final report | audit-ready report, formal validation, compliance certificate |
| `methodology` | Governed calculation/reporting method or registry when implemented | help text, UI section title | hardcoded UI copy as official methodology |
| `platform` | Internal/system governance layer for operators and platform admins | admin page, tenant admin | ordinary tenant workflow |

## Workspace

Canonical definition:

> A workspace is the collaboration and tenancy boundary.

It contains:

- Members.
- Projects.
- Documents.
- Drafts.
- Activities.
- Analytics views.
- Report history.

Current compatibility note:

- Existing backend/UI may still use `organizations`.
- In the canonical model, current `organizations` maps to workspace/tenant, not legal entity.

Allowed wording:

- Workspace.
- Tenant workspace.
- Assigned workspace.
- Client workspace, only when the workspace is explicitly used as a client collaboration container.

Deprecated wording:

- Organization, except when referring to existing DB/API names.
- Org, except in code identifiers.

Forbidden wording:

- Legal entity.
- Reporting entity.
- Site.
- Facility.

## Legal Entity

Canonical definition:

> A legal entity is the legal/reporting subject that may be attached to project/report boundary when the workflow supports it.

Closed-beta boundary:

- Legal Entity may exist in schema/docs.
- Legal Entity management is not a closed-beta user workflow.
- Legal Entity controls should remain disabled placeholders unless a canonical implementation exists.

Allowed wording:

- Legal entity.
- Reporting legal entity.

Deprecated wording:

- Organization as legal entity.
- Company record when it implies workspace identity.

Forbidden wording:

- Workspace.
- Tenant.
- Customer account.

## Site

Canonical definition:

> A site is a physical operating location or facility, usually under a legal/reporting context.

Closed-beta boundary:

- Site / Facility management is not a closed-beta user workflow.
- Site controls should remain disabled placeholders unless canonical implementation exists.

Allowed wording:

- Site.
- Facility, when the product explicitly means physical operating location.

Deprecated wording:

- Location, if it is ambiguous.
- Facility as a generic business unit.

Forbidden wording:

- Workspace.
- Project.
- Tenant.

## Project

Canonical definition:

> A project is the work unit for preparing an inventory/report package inside a workspace.

A project may collect:

- Documents.
- Drafts.
- Activities.
- Calculations.
- Analytics.
- Report generations.

Allowed wording:

- Project.
- Inventory project.
- Report preparation project.

Deprecated wording:

- Campaign.
- Assessment, unless specifically defined by a future workflow.

Forbidden wording:

- Legal entity.
- Site.
- Workspace.

## Report Boundary

Canonical definition:

> A report boundary is the documented scope/snapshot of what a generated report covers.

Important distinction:

- `boundary_type` labels are not a full boundary engine.
- Disabled Legal Entity/Site controls are not active boundary management.
- A report boundary must not imply formal compliance unless the backend and governance path support it.

Allowed wording:

- Report scope.
- Report boundary snapshot.
- Project-level report boundary.

Deprecated wording:

- Boundary visualizer, if it implies implemented engine.
- Boundary engine, unless implemented.

Forbidden wording:

- Official compliance scope.
- Certified boundary.
- Audit-approved boundary.

## Report

Canonical definition:

> A report is a generated payload/history/snapshot used for review, discussion, and delivery preparation.

Closed-beta boundary:

- Reports can be generated and reviewed as staging/beta outputs.
- Report Validation/preflight is preview/mock unless canonical implementation says otherwise.
- Reports must not be described as formal compliance validation.

Allowed wording:

- Generated report.
- Report history.
- Report snapshot.
- Report package for review.

Deprecated wording:

- Preview, if it is ambiguous whether it is live/mock/generated.

Forbidden wording:

- Audit-ready.
- Officially validated.
- Compliance-certified.
- Formal validation.

## Methodology

Canonical definition:

> Methodology is a governed calculation/reporting method or registry.

Current boundary:

- Methodology is not an implemented user-facing module.
- Methodology labels in UI must not imply a governed registry exists.

Allowed wording:

- Methodology, only when linked to canonical docs or implemented registry.
- Calculation method, if describing a known calculation path.

Deprecated wording:

- Methodology as a general marketing label.

Forbidden wording:

- Official methodology registry, unless implemented.
- Certified methodology.

## Platform

Canonical definition:

> Platform is the internal/system governance layer, separate from tenant/workspace workflows.

Platform may include:

- AI governance.
- Global factor/methodology governance.
- System diagnostics.
- Seed/environment controls.
- Internal QA tools.

Allowed wording:

- Platform.
- Platform admin.
- Internal governance.

Deprecated wording:

- Admin, when ambiguous with tenant admin.

Forbidden wording:

- Tenant workflow.
- Customer workspace page.
- Ordinary user feature.

## Canonical Hierarchy

Current closed-beta hierarchy:

1. Platform: internal governance and operator layer.
2. Workspace: tenant/collaboration boundary.
3. Project: inventory/report work unit inside workspace.
4. Documents and drafts: evidence and extracted review data.
5. Activities and calculations: reviewed inventory records and calculation output.
6. Analytics: read views over reviewed/seeded data.
7. Report: generated payload/history/snapshot.

Future expanded hierarchy may include legal entity and site more fully, but Readdy or AI tools must not activate that hierarchy without canonical approval.

## World Model Guardrails

Do not:

- Use `organization` to mean legal entity in product copy.
- Present Legal Entity/Site as active closed-beta workflows.
- Present Report Validation as formal compliance.
- Present Methodology as an implemented registry.
- Present AI Governance as tenant workspace functionality.
- Present CBAM or Product CFP as current workflows.

Do:

- Say workspace when discussing tenant/collaboration.
- Say project when discussing the inventory/report work unit.
- Say report snapshot/history when discussing generated outputs.
- Say preview/mock/beta when output is not formal.
- Keep platform governance separate from tenant navigation.
