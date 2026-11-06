// SYNTHETIC LOCAL PRODUCT INTEGRATION ONLY: real handlers/SQL, substituted HTTP/Auth.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createProductRuntime } from '../../tools/product-preview/runtime.js';
import {saveManualActivity,readManualActivities,calculateManualProject,nextManualReport,saveManualReport} from '../../../frontend/readdy-app/src/services/manualWorkflow.ts';
const require=createRequire(new URL('../../../frontend/readdy-app/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');

async function api(runtime, path, {token, method='GET', body, headers={}}={}) {
  const response=await fetch(runtime.baseUrl+path,{method,headers:{apikey:runtime.publicKey,...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await response.text();return {status:response.status,body:text?JSON.parse(text):null,headers:response.headers};
}
async function login(runtime,name='owner') {
  const response=await api(runtime,'/auth/v1/token?grant_type=password',{method:'POST',body:runtime.accounts[name]});
  assert.equal(response.status,200,JSON.stringify(response.body));return response.body.access_token;
}
function manual(runtime,overrides={}) {
  return {organization_id:runtime.scope.organizationId,project_id:runtime.scope.projectId,activity_code:'SYNTHETIC-'+randomUUID(),activity_name:'SYNTHETIC manually entered electricity',activity_date:'2026-01-15',quantity:100,unit:'kWh',category:'energy',subcategory:'purchased_electricity',activity_type:'electricity',final_scope:2,inclusion_status:'included',status:'active',created_by_user_id:runtime.scope.userId,source_document_id:null,source_draft_id:null,env:'staging',is_test:true,...overrides};
}
async function insertActivity(runtime,token,overrides={}) {
  const response=await api(runtime,'/rest/v1/emission_activities',{method:'POST',token,body:manual(runtime,overrides),headers:{Prefer:'return=representation'}});
  assert.equal(response.status,201,JSON.stringify(response.body));assert.equal(response.body.length,1);return response.body[0];
}
function operation(runtime,overrides={}) {return {organization_id:runtime.scope.organizationId,project_id:runtime.scope.projectId,actor_user_id:runtime.scope.userId,force_recalculate:true,request_id:randomUUID(),...overrides};}
function reportInput(runtime,overrides={}) {return {organization_id:runtime.scope.organizationId,project_id:runtime.scope.projectId,report_version:1,claim_purpose:'internal_management',request_id:randomUUID(),...overrides};}
async function rows(runtime,token,table) {
  const result=await api(runtime,'/rest/v1/'+table+'?organization_id=eq.'+runtime.scope.organizationId+'&project_id=eq.'+runtime.scope.projectId,{token});
  assert.equal(result.status,200,JSON.stringify(result.body));return result.body;
}
async function calculate(runtime,token,input=operation(runtime)) {
  const response=await api(runtime,'/functions/v1/recalculate-project',{method:'POST',token,body:input});
  assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.success,true);return response;
}

test('product HTTP: normal manual INSERT -> checked-in recalculate handler -> report V2 -> saved readback (100kWh/50kg/0.05t)',async()=>{
  const runtime=await createProductRuntime({port:0});
  try {
    const token=await login(runtime),activity=await insertActivity(runtime,token);
    assert.equal(activity.quantity,100);assert.equal(activity.unit,'kWh');assert.equal(activity.source_draft_id,null);
    const readback=await rows(runtime,token,'emission_activities');assert.equal(readback[0].id,activity.id);
    await calculate(runtime,token);
    const calculations=await rows(runtime,token,'calculation_results');
    assert.equal(calculations.length,1);assert.equal(calculations[0].status,'calculated');assert.equal(calculations[0].is_latest,true);assert.equal(calculations[0].co2e_kg,50);
    const input=reportInput(runtime),response=await api(runtime,'/functions/v1/generate-report',{method:'POST',token,body:input});
    assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.success,true);
    const reports=await rows(runtime,token,'report_generations');assert.equal(reports.length,1);assert.equal(reports[0].id,response.body.data.report_generation_id);
    assert.equal(reports[0].status,'completed');assert.equal(reports[0].gross_emissions_snapshot.gross_total_co2e_kg,50);assert.equal(reports[0].gross_emissions_snapshot.gross_total_co2e_kg/1000,0.05);
    assert.equal(reports[0].claim_results.gross_co2e_kg,50);assert.equal(reports[0].claim_results.claim_net_co2e_kg,50);
    assert.equal(reports[0].payload.appendix_mappings[0].emission_activity_id,activity.id);
    const retry=await api(runtime,'/functions/v1/generate-report',{method:'POST',token,body:input});
    assert.equal(retry.status,200,JSON.stringify(retry.body));assert.equal(retry.body.data.report_generation_id,reports[0].id);assert.equal((await rows(runtime,token,'report_generations')).length,1);
  } finally {await runtime.close();}
});

test('product HTTP: no calculation and pending_factor never become completed zero reports',async()=>{
  const runtime=await createProductRuntime({port:0,withFactor:false});
  try {
    const token=await login(runtime);await insertActivity(runtime,token);
    const notCalculated=await api(runtime,'/functions/v1/generate-report',{method:'POST',token,body:reportInput(runtime)});
    assert.equal(notCalculated.body.success,false);assert.equal((await rows(runtime,token,'report_generations')).length,0);
    const result=await calculate(runtime,token);assert.equal(result.body.data.pending_factor_count,1);
    const calculations=await rows(runtime,token,'calculation_results');assert.equal(calculations[0].status,'pending_factor');assert.equal(calculations[0].co2e_kg,null);
    const pending=await api(runtime,'/functions/v1/generate-report',{method:'POST',token,body:reportInput(runtime)});
    assert.equal(pending.body.success,false);assert.equal((await rows(runtime,token,'report_generations')).length,0);
  } finally {await runtime.close();}
});

test('product HTTP: actual handler roles/auth and SQL RLS/atomic RPC ACL remain effective across A/B',async()=>{
  const runtime=await createProductRuntime({port:0});
  try {
    const owner=await login(runtime),viewer=await login(runtime,'viewer'),outsider=await login(runtime,'outsider');await insertActivity(runtime,owner);
    for(const token of [undefined,'not-a-valid-synthetic-session']) {
      const result=await api(runtime,'/functions/v1/recalculate-project',{method:'POST',token,body:operation(runtime)});assert.equal(result.status,401);
    }
    for(const [token,organization_id,project_id]of [[viewer,runtime.scope.organizationId,runtime.scope.projectId],[owner,runtime.scope.otherOrganizationId,runtime.scope.otherProjectId],[outsider,runtime.scope.organizationId,runtime.scope.projectId]]) {
      for(const [handler,body]of [['recalculate-project',operation(runtime,{organization_id,project_id})],['generate-report',reportInput(runtime,{organization_id,project_id})]]) {
        const result=await api(runtime,'/functions/v1/'+handler,{method:'POST',token,body});assert.equal(result.status,403,JSON.stringify(result.body));
      }
    }
    assert.deepEqual(await rows(runtime,outsider,'emission_activities'),[]);
    const forbiddenInsert=await api(runtime,'/rest/v1/emission_activities',{method:'POST',token:viewer,body:manual(runtime)});assert.equal(forbiddenInsert.body.code,'42501');
    const direct=await api(runtime,'/rest/v1/rpc/recalculate_project_atomic',{method:'POST',token:owner,body:{p_organization_id:runtime.scope.organizationId,p_project_id:runtime.scope.projectId,p_actor_user_id:runtime.scope.userId,p_calculation_results:[],p_request_id:'SYNTHETIC-DIRECT'}});
    assert.equal(direct.body.code,'42501');assert.equal((await rows(runtime,owner,'calculation_results')).length,0);
    await calculate(runtime,owner,operation(runtime,{actor_user_id:runtime.scope.outsiderId}));
    const results=await rows(runtime,owner,'calculation_results');assert.equal(results.length,1);
  } finally {await runtime.close();}
});

test('product HTTP: real RPC failure retries and committed report lost-response reconcile without second report',async()=>{
  const runtime=await createProductRuntime({port:0});
  try {
    const token=await login(runtime);await insertActivity(runtime,token);
    await runtime.failNext({path:'/rest/v1/rpc/recalculate_project_atomic'});
    const failed=await api(runtime,'/functions/v1/recalculate-project',{method:'POST',token,body:operation(runtime)});
    assert.equal(failed.body.success,false);assert.equal((await rows(runtime,token,'calculation_results')).length,0);
    await calculate(runtime,token);
    await runtime.failNext({path:'/rest/v1/rpc/generate_report_snapshot_atomic_v2'});
    const input=reportInput(runtime),failedReport=await api(runtime,'/functions/v1/generate-report',{method:'POST',token,body:input});
    assert.equal(failedReport.body.success,false);assert.equal((await rows(runtime,token,'report_generations')).length,0);
    await runtime.failNext({path:'/rest/v1/rpc/generate_report_snapshot_atomic_v2',phase:'afterCommit'});
    const lost=await api(runtime,'/functions/v1/generate-report',{method:'POST',token,body:input});assert.equal(lost.body.success,false);
    const saved=await rows(runtime,token,'report_generations');assert.equal(saved.length,1);assert.equal(saved[0].gross_emissions_snapshot.gross_total_co2e_kg,50);
    const retry=await api(runtime,'/functions/v1/generate-report',{method:'POST',token,body:input});assert.equal(retry.status,200,JSON.stringify(retry.body));assert.equal(retry.body.data.report_generation_id,saved[0].id);assert.equal((await rows(runtime,token,'report_generations')).length,1);
  } finally {await runtime.close();}
});

test('product frontend services use installed SDK/real HTTP: save/read/calculate/report, activity response-loss and scope invalidation',async()=>{
  const runtime=await createProductRuntime({port:0});
  const client=createClient(runtime.baseUrl,runtime.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  try {
    const signed=await client.auth.signInWithPassword(runtime.accounts.owner);assert.equal(signed.error,null);
    const scope={organizationId:runtime.scope.organizationId,projectId:runtime.scope.projectId},userId=runtime.scope.userId,id=randomUUID();
    const input={activity_name:'SYNTHETIC manual UI service electricity',category:'energy',activity_type:'electricity',final_scope:'2',quantity:'100',unit:'kWh',activity_date:'2026-01-15',notes:'SYNTHETIC ONLY',inclusion_status:'included',exclusion_reason:''};
    await runtime.failNext({path:'/rest/v1/emission_activities',phase:'afterCommit'});
    const activity=await saveManualActivity(client,scope,userId,id,input);assert.equal(activity.id,id);
    const retry=await saveManualActivity(client,scope,userId,id,input);assert.equal(retry.id,id);
    await assert.rejects(saveManualActivity(client,scope,userId,id,{...input,quantity:'101'}),/不同/);
    const list=await readManualActivities(client,scope,userId);assert.equal(list.length,1);assert.equal(list[0].quantity,100);
    let active=true,posted=0;
    const switching=createClient(runtime.baseUrl,runtime.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:'Bearer '+signed.data.session.access_token},fetch:async(url,init)=>{if((init?.method||'GET')==='POST')posted++;const response=await fetch(url,init);if(String(url).includes('/rest/v1/projects'))active=false;return response;}}});
    await assert.rejects(saveManualActivity(switching,scope,userId,randomUUID(),input,()=>active),/切換/);assert.equal(posted,0);
    const calculation=await calculateManualProject(client,scope,userId,randomUUID());assert.equal(calculation.calculated_count,1);
    const attempt=await nextManualReport(client,scope,userId);assert.equal(attempt.version,1);
    await runtime.failNext({path:'/rest/v1/rpc/generate_report_snapshot_atomic_v2',phase:'afterCommit'});
    await assert.rejects(saveManualReport(client,scope,userId,attempt));
    const report=await saveManualReport(client,scope,userId,attempt);assert.equal(report.gross_emissions_snapshot.gross_total_co2e_kg,50);
    const token=signed.data.session.access_token;assert.equal((await rows(runtime,token,'emission_activities')).length,1);assert.equal((await rows(runtime,token,'report_generations')).length,1);
    const config=await api(runtime,'/__synthetic/config');assert.equal(config.body.synthetic,true);assert.equal(config.body.scope.otherOwnerId,runtime.scope.otherOwnerId);assert.equal('serviceKey' in config.body,false);
    const enforcement=await client.functions.invoke('enforce-subscription-status',{body:{organization_id:scope.organizationId}});assert.equal(enforcement.error,null);assert.equal(enforcement.data.data.can_write_formal_data,true);
    const unknown=await api(runtime,'/functions/v1/not-a-real-handler',{method:'POST',token,body:{}});assert.equal(unknown.status,404);
  } finally {await client.auth.stopAutoRefresh();await runtime.close();}
});

test('product frontend services: B-only owner and shared A-owner/B-viewer maintain separate real saved scopes',async()=>{
  const runtime=await createProductRuntime({port:0});
  const clients=['owner','otherOwner'].map(()=>createClient(runtime.baseUrl,runtime.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
  try {
    const [shared,bOwner]=clients;assert.equal((await shared.auth.signInWithPassword(runtime.accounts.owner)).error,null);assert.equal((await bOwner.auth.signInWithPassword(runtime.accounts.otherOwner)).error,null);
    const a={organizationId:runtime.scope.organizationId,projectId:runtime.scope.projectId},b={organizationId:runtime.scope.otherOrganizationId,projectId:runtime.scope.otherProjectId};
    const input={activity_name:'SYNTHETIC B only electricity',category:'energy',activity_type:'electricity',final_scope:'2',quantity:'20',unit:'kWh',activity_date:'2026-01-15',notes:'SYNTHETIC ONLY',inclusion_status:'included',exclusion_reason:''};
    const activity=await saveManualActivity(bOwner,b,runtime.scope.otherOwnerId,randomUUID(),input);assert.equal(activity.organization_id,b.organizationId);assert.equal(activity.project_id,b.projectId);
    assert.equal((await readManualActivities(shared,b,runtime.scope.userId)).length,1);
    assert.equal((await readManualActivities(shared,a,runtime.scope.userId)).length,0);
    await assert.rejects(saveManualActivity(shared,b,runtime.scope.userId,randomUUID(),input),/角色/);
    await assert.rejects(calculateManualProject(shared,b,runtime.scope.userId,randomUUID()),/角色/);
    await assert.rejects(readManualActivities(bOwner,a,runtime.scope.otherOwnerId),/不存在/);
    const calculated=await calculateManualProject(bOwner,b,runtime.scope.otherOwnerId,randomUUID());assert.equal(calculated.calculated_count,1);
    const report=await saveManualReport(bOwner,b,runtime.scope.otherOwnerId,await nextManualReport(bOwner,b,runtime.scope.otherOwnerId));assert.equal(report.gross_emissions_snapshot.gross_total_co2e_kg,10);
    assert.equal(report.organization_id,b.organizationId);assert.equal(report.project_id,b.projectId);
  } finally {for(const client of clients)await client.auth.stopAutoRefresh();await runtime.close();}
});

test('saved report response-loss retry returns immutable snapshot before new uncalculated activity gate; changed intent is denied',async()=>{
  const runtime=await createProductRuntime({port:0});
  try {
    const token=await login(runtime);await insertActivity(runtime,token);await calculate(runtime,token);
    const input=reportInput(runtime);
    await runtime.failNext({path:'/rest/v1/rpc/generate_report_snapshot_atomic_v2',phase:'afterCommit'});
    const lost=await api(runtime,'/functions/v1/generate-report',{method:'POST',token,body:input});assert.equal(lost.body.success,false);
    const saved=(await rows(runtime,token,'report_generations'))[0];assert.ok(saved);
    await insertActivity(runtime,token,{quantity:200});
    const retry=await api(runtime,'/functions/v1/generate-report',{method:'POST',token,body:input});
    assert.equal(retry.status,200,JSON.stringify(retry.body));assert.equal(retry.body.data.report_generation_id,saved.id);
    assert.deepEqual(retry.body.data.payload,saved.payload);assert.deepEqual(retry.body.data.gross_emissions_snapshot,saved.gross_emissions_snapshot);assert.deepEqual(retry.body.data.claim_results,saved.claim_results);
    assert.equal((await rows(runtime,token,'report_generations')).length,1);
    for(const override of [{report_version:2},{claim_purpose:'voluntary_claim'}]){
      const conflict=await api(runtime,'/functions/v1/generate-report',{method:'POST',token,body:{...input,...override}});assert.ok([400,409].includes(conflict.status),JSON.stringify(conflict.body));assert.equal(conflict.body.success,false);assert.match(JSON.stringify(conflict.body.error),/report_request_intent_conflict/);
    }
    // Local fixture-only service role: make the second synthetic actor an actual
    // writer, so the next denial proves immutable actor intent, not viewer gating.
    const service='SYNTHETIC-PRODUCT-SERVICE-KEY';
    const promoted=await api(runtime,'/rest/v1/organization_members?organization_id=eq.'+runtime.scope.organizationId+'&user_id=eq.'+runtime.scope.viewerId,{method:'PATCH',token:service,body:{role:'editor'}});assert.equal(promoted.status,204);
    const secondActor=await login(runtime,'viewer');
    const actorConflict=await api(runtime,'/functions/v1/generate-report',{method:'POST',token:secondActor,body:input});assert.ok([400,409].includes(actorConflict.status),JSON.stringify(actorConflict.body));assert.equal(actorConflict.body.success,false);assert.match(JSON.stringify(actorConflict.body.error),/report_request_intent_conflict/);
    const directLookup=await api(runtime,'/rest/v1/rpc/report_snapshot_request_v2',{method:'POST',token,body:{p_organization_id:runtime.scope.organizationId,p_project_id:runtime.scope.projectId,p_actor_user_id:runtime.scope.userId,p_request_id:input.request_id,p_report_version:1,p_claim_purpose:input.claim_purpose}});assert.equal(directLookup.body.code,'42501');
    const fresh=await api(runtime,'/functions/v1/generate-report',{method:'POST',token,body:reportInput(runtime,{report_version:2})});assert.equal(fresh.body.success,false);assert.equal((await rows(runtime,token,'report_generations')).length,1);
  } finally {await runtime.close();}
});

test('report V2 snapshot-update SQL failure rolls back prior report INSERT and audit; same valid intent can retry',async()=>{
  const runtime=await createProductRuntime({port:0});
  try {
    const token=await login(runtime);await insertActivity(runtime,token);await calculate(runtime,token);
    const first=await api(runtime,'/functions/v1/generate-report',{method:'POST',token,body:reportInput(runtime)});assert.equal(first.status,200,JSON.stringify(first.body));
    const saved=(await rows(runtime,token,'report_generations'))[0],service='SYNTHETIC-PRODUCT-SERVICE-KEY';
    const beforeAudit=await rows(runtime,service,'audit_logs');
    const snapshot={claim_purpose:'NOT_A_VALID_CLAIM_PURPOSE',gross_emissions_snapshot:saved.gross_emissions_snapshot,adjustment_summary:saved.adjustment_summary,claim_results:saved.claim_results,adjustment_manifest:saved.adjustment_manifest};
    const body={p_organization_id:runtime.scope.organizationId,p_project_id:runtime.scope.projectId,p_generated_by_user_id:runtime.scope.userId,p_report_version:2,p_payload:saved.payload,p_payload_hash:saved.payload_hash,p_reporting_period_start:saved.reporting_period_start,p_reporting_period_end:saved.reporting_period_end,p_included_activity_count:saved.included_activity_count,p_excluded_activity_count:saved.excluded_activity_count,p_pending_activity_count:saved.pending_activity_count,p_scope_totals:saved.scope_totals,p_category_totals:saved.category_totals,p_factor_sources:saved.factor_sources,p_warning_count:saved.warning_count,p_based_on_calculated_at:saved.based_on_calculated_at,p_request_id:randomUUID(),p_snapshot:snapshot};
    // The invalid enum is cast in the snapshot UPDATE after v1 inserts report+
    // audit inside V2. This is a real database error, not a before-RPC HTTP fault.
    const failed=await api(runtime,'/rest/v1/rpc/generate_report_snapshot_atomic_v2',{method:'POST',token:service,body});assert.equal(failed.body.code,'22P02');
    assert.deepEqual(await rows(runtime,token,'report_generations'),[saved]);assert.deepEqual(await rows(runtime,service,'audit_logs'),beforeAudit);
    const retry=await api(runtime,'/rest/v1/rpc/generate_report_snapshot_atomic_v2',{method:'POST',token:service,body:{...body,p_snapshot:{...snapshot,claim_purpose:'internal_management'}}});assert.equal(retry.status,200,JSON.stringify(retry.body));
    const reports=await rows(runtime,token,'report_generations');assert.equal(reports.length,2);assert.equal(reports.find(row=>row.report_version===2).gross_emissions_snapshot.gross_total_co2e_kg,50);
    assert.equal((await rows(runtime,service,'audit_logs')).length,beforeAudit.length+2);
  } finally {await runtime.close();}
});
