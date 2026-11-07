// Actual production handlers and SQL; only local Auth/HTTP/Storage fixtures are synthetic.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';
import {createProductRuntime} from '../../tools/product-preview/runtime.js';
import {saveManualActivity,readManualActivities,calculateManualProject,saveManualReport} from '../../../frontend/readdy-app/src/services/manualWorkflow.ts';
const {createClient}=createRequire(new URL('../../../frontend/readdy-app/package.json',import.meta.url))('@supabase/supabase-js');
async function api(r,path,token,body,method='POST'){const response=await fetch(r.baseUrl+path,{method,headers:{apikey:r.publicKey,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json().catch(()=>null)};}
async function login(r,name='owner'){const result=await api(r,'/auth/v1/token?grant_type=password',null,r.accounts[name]);assert.equal(result.status,200);return result.body.access_token;}
const values={activity_name:'SYNTHETIC controlled electricity',activity_date:'2026-01-15',category:'energy',activity_type:'electricity',quantity:100,unit:'kWh',final_scope:2,inclusion_status:'included',data_quality:'primary',status:'active',exclusion_reason:null,review_note:null};
test('controlled create/replay/edit, trusted generic recalc and report persist real 50kg snapshot; retained edit is rejected',async()=>{
 const r=await createProductRuntime({port:0});try{
  const token=await login(r),scope={organization_id:r.scope.organizationId,project_id:r.scope.projectId},id=randomUUID();
  const body={...scope,activity_id:id,request_id:randomUUID(),input:{...values,quantity:80}};
  const saved=await api(r,'/functions/v1/save-manual-activity',token,body);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.data.activity.quantity,80);
  const replay=await api(r,'/functions/v1/save-manual-activity',token,body);assert.equal(replay.status,200);assert.equal(replay.body.data.replayed,true);assert.equal(replay.body.data.activity.id,id);
  const edit={...body,request_id:randomUUID(),input:values};assert.equal((await api(r,'/functions/v1/save-manual-activity',token,edit)).status,200);
  const reportBody={...scope,report_version:1,claim_purpose:'internal_management',request_id:randomUUID()};
  const premature=await api(r,'/functions/v1/generate-report',token,reportBody);assert.equal(premature.status,409,JSON.stringify(premature.body));assert.match(premature.body.error.code,/CALCULATION_AUTHORITY/);
  const calc=await api(r,'/functions/v1/recalculate-project',token,{...scope,actor_user_id:r.scope.userId,request_id:randomUUID(),force_recalculate:true});assert.equal(calc.status,200,JSON.stringify(calc.body));
  const report=await api(r,'/functions/v1/generate-report',token,reportBody);assert.equal(report.status,200,JSON.stringify(report.body));assert.equal(report.body.data.gross_emissions_snapshot.gross_total_co2e_kg,50);assert.equal(report.body.data.integrity_status,'server_verified');
  const retained=await api(r,'/functions/v1/save-manual-activity',token,{...edit,request_id:randomUUID(),input:{...values,quantity:101}});assert.equal(retained.status,409,JSON.stringify(retained.body));assert.match(retained.body.error.code,/^(ACTIVITY_SOURCE_RETAINED|REPORT_SOURCE_RETAINED)$/);
  const rows=await api(r,'/rest/v1/emission_activities?id=eq.'+id,token,undefined,'GET');assert.equal(rows.body.length,1);assert.equal(rows.body[0].quantity,100);
 }finally{await r.close();}
});
test('controlled endpoint rejects actor/source forgery, viewer writes and changed same-request intent',async()=>{
 const r=await createProductRuntime({port:0});try{
  const token=await login(r),body={organization_id:r.scope.organizationId,project_id:r.scope.projectId,activity_id:randomUUID(),request_id:randomUUID(),input:values};
  assert.equal((await api(r,'/functions/v1/save-manual-activity',token,{...body,input:{...values,created_by_user_id:randomUUID()}})).status,400);
  const viewer=await login(r,'viewer');assert.equal((await api(r,'/functions/v1/save-manual-activity',viewer,body)).status,403);
  assert.equal((await api(r,'/functions/v1/save-manual-activity',token,body)).status,200);
  const changed=await api(r,'/functions/v1/save-manual-activity',token,{...body,input:{...values,quantity:99}});assert.equal(changed.status,409,JSON.stringify(changed.body));assert.equal(changed.body.error.code,'ACTIVITY_REQUEST_INTENT_CONFLICT');
 }finally{await r.close();}
});
test('MANUAL history is rejected before process/classify provider work, even when no longer latest and caller supplies replacement content',async()=>{
 const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{
  const token=await login(r,'aOwner'),f=r.config.manifest.fixtures.a,scope={organization_id:f.organizationId,project_id:f.projectId},draftId=randomUUID();
  const transcription={...values,subcategory:null,period_start:null,period_end:null,source_locator:'SYNTHETIC page 1',source_text:null};delete transcription.data_quality;delete transcription.status;
  const created=await api(r,'/functions/v1/manual-transcription',token,{...scope,document_id:f.document.documentId,draft_id:draftId,request_id:randomUUID(),transcription});assert.equal(created.status,200,JSON.stringify(created.body));
  await api(r,'/rest/v1/extracted_document_drafts?id=eq.'+draftId,'SYNTHETIC-PRODUCT-SERVICE-KEY',{is_latest:false},'PATCH');
  const process=await api(r,'/functions/v1/process-document',token,{...scope,uploaded_document_id:f.document.documentId,provider_hint:'mock',ocr_payload:{text:'must not replace manual'},request_id:randomUUID()});assert.equal(process.status,409,JSON.stringify(process.body));assert.equal(process.body.error.code,'MANUAL_SOURCE_RETAINED');
  const classify=await api(r,'/functions/v1/classify-document',token,{...scope,draft_id:draftId,model_hint:'mock',normalized_payload:{quantity:0},request_id:randomUUID()});assert.equal(classify.status,409,JSON.stringify(classify.body));assert.equal(classify.body.error.code,'MANUAL_SOURCE_RETAINED');
  const drafts=await api(r,'/rest/v1/extracted_document_drafts?id=eq.'+draftId,token,undefined,'GET');assert.equal(drafts.body.length,1);assert.equal(drafts.body[0].extraction_provider,'MANUAL_TRANSCRIPTION_NO_OCR');assert.equal(drafts.body[0].normalized_payload.quantity,100);assert.equal(drafts.body[0].status,'pending_review');
 }finally{await r.close();}
});
test('installed client service recovers committed activity response loss with same IDs, then saves trusted calculation/report',async()=>{
 const r=await createProductRuntime({port:0});const client=createClient(r.baseUrl,r.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});try{
  const login=await client.auth.signInWithPassword(r.accounts.owner);assert.equal(login.error,null);
  const scope={organizationId:r.scope.organizationId,projectId:r.scope.projectId},id=randomUUID(),input={...values,quantity:'100',final_scope:'2',notes:'SYNTHETIC installed SDK',exclusion_reason:''};delete input.review_note;delete input.data_quality;delete input.status;
  await r.failNext({path:'/rest/v1/rpc/save_manual_activity_atomic',phase:'afterCommit'});
  await assert.rejects(()=>saveManualActivity(client,scope,r.scope.userId,id,input));
  const recovered=await saveManualActivity(client,scope,r.scope.userId,id,input);assert.equal(recovered.id,id);
  const all=await readManualActivities(client,scope,r.scope.userId);assert.equal(all.length,1);assert.equal(all[0].quantity,100);
  let current=false;await assert.rejects(()=>saveManualActivity(client,scope,r.scope.userId,id,{...input,quantity:'101'},()=>current));
  current=true;
  const calculation=await calculateManualProject(client,scope,r.scope.userId,randomUUID());assert.equal(calculation.calculated_count,1);
  const attempt={requestId:randomUUID(),version:1},report=await saveManualReport(client,scope,r.scope.userId,attempt);assert.equal(report.gross_emissions_snapshot.gross_total_co2e_kg,50);assert.equal(report.integrity_status,'server_verified');
  const replay=await saveManualReport(client,scope,r.scope.userId,attempt);assert.equal(replay.id,report.id);
 }finally{await client.auth.signOut({scope:'local'});await r.close();}
});
test('legacy MANUAL provider and non-object raw markers are rejected before processing/classification',async()=>{
 for(const [provider,raw] of [['ocr_manual_import',{}],['SYNTHETIC-OCR',['manual_transcription']],['SYNTHETIC-OCR','manual_transcription']]){
 const r=await createProductRuntime({port:0,scenario:'manual-transcription'});try{
  const token=await login(r,'aOwner'),f=r.config.manifest.fixtures.a,scope={organization_id:f.organizationId,project_id:f.projectId},id=randomUUID();
  // Explicit synthetic maintenance fixture represents historical provider naming, not an OCR success.
  const seeded=await api(r,'/rest/v1/extracted_document_drafts','SYNTHETIC-PRODUCT-SERVICE-KEY',{...scope,id,uploaded_document_id:f.document.documentId,extraction_provider:provider,extraction_version:1,raw_payload:raw,normalized_payload:{quantity:100},status:'pending_review',classification_status:'unclassified',is_latest:false,env:'staging',is_test:true});assert.equal(seeded.status,201,JSON.stringify(seeded.body));
  const process=await api(r,'/functions/v1/process-document',token,{...scope,uploaded_document_id:f.document.documentId,provider_hint:'mock',request_id:randomUUID()});assert.equal(process.status,409,JSON.stringify(process.body));assert.equal(process.body.error.code,'MANUAL_SOURCE_RETAINED');
  const classify=await api(r,'/functions/v1/classify-document',token,{...scope,draft_id:id,model_hint:'mock',normalized_payload:{quantity:0},request_id:randomUUID()});assert.equal(classify.status,409,JSON.stringify(classify.body));assert.equal(classify.body.error.code,'MANUAL_SOURCE_RETAINED');
  const after=await api(r,'/rest/v1/extracted_document_drafts?id=eq.'+id,token,undefined,'GET');assert.equal(after.body.length,1);assert.equal(after.body[0].extraction_provider,provider);assert.deepEqual(after.body[0].raw_payload,raw);assert.deepEqual(after.body[0].normalized_payload,{quantity:100});assert.equal(after.body[0].is_latest,false);
 }finally{await r.close();}
 }
});
