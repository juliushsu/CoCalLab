-- SOURCE ONLY. Retain saved report sources across MANUAL and non-MANUAL flows.
begin;
create function cocal_report_private.source_retained(p_org uuid,p_project uuid,p_document uuid,p_draft uuid,p_activity uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from(
  select r.payload from public.report_generations r where r.organization_id=p_org and r.project_id=p_project
  union all select s.row_snapshot->'payload' from cocal_report_private.snapshots s where s.organization_id=p_org and s.project_id=p_project
 ) reports where jsonb_typeof(reports.payload->'appendix_mappings') is distinct from 'array'
 or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(reports.payload->'appendix_mappings')='array' then reports.payload->'appendix_mappings' else '[]'::jsonb end) x
  where jsonb_typeof(x) is distinct from 'object' or not(x ?& array['emission_activity_id','source_document_id','source_draft_id','calculation_result_id'])
  or jsonb_typeof(x->'emission_activity_id') is distinct from 'string'
  or exists(select 1 from unnest(array['emission_activity_id','source_document_id','source_draft_id','calculation_result_id']) k
    where x->k is distinct from 'null'::jsonb and(jsonb_typeof(x->k) is distinct from 'string' or x->>k !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
  or(p_document is not null and lower(x->>'source_document_id')=p_document::text)
  or(p_draft is not null and lower(x->>'source_draft_id')=p_draft::text)
  or(p_activity is not null and lower(x->>'emission_activity_id')=p_activity::text)));
$$;
create function cocal_report_private.retain_source() returns trigger language plpgsql security definer set search_path='' as $$
declare doc uuid;draft uuid;activity uuid;org uuid;project uuid;
begin
 if tg_table_name='emission_activities' then doc:=old.source_document_id;draft:=old.source_draft_id;activity:=old.id;org:=old.organization_id;project:=old.project_id;
 elsif tg_table_name='extracted_document_drafts' then doc:=old.uploaded_document_id;draft:=old.id;org:=old.organization_id;project:=old.project_id;
 else doc:=old.id;org:=old.organization_id;project:=old.project_id;end if;
 perform 1 from public.projects p where p.id=project and p.organization_id=org for no key update;
 if cocal_report_private.source_retained(org,project,doc,draft,activity) then raise exception 'REPORT_SOURCE_RETAINED' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
create trigger report_retain_activity before update or delete on public.emission_activities for each row execute function cocal_report_private.retain_source();
create trigger report_retain_draft before update or delete on public.extracted_document_drafts for each row execute function cocal_report_private.retain_source();
create trigger report_retain_receipt before update or delete on public.uploaded_documents for each row execute function cocal_report_private.retain_source();
create function cocal_report_private.prevent_scope_hard_delete() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='projects' then
  if exists(select 1 from public.report_generations r where r.project_id=old.id) or exists(select 1 from cocal_report_private.snapshots s where s.project_id=old.id)
  or exists(select 1 from cocal_recalc_private.requests q where q.project_id=old.id)
  or exists(select 1 from public.extracted_document_drafts d where d.project_id=old.id and cocal_manual_private.is_manual(d.extraction_provider,d.raw_payload))
  then raise exception 'PROJECT_HAS_RETAINED_SOURCES_OR_REPORTS' using errcode='42501';end if;
 else
  if exists(select 1 from public.report_generations r where r.organization_id=old.id) or exists(select 1 from cocal_report_private.snapshots s where s.organization_id=old.id)
  or exists(select 1 from cocal_recalc_private.requests q where q.organization_id=old.id)
  or exists(select 1 from public.extracted_document_drafts d where d.organization_id=old.id and cocal_manual_private.is_manual(d.extraction_provider,d.raw_payload))
  then raise exception 'ORGANIZATION_HAS_RETAINED_SOURCES_OR_REPORTS' using errcode='42501';end if;
 end if;return old;
end;$$;
create trigger project_report_hard_delete_guard before delete on public.projects for each row execute function cocal_report_private.prevent_scope_hard_delete();
create trigger organization_report_hard_delete_guard before delete on public.organizations for each row execute function cocal_report_private.prevent_scope_hard_delete();
revoke all on all functions in schema cocal_report_private from public,anon,authenticated,service_role;
commit;
