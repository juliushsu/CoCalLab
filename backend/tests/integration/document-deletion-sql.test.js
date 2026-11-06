// Synthetic catalog/roles only; independent SQL connection concurrency NOT_RUN.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createLocalWorkflow} from '../../tools/local-workflow/engine.js';
async function setup(){
 const f=await createLocalWorkflow(),{db,scope}=f;
 async function role(name,fn){await db.exec('begin');try{await db.exec('set local role '+name);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[scope.userId]);const out=await fn();await db.exec('commit');return out;}catch(e){await db.exec('rollback');throw e;}}
 async function fixture({receipt=true,missing=false}={}){const id=randomUUID(),bucket='staging-receipts',path=`staging/${scope.projectId}/${id}.pdf`;let object;
  if(!missing)object=(await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4) returning *',[bucket,path,scope.userId,{size:30,mimetype:'application/pdf'}])).rows[0];
  if(receipt)await db.query(`insert into uploaded_documents(id,organization_id,project_id,uploaded_by_user_id,storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,sha256_hash,document_type,ocr_status,status,env,is_test) values($1,$2,$3,$4,$5,$6,'SYNTHETIC.pdf','application/pdf',30,$7,'receipt','pending','active','staging',true)`,[id,scope.organizationId,scope.projectId,scope.userId,bucket,path,'a'.repeat(64)]);
  return {organization_id:scope.organizationId,project_id:scope.projectId,document_id:id,request_id:randomUUID(),storage_bucket:bucket,storage_path:path,object};
 }
 const clean=v=>Object.fromEntries(Object.entries(v).filter(([k])=>k!=='object'));
 const operation=(v,action='prepare',actor=scope.userId,as='service_role')=>role(as,async()=>((await db.query('select * from document_deletion_request($1,$2,$3)',[actor,clean(v),action])).rows[0].operation));
 const finalize=(v,actor=scope.userId,as='service_role')=>role(as,async()=>((await db.query('select * from finalize_document_deletion($1,$2)',[actor,clean(v)])).rows[0].operation));
 const remove=v=>role('service_role',()=>db.query('delete from storage.objects where bucket_id=$1 and name=$2 returning id',[v.storage_bucket,v.storage_path]));
 const draft=v=>db.query(`insert into extracted_document_drafts(organization_id,project_id,uploaded_document_id,extraction_provider) values($1,$2,$3,'SYNTHETIC-REVIEW-FIXTURE') returning *`,[v.organization_id,v.project_id,v.document_id]);
 const activity=(v,extra={})=>{const row={organization_id:v.organization_id,project_id:v.project_id,activity_code:'SYNTHETIC-'+randomUUID(),activity_name:'SYNTHETIC',activity_date:'2026-01-15',category:'energy',activity_type:'electricity',quantity:1,unit:'kWh',inclusion_status:'included',source_document_id:v.document_id,...extra};const keys=Object.keys(row);return db.query('insert into emission_activities('+keys.join(',')+') values('+keys.map((_,i)=>'$'+(i+1)).join(',')+') returning *',Object.values(row));};
 return {...f,role,fixture,clean,operation,finalize,remove,draft,activity};
}
test('ordinary direct Storage and receipt hard deletion cannot bypass controlled workflow, even for legacy unverified originals',async()=>{
 const f=await setup();try{const v=await f.fixture();
  await f.db.exec("create policy synthetic_delete_wide_objects on storage.objects for all to authenticated using(true) with check(true);create policy synthetic_delete_wide_receipts on uploaded_documents for all to authenticated using(true) with check(true)");
  await assert.rejects(f.role('authenticated',()=>f.db.query('delete from storage.objects where id=$1 returning id',[v.object.id])),e=>e.code==='42501');
  await assert.rejects(f.role('authenticated',()=>f.db.query('delete from uploaded_documents where id=$1 returning id',[v.document_id])),e=>e.code==='42501');
 }finally{await f.close();}
});

test('durable prepare hides bytes, retains tenant-readable pending receipt, finalize archives once and replays same normalized intent',async()=>{
 const f=await setup();try{const v=await f.fixture();
  const absent=await f.operation(v,'lookup');assert.equal(absent.operation_status,'not_found');assert.equal(absent.storage_absent,null);
  const prepared=await f.operation(v);assert.equal(prepared.operation_status,'pending');assert.equal(prepared.storage_absent,false);assert.equal(prepared.original_missing,false);
  const receipt=(await f.role('authenticated',()=>f.db.query('select deletion_state,deletion_request_id from uploaded_documents where id=$1',[v.document_id]))).rows[0];assert.equal(receipt.deletion_state,'pending');assert.equal(receipt.deletion_request_id,v.request_id);
  assert.equal((await f.role('authenticated',()=>f.db.query('select id from storage.objects where id=$1',[v.object.id]))).rows.length,0);
  await assert.rejects(f.finalize(v),/STORAGE_NOT_ABSENT/);
  await f.remove(v);const deleted=await f.finalize(v);assert.equal(deleted.operation_status,'deleted');assert.equal(deleted.storage_absent,true);assert.equal(deleted.deletion_state,'deleted');assert.equal(deleted.receipt_present,true);
  assert.equal((await f.db.query('select status,deletion_state from uploaded_documents where id=$1',[v.document_id])).rows[0].status,'archived');
  const {storage_bucket,storage_path,...without}=v;assert.equal((await f.operation(without)).operation_status,'deleted');assert.equal((await f.finalize(v)).replayed,true);
  assert.equal(Number((await f.db.query("select count(*) n from audit_logs where action like 'document_delete_%'")).rows[0].n),2);
  await assert.rejects(f.operation({...v,request_id:randomUUID()}),/INTENT_CONFLICT/);await assert.rejects(f.operation({...v,storage_path:storage_path+'x'}),/INTENT_CONFLICT/);
  await assert.rejects(f.role('service_role',()=>f.db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',[storage_bucket,storage_path,f.scope.userId,{size:30,mimetype:'application/pdf'}])),e=>e.code==='42501');
 }finally{await f.close();}
});

test('references first deny prepare: any draft/version, direct activity, processing, and immutable report appendix',async()=>{
 for(const type of ['draft','manual-history','activity','processing','report']){const f=await setup();try{const v=await f.fixture();
  if(type==='draft')await f.draft(v);
  else if(type==='manual-history')await f.db.query("insert into extracted_document_drafts(organization_id,project_id,uploaded_document_id,extraction_provider,is_latest,status) values($1,$2,$3,'MANUAL_TRANSCRIPTION_NO_OCR',false,'rejected')",[v.organization_id,v.project_id,v.document_id]);
  else if(type==='activity')await f.activity(v);
  else if(type==='processing')await f.db.query("update uploaded_documents set ocr_status='processing' where id=$1",[v.document_id]);
  else await f.db.query("insert into report_generations(organization_id,project_id,report_version,payload,payload_hash,reporting_period_start,reporting_period_end) values($1,$2,1,$3,'SYNTHETIC','2026-01-01','2026-12-31')",[v.organization_id,v.project_id,{appendix_mappings:[{source_document_id:v.document_id,source_draft_id:null}]}]);
  await assert.rejects(f.operation(v),/DOCUMENT_HAS_REFERENCES/);assert.equal(Number((await f.db.query('select count(*) n from cocal_delete_private.operations')).rows[0].n),0);assert.equal((await f.db.query('select deletion_state from uploaded_documents where id=$1',[v.document_id])).rows[0].deletion_state,'active');
 }finally{await f.close();}}
});

test('prepare first fences new/changed draft, activity, processing and report references under ordinary and service writes',async()=>{
 const f=await setup();try{const v=await f.fixture(),other=await f.fixture();const oldDraft=(await f.draft(other)).rows[0],oldActivity=(await f.activity(other)).rows[0];await f.operation(v);
  for(const as of ['authenticated','service_role']){
   await assert.rejects(f.role(as,()=>f.draft(v)),e=>e.code==='42501');
   await assert.rejects(f.role(as,()=>f.db.query('update extracted_document_drafts set uploaded_document_id=$1 where id=$2',[v.document_id,oldDraft.id])),e=>e.code==='42501');
   await assert.rejects(f.role(as,()=>f.activity(v)),e=>e.code==='42501');
   await assert.rejects(f.role(as,()=>f.db.query('update emission_activities set source_document_id=$1 where id=$2',[v.document_id,oldActivity.id])),e=>e.code==='42501');
   if(as==='authenticated'){
    // Existing UPDATE restrictive RLS can hide the row before a trigger fires.
    try{assert.equal((await f.role(as,()=>f.db.query("update uploaded_documents set ocr_status='processing' where id=$1 returning id",[v.document_id]))).rows.length,0);}catch(e){assert.equal(e.code,'42501');}
   }else await assert.rejects(f.role(as,()=>f.db.query("update uploaded_documents set ocr_status='processing' where id=$1",[v.document_id])),e=>e.code==='42501');
   await assert.rejects(f.role(as,()=>f.db.query("insert into report_generations(organization_id,project_id,report_version,payload,payload_hash,reporting_period_start,reporting_period_end) values($1,$2,1,$3,'SYNTHETIC','2026-01-01','2026-12-31')",[v.organization_id,v.project_id,{appendix_mappings:[{source_document_id:v.document_id,source_draft_id:null}]}])),e=>e.code==='42501');
  }
 }finally{await f.close();}
});

test('no receipt owned original and receipt missing original are explicit, ambiguous absent or other-owner orphan is refused',async()=>{
 const f=await setup();try{
  const orphan=await f.fixture({receipt:false});assert.equal((await f.operation(orphan)).receipt_present,false);await f.remove(orphan);assert.equal((await f.finalize(orphan)).operation_status,'deleted');assert.equal(Number((await f.db.query('select count(*) n from uploaded_documents')).rows[0].n),0);
  const missing=await f.fixture({missing:true});const state=await f.operation(missing);assert.equal(state.original_missing,true);assert.equal(state.storage_absent,true);assert.equal((await f.finalize(missing)).deletion_state,'deleted');
  const ambiguous=await f.fixture({receipt:false,missing:true});await assert.rejects(f.operation(ambiguous),/OWNERSHIP_UNCONFIRMED/);
  const foreign=await f.fixture({receipt:false});await f.db.query('update storage.objects set owner_id=$1 where id=$2',[randomUUID(),foreign.object.id]);await assert.rejects(f.operation(foreign),/BINDING_CHANGED/);
 }finally{await f.close();}
});

test('private deletion ledger/RPCs, role/scope/revocation and latest subscription fail closed; capability is scoped',async()=>{
 const f=await setup();try{const v=await f.fixture();
  const cap=await f.role('authenticated',()=>f.db.query('select * from document_deletion_contract($1)',[v.project_id]));assert.equal(cap.rows[0].contract_version,'20261106.delete.1');assert.equal(cap.rows[0].can_delete,true);
  for(const role of ['anon','authenticated']){await assert.rejects(f.operation(v,'prepare',f.scope.userId,role),e=>e.code==='42501');await assert.rejects(f.finalize(v,f.scope.userId,role),e=>e.code==='42501');await assert.rejects(f.role(role,()=>f.db.query('select * from cocal_delete_private.operations')),e=>e.code==='42501');}
  await assert.rejects(f.operation(v,'prepare',randomUUID()),e=>e.code==='42501');await assert.rejects(f.operation({...v,project_id:randomUUID()}),e=>e.code==='42501');
  await f.operation(v);await f.remove(v);
  await f.db.query("insert into subscriptions(organization_id,plan_code,status,period_start,period_end) values($1,'SYNTHETIC','readonly','2020-01-01','2100-01-01')",[v.organization_id]);
  assert.equal((await f.role('authenticated',()=>f.db.query('select * from document_deletion_contract($1)',[v.project_id]))).rows[0].can_delete,false);await assert.rejects(f.finalize(v),e=>e.code==='42501');
  assert.equal((await f.db.query('select deletion_state from uploaded_documents where id=$1',[v.document_id])).rows[0].deletion_state,'pending');
 }finally{await f.close();}
});

test('finalize SQL failure preserves durable pending receipt/fence and no success audit; same ID can retry',async()=>{
 const f=await setup();try{const v=await f.fixture();await f.operation(v);await f.remove(v);
  await f.db.exec("alter table uploaded_documents add constraint synthetic_finalize_failure check(deletion_state<>'deleted')");
  await assert.rejects(f.finalize(v),e=>e.code==='23514');assert.equal((await f.operation(v,'lookup')).operation_status,'pending');assert.equal((await f.operation(v,'lookup')).phase,'object_absent');
  assert.equal(Number((await f.db.query("select count(*) n from audit_logs where action='document_delete_finalized'")).rows[0].n),0);
  await f.db.exec('alter table uploaded_documents drop constraint synthetic_finalize_failure');assert.equal((await f.finalize(v)).operation_status,'deleted');
 }finally{await f.close();}
});

test('independent SQL-connection reference/delete lock-wait races',{skip:'NOT_RUN: PGlite has one serialized SQL connection; sequential ordering tests are not concurrency evidence'},()=>{});

test('processing lease and delete fence serialize both orderings; no TTL/client flag declares interrupted work finished',async()=>{
 const f=await setup();try{const v=await f.fixture(),lease=randomUUID();
  const begin=()=>f.role('service_role',()=>f.db.query('select * from begin_document_processing($1,$2,$3,$4,$5,$6)',[f.scope.userId,v.organization_id,v.project_id,v.document_id,lease,'SYNTHETIC']));
  await begin();await assert.rejects(f.operation(v),/DOCUMENT_HAS_REFERENCES/);
  await f.db.exec("update cocal_delete_private.processing_leases set created_at='2000-01-01'");await assert.rejects(f.operation(v),/DOCUMENT_HAS_REFERENCES/);
  await assert.rejects(f.role('authenticated',()=>f.db.query('select * from release_document_processing($1,$2)',[f.scope.userId,lease])),e=>e.code==='42501');
  await f.role('service_role',()=>f.db.query('select release_document_processing($1,$2)',[f.scope.userId,lease]));await f.operation(v);await assert.rejects(begin(),e=>e.code==='42501');
 }finally{await f.close();}
});

test('processing finish rechecks revoked role, rolls back failed writes and releases only its own known-ended lease',async()=>{
 const f=await setup();try{const v=await f.fixture(),lease=randomUUID(),actor=f.scope.userId;
  const begin=()=>f.role('service_role',()=>f.db.query('select * from begin_document_processing($1,$2,$3,$4,$5,$6)',[actor,v.organization_id,v.project_id,v.document_id,lease,'SYNTHETIC']));
  const payload={raw_payload:{synthetic:true},normalized_payload:{quantity:100,unit:'kWh'},status:'pending_review',confidence_score:0.5,provider:'mock-ocr',model:'mock-ocr-v1'};
  const finish=p=>f.role('service_role',()=>f.db.query('select * from finish_document_processing($1,$2,$3)',[actor,lease,p]));
  await begin();await assert.rejects(finish({...payload,status:'NOT-ENUM'}),e=>e.code==='22P02');assert.equal(Number((await f.db.query('select count(*) n from extracted_document_drafts')).rows[0].n),0);
  await f.db.query("update organization_members set status='inactive' where user_id=$1",[actor]);await assert.rejects(finish(payload),e=>e.code==='42501');
  await assert.rejects(f.role('service_role',()=>f.db.query('select release_document_processing($1,$2)',[randomUUID(),lease])),e=>e.code==='42501');
  // The ended handler may release its own lease despite a role revocation;
  // release grants no processing/write authority and restores prior OCR state.
  await f.role('service_role',()=>f.db.query('select release_document_processing($1,$2)',[actor,lease]));
  assert.equal((await f.db.query('select ocr_status from uploaded_documents where id=$1',[v.document_id])).rows[0].ocr_status,'pending');
  await f.db.query("update organization_members set status='active' where user_id=$1",[actor]);assert.equal((await f.operation(v)).operation_status,'pending');
 }finally{await f.close();}
});

test('shared legacy object aliases and unknown historical report mappings are preserved rather than guessed unreferenced',async()=>{
 const f=await setup();try{
  const v=await f.fixture();
  await f.db.query(`insert into uploaded_documents(id,organization_id,project_id,uploaded_by_user_id,storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,sha256_hash,document_type,ocr_status,status,env,is_test)
   values($1,$2,$3,$4,$5,$6,'SYNTHETIC alias.pdf','application/pdf',30,$7,'receipt','pending','active','staging',true)`,[randomUUID(),v.organization_id,v.project_id,f.scope.userId,v.storage_bucket,v.storage_path,'b'.repeat(64)]);
  await assert.rejects(f.operation(v),/DOCUMENT_SHARED_ORIGINAL_REFERENCE/);
  const other=await f.fixture();await f.db.query("insert into report_generations(organization_id,project_id,report_version,payload,payload_hash,reporting_period_start,reporting_period_end) values($1,$2,1,$3,'SYNTHETIC','2026-01-01','2026-12-31')",[v.organization_id,v.project_id,{appendix_mappings:[{emission_activity_id:randomUUID()}]}]);
  await assert.rejects(f.operation(other),/DOCUMENT_REFERENCE_INDEX_UNKNOWN/);
 }finally{await f.close();}
});

test('pending visibility fence binds exact bucket as well as path; another protected bucket remains readable',async()=>{
 const f=await setup();try{const v=await f.fixture();
  const other=(await f.db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4) returning id',['staging-attachments',v.storage_path,f.scope.userId,{size:30,mimetype:'application/pdf'}])).rows[0];
  await f.operation(v);
  assert.equal((await f.role('authenticated',()=>f.db.query('select id from storage.objects where id=$1',[v.object.id]))).rows.length,0);
  assert.equal((await f.role('authenticated',()=>f.db.query('select id from storage.objects where id=$1',[other.id]))).rows.length,1);
 }finally{await f.close();}
});

test('report source UUID casing is semantic; malformed historical mappings fail closed instead of guessing no reference',async()=>{
 const cases=[{appendix_mappings:[{source_document_id:'UPPER',source_draft_id:null}]},{appendix_mappings:[null]},{appendix_mappings:[5]},{appendix_mappings:[{}]},{appendix_mappings:[{source_document_id:33,source_draft_id:null}]},{appendix_mappings:'UNKNOWN'}];
 for(const payload of cases){const f=await setup();try{const v=await f.fixture(),upper=payload.appendix_mappings?.[0]?.source_document_id==='UPPER';if(upper)payload.appendix_mappings[0].source_document_id=v.document_id.toUpperCase();
  // Explicit owner fixture of pre-migration malformed history; restore trigger
  // before every real service operation. No production repair is attempted.
  if(!upper)await f.db.exec('alter table report_generations disable trigger deletion_report_reference');
  await f.db.query("insert into report_generations(organization_id,project_id,report_version,payload,payload_hash,reporting_period_start,reporting_period_end) values($1,$2,1,$3,'SYNTHETIC','2026-01-01','2026-12-31')",[v.organization_id,v.project_id,payload]);
  if(!upper)await f.db.exec('alter table report_generations enable trigger deletion_report_reference');
  await assert.rejects(f.operation(v),upper?/DOCUMENT_HAS_REFERENCES/:/DOCUMENT_REFERENCE_INDEX_UNKNOWN/);assert.equal((await f.db.query('select deletion_state from uploaded_documents where id=$1',[v.document_id])).rows[0].deletion_state,'active');
 }finally{await f.close();}}
});
