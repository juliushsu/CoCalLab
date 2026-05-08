-- CaCalLab staging hardening columns
-- Scope: core tables used by closed beta write flows

alter table if exists organizations
  add column if not exists is_test boolean not null default true,
  add column if not exists env text not null default 'staging';

alter table if exists organization_members
  add column if not exists is_test boolean not null default true,
  add column if not exists env text not null default 'staging';

alter table if exists subscriptions
  add column if not exists is_test boolean not null default true,
  add column if not exists env text not null default 'staging';

alter table if exists projects
  add column if not exists is_test boolean not null default true,
  add column if not exists env text not null default 'staging';

alter table if exists uploaded_documents
  add column if not exists is_test boolean not null default true,
  add column if not exists env text not null default 'staging';

alter table if exists extracted_document_drafts
  add column if not exists is_test boolean not null default true,
  add column if not exists env text not null default 'staging';

alter table if exists emission_activities
  add column if not exists is_test boolean not null default true,
  add column if not exists env text not null default 'staging';

alter table if exists calculation_results
  add column if not exists is_test boolean not null default true,
  add column if not exists env text not null default 'staging';

alter table if exists report_generations
  add column if not exists is_test boolean not null default true,
  add column if not exists env text not null default 'staging';

alter table if exists ai_audit_results
  add column if not exists is_test boolean not null default true,
  add column if not exists env text not null default 'staging';

alter table if exists audit_logs
  add column if not exists is_test boolean not null default true,
  add column if not exists env text not null default 'staging';

create index if not exists organizations_env_idx on organizations (env, is_test);
create index if not exists projects_env_idx on projects (env, is_test);
create index if not exists uploaded_documents_env_idx on uploaded_documents (env, is_test);
create index if not exists extracted_document_drafts_env_idx on extracted_document_drafts (env, is_test);
create index if not exists emission_activities_env_idx on emission_activities (env, is_test);
create index if not exists calculation_results_env_idx on calculation_results (env, is_test);
create index if not exists report_generations_env_idx on report_generations (env, is_test);
create index if not exists ai_audit_results_env_idx on ai_audit_results (env, is_test);
create index if not exists audit_logs_env_idx on audit_logs (env, is_test);
