// Synthetic local HTTP/Auth substitute, actual handlers, full migrations and SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createProductRuntime} from '../../tools/product-preview/runtime.js';
const service='SYNTHETIC-PRODUCT-SERVICE-KEY';
async function call(r,path,token,body,method='POST'){
  const response=await fetch(r.baseUrl+path,{method,headers:{apikey:r.publicKey,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await response.text();return {status:response.status,body:text?JSON.parse(text):null};
}
async function login(r,name='aOwner'){const response=await call(r,'/auth/v1/token?grant_type=password',null,r.accounts[name]);assert.equal(response.status,200);return response.body.access_token;}
const transcription=()=>({activity_name:'SYNTHETIC manually transcribed electricity',quantity:100,unit:'kWh',activity_date:'2026-01-15',category:'energy',subcategory:null,activity_type:'electricity',final_scope:2,inclusion_status:'included',exclusion_reason:null,review_note:null,period_start:'2026-01-01',period_end:'2026-01-31',source_locator:'Page 1 electricity total',source_text:'SYNTHETIC 100 kWh'});
function request(r){const f=r.config.manifest.fixtures.a;return {organization_id:f.organizationId,project_id:f.projectId,document_id:f.document.documentId,draft_id:randomUUID(),request_id:randomUUID(),transcription:transcription()};}
const create=(r,token,input)=>call(r,'/functions/v1/manual-transcription',token,input);
const decision=input=>({organization_id:input.organization_id,project_id:input.project_id,draft_id:input.draft_id,decision:'confirmed',request_id:randomUUID(),overrides:{review_note:'SYNTHETIC same-person source/Scope/inclusion checked'}});
const confirm=(r,token,input)=>call(r,'/functions/v1/confirm-draft',token,input);
async function rows(r,table,token){const q=new URLSearchParams({organization_id:'eq.'+r.scope.organizationId,project_id:'eq.'+r.scope.projectId});const response=await call(r,'/rest/v1/'+table+'?'+q,token,undefined,'GET');assert.equal(response.status,200);return response.body;}

test('manual HTTP normal create/replay -> concurrent same-intent confirm/replay -> real 50kg calculation with lineage and OCR pending',async()=>{
  const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{
    const token=await login(r),input=request(r);assert.equal((await rows(r,'extracted_document_drafts',token)).length,0);assert.equal((await rows(r,'emission_activities',token)).length,0);
    const first=await create(r,token,input);assert.equal(first.status,200,JSON.stringify(first.body));assert.equal(first.body.data.extraction_provider,'MANUAL_TRANSCRIPTION_NO_OCR');assert.equal(first.body.data.transcribed_by_user_id,r.scope.aOwnerId);assert.ok(Number.isFinite(Date.parse(first.body.data.transcribed_at)));assert.equal(first.body.data.replayed,false);
    const replay=await create(r,token,input);assert.equal(replay.body.data.replayed,true);assert.equal(replay.body.data.transcribed_at,first.body.data.transcribed_at);
    const intent=decision(input),responses=await Promise.all([confirm(r,token,intent),confirm(r,token,intent)]);for(const response of responses)assert.equal(response.status,200,JSON.stringify(response.body));assert.deepEqual(responses[0].body.data,responses[1].body.data);
    const again=await confirm(r,token,intent);assert.deepEqual(again.body.data,responses[0].body.data);
    const activities=await rows(r,'emission_activities',token),calculations=await rows(r,'calculation_results',token);assert.equal(activities.length,1);assert.equal(calculations.length,1);assert.equal(activities[0].source_document_id,input.document_id);assert.equal(activities[0].source_draft_id,input.draft_id);assert.equal(activities[0].created_by_user_id,r.scope.aOwnerId);assert.equal(activities[0].is_test,true);assert.equal(calculations[0].co2e_kg,50);assert.equal(calculations[0].status,'calculated');assert.equal((await rows(r,'uploaded_documents',token))[0].ocr_status,'pending');
  }finally{await r.close();}
});
test('manual HTTP rejects cross-tenant/viewer/unknown JWT and forged actor/provider, plus direct REST provenance mutation',async()=>{
  const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{
    const token=await login(r),viewer=await login(r,'viewer'),b=await login(r,'otherOwner'),input=request(r);
    for(const actor of [viewer,b])assert.equal((await create(r,actor,input)).status,403);
    assert.equal((await create(r,'forged-token',input)).status,401);
    for(const patch of [{actor_user_id:r.scope.otherOwnerId},{extraction_provider:'OCR'},{status:'confirmed'}])assert.equal((await create(r,token,{...input,...patch})).status,400);
    assert.equal((await create(r,token,{...input,document_id:r.config.manifest.fixtures.b.document.documentId})).status,403);
    const forged=await call(r,'/rest/v1/extracted_document_drafts',token,{id:input.draft_id,organization_id:input.organization_id,project_id:input.project_id,uploaded_document_id:input.document_id,extraction_provider:'MANUAL_TRANSCRIPTION_NO_OCR'});assert.equal(forged.body.code,'42501');
    assert.equal((await create(r,token,input)).status,200);
    for(const patch of [{status:'confirmed'},{extraction_provider:'other'},{normalized_payload:{quantity:0}},{raw_payload:{}}]){const result=await call(r,'/rest/v1/extracted_document_drafts?id=eq.'+input.draft_id,token,patch,'PATCH');assert.equal(result.body.code,'42501');}
    const direct=await call(r,'/rest/v1/rpc/confirm_manual_draft_atomic_v2',token,{p_organization_id:input.organization_id,p_project_id:input.project_id,p_draft_id:input.draft_id,p_actor_user_id:r.scope.aOwnerId,p_intent:{decision:'confirmed',request_id:'forged',review_note:null}});assert.equal(direct.body.code,'42501');
    assert.equal((await confirm(r,token,{...decision(input),actor_user_id:r.scope.aOwnerId})).status,400);
    assert.equal((await rows(r,'emission_activities',token)).length,0);
  }finally{await r.close();}
});
test('manual HTTP same-document concurrent creates have one latest; changed input/actor/confirmation intent conflict',async()=>{
  const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{
    const token=await login(r),shared=await login(r,'owner'),input=request(r),other={...input,draft_id:randomUUID(),request_id:randomUUID()};
    const attempts=await Promise.all([create(r,token,input),create(r,token,other)]);assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);const successful=attempts[0].status===200?input:other;
    assert.equal((await create(r,token,{...successful,transcription:{...transcription(),quantity:101}})).status,409);assert.equal((await create(r,shared,successful)).status,409);
    const intent=decision(successful);assert.equal((await confirm(r,token,intent)).status,200);assert.equal((await confirm(r,shared,intent)).status,409);assert.equal((await confirm(r,token,{...intent,request_id:randomUUID()})).status,409);assert.equal((await confirm(r,token,{...intent,overrides:{quantity:101}})).status,400);
    assert.equal((await rows(r,'extracted_document_drafts',token)).length,1);assert.equal((await rows(r,'emission_activities',token)).length,1);
  }finally{await r.close();}
});
test('manual HTTP committed create/confirm response losses recover the original UUID/actor/time/results without duplicate writes',async()=>{
  const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{
    const token=await login(r),input=request(r);await r.failNext({path:'/rest/v1/rpc/create_manual_transcription_atomic',phase:'afterCommit'});assert.equal((await create(r,token,input)).body.success,false);
    const saved=await create(r,token,input);assert.equal(saved.status,200);assert.equal(saved.body.data.replayed,true);assert.equal((await rows(r,'extracted_document_drafts',token)).length,1);
    const intent=decision(input);await r.failNext({path:'/rest/v1/rpc/confirm_manual_draft_atomic_v2',phase:'afterCommit'});assert.equal((await confirm(r,token,intent)).body.success,false);
    const replay=await confirm(r,token,intent);assert.equal(replay.status,200,JSON.stringify(replay.body));assert.equal((await rows(r,'emission_activities',token)).length,1);assert.equal((await rows(r,'calculation_results',token)).length,1);
  }finally{await r.close();}
});
test('manual HTTP explicit unknown factor stays pending_factor/NULL, and equal-ranked factors warn instead of arbitrarily calculating',async()=>{
  for(const withFactor of [false,true]){
    const r=await createProductRuntime({port:0,scenario:'manual-transcription',withFactor});try{
      const token=await login(r),input=request(r);
      if(withFactor){const factor=await call(r,'/rest/v1/emission_factors',service,{organization_id:r.scope.organizationId,factor_key:'SYNTHETIC-tie-'+randomUUID(),factor_name:'SYNTHETIC ambiguous alternative',source_name:'SYNTHETIC TEST ONLY',category:'energy',activity_type:'electricity',unit:'kWh',co2e_kg_per_unit:9,valid_from:'2026-01-01',version:1,quality_tier:'custom',status:'active',env:'staging',is_test:true});assert.equal(factor.status,201,JSON.stringify(factor.body));}
      assert.equal((await create(r,token,input)).status,200);const response=await confirm(r,token,decision(input));assert.equal(response.status,200,JSON.stringify(response.body));
      const result=(await rows(r,'calculation_results',token))[0];assert.equal(result.status,'pending_factor');assert.equal(result.co2e_kg,null);assert.equal(result.error_code,withFactor?'FACTOR_AMBIGUOUS':'FACTOR_NOT_FOUND');
      if(withFactor)assert.match(JSON.stringify(response.body.meta.warnings),/同順位/);
    }finally{await r.close();}
  }
});
test('manual HTTP stale draft and out-of-project source period fail before any activity, while legitimate rejection preserves OCR pending',async()=>{
  const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{
    const token=await login(r),input=request(r);
    assert.equal((await create(r,token,{...input,transcription:{...transcription(),period_start:'2025-12-01'}})).status,409);
    assert.equal((await create(r,token,input)).status,200);
    await call(r,'/rest/v1/extracted_document_drafts?id=eq.'+input.draft_id,service,{is_latest:false},'PATCH');assert.equal((await confirm(r,token,decision(input))).status,409);
    await call(r,'/rest/v1/extracted_document_drafts?id=eq.'+input.draft_id,service,{is_latest:true},'PATCH');const rejected=await confirm(r,token,{...decision(input),decision:'rejected'});assert.equal(rejected.status,200);assert.equal(rejected.body.data.emission_activity_id,null);assert.equal((await rows(r,'emission_activities',token)).length,0);assert.equal((await rows(r,'uploaded_documents',token))[0].ocr_status,'pending');
  }finally{await r.close();}
});
test('manual HTTP latest readonly/suspended overrides earlier active for both create and confirm',async()=>{
  const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{
    const token=await login(r),input=request(r);assert.equal((await create(r,token,input)).status,200);
    const latest=randomUUID();assert.equal((await call(r,'/rest/v1/subscriptions',service,{id:latest,organization_id:r.scope.organizationId,plan_code:'SYNTHETIC',status:'readonly',period_start:'2020-01-01',period_end:'2100-01-01'})).status,201);
    for(const status of ['readonly','suspended','canceled']){await call(r,'/rest/v1/subscriptions?id=eq.'+latest,service,{status},'PATCH');assert.equal((await create(r,token,input)).status,403);assert.equal((await confirm(r,token,decision(input))).status,403);}
    assert.equal((await rows(r,'emission_activities',token)).length,0);
  }finally{await r.close();}
});
test('manual pending source cannot be deleted via raw Storage/receipt API before activity exists; unreferenced same-scope original uses controlled deletion',async()=>{
  const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{
    const token=await login(r),b=await login(r,'otherOwner'),input=request(r),f=r.config.manifest.fixtures;assert.equal((await create(r,token,input)).status,200);assert.equal((await rows(r,'emission_activities',token)).length,0);
    const denied=await call(r,'/storage/v1/object/'+f.a.document.bucket,token,{prefixes:[f.a.document.path]},'DELETE');assert.equal(denied.status,200);assert.deepEqual(denied.body,[]);
    const receipt=await call(r,'/rest/v1/uploaded_documents?id=eq.'+input.document_id,token,undefined,'DELETE');assert.equal(receipt.status,200);assert.deepEqual(receipt.body,[]);
    const read=await fetch(r.baseUrl+'/storage/v1/object/'+f.a.document.bucket+'/'+f.a.document.path,{headers:{Authorization:'Bearer '+token}});assert.equal(read.status,200);assert.equal((await rows(r,'uploaded_documents',token)).length,1);
    const raw=await call(r,'/storage/v1/object/'+f.b.document.bucket,b,{prefixes:[f.b.document.path]},'DELETE');assert.equal(raw.body.code,'42501');
    const positive=await call(r,'/functions/v1/delete-uploaded-document',b,{organization_id:f.b.organizationId,project_id:f.b.projectId,document_id:f.b.document.documentId,request_id:randomUUID()});assert.equal(positive.status,200,JSON.stringify(positive.body));assert.equal(positive.body.data.operation_status,'deleted');assert.equal(positive.body.data.receipt_present,true);
    const deleted=await fetch(r.baseUrl+'/storage/v1/object/'+f.b.document.bucket+'/'+f.b.document.path,{headers:{Authorization:'Bearer '+b}});assert.equal(deleted.status,404);
  }finally{await r.close();}
});
test('manual pending-factor replay and lost-response recovery return saved calculation state/warnings; rejection has no calculation',async()=>{
  const r=await createProductRuntime({port:0,scenario:'manual-transcription',withFactor:false});try{
    const token=await login(r),input=request(r);assert.equal((await create(r,token,input)).status,200);
    const intent=decision(input),first=await confirm(r,token,intent);assert.equal(first.status,200);assert.ok(first.body.meta.warnings.length>0);
    const saved=(await rows(r,'calculation_results',token))[0];assert.equal(saved.status,'pending_factor');assert.equal(saved.co2e_kg,null);
    await r.failNext({path:'/rest/v1/calculation_results',method:'GET'});const unreadable=await confirm(r,token,intent);assert.equal(unreadable.status,409);assert.equal(unreadable.body.success,false);assert.equal(unreadable.body.error.code,'MANUAL_CONFIRMATION_READBACK_FAILED');
    await r.failNext({path:'/rest/v1/rpc/confirm_manual_draft_atomic_v2',phase:'afterCommit'});assert.equal((await confirm(r,token,intent)).body.success,false);
    const replay=await confirm(r,token,intent);assert.equal(replay.status,200);assert.deepEqual(replay.body.meta.warnings,saved.warnings);assert.equal(replay.body.data.calculation_status,'pending_factor');assert.equal(replay.body.data.error_code,'FACTOR_NOT_FOUND');assert.equal(replay.body.data.co2e_kg,null);assert.deepEqual(replay.body.data.calculation_warnings,saved.warnings);assert.equal((await rows(r,'calculation_results',token)).length,1);
    const b=r.config.manifest.fixtures.b,bToken=await login(r,'otherOwner'),bInput={...request(r),organization_id:b.organizationId,project_id:b.projectId,document_id:b.document.documentId};assert.equal((await create(r,bToken,bInput)).status,200);
    const rejected=await confirm(r,bToken,{...decision(bInput),decision:'rejected'});assert.equal(rejected.status,200);for(const field of ['calculation_result_id','calculation_status','error_code','co2e_kg','calculation_warnings'])assert.equal(rejected.body.data[field],null);
  }finally{await r.close();}
});
