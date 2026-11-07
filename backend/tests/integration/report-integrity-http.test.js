// Actual handlers and installed SDK/HTTP against a synthetic local SQL/Auth adapter.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createProductRuntime} from '../../tools/product-preview/runtime.js';
async function api(r,path,token,body,method='POST'){const response=await fetch(r.baseUrl+path,{method,headers:{apikey:r.publicKey,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json().catch(()=>null)};}
async function login(r,name='owner'){const result=await api(r,'/auth/v1/token?grant_type=password',null,r.accounts[name]);assert.equal(result.status,200);return result.body.access_token;}
async function publish(r,token){
 const scope={organization_id:r.scope.organizationId,project_id:r.scope.projectId};
 const activity=await api(r,'/rest/v1/emission_activities',token,{...scope,activity_code:'SYNTHETIC-'+randomUUID(),activity_name:'SYNTHETIC report integrity',activity_date:'2026-01-15',quantity:100,unit:'kWh',category:'energy',activity_type:'electricity',final_scope:2,inclusion_status:'included',status:'active',created_by_user_id:r.scope.userId,env:'staging',is_test:true});assert.equal(activity.status,201);
 const calc=await api(r,'/functions/v1/recalculate-project',token,{...scope,actor_user_id:r.scope.userId,force_recalculate:true,request_id:randomUUID()});assert.equal(calc.status,200,JSON.stringify(calc.body));
 const input={...scope,report_version:1,claim_purpose:'internal_management',request_id:randomUUID()},saved=await api(r,'/functions/v1/generate-report',token,input);assert.equal(saved.status,200,JSON.stringify(saved.body));
 return {input,id:saved.body.data.report_generation_id,saved:saved.body.data};
}
test('ordinary REST cannot forge an exportable completed report without calculations or publisher authority',async()=>{
 const r=await createProductRuntime({port:0});try{
  const token=await login(r),id=randomUUID();
  const forged=await api(r,'/rest/v1/report_generations',token,{id,organization_id:r.scope.organizationId,project_id:r.scope.projectId,generated_by_user_id:r.scope.userId,status:'completed',report_version:1,payload:{appendix_mappings:[],synthetic:'FORGED'},payload_hash:'NOT-A-VALID-CONTENT-HASH',reporting_period_start:'2026-01-01',reporting_period_end:'2026-12-31',gross_emissions_snapshot:{gross_total_co2e_kg:999}});
  assert.equal(forged.body.code,'42501','ordinary completed report INSERT must be denied');
 }finally{await r.close();}
});

test('legacy completed row without private authority is readable but cannot be exported as a verified saved snapshot',async()=>{
 const r=await createProductRuntime({port:0});try{
  const token=await login(r),id=randomUUID(),row={id,organization_id:r.scope.organizationId,project_id:r.scope.projectId,generated_by_user_id:r.scope.userId,status:'completed',report_version:1,payload:{appendix_mappings:[],synthetic:'LEGACY UNVERIFIED'},payload_hash:'NONEMPTY-IS-NOT-AUTHORITY',reporting_period_start:'2026-01-01',reporting_period_end:'2026-12-31'};
  const seeded=await api(r,'/rest/v1/report_generations','SYNTHETIC-PRODUCT-SERVICE-KEY',row);assert.equal(seeded.status,201);
  const read=await api(r,'/rest/v1/report_generations?id=eq.'+id,token,undefined,'GET');assert.equal(read.body[0].integrity_status,'legacy_unverified');
  const exported=await api(r,'/functions/v1/export-report-snapshot',token,{organization_id:row.organization_id,project_id:row.project_id,report_id:id});assert.equal(exported.status,409,JSON.stringify(exported.body));assert.equal(exported.body.error.code,'REPORT_SNAPSHOT_UNVERIFIED');
 }finally{await r.close();}
});

test('normal handler seals a 50kg snapshot; direct REST edits/delete cannot replace persisted contents, and replay/export remain identical',async()=>{
 const r=await createProductRuntime({port:0});try{const token=await login(r),p=await publish(r,token);assert.equal(p.saved.integrity_status,'server_verified');assert.equal(p.saved.gross_emissions_snapshot.gross_total_co2e_kg,50);
  const exportInput={organization_id:p.input.organization_id,project_id:p.input.project_id,report_id:p.id};
  const first=await api(r,'/functions/v1/export-report-snapshot',token,exportInput);assert.equal(first.status,200);assert.equal(first.body.data.snapshot.integrity_status,'server_verified');
  for(const patch of [{payload:{appendix_mappings:[],forged:true}},{gross_emissions_snapshot:{gross_total_co2e_kg:999}},{status:'failed'},{generated_by_user_id:randomUUID()},{report_version:99},{integrity_status:'legacy_unverified'}]){
   const edited=await api(r,'/rest/v1/report_generations?id=eq.'+p.id,token,patch,'PATCH');assert.equal(edited.status,200);assert.deepEqual(edited.body,[]);
  }
  const removed=await api(r,'/rest/v1/report_generations?id=eq.'+p.id,token,undefined,'DELETE');assert.deepEqual(removed.body,[]);
  const replay=await api(r,'/functions/v1/generate-report',token,p.input);assert.equal(replay.status,200);assert.equal(replay.body.data.report_generation_id,p.id);assert.deepEqual(replay.body.data.payload,p.saved.payload);
  const second=await api(r,'/functions/v1/export-report-snapshot',token,exportInput);assert.deepEqual(second.body.data.snapshot,first.body.data.snapshot);
 }finally{await r.close();}
});

test('maintenance tamper or deletion produces explicit 409 in saved export and same-request replay, never a fallback report',async()=>{
 for(const mode of ['tamper','delete']){const r=await createProductRuntime({port:0});try{const token=await login(r),p=await publish(r,token);
  const changed=await api(r,'/rest/v1/report_generations?id=eq.'+p.id,'SYNTHETIC-PRODUCT-SERVICE-KEY',mode==='tamper'?{claim_results:{claim_net_co2e_kg:999}}:undefined,mode==='tamper'?'PATCH':'DELETE');assert.equal(changed.status,200);
  const exported=await api(r,'/functions/v1/export-report-snapshot',token,{organization_id:p.input.organization_id,project_id:p.input.project_id,report_id:p.id});assert.equal(exported.status,409);assert.equal(exported.body.error.code,'REPORT_SNAPSHOT_INTEGRITY_MISMATCH');
  const replay=await api(r,'/functions/v1/generate-report',token,p.input);assert.equal(replay.status,409);assert.equal(replay.body.error.code,'REPORT_SNAPSHOT_INTEGRITY_MISMATCH');
  const rows=await api(r,'/rest/v1/report_generations?project_id=eq.'+p.input.project_id,token,undefined,'GET');assert.equal(rows.body.length,mode==='delete'?0:1);
 }finally{await r.close();}}
});
