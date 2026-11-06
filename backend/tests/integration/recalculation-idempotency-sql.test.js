// PGlite roles/catalog substitute. No real JWT, Supabase or independent connections.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createLocalWorkflow} from '../../tools/local-workflow/engine.js';
import {recalculate_project} from '../../src/services/recalculate-project.js';
async function setup({empty=false}={}){
 const f=await createLocalWorkflow(),{db,scope:s}=f;
 async function role(name,fn){await db.exec('begin');try{await db.exec('set local role '+name);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[s.userId]);const value=await fn();await db.exec('commit');return value;}catch(error){await db.exec('rollback');throw error;}}
 if(!empty)await db.query(`insert into emission_activities(organization_id,project_id,activity_code,activity_name,activity_date,quantity,unit,category,activity_type,inclusion_status,final_scope,status) values($1,$2,'SYNTHETIC','SYNTHETIC ONLY','2026-01-15',100,'kWh','energy','electricity','included',2,'active')`,[s.organizationId,s.projectId]);
 await db.query(`insert into emission_factors(id,organization_id,factor_key,factor_name,source_name,category,activity_type,unit,co2e_kg_per_unit,valid_from,version,quality_tier,status) values($1,$2,'SYNTHETIC','SYNTHETIC ONLY','SYNTHETIC TEST','energy','electricity','kWh',0.5,'2026-01-01',1,'custom','active')`,[s.factorId,s.organizationId]);
 const intent=(extra={})=>({org:s.organizationId,project:s.projectId,actor:s.userId,request:randomUUID(),force:true,formula:'v1.0.0',...extra});
 const args=i=>[i.org,i.project,i.actor,i.request,i.force,i.formula];
 const request=(i,action='prepare',as='service_role')=>role(as,async()=>((await db.query('select * from recalculation_request_v2($1,$2,$3,$4,$5,$6,$7)',[...args(i),action])).rows[0].result));
 function payload(state){return recalculate_project({organization_id:s.organizationId,project_id:s.projectId,activities:state.input_snapshot.activities,factors:state.input_snapshot.factors}).calculation_results;}
 const commit=(i,state,rows=payload(state),as='service_role')=>role(as,async()=>((await db.query('select * from commit_recalculation_v2($1,$2,$3,$4,$5,$6,$7,$8)',[...args(i),state.input_snapshot,rows])).rows[0].result));
 const calculations=async()=>((await db.query('select * from calculation_results order by calc_version')).rows);
 return {...f,role,intent,request,payload,commit,calculations};
}

test('ledger is private authority: ordinary direct reads, writes, helper and RPC calls are denied',async()=>{
 const f=await setup();try{
  const i=f.intent();await f.request(i);
  for(const role of ['anon','authenticated']){
   await assert.rejects(f.role(role,()=>f.db.query('select * from cocal_recalc_private.requests')),e=>e.code==='42501');
   await assert.rejects(f.role(role,()=>f.db.query("update cocal_recalc_private.requests set saved_result='{}'")),e=>e.code==='42501');
   await assert.rejects(f.request(i,'lookup',role),e=>e.code==='42501');
   await assert.rejects(f.role(role,()=>f.db.query('select cocal_recalc_private.inputs($1,$2)',[i.org,i.project])),e=>e.code==='42501');
  }
  await assert.rejects(f.role('service_role',()=>f.db.query('select * from cocal_recalc_private.requests')),e=>e.code==='42501');
  const state=await f.request(i);await assert.rejects(f.commit(i,state,undefined,'authenticated'),e=>e.code==='42501');
 }finally{await f.close();}
});

test('SQL compares fresh full inputs, including newly tied factor candidates, before any write',async()=>{
 for(const change of ['quantity','factor','candidate']){const f=await setup();try{
  const i=f.intent(),state=await f.request(i);
  if(change==='quantity')await f.db.exec('update emission_activities set quantity=101');
  else if(change==='factor')await f.db.exec('update emission_factors set co2e_kg_per_unit=0.6');
  else await f.db.query(`insert into emission_factors(organization_id,factor_key,factor_name,source_name,category,activity_type,unit,co2e_kg_per_unit,valid_from,version,quality_tier,status) values($1,'SYNTHETIC-TIE','SYNTHETIC TIE','SYNTHETIC','energy','electricity','kWh',0.7,'2026-01-01',1,'custom','active')`,[i.org]);
  await assert.rejects(f.commit(i,state),/RECALCULATION_INPUT_CHANGED/);assert.equal((await f.calculations()).length,0);
  assert.equal((await f.db.query('select count(*) n from audit_logs')).rows[0].n,0);
  assert.equal((await f.request(i,'lookup')).operation_status,'pending');
 }finally{await f.close();}}
});

test('SQL allocates versions from current max, ignoring stale or fabricated caller versions; replay is exactly once',async()=>{
 const f=await setup();try{
  const first=f.intent(),state=await f.request(first),rows=f.payload(state).map(row=>({...row,calc_version:999}));
  const saved=await f.commit(first,state,rows);assert.equal((await f.calculations())[0].calc_version,1);
  assert.deepEqual((await f.commit(first,state,rows)).calculation_result_ids,saved.calculation_result_ids);
  assert.equal((await f.calculations()).length,1);assert.equal(Number((await f.db.query('select count(*) n from audit_logs')).rows[0].n),1);
  const second=f.intent(),next=await f.request(second);await f.commit(second,next,f.payload(next).map(row=>({...row,calc_version:1})));
  assert.deepEqual((await f.calculations()).map(x=>x.calc_version),[1,2]);
  const history=await f.request(first,'lookup');assert.equal(history.input_matches_current,true);assert.equal(history.results_are_latest,false);assert.equal(history.operation_status,'historical');
  await assert.rejects(f.request(first),/RECALCULATION_RESULT_SUPERSEDED/);
 }finally{await f.close();}
});

test('real SQL INSERT failure rolls back old latest/audit/ledger completion; prepared same request can retry',async()=>{
 const f=await setup();try{
  const first=f.intent(),a=await f.request(first);await f.commit(first,a);
  const before=await f.calculations(),audits=(await f.db.query('select * from audit_logs order by id')).rows;
  const i=f.intent(),state=await f.request(i),rows=f.payload(state);
  await assert.rejects(f.commit(i,state,rows.map(row=>({...row,co2e_kg:'NOT-NUMERIC'}))),e=>e.code==='22P02');
  assert.deepEqual(await f.calculations(),before);assert.equal(before[0].is_latest,true);
  assert.deepEqual((await f.db.query('select * from audit_logs order by id')).rows,audits);
  const pending=await f.request(i,'lookup');assert.equal(pending.operation_status,'pending');assert.equal(pending.processed_activities,null);
  const saved=await f.commit(i,state,rows);assert.equal(saved.operation_status,'completed');assert.equal((await f.calculations()).length,2);
 }finally{await f.close();}
});

test('SQL commit rechecks actor/scope/latest subscription after prepare, including older active plus newer suspended',async()=>{
 for(const change of ['revoked','readonly','suspended']){const f=await setup();try{
  const i=f.intent(),state=await f.request(i);
  if(change==='revoked')await f.db.query("update organization_members set status='inactive' where user_id=$1",[i.actor]);
  else await f.db.query("insert into subscriptions(organization_id,plan_code,status,period_start,period_end) values($1,'SYNTHETIC',$2,'2020-01-01','2100-01-01')",[i.org,change]);
  await assert.rejects(f.commit(i,state),e=>e.code==='42501');assert.equal((await f.calculations()).length,0);
  await assert.rejects(f.request(i,'lookup'),e=>e.code==='42501');
 }finally{await f.close();}}
 const f=await setup();try{const i=f.intent();await assert.rejects(f.request({...i,project:randomUUID()}),e=>e.code==='42501');const state=await f.request(i);await assert.rejects(f.commit({...i,actor:randomUUID()},state),e=>e.code==='42501');}finally{await f.close();}
});

test('payload omissions, duplicate activities, changed scope, and formula cannot be committed',async()=>{
 const f=await setup();try{
  const i=f.intent(),state=await f.request(i),rows=f.payload(state);
  for(const bad of [[],[rows[0],rows[0]],[{...rows[0],project_id:randomUUID()}],[{...rows[0],formula_version:'v2'}]])await assert.rejects(f.commit(i,state,bad),/RECALCULATION_PAYLOAD_SCOPE_MISMATCH/);
  for(const changed of [{force:false},{formula:'v2'}])await assert.rejects(f.request({...i,...changed}),/RECALCULATION_REQUEST_INTENT_CONFLICT/);
  assert.equal((await f.calculations()).length,0);await f.commit(i,state);
 }finally{await f.close();}
});

test('SQL snapshot has no REST page cap and excludes self-changing timestamps/results',async()=>{
 const f=await setup({empty:true});try{
  await f.db.query(`insert into emission_activities(organization_id,project_id,activity_code,activity_name,activity_date,quantity,unit,category,activity_type,inclusion_status,status)
   select $1,$2,'SYNTHETIC-'||n,'SYNTHETIC ONLY','2026-01-15',1,'kWh','energy','electricity','included','active' from generate_series(1,1101) n`,[f.scope.organizationId,f.scope.projectId]);
  const i=f.intent(),state=await f.request(i);assert.equal(state.input_snapshot.activities.length,1101);
  await f.db.exec('update emission_activities set updated_at=now();update emission_factors set updated_at=now()');
  assert.deepEqual((await f.request(i)).input_snapshot,state.input_snapshot);
 }finally{await f.close();}
});

test('independent SQL-connection lock-wait/concurrent commit behavior', {skip:'NOT_RUN: local PGlite fixture has one serialized connection; Promise.all is not independent SQL concurrency evidence'},()=>{});

test('suppressed result INSERT cannot complete a request with missing IDs; audit and completion roll back',async()=>{
 const f=await setup();try{
  const i=f.intent(),state=await f.request(i);
  // Explicit owner-only synthetic trigger: a real SQL INSERT can return no row
  // without throwing. This checks actual readback, not caller summary counters.
  await f.db.exec(`create function public.synthetic_suppress_calc() returns trigger language plpgsql as $$begin return null;end;$$;
   create trigger synthetic_suppress_calc before insert on calculation_results for each row execute function public.synthetic_suppress_calc()`);
  await assert.rejects(f.commit(i,state),/RECALCULATION_RESULT_COUNT_MISMATCH/);
  assert.equal((await f.calculations()).length,0);assert.equal(Number((await f.db.query('select count(*) n from audit_logs')).rows[0].n),0);
  assert.equal((await f.request(i,'lookup')).operation_status,'pending');
  await f.db.exec('drop trigger synthetic_suppress_calc on calculation_results;drop function public.synthetic_suppress_calc()');
  const retry=await f.commit(i,state);assert.equal(retry.operation_status,'completed');assert.equal(retry.calculation_result_ids.length,1);
 }finally{await f.close();}
});
