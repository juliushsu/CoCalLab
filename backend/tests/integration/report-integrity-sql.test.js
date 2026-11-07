// Synthetic PGlite roles/catalog only; not real JWT/hosted SQL/concurrency UAT.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createLocalWorkflow} from '../../tools/local-workflow/engine.js';
import {recalculate_project} from '../../src/services/recalculate-project.js';
async function setup(){
 const f=await createLocalWorkflow(),{db,scope:s}=f;
 async function as(role,fn){await db.exec('begin');try{await db.exec('set local role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[s.userId]);const result=await fn();await db.exec('commit');return result;}catch(e){await db.exec('rollback');throw e;}}
 const report={organization_id:s.organizationId,project_id:s.projectId,generated_by_user_id:s.userId,status:'completed',report_version:1,payload:{appendix_mappings:[],synthetic:true},payload_hash:'SYNTHETIC-NOT-A-SIGNATURE',reporting_period_start:'2026-01-01',reporting_period_end:'2026-12-31'};
 const insert=row=>{const keys=Object.keys(row);return db.query('insert into report_generations('+keys.join(',')+') values('+keys.map((_,i)=>'$'+(i+1)).join(',')+') returning *',Object.values(row));};
 function saveArgs(extra={}){const p={request:randomUUID(),version:1,payload:report.payload,claim:'internal_management',...extra};return [s.organizationId,s.projectId,s.userId,p.version,p.payload,'SYNTHETIC-NOT-A-SIGNATURE','2026-01-01','2026-12-31',0,0,0,{},{},[],0,'2026-01-15T00:00:00Z',p.request,{claim_purpose:p.claim,gross_emissions_snapshot:{gross_total_co2e_kg:0},adjustment_summary:{},claim_results:{},adjustment_manifest:[]}];}
 async function authority(){try{return (await as('service_role',()=>db.query('select * from report_calculation_inputs($1,$2,$3)',[s.organizationId,s.projectId,s.userId]))).rows[0].result;}catch(error){if(!/CALCULATION_AUTHORITY_(REQUIRED|STALE)/.test(error.message))throw error;const a=[s.organizationId,s.projectId,s.userId,randomUUID(),true,'v1.0.0'];const prepared=(await as('service_role',()=>db.query("select * from recalculation_request_v2($1,$2,$3,$4,$5,$6,'prepare')",a))).rows[0].result;const calculationRows=recalculate_project({organization_id:s.organizationId,project_id:s.projectId,activities:prepared.input_snapshot.activities,factors:prepared.input_snapshot.factors}).calculation_results;await as('service_role',()=>db.query('select * from commit_recalculation_v2($1,$2,$3,$4,$5,$6,$7,$8)',[...a,prepared.input_snapshot,calculationRows]));return (await as('service_role',()=>db.query('select * from report_calculation_inputs($1,$2,$3)',[s.organizationId,s.projectId,s.userId]))).rows[0].result;}}
 await authority();
 const publish=async args=>{args[17]={...args[17],calculation_authority:(await authority()).calculation_authority};return as('service_role',async()=>((await db.query('select * from generate_report_snapshot_atomic_v2('+args.map((_,i)=>'$'+(i+1)).join(',')+')',args)).rows[0]));};
 const lookup=(args,actor=s.userId)=>as('service_role',()=>db.query('select * from report_snapshot_request_v2($1,$2,$3,$4,$5,$6)',[s.organizationId,s.projectId,actor,args[16],args[3],args[17].claim_purpose]));
 const read=(id,actor=s.userId)=>as('service_role',()=>db.query('select * from read_verified_report_snapshot($1,$2,$3,$4)',[s.organizationId,s.projectId,actor,id]));
 return {...f,as,report,insert,saveArgs,publish,lookup,read};
}
test('ordinary editor cannot create a completed report outside the publisher, including a permissive policy',async()=>{
 const f=await setup();try{
  await f.db.exec('create policy synthetic_report_wide on report_generations for all to authenticated using(true) with check(true)');
  await assert.rejects(f.as('authenticated',()=>f.insert(f.report)),e=>e.code==='42501');
 }finally{await f.close();}
});

test('publisher seals final marker and complete persisted row; ordinary SELECT and same-request replay remain available',async()=>{
 const f=await setup();try{const args=f.saveArgs(),saved=await f.publish(args);
  const row=(await f.read(saved.report_generation_id)).rows[0];assert.equal(row.integrity_status,'server_verified');assert.equal(row.status,'completed');
  const proof=(await f.db.query('select * from cocal_report_private.snapshots where report_id=$1',[row.id])).rows[0];assert.deepEqual(proof.row_snapshot,(await f.db.query('select to_jsonb(r) value from report_generations r where r.id=$1',[row.id])).rows[0].value);
  assert.equal((await f.as('authenticated',()=>f.db.query('select * from report_generations where id=$1',[row.id]))).rows[0].id,row.id);
  const audits=(await f.db.query('select * from audit_logs order by id')).rows;
  assert.equal((await f.publish(args)).report_generation_id,row.id);assert.equal((await f.lookup(args)).rows[0].id,row.id);assert.deepEqual((await f.db.query('select * from audit_logs order by id')).rows,audits);
  await f.db.exec("set timezone='Asia/Taipei'");assert.equal((await f.read(row.id)).rows[0].id,row.id);assert.equal((await f.lookup(args)).rows[0].id,row.id);
 }finally{await f.close();}
});

test('ordinary content/identity/status/source mutations and DELETE remain ineffective under permissive drift; trigger also covers disabled RLS',async()=>{
 const f=await setup();try{const args=f.saveArgs(),{report_generation_id:id}=await f.publish(args),before=(await f.read(id)).rows[0];
  await f.db.exec('create policy synthetic_report_wide on report_generations for all to authenticated using(true) with check(true)');
  const patches=[{payload:{appendix_mappings:[],forged:true}},{payload_hash:'FORGED'},{gross_emissions_snapshot:{gross_total_co2e_kg:999}},{claim_results:{claim_net_co2e_kg:999}},{scope_totals:{'2':999}},{status:'failed'},{generated_by_user_id:randomUUID()},{report_version:99},{integrity_status:'legacy_unverified'},{is_test:false},{reporting_period_end:'2026-11-01'}];
  for(const patch of patches){const key=Object.keys(patch)[0];assert.equal((await f.as('authenticated',()=>f.db.query('update report_generations set '+key+'=$1 where id=$2 returning id',[patch[key],id]))).rows.length,0);}
  assert.equal((await f.as('authenticated',()=>f.db.query('delete from report_generations where id=$1 returning id',[id]))).rows.length,0);
  assert.deepEqual((await f.read(id)).rows[0],before);assert.equal(Number((await f.db.query('select count(*) n from report_snapshot_requests_v2')).rows[0].n),1);
  await f.db.exec('alter table report_generations disable row level security');
  await assert.rejects(f.as('authenticated',()=>f.db.query("update report_generations set payload='{}' where id=$1",[id])),e=>e.code==='42501');
  await assert.rejects(f.as('authenticated',()=>f.db.query('delete from report_generations where id=$1',[id])),e=>e.code==='42501');
  await assert.rejects(f.as('authenticated',()=>f.insert({...f.report,report_version:2})),e=>e.code==='42501');await f.db.exec('alter table report_generations enable row level security');
 }finally{await f.close();}
});

test('service maintenance changes invalidate lookup/export/replay; missing row cannot erase private request authority',async()=>{
 for(const mode of ['tampered','deleted']){const f=await setup();try{const args=f.saveArgs(),{report_generation_id:id}=await f.publish(args);
  if(mode==='tampered')await f.as('service_role',()=>f.db.query('update report_generations set gross_emissions_snapshot=$1 where id=$2',[{gross_total_co2e_kg:999},id]));else await f.as('service_role',()=>f.db.query('delete from report_generations where id=$1',[id]));
  await assert.rejects(f.read(id),/REPORT_SNAPSHOT_INTEGRITY_MISMATCH/);await assert.rejects(f.lookup(args),/REPORT_SNAPSHOT_INTEGRITY_MISMATCH/);await assert.rejects(f.publish(args),/REPORT_SNAPSHOT_INTEGRITY_MISMATCH/);
  assert.equal(Number((await f.db.query('select count(*) n from cocal_report_private.snapshots')).rows[0].n),1);assert.equal(Number((await f.db.query('select count(*) n from report_generations')).rows[0].n),mode==='deleted'?0:1);
 }finally{await f.close();}}
});

test('legacy rows remain readable unverified; marker or client GUC cannot create private authority',async()=>{
 const f=await setup();try{const legacy=(await f.insert(f.report)).rows[0];assert.equal(legacy.integrity_status,'legacy_unverified');
  assert.equal((await f.as('authenticated',()=>f.db.query('select id from report_generations where id=$1',[legacy.id]))).rows.length,1);await assert.rejects(f.read(legacy.id),/REPORT_SNAPSHOT_UNVERIFIED/);
  await assert.rejects(f.as('service_role',()=>f.db.query("update report_generations set integrity_status='server_verified' where id=$1",[legacy.id])),e=>e.code==='42501');
  await assert.rejects(f.as('authenticated',async()=>{await f.db.query("select set_config('cocal.report_publisher','true',true)");return f.insert({...f.report,report_version:2});}),e=>e.code==='42501');
  for(const role of ['anon','authenticated','service_role'])await assert.rejects(f.as(role,()=>f.db.query('select * from cocal_report_private.snapshots')),e=>e.code==='42501');
  for(const role of ['anon','authenticated'])await assert.rejects(f.as(role,()=>f.db.query('select * from read_verified_report_snapshot($1,$2,$3,$4)',[f.scope.organizationId,f.scope.projectId,f.scope.userId,legacy.id])),e=>e.code==='42501');
  assert.equal(Number((await f.db.query('select count(*) n from cocal_report_private.snapshots')).rows[0].n),0);
 }finally{await f.close();}
});

test('marker-stage SQL failure rolls back report/snapshot/request/audit; same original request retries',async()=>{
 const f=await setup();try{const args=f.saveArgs();await f.db.exec("alter table report_generations add constraint synthetic_seal_failure check(integrity_status<>'server_verified')");
  await assert.rejects(f.publish(args),e=>e.code==='23514');for(const table of ['report_generations','report_snapshot_requests_v2','cocal_report_private.snapshots'])assert.equal(Number((await f.db.query('select count(*) n from '+table)).rows[0].n),0);
  await f.db.exec('alter table report_generations drop constraint synthetic_seal_failure');const saved=await f.publish(args);assert.equal((await f.read(saved.report_generation_id)).rows[0].integrity_status,'server_verified');
 }finally{await f.close();}
});

test('missing proof/request binding cannot be repaired by replay or user-writable audit',async()=>{
 for(const missing of ['proof','request']){const f=await setup();try{const args=f.saveArgs(),{report_generation_id:id}=await f.publish(args);
  // Owner-only synthetic drift, never service/public proof mutation or repair.
  await f.db.exec(missing==='proof'?'delete from cocal_report_private.snapshots':'delete from report_snapshot_requests_v2');
  await f.as('authenticated',()=>f.db.query("insert into audit_logs(organization_id,project_id,actor_user_id,actor_type,action,entity_type,entity_id,status,metadata) values($1,$2,$3,'user','generate_report_snapshot_atomic_v2','report_generation',$4,'recorded',$5)",[f.scope.organizationId,f.scope.projectId,f.scope.userId,id,{request_id:args[16],integrity_status:'server_verified'}]));
  const code=missing==='proof'?/REPORT_SNAPSHOT_UNVERIFIED/:/REPORT_SNAPSHOT_INTEGRITY_MISMATCH/;
  await assert.rejects(f.lookup(args),code);await assert.rejects(f.publish(args),code);await assert.rejects(f.read(id),code);assert.equal(Number((await f.db.query('select count(*) n from report_generations')).rows[0].n),1);
 }finally{await f.close();}}
});

test('SQL publication/lookup/export read recheck active organization, role and latest subscription',async()=>{
 for(const change of ['membership','viewer','organization','subscription']){const f=await setup();try{const args=f.saveArgs(),{report_generation_id:id}=await f.publish(args);
  if(change==='membership')await f.db.query("update organization_members set status='inactive' where user_id=$1",[f.scope.userId]);
  else if(change==='viewer')await f.db.query("update organization_members set role='viewer' where user_id=$1",[f.scope.userId]);
  else if(change==='organization')await f.db.query("update organizations set status='suspended' where id=$1",[f.scope.organizationId]);
  else await f.db.query("insert into subscriptions(organization_id,plan_code,status,period_start,period_end) values($1,'SYNTHETIC-LATEST','readonly','2020-01-01','2100-01-01')",[f.scope.organizationId]);
  await assert.rejects(f.lookup(args),e=>e.code==='42501');await assert.rejects(f.read(id),e=>e.code==='42501');await assert.rejects(f.publish(f.saveArgs({version:2})),e=>e.code==='42501');
  assert.equal(Number((await f.db.query('select count(*) n from report_generations')).rows[0].n),1);assert.equal(Number((await f.db.query('select count(*) n from cocal_report_private.snapshots')).rows[0].n),1);
 }finally{await f.close();}}
});

test('source retention survives ordinary report mapping removal or hard-delete attempts',async()=>{
 const f=await setup();try{const doc=randomUUID(),path=`staging/${f.scope.projectId}/${doc}.pdf`;
  await f.db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',['staging-receipts',path,f.scope.userId,{size:30,mimetype:'application/pdf'}]);
  await f.db.query("insert into uploaded_documents(id,organization_id,project_id,uploaded_by_user_id,storage_bucket,storage_path,original_filename,file_size_bytes,sha256_hash) values($1,$2,$3,$4,'staging-receipts',$5,'SYNTHETIC.pdf',30,$6)",[doc,f.scope.organizationId,f.scope.projectId,f.scope.userId,path,'a'.repeat(64)]);
  const activity=randomUUID();await f.db.query("insert into emission_activities(id,organization_id,project_id,source_document_id,activity_code,activity_name,activity_date,category,activity_type,quantity,unit,inclusion_status,final_scope) values($1,$2,$3,$4,'SYNTHETIC','SYNTHETIC source','2026-01-15','energy','electricity',1,'kWh','included',2)",[activity,f.scope.organizationId,f.scope.projectId,doc]);
  const args=f.saveArgs({payload:{appendix_mappings:[],synthetic:true}});await assert.rejects(f.publish(args),/REPORT_SOURCE_MAPPING_MISMATCH/);const calculation=(await f.db.query('select id from calculation_results where emission_activity_id=$1 and is_latest',[activity])).rows[0].id;args[4].appendix_mappings=[{emission_activity_id:activity,source_document_id:doc,source_draft_id:null,calculation_result_id:calculation}];const {report_generation_id:id}=await f.publish(args);
  assert.equal((await f.as('authenticated',()=>f.db.query("update report_generations set payload='{\"appendix_mappings\":[]}' where id=$1 returning id",[id]))).rows.length,0);
  assert.equal((await f.as('authenticated',()=>f.db.query('delete from report_generations where id=$1 returning id',[id]))).rows.length,0);
  await assert.rejects(f.as('service_role',()=>f.db.query("select * from document_deletion_request($1,$2,'prepare')",[f.scope.userId,{organization_id:f.scope.organizationId,project_id:f.scope.projectId,document_id:doc,request_id:randomUUID()}])),/DOCUMENT_HAS_REFERENCES/);
  assert.equal((await f.lookup(args)).rows[0].payload.appendix_mappings[0].source_document_id,doc);
 }finally{await f.close();}
});

// Independent SQL-connection races are NOT_RUN; this adds no concurrency claim
// or duplicate skip beyond the project's existing two NOT_RUN acceptance items.
