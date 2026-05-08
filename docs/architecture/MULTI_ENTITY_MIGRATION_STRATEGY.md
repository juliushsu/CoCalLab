# Multi-Entity Migration Strategy

Status: staging-first migration strategy. No destructive production rewrite is authorized by this document.

The current production-compatible interpretation is `organizations = workspaces`. The migration path adds legal entities, sites, ownership, and report boundary semantics beside the current model before any endpoint or RLS policy changes become mandatory.

## Migration Guardrails

- Staging first, with canonical seed reseed after every phase.
- No direct destructive rewrite.
- No direct rename of `organizations`.
- No historical report deletion.
- Existing `organization_id` parameters remain accepted until compatibility views or API aliases are proven.
- Every phase requires reseed, validation, analytics verification, and report verification.

## Phase 1: Semantic Split Only

Goal: establish vocabulary and compatibility without physical schema changes.

Actions:

- Document `organization = workspace`.
- Update internal docs and API contract notes to call `organization_id` a workspace-scoped compatibility key.
- Add no tables.
- Add no required frontend public flow.

Rollback strategy:

- Revert documentation and contract text only.
- No database rollback required.

Compatibility strategy:

- Keep all existing `organization_id` request and response fields.
- Keep `organization_members`, `subscriptions`, `projects`, and RLS policies unchanged.

Reseed strategy:

- Rerun `canonical_seed_pack_staging_v20260407_v2.sql`.
- Confirm `seed_pack_registry.scenario_code = 'stg_core_closed_beta'` remains canonical.

Validation SQL:

```sql
select 'organizations_as_workspaces' as check_name, count(*) as rows
from organizations
where env = 'staging' or is_test = true;

select 'workspace_members_compatible' as check_name, count(*) as rows
from organization_members
where env = 'staging' or is_test = true;

select 'projects_have_workspace_scope' as check_name, count(*) as rows
from projects
where organization_id is not null
  and (env = 'staging' or is_test = true);
```

## Phase 2: `legal_entities` + `sites` Tables

Goal: create first-class reporting subjects and CBAM-ready locations without moving ownership of existing records.

Actions:

- Create `legal_entities`.
- Create `sites`.
- Insert one default legal entity per existing workspace in staging seed.
- Insert one or more scenario sites under the default legal entity.
- Keep `projects.organization_id` unchanged.

Rollback strategy:

- In staging, drop the new tables only after dependent proposal data is removed.
- In production, disable write paths to new tables and leave data inert until a forward fix is ready.

Compatibility strategy:

- Existing endpoints still read/write by `organization_id`.
- New tables are additive and nullable from project perspective.
- Optional frontend selectors are hidden behind closed-beta/staging flags.

Reseed strategy:

- Bump seed version, for example `v2026.04.07.v3`.
- Reseed default legal entity and site rows deterministically from existing workspace seed ids.
- Validate that every staging workspace has at least one legal entity.

Validation SQL:

```sql
select o.id as workspace_id, count(le.id) as legal_entity_count
from organizations o
left join legal_entities le on le.workspace_id = o.id
where o.env = 'staging' or o.is_test = true
group by o.id
having count(le.id) = 0;

select le.id as legal_entity_id, count(s.id) as site_count
from legal_entities le
left join sites s on s.legal_entity_id = le.id
where le.env = 'staging' or le.is_test = true
group by le.id;
```

## Phase 3: Project Ownership Migration

Goal: connect projects to their primary legal entity and optional report boundary while preserving current `organization_id` behavior.

Actions:

- Add nullable `projects.primary_legal_entity_id`.
- Add nullable `projects.default_site_id` only if current UI needs a default site hint.
- Backfill staging projects to the default legal entity.
- Do not remove `projects.organization_id`.

Rollback strategy:

- Set new project columns to null.
- Disable code paths requiring legal entity selection.
- Keep existing project/report functions unchanged.

Compatibility strategy:

- `organization_id` remains the workspace key.
- Project creation may infer `primary_legal_entity_id` when a workspace has exactly one active legal entity.
- Existing reports continue to render from existing payload snapshots.

Reseed strategy:

- Rerun canonical seed.
- Ensure all seed projects point to a deterministic default legal entity.
- Regenerate analytics and report verification outputs.

Validation SQL:

```sql
select p.id, p.project_code
from projects p
where (p.env = 'staging' or p.is_test = true)
  and p.primary_legal_entity_id is null;

select p.id, p.organization_id, le.workspace_id
from projects p
join legal_entities le on le.id = p.primary_legal_entity_id
where p.organization_id <> le.workspace_id;
```

## Phase 4: RLS Redesign

Goal: evolve access control from workspace-only membership to workspace/entity/site scoped membership.

Actions:

- Introduce `workspace_members`, `entity_members`, and `site_members` in staging.
- Keep `organization_members` as the compatibility source or create a compatibility view.
- Create helper functions such as `is_active_workspace_member`, `is_active_entity_member`, and `is_active_site_member`.
- Rewrite policies in staging for new tables first, then dependent data tables.

Rollback strategy:

- Keep old `organization_members` policies available behind rollback migration.
- Repoint helper functions to workspace-only logic if entity/site policy fails.
- Do not drop existing `is_active_org_member` until all endpoints are migrated.

Compatibility strategy:

- `organization_members` remains authoritative until parity tests pass.
- Workspace owner/admin can inherit entity/site access by policy, but explicit entity/site grants override least-privilege behavior for non-admin roles.
- Existing Edge Functions continue calling `requireOrganizationWriteAccess` until a new authorization adapter supports entity/site checks.

Reseed strategy:

- Seed workspace owner membership.
- Seed default entity/site memberships derived from workspace membership.
- Add negative-test members for entity/site isolation.

Validation SQL:

```sql
select wm.workspace_id, wm.user_id, wm.role
from workspace_members wm
left join organization_members om
  on om.organization_id = wm.workspace_id
 and om.user_id = wm.user_id
where om.id is null;

select em.entity_id, le.workspace_id, em.user_id
from entity_members em
join legal_entities le on le.id = em.entity_id
left join workspace_members wm
  on wm.workspace_id = le.workspace_id
 and wm.user_id = em.user_id
where wm.id is null;
```

## Phase 5: Historical Seed Migration

Goal: preserve historical fixtures and generated reports while making canonical seed multi-entity aware.

Actions:

- Freeze existing generated reports as immutable snapshots.
- Add legal entity/site/source snapshots to new seed reports only.
- Keep historical seed report payload hashes stable unless intentionally versioned.
- Add duplicate source ownership sample data without enabling an engine.

Rollback strategy:

- Restore previous canonical seed pack version from `seed_pack_registry`.
- Rerun prior seed SQL.
- Keep new tables populated but mark new scenario pack inactive if required.

Compatibility strategy:

- Existing report history renders from `report_generations.payload`.
- Old seed reports may have null `legal_entity_snapshot` and `site_snapshot`; they are valid legacy snapshots.
- New report verification must handle both legacy and multi-entity snapshot payloads.

Reseed strategy:

- Bump canonical seed pack version.
- Record reseed run in `seed_pack_reseed_runs`.
- Run validation, analytics verification, and report verification in that order.

Validation SQL:

```sql
select id, report_version, payload_hash
from report_generations
where env = 'staging' or is_test = true
order by project_id, report_version;

select scenario_code, seed_pack_version, schema_version, is_canonical
from seed_pack_registry
where scenario_code = 'stg_core_closed_beta';

select rg.id
from report_generations rg
where (rg.env = 'staging' or rg.is_test = true)
  and rg.status = 'completed'
  and rg.payload is null;
```

## Required Phase Exit Criteria

Every phase exits only after:

- Schema migration applied to staging.
- Canonical seed reseeded.
- Validation SQL passes.
- Analytics API or SQL verification passes.
- Report generation/render verification passes.
- Rollback path is documented and tested in staging.
