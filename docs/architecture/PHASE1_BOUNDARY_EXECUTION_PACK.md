# Phase 1 Boundary Execution Pack

Status: staging-first execution pack. Additive only.

## Scope

Phase 1 converts the boundary governance model into safe staging artifacts without renaming `organizations`, without destructive RLS rewrites, and without breaking existing seed/report/activity flows.

## A. Migration Draft Files

Migration draft:

- `backend/supabase/migrations/202605080001_phase1_boundary_governance_staging.sql`

The migration adds:

- `legal_entities`
- `sites`
- nullable `projects.legal_entity_id`
- nullable `projects.site_id`
- `report_generations.legal_entity_snapshot`
- `report_generations.site_snapshot`
- `report_generations.boundary_snapshot`

It also defines compatibility helpers and helper-first RLS functions.

## B. Compatibility Helper Proposal

Phase 1 helpers preserve the existing `organization_id` workflow while introducing workspace/entity/site names:

- `get_workspace_id(p_organization_id uuid)`: identity mapping because `organization = workspace`.
- `get_project_workspace_id(p_project_id uuid)`: returns `projects.organization_id`.
- `get_project_legal_entity_id(p_project_id uuid)`: returns nullable `projects.legal_entity_id`.
- `get_project_site_id(p_project_id uuid)`: returns nullable `projects.site_id`.
- `project_boundary_context_v`: read-only project/workspace/legal-entity/site label context for validation and Readdy adapters.

Compatibility rule:

- Existing Edge Functions may continue accepting `organization_id`.
- New code should treat that id as `workspace_id` internally.
- Legal entity and site ids are optional until Phase 2+ flows require explicit selection.

## C. RLS Helper-First Proposal

Phase 1 does not rewrite current policies on existing production tables. It introduces stable helper names first:

- `is_workspace_member(p_workspace_id, p_allowed_roles)`
- `can_access_project(p_project_id, p_allowed_roles)`
- `can_access_legal_entity(p_legal_entity_id, p_allowed_roles)`
- `can_access_site(p_site_id, p_allowed_roles)`

Current implementation:

- `is_workspace_member` delegates to `is_active_org_member`.
- `can_access_legal_entity` checks the legal entity belongs to an accessible workspace.
- `can_access_site` checks the site belongs to an accessible workspace and legal entity.
- `can_access_project` checks workspace access and nullable legal entity/site compatibility.

Phase 1 policy boundary:

- Existing table policies remain unchanged.
- New `legal_entities` and `sites` policies use the helper functions.
- `organization_members` remains the source of truth.

## D. Seed V3 Changes

Seed v3 file:

- `backend/supabase/seed/canonical_seed_pack_staging_v20260407_v3.sql`

Seed v3 upgrades `stg_core_closed_beta`:

- one workspace using existing canonical `organizations` row,
- one legal entity,
- two sites,
- primary project bound to legal entity + primary site,
- secondary project bound to legal entity + secondary site,
- report rows include legal entity, site, and boundary snapshots.

## E. Validation SQL

Validation file:

- `docs/seed-governance/phase1-boundary-validation.sql`

The validation checks:

- workspace count,
- legal entity count,
- site count,
- project to legal entity/site alignment,
- report snapshot presence,
- helper function compatibility.

## F. Risk And Rollback Notes

Primary risks:

- Running the staging migration in production before endpoint readiness.
- Old report readers ignoring new snapshot fields.
- Seed v3 used before Phase 1 migration is applied.
- Future RLS work accidentally replacing `organization_members` too early.

Rollback:

- Disable use of v3 seed and return registry to `v2026.04.07.v2`.
- Set nullable `projects.legal_entity_id` and `projects.site_id` to null if needed.
- Stop reading new report snapshot columns; historical payloads remain intact.
- For staging-only rollback, drop `sites` then `legal_entities` after clearing project references.
- Do not delete historical `report_generations` outside staging/test data.

## G. Readdy Phase 1 DTO Fields

Project DTO additions:

```ts
type ProjectPhase1BoundaryFields = {
  workspace_id?: string; // alias of organization_id
  organization_id: string; // retained compatibility field
  legal_entity_id?: string | null;
  legal_entity_label?: string | null;
  site_id?: string | null;
  site_label?: string | null;
  boundary_type: 'operational_control' | 'financial_control' | 'equity_share' | string;
};
```

Report DTO additions:

```ts
type ReportPhase1SnapshotFields = {
  legal_entity_snapshot?: {
    legal_entity_id?: string | null;
    legal_entity_label?: string | null;
    entity_code?: string | null;
    tax_id?: string | null;
    country_code?: string | null;
  };
  site_snapshot?: {
    site_id?: string | null;
    site_label?: string | null;
    site_code?: string | null;
    facility_type?: string | null;
    country_code?: string | null;
  };
  boundary_snapshot?: {
    workspace_id: string;
    workspace_label?: string | null;
    legal_entity_id?: string | null;
    legal_entity_label?: string | null;
    site_id?: string | null;
    site_label?: string | null;
    boundary_type: string;
    reporting_period: {
      start_date: string;
      end_date: string;
    };
  };
};
```

Frontend rule:

- Render labels from snapshots for historical reports.
- Use live project/legal entity/site fields only for draft or current project views.
