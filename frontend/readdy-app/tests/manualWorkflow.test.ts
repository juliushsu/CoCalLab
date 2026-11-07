import test from 'node:test';
import assert from 'node:assert/strict';
import {manualPayload,saveManualActivity} from '../src/services/manualWorkflow.ts';
import {activityReference,manualReferenceKey,clearManualReference,saveReportReference,reportReference,activityEditReference,clearActivityEditReference} from '../src/services/manualRecovery.ts';
const O='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222',U='33333333-3333-4333-8333-333333333333',ID='44444444-4444-4444-8444-444444444444';
const scope={organizationId:O,projectId:P},project={id:P,organization_id:O,name:'SYNTHETIC',project_code:'SYNTHETIC',reporting_start_date:'2026-01-01',reporting_end_date:'2026-12-31'};
const input={activity_name:'SYNTHETIC manually entered electricity',category:'energy',activity_type:'electricity',final_scope:'2',quantity:'100',unit:'kWh',activity_date:'2026-01-15',notes:'SYNTHETIC test; manually confirmed',inclusion_status:'included',exclusion_reason:''};
test('controlled manual save sends only editable fields to server, binds result and never writes activity REST',async()=>{
 const calls=[];const expected=manualPayload(input,scope,U,ID,project);
 const client={auth:{getUser:async()=>({data:{user:{id:U}},error:null})},from(table){const result={error:null,data:table==='projects'?project:table==='organization_members'?{organization_id:O,user_id:U,role:'owner',status:'active'}:expected};const chain={select(){return chain},eq(){return chain},maybeSingle:async()=>result,insert(){throw new Error('ordinary REST INSERT is forbidden')},update(){throw new Error('ordinary REST UPDATE is forbidden')}};return chain},functions:{invoke:async(name,options)=>{calls.push([name,options.body]);return {error:null,data:{success:true,data:{activity:expected,replayed:false}}}}}};
 assert.deepEqual(await saveManualActivity(client,scope,U,ID,input),expected);
 assert.equal(calls.length,1);assert.equal(calls[0][0],'save-manual-activity');assert.equal(calls[0][1].request_id,ID);assert.equal(calls[0][1].activity_id,ID);
 assert.deepEqual(Object.keys(calls[0][1].input).sort(),['activity_name','activity_type','category','subcategory','quantity','unit','activity_date','final_scope','data_quality','inclusion_status','exclusion_reason','review_note','status'].sort());
 assert.equal('created_by_user_id' in calls[0][1].input,false);
 client.functions.invoke=async()=>({error:null,data:{success:true,data:{activity:{...expected,project_id:O},replayed:false}}});
 await assert.rejects(()=>saveManualActivity(client,scope,U,ID,input),/範圍|保存/);
 let current=true;client.functions.invoke=async()=>{current=false;return {error:null,data:{success:true,data:{activity:expected,replayed:false}}};};
 await assert.rejects(()=>saveManualActivity(client,scope,U,ID,input,()=>current),/切換/);
 assert.equal(manualPayload({...input,subcategory:'stationary',data_quality:'secondary',status:'archived'},scope,U,ID,project).status,'archived');
});
test('manual product payload preserves explicit input, scope, actor and stable UUID without test factor/default zero',()=>{const value=manualPayload(input,scope,U,ID,project);assert.equal(value.quantity,100);assert.equal(value.unit,'kWh');assert.equal(value.activity_type,'electricity');assert.equal(value.final_scope,2);assert.equal(value.inclusion_status,'included');assert.equal(value.id,ID);assert.equal(value.activity_code,'MANUAL-'+ID);assert.equal(value.organization_id,O);assert.equal(value.created_by_user_id,U);assert.equal('factor_id' in value,false);assert.equal('co2e_kg' in value,false);assert.equal(manualPayload({...input,quantity:'0'},scope,U,ID,project).quantity,0);});
test('missing or invalid quantities, unit/type, period, inclusion/scope and excluded reason do not become valid input',()=>{
 for(const patch of [{quantity:''},{quantity:' '},{quantity:'NaN'},{quantity:'Infinity'},{quantity:'-1'},{quantity:'1e20'},{quantity:'0.123456789'},{category:''},{unit:''},{activity_type:''},{activity_date:'2026-02-30'},{activity_date:'2027-01-01'},{final_scope:''},{final_scope:'4'},{inclusion_status:'include'},{inclusion_status:'excluded',exclusion_reason:''}])assert.throws(()=>manualPayload({...input,...patch},scope,U,ID,project),JSON.stringify(patch));
 assert.equal(manualPayload({...input,inclusion_status:'pending',final_scope:''},scope,U,ID,project).final_scope,null);
 assert.equal(manualPayload({...input,inclusion_status:'excluded',exclusion_reason:'manual boundary decision'},scope,U,ID,project).exclusion_reason,'manual boundary decision');
});
test('local recovery references bind product/user/organization/project and cannot clear a newer attempt',()=>{
 const map=new Map<string,string>(),store={getItem:k=>map.get(k)??null,setItem:(k,v)=>{map.set(k,v);},removeItem:k=>{map.delete(k);}};
 const first=activityReference(store,scope,U);assert.equal(activityReference(store,scope,U),first);
 const edit=activityEditReference(store,scope,U,ID);assert.equal(activityEditReference(store,scope,U,ID),edit);assert.notEqual(edit,first);
 assert.notEqual(activityEditReference(store,scope,U,O),edit);clearActivityEditReference(store,scope,U,ID,O);assert.equal(activityEditReference(store,scope,U,ID),edit);clearActivityEditReference(store,scope,U,ID,edit);assert.notEqual(activityEditReference(store,scope,U,ID),edit);
 assert.notEqual(activityReference(store,{...scope,projectId:ID},U),first);
 assert.notEqual(activityReference(store,scope,ID),first);
 clearManualReference(store,scope,U,'activity',ID);assert.equal(activityReference(store,scope,U),first);
 clearManualReference(store,scope,U,'activity',first);assert.notEqual(activityReference(store,scope,U),first);
 saveReportReference(store,scope,U,{requestId:ID,version:1});assert.deepEqual(reportReference(store,scope,U),{requestId:ID,version:1});
 clearManualReference(store,scope,U,'report',first);assert.ok(reportReference(store,scope,U));clearManualReference(store,scope,U,'report',ID);assert.equal(reportReference(store,scope,U),null);
 map.set(manualReferenceKey(scope,U,'report'),'broken');assert.throws(()=>reportReference(store,scope,U));
});
