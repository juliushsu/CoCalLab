# RLS Impact Analysis

Status: architecture analysis for the move from `organization_members` to workspace/entity/site access layers.

## Current Model

Current RLS is workspace-like but named organization-based:

- `organization_members` grants membership under `organization_id`.
- `is_active_org_member(target_org_id, allowed_roles)` is the primary read/write helper.
- `organization_is_writable(target_org_id)` gates writes based on subscription state.
- Most formal data tables carry `organization_id`.
- Edge Functions call `requireOrganizationWriteAccess(request, supabase, input.organization_id)`.

Current behavior is consistent for a single legal entity MVP, because tenant, billing account, membership scope, and reporting subject are the same row.

## Future Model

Future RLS must split access:

| Layer | Table | Purpose | Grants access to |
| --- | --- | --- | --- |
| Workspace | `workspace_members` | SaaS tenant membership, billing/admin operations | workspace settings, subscription, cross-entity admin views |
| Legal entity | `entity_members` | legal reporting subject access | entity projects, entity reports, entity activities |
| Site | `site_members` | facility/installational access | site evidence, site activities, site source metadata |

Inheritance policy proposal:

- Workspace `owner` and `admin` inherit all entity/site access in that workspace.
- Workspace `editor` and `viewer` do not automatically imply all entity/site access after Phase 4 unless a closed-beta setting explicitly enables broad access.
- Entity roles can grant access to all sites under that entity when `site_members` is absent.
- Site roles are the narrowest scope and cannot grant cross-entity access.

## Policy Differences

### `organization_members`

- One table controls everything.
- Simple and predictable.
- Over-grants when one workspace contains multiple client entities or facilities.
- Cannot support consultant access to one legal entity inside a workspace.

### `workspace_members`

- Controls tenant administration, billing, subscriptions, seed registry, and workspace-level settings.
- Should not alone decide whether a user can edit a legal entity's formal emissions data, except owner/admin inheritance.

### `entity_members`

- Controls legal entity master data, projects, reports, and activity records scoped to the entity.
- Enables group workspaces with multiple reporting subjects.
- Required for financial-control and equity-share reporting workflows.

### `site_members`

- Controls facility/installational evidence and source-level activity ingestion.
- Enables CBAM-ready location governance.
- Useful for plant operators uploading site evidence without seeing group-level reports.

## Affected Edge Functions

High impact:

- `backend/supabase/functions/process-document/index.ts`: currently authorizes by `organization_id`, then writes uploaded document/draft data under project.
- `backend/supabase/functions/confirm-draft/index.ts`: currently authorizes by `organization_id`, then turns drafts into activities.
- `backend/supabase/functions/recalculate-project/index.ts`: currently reads activities/factors by `organization_id` and project.
- `backend/supabase/functions/generate-report/index.ts`: currently builds a report from workspace/project data and writes `report_generations`.
- `backend/supabase/functions/run-ai-audit/index.ts`: currently authorizes by `organization_id` and reads report/project data.

Medium impact:

- `backend/supabase/functions/analytics-emissions/index.ts`: currently accepts `organization_id`; future queries need entity/site filters.
- `backend/supabase/functions/adjustment-rule-result/index.ts`: currently evaluates adjustment eligibility by `organization_id`; future claims need entity/report boundary context.
- `backend/supabase/functions/enforce-subscription-status/index.ts`: remains workspace-level, but parameter naming should become workspace-compatible.
- `backend/supabase/functions/create-organization/index.ts`: must become create workspace, not create legal entity, unless split into two endpoints.

Shared auth impact:

- `backend/supabase/functions/_shared/authz.ts`: replace or wrap `requireOrganizationReadAccess` and `requireOrganizationWriteAccess` with workspace/entity/site-aware authorization.

## Affected RPC Functions

Authorization and membership:

- `list_my_organizations()`: future equivalent should be `list_my_workspaces()` and optionally `list_my_accessible_entities()`.
- `create_organization_with_owner(...)`: future equivalent creates a workspace plus default owner membership.
- `add_organization_member(...)`
- `update_organization_member_role(...)`
- `remove_organization_member(...)`
- `is_active_org_member(...)`
- `organization_is_writable(...)`

Data mutation:

- `process_document_atomic(...)`
- `classify_document_atomic(...)`
- `confirm_draft_atomic(...)`
- `recalculate_project_atomic(...)`
- `generate_report_atomic(...)`
- `run_ai_audit_atomic(...)`
- `evaluate_adjustment_eligibility(...)`

Analytics:

- `get_emissions_analytics(...)`
- `upsert_emission_activity_classifications(...)` if classifications become entity/site aware.

Staging operations:

- `purge_staging_data_dry_run()`
- `purge_staging_data()`

## Affected Tables And Policies

Directly affected:

- `organizations`
- `organization_members`
- `subscriptions`
- `projects`
- `uploaded_documents`
- `extracted_document_drafts`
- `emission_activities`
- `emission_activity_classifications`
- `calculation_results`
- `report_generations`
- `ai_audit_results`
- `audit_logs`
- `emission_factors`
- `carbon_adjustment_items`
- `adjustment_certificates`
- `adjustment_claim_rules`
- `adjustment_applications`
- `adjustment_audit_logs`

New-policy tables:

- `legal_entities`
- `sites`
- `entity_relationships`
- `emission_source_ownerships`
- `report_boundaries`

## Frontend Surface Impact

Routes/pages that currently expose organization semantics:

- `/admin/organizations`
- `/admin/organizations/create`
- `/admin/organizations/:id/edit`
- `/admin/organizations/:id/members`
- project create/edit pages with `organization_id` selection.
- report, analytics, documents, activities, subscription pages that carry `organization_id`.

Services impacted:

- `organizationService.ts`
- `projectService.ts`
- `documentService.ts`
- `activityService.ts`
- `analyticsService.ts`
- `reportService.ts`
- `adjustmentService.ts`
- `reportSnapshotService.ts`

## RLS Redesign Sequence

1. Add new membership tables in staging.
2. Backfill `workspace_members` from `organization_members`.
3. Add compatibility helper functions.
4. Add entity/site membership and negative seed cases.
5. Move new tables to entity/site-aware RLS.
6. Move project/activity/report paths only after API authorization supports boundary context.
7. Keep `organization_members` compatibility until frontend, Edge Functions, RPCs, and seed validation all pass.

## Primary Risks

- Over-grant: workspace viewer accidentally sees every legal entity/site.
- Under-grant: existing closed-beta tester loses project/report access after split.
- Subscription mismatch: entity-level write checks incorrectly bypass workspace subscription readonly state.
- Report mismatch: old reports without entity/site snapshots fail new readers.
- Analytics mismatch: workspace totals and entity totals diverge without explicit filters.
