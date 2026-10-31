-- Tenant consistency for new relationship keys; no existing-row validation or repair.
-- Requires PostgreSQL 15+ for column-specific ON DELETE SET NULL.
-- Live version, existing inconsistencies and lock budget require preflight before deployment.
begin;

create unique index projects_id_organization_binding_uniq on public.projects (id, organization_id);
create unique index legal_entities_id_workspace_binding_uniq on public.legal_entities (id, workspace_id);
create unique index sites_id_workspace_binding_uniq on public.sites (id, workspace_id);

-- MATCH SIMPLE preserves optional project/null fields. Existing ID-only FKs remain.
alter table public.uploaded_documents
  add constraint uploaded_documents_project_tenant_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete cascade not valid;

alter table public.extracted_document_drafts
  add constraint extracted_document_drafts_project_tenant_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete cascade not valid;

alter table public.emission_activities
  add constraint emission_activities_project_tenant_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete cascade not valid;

alter table public.calculation_results
  add constraint calculation_results_project_tenant_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete cascade not valid;

alter table public.report_generations
  add constraint report_generations_project_tenant_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete cascade not valid;

alter table public.ai_audit_results
  add constraint ai_audit_results_project_tenant_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete cascade not valid;

alter table public.emission_activity_classifications
  add constraint emission_activity_classifications_project_tenant_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete cascade not valid;

alter table public.audit_logs
  add constraint audit_logs_project_tenant_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete set null (project_id) not valid;

alter table public.action_logs
  add constraint action_logs_project_tenant_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete set null (project_id) not valid;

alter table public.carbon_adjustment_items
  add constraint carbon_adjustment_items_project_tenant_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete set null (project_id) not valid;

alter table public.adjustment_certificates
  add constraint adjustment_certificates_project_tenant_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete set null (project_id) not valid;

alter table public.adjustment_applications
  add constraint adjustment_applications_project_tenant_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete set null (project_id) not valid;

alter table public.adjustment_audit_logs
  add constraint adjustment_audit_logs_project_tenant_fk
  foreign key (project_id, organization_id) references public.projects (id, organization_id)
  on delete set null (project_id) not valid;

-- Boundary references are same-workspace only; no same-legal-entity domain rule.
-- Composite references also prevent referenced workspace changes by maintenance roles.
alter table public.projects
  add constraint projects_legal_entity_tenant_fk
  foreign key (legal_entity_id, organization_id) references public.legal_entities (id, workspace_id)
  on delete set null (legal_entity_id) not valid;

alter table public.projects
  add constraint projects_site_tenant_fk
  foreign key (site_id, organization_id) references public.sites (id, workspace_id)
  on delete set null (site_id) not valid;

alter table public.sites
  add constraint sites_legal_entity_tenant_fk
  foreign key (legal_entity_id, workspace_id) references public.legal_entities (id, workspace_id)
  on delete restrict not valid;

commit;
