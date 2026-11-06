// Fresh PGlite with complete source migration chain and explicit Storage catalog
// stubs. Synthetic SQL/RLS evidence only; not Auth/JWT/Storage HTTP acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createLocalWorkflow} from '../../tools/local-workflow/engine.js';
import {canonicalManualTranscription} from '../../src/contracts/manual-transcription.js';
import {calculate_emission_activity} from '../../src/services/calculate-emission-activity.js';
const input=()=>canonicalManualTranscription({activity_name:'SYNTHETIC manual test',quantity:100,unit:'kWh',activity_date:'2026-01-15',category:'energy',subcategory:null,activity_type:'electricity',final_scope:2,inclusion_status:'included',exclusion_reason:null,review_note:null,period_start:null,period_end:null,source_locator:'SYNTHETIC page 1'});
async function setup(){
  const flow=await createLocalWorkflow(),{db,scope}=flow,doc=randomUUID(),draft=randomUUID(),request=randomUUID(),path=`staging/${scope.projectId}/${doc}.pdf`;
  await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',['staging-receipts',path,scope.userId,{size:20,mimetype:'application/pdf'}]);
  await db.query(`insert into uploaded_documents(id,organization_id,project_id,uploaded_by_user_id,storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,sha256_hash,ocr_status,status,env,is_test) values($1,$2,$3,$4,'staging-receipts',$5,'SYNTHETIC.sql.pdf','application/pdf',20,$6,'pending','active','staging',true)`,[doc,scope.organizationId,scope.projectId,scope.userId,path,'a'.repeat(64)]);
  async function role(role,fn){await db.exec('begin');try{await db.exec('set local role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[scope.userId]);const result=await fn();await db.exec('commit');return result;}catch(error){await db.exec('rollback');throw error;}}
  async function create(overrides={}){const v={org:scope.organizationId,project:scope.projectId,doc,draft,actor:scope.userId,request,transcription:input(),...overrides};return role('service_role',()=>db.query('select * from create_manual_transcription_atomic($1,$2,$3,$4,$5,$6,$7)',[v.org,v.project,v.doc,v.draft,v.actor,v.request,v.transcription]));}
  async function confirm(intent,calc=calculate_emission_activity({activity:{...input(),organization_id:scope.organizationId},factors:[]})){return role('service_role',()=>db.query('select * from confirm_manual_draft_atomic_v2($1,$2,$3,$4,$5,$6,$7,$8)',[scope.organizationId,scope.projectId,draft,scope.userId,intent,calc,100,'kWh']));}
  const count=async table=>Number((await db.query('select count(*) n from '+table)).rows[0].n);
  return {...flow,doc,draft,path,request,role,create,confirm,count};
}
test('manual SQL creates exact server provenance, replays once and refuses altered actor/input/latest intent',async()=>{
  const f=await setup();try{
    const first=(await f.create()).rows[0];assert.equal(first.replayed,false);assert.equal(first.draft_data.raw_payload.manual_transcription.user_id,f.scope.userId);assert.ok(first.draft_data.raw_payload.manual_transcription.transcribed_at);assert.equal(first.draft_data.extraction_provider,'MANUAL_TRANSCRIPTION_NO_OCR');
    const replay=(await f.create()).rows[0];assert.equal(replay.replayed,true);assert.deepEqual(replay.draft_data,first.draft_data);assert.equal(await f.count('extracted_document_drafts'),1);
    await assert.rejects(f.create({transcription:{...input(),quantity:101}}),/intent_conflict/);await assert.rejects(f.create({draft:randomUUID()}),/latest_conflict/);
    await assert.rejects(f.create({actor:randomUUID()}),error=>error.code==='42501');await assert.rejects(f.create({org:randomUUID()}),error=>error.code==='42501');
    assert.equal((await f.db.query('select ocr_status from uploaded_documents where id=$1',[f.doc])).rows[0].ocr_status,'pending');
  }finally{await f.close();}
});
test('manual SQL direct authenticated provenance insert/update/delete cannot bypass guards with an extra permissive policy',async()=>{
  const f=await setup();try{
    await f.db.exec("create policy synthetic_manual_broad on extracted_document_drafts for all to authenticated using(true) with check(true)");
    const app=fn=>f.role('authenticated',fn);
    for(const [provider,raw]of [['MANUAL_TRANSCRIPTION_NO_OCR',{}],['manual_other',{}],['other',{manual_transcription:{user_id:f.scope.userId}}]])await assert.rejects(app(()=>f.db.query('insert into extracted_document_drafts(organization_id,project_id,uploaded_document_id,extraction_provider,raw_payload) values($1,$2,$3,$4,$5)',[f.scope.organizationId,f.scope.projectId,f.doc,provider,raw])),error=>error.code==='42501');
    await f.create();
    for(const patch of ["status='confirmed'","extraction_provider='other'","normalized_payload='{}'","raw_payload='{}'","reviewed_by_user_id=gen_random_uuid()"] )await assert.rejects(app(()=>f.db.query('update extracted_document_drafts set '+patch+' where id=$1',[f.draft])),error=>error.code==='42501');
    await assert.rejects(app(()=>f.db.query('delete from extracted_document_drafts where id=$1',[f.draft])),error=>error.code==='42501');
    await assert.rejects(app(()=>f.db.query('select * from create_manual_transcription_atomic($1,$2,$3,$4,$5,$6,$7)',[f.scope.organizationId,f.scope.projectId,f.doc,randomUUID(),f.scope.userId,'forged',input()])),error=>error.code==='42501');
    const role=(await app(()=>f.db.query("select current_user,rolbypassrls,rolsuper from pg_roles where rolname=current_user"))).rows[0];assert.equal(role.current_user,'authenticated');assert.equal(role.rolbypassrls,false);assert.equal(role.rolsuper,false);
  }finally{await f.close();}
});
test('manual SQL confirmation persists pending-factor NULL once; same intent replays and changed decision/request conflicts',async()=>{
  const f=await setup();try{
    await f.create();const intent={decision:'confirmed',request_id:randomUUID(),review_note:'SYNTHETIC checked'};
    const first=(await f.confirm(intent)).rows[0],again=(await f.confirm(intent,null)).rows[0];assert.deepEqual(again,first);assert.equal(await f.count('emission_activities'),1);assert.equal(await f.count('calculation_results'),1);
    const calc=(await f.db.query('select * from calculation_results')).rows[0];assert.equal(calc.status,'pending_factor');assert.equal(calc.co2e_kg,null);assert.equal(calc.is_test,true);
    await assert.rejects(f.confirm({...intent,request_id:randomUUID()},null),/intent_conflict/);await assert.rejects(f.confirm({...intent,decision:'rejected'},null),/intent_conflict/);
  }finally{await f.close();}
});
test('manual SQL calculation INSERT error rolls back activity, confirmation and audit; legal retry succeeds',async()=>{
  const f=await setup();try{
    await f.create();const audit=await f.count('audit_logs'),intent={decision:'confirmed',request_id:randomUUID(),review_note:null};
    const bad={...calculate_emission_activity({activity:{...input(),organization_id:f.scope.organizationId},factors:[]}),factor_id:'invalid-uuid'};
    await assert.rejects(f.confirm(intent,bad),error=>error.code==='22P02');assert.equal(await f.count('emission_activities'),0);assert.equal(await f.count('calculation_results'),0);assert.equal(await f.count('audit_logs'),audit);
    const draft=(await f.db.query('select * from extracted_document_drafts where id=$1',[f.draft])).rows[0];assert.equal(draft.status,'pending_review');assert.equal(draft.raw_payload.manual_transcription.confirmation,undefined);
    await f.confirm(intent);assert.equal(await f.count('emission_activities'),1);
  }finally{await f.close();}
});
test('manual SQL transaction rechecks readonly, period, missing object and stale draft instead of trusting earlier HTTP reads',async()=>{
  const f=await setup();try{
    await assert.rejects(f.create({transcription:{...input(),period_start:'2025-12-01',period_end:'2026-01-31'}}),/outside_project/);
    await f.create();const intent={decision:'confirmed',request_id:randomUUID(),review_note:null};
    await f.db.query("update subscriptions set status='readonly' where organization_id=$1",[f.scope.organizationId]);await assert.rejects(f.confirm(intent),error=>error.code==='42501');
    await f.db.query("update subscriptions set status='active' where organization_id=$1",[f.scope.organizationId]);
    await f.db.query('update extracted_document_drafts set is_latest=false where id=$1',[f.draft]);await assert.rejects(f.confirm(intent),/stale_draft/);await f.db.query('update extracted_document_drafts set is_latest=true where id=$1',[f.draft]);
    await f.db.query('delete from storage.objects where bucket_id=$1 and name=$2',['staging-receipts',f.path]);await assert.rejects(f.confirm(intent),error=>error.code==='42501');
    assert.equal(await f.count('emission_activities'),0);
  }finally{await f.close();}
});
test('manual pending source deletion stays denied under broad permissive policies while service maintenance is preserved',async()=>{
  const f=await setup();try{
    await f.create();assert.equal(await f.count('emission_activities'),0);
    await f.db.exec("create policy synthetic_objects_delete_broad on storage.objects for delete to authenticated using(true);create policy synthetic_receipt_delete_broad on uploaded_documents for delete to authenticated using(true)");
    const objects=await f.role('authenticated',()=>f.db.query('delete from storage.objects where bucket_id=$1 and name=$2 returning id',['staging-receipts',f.path]));assert.equal(objects.rows.length,0);
    const receipts=await f.role('authenticated',()=>f.db.query('delete from uploaded_documents where id=$1 returning id',[f.doc]));assert.equal(receipts.rows.length,0);
    assert.equal(await f.count('storage.objects'),1);assert.equal(await f.count('uploaded_documents'),1);assert.equal(await f.count('extracted_document_drafts'),1);
    const maintained=await f.role('service_role',()=>f.db.query('delete from storage.objects where bucket_id=$1 and name=$2 returning id',['staging-receipts',f.path]));assert.equal(maintained.rows.length,1);
  }finally{await f.close();}
});
test('manual transaction honors latest readonly/suspended/canceled instead of an older active row for create and confirm',async()=>{
  const f=await setup();try{
    await f.create();
    const latest=randomUUID();await f.db.query("insert into subscriptions(id,organization_id,plan_code,status,period_start,period_end) values($1,$2,'SYNTHETIC','readonly','2020-01-01','2100-01-01')",[latest,f.scope.organizationId]);
    for(const status of ['readonly','suspended','canceled']){
      await f.db.query('update subscriptions set status=$1 where id=$2',[status,latest]);
      await assert.rejects(f.create(),error=>error.code==='42501');await assert.rejects(f.confirm({decision:'confirmed',request_id:randomUUID(),review_note:null}),error=>error.code==='42501');
    }
    assert.equal(await f.count('extracted_document_drafts'),1);assert.equal(await f.count('emission_activities'),0);
  }finally{await f.close();}
});
test('manual SQL expired active and expired grace refuse; current grace permits the same fixed request',async()=>{
  const f=await setup();try{
    await f.db.query("update subscriptions set status='active',period_end=now()-interval '1 day',grace_until=null where organization_id=$1",[f.scope.organizationId]);await assert.rejects(f.create(),error=>error.code==='42501');
    await f.db.query("update subscriptions set grace_until=now()+interval '1 day' where organization_id=$1",[f.scope.organizationId]);await f.create();
    await f.db.query("update subscriptions set status='grace_period',grace_until=now()-interval '1 hour' where organization_id=$1",[f.scope.organizationId]);await assert.rejects(f.confirm({decision:'confirmed',request_id:'expired-grace',review_note:null}),error=>error.code==='42501');
    await f.db.query("update subscriptions set grace_until=now()+interval '1 day' where organization_id=$1",[f.scope.organizationId]);await f.confirm({decision:'confirmed',request_id:'valid-grace',review_note:null});assert.equal(await f.count('emission_activities'),1);
  }finally{await f.close();}
});
