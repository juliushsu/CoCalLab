-- CaCalLab V1 analytics backbone hardening
-- Adds canonical classification system for analytics dimensions

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'classification_system_code') THEN
    CREATE TYPE classification_system_code AS ENUM ('ghg_scope', 'iso_category');
  END IF;
END;
$$;

create table if not exists emission_activity_classifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  emission_activity_id uuid not null references emission_activities(id) on delete cascade,
  classification_system_code classification_system_code not null,
  classification_code text not null,
  source text not null default 'system_derived',
  confidence_score numeric(5,4),
  metadata jsonb not null default '{}'::jsonb,
  is_test boolean not null default true,
  env text not null default 'staging',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emission_activity_classifications_confidence_chk check (
    confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)
  ),
  constraint emission_activity_classifications_code_chk check (
    (classification_system_code = 'ghg_scope' and classification_code in ('scope_1', 'scope_2', 'scope_3'))
    or
    (classification_system_code = 'iso_category' and classification_code in (
      'category_1', 'category_2', 'category_3', 'category_4', 'category_5', 'category_6'
    ))
  )
);

create unique index if not exists emission_activity_classifications_activity_system_uniq
  on emission_activity_classifications (emission_activity_id, classification_system_code);

create index if not exists emission_activity_classifications_org_project_system_idx
  on emission_activity_classifications (organization_id, project_id, classification_system_code, classification_code);

create index if not exists emission_activity_classifications_env_idx
  on emission_activity_classifications (env, is_test);

drop trigger if exists trg_emission_activity_classifications_updated_at on emission_activity_classifications;
create trigger trg_emission_activity_classifications_updated_at
before update on emission_activity_classifications
for each row execute function set_updated_at();

alter table emission_activity_classifications enable row level security;

drop policy if exists emission_activity_classifications_select_policy on emission_activity_classifications;
create policy emission_activity_classifications_select_policy
  on emission_activity_classifications for select
  using (is_active_org_member(organization_id));

drop policy if exists emission_activity_classifications_write_policy on emission_activity_classifications;
create policy emission_activity_classifications_write_policy
  on emission_activity_classifications for all
  using (is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[]))
  with check (
    is_active_org_member(organization_id, array['owner', 'admin', 'editor']::member_role[])
    and organization_is_writable(organization_id)
  );

create or replace function derive_activity_scope_code(
  p_final_scope smallint,
  p_suggested_scope smallint
)
returns text
language sql
immutable
as $$
  select case coalesce(p_final_scope, p_suggested_scope)
    when 1 then 'scope_1'
    when 2 then 'scope_2'
    when 3 then 'scope_3'
    else 'scope_3'
  end;
$$;

create or replace function derive_activity_iso_category_code(
  p_category text,
  p_subcategory text,
  p_activity_type text,
  p_final_scope smallint,
  p_suggested_scope smallint
)
returns text
language plpgsql
immutable
as $$
declare
  v_scope_code text;
  v_category text := lower(coalesce(p_category, ''));
  v_subcategory text := lower(coalesce(p_subcategory, ''));
  v_activity_type text := lower(coalesce(p_activity_type, ''));
begin
  v_scope_code := derive_activity_scope_code(p_final_scope, p_suggested_scope);

  if v_scope_code = 'scope_1' then
    return 'category_1';
  end if;

  if v_scope_code = 'scope_2' then
    return 'category_2';
  end if;

  if v_category in ('business_travel', 'transport', 'commuting', 'logistics')
    or v_subcategory in ('business_travel', 'transport', 'freight')
    or v_activity_type in ('transport', 'business_travel', 'logistics')
  then
    return 'category_3';
  end if;

  if v_category in ('purchased_goods', 'capital_goods', 'waste', 'waste_management', 'materials', 'services', 'water')
    or v_subcategory in ('purchased_goods', 'capital_goods', 'waste', 'materials', 'services', 'water')
    or v_activity_type in ('waste', 'materials', 'water')
  then
    return 'category_4';
  end if;

  if v_category in ('sold_products_use', 'downstream_transport', 'downstream', 'leased_assets', 'franchises', 'investments')
    or v_subcategory in ('sold_products_use', 'downstream_transport', 'downstream')
  then
    return 'category_5';
  end if;

  return 'category_6';
end;
$$;

create or replace function upsert_emission_activity_classifications(p_emission_activity_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_activity emission_activities%rowtype;
  v_scope_code text;
  v_iso_code text;
begin
  select *
  into v_activity
  from emission_activities ea
  where ea.id = p_emission_activity_id;

  if v_activity.id is null then
    return;
  end if;

  v_scope_code := derive_activity_scope_code(v_activity.final_scope, v_activity.suggested_scope);
  v_iso_code := derive_activity_iso_category_code(
    v_activity.category,
    v_activity.subcategory,
    v_activity.activity_type,
    v_activity.final_scope,
    v_activity.suggested_scope
  );

  insert into emission_activity_classifications (
    organization_id,
    project_id,
    emission_activity_id,
    classification_system_code,
    classification_code,
    source,
    confidence_score,
    metadata,
    is_test,
    env
  )
  values
    (
      v_activity.organization_id,
      v_activity.project_id,
      v_activity.id,
      'ghg_scope',
      v_scope_code,
      'system_derived',
      v_activity.confidence_score,
      '{}'::jsonb,
      v_activity.is_test,
      v_activity.env
    ),
    (
      v_activity.organization_id,
      v_activity.project_id,
      v_activity.id,
      'iso_category',
      v_iso_code,
      'system_derived',
      v_activity.confidence_score,
      '{}'::jsonb,
      v_activity.is_test,
      v_activity.env
    )
  on conflict (emission_activity_id, classification_system_code)
  do update set
    organization_id = excluded.organization_id,
    project_id = excluded.project_id,
    classification_code = excluded.classification_code,
    source = excluded.source,
    confidence_score = excluded.confidence_score,
    metadata = excluded.metadata,
    is_test = excluded.is_test,
    env = excluded.env,
    updated_at = now();
end;
$$;

create or replace function trg_sync_emission_activity_classifications()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform upsert_emission_activity_classifications(new.id);
  return new;
end;
$$;

drop trigger if exists trg_sync_emission_activity_classifications on emission_activities;
create trigger trg_sync_emission_activity_classifications
after insert or update of
  organization_id,
  project_id,
  category,
  subcategory,
  activity_type,
  suggested_scope,
  final_scope,
  confidence_score,
  env,
  is_test
on emission_activities
for each row execute function trg_sync_emission_activity_classifications();

do $$
declare
  r record;
begin
  for r in select id from emission_activities loop
    perform upsert_emission_activity_classifications(r.id);
  end loop;
end;
$$;

create or replace function get_emissions_analytics(
  p_organization_id uuid,
  p_project_id uuid default null,
  p_dimension text default 'ghg_scope'
)
returns table (
  classification_system_code text,
  classification_code text,
  total_co2e_kg numeric(20,10),
  activity_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_dimension not in ('ghg_scope', 'iso_category') then
    raise exception 'invalid_dimension';
  end if;

  return query
  with codes as (
    select c.code, c.sort_order
    from (
      values
        ('scope_1'::text, 1),
        ('scope_2'::text, 2),
        ('scope_3'::text, 3)
    ) as c(code, sort_order)
    where p_dimension = 'ghg_scope'

    union all

    select c.code, c.sort_order
    from (
      values
        ('category_1'::text, 1),
        ('category_2'::text, 2),
        ('category_3'::text, 3),
        ('category_4'::text, 4),
        ('category_5'::text, 5),
        ('category_6'::text, 6)
    ) as c(code, sort_order)
    where p_dimension = 'iso_category'
  ),
  base as (
    select
      ea.id,
      case
        when p_dimension = 'ghg_scope' then
          coalesce(
            eac.classification_code,
            derive_activity_scope_code(ea.final_scope, ea.suggested_scope)
          )
        else
          coalesce(
            eac.classification_code,
            derive_activity_iso_category_code(
              ea.category,
              ea.subcategory,
              ea.activity_type,
              ea.final_scope,
              ea.suggested_scope
            )
          )
      end as resolved_code,
      coalesce(cr.co2e_kg, 0)::numeric(20,10) as co2e_kg
    from emission_activities ea
    left join emission_activity_classifications eac
      on eac.emission_activity_id = ea.id
      and eac.classification_system_code = p_dimension::classification_system_code
    left join calculation_results cr
      on cr.emission_activity_id = ea.id
      and cr.is_latest = true
    where ea.organization_id = p_organization_id
      and (p_project_id is null or ea.project_id = p_project_id)
      and ea.status = 'active'
      and ea.inclusion_status = 'included'
  ),
  agg as (
    select
      b.resolved_code,
      sum(b.co2e_kg)::numeric(20,10) as total_co2e_kg,
      count(*)::bigint as activity_count
    from base b
    group by b.resolved_code
  )
  select
    p_dimension::text as classification_system_code,
    codes.code as classification_code,
    coalesce(agg.total_co2e_kg, 0)::numeric(20,10) as total_co2e_kg,
    coalesce(agg.activity_count, 0)::bigint as activity_count
  from codes
  left join agg on agg.resolved_code = codes.code
  order by codes.sort_order;
end;
$$;

revoke all on function get_emissions_analytics(uuid, uuid, text) from public, anon, authenticated;
grant execute on function get_emissions_analytics(uuid, uuid, text) to service_role;
