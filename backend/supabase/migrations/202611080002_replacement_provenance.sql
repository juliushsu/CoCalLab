-- SOURCE CANDIDATE ONLY. Human corrections are not fresh OCR/source evidence.
-- Historical activities, calculations, reports and private snapshots are untouched.
begin;
do $$begin if not cocal_delete_private.deployment_ready() then raise exception 'Existing deletion source drift; do not rebaseline unknown source';end if;end;$$;

create function cocal_activity_private.provenance(p_org uuid,p_project uuid,p_activity uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare edge cocal_activity_private.replacements;before_row public.emission_activities;after_row public.emission_activities;
 current_id uuid:=p_activity;visited uuid[]:=array[p_activity];steps jsonb:='[]';changes jsonb;before_json jsonb;after_json jsonb;projected jsonb;
 receipt_status text;root_document uuid;depth integer:=0;
 fields text[]:=array['activity_name','activity_date','category','subcategory','activity_type','quantity','unit','normalized_quantity','normalized_unit','data_quality','inclusion_status','exclusion_reason','review_note','suggested_scope','final_scope','confidence_score','status','source_document_id','source_draft_id'];
begin
 loop
  select * into edge from cocal_activity_private.replacements r where r.organization_id=p_org and r.project_id=p_project and r.activity_id=current_id;
  exit when not found;
  depth:=depth+1;if depth>10000 or edge.predecessor_activity_id=any(visited) then raise exception 'ACTIVITY_REPLACEMENT_PROVENANCE_INVALID';end if;
  select * into before_row from public.emission_activities a where a.id=edge.predecessor_activity_id and a.organization_id=p_org and a.project_id=p_project;
  if not found then raise exception 'ACTIVITY_REPLACEMENT_PROVENANCE_INVALID';end if;
  select * into after_row from public.emission_activities a where a.id=edge.activity_id and a.organization_id=p_org and a.project_id=p_project;
  if not found or edge.activity_snapshot is null or edge.saved_result is null then raise exception 'ACTIVITY_REPLACEMENT_PROVENANCE_INVALID';end if;
  before_json:=to_jsonb(before_row);after_json:=edge.activity_snapshot;
  select jsonb_object_agg(key,value) into projected from jsonb_each(to_jsonb(after_row)) x(key,value) where edge.activity_snapshot ? key;
  if projected is distinct from edge.activity_snapshot or after_json->'source_document_id' is distinct from before_json->'source_document_id'
   or after_json->'source_draft_id' is distinct from before_json->'source_draft_id' then raise exception 'ACTIVITY_REPLACEMENT_PROVENANCE_INVALID';end if;
  select coalesce(jsonb_object_agg(k,jsonb_build_object('before',coalesce(before_json->k,'null'::jsonb),'after',coalesce(after_json->k,'null'::jsonb))),'{}') into changes
   from unnest(fields) k where before_json->k is distinct from after_json->k;
  steps:=jsonb_build_array(jsonb_build_object('predecessor_activity_id',edge.predecessor_activity_id,'activity_id',edge.activity_id,
   'replacement_mode',edge.mode,'reason',edge.reason,'actor_user_id',edge.actor_user_id,'occurred_at',edge.created_at,'changes',changes))||steps;
  root_document:=before_row.source_document_id;current_id:=edge.predecessor_activity_id;visited:=visited||current_id;
 end loop;
 if depth=0 then return null;end if;
 if root_document is not null then
  select u.hash_verification_status into receipt_status from public.uploaded_documents u where u.id=root_document and u.organization_id=p_org and u.project_id=p_project;
  if not found then raise exception 'ACTIVITY_REPLACEMENT_PROVENANCE_INVALID';end if;
 end if;
 return jsonb_build_object('version','20261108.replacement.1','source_usage','historical_reference_only','receipt_verification_status',receipt_status,'steps',steps);
end;$$;
create function cocal_activity_private.projected_activity(p_row public.emission_activities) returns jsonb
language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare provenance jsonb:=cocal_activity_private.provenance(p_row.organization_id,p_row.project_id,p_row.id);
begin
 -- Old stored successor rows/snapshots are not rewritten. Projection alone
 -- removes any inherited OCR confidence from their human-corrected version.
 return to_jsonb(p_row)||jsonb_build_object('replacement_provenance',provenance)||case when provenance is null then '{}'::jsonb else jsonb_build_object('confidence_score',null) end;
end;$$;

create function cocal_activity_private.require_source(p_old public.emission_activities,p_mode text) returns void
language plpgsql volatile security definer set search_path='' as $$
declare doc public.uploaded_documents;draft public.extracted_document_drafts;
begin
 if p_mode is null or p_mode not in('correct','exclude') then raise exception 'ACTIVITY_REPLACEMENT_INTENT_INVALID' using errcode='22023';end if;
 if p_old.source_document_id is null and p_old.source_draft_id is null then return;end if;
 if p_old.source_document_id is null or p_old.source_draft_id is null then raise exception 'ACTIVITY_REPLACEMENT_SOURCE_INVALID' using errcode='42501';end if;
 doc:=cocal_manual_private.lock_document(p_old.organization_id,p_old.project_id,p_old.source_document_id);
 select * into draft from public.extracted_document_drafts d where d.id=p_old.source_draft_id and d.uploaded_document_id=doc.id and d.organization_id=p_old.organization_id and d.project_id=p_old.project_id and d.is_latest and d.status='confirmed' for share;
 if not found then raise exception 'ACTIVITY_REPLACEMENT_SOURCE_INVALID' using errcode='42501';end if;
 -- Exclusion preserves all measured values and marks the historical original
 -- unverified. Correction still requires the original's server binding proof.
 if p_mode='correct' then perform cocal_manual_private.require_verified_original(doc);end if;
end;$$;

-- Patch precisely the two approved successor/source expressions, preserving
-- the existing actor, subscription, intent, transaction and immutable guards.
do $$declare definition text;anchor text;begin
 definition:=pg_get_functiondef('public.replace_emission_activity(uuid,uuid,uuid,uuid,text,text,text,jsonb,text)'::regprocedure);
 anchor:='perform cocal_activity_private.require_source(old_row);';
 if length(definition)-length(replace(definition,anchor,''))<>length(anchor) then raise exception 'Unrecognized replacement source guard';end if;
 definition:=replace(definition,anchor,'perform cocal_activity_private.require_source(old_row,p_mode);');
 anchor:='old_row.confidence_score,''active'',p_actor_user_id';
 if length(definition)-length(replace(definition,anchor,''))<>length(anchor) then raise exception 'Unrecognized replacement confidence expression';end if;
 execute replace(definition,anchor,'null,''active'',p_actor_user_id');
end;$$;

create or replace function cocal_activity_private.response(q cocal_activity_private.replacements,p_replayed boolean) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare active boolean;current_row jsonb;projected jsonb;
begin
 select to_jsonb(a) into current_row from public.emission_activities a where a.id=q.activity_id and a.organization_id=q.organization_id and a.project_id=q.project_id;
 if not found or q.saved_result is null or q.activity_snapshot is null then raise exception 'ACTIVITY_REPLACEMENT_RESULT_MISSING';end if;
 select jsonb_object_agg(key,val) into projected from jsonb_each(current_row) x(key,val) where q.activity_snapshot ? key;
 if projected is distinct from q.activity_snapshot then raise exception 'ACTIVITY_REPLACEMENT_RESULT_CHANGED';end if;
 active:=cocal_activity_private.is_effective(q.activity_id) and current_row->>'status'='active';
 return q.saved_result||jsonb_build_object('replayed',p_replayed,'operation_status',case when active then 'completed' else 'historical' end,'is_effective',active,
  'recalculation_required',cocal_activity_private.recalculation_required(q.organization_id,q.project_id),'replacement_provenance',cocal_activity_private.provenance(q.organization_id,q.project_id,q.activity_id));
end;$$;

-- Include authority-derived disclosures in prepared inputs. Existing authority
-- naturally becomes stale; no historical latest flags or saved rows are edited.
create or replace function cocal_recalc_private.inputs_v1(p_org uuid,p_project uuid) returns jsonb
language sql volatile security definer set search_path='' as $$
 select jsonb_build_object('activities',coalesce((select jsonb_agg(jsonb_build_object(
  'id',a.id,'organization_id',a.organization_id,'project_id',a.project_id,'status',a.status,
  'quantity',a.quantity,'unit',a.unit,'activity_date',a.activity_date,'category',a.category,
  'subcategory',a.subcategory,'activity_type',a.activity_type,'inclusion_status',a.inclusion_status,
  'exclusion_reason',a.exclusion_reason,'final_scope',a.final_scope,'suggested_scope',a.suggested_scope,
  'source_document_id',a.source_document_id,'source_draft_id',a.source_draft_id,
  'replacement_provenance',cocal_activity_private.provenance(p_org,p_project,a.id)) order by a.id)
  from public.emission_activities a where a.organization_id=p_org and a.project_id=p_project and a.status='active' and cocal_activity_private.is_effective(a.id)),'[]'::jsonb),
 'factors',coalesce((select jsonb_agg(to_jsonb(f)-array['created_at','updated_at','metadata'] order by f.id)
  from public.emission_factors f where f.status='active' and(f.organization_id=p_org or f.organization_id is null)),'[]'::jsonb));
$$;
do $$declare definition text;anchor text:='jsonb_agg(to_jsonb(a) order by a.id)';begin
 definition:=pg_get_functiondef('cocal_recalc_private.trusted_inputs(uuid,uuid)'::regprocedure);
 if length(definition)-length(replace(definition,anchor,''))<>length(anchor) then raise exception 'Unrecognized trusted activity projection';end if;
 execute replace(definition,anchor,'jsonb_agg(cocal_activity_private.projected_activity(a) order by a.id)');
end;$$;

alter function public.activity_version_lineage(uuid,uuid,uuid) rename to activity_version_lineage_v1;
alter function public.activity_version_lineage_v1(uuid,uuid,uuid) set schema cocal_activity_private;
revoke all on function cocal_activity_private.activity_version_lineage_v1(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function public.activity_version_lineage(p_organization_id uuid,p_project_id uuid,p_activity_id uuid) returns table(result jsonb)
language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare answer jsonb;
begin
 select r.result into answer from cocal_activity_private.activity_version_lineage_v1(p_organization_id,p_project_id,p_activity_id) r;
 if answer is null then return;end if;
 return query select answer||jsonb_build_object('replacement_provenance',cocal_activity_private.provenance(p_organization_id,p_project_id,p_activity_id));
end;$$;

create function public.recover_activity_replacement(p_organization_id uuid,p_project_id uuid,p_actor_user_id uuid,p_predecessor_activity_id uuid) returns table(result jsonb)
language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare old_row public.emission_activities;q cocal_activity_private.replacements;status text:='not_found';
begin
 perform cocal_recalc_private.require_scope(p_organization_id,p_project_id,p_actor_user_id);
 select * into old_row from public.emission_activities a where a.id=p_predecessor_activity_id and a.organization_id=p_organization_id and a.project_id=p_project_id for share;
 if not found then raise exception 'ACTIVITY_REPLACEMENT_SCOPE_DENIED' using errcode='42501';end if;
 select * into q from cocal_activity_private.replacements r where r.organization_id=p_organization_id and r.project_id=p_project_id and r.predecessor_activity_id=p_predecessor_activity_id;
 if found then
  if q.actor_user_id=p_actor_user_id then
   return query select cocal_activity_private.response(q,true)||jsonb_build_object('reason',q.reason,'input',q.request_input,'canonical_input',q.canonical_input);return;
  end if;
  status:='superseded';
 elsif old_row.status<>'active' or not cocal_activity_private.is_effective(old_row.id) then status:='superseded';end if;
 -- Knowing a predecessor ID does not disclose another actor's private intent.
 return query select jsonb_build_object('organization_id',p_organization_id,'project_id',p_project_id,'predecessor_activity_id',p_predecessor_activity_id,
  'activity_id',null,'request_id',null,'mode',null,'reason',null,'input',null,'canonical_input',null,'replacement_provenance',null,
  'replayed',false,'operation_status',status,'is_effective',false,'recalculation_required',null);
end;$$;

alter function public.generate_report_snapshot_atomic_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb) rename to publish_source_authority_v2;
alter function public.publish_source_authority_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb) set schema cocal_report_private;
revoke all on function cocal_report_private.publish_source_authority_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb) from public,anon,authenticated,service_role;
create function public.generate_report_snapshot_atomic_v2(p_organization_id uuid,p_project_id uuid,p_generated_by_user_id uuid,p_report_version integer,p_payload jsonb,p_payload_hash text,p_reporting_period_start date,p_reporting_period_end date,p_included_activity_count integer,p_excluded_activity_count integer,p_pending_activity_count integer,p_scope_totals jsonb,p_category_totals jsonb,p_factor_sources jsonb,p_warning_count integer,p_based_on_calculated_at timestamptz,p_request_id text default null,p_snapshot jsonb default null)
returns table(report_generation_id uuid,status public.report_status) language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare inputs jsonb;expected jsonb;actual jsonb;disclosures jsonb;version text:=p_payload->>'replacement_disclosure_version';
begin
 perform cocal_recalc_private.require_scope(p_organization_id,p_project_id,p_generated_by_user_id);
 -- Original historical requests return their original sealed payload. Never
 -- backfill, re-sign or silently enrich an already saved report.
 if not exists(select 1 from cocal_report_private.snapshots s where s.organization_id=p_organization_id and s.project_id=p_project_id and s.request_id=p_request_id) then
  inputs:=cocal_recalc_private.trusted_inputs(p_organization_id,p_project_id);
  select coalesce(jsonb_agg(jsonb_build_object('emission_activity_id',a->'id','replacement_provenance',a->'replacement_provenance') order by a->>'id'),'[]') into disclosures
   from jsonb_array_elements(inputs->'activities') a where a->'replacement_provenance' is distinct from 'null'::jsonb;
  if(version is not null and version<>'20261108.replacement.1') or(disclosures<>'[]'::jsonb and version is distinct from '20261108.replacement.1') then raise exception 'REPORT_REPLACEMENT_DISCLOSURE_VERSION_REQUIRED';end if;
  if jsonb_typeof(p_payload->'appendix_mappings') is distinct from 'array' then raise exception 'REPORT_SOURCE_MAPPING_MISMATCH';end if;
  select coalesce(jsonb_agg(jsonb_build_object('emission_activity_id',a->'id','replacement_provenance',a->'replacement_provenance') order by a->>'id'),'[]') into expected from jsonb_array_elements(inputs->'activities') a;
  select coalesce(jsonb_agg(jsonb_build_object('emission_activity_id',x->'emission_activity_id','replacement_provenance',coalesce(x->'replacement_provenance','null'::jsonb)) order by x->>'emission_activity_id'),'[]') into actual from jsonb_array_elements(p_payload->'appendix_mappings') x;
  if actual is distinct from expected then raise exception 'REPORT_REPLACEMENT_PROVENANCE_MISMATCH';end if;
  if version is not null or p_payload ? 'correction_disclosures' or disclosures<>'[]'::jsonb then
   if jsonb_typeof(p_payload->'correction_disclosures') is distinct from 'array' then raise exception 'REPORT_REPLACEMENT_PROVENANCE_MISMATCH';end if;
   select coalesce(jsonb_agg(x order by x->>'emission_activity_id'),'[]') into actual from jsonb_array_elements(p_payload->'correction_disclosures') x;
   if actual is distinct from disclosures then raise exception 'REPORT_REPLACEMENT_PROVENANCE_MISMATCH';end if;
  end if;
 end if;
 return query select * from cocal_report_private.publish_source_authority_v2(p_organization_id,p_project_id,p_generated_by_user_id,p_report_version,p_payload,p_payload_hash,p_reporting_period_start,p_reporting_period_end,p_included_activity_count,p_excluded_activity_count,p_pending_activity_count,p_scope_totals,p_category_totals,p_factor_sources,p_warning_count,p_based_on_calculated_at,p_request_id,p_snapshot);
end;$$;

revoke all on function cocal_activity_private.provenance(uuid,uuid,uuid),cocal_activity_private.projected_activity(public.emission_activities),cocal_activity_private.require_source(public.emission_activities,text) from public,anon,authenticated,service_role;
revoke all on function public.activity_version_lineage(uuid,uuid,uuid),public.recover_activity_replacement(uuid,uuid,uuid,uuid),public.generate_report_snapshot_atomic_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.activity_version_lineage(uuid,uuid,uuid) to authenticated,service_role;
grant execute on function public.recover_activity_replacement(uuid,uuid,uuid,uuid),public.generate_report_snapshot_atomic_v2(uuid,uuid,uuid,integer,jsonb,text,date,date,integer,integer,integer,jsonb,jsonb,jsonb,integer,timestamptz,text,jsonb) to service_role;
do $$begin if not cocal_delete_private.deployment_ready() then raise exception 'Unapproved deletion source drift after replacement provenance change';end if;end;$$;
commit;
