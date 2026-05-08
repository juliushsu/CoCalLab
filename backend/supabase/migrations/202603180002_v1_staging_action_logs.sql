-- CaCalLab staging closed-beta action logs

create table if not exists action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  organization_id uuid references organizations(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text not null,
  env text not null default 'staging',
  is_test boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists action_logs_user_created_idx on action_logs (user_id, created_at desc);
create index if not exists action_logs_org_proj_created_idx on action_logs (organization_id, project_id, created_at desc);
create index if not exists action_logs_env_created_idx on action_logs (env, is_test, created_at desc);
