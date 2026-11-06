import test from 'node:test';
import assert from 'node:assert/strict';
import {manualPayload} from '../src/services/manualWorkflow.ts';
import {activityReference,manualReferenceKey,clearManualReference,saveReportReference,reportReference} from '../src/services/manualRecovery.ts';
const O='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222',U='33333333-3333-4333-8333-333333333333',ID='44444444-4444-4444-8444-444444444444';
const scope={organizationId:O,projectId:P},project={id:P,organization_id:O,name:'SYNTHETIC',project_code:'SYNTHETIC',reporting_start_date:'2026-01-01',reporting_end_date:'2026-12-31'};
const input={activity_name:'SYNTHETIC manually entered electricity',category:'energy',activity_type:'electricity',final_scope:'2',quantity:'100',unit:'kWh',activity_date:'2026-01-15',notes:'SYNTHETIC test; manually confirmed',inclusion_status:'included',exclusion_reason:''};
test('manual product payload preserves explicit input, scope, actor and stable UUID without test factor/default zero',()=>{const value=manualPayload(input,scope,U,ID,project);assert.equal(value.quantity,100);assert.equal(value.unit,'kWh');assert.equal(value.activity_type,'electricity');assert.equal(value.final_scope,2);assert.equal(value.inclusion_status,'included');assert.equal(value.id,ID);assert.equal(value.activity_code,'MANUAL-'+ID);assert.equal(value.organization_id,O);assert.equal(value.created_by_user_id,U);assert.equal('factor_id' in value,false);assert.equal('co2e_kg' in value,false);assert.equal(manualPayload({...input,quantity:'0'},scope,U,ID,project).quantity,0);});
test('missing or invalid quantities, unit/type, period, inclusion/scope and excluded reason do not become valid input',()=>{
 for(const patch of [{quantity:''},{quantity:' '},{quantity:'NaN'},{quantity:'Infinity'},{quantity:'-1'},{unit:''},{activity_type:''},{activity_date:'2026-02-30'},{activity_date:'2027-01-01'},{final_scope:''},{final_scope:'4'},{inclusion_status:'include'},{inclusion_status:'excluded',exclusion_reason:''}])assert.throws(()=>manualPayload({...input,...patch},scope,U,ID,project),JSON.stringify(patch));
 assert.equal(manualPayload({...input,inclusion_status:'pending',final_scope:''},scope,U,ID,project).final_scope,null);
 assert.equal(manualPayload({...input,inclusion_status:'excluded',exclusion_reason:'manual boundary decision'},scope,U,ID,project).exclusion_reason,'manual boundary decision');
});
test('local recovery references bind product/user/organization/project and cannot clear a newer attempt',()=>{
 const map=new Map<string,string>(),store={getItem:k=>map.get(k)??null,setItem:(k,v)=>{map.set(k,v);},removeItem:k=>{map.delete(k);}};
 const first=activityReference(store,scope,U);assert.equal(activityReference(store,scope,U),first);
 assert.notEqual(activityReference(store,{...scope,projectId:ID},U),first);
 assert.notEqual(activityReference(store,scope,ID),first);
 clearManualReference(store,scope,U,'activity',ID);assert.equal(activityReference(store,scope,U),first);
 clearManualReference(store,scope,U,'activity',first);assert.notEqual(activityReference(store,scope,U),first);
 saveReportReference(store,scope,U,{requestId:ID,version:1});assert.deepEqual(reportReference(store,scope,U),{requestId:ID,version:1});
 clearManualReference(store,scope,U,'report',first);assert.ok(reportReference(store,scope,U));clearManualReference(store,scope,U,'report',ID);assert.equal(reportReference(store,scope,U),null);
 map.set(manualReferenceKey(scope,U,'report'),'broken');assert.throws(()=>reportReference(store,scope,U));
});
