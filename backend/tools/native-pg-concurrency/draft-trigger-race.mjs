// Named N4-R1 schedules only; synthetic SQL catalogs, never hosted services.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const pending=p=>p.then(value=>({value}),error=>({error}));

export async function runDraftTriggerRace(c,{fixed=false}={}){
 const {qA,qB,qO,begin,finish,as,waitLock,pidA,pidB,pidO,fixture,report,save,pause}=c;
 const doc=async s=>{
  const documentId=randomUUID(),bucket='staging-receipts',path=`staging/${s.project}/${documentId}.pdf`,bytes=Buffer.from('%PDF-1.4\nSYNTHETIC N4-R1 ONLY');
  await qO('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',[bucket,path,s.user,{size:bytes.length,mimetype:'application/pdf'}]);
  await qO("insert into uploaded_documents(id,organization_id,project_id,uploaded_by_user_id,storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,sha256_hash,document_type,ocr_status,status,env,is_test) values($1,$2,$3,$4,$5,$6,'SYNTHETIC-N4-R1.pdf','application/pdf',$7,$8,'receipt','pending','active','staging',true)",[documentId,s.org,s.project,s.user,bucket,path,bytes.length,'c'.repeat(64)]);
  return {organization_id:s.org,project_id:s.project,document_id:documentId,request_id:randomUUID(),storage_bucket:bucket,storage_path:path};
 };
 const insert="insert into extracted_document_drafts(id,organization_id,project_id,uploaded_document_id,extraction_provider,raw_payload,normalized_payload,status,is_latest,env,is_test) values($1,$2,$3,$4,'SYNTHETIC_NATIVE_OCR_FIXTURE','{}',$5,'pending_review',true,'staging',true) returning id";
 const args=(s,d,id)=>[id,s.org,s.project,d.document_id,{quantity:100,unit:'kWh',activity_date:'2026-01-15'}];
 const del="select * from document_deletion_request($1,$2,'prepare')";
 const counts=async(s,d)=>(await qO("select (select count(*) from extracted_document_drafts where uploaded_document_id=$1) drafts,(select count(*) from cocal_delete_private.operations where document_id=$1) operations,(select count(*) from emission_activities where project_id=$2) activities,(select count(*) from calculation_results where project_id=$2) calculations,(select count(*) from audit_logs where project_id=$2 and action='document_delete_prepared') delete_audits,(select deletion_state from uploaded_documents where id=$1) deletion_state",[d.document_id,s.project])).rows[0];
 const s=await fixture(),d=await doc(s),draftId=randomUUID(),barrier=2026110803,before=await counts(s,d);
 const triggerSql=`create function public.n4_r1_draft_barrier() returns trigger language plpgsql as $$begin if new.id='${draftId}'::uuid then perform pg_advisory_xact_lock(${barrier});end if;return new;end$$;create trigger n4_r1_between_draft_triggers before insert or update on public.extracted_document_drafts for each row execute function public.n4_r1_draft_barrier()`;
 await qO(triggerSql);
 const order=(await qO("select tgname from pg_trigger where tgrelid='public.extracted_document_drafts'::regclass and not tgisinternal and (tgtype&2)=2 order by tgname")).rows.map(x=>x.tgname);
 assert.ok(order.indexOf('deletion_draft_reference')<order.indexOf('n4_r1_between_draft_triggers'));
 assert.ok(order.indexOf('n4_r1_between_draft_triggers')<order.indexOf('protect_manual_draft'));
 if(fixed)assert.ok(order.indexOf('a_draft_project_lock')>=0&&order.indexOf('a_draft_project_lock')<order.indexOf('deletion_draft_reference'));
 await qO('begin');await qO('select pg_advisory_xact_lock($1)',[barrier]);
 await begin(qA,'authenticated',s.user);const writing=pending(qA(insert,args(s,d,draftId))).then(x=>({...x,label:'ordinary_draft',q:qA,pid:pidA}));
 await waitLock(pidA,pidO,'R1_SYNTHETIC_barrier_between_deletion_and_manual_triggers');
 await begin(qB,'service_role',s.user);const deleting=pending(qB(del,[s.user,d])).then(x=>({...x,label:'delete_prepare',q:qB,pid:pidB}));
 const blocked=await waitLock(pidB,pidA,fixed?'R1_fixed_delete_waits_for_early_project_lock':'R1_baseline_delete_waits_for_ordinary_document_fence');
 if(fixed)assert.equal(blocked.wait_event,'transactionid');else assert.equal(blocked.wait_event,'advisory');
 await qO('commit');const released=new Date().toISOString();
 if(!fixed){
  let cycle;const until=Date.now()+1500;
  while(Date.now()<until){await qO('select pg_stat_clear_snapshot()');const rows=(await qO('select pid,state,wait_event_type,wait_event,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=any($1::int[])',[[pidA,pidB]])).rows;
   if(rows.length===2&&rows.every(row=>row.state==='active'&&row.wait_event_type==='Lock')&&rows.find(row=>row.pid===pidA).blockers.includes(pidB)&&rows.find(row=>row.pid===pidB).blockers.includes(pidA)){
    cycle={released,observed:new Date().toISOString(),rows,observerNotInCycle:rows.every(row=>!row.blockers.includes(pidO))};assert.equal(cycle.observerNotInCycle,true);break;
   }await pause(25);
  }
  const first=await Promise.race([writing,deleting]);await finish(first.q,!first.error);const second=await(first.label==='ordinary_draft'?deleting:writing);await finish(second.q,!second.error);
  const outcomes=[first,second],victim=outcomes.find(x=>x.error?.code==='40P01'),winner=outcomes.find(x=>!x.error);assert.ok(cycle,'Natural actor-only trigger cycle was not observed');assert.ok(victim,'No actual40P01 victim');assert.ok(winner);
  const state=await counts(s,d);assert.equal(state.activities,before.activities);assert.equal(state.calculations,before.calculations);assert.equal(Number(state.drafts),winner.label==='ordinary_draft'?1:0);assert.equal(Number(state.operations),winner.label==='delete_prepare'?1:0);assert.equal(Number(state.delete_audits),winner.label==='delete_prepare'?1:0);
  report.findings??=[];report.findings.push({id:'N4-R1',status:'OPEN_REPRODUCED_40P01',source:report.source,cycle,victim:{label:victim.label,pid:victim.pid,code:victim.error.code,message:victim.error.message,where:victim.error.where,detail:victim.error.detail},winner:winner.label,triggerOrder:order,syntheticBarrier:{triggerSql,released,observerPid:pidO},state});
  report.cases.push({name:'N4_R1_between_ordinary_draft_triggers',status:'REPRODUCED_OPEN_FINDING',errorCode:'40P01',originalDraftId:draftId,originalDeleteRequestId:d.request_id});save();return;
 }
 const written=await writing;if(written.error){await finish(qA,false);throw written.error;}assert.equal(written.value.rows[0].id,draftId);await finish(qA);
 const denied=await deleting;assert.ok(denied.error);assert.notEqual(denied.error.code,'40P01');assert.match(denied.error.message,/DOCUMENT_HAS_REFERENCES/);await finish(qB,false);
 const repeated=await as(qB,'service_role',s.user,()=>qB(del,[s.user,d])).then(()=>null,e=>e);assert.match(repeated?.message??'',/DOCUMENT_HAS_REFERENCES/);
 assert.equal((await as(qA,'authenticated',s.user,()=>qA('select id from extracted_document_drafts where id=$1',[draftId]))).rows[0].id,draftId);
 const state=await counts(s,d);assert.equal(Number(state.drafts),1);assert.equal(Number(state.operations),0);assert.equal(Number(state.delete_audits),0);assert.equal(state.activities,before.activities);assert.equal(state.calculations,before.calculations);
 report.cases.push({name:'N4_R1_early_project_lock_serializes_between_trigger_schedule',status:'PASS',triggerOrder:order,blocked,released,originalDraftId:draftId,originalDeleteRequestId:d.request_id,state});save();

 // A rolled-back ordinary insert must release the fence without losing B's ID.
 const s2=await fixture(),d2=await doc(s2),draft2=randomUUID();await begin(qA,'authenticated',s2.user);await qA(insert,args(s2,d2,draft2));
 await begin(qB,'service_role',s2.user);const waiting=pending(qB(del,[s2.user,d2]));await waitLock(pidB,pidA,'R1_rollback_insert_releases_project_to_original_delete_request');await finish(qA,false);
 const completed=await waiting;if(completed.error){await finish(qB,false);throw completed.error;}await finish(qB);
 assert.equal(completed.value.rows[0].operation.request_id,d2.request_id);
 const replay=(await as(qB,'service_role',s2.user,()=>qB(del,[s2.user,d2]))).rows[0].operation;assert.equal(replay.request_id,d2.request_id);assert.equal(replay.replayed,true);
 const refused=await as(qA,'authenticated',s2.user,()=>qA(insert,args(s2,d2,draft2))).then(()=>null,e=>e);assert.equal(refused?.code,'42501');assert.match(refused.message,/DOCUMENT_DELETION_FENCED/);
 const rollbackState=await counts(s2,d2);assert.equal(Number(rollbackState.drafts),0);assert.equal(Number(rollbackState.operations),1);assert.equal(Number(rollbackState.delete_audits),1);
 report.cases.push({name:'N4_R1_rollback_and_original_UUID_recovery_preserve_fence',status:'PASS',originalDraftId:draft2,originalDeleteRequestId:d2.request_id,rollbackState});save();

 // Fresh role/scope checks remain at the first project lock; no write survives.
 const s3=await fixture(),d3=await doc(s3),initial=await counts(s3,d3),foreign=await fixture();
 const rejects=[];
 for(const actor of [foreign.user]){const error=await as(qA,'authenticated',actor,()=>qA(insert,args(s3,d3,randomUUID()))).then(()=>null,e=>e);assert.equal(error?.code,'42501');rejects.push({case:'foreign_actor',code:error.code});}
 await qO("update organization_members set role='viewer' where user_id=$1 and organization_id=$2",[s3.user,s3.org]);
 let error=await as(qA,'authenticated',s3.user,()=>qA(insert,args(s3,d3,randomUUID()))).then(()=>null,e=>e);assert.equal(error?.code,'42501');rejects.push({case:'viewer',code:error.code});
 await qO("update organization_members set role='editor' where user_id=$1 and organization_id=$2",[s3.user,s3.org]);await qO("update subscriptions set status='readonly' where organization_id=$1",[s3.org]);
 error=await as(qA,'authenticated',s3.user,()=>qA(insert,args(s3,d3,randomUUID()))).then(()=>null,e=>e);assert.equal(error?.code,'42501');rejects.push({case:'readonly_subscription',code:error.code});assert.deepEqual(await counts(s3,d3),initial);
 report.cases.push({name:'N4_R1_ordinary_scope_role_subscription_rejections_keep_rows_unchanged',status:'PASS',rejects});save();

 // UPDATE uses the same early trigger without permitting tenant/project moves.
 const updateBefore=(await qO('select to_jsonb(d) row from extracted_document_drafts d where id=$1',[draftId])).rows[0].row;
 await as(qA,'authenticated',s.user,()=>qA('update extracted_document_drafts set normalized_payload=$2 where id=$1',[draftId,{quantity:101,unit:'kWh',activity_date:'2026-01-15'}]));
 const updated=(await qO('select to_jsonb(d) row from extracted_document_drafts d where id=$1',[draftId])).rows[0].row;assert.equal(updated.normalized_payload.quantity,101);assert.equal(updated.id,updateBefore.id);
 const moved=await as(qA,'authenticated',s.user,()=>qA('update extracted_document_drafts set organization_id=$2,project_id=$3 where id=$1',[draftId,foreign.org,foreign.project])).then(()=>null,e=>e);assert.equal(moved?.code,'42501');assert.match(moved.message,/DRAFT_DOCUMENT_SCOPE_DENIED/);
 assert.deepEqual((await qO('select to_jsonb(d) row from extracted_document_drafts d where id=$1',[draftId])).rows[0].row,updated);
 report.cases.push({name:'N4_R1_legitimate_pending_update_and_scope_rebind_denial',status:'PASS',originalDraftId:draftId,updatedQuantity:101,rebindError:moved.message,updateInterTriggerConcurrency:'NOT_RUN; INSERT named schedule above exercises the shared trigger order'});save();
}
