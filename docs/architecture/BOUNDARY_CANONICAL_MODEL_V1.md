# Boundary Canonical Model V1

Status: architecture proposal, staging-first.

This document defines the canonical ontology for CoCalLab's Enterprise ESG boundary governance model. It intentionally does not rename or rewrite production tables. In the current V1 schema, `organizations` is reinterpreted semantically as `workspace` until a staged migration creates explicit enterprise boundary tables.

## Non-Negotiables

- `organization = workspace` during the stabilization sprint.
- Do not directly rename `organizations`.
- Do not delete historical report data.
- Do not expand mock schema as a substitute for canonical boundary tables.
- Do not allow public-beta flows to depend on this proposal before staging validation passes.

## Canonical Ontology

### Workspace

Definition: the SaaS tenant and commercial/account boundary.

Workspace owns:

- SaaS tenant identity.
- Billing and subscription.
- Members, invitations, and tenant-level roles.
- Plan limits, feature flags, usage limits, and support contracts.

Current mapping:

- Current table: `organizations`.
- Current membership: `organization_members`.
- Current subscription: `subscriptions.organization_id`.
- Current API vocabulary may still say `organization_id`, but architecture meaning is `workspace_id`.

Workspace must not be treated as:

- A legal reporting subject.
- A physical facility.
- A report boundary.
- A guarantee that all child records belong to one legal entity.

Canonical fields:

- `id`
- `slug`
- `display_name`
- `billing_customer_ref`
- `subscription_status`
- `default_country_code`
- `default_timezone`
- `metadata`

### Legal Entity

Definition: the法人 / registered company / statutory reporting subject inside a workspace.

Legal Entity owns:

- Registered legal identity.
- Tax id.
- Reporting subject identity.
- Entity-level permissions where needed.
- Entity-level reporting eligibility.

Legal Entity must be able to:

- Belong to exactly one workspace.
- Own zero or many sites.
- Participate in group relationships through `entity_relationships`.
- Be included or excluded in report boundaries.
- Be snapshotted into generated reports.

Canonical fields:

- `id`
- `workspace_id`
- `entity_code`
- `registered_name`
- `display_name`
- `tax_id`
- `country_code`
- `registration_address`
- `industry_code`
- `status`
- `metadata`

### Site

Definition: a facility, installation, plant, branch, warehouse, office, or CBAM-ready location under a legal entity.

Site owns:

- Facility identity.
- Installation or operational location identity.
- Address, country, timezone, and location metadata.
- CBAM-ready plant or installation attributes.
- Site-level permissions where needed.

Site must be able to:

- Belong to one workspace.
- Belong to one legal entity at a point in time.
- Host emission sources.
- Be included or excluded by report boundary.
- Be snapshotted into generated reports.

Canonical fields:

- `id`
- `workspace_id`
- `legal_entity_id`
- `site_code`
- `site_name`
- `facility_type`
- `address`
- `country_code`
- `timezone`
- `latitude`
- `longitude`
- `cbam_installation_ref`
- `status`
- `metadata`

### Project

Definition: an inventory boundary, reporting cycle, and report generation unit.

Project owns:

- Reporting period.
- Inventory boundary working set.
- Drafts, activities, calculations, report generation jobs, and AI audit jobs.
- Report versions for a specific reporting cycle.

Project must not be the only source of boundary truth. It references a `report_boundary` and stores lifecycle state, but the inclusion/exclusion rules belong to the boundary model.

Current mapping:

- Current table: `projects`.
- Current key: `projects.organization_id` means `workspace_id`.
- Current field: `projects.boundary_type` is only a compatibility label until `report_boundaries` is introduced.

Canonical fields:

- `id`
- `workspace_id`
- `primary_legal_entity_id`
- `report_boundary_id`
- `project_code`
- `name`
- `reporting_start_date`
- `reporting_end_date`
- `status`
- `base_currency`
- `metadata`

### Report Boundary

Definition: the governed inclusion model for a project/report.

Report Boundary owns:

- Boundary method.
- Legal entity inclusion/exclusion.
- Site inclusion/exclusion.
- Emission source ownership and allocation references.
- Methodology notes and exclusions.
- Report-time immutable snapshot references.

Supported boundary methods:

- `operational_control`: include entities/sites/sources controlled operationally by the reporting subject.
- `financial_control`: include entities/sites/sources financially controlled by the reporting subject.
- `equity_share`: include emissions by ownership share or equity percentage.

Canonical fields:

- `id`
- `workspace_id`
- `project_id`
- `boundary_method`
- `reporting_start_date`
- `reporting_end_date`
- `included_legal_entity_ids`
- `included_site_ids`
- `excluded_legal_entity_ids`
- `excluded_site_ids`
- `methodology_version`
- `status`
- `approved_by_user_id`
- `approved_at`
- `metadata`

## Entity Relationships

`entity_relationships` defines the legal and reporting graph between legal entities. It is not a membership table and must not grant access by itself.

Relationship examples:

- parent company
- subsidiary
- affiliate
- joint venture
- supplier
- customer

Canonical rules:

- Relationships are periodized with `effective_from` and `effective_to`.
- Ownership and control percentages are explicit.
- A relationship may be used by report boundary selection, but report generation must snapshot the selected relationship state.

## Current-To-Canonical Mapping

| Current term | Stabilized semantic term | Future canonical table |
| --- | --- | --- |
| `organizations` | workspace | `workspaces` or retained `organizations` with workspace semantics |
| `organization_members` | workspace members | `workspace_members` |
| `subscriptions.organization_id` | workspace subscription | `workspace_id` |
| `projects.organization_id` | workspace scope | `projects.workspace_id` compatibility view or column |
| `projects.boundary_type` | compatibility label | `report_boundaries.boundary_method` |
| `emission_activities.organization_id` | workspace scope | workspace plus entity/site/source ownership |
| `report_generations.organization_id` | workspace scope | immutable workspace/entity/site boundary snapshot |

## Boundary Governance Principles

1. Tenant access starts at workspace, but reporting truth starts at legal entity and site.
2. A report can never rely on mutable master data after generation.
3. A source can be entered once and allocated many times, but it must not be counted twice for the same reporting boundary.
4. RLS must support workspace, legal entity, and site membership without weakening tenant isolation.
5. Staging seed data is the canonical reproducibility mechanism for every migration phase.
