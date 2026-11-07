import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { adaptActivityDetail,activityDetailSelection,readActivityDetail,matchingActivityDetailState,formatActivityEmissions } from '../src/services/activityDetail.ts';

// Synthetic data and intercepted SDK transport are test-only; no cloud is contacted.
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const P = '00000000-0000-0000-0000-00000000000c';
const O = '00000000-0000-0000-0000-00000000000d';
const C = '00000000-0000-0000-0000-00000000000e';
const selected = {activityId:A,organizationId:O,projectId:P};
const fixture = () => ({id:A,organization_id:O,project_id:P,activity_code:'TEST-EA-1',activity_name:'Synthetic electricity',
  activity_date:'2026-01-01',category:'electricity',subcategory:null,activity_type:'electricity',quantity:5000,unit:'kWh',
  normalized_quantity:5000,normalized_unit:'kWh',status:'active',inclusion_status:'included',final_scope:2,suggested_scope:1,
  source_document_id:null,source_draft_id:null,review_note:null,exclusion_reason:null,data_quality:'measured',
  project:{id:P,organization_id:O,name:'Synthetic project'},created_at:'2026-01-02T00:00:00Z',updated_at:'2026-01-02T00:00:00Z'});
const calculation = () => ({id:C,organization_id:O,project_id:P,emission_activity_id:A,is_latest:true,status:'calculated',calc_version:2,
  co2e_kg:2545,calculated_at:'2026-01-02T00:00:00Z',formula_version:'v1.0.0',factor_snapshot:{factor_name:'Saved factor',co2e_kg_per_unit:.509,unit:'kWh'},
  input_snapshot:{normalized_quantity:5000,normalized_unit:'kWh'},warnings:[],error_code:null});
const lineage=()=>({organization_id:O,project_id:P,activity_id:A,versions:[{activity_id:A,predecessor_activity_id:null,successor_activity_id:null,version_index:1,is_effective:true,mode:'original',reason:null,actor_user_id:null,created_at:'2026-01-01T00:00:00Z'}]});
function harness(responses: Array<{body:unknown;status?:number}>,versionLineage:unknown=lineage()) {
  const requests: Array<{url:URL;init:RequestInit}> = [];
  const client = createClient('https://sdk-fixture.invalid','fixture-public-key',{
    accessToken:async () => 'fixture-user-token',
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async (url,init) => {
      requests.push({url:new URL(String(url)),init:init ?? {}});
      if(new URL(String(url)).pathname.endsWith('/rpc/activity_version_lineage'))return new Response(JSON.stringify([{result:versionLineage}]),{headers:{'Content-Type':'application/json'}});
      const response = responses.shift();
      if (!response) throw new Error('Unexpected test-only SDK request');
      return new Response(JSON.stringify(response.body),{status:response.status ?? 200,headers:{'Content-Type':'application/json'}});
    }},
  });
  return {client,requests};
}
test('detail route and query aliases resolve exact UUIDs and reject conflicting/malformed scope', () => {
  assert.deepEqual(activityDetailSelection(A.toUpperCase(),`organizationId=${O.toUpperCase()}&project_id=${P}`),selected);
  assert.deepEqual(activityDetailSelection(A,`organizationId=${O}&organization_id=${O}&projectId=${P}`),selected);
  assert.deepEqual(activityDetailSelection(A,''),{activityId:A});
  for (const query of [`organization_id=${O}&organizationId=${B}`,`organization_id=${O}&organization_id=${O}`,'organizationId=',
    `project_id=${P}&projectId=${B}`,'projectId=not-a-uuid']) assert.throws(() => activityDetailSelection(A,query));
  assert.throws(() => activityDetailSelection(undefined,''));
  assert.throws(() => activityDetailSelection('1',''));
});
test('adapter keeps canonical activity/inclusion states and kg/tonnes separate from verification', () => {
  const detail = adaptActivityDetail(fixture(),calculation(),selected);
  assert.equal(detail.activity.status,'active');
  assert.equal(detail.activity.inclusion_status,'included');
  assert.equal(detail.activity.final_scope,2);assert.equal(detail.activity.suggested_scope,1);
  assert.equal(detail.calculation?.status,'calculated');
  assert.equal(detail.calculation?.co2e_kg,2545);assert.equal(detail.calculation?.co2e_tonnes,2.545);
  assert.equal('verified_at' in detail.activity,false);
  assert.equal(formatActivityEmissions(detail.calculation?.co2e_kg),'2545 kgCO₂e / 2.545 tCO₂e');
  assert.deepEqual(detail.calculation?.factor_snapshot,calculation().factor_snapshot);
});
test('valid zero quantity, zero scope emissions and normalized zero remain visible', () => {
  const detail = adaptActivityDetail({...fixture(),quantity:0,normalized_quantity:0},{...calculation(),co2e_kg:0},selected);
  assert.equal(detail.activity.quantity,0);assert.equal(detail.activity.normalized_quantity,0);
  assert.equal(detail.calculation?.co2e_kg,0);assert.equal(detail.calculation?.co2e_tonnes,0);
  assert.equal(formatActivityEmissions(0),'0 kgCO₂e / 0 tCO₂e');
});
test('missing/latest failed or pending calculation never becomes zero or an earlier success', () => {
  assert.equal(adaptActivityDetail(fixture(),null,selected).calculation,null);
  for (const status of ['error','pending_factor','superseded']) {
    const detail = adaptActivityDetail(fixture(),{...calculation(),status,co2e_kg:2545},selected);
    assert.equal(detail.calculation?.status,status);assert.equal(detail.calculation?.co2e_kg,null);assert.equal(detail.calculation?.co2e_tonnes,null);
  }
  for (const value of [null,'2545',-1,NaN,Infinity]) {
    const detail = adaptActivityDetail(fixture(),{...calculation(),co2e_kg:value},selected);
    assert.equal(detail.calculation?.co2e_kg,null);assert.match(formatActivityEmissions(detail.calculation?.co2e_kg),/未知/);
  }
});
test('another activity/project/tenant, non-latest snapshot or mismatched joined project is rejected', () => {
  for (const patch of [{id:B},{organization_id:B},{project_id:B},{project:{id:P,organization_id:B,name:'Other tenant'}}]) {
    assert.throws(() => adaptActivityDetail({...fixture(),...patch},null,selected));
  }
  for (const patch of [{emission_activity_id:B},{organization_id:B},{project_id:B},{is_latest:false},{status:'verified'},{calc_version:0}]) {
    assert.throws(() => adaptActivityDetail(fixture(),{...calculation(),...patch},selected));
  }
  assert.throws(() => adaptActivityDetail({...fixture(),quantity:-1},null,selected));
  assert.throws(() => adaptActivityDetail({...fixture(),status:'verified'},null,selected));
});
test('real Supabase SDK serializes scoped user-JWT reads and only the exact latest calculation', async () => {
  const {client,requests} = harness([{body:[fixture()]},{body:[calculation()]}]);
  const detail = await readActivityDetail(client,{activityId:A.toUpperCase(),organizationId:O.toUpperCase(),projectId:P.toUpperCase()});
  assert.equal(detail?.activity.id,A);assert.equal(detail?.calculation?.co2e_tonnes,2.545);
  assert.equal(requests.length,3);
  const [activity,lineageRequest,calc] = requests;
  assert.equal(activity.url.pathname,'/rest/v1/emission_activities');
  assert.equal(activity.url.searchParams.get('id'),`eq.${A}`);assert.equal(activity.url.searchParams.get('organization_id'),`eq.${O}`);
  assert.equal(activity.url.searchParams.get('project_id'),`eq.${P}`);
  assert.ok(activity.url.searchParams.get('select')?.includes('project:projects(id,organization_id,name)'));
  assert.equal(lineageRequest.url.pathname,'/rest/v1/rpc/activity_version_lineage');
  assert.equal(calc.url.pathname,'/rest/v1/effective_calculation_results');assert.equal(calc.url.searchParams.get('emission_activity_id'),`eq.${A}`);
  assert.equal(calc.url.searchParams.get('organization_id'),`eq.${O}`);assert.equal(calc.url.searchParams.get('project_id'),`eq.${P}`);
  assert.equal(calc.url.searchParams.get('is_latest'),'eq.true');
  for (const request of requests) {
    if(request===lineageRequest){assert.equal(request.init.method,'POST');assert.deepEqual(JSON.parse(String(request.init.body)),{p_organization_id:O,p_project_id:P,p_activity_id:A});}else{assert.equal(request.init.method,'GET');assert.equal(request.init.body,undefined);}
    assert.equal(new Headers(request.init.headers).get('Authorization'),'Bearer fixture-user-token');
    assert.equal(new Headers(request.init.headers).get('apikey'),'fixture-public-key');
  }
});
test('unscoped route still binds calculation to the returned authorized activity scope', async () => {
  const {client,requests} = harness([{body:[fixture()]},{body:[]}]);
  const detail = await readActivityDetail(client,{activityId:A});
  assert.equal(detail?.calculation,null);assert.equal(requests.length,3);
  assert.equal(requests[2].url.searchParams.get('organization_id'),`eq.${O}`);
  assert.equal(requests[2].url.searchParams.get('project_id'),`eq.${P}`);
});
test('empty activity is empty and makes no calculation request', async () => {
  const {client,requests} = harness([{body:[]}]);
  assert.equal(await readActivityDetail(client,selected),null);assert.equal(requests.length,1);
});
test('SDK permission/read failures remain errors, including a failed latest calculation read', async () => {
  const denied = {status:403,body:{code:'42501',message:'Synthetic RLS denial'}};
  const first = harness([denied]);await assert.rejects(readActivityDetail(first.client,selected),/活動資料讀取失敗/);
  assert.equal(first.requests.length,1);
  const second = harness([{body:[fixture()]},denied]);await assert.rejects(readActivityDetail(second.client,selected),/計算快照讀取失敗/);
  const duplicate = harness([{body:[fixture()]},{body:[calculation(),calculation()]}]);
  await assert.rejects(readActivityDetail(duplicate.client,selected),/計算快照讀取失敗/);
});
test('mismatched row and invalid input stop before any unrelated calculation is read', async () => {
  const mismatch = harness([{body:[{...fixture(),organization_id:B}]}]);
  await assert.rejects(readActivityDetail(mismatch.client,selected),/範圍不符/);assert.equal(mismatch.requests.length,1);
  const invalid = harness([]);await assert.rejects(readActivityDetail(invalid.client,{activityId:'bad'}),/識別資料無效/);
  assert.equal(invalid.requests.length,0);
});
test('transport/server and malformed responses cannot masquerade as an empty activity', async () => {
  const failed = harness([{status:500,body:{code:'SYNTHETIC_READ_FAILED',message:'Synthetic backend failure'}}]);
  await assert.rejects(readActivityDetail(failed.client,selected),/活動資料讀取失敗/);
  const malformed = harness([{body:false}]);await assert.rejects(readActivityDetail(malformed.client,selected),/範圍不符/);
  const client = createClient('https://sdk-fixture.invalid','fixture-public-key',{
    accessToken:async () => 'fixture-user-token',auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:async () => {throw new TypeError('Synthetic test-only network failure');}},
  });
  await assert.rejects(readActivityDetail(client,selected),/活動資料讀取失敗/);
});
test('changing activity, scope, session or retry rejects late results before the next effect', () => {
  const key = {activityId:A,scope:O,session:{token:'test-1'},retry:0};
  const old = {key,value:adaptActivityDetail(fixture(),calculation(),selected)};
  assert.equal(matchingActivityDetailState(old,key),old.value);
  for (const next of [{...key,activityId:B},{...key,scope:B},{...key,session:{token:'test-2'}},{...key,retry:1}]) {
    assert.equal(matchingActivityDetailState(old,next),null);
  }
  assert.equal(matchingActivityDetailState(null,key),null);
});
test('retained predecessor detail exposes immutable historical calc separately and never presents it as the effective current result',async()=>{
 const family={...lineage(),versions:[{...lineage().versions[0],successor_activity_id:B,is_effective:false},{activity_id:B,predecessor_activity_id:A,successor_activity_id:null,version_index:2,is_effective:true,mode:'correct',reason:'SYNTHETIC correction',actor_user_id:O,created_at:'2026-02-01T00:00:00Z'}]};
 const {client,requests}=harness([{body:[fixture()]},{body:[calculation()]}],family),detail=await readActivityDetail(client,selected);
 assert.equal(detail.calculation,null);assert.equal(detail.historicalCalculation.co2e_kg,2545);assert.equal(detail.version.successor_activity_id,B);assert.equal(detail.version.is_effective,false);assert.equal(requests[2].url.pathname,'/rest/v1/calculation_results');
 for(const invalid of [null,{...family,organization_id:B},{...family,versions:[]},{...family,versions:[...family.versions,{...family.versions[1]}]}])await assert.rejects(()=>readActivityDetail(harness([{body:[fixture()]}],invalid).client,selected),/版本鏈|版本/);
});
