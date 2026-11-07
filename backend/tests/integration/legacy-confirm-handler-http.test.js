// Frozen 9ebf5b1 handler bytes, current SQL; synthetic loopback SDK/Auth/Storage only.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createProductRuntime} from '../../tools/product-preview/runtime.js';
async function api(r,path,token,body,method='POST'){const response=await fetch(r.baseUrl+path,{method,headers:{apikey:r.publicKey,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json().catch(()=>null)};}
test('frozen 9ebf5b1 legacy confirm handler cannot confirm nonlatest side branch before or after MANUAL confirmation; retry adds nothing',async()=>{
 const r=await createProductRuntime({port:0,scenario:'manual-transcription',legacyConfirm:true});try{
  const logged=await api(r,'/auth/v1/token?grant_type=password','SYNTHETIC-PRODUCT-PUBLIC-KEY',r.accounts.aOwner),token=logged.body.access_token;
  const fixture=r.config.manifest.fixtures.a,scope={organization_id:fixture.organizationId,project_id:fixture.projectId};
  const transcription={activity_name:'SYNTHETIC frozen handler',quantity:100,unit:'kWh',activity_date:'2026-01-15',category:'energy',subcategory:null,activity_type:'electricity',final_scope:2,inclusion_status:'included',exclusion_reason:null,review_note:null,period_start:null,period_end:null,source_locator:'SYNTHETIC page1',source_text:null};
  const manual=await api(r,'/functions/v1/manual-transcription',token,{...scope,document_id:fixture.document.documentId,draft_id:randomUUID(),request_id:randomUUID(),transcription});assert.equal(manual.status,200,JSON.stringify(manual.body));
  const draftId=manual.body.data.draft_id;
  const side={...scope,id:randomUUID(),uploaded_document_id:fixture.document.documentId,extraction_provider:'OCR-SYNTHETIC-FIXTURE',extraction_version:99,is_latest:false,status:'pending_review',raw_payload:{synthetic:true},normalized_payload:transcription};
  assert.equal((await api(r,'/rest/v1/extracted_document_drafts','SYNTHETIC-PRODUCT-SERVICE-KEY',side)).status,201);
  const read=async(table)=>(await api(r,'/rest/v1/'+table+'?organization_id=eq.'+scope.organization_id+'&project_id=eq.'+scope.project_id,token,undefined,'GET')).body;
  for(const phase of ['before','after']){
   if(phase==='after'){const confirmed=await api(r,'/functions/v1/confirm-draft',token,{...scope,draft_id:draftId,decision:'confirmed',request_id:randomUUID()});assert.equal(confirmed.status,200,JSON.stringify(confirmed.body));}
   const snapshot=await Promise.all(['emission_activities','calculation_results','audit_logs'].map(read));
   const body={...scope,draft_id:side.id,decision:'confirmed',request_id:randomUUID()};
   for(let retry=0;retry<2;retry++){const denied=await api(r,'/functions/v1/confirm-draft',token,body);assert.equal(denied.status,409,JSON.stringify(denied.body));assert.equal(denied.body.error.code,'CONFIRM_DRAFT_ATOMIC_FAILED');}
   assert.deepEqual(await Promise.all(['emission_activities','calculation_results','audit_logs'].map(read)),snapshot);
  }
 }finally{await r.close();}
});

test('frozen 9ebf5b1 non-MANUAL confirmation without a source witness fails closed, without creating activity/calculation/audit',async()=>{
 const r=await createProductRuntime({port:0,scenario:'manual-transcription',legacyConfirm:true});try{
  const logged=await api(r,'/auth/v1/token?grant_type=password','SYNTHETIC-PRODUCT-PUBLIC-KEY',r.accounts.aOwner),token=logged.body.access_token;
  const fixture=r.config.manifest.fixtures.a,scope={organization_id:fixture.organizationId,project_id:fixture.projectId};
  const draft={...scope,id:randomUUID(),uploaded_document_id:fixture.document.documentId,extraction_provider:'OCR-SYNTHETIC-FIXTURE',extraction_version:1,is_latest:true,status:'pending_review',raw_payload:{synthetic:true},normalized_payload:{quantity:100,unit:'kWh',activity_date:'2026-01-15'}};
  assert.equal((await api(r,'/rest/v1/extracted_document_drafts','SYNTHETIC-PRODUCT-SERVICE-KEY',draft)).status,201);
  const denied=await api(r,'/functions/v1/confirm-draft',token,{...scope,draft_id:draft.id,decision:'confirmed',request_id:randomUUID()});assert.equal(denied.status,409,JSON.stringify(denied.body));assert.equal(denied.body.error.code,'CONFIRM_DRAFT_ATOMIC_FAILED');
  for(const table of ['emission_activities','calculation_results','audit_logs']){const rows=await api(r,'/rest/v1/'+table+'?organization_id=eq.'+scope.organization_id+'&project_id=eq.'+scope.project_id,token,undefined,'GET');assert.deepEqual(rows.body,[]);}
 }finally{await r.close();}
});
