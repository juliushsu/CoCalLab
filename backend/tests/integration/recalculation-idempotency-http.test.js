// SYNTHETIC local HTTP/Auth substitute; checked-in handlers and real SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createProductRuntime} from '../../tools/product-preview/runtime.js';
import {calculateManualProject,lookupManualCalculation} from '../../../frontend/readdy-app/src/services/manualWorkflow.ts';
const require=createRequire(new URL('../../../frontend/readdy-app/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const service='SYNTHETIC-PRODUCT-SERVICE-KEY';
async function api(r,path,{token,method='GET',body,headers={}}={}){
 const response=await fetch(r.baseUrl+path,{method,headers:{apikey:r.publicKey,...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:response.status,body:await response.json().catch(()=>null)};
}
async function login(r,name='owner'){const x=await api(r,'/auth/v1/token?grant_type=password',{method:'POST',body:r.accounts[name]});assert.equal(x.status,200);return x.body.access_token;}
function input(r,extra={}){return {organization_id:r.scope.organizationId,project_id:r.scope.projectId,actor_user_id:r.scope.userId,force_recalculate:true,request_id:randomUUID(),...extra};}
async function activity(r,token){const x=await api(r,'/rest/v1/emission_activities',{method:'POST',token,headers:{Prefer:'return=representation'},body:{organization_id:r.scope.organizationId,project_id:r.scope.projectId,activity_code:'SYNTHETIC-'+randomUUID(),activity_name:'SYNTHETIC idempotency electricity',activity_date:'2026-01-15',quantity:100,unit:'kWh',category:'energy',subcategory:'purchased_electricity',activity_type:'electricity',final_scope:2,inclusion_status:'included',status:'active',created_by_user_id:r.scope.userId,env:'staging',is_test:true}});assert.equal(x.status,201,JSON.stringify(x.body));return x.body[0];}
async function rows(r,token,table){const x=await api(r,'/rest/v1/'+table+'?organization_id=eq.'+r.scope.organizationId+'&project_id=eq.'+r.scope.projectId,{token});assert.equal(x.status,200);return x.body;}
async function calc(r,token,body){return api(r,'/functions/v1/recalculate-project',{method:'POST',token,body});}

test('same scoped request returns original result IDs without another version or audit',async()=>{
 const r=await createProductRuntime({port:0});try{
  const token=await login(r);await activity(r,token);const body=input(r);
  const first=await calc(r,token,body);assert.equal(first.status,200,JSON.stringify(first.body));
  const before=await rows(r,token,'calculation_results'),audit=await rows(r,service,'audit_logs');
  const replay=await calc(r,token,body);assert.equal(replay.status,200,JSON.stringify(replay.body));
  const after=await rows(r,token,'calculation_results');assert.equal(after.length,1,'same request must not allocate another calc_version');
  assert.deepEqual(after,before);assert.deepEqual(await rows(r,service,'audit_logs'),audit);
  assert.equal(replay.body.data.replayed,true);assert.equal(replay.body.data.input_matches_current,true);assert.equal(replay.body.data.results_are_latest,true);assert.equal(replay.body.data.operation_status,'completed');assert.deepEqual(replay.body.data.calculation_result_ids,before.map(x=>x.id));
 }finally{await r.close();}
});

test('commit response loss is read-only recoverable; absent and prepared requests never claim zero success',async()=>{
 const r=await createProductRuntime({port:0});try{
  const token=await login(r);await activity(r,token);const body=input(r);
  const absent=await calc(r,token,{...body,action:'lookup'});assert.equal(absent.body.data.operation_status,'not_found');assert.equal(absent.body.data.processed_activities,null);assert.deepEqual(absent.body.data.calculation_result_ids,[]);
  await r.failNext({path:'/rest/v1/rpc/commit_recalculation_v2'});
  const failed=await calc(r,token,body);assert.equal(failed.body.success,false);assert.equal((await rows(r,token,'calculation_results')).length,0);
  const pending=await calc(r,token,{...body,action:'lookup'});assert.equal(pending.body.data.operation_status,'pending');assert.equal(pending.body.data.calculated_count,null);
  await r.failNext({path:'/rest/v1/rpc/commit_recalculation_v2',phase:'afterCommit'});
  const lost=await calc(r,token,body);assert.equal(lost.body.success,false);
  const saved=await rows(r,token,'calculation_results'),audit=await rows(r,service,'audit_logs');assert.equal(saved.length,1);
  const lookup=await calc(r,token,{...body,action:'lookup'});assert.equal(lookup.body.data.operation_status,'completed');assert.deepEqual(lookup.body.data.calculation_result_ids,saved.map(x=>x.id));
  const replay=await calc(r,token,body);assert.equal(replay.body.data.replayed,true);assert.deepEqual(await rows(r,token,'calculation_results'),saved);assert.deepEqual(await rows(r,service,'audit_logs'),audit);
 }finally{await r.close();}
});

test('changed quantity or factor invalidates same request; lookup preserves historical IDs without current success',async()=>{
 for(const change of ['quantity','factor']){const r=await createProductRuntime({port:0});try{
  const token=await login(r),a=await activity(r,token),body=input(r);assert.equal((await calc(r,token,body)).status,200);
  const before=await rows(r,token,'calculation_results');
  const patch=change==='quantity'?await api(r,'/rest/v1/emission_activities?id=eq.'+a.id,{method:'PATCH',token,body:{quantity:101}}):await api(r,'/rest/v1/emission_factors?id=eq.'+r.scope.factorId,{method:'PATCH',token:service,body:{co2e_kg_per_unit:0.6}});
  assert.equal(patch.status,204,JSON.stringify(patch.body));
  const conflict=await calc(r,token,body);assert.equal(conflict.status,409,JSON.stringify(conflict.body));assert.equal(conflict.body.error.code,'RECALCULATION_INPUT_CHANGED');
  const historical=await calc(r,token,{...body,action:'lookup'});assert.equal(historical.body.data.operation_status,'historical');assert.equal(historical.body.data.input_matches_current,false);assert.equal(historical.body.data.results_are_latest,true);assert.deepEqual(historical.body.data.calculation_result_ids,before.map(x=>x.id));
  assert.deepEqual(await rows(r,token,'calculation_results'),before);
 }finally{await r.close();}}
});

test('new request allocates next version; old same-input IDs are historical, including empty projects',async()=>{
 for(const empty of [false,true]){const r=await createProductRuntime({port:0});try{
  const token=await login(r);if(!empty)await activity(r,token);const first=input(r),second=input(r);
  assert.equal((await calc(r,token,first)).status,200);assert.equal((await calc(r,token,second)).status,200);
  const history=await calc(r,token,{...first,action:'lookup'});assert.equal(history.body.data.input_matches_current,true);assert.equal(history.body.data.results_are_latest,false);assert.equal(history.body.data.operation_status,'historical');
  const retry=await calc(r,token,first);assert.equal(retry.status,409);assert.equal(retry.body.error.code,'RECALCULATION_RESULT_SUPERSEDED');
  const current=await calc(r,token,{...second,action:'lookup'});assert.equal(current.body.data.results_are_latest,true);
  const saved=await rows(r,token,'calculation_results');assert.equal(saved.length,empty?0:2);if(!empty)assert.deepEqual(saved.map(x=>x.calc_version).sort(),[1,2]);
 }finally{await r.close();}}
});

test('force, formula and actual actor are bound; missing request, ordinary role and cross-tenant calls fail closed',async()=>{
 const r=await createProductRuntime({port:0});try{
  const owner=await login(r),viewer=await login(r,'viewer'),outsider=await login(r,'outsider');await activity(r,owner);const body=input(r);
  assert.equal((await calc(r,owner,{...body,actor_user_id:r.scope.outsiderId})).status,200);
  for(const extra of [{force_recalculate:false},{formula_version:'v2'}])for(const action of ['calculate','lookup'])assert.equal((await calc(r,owner,{...body,...extra,action})).status,409);
  assert.equal((await calc(r,owner,input(r,{formula_version:'v2'}))).status,400);
  assert.equal((await calc(r,owner,input(r,{request_id:undefined}))).status,400);
  for(const token of [viewer,outsider])assert.equal((await calc(r,token,body)).status,403);
  assert.equal((await calc(r,owner,input(r,{organization_id:r.scope.otherOrganizationId,project_id:r.scope.otherProjectId}))).status,403);
  await api(r,'/rest/v1/organization_members?organization_id=eq.'+r.scope.organizationId+'&user_id=eq.'+r.scope.viewerId,{method:'PATCH',token:service,body:{role:'editor'}});
  const actor=await calc(r,viewer,body);assert.equal(actor.status,409);assert.equal(actor.body.error.code,'RECALCULATION_REQUEST_INTENT_CONFLICT');
  const scoped={p_organization_id:body.organization_id,p_project_id:body.project_id,p_actor_user_id:r.scope.userId,p_request_id:body.request_id,p_force_recalculate:true,p_formula_version:'v1.0.0',p_action:'lookup'};
  const direct=await api(r,'/rest/v1/rpc/recalculation_request_v2',{method:'POST',token:owner,body:scoped});assert.equal(direct.body.code,'42501');
  await api(r,'/rest/v1/organization_members?organization_id=eq.'+r.scope.organizationId+'&user_id=eq.'+r.scope.userId,{method:'PATCH',token:service,body:{status:'inactive'}});
  assert.equal((await calc(r,owner,{...body,action:'lookup'})).status,403);
  assert.equal((await rows(r,service,'calculation_results')).length,1);
 }finally{await r.close();}
});

test('capability is scoped and latest subscription disables calculate and lookup without new results',async()=>{
 const r=await createProductRuntime({port:0});try{
  const token=await login(r),viewer=await login(r,'viewer');await activity(r,token);
  const body={p_project_id:r.scope.projectId};
  const ready=await api(r,'/rest/v1/rpc/recalculation_contract',{method:'POST',token,body});assert.equal(ready.body[0].contract_version,'20261106.recalc.1');assert.equal(ready.body[0].can_recalculate,true);
  const noWrite=await api(r,'/rest/v1/rpc/recalculation_contract',{method:'POST',token:viewer,body});assert.equal(noWrite.body[0].can_recalculate,false);
  const cross=await api(r,'/rest/v1/rpc/recalculation_contract',{method:'POST',token:viewer,body:{p_project_id:r.scope.otherProjectId}});assert.deepEqual(cross.body,[]);
  await api(r,'/rest/v1/subscriptions',{method:'POST',token:service,body:{organization_id:r.scope.organizationId,plan_code:'SYNTHETIC-LATEST',status:'readonly',period_start:'2020-01-01',period_end:'2100-01-01'}});
  const disabled=await api(r,'/rest/v1/rpc/recalculation_contract',{method:'POST',token,body});assert.equal(disabled.body[0].can_recalculate,false);
  const operation=input(r);for(const action of ['calculate','lookup'])assert.equal((await calc(r,token,{...operation,action})).status,403);
  assert.equal((await rows(r,service,'calculation_results')).length,0);
 }finally{await r.close();}
});

test('mutated saved calculation content cannot be presented as current merely because its ID remains latest',async()=>{
 const r=await createProductRuntime({port:0});try{
  const token=await login(r);await activity(r,token);const body=input(r);const first=await calc(r,token,body);assert.equal(first.status,200);
  const id=first.body.data.calculation_result_ids[0];
  const mutated=await api(r,'/rest/v1/calculation_results?id=eq.'+id,{method:'PATCH',token,body:{co2e_kg:999}});assert.equal(mutated.status,204,JSON.stringify(mutated.body));
  const history=await calc(r,token,{...body,action:'lookup'});assert.equal(history.body.data.input_matches_current,true);assert.equal(history.body.data.results_are_latest,false);assert.equal(history.body.data.operation_status,'historical');assert.deepEqual(history.body.data.calculation_result_ids,[id]);
  const retry=await calc(r,token,body);assert.equal(retry.status,409);assert.equal(retry.body.error.code,'RECALCULATION_RESULT_SUPERSEDED');assert.equal((await rows(r,token,'calculation_results')).length,1);
 }finally{await r.close();}
});

test('installed SDK frontend service accepts real prepared pending lookup, then retries the same durable request',async()=>{
 const r=await createProductRuntime({port:0});
 const client=createClient(r.baseUrl,r.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 try{
  const signed=await client.auth.signInWithPassword(r.accounts.owner);assert.equal(signed.error,null);
  await activity(r,signed.data.session.access_token);const scope={organizationId:r.scope.organizationId,projectId:r.scope.projectId},id=randomUUID();
  await r.failNext({path:'/rest/v1/rpc/commit_recalculation_v2'});
  await assert.rejects(calculateManualProject(client,scope,r.scope.userId,id));
  const pending=await lookupManualCalculation(client,scope,r.scope.userId,id);
  assert.equal(pending.operation_status,'pending');assert.equal(pending.input_matches_current,true);assert.equal(pending.results_are_latest,false);assert.equal(pending.processed_activities,null);assert.deepEqual(pending.calculation_result_ids,[]);
  const completed=await calculateManualProject(client,scope,r.scope.userId,id);assert.equal(completed.operation_status,'completed');assert.equal(completed.calculated_count,1);
  const recovered=await lookupManualCalculation(client,scope,r.scope.userId,id);assert.deepEqual(recovered.calculation_result_ids,completed.calculation_result_ids);assert.equal((await rows(r,signed.data.session.access_token,'calculation_results')).length,1);
 }finally{await client.auth.stopAutoRefresh();await r.close();}
});
