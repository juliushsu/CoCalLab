// Synthetic loopback Auth/Storage adapter; actual confirm handlers and complete SQL chain.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createProductRuntime} from '../../tools/product-preview/runtime.js';
const service='SYNTHETIC-PRODUCT-SERVICE-KEY';
async function api(r,path,token,body,method='POST'){const response=await fetch(r.baseUrl+path,{method,headers:{apikey:r.publicKey,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json().catch(()=>null)};}
async function login(r,name='aOwner'){const response=await api(r,'/auth/v1/token?grant_type=password',null,r.accounts[name]);assert.equal(response.status,200);return response.body.access_token;}
async function seed(r,extra={}){const f=r.config.manifest.fixtures.a,id=randomUUID(),row={id,organization_id:f.organizationId,project_id:f.projectId,uploaded_document_id:f.document.documentId,extraction_provider:'OCR-LOCAL-LEGACY-FIXTURE',extraction_version:1,raw_payload:{synthetic:true},normalized_payload:{quantity:100,unit:'kWh',activity_date:'2026-01-15'},status:'pending_review',classification_status:'unclassified',is_latest:true,...extra};const result=await api(r,'/rest/v1/extracted_document_drafts',service,row);assert.equal(result.status,201,JSON.stringify(result.body));return row;}
const input=row=>({organization_id:row.organization_id,project_id:row.project_id,draft_id:row.id,decision:'confirmed',request_id:randomUUID(),overrides:{activity_name:'SYNTHETIC reviewed electricity',activity_type:'electricity',category:'energy',final_scope:2,inclusion_status:'included'}});
const confirm=(r,token,body)=>api(r,'/functions/v1/confirm-draft',token,body);
async function rows(r,table,token){const response=await api(r,'/rest/v1/'+table+'?organization_id=eq.'+r.scope.organizationId+'&project_id=eq.'+r.scope.projectId,token,undefined,'GET');assert.equal(response.status,200);return response.body;}

test('non-MANUAL confirmation commit loss replays original IDs/warnings before factors or new code/time are generated',async()=>{
 const r=await createProductRuntime({port:0,scenario:'manual-transcription',withFactor:false});try{
  const token=await login(r),draft=await seed(r),body=input(draft);
  await r.failNext({path:'/rest/v1/rpc/commit_draft_confirmation',phase:'afterCommit'});const lost=await confirm(r,token,body);assert.equal(lost.body.success,false);
  const beforeActivities=await rows(r,'emission_activities',token),beforeCalculations=await rows(r,'calculation_results',token),beforeAudits=await rows(r,'audit_logs',token);assert.equal(beforeActivities.length,1);assert.equal(beforeCalculations.length,1);
  await r.failNext({path:'/rest/v1/emission_factors',method:'GET'});
  const replay=await confirm(r,token,body);assert.equal(replay.status,200,JSON.stringify(replay.body));assert.equal(replay.body.data.replayed,true);assert.equal(replay.body.data.emission_activity_id,beforeActivities[0].id);assert.equal(replay.body.data.calculation_result_id,beforeCalculations[0].id);assert.equal(replay.body.data.calculation_status,'pending_factor');assert.equal(replay.body.data.co2e_kg,null);assert.deepEqual(replay.body.meta.warnings,beforeCalculations[0].warnings);
  const untouched=await api(r,'/rest/v1/emission_factors',token,undefined,'GET');assert.equal(untouched.status,503,'replay must not consume the factor-read fault');
  assert.deepEqual(await rows(r,'emission_activities',token),beforeActivities);assert.deepEqual(await rows(r,'calculation_results',token),beforeCalculations);assert.deepEqual(await rows(r,'audit_logs',token),beforeAudits);
  const changed=await confirm(r,token,{...body,overrides:{...body.overrides,quantity:101}});assert.equal(changed.status,409);assert.match(changed.body.error.message,/INTENT_CONFLICT/);
  const another=await confirm(r,token,{...body,request_id:randomUUID()});assert.equal(another.status,409);assert.match(another.body.error.message,/ALREADY_PROCESSED/);
 }finally{await r.close();}
});
test('missing request, non-latest/processed draft and broad MANUAL provenance fail before calculation work',async()=>{
 for(const patch of [{is_latest:false},{status:'rejected'},{extraction_provider:'ocr_manual_import',raw_payload:{}},{extraction_provider:'other',raw_payload:['manual_transcription']},{extraction_provider:'other',raw_payload:'manual_transcription'}]){
  const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{
   const token=await login(r),draft=await seed(r,patch),body=input(draft);await r.failNext({path:'/rest/v1/emission_factors',method:'GET'});
   const denied=await confirm(r,token,body);assert.ok([403,409].includes(denied.status),JSON.stringify(denied.body));assert.equal(denied.body.success,false);
   assert.equal((await api(r,'/rest/v1/emission_factors',token,undefined,'GET')).status,503);
   assert.equal((await rows(r,'emission_activities',token)).length,0);assert.equal((await rows(r,'calculation_results',token)).length,0);assert.equal((await rows(r,'audit_logs',token)).length,0);
  }finally{await r.close();}
 }
 const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{const token=await login(r),draft=await seed(r),body=input(draft);delete body.request_id;const missing=await confirm(r,token,body);assert.equal(missing.status,400);assert.equal(missing.body.error.code,'DRAFT_CONFIRMATION_REQUEST_REQUIRED');assert.equal((await rows(r,'emission_activities',token)).length,0);}finally{await r.close();}
});
test('a non-MANUAL side branch cannot create another activity for a MANUAL document; ordinary REST insertion is also denied',async()=>{
 const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{
  const token=await login(r),f=r.config.manifest.fixtures.a,scope={organization_id:f.organizationId,project_id:f.projectId};
  const transcription={activity_name:'SYNTHETIC manual',quantity:100,unit:'kWh',activity_date:'2026-01-15',category:'energy',subcategory:null,activity_type:'electricity',final_scope:2,inclusion_status:'included',exclusion_reason:null,review_note:null,period_start:null,period_end:null,source_locator:'SYNTHETIC page 1',source_text:null};
  const manual=await api(r,'/functions/v1/manual-transcription',token,{...scope,document_id:f.document.documentId,draft_id:randomUUID(),request_id:randomUUID(),transcription});assert.equal(manual.status,200,JSON.stringify(manual.body));
  const side={...scope,id:randomUUID(),uploaded_document_id:f.document.documentId,extraction_provider:'other',extraction_version:99,is_latest:false,raw_payload:{},normalized_payload:{quantity:999,unit:'kWh',activity_date:'2026-01-15'}};
  const inserted=await api(r,'/rest/v1/extracted_document_drafts',token,side);assert.equal(inserted.body.code,'42501');
  // Cross-scope rebind is rejected even for an actor owning both scopes; no target history leaks.
  const b=r.config.manifest.fixtures.b,shared=await login(r,'owner');
  await api(r,'/rest/v1/organization_members?organization_id=eq.'+b.organizationId+'&user_id=eq.'+r.scope.userId,service,{role:'owner'},'PATCH');
  const source=await seed(r,{organization_id:b.organizationId,project_id:b.projectId,uploaded_document_id:b.document.documentId});
  const rebound=await api(r,'/rest/v1/extracted_document_drafts?id=eq.'+source.id,shared,{organization_id:scope.organization_id,project_id:scope.project_id,uploaded_document_id:f.document.documentId,is_latest:false,extraction_version:98},'PATCH');assert.equal(rebound.body.code,'42501',JSON.stringify(rebound.body));assert.equal(rebound.body.message,'DRAFT_DOCUMENT_SCOPE_DENIED');
  const unchanged=await api(r,'/rest/v1/extracted_document_drafts?id=eq.'+source.id,service,undefined,'GET');assert.equal(unchanged.body[0].uploaded_document_id,b.document.documentId);assert.equal(unchanged.body[0].organization_id,b.organizationId);
  // Maintenance-only historical fixture ensures the handler/SQL gate still blocks pre-existing side branches.
  const branch=await seed(r,{...side,id:randomUUID()});const before=await rows(r,'audit_logs',token);
  const denied=await confirm(r,token,input(branch));assert.ok([403,409].includes(denied.status),JSON.stringify(denied.body));assert.equal(denied.body.success,false);
  // HTTP call equivalent to the legacy handler's old RPC: SQL must fence it too.
  const old=await api(r,'/rest/v1/rpc/confirm_draft_atomic',service,{p_organization_id:scope.organization_id,p_project_id:scope.project_id,p_draft_id:branch.id,p_decision:'confirmed',p_draft_status:'confirmed',p_draft_review_note:null,p_draft_reviewed_at:new Date().toISOString(),p_emission_activity:{...input(branch).overrides,quantity:999,unit:'kWh',activity_date:'2026-01-15',source_document_id:f.document.documentId,source_draft_id:branch.id,activity_code:'SYNTHETIC-LEGACY'},p_calculation_result:{status:'calculated',co2e_kg:999,warnings:[]},p_actor_user_id:r.scope.aOwnerId,p_request_id:randomUUID()});assert.equal(old.body.code,'42501',JSON.stringify(old.body));assert.match(old.body.message,/MANUAL/);
  assert.equal((await rows(r,'emission_activities',token)).length,0);assert.equal((await rows(r,'calculation_results',token)).length,0);assert.deepEqual(await rows(r,'audit_logs',token),before);
 }finally{await r.close();}
});
test('confirmation replay rechecks JWT role and tenant, and reauthorized same actor recovers the same saved IDs',async()=>{
 const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{
  const token=await login(r),draft=await seed(r),body=input(draft),saved=await confirm(r,token,body);assert.equal(saved.status,200,JSON.stringify(saved.body));
  const viewer=await login(r,'viewer'),other=await login(r,'otherOwner');for(const deniedToken of [viewer,other])assert.equal((await confirm(r,deniedToken,body)).status,403);
  const member='/rest/v1/organization_members?organization_id=eq.'+draft.organization_id+'&user_id=eq.'+r.scope.aOwnerId;
  assert.equal((await api(r,member,service,{role:'viewer'},'PATCH')).status,200);assert.equal((await confirm(r,token,body)).status,403);
  assert.equal((await api(r,member,service,{role:'owner'},'PATCH')).status,200);const replay=await confirm(r,token,body);assert.equal(replay.status,200);assert.equal(replay.body.data.emission_activity_id,saved.body.data.emission_activity_id);assert.equal(replay.body.data.calculation_result_id,saved.body.data.calculation_result_id);assert.equal((await rows(r,'emission_activities',token)).length,1);
 }finally{await r.close();}
});
test('ordinary source change during factor read rejects the stale initial draft and rolls back without activity/calculation/audit',async()=>{
 const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{
  const token=await login(r),draft=await seed(r),body=input(draft),beforeAudits=await rows(r,'audit_logs',token);
  await r.failNext({path:'/rest/v1/emission_factors',method:'GET',phase:'beforeDispatch',mutateDraft:{id:draft.id,token,patch:{normalized_payload:{quantity:200,unit:'kWh',activity_date:'2026-01-15'},suggested_category:'materials',suggested_scope:3,confidence_score:0.2}}});
  const stale=await confirm(r,token,body);assert.equal(stale.status,409,JSON.stringify(stale.body));assert.equal(stale.body.error.code,'DRAFT_CONFIRMATION_SOURCE_CHANGED');
  assert.equal((await rows(r,'emission_activities',token)).length,0);assert.equal((await rows(r,'calculation_results',token)).length,0);assert.deepEqual(await rows(r,'audit_logs',token),beforeAudits);
  const saved=(await rows(r,'extracted_document_drafts',token)).find(row=>row.id===draft.id);assert.equal(saved.status,'pending_review');assert.equal(saved.normalized_payload.quantity,200);assert.equal(saved.suggested_scope,3);assert.equal(saved.confidence_score,0.2);
  // Failed transaction did not register the old intent; same caller request now reviews fresh source.
  const retried=await confirm(r,token,body);assert.equal(retried.status,200,JSON.stringify(retried.body));const activity=(await rows(r,'emission_activities',token))[0];assert.equal(activity.quantity,200);assert.equal(retried.body.data.co2e_kg,100);
 }finally{await r.close();}
});
