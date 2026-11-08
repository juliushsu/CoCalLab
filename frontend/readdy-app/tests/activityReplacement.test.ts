// Installed SDK with intercepted synthetic transport only; no real Supabase/JWT acceptance claim.
import test from 'node:test';import assert from 'node:assert/strict';import {createClient} from '@supabase/supabase-js';
import {canonicalReplacementIntent,replacementOperation,parseReplacementResult,replacementReferenceForm,recoverReplacementOperation} from '../src/services/activityReplacement.ts';
import {replacementReference,readReplacementReferences,clearReplacementReference,replacementReferencePrefix,replacementReferenceKey,captureReplacementReferences,abandonCapturedReplacementReference,retainRecoveredReplacementReference} from '../src/services/activityReplacementRecovery.ts';
const O='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222',U='33333333-3333-4333-8333-333333333333',A='44444444-4444-4444-8444-444444444444',B='55555555-5555-4555-8555-555555555555',R='66666666-6666-4666-8666-666666666666',scope={organizationId:O,projectId:P};
const fields={activity_name:'SYNTHETIC corrected electricity',activity_date:'2026-01-15',category:'energy',subcategory:null,activity_type:'electricity',quantity:120,unit:'kWh',final_scope:2,inclusion_status:'included',exclusion_reason:null,review_note:null,data_quality:'primary',status:'active'};
const intent=()=>canonicalReplacementIntent({mode:'correct',reason:'SYNTHETIC measured correction',input:fields}),reference=()=>({requestId:R,predecessorId:A,intent:intent()});
const result=()=>({organization_id:O,project_id:P,predecessor_activity_id:A,activity_id:B,request_id:R,mode:'correct',replayed:false,operation_status:'completed',is_effective:true,recalculation_required:true});
function store(){const map=new Map<string,string>();return {map,get length(){return map.size;},key:(i:number)=>[...map.keys()][i]??null,getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};}
function sdk(options:{result?:unknown;status?:number;row?:unknown;role?:string;late?:()=>void}={}){
 const requests:{path:string;method:string;body:Record<string,unknown>}[]=[],user={id:U,aud:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'},memory=new Map([['SYNTHETIC-replacement-auth',JSON.stringify({access_token:'SYNTHETIC-token',refresh_token:'SYNTHETIC-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})]]);
 const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
 const client=createClient('https://synthetic-replacement.invalid','SYNTHETIC-public',{auth:{storageKey:'SYNTHETIC-replacement-auth',storage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,v);},removeItem:k=>{memory.delete(k);}},autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,init)=>{
  const path=new URL(String(url)).pathname,method=init?.method??'GET',body=init?.body?JSON.parse(String(init.body)):{};requests.push({path,method,body});
  if(path==='/auth/v1/user')return json(user);if(path==='/rest/v1/projects')return json({id:P,organization_id:O,name:'SYNTHETIC',project_code:'SYNTHETIC',reporting_start_date:'2026-01-01',reporting_end_date:'2026-12-31'});if(path==='/rest/v1/organization_members')return json({organization_id:O,user_id:U,role:options.role??'owner',status:'active'});
  if(path==='/functions/v1/replace-emission-activity'){options.late?.();return options.status?json({success:false,error:{message:'SYNTHETIC uncertain response'}},options.status):json({success:true,data:options.result??result()});}
  if(path==='/rest/v1/emission_activities')return json(Object.hasOwn(options,'row')?options.row:{id:B,organization_id:O,project_id:P,...fields});throw new Error('Unexpected '+path);
 }}});return {client,requests};
}
test('replacement intent requires reason, denies fake source/actor/calc and exclusion sends no quantity or unit',()=>{assert.deepEqual(canonicalReplacementIntent({mode:'exclude',reason:' boundary ',input:{}}),{mode:'exclude',reason:'boundary',input:{}});for(const change of [{reason:''},{input:{...fields,source_document_id:A}},{input:{...fields,actor_user_id:U}},{input:{...fields,co2e_kg:0}},{mode:'exclude',input:{quantity:0,unit:'kg'}}])assert.throws(()=>canonicalReplacementIntent({...intent(),...change}));});
test('durable scoped intent survives reload, forbids changed pending intent, and per-request keys do not overwrite interleaved operations',()=>{
 const s=store(),a=replacementReference(s,scope,U,A,intent());assert.deepEqual(readReplacementReferences(s,scope,U,A),[a]);assert.deepEqual(replacementReference(s,scope,U,A,intent()),a);assert.equal(readReplacementReferences(s,scope,B,A).length,0);assert.equal(readReplacementReferences(s,{...scope,projectId:B},U,A).length,0);
 assert.throws(()=>replacementReference(s,scope,U,A,{...intent(),reason:'changed'}));const b={...a,requestId:B};s.setItem(replacementReferenceKey(scope,U,b),JSON.stringify(b));clearReplacementReference(s,scope,U,a);assert.deepEqual(readReplacementReferences(s,scope,U,A),[b]);
 const raw=captureReplacementReferences(s,scope,U,A)[0];s.setItem(raw.key,raw.raw+' ');assert.throws(()=>abandonCapturedReplacementReference(s,scope,U,A,raw));assert.ok(s.getItem(raw.key));
});
test('corrupt or unavailable/nonpersisting journal fails closed; explicit exact captured cleanup never cancels server work',()=>{
 const s=store();s.setItem(replacementReferencePrefix(scope,U,A)+R,'{bad');assert.throws(()=>readReplacementReferences(s,scope,U,A),/損壞/);const captured=captureReplacementReferences(s,scope,U,A)[0];abandonCapturedReplacementReference(s,scope,U,A,captured);assert.deepEqual(readReplacementReferences(s,scope,U,A),[]);
 const blocked={...s,setItem(){throw new Error('SYNTHETIC storage blocked');}};assert.throws(()=>replacementReference(blocked,scope,U,A,intent()));const shadow={...s,setItem(){},getItem:()=>null};assert.throws(()=>replacementReference(shadow,scope,U,A,intent()),/持久/);
});
test('SDK replacement and lookup preserve request/intent and JWT scope with no direct activity mutation',async()=>{const h=sdk();await replacementOperation(h.client,scope,U,reference(),'replace');await replacementOperation(h.client,scope,U,reference(),'lookup');const writes=h.requests.filter(r=>r.path.startsWith('/functions/'));assert.deepEqual(writes.map(r=>r.body.action),['replace','lookup']);for(const r of writes){assert.equal(r.body.request_id,R);assert.equal(r.body.predecessor_activity_id,A);assert.equal(r.body.organization_id,O);assert.equal('actor_user_id' in r.body,false);assert.deepEqual(r.body.input,intent().input);}assert.equal(h.requests.filter(r=>r.path==='/rest/v1/emission_activities'&&r.method!=='GET').length,0);});
test('lost/rejected response, mismatched successor/readback, readonly and switched context never become success',async()=>{
 for(const options of [{status:503},{result:{...result(),activity_id:A}},{result:{...result(),project_id:B}},{row:null},{row:{id:B,organization_id:O,project_id:P,...fields,quantity:999}}])await assert.rejects(()=>replacementOperation(sdk(options).client,scope,U,reference(),'replace'));
 const viewer=sdk({role:'viewer'});await assert.rejects(()=>replacementOperation(viewer.client,scope,U,reference(),'lookup'));assert.equal(viewer.requests.filter(r=>r.path.startsWith('/functions/')).length,0);
 let current=true;const late=sdk({late:()=>{current=false;}});await assert.rejects(()=>replacementOperation(late.client,scope,U,reference(),'replace',()=>current));assert.equal(late.requests.filter(r=>r.path==='/rest/v1/emission_activities').length,0);
});
test('historical replay remains the original saved successor; not-found has no activity or recalculation success',()=>{const historical=parseReplacementResult({...result(),operation_status:'historical',replayed:true,is_effective:false},scope,reference());assert.equal(historical.activity_id,B);const missing=parseReplacementResult({...result(),operation_status:'not_found',activity_id:null,is_effective:false,recalculation_required:null},scope,reference());assert.equal(missing.activity_id,null);assert.throws(()=>parseReplacementResult({...missing,recalculation_required:false},scope,reference()));});
test('selecting any restored correction displays its saved quantity/unit rather than an unrelated predecessor form',()=>{
 const original={activity_name:'Original',activity_date:'2026-01-15',category:'energy',activity_type:'electricity',quantity:'100',unit:'kWh',final_scope:'2',inclusion_status:'included',exclusion_reason:'',notes:''};
 for(const quantity of [120,140]){const selected=canonicalReplacementIntent({...intent(),input:{...fields,quantity}}),form=replacementReferenceForm(selected,original);assert.equal(form.quantity,String(quantity));assert.equal(form.unit,'kWh');assert.equal(form.notes,'');}
 assert.equal(replacementReferenceForm({mode:'exclude',reason:'boundary',input:{}},original),original);
});
test('empty session journal recovers the server request and immutable intent before any new request can be made',async()=>{
 const h=sdk({result:{...result(),replayed:true,reason:intent().reason,input:intent().input,canonical_input:intent().input}}),s=store();
 const recovered=await recoverReplacementOperation(h.client,scope,U,A);
 assert.ok(recovered.reference);assert.equal(recovered.reference.requestId,R);assert.deepEqual(recovered.reference.intent,intent());
 retainRecoveredReplacementReference(s,scope,U,recovered.reference);assert.deepEqual(readReplacementReferences(s,scope,U,A),[reference()]);
 const writes=h.requests.filter(r=>r.path.startsWith('/functions/'));assert.deepEqual(writes.map(r=>r.body.action),['recover','lookup']);
 assert.deepEqual(Object.keys(writes[0].body).sort(),['action','organization_id','predecessor_activity_id','project_id']);assert.equal(writes.some(r=>r.body.action==='replace'),false);
});
test('server recovery failure, stale context, foreign scope and leaked other-actor intent never authorize a fresh request',async()=>{
 const absent={...result(),operation_status:'not_found',activity_id:null,request_id:null,mode:null,reason:null,input:null,canonical_input:null,is_effective:false,recalculation_required:null};
 assert.equal((await recoverReplacementOperation(sdk({result:absent}).client,scope,U,A)).status,'not_found');
 assert.equal((await recoverReplacementOperation(sdk({result:{...absent,operation_status:'superseded'}}).client,scope,U,A)).status,'superseded');
 for(const body of [{...absent,reason:'other actor secret'},{...absent,project_id:B},{...result(),canonical_input:{}}])await assert.rejects(()=>recoverReplacementOperation(sdk({result:body}).client,scope,U,A));
 await assert.rejects(()=>recoverReplacementOperation(sdk({status:503}).client,scope,U,A));
 let current=true;const delayed=sdk({late:()=>{current=false;}});await assert.rejects(()=>recoverReplacementOperation(delayed.client,scope,U,A,()=>current));assert.equal(delayed.requests.filter(r=>r.path.startsWith('/functions/')).length,1);
});
