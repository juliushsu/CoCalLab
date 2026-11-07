import {saveSyntheticManualActivity} from './synthetic-manual-activity.js';
// Actual checked-in handlers, installed SDK and SQL; SYNTHETIC Auth/Storage only.
// Deterministic beforeDispatch faults are sequential interleavings, not parallel SQL connections.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createProductRuntime} from '../../tools/product-preview/runtime.js';
import {syntheticPdf} from '../../tools/product-preview/showcase.js';
import {readAuthorizedReportSnapshot} from '../../../frontend/readdy-app/src/services/reportExportRead.ts';
import {exportCurrentSnapshot} from '../../../frontend/readdy-app/src/services/reportDownload.ts';
import {createAuthContinuity} from '../../../frontend/readdy-app/src/services/authContinuity.ts';
const require=createRequire(new URL('../../../frontend/readdy-app/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const service='SYNTHETIC-PRODUCT-SERVICE-KEY';
async function api(r,path,token,body,method='POST'){
 const response=await fetch(r.baseUrl+path,{method,headers:{apikey:r.publicKey,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:response.status,body:await response.json().catch(()=>null)};
}
async function account(r,name){
 const client=createClient(r.baseUrl,r.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const signed=await client.auth.signInWithPassword(r.accounts[name]);assert.equal(signed.error,null);
 return {client,token:signed.data.session.access_token,session:signed.data.session};
}
const scopeOf=(r,b=false)=>({organization_id:b?r.scope.otherOrganizationId:r.scope.organizationId,project_id:b?r.scope.otherProjectId:r.scope.projectId});
async function upload(r,who,b=false){
 const id=randomUUID(),scope=scopeOf(r,b),bytes=syntheticPdf('SYNTHETIC INTEGRATION '+id),path=`staging/${scope.project_id}/${id}.pdf`;
 const result=await who.client.storage.from('staging-receipts').upload(path,new File([bytes],'SYNTHETIC.pdf',{type:'application/pdf'}),{upsert:false});assert.equal(result.error,null);
 return {...scope,document_id:id,request_id:id,storage_bucket:'staging-receipts',storage_path:path,original_filename:'SYNTHETIC.pdf',mime_type:'application/pdf',file_size_bytes:bytes.length,document_type:'receipt'};
}
const verify=(r,who,body)=>api(r,'/functions/v1/verify-upload-receipt',who.token,body);
async function active(r,userId,value){const response=await api(r,'/rest/v1/organization_members?organization_id=eq.'+r.scope.organizationId+'&user_id=eq.'+userId,service,{status:value?'active':'inactive'},'PATCH');assert.equal(response.status,200);}
async function revokeAt(r,path,userId){await r.failNext({path,phase:'beforeDispatch',revokeMembership:{organizationId:r.scope.organizationId,userId}});}
async function generate(r,who,b=false){
 const scope=scopeOf(r,b),activity=await saveSyntheticManualActivity(r,who.token,{...scope,quantity:b?20:100});
 const calculation={...scope,actor_user_id:who.session.user.id,request_id:randomUUID(),force_recalculate:true};const calculated=await api(r,'/functions/v1/recalculate-project',who.token,calculation);assert.equal(calculated.status,200,JSON.stringify(calculated.body));
 const result=await api(r,'/functions/v1/generate-report',who.token,{...scope,report_version:1,claim_purpose:'internal_management',request_id:randomUUID()});assert.equal(result.status,200,JSON.stringify(result.body));
 return {...scope,report_id:result.body.data.report_generation_id,activity_id:activity.id,calculation};
}
const exported=(r,who,body)=>api(r,'/functions/v1/export-report-snapshot',who.token,{organization_id:body.organization_id,project_id:body.project_id,report_id:body.report_id});

test('A/B/shared/viewer integrated reads, direct IDs, attachments, writes and saved exports',async()=>{
 const r=await createProductRuntime({port:0,scenario:'verified-upload'});
 try{
  const a=await account(r,'aOwner'),b=await account(r,'otherOwner'),shared=await account(r,'owner'),viewer=await account(r,'viewer');
  const ar=await generate(r,a),br=await generate(r,b,true),ad=await upload(r,a),bd=await upload(r,b,true);
  assert.equal((await verify(r,a,ad)).status,200);assert.equal((await verify(r,b,bd)).status,200);
  for(const [who,own,foreign,doc]of [[a,ar,br,bd],[b,br,ar,ad]]){
   assert.equal((await exported(r,who,own)).status,200);
   assert.equal((await exported(r,who,foreign)).status,403);
   const idRead=await api(r,'/rest/v1/report_generations?id=eq.'+foreign.report_id,who.token,undefined,'GET');assert.deepEqual(idRead.body,[],'direct report URL/ID cannot retrieve another tenant');
   assert.ok((await who.client.storage.from(doc.storage_bucket).download(doc.storage_path)).error);
   const spoofPath=`staging/${foreign.project_id}/${randomUUID()}.pdf`;
   assert.ok((await who.client.storage.from(doc.storage_bucket).upload(spoofPath,new File([syntheticPdf('SYNTHETIC spoof')],'SYNTHETIC.pdf',{type:'application/pdf'}),{upsert:false})).error,'foreign path write refused by Storage SQL policy');
   const remove=await who.client.storage.from(doc.storage_bucket).remove([doc.storage_path]);
   assert.ok(remove.error||Array.isArray(remove.data)&&remove.data.length===0,'RLS refusal may be a successful empty delete, never a removed row');
   assert.equal((await (who===a?b:a).client.storage.from(doc.storage_bucket).download(doc.storage_path)).error,null,'foreign original remains readable by its actual owner');
   const patch=await api(r,'/rest/v1/emission_activities?id=eq.'+foreign.activity_id,who.token,{quantity:999},'PATCH');assert.deepEqual(patch.body,[]);
  }
  for(const [who,report,doc]of [[shared,br,bd],[viewer,ar,ad]]){
   assert.equal((await api(r,'/rest/v1/report_generations?id=eq.'+report.report_id,who.token,undefined,'GET')).body.length,1,'viewer retains permitted snapshot read');
   assert.equal((await who.client.storage.from(doc.storage_bucket).download(doc.storage_path)).error,null,'same tenant viewer retains permitted private read');
   assert.equal((await exported(r,who,report)).status,403,'read entitlement is not export entitlement');
   assert.equal((await verify(r,who,doc)).status,403);
  }
  assert.equal((await exported(r,shared,ar)).status,200,'shared user remains owner only in A');
  for(const [who,report]of [[a,br],[b,ar]])assert.notEqual((await exported(r,who,{...report,organization_id:scopeOf(r,who===b).organization_id})).status,200,'mixed organization/project IDs refused');
  const browserOrigin='http://127.0.0.1:4207';
  const browserExport=await fetch(r.baseUrl+'/functions/v1/export-report-snapshot',{method:'POST',headers:{Origin:browserOrigin,Authorization:'Bearer '+a.token,'Content-Type':'application/json'},body:JSON.stringify({organization_id:ar.organization_id,project_id:ar.project_id,report_id:ar.report_id})});
  assert.equal(browserExport.status,200,'new preview origin reaches actual CORS-protected handler');assert.equal(browserExport.headers.get('Access-Control-Allow-Origin'),browserOrigin);
  const saved=await exported(r,a,ar);assert.equal(saved.body.data.snapshot.integrity_status,'server_verified');assert.equal(saved.body.data.snapshot.scope_totals.scope_2,50);
 }finally{await r.close();}
});

test('revocation between handler auth and SQL/Storage completion denies old requests, same IDs recover after explicit regrant',async()=>{
 const r=await createProductRuntime({port:0,scenario:'verified-upload'});
 try{
  const a=await account(r,'aOwner'),user=a.session.user.id,report=await generate(r,a);
  await revokeAt(r,'/rest/v1/rpc/read_verified_report_snapshot',user);
  assert.equal((await exported(r,a,report)).status,403,'SQL export must recheck membership after handler auth');
  assert.deepEqual((await api(r,'/rest/v1/report_generations?id=eq.'+report.report_id,a.token,undefined,'GET')).body,[]);
  assert.equal((await exported(r,a,report)).status,403,'old tab token cannot bypass revoked membership');
  await active(r,user,true);assert.equal((await exported(r,a,report)).status,200);

  const calc={...scopeOf(r),actor_user_id:user,request_id:randomUUID(),force_recalculate:true};
  await revokeAt(r,'/rest/v1/rpc/commit_recalculation_v2',user);
  const deniedCalc=await api(r,'/functions/v1/recalculate-project',a.token,calc);assert.notEqual(deniedCalc.status,200);
  const before=await api(r,'/rest/v1/calculation_results?project_id=eq.'+r.scope.projectId,service,undefined,'GET');assert.equal(before.body.length,1,'revoked commit allocated no next version');
  await active(r,user,true);const recoveredCalc=await api(r,'/functions/v1/recalculate-project',a.token,calc);assert.equal(recoveredCalc.status,200);const again=await api(r,'/functions/v1/recalculate-project',a.token,calc);assert.deepEqual(again.body.data.calculation_result_ids,recoveredCalc.body.data.calculation_result_ids);

  const doc=await upload(r,a);
  await revokeAt(r,'/rest/v1/rpc/complete_upload_verification',user);
  assert.notEqual((await verify(r,a,doc)).status,200);
  assert.deepEqual((await api(r,'/rest/v1/uploaded_documents?id=eq.'+doc.document_id,service,undefined,'GET')).body,[]);
  assert.ok((await a.client.storage.from(doc.storage_bucket).download(doc.storage_path)).error,'revoked private read denied');
  await active(r,user,true);assert.equal((await verify(r,a,doc)).status,200,'same original/document/request recovers without retransmission');

  const deletion={...scopeOf(r),document_id:doc.document_id,request_id:randomUUID(),storage_bucket:doc.storage_bucket,storage_path:doc.storage_path};
  await revokeAt(r,'/rest/v1/rpc/finalize_document_deletion',user);
  const deniedDelete=await api(r,'/functions/v1/delete-uploaded-document',a.token,deletion);assert.notEqual(deniedDelete.status,200);
  const receipt=(await api(r,'/rest/v1/uploaded_documents?id=eq.'+doc.document_id,service,undefined,'GET')).body[0];assert.equal(receipt.deletion_state,'pending','no false finalized receipt after revocation');
  await active(r,user,true);const recoveredDelete=await api(r,'/functions/v1/delete-uploaded-document',a.token,deletion);assert.equal(recoveredDelete.status,200,JSON.stringify(recoveredDelete.body));assert.equal(recoveredDelete.body.data.deletion_state,'deleted');
  const config=await (await fetch(r.baseUrl+'/__synthetic/config')).json();assert.equal(config.storageMetrics.writes,1,'recoveries never re-upload bytes');
 }finally{await r.close();}
});

test('actual SDK authorized export is discarded after A→B→A or same-user re-login, routine refresh preserves valid operation',async()=>{
 const r=await createProductRuntime({port:0,scenario:'verified-upload'});
 try{
  const a=await account(r,'aOwner'),report=await generate(r,a);
  for(const event of ['A-B-A','logout-relogin','token-refresh']){
   const continuity=createAuthContinuity(),epoch=continuity.accept('INITIAL_SESSION',a.session);
   const captured={organizationId:report.organization_id,projectId:report.project_id};let current=captured,saves=0,release,ready;
   const loaded=new Promise(resolve=>{ready=resolve;}),gate=new Promise(resolve=>{release=resolve;});
   const operation=exportCurrentSnapshot(async()=>{const saved=await readAuthorizedReportSnapshot(a.client,report.report_id,report.project_id,report.organization_id);ready();await gate;return saved;},'json',()=>current===captured&&continuity.isCurrent(epoch,a.session.user.id),file=>{saves++;const content=JSON.parse(file.content);assert.equal(content.snapshot.scope_totals.scope_2,50);});
   await loaded;
   if(event==='A-B-A'){current={organizationId:r.scope.otherOrganizationId,projectId:r.scope.otherProjectId};current={...captured};}
   else if(event==='logout-relogin'){continuity.accept('SIGNED_OUT',null);continuity.accept('EXPLICIT_SIGN_IN',a.session);}
   else assert.equal(continuity.accept('TOKEN_REFRESHED',{...a.session,expires_at:a.session.expires_at+3600}),epoch);
   release();assert.equal(await operation,event==='token-refresh');assert.equal(saves,event==='token-refresh'?1:0);
  }
  await active(r,a.session.user.id,false);
  const relogin=await account(r,'aOwner');assert.equal((await exported(r,relogin,report)).status,403,'new login does not restore revoked tenant authority');
  await api(r,'/auth/v1/logout',relogin.token,{});assert.equal((await exported(r,relogin,report)).status,401,'logged-out synthetic token is no longer allowlisted');
 }finally{await r.close();}
});
