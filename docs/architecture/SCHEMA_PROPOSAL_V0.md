# Schema Proposal V0

Status: additive proposal only. Do not directly merge production semantics. Do not rename `organizations`.

Current stabilization rule:

- `organizations` remains the physical table.
- `organizations` is semantically reinterpreted as `workspace`.
- New enterprise boundary tables are introduced staging-first and behind compatibility layers.

## 1. `legal_entities`

Purpose:法人 / tax id / reporting subject.

```sql
create table legal_entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references organizations(id) on delete cascade,
  entity_code text not null,
  registered_name text not null,
  display_name text not null,
  tax_id text,
  country_code char(2) not null default 'TW',
  registration_address text,
  industry_code text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  env text not null default 'production',
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index legal_entities_workspace_code_uniq
  on legal_entities (workspace_id, entity_code);

create unique index legal_entities_workspace_tax_id_uniq
  on legal_entities (workspace_id, country_code, tax_id)
  where tax_id is not null;
```

## 2. `sites`

Purpose: facility / installation / CBAM-ready location.

```sql
create table sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references organizations(id) on delete cascade,
  legal_entity_id uuid not null references legal_entities(id) on delete restrict,
  site_code text not null,
  site_name text not null,
  facility_type text,
  address text,
  country_code char(2) not null default 'TW',
  timezone text not null default 'Asia/Taipei',
  latitude numeric(10,7),
  longitude numeric(10,7),
  cbam_installation_ref text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  env text not null default 'production',
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index sites_workspace_entity_code_uniq
  on sites (workspace_id, legal_entity_id, site_code);
```

## 3. `entity_relationships`

Purpose: relationship graph for parent/subsidiary/affiliate/JV/supplier/customer links.

```sql
create table entity_relationships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references organizations(id) on delete cascade,
  parent_legal_entity_id uuid references legal_entities(id) on delete restrict,
  child_legal_entity_id uuid not null references legal_entities(id) on delete restrict,
  relationship_type text not null,
  ownership_ratio numeric(9,8),
  control_type text,
  effective_from date not null,
  effective_to date,
  status text not null default 'active',
  trace_metadata jsonb not null default '{}'::jsonb,
  env text not null default 'production',
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_relationships_period_chk check (effective_to is null or effective_to >= effective_from),
  constraint entity_relationships_ratio_chk check (ownership_ratio is null or (ownership_ratio >= 0 and ownership_ratio <= 1))
);

create index entity_relationships_workspace_parent_child_idx
  on entity_relationships (workspace_id, parent_legal_entity_id, child_legal_entity_id, effective_from);
```

## 4. `emission_source_ownerships`

Purpose: ownership/control/allocation mapping for duplicate prevention.

Supporting table proposed by duplicate prevention:

```sql
create table emission_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references organizations(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  source_uid text not null,
  source_type text not null,
  source_name text not null,
  asset_fingerprint text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  env text not null default 'production',
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index emission_sources_workspace_uid_uniq
  on emission_sources (workspace_id, source_uid);
```

Ownership table:

```sql
create table emission_source_ownerships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references organizations(id) on delete cascade,
  emission_source_id uuid not null references emission_sources(id) on delete restrict,
  legal_entity_id uuid not null references legal_entities(id) on delete restrict,
  site_id uuid references sites(id) on delete set null,
  ownership_type text not null,
  allocation_ratio numeric(12,10) not null,
  effective_from date not null,
  effective_to date,
  trace_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  env text not null default 'production',
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emission_source_ownerships_ratio_chk check (allocation_ratio > 0 and allocation_ratio <= 1),
  constraint emission_source_ownerships_period_chk check (effective_to is null or effective_to >= effective_from)
);

create index emission_source_ownerships_source_period_idx
  on emission_source_ownerships (workspace_id, emission_source_id, effective_from, effective_to);
```

## 5. `report_boundaries`

Purpose: governed project/report inclusion model.

```sql
create table report_boundaries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references organizations(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  boundary_code text not null,
  boundary_method text not null,
  reporting_start_date date not null,
  reporting_end_date date not null,
  methodology_version text not null,
  status text not null default 'draft',
  approved_by_user_id uuid,
  approved_at timestamptz,
  included_legal_entity_ids jsonb not null default '[]'::jsonb,
  included_site_ids jsonb not null default '[]'::jsonb,
  excluded_legal_entity_ids jsonb not null default '[]'::jsonb,
  excluded_site_ids jsonb not null default '[]'::jsonb,
  selection_manifest jsonb not null default '{}'::jsonb,
  env text not null default 'production',
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_boundaries_period_chk check (reporting_end_date >= reporting_start_date),
  constraint report_boundaries_method_chk check (boundary_method in ('operational_control', 'financial_control', 'equity_share'))
);

create unique index report_boundaries_workspace_code_uniq
  on report_boundaries (workspace_id, boundary_code);
```

Optional normalized selection table:

```sql
create table report_boundary_source_selections (
  id uuid primary key default gen_random_uuid(),
  report_boundary_id uuid not null references report_boundaries(id) on delete cascade,
  emission_source_id uuid not null references emission_sources(id) on delete restrict,
  ownership_id uuid references emission_source_ownerships(id) on delete set null,
  selected boolean not null default true,
  allocation_ratio_snapshot numeric(12,10),
  why_selected text,
  why_not_selected text,
  trace_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

## Compatibility Notes

- Existing tables keep `organization_id` until compatibility APIs are migrated.
- Proposed tables use `workspace_id` while referencing current `organizations(id)`.
- A future rename to `workspaces` is optional and must be handled by compatibility views, not a direct destructive rename.
- Seed data must create one default legal entity/site per staging workspace before any endpoint requires these ids.
