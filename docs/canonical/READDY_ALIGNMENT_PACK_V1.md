# Readdy Alignment Pack V1

Date: 2026-05-30
Status: canonical Readdy alignment pack
Scope: Readdy UX alignment only; no feature, schema, or migration change

## Purpose

This is the primary document Readdy should read before creating or modifying CoCalLab screens.

Readdy's role is to improve user understanding, value visibility, trust, and flow.

Readdy's role is not to define backend reality, entity models, DTOs, governance engines, or new product scope.

## Canonical Inputs

Readdy should align with:

1. `docs/canonical/MULTI_AI_CANONICAL_RULES_V1.md`
2. `docs/canonical/PROJECT_WORLD_MODEL_V1.md`
3. `docs/canonical/PRODUCT_NARRATIVE_CANONICAL_V1.md`
4. `docs/canonical/VALUE_MOMENT_CANONICAL_V1.md`
5. `docs/architecture/NAVIGATION_ONTOLOGY_V1.md`
6. `docs/architecture/BOUNDARY_CANONICAL_MODEL_V1.md`
7. `docs/architecture/PLATFORM_GOVERNANCE_ISOLATION.md`
8. Closed-beta docs when staging/beta surfaces are being designed.

## A. Readdy Can Do

Readdy may improve the following areas.

### 1. Value Visibility

Readdy can make the product value easier to feel.

Allowed:

- Show how evidence becomes draft data.
- Show how reviewed drafts become activities.
- Show how activities support analytics/report output.
- Use value-oriented copy instead of module-only copy.
- Highlight time saved and reduced spreadsheet work.

Examples:

- "Review extracted data before it becomes inventory."
- "Trace report numbers back to source evidence."
- "Generate a report package for discussion."

### 2. User Journey

Readdy can improve guided flow through the canonical value chain:

> Documents -> Draft -> Activity -> Analytics -> Report

Allowed:

- Clarify next steps.
- Improve empty states.
- Improve loading states.
- Improve page hierarchy.
- Improve cross-links between existing surfaces.
- Improve role-aware journey explanation.

Readdy must not create a new route hierarchy without canonical approval.

### 3. Success States

Readdy can improve what users see after actions succeed.

Allowed:

- Upload success.
- Draft extraction success.
- Draft confirmed/rejected state.
- Activity created state.
- Analytics loaded state.
- Report generated/history state.
- Permission-denied explanation.

Success states should answer:

- What happened?
- What changed?
- What should the user do next?
- Is this beta/preview/generated/final?

### 4. Trust Signals

Readdy can add or improve trust cues when they reflect current reality.

Allowed trust signals:

- Staging/beta warning.
- Synthetic data warning.
- Mock/fallback badge.
- Provider mode label.
- Confidence indicator.
- Source document link.
- Generated report id.
- Snapshot/timestamp label.
- Role/permission explanation.
- "Not formal compliance validation" warning.

Trust signals must not overclaim.

### 5. Feedback Entry Points

Readdy can make beta feedback easier to submit.

Allowed:

- Feedback buttons.
- Page-level "report issue" entry.
- Copyable request/error id display.
- Feedback prompts tied to document/draft/activity/report ids.
- Guided closed-beta feedback copy.

Feedback entry points must not imply support for public signup, production onboarding, or unsupported modules.

## B. Readdy Must Not Independently Add

Readdy may not independently add or redefine:

| Forbidden Area | Rule |
|---|---|
| Entity Model | Do not define new domain objects or relationships |
| DTO | Do not invent frontend DTOs that imply backend/schema reality |
| CBAM Workflow | Do not add CBAM routes, cards, forms, reports, or readiness claims |
| Product CFP Workflow | Do not add Product CFP/LCA flows or persistence claims |
| Governance Engine | Do not invent report validation, methodology, factor source, or approval engines |
| New Route Ownership | Do not decide route ownership or platform/tenant placement |
| Legal Entity Workflow | Do not activate legal entity management without canonical approval |
| Site / Facility Workflow | Do not activate site/facility management without canonical approval |
| Formal Report Validation | Do not imply official compliance validation |
| Platform AI Governance In Tenant Nav | Do not place platform governance as ordinary tenant workflow |

## C. Items Requiring Canonical Approval

Readdy must request canonical approval before changing or adding:

| Item | Why Approval Is Required |
|---|---|
| New route | Route ownership affects navigation ontology and backend expectations |
| New sidebar item | Navigation implies product support and route ownership |
| New entity label | Entity vocabulary affects world model and schema expectations |
| New DTO shape | DTO drift can break backend/frontend alignment |
| New status enum | Status words can imply workflow states that do not exist |
| New report type | Reports imply deliverable and compliance scope |
| New validation/preflight claim | May imply formal compliance behavior |
| New methodology language | May imply governed registry |
| New factor source/source lifecycle UI | May imply authoritative registry |
| New CBAM mention | May imply unsupported workflow |
| New Product CFP mention | May imply unsupported workflow |
| New AI governance screen | May violate platform/tenant separation |
| Legal Entity/Site activation | Boundary model and permissions are sensitive |
| Workspace/organization copy change | Can reintroduce workspace/legal entity confusion |
| Analytics source/fallback behavior | Can make mock output look real |
| Carbon adjustment eligibility/claim UI | Can overstate claims governance |

## Readdy Route Guidance

| Surface | Readdy Treatment |
|---|---|
| Documents | May improve upload flow, evidence state, no-production-data warning |
| Draft Review | May improve review clarity, correction state, confidence/source display |
| Activities | May improve list/create clarity; must not make mock verify/recalculate look official |
| Analytics | May improve source badges, units, fallback warnings |
| Reports | May improve report history/snapshot clarity; must not claim formal validation |
| Members | May improve role explanation and collaboration value |
| Workspace | May improve workspace clarity; must not imply legal entity |
| Legal Entity | Disabled placeholder only unless canonical approval |
| Site / Facility | Disabled placeholder only unless canonical approval |
| AI Governance | Platform-only; not tenant navigation |
| Product CFP | Hidden or coming soon only; no workflow |
| CBAM | Hidden; no workflow |
| Methodology | Hidden unless canonical implementation exists |
| Self Monitoring | Hidden unless canonical implementation exists |
| Factor Sources | Hidden/static/demo only unless canonical implementation exists |

## Copy Rules

Use:

- "Workspace."
- "Project."
- "Evidence."
- "Draft."
- "Activity."
- "Report history."
- "Report snapshot."
- "Preview, not formal validation."
- "Staging/closed beta."

Avoid:

- "Audit-ready."
- "Officially validated."
- "Compliance-certified."
- "CBAM-ready."
- "Product CFP-ready."
- "Legal entity" when meaning workspace.
- "Site" when meaning workspace/project.

## Value Chain Readdy Should Optimize

Priority value chain:

1. Documents.
2. Draft.
3. Activity.
4. Analytics.
5. Report.

Every design improvement should ask:

- Does this help the user see value sooner?
- Does this help the user trust the number more?
- Does this preserve the canonical world model?
- Does this avoid overclaiming unsupported capability?

## Merge Safety Rules

Before Readdy output is merged:

1. Exclude local `.env` or secret files.
2. Preserve lockfiles unless intentionally updated.
3. Run type-check/build where applicable.
4. Check DTO alignment against backend contracts.
5. Check route/navigation alignment.
6. Check hidden/gated modules remain hidden/gated.
7. Check mock/fallback states are labeled.
8. Check product narrative does not overclaim.

## Final Readdy Rule

Readdy can make CoCalLab feel clearer, more trustworthy, and more valuable.

Readdy cannot make unsupported capabilities real through UI.

When in doubt:

> Improve the evidence-to-report journey, but do not invent the world model.
