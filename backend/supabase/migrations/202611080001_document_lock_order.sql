-- SOURCE CANDIDATE ONLY. Native PG reproduced the delete/MANUAL lock inversion.
-- Acquire the existing project lock before document/receipt locks. No cloud apply.
begin;

do $$begin
 if not cocal_delete_private.deployment_ready() then
  raise exception 'Existing deletion source drift; do not rebaseline unknown source';
 end if;
end;$$;

do $$declare change record;definition text;begin
 for change in select * from(values
  ('public.document_deletion_request(uuid,jsonb,text)',
   'perform cocal_attachment_private.assert_write(org,project,p_actor_user_id);',
   'perform 1 from public.projects p where p.id=project and p.organization_id=org for no key update;'),
  ('public.finalize_document_deletion(uuid,jsonb)',
   'perform cocal_attachment_private.assert_write((p_input->>''organization_id'')::uuid,(p_input->>''project_id'')::uuid,p_actor_user_id);',
   'perform 1 from public.projects p where p.id=(p_input->>''project_id'')::uuid and p.organization_id=(p_input->>''organization_id'')::uuid for no key update;'),
  ('public.release_document_processing(uuid,uuid)',
   'if lease.actor_user_id is distinct from p_actor_user_id then raise exception ''DOCUMENT_PROCESSING_LEASE_DENIED'' using errcode=''42501'';end if;',
   'perform 1 from public.projects p where p.id=lease.project_id and p.organization_id=lease.organization_id for no key update;')
 ) as changes(signature,anchor,project_lock) loop
  definition:=pg_get_functiondef(change.signature::regprocedure);
  if length(definition)-length(replace(definition,change.anchor,''))<>length(change.anchor) then
   raise exception 'Unrecognized approved document-lock definition: %',change.signature;
  end if;
  -- Preserve actor/scope checks, return values, archival and retry semantics.
  -- Lease cleanup deliberately retains its original actor check: revoking a
  -- membership must not prevent its captured service actor from releasing work.
  execute replace(definition,change.anchor,change.anchor||E'\n '||change.project_lock);
 end loop;
end;$$;

-- The entry assertion proved the whole old catalog. Refresh only the three
-- explicitly patched function bodies; retain every other fingerprint and ACL.
do $$declare changed integer;begin
 update cocal_delete_private.source_baseline b set fingerprint=c.fingerprint
 from cocal_delete_private.catalog_state() c
 where b.kind=c.kind and b.object_key=c.object_key and b.kind='function'
 and b.object_key in('public.document_deletion_request(uuid,jsonb,text)',
  'public.finalize_document_deletion(uuid,jsonb)',
  'public.release_document_processing(uuid,uuid)');
 get diagnostics changed=row_count;
 if changed<>3 then raise exception 'Approved document-lock baseline count mismatch';end if;
 if not cocal_delete_private.deployment_ready() then
  raise exception 'Deletion source drift after approved document-lock change';
 end if;
end;$$;

commit;
