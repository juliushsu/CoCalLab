// Explicit synthetic fixtures and native socket interleavings. No cloud services.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const id=()=>crypto.randomUUID();
const pending=p=>p.then(value=>({value}),error=>({error}));
export async function runBoundaries(c){
 const {qA,qB,qO,begin,finish,as,waitLock,pidA,pidB,pidO,fixture,prepare,commitArgs,commitSql,report,save,pause,candidate}=c;
 const deletionSql="select * from document_deletion_request($1,$2,'prepare')";
 const document=async(s,verified=false)=>{
  const doc=id(),bucket='staging-receipts',objectPath=`staging/${s.project}/${doc}.pdf`,bytes=Buffer.from('SYNTHETIC NATIVE SQL catalog fixture '+doc),sha=crypto.createHash('sha256').update(bytes).digest('hex');
  await qO('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',[bucket,objectPath,s.user,{size:bytes.length,mimetype:'application/pdf'}]);
  const intent={organization_id:s.org,project_id:s.project,document_id:doc,request_id:doc,storage_bucket:bucket,storage_path:objectPath,original_filename:'SYNTHETIC-NATIVE.pdf',document_type:'receipt',file_size_bytes:bytes.length,mime_type:'application/pdf'};
  if(verified){
   // This trusted lab adapter hashes explicit synthetic bytes, then calls the
   // real SQL verification contract. It is NOT a Storage HTTP acceptance test.
   await as(qO,'service_role',s.user,()=>qO('select * from begin_upload_verification($1,$2)',[s.user,intent]));
   await as(qO,'service_role',s.user,()=>qO('select * from complete_upload_verification($1,$2,$3,$4,$5,$6)',[s.user,doc,doc,sha,bytes.length,'application/pdf']));
  }else await qO("insert into uploaded_documents(id,organization_id,project_id,uploaded_by_user_id,storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,sha256_hash,document_type,ocr_status,status,env,is_test) values($1,$2,$3,$4,$5,$6,'SYNTHETIC-NATIVE.pdf','application/pdf',$7,$8,'receipt','pending','active','staging',true)",[doc,s.org,s.project,s.user,bucket,objectPath,bytes.length,sha]);
  return {...intent,request_id:id()};
 };
 const draftSql="insert into extracted_document_drafts(id,organization_id,project_id,uploaded_document_id,extraction_provider,raw_payload,normalized_payload,status,is_latest,env,is_test) values($1,$2,$3,$4,'SYNTHETIC_NATIVE_OCR_FIXTURE','{}',$5,'pending_review',true,'staging',true) returning *";
 const draftArgs=(s,d,draft=id())=>[draft,s.org,s.project,d.document_id,{quantity:100,unit:'kWh',activity_date:'2026-01-15'}];
 // Both orders use actual RPC/trigger locks, with no injected locks.
 for(const deletionFirst of [true,false]){
  const s=await fixture(),d=await document(s),args=draftArgs(s,d);
  await begin(qA,deletionFirst?'service_role':'authenticated',s.user);
  await qA(deletionFirst?deletionSql:draftSql,deletionFirst?[s.user,d]:args);
  await begin(qB,deletionFirst?'authenticated':'service_role',s.user);
  const work=pending(qB(deletionFirst?draftSql:deletionSql,deletionFirst?args:[s.user,d]));
  await waitLock(pidB,pidA,deletionFirst?'draft_reference_waits_for_delete_prepare':'delete_prepare_waits_for_new_reference');
  await finish(qA);const result=await work;assert.ok(result.error);assert.match(result.error.message,deletionFirst?/DOCUMENT_DELETION_FENCED/:/DOCUMENT_HAS_REFERENCES/);await finish(qB,false);
  const state=(await qO('select deletion_state,(select count(*) from extracted_document_drafts where uploaded_document_id=$1) drafts,(select count(*) from cocal_delete_private.operations where document_id=$1) operations from uploaded_documents where id=$1',[d.document_id])).rows[0];
  assert.equal(state.deletion_state,deletionFirst?'pending':'active');assert.equal(Number(state.drafts),deletionFirst?0:1);assert.equal(Number(state.operations),deletionFirst?1:0);
  report.cases.push({name:deletionFirst?'delete_prepare_fences_concurrent_reference':'reference_fences_concurrent_delete_prepare',status:'PASS',errorCode:result.error.code,error:result.error.message,state,notes:'Actual RPC/trigger locks; outer transaction held until observer saw the second backend waiting. No Storage bytes deleted.'});save();
 }
 // N1: same semantic confirmation request must return original activity/calculation.
 {
  const s=await fixture(),d=await document(s),args=draftArgs(s,d),draft=(await qO(draftSql,args)).rows[0];
  const witness=(await qO("select to_jsonb(d)-array['created_at','updated_at','reviewed_at','classified_at'] source from extracted_document_drafts d where id=$1",[draft.id])).rows[0].source;
  const request=id(),intent={decision:'confirmed',overrides:{activity_name:'SYNTHETIC NATIVE reviewed',activity_type:'electricity',category:'energy',final_scope:2,inclusion_status:'included'}};
  const activity={...s.input,activity_name:'SYNTHETIC NATIVE reviewed',source_document_id:d.document_id,source_draft_id:draft.id,normalized_quantity:100,normalized_unit:'kWh'};
  // Explicitly pending factor: SQL concurrency evidence does not certify a provider.
  const calc={status:'pending_factor',co2e_kg:null,warnings:['SYNTHETIC NATIVE SQL pending factor'],input_snapshot:{synthetic:true},factor_snapshot:{},formula_version:'v1.0.0'};
  const sql='select * from commit_draft_confirmation($1,$2,$3,$4,$5,$6,$7,$8,$9)',params=[s.org,s.project,draft.id,s.user,request,intent,activity,calc,witness];
  await begin(qA,'service_role',s.user);const first=(await qA(sql,params)).rows[0].result;
  await begin(qB,'service_role',s.user);const work=pending(qB(sql,params));await waitLock(pidB,pidA,'same_confirmation_request_waits_for_first_commit');await finish(qA);const second=await work;if(second.error){await finish(qB,false);throw second.error;}await finish(qB);
  assert.equal(second.value.rows[0].result.replayed,true);assert.equal(second.value.rows[0].result.emission_activity_id,first.emission_activity_id);assert.equal(second.value.rows[0].result.calculation_result_id,first.calculation_result_id);
  const counts=(await qO("select (select count(*) from emission_activities where source_draft_id=$1) activities,(select count(*) from calculation_results where emission_activity_id=$2) calculations,(select count(*) from audit_logs where entity_id=$1 and action='confirm_draft_atomic') audits,(select count(*) from cocal_manual_private.confirmation_requests where draft_id=$1) requests",[draft.id,first.emission_activity_id])).rows[0];
  for(const count of Object.values(counts))assert.equal(Number(count),1);
  report.cases.push({name:'N1_same_request_confirmation_one_original_result',status:'PASS',counts,emissionActivityId:first.emission_activity_id,calculationResultId:first.calculation_result_id});save();
 }
 // N3: competing intents on one predecessor serialize to one successor, while
 // the retired predecessor and its calculation stay byte-for-byte JSON equal.
 {
  const s=await fixture(),initialRequest=id(),prepared=await prepare(s,initialRequest),initial=(await as(qA,'service_role',s.user,()=>qA(commitSql,commitArgs(s,initialRequest,prepared)))).rows[0].result;
  const before=(await qO('select to_jsonb(a) activity,(select to_jsonb(c) from calculation_results c where id=$2) calculation from emission_activities a where id=$1',[s.activity,initial.calculation_result_ids[0]])).rows[0];
  const sql='select * from replace_emission_activity($1,$2,$3,$4,$5,$6,$7,$8,$9)',request=id(),params=[s.org,s.project,s.user,s.activity,request,'correct','SYNTHETIC NATIVE correction',{...s.input,quantity:120},'replace'];
  await begin(qA,'service_role',s.user);const first=(await qA(sql,params)).rows[0].result;
  await begin(qB,'service_role',s.user);const work=pending(qB(sql,[...params.slice(0,4),id(),'correct','SYNTHETIC competing correction',{...s.input,quantity:130},'replace']));await waitLock(pidB,pidA,'N3_competing_successor_waits_for_first_replacement');await finish(qA);const refused=await work;assert.ok(refused.error);assert.match(refused.error.message,/ACTIVITY_REPLACEMENT_SUPERSEDED/);await finish(qB,false);
  const replay=(await as(qO,'service_role',s.user,()=>qO(sql,params))).rows[0].result;assert.equal(replay.activity_id,first.activity_id);assert.equal(replay.replayed,true);
  const freshRequest=id(),fresh=await prepare(s,freshRequest);await as(qA,'service_role',s.user,()=>qA(commitSql,commitArgs(s,freshRequest,fresh)));
  const after=(await qO('select to_jsonb(a) activity,(select to_jsonb(c) from calculation_results c where id=$2) calculation from emission_activities a where id=$1',[s.activity,initial.calculation_result_ids[0]])).rows[0];assert.deepEqual(after,before);
  const counts=(await qO('select (select count(*) from cocal_activity_private.replacements where project_id=$1) replacements,(select count(*) from effective_emission_activities where project_id=$1) effective,(select co2e_kg from effective_calculation_results where project_id=$1 and is_latest) co2e_kg',[s.project])).rows[0];assert.equal(Number(counts.replacements),1);assert.equal(Number(counts.effective),1);assert.equal(Number(counts.co2e_kg),60);
  report.cases.push({name:'N3_competing_replacements_one_leaf_preserve_retired_calculation',status:'PASS',errorCode:refused.error.code,error:refused.error.message,counts,replayedActivityId:replay.activity_id,retiredRowsUnchanged:true});save();
 }
 // Reproduce N4 without inventing the conflicting project/document locks.
 // The barrier merely pauses deletion before its late project lock; it is
 // released before observing the cycle and is explicitly labelled synthetic.
 {
  const s=await fixture(),d=await document(s,true),draft=id(),request=id(),barrier=2026110801;
  const triggerSql=`create function public.native_race_barrier() returns trigger language plpgsql as $$begin if new.id='${d.document_id}'::uuid and old.deletion_state='active' and new.deletion_state='pending' then perform pg_advisory_xact_lock(${barrier});end if;return new;end$$;create trigger native_race_barrier before update on public.uploaded_documents for each row execute function public.native_race_barrier()`;
  await qO(triggerSql);await qO('begin');await qO('select pg_advisory_xact_lock($1)',[barrier]);
  await begin(qA,'service_role',s.user);const deleting=pending(qA(deletionSql,[s.user,d])).then(x=>({...x,label:'delete',pid:pidA,q:qA}));
  await waitLock(pidA,pidO,'N4_SYNTHETIC_barrier_pauses_delete_before_late_project_lock');
  const transcription={...s.input,subcategory:null,review_note:'SYNTHETIC NATIVE manual entry',exclusion_reason:null,period_start:null,period_end:null,source_locator:'SYNTHETIC page 1',source_text:null};
  const manualSql='select * from create_manual_transcription_atomic($1,$2,$3,$4,$5,$6,$7)',manualArgs=[s.org,s.project,d.document_id,draft,s.user,request,transcription];
  await begin(qB,'service_role',s.user);const creating=pending(qB(manualSql,manualArgs)).then(x=>({...x,label:'manual_create',pid:pidB,q:qB}));
  const blocked=await waitLock(pidB,pidA,candidate?'N4_fixed_manual_create_waits_for_early_project_lock':'N4_manual_create_natural_document_lock_waits_for_delete');
  if(candidate){
   assert.notEqual(blocked.wait_event,'advisory','The fixed caller must wait on the early project row lock, before the document advisory');
   await qO('commit');const barrierReleased=new Date().toISOString();
   const deleted=await deleting;if(deleted.error){await finish(qA,false);throw deleted.error;}await finish(qA);
   const manual=await creating;assert.ok(manual.error);assert.notEqual(manual.error.code,'40P01');assert.match(manual.error.message,/DOCUMENT_DELETION_FENCED/);await finish(qB,false);
   const state=(await qO("select deletion_state,(select count(*) from extracted_document_drafts where uploaded_document_id=$1) drafts,(select count(*) from cocal_delete_private.operations where document_id=$1) operations,(select count(*) from audit_logs where project_id=$2 and action='create_manual_transcription_atomic') manual_audits,(select count(*) from audit_logs where project_id=$2 and action='document_delete_prepared') delete_audits from uploaded_documents where id=$1",[d.document_id,s.project])).rows[0];
   assert.equal(state.deletion_state,'pending');assert.equal(Number(state.drafts),0);assert.equal(Number(state.operations),1);assert.equal(Number(state.manual_audits),0);assert.equal(Number(state.delete_audits),1);
   report.cases.push({name:'N4_fixed_early_project_lock_serializes_delete_manual_create',status:'PASS',syntheticBarrier:{triggerSql,observerPid:pidO,released:barrierReleased},naturalBlocking:blocked,errorCode:manual.error.code,error:manual.error.message,state,noDeadlockInThisNamedSchedule:true});save();
  }else{
  await qO('commit');const barrierReleased=new Date().toISOString();let cycle;
  const deadline=Date.now()+1500;while(Date.now()<deadline){const rows=(await qO('select pid,wait_event_type,wait_event,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=any($1::int[])',[[pidA,pidB]])).rows;const ar=rows.find(x=>x.pid===pidA),br=rows.find(x=>x.pid===pidB);if(ar?.wait_event_type==='Lock'&&br?.wait_event_type==='Lock'&&ar.blockers.includes(pidB)&&br.blockers.includes(pidA)){cycle={observed:new Date().toISOString(),barrierReleased,rows,barrierObserverNotInCycle:!rows.some(x=>x.blockers.includes(pidO))};assert.equal(cycle.barrierObserverNotInCycle,true);break;}await pause(30);}
  // Settle the victim first, rollback it promptly, then allow winner to finish.
  const first=await Promise.race([deleting,creating]);await finish(first.q,!first.error);const second=await(first.label==='delete'?creating:deleting);await finish(second.q,!second.error);
  const outcomes=[first,second],victim=outcomes.find(x=>x.error?.code==='40P01');assert.ok(cycle,'Natural A/B lock cycle was not observed after the synthetic barrier was released');assert.ok(victim,'Expected real PostgreSQL deadlock detection, not an injected error');assert.equal(outcomes.filter(x=>!x.error).length,1);
  const winner=outcomes.find(x=>!x.error),retryError=await as(qO,'service_role',s.user,()=>qO(victim.label==='delete'?deletionSql:manualSql,victim.label==='delete'?[s.user,d]:manualArgs)).then(()=>null,e=>e);assert.ok(retryError);assert.match(retryError.message,victim.label==='delete'?/DOCUMENT_HAS_REFERENCES/:/DOCUMENT_DELETION_FENCED/);
  const state=(await qO('select deletion_state,(select count(*) from extracted_document_drafts where uploaded_document_id=$1) drafts,(select count(*) from cocal_delete_private.operations where document_id=$1) operations,(select count(*) from audit_logs where project_id=$2 and action=\'create_manual_transcription_atomic\') manual_audits,(select count(*) from audit_logs where project_id=$2 and action=\'document_delete_prepared\') delete_audits from uploaded_documents where id=$1',[d.document_id,s.project])).rows[0];
  assert.equal(state.deletion_state,winner.label==='delete'?'pending':'active');assert.equal(Number(state.drafts),winner.label==='delete'?0:1);assert.equal(Number(state.operations),winner.label==='delete'?1:0);assert.equal(Number(state.manual_audits),winner.label==='manual_create'?1:0);assert.equal(Number(state.delete_audits),winner.label==='delete'?1:0);
  report.findings??=[];report.findings.push({id:'N4',status:'OPEN_REPRODUCED_40P01',source:report.source,entrypoints:['document_deletion_request:prepare','create_manual_transcription_atomic'],victim:{label:victim.label,pid:victim.pid,code:victim.error.code,message:victim.error.message,detail:victim.error.detail,where:victim.error.where},winner:winner.label,syntheticBarrier:{triggerSql,observerPid:pidO,released:barrierReleased,purpose:'Only delays delete before its existing late project lock. Observer barrier is absent from the observed natural cycle.'},cycle,retry:{code:retryError.code,message:retryError.message},state});
  report.cases.push({name:'N4_native_delete_manual_create_lock_inversion',status:'REPRODUCED_OPEN_FINDING',victimPid:victim.pid,errorCode:'40P01',rollbackAndRetryStateVerified:true});save();
  }
 }
 if(candidate){
  // Changed cleanup/finalize entrypoints: keep actor-only ended-work cleanup
  // after revocation, while ordinary roles and foreign actors remain rejected.
  const s=await fixture(),d=await document(s,true),lease=id();
  const leaseArgs=[s.user,s.org,s.project,d.document_id,lease,'SYNTHETIC-NATIVE-PROCESSING'];
  await as(qO,'service_role',s.user,()=>qO('select * from begin_document_processing($1,$2,$3,$4,$5,$6)',leaseArgs));
  for(const [sql,args] of [[deletionSql,[s.user,d]],['select * from finalize_document_deletion($1,$2)',[s.user,d]],['select * from release_document_processing($1,$2)',[s.user,lease]]]){
   const error=await as(qO,'authenticated',s.user,()=>qO(sql,args)).then(()=>null,e=>e);assert.equal(error?.code,'42501');
  }
  await qO("update organization_members set status='inactive' where organization_id=$1 and user_id=$2",[s.org,s.user]);
  const wrong=await as(qO,'service_role',s.user,()=>qO('select * from release_document_processing($1,$2)',[id(),lease])).then(()=>null,e=>e);assert.equal(wrong?.code,'42501');
  await as(qO,'service_role',s.user,()=>qO('select * from release_document_processing($1,$2)',[s.user,lease]));
  const restored=(await qO('select ocr_status from uploaded_documents where id=$1',[d.document_id])).rows[0];assert.equal(restored.ocr_status,'pending');
  await qO("update organization_members set status='active' where organization_id=$1 and user_id=$2",[s.org,s.user]);
  await as(qO,'service_role',s.user,()=>qO(deletionSql,[s.user,d]));
  await as(qO,'service_role',s.user,()=>qO('delete from storage.objects where bucket_id=$1 and name=$2',[d.storage_bucket,d.storage_path]));
  await begin(qA,'service_role',s.user);const finalized=(await qA('select * from finalize_document_deletion($1,$2)',[s.user,d])).rows[0].operation;
  await begin(qB,'service_role',s.user);const manualArgs=[s.org,s.project,d.document_id,id(),s.user,id(),{...s.input,subcategory:null,review_note:null,exclusion_reason:null,period_start:null,period_end:null,source_locator:'SYNTHETIC page 1',source_text:null}];
  const work=pending(qB('select * from create_manual_transcription_atomic($1,$2,$3,$4,$5,$6,$7)',manualArgs));await waitLock(pidB,pidA,'fixed_finalize_early_project_lock_fences_manual_create');await finish(qA);const denied=await work;assert.ok(denied.error);assert.notEqual(denied.error.code,'40P01');assert.match(denied.error.message,/DOCUMENT_DELETION_FENCED/);await finish(qB,false);
  const replay=(await as(qO,'service_role',s.user,()=>qO('select * from finalize_document_deletion($1,$2)',[s.user,d]))).rows[0].operation;assert.equal(finalized.operation_status,'deleted');assert.equal(replay.replayed,true);
  const state=(await qO("select status,deletion_state,(select count(*) from audit_logs where project_id=$2 and action like 'document_delete_%') deletion_audits,(select count(*) from extracted_document_drafts where uploaded_document_id=$1) drafts from uploaded_documents where id=$1",[d.document_id,s.project])).rows[0];assert.equal(state.status,'archived');assert.equal(state.deletion_state,'deleted');assert.equal(Number(state.deletion_audits),2);assert.equal(Number(state.drafts),0);
  report.cases.push({name:'fixed_finalize_replay_and_revoked_actor_lease_cleanup_keep_authorization',status:'PASS',ordinaryRoleDeniedEntryPoints:3,wrongActorDenied:true,revokedOriginalActorCleanup:true,restoredOcrStatus:restored.ocr_status,state,notes:'SQL catalog object deletion only; no Storage HTTP bytes. Finalize/MANUAL schedule has independent backend lock observation.'});save();
 }
}
