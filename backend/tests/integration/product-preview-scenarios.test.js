// Local SYNTHETIC M2 showcase only. No real Auth/Storage/cloud E2E claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash,randomUUID} from 'node:crypto';
import {createProductRuntime} from '../../tools/product-preview/runtime.js';
import {buildDraftDecision,isSyntheticDraft} from '../../../frontend/readdy-app/src/services/draftReview.ts';
import {readPrivateOriginal} from '../../../frontend/readdy-app/src/services/documentLibrary.ts';
const require=createRequire(new URL('../../../frontend/readdy-app/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
async function call(r,path,token,body,method='GET'){
  const response=await fetch(r.baseUrl+path,{method,headers:{apikey:r.publicKey,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const text=await response.text();return {status:response.status,body:text?JSON.parse(text):null};
}
async function login(r,name){const result=await call(r,'/auth/v1/token?grant_type=password',null,r.accounts[name],'POST');assert.equal(result.status,200);return result.body.access_token;}
async function list(r,table,token,query=''){const result=await call(r,'/rest/v1/'+table+(query?'?'+query:''),token);assert.equal(result.status,200,JSON.stringify(result.body));return result.body;}
const filter=scope=>'organization_id=eq.'+scope.organizationId+'&project_id=eq.'+scope.projectId;

test('showcase manifest uses fresh A/B real-handler results, and A-only/B-only/shared/viewer/outsider see their real SQL scopes',async()=>{
  const r=await createProductRuntime({port:0,scenario:'showcase'});
  try{
    const config=(await call(r,'/__synthetic/config')).body;assert.equal(config.synthetic,true);assert.equal(config.scenario,'showcase');assert.equal(JSON.stringify(config).includes('SYNTHETIC-PRODUCT-SERVICE-KEY'),false);
    const f=config.manifest.fixtures;assert.equal(config.manifest.synthetic,true);assert.ok(config.manifest.notRun.includes('real Supabase Auth/JWT/Storage HTTP'));
    const a=await login(r,'aOwner'),b=await login(r,'otherOwner'),shared=await login(r,'owner'),viewer=await login(r,'viewer'),outsider=await login(r,'outsider');
    for(const [token,orgs,projects]of [[a,[f.a.organizationId],4],[b,[f.b.organizationId],1],[shared,[f.a.organizationId,f.b.organizationId],5],[viewer,[f.a.organizationId],4],[outsider,[],0]]){
      const rows=await list(r,'projects',token);assert.equal(rows.length,projects);assert.ok(rows.every(row=>orgs.includes(row.organization_id)));
      for(const table of ['emission_activities','calculation_results','report_generations','uploaded_documents','extracted_document_drafts'])assert.ok((await list(r,table,token)).every(row=>orgs.includes(row.organization_id)));
    }
    for(const [scope,token,kg]of [[f.a,a,50],[f.b,b,10]]){
      const reports=await list(r,'report_generations',token,filter(scope));assert.equal(reports.length,1);assert.equal(reports[0].id,scope.reportId);assert.equal(reports[0].gross_emissions_snapshot.gross_total_co2e_kg,kg);
      const calc=await list(r,'calculation_results',token,filter(scope));assert.equal(calc.length,1);assert.equal(calc[0].co2e_kg,kg);assert.equal(calc[0].status,'calculated');assert.equal(calc[0].factor_snapshot.source_name,'SYNTHETIC TEST ONLY');
    }
    assert.deepEqual(await list(r,'report_generations',a,filter(f.b)),[]);
    const forbidden=await call(r,'/functions/v1/recalculate-project',shared,{organization_id:f.b.organizationId,project_id:f.b.projectId,actor_user_id:r.scope.userId,force_recalculate:true,request_id:randomUUID()},'POST');assert.equal(forbidden.status,403);
  }finally{await r.close();}
});

test('showcase empty/pending-factor/error cases preserve actual NULL failures and never create success reports',async()=>{
  const r=await createProductRuntime({port:0,scenario:'showcase'});
  try{
    const token=await login(r,'aOwner'),f=r.config.manifest.fixtures;
    for(const table of ['emission_activities','calculation_results','report_generations'])assert.deepEqual(await list(r,table,token,filter(f.empty)),[]);
    for(const [scope,status,error]of [[f.pendingFactor,'pending_factor','FACTOR_NOT_FOUND'],[f.error,'error','UNSUPPORTED_UNIT']]){
      const rows=await list(r,'calculation_results',token,filter(scope));assert.equal(rows.length,1);assert.equal(rows[0].status,status);assert.equal(rows[0].co2e_kg,null);assert.equal(rows[0].error_code,error);
      const report=await call(r,'/functions/v1/generate-report',token,{organization_id:scope.organizationId,project_id:scope.projectId,report_version:1,request_id:randomUUID()},'POST');assert.equal(report.body.success,false);assert.deepEqual(await list(r,'report_generations',token,filter(scope)),[]);
    }
    const unknown=await call(r,'/functions/v1/unknown-business-feature',token,{},'POST');assert.equal(unknown.status,404);
  }finally{await r.close();}
});

test('showcase synthetic draft cannot pass existing UI confirmation; actual handler reject is scoped and persisted without activity creation',async()=>{
  const r=await createProductRuntime({port:0,scenario:'showcase'});
  try{
    const token=await login(r,'aOwner'),viewer=await login(r,'viewer'),f=r.config.manifest.fixtures,scope={organizationId:f.a.organizationId,projectId:f.a.projectId};
    const draft=(await list(r,'extracted_document_drafts',token,'id=eq.'+f.a.document.draftId))[0];assert.equal(draft.extraction_provider,'SYNTHETIC-REVIEW-FIXTURE');assert.equal(draft.status,'pending_review');assert.equal(isSyntheticDraft(draft),true);
    assert.throws(()=>buildDraftDecision(draft,'confirmed',scope),/Mock|合成/);
    const payload=buildDraftDecision(draft,'rejected',scope,{reviewNote:'SYNTHETIC rejection through normal handler'});
    const denied=await call(r,'/functions/v1/confirm-draft',viewer,payload,'POST');assert.equal(denied.status,403);
    const rejected=await call(r,'/functions/v1/confirm-draft',token,payload,'POST');assert.equal(rejected.status,200,JSON.stringify(rejected.body));assert.equal(rejected.body.data.draft_status,'rejected');assert.equal(rejected.body.data.emission_activity_id,null);
    const saved=(await list(r,'extracted_document_drafts',token,'id=eq.'+draft.id))[0];assert.equal(saved.status,'rejected');assert.equal(saved.reviewed_by_user_id,r.scope.aOwnerId);
    assert.equal((await list(r,'emission_activities',token,filter(f.a))).length,1);assert.equal((await list(r,'calculation_results',token,filter(f.a))).length,1);
    assert.equal((await list(r,'uploaded_documents',token,'id=eq.'+f.a.document.documentId))[0].ocr_status,'pending');
    const mismatch=await call(r,'/functions/v1/confirm-draft',token,{...payload,project_id:f.pendingFactor.projectId},'POST');assert.equal(mismatch.status,404);
  }finally{await r.close();}
});

test('showcase synthetic private originals use actual Storage RLS before bytes, match SHA/signature, and deny public/cross-tenant/anonymous access',async()=>{
  const r=await createProductRuntime({port:0,scenario:'showcase'});
  try{
    const a=await login(r,'aOwner'),shared=await login(r,'owner'),f=r.config.manifest.fixtures;
    const client=createClient(r.baseUrl,r.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:'Bearer '+a}}});
    const original=await readPrivateOriginal(client,f.a.document.documentId,f.a,r.scope.aOwnerId);assert.equal(original.previewable,true);assert.equal(original.blob.type,'application/pdf');assert.equal(original.blob.size,f.a.document.bytes);assert.equal(createHash('sha256').update(Buffer.from(await original.blob.arrayBuffer())).digest('hex'),f.a.document.sha256);
    const path=doc=>'/storage/v1/object/authenticated/'+doc.bucket+'/'+doc.path;
    for(const token of [a,undefined]){const response=await fetch(r.baseUrl+path(f.b.document),{headers:token?{Authorization:'Bearer '+token}:{}});assert.equal(response.status,404);}
    const sharedRead=await fetch(r.baseUrl+path(f.b.document),{headers:{Authorization:'Bearer '+shared}});assert.equal(sharedRead.status,200);assert.equal(createHash('sha256').update(Buffer.from(await sharedRead.arrayBuffer())).digest('hex'),f.b.document.sha256);
    const publicRead=await fetch(r.baseUrl+'/storage/v1/object/public/'+f.a.document.bucket+'/'+f.a.document.path);assert.equal(publicRead.status,404);
    const removal=await fetch(r.baseUrl+path(f.a.document),{method:'DELETE',headers:{Authorization:'Bearer '+a}});assert.equal(removal.status,405);
    const upload=await fetch(r.baseUrl+'/storage/v1/object/'+f.a.document.bucket+'/unsupported.pdf',{method:'POST',headers:{Authorization:'Bearer '+a},body:'SYNTHETIC'});assert.equal(upload.status,405);
  }finally{await r.close();}
});
