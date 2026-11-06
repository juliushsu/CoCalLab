// Installed SDK + actual checked-in handlers/SQL. Synthetic local Auth/Storage;
// these sequential fault tests are not independent SQL/real Storage concurrency.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';
import {createProductRuntime} from '../../tools/product-preview/runtime.js';
import {syntheticPdf} from '../../tools/product-preview/showcase.js';
import {documentDeletionOperation,locateDocumentDeletion} from '../../../frontend/readdy-app/src/services/documentDeletion.ts';
const require=createRequire(new URL('../../../frontend/readdy-app/package.json',import.meta.url)),{createClient}=require('@supabase/supabase-js');
const service='SYNTHETIC-PRODUCT-SERVICE-KEY',pdf=syntheticPdf('CONTROLLED DELETE TEST');
async function setup(){const r=await createProductRuntime({port:0,scenario:'verified-upload'}),client=createClient(r.baseUrl,r.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});const signed=await client.auth.signInWithPassword(r.accounts.aOwner);assert.equal(signed.error,null);return {r,client,token:signed.data.session.access_token};}
async function api(r,path,token,body,method='POST'){const response=await fetch(r.baseUrl+path,{method,headers:{apikey:r.publicKey,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json().catch(()=>null)};}
async function upload(r,client,{verify=true,bytes=pdf}={}){
 const id=randomUUID(),path=`staging/${r.scope.projectId}/${id}.pdf`,result=await client.storage.from('staging-receipts').upload(path,new File([bytes],'SYNTHETIC.pdf',{type:'application/pdf'}),{upsert:false});assert.equal(result.error,null);
 const input={organization_id:r.scope.organizationId,project_id:r.scope.projectId,document_id:id,request_id:id,storage_bucket:'staging-receipts',storage_path:path,original_filename:'SYNTHETIC.pdf',mime_type:'application/pdf',file_size_bytes:bytes.length,document_type:'receipt'};
 if(verify){const result=await client.functions.invoke('verify-upload-receipt',{body:input});assert.equal(result.error,null,JSON.stringify(result.data));assert.equal(result.data.data.state,'verified');}
 return input;
}
const deletion=(v,extra={})=>({organization_id:v.organization_id,project_id:v.project_id,document_id:v.document_id,request_id:randomUUID(),storage_bucket:v.storage_bucket,storage_path:v.storage_path,...extra});
const remove=(r,token,input)=>api(r,'/functions/v1/delete-uploaded-document',token,input);

test('verified original controlled delete -> retained tombstone; same intent and lost local descriptor recover, hash slot releases only after finalize',async()=>{
 const {r,client,token}=await setup();try{
  const cap=await client.rpc('document_deletion_contract',{p_project_id:r.scope.projectId});assert.equal(cap.error,null);assert.equal(cap.data[0].can_delete,true);assert.equal(cap.data[0].contract_version,'20261106.delete.1');
  assert.equal((await client.rpc('upload_verification_contract',{p_project_id:r.scope.projectId})).data[0].can_verify,true);
  const v=await upload(r,client),input=deletion(v),before=await remove(r,token,{...input,action:'lookup'});assert.equal(before.body.data.operation_status,'not_found');assert.equal(before.body.data.storage_absent,null);
  const done=await remove(r,token,input);assert.equal(done.status,200,JSON.stringify(done.body));assert.equal(done.body.data.operation_status,'deleted');assert.equal(done.body.data.storage_absent,true);assert.equal(done.body.data.receipt_present,true);assert.equal(done.body.data.deletion_state,'deleted');assert.equal(done.body.data.original_missing,false);
  const receipt=await client.from('uploaded_documents').select('*').eq('id',v.document_id).single();assert.equal(receipt.data.status,'archived');assert.equal(receipt.data.deletion_request_id,input.request_id);assert.equal(receipt.data.deletion_state,'deleted');
  assert.ok((await client.storage.from(v.storage_bucket).download(v.storage_path)).error);assert.ok((await client.storage.from(v.storage_bucket).upload(v.storage_path,new File([pdf],'SYNTHETIC.pdf',{type:'application/pdf'}),{upsert:false})).error);
  const {storage_bucket,storage_path,...minimal}=input;const retry=await remove(r,token,minimal);assert.equal(retry.body.data.replayed,true);assert.equal(retry.body.data.deleted_at,done.body.data.deleted_at);
  assert.equal((await remove(r,token,{...input,request_id:randomUUID()})).status,409);
  const old=await client.functions.invoke('verify-upload-receipt',{body:v});assert.ok(old.error); // no resurrection of old authority
  const fresh=await upload(r,client);assert.notEqual(fresh.document_id,v.document_id);const current=await client.from('uploaded_documents').select('id').eq('hash_verification_status','server_verified').eq('deletion_state','active');assert.deepEqual(current.data.map(x=>x.id),[fresh.document_id]);
 }finally{await r.close();}
});

test('Storage failure/403/empty ACK preserve pending and never archive; same request retries with exact original ID',async()=>{
 for(const fault of [{status:503},{status:403},{status:200,body:[]}]){const {r,client,token}=await setup();try{
  const v=await upload(r,client),input=deletion(v);await r.failNext({path:'/storage/v1/object/'+v.storage_bucket,method:'DELETE',...fault});
  const failed=await remove(r,token,input);assert.equal(failed.status,502,JSON.stringify(failed.body));assert.equal(failed.body.success,false);
  const lookup=await remove(r,token,{...input,action:'lookup'});assert.equal(lookup.body.data.operation_status,'pending');assert.equal(lookup.body.data.phase,'prepared');assert.equal(lookup.body.data.storage_absent,false);
  const row=await client.from('uploaded_documents').select('deletion_state').eq('id',v.document_id).single();assert.equal(row.data.deletion_state,'pending');assert.ok((await client.storage.from(v.storage_bucket).download(v.storage_path)).error);
  assert.equal((await remove(r,token,input)).body.data.operation_status,'deleted');
 }finally{await r.close();}}
});

test('delete/finalize response loss and finalize failure recover same request without false success or a new upload',async()=>{
 for(const stage of ['delete-loss','finalize-fail','finalize-loss']){const {r,client,token}=await setup();try{
  const v=await upload(r,client),input=deletion(v);
  await r.failNext(stage==='delete-loss'?{path:'/storage/v1/object/'+v.storage_bucket,method:'DELETE',phase:'afterCommit'}:{path:'/rest/v1/rpc/finalize_document_deletion',...(stage==='finalize-loss'?{phase:'afterCommit'}:{})});
  assert.equal((await remove(r,token,input)).body.success,false);
  const saved=await remove(r,token,{...input,action:'lookup'});assert.equal(saved.body.data.storage_absent,true);assert.equal(saved.body.data.operation_status,stage==='finalize-loss'?'deleted':'pending');assert.equal(saved.body.data.phase,stage==='finalize-loss'?'finalized':'object_absent');
  const retry=await remove(r,token,input);assert.equal(retry.body.data.operation_status,'deleted');
  const audit=await api(r,'/rest/v1/audit_logs?organization_id=eq.'+r.scope.organizationId+'&project_id=eq.'+r.scope.projectId,service,undefined,'GET');assert.equal(audit.body.filter(x=>x.action==='document_delete_prepared').length,1);assert.equal(audit.body.filter(x=>x.action==='document_delete_finalized').length,1);
  const config=await (await fetch(r.baseUrl+'/__synthetic/config')).json();assert.equal(config.storageMetrics.writes,1);
 }finally{await r.close();}}
});

test('owned orphan and duplicate attempt are explicitly deleted without deleting a different existing verified receipt',async()=>{
 const {r,client,token}=await setup();try{
  const orphan=await upload(r,client,{verify:false});const removed=await remove(r,token,deletion(orphan));assert.equal(removed.body.data.operation_status,'deleted');assert.equal(removed.body.data.receipt_present,false);assert.equal(removed.body.data.deletion_state,null);
  const first=await upload(r,client),duplicate=await upload(r,client,{verify:false});const verified=await client.functions.invoke('verify-upload-receipt',{body:duplicate});assert.equal(verified.data.data.state,'duplicate');assert.equal(verified.data.data.receipt.id,first.document_id);
  const gone=await remove(r,token,deletion(duplicate));assert.equal(gone.body.data.operation_status,'deleted');assert.equal(gone.body.data.receipt_present,false);
  assert.equal((await client.from('uploaded_documents').select('deletion_state').eq('id',first.document_id).single()).data.deletion_state,'active');assert.equal((await client.storage.from(first.storage_bucket).download(first.storage_path)).error,null);
 }finally{await r.close();}
});

test('scope/role/actor/path/RPC forgery and post-prepare revocation deny deletion, with retained pending state',async()=>{
 const {r,client,token}=await setup();try{
  const v=await upload(r,client),input=deletion(v);
  for(const name of ['viewer','otherOwner','owner']){const signed=await api(r,'/auth/v1/token?grant_type=password','',r.accounts[name]);const denied=await remove(r,signed.body.access_token,input);assert.equal(denied.status,name==='owner'?200:403,JSON.stringify(denied.body));if(name==='owner'){
    // Shared A owner is a legitimate writer, so this explicitly reserves its
    // own operation. The original uploader cannot steal the actor-bound intent.
    assert.equal(denied.body.data.operation_status,'deleted');
   }}
  const second=await upload(r,client,{bytes:syntheticPdf('SECOND DELETE ROLE TEST')}),op=deletion(second);
  assert.equal((await remove(r,token,{...op,actor_user_id:r.scope.userId})).status,400);assert.equal((await remove(r,token,{...op,storage_path:op.storage_path+'x'})).status,409);
  const direct=await client.rpc('document_deletion_request',{p_actor_user_id:r.scope.aOwnerId,p_input:op,p_action:'prepare'});assert.equal(direct.error.code,'42501');
  await r.failNext({path:'/storage/v1/object/'+second.storage_bucket,method:'DELETE'});assert.equal((await remove(r,token,op)).status,502);
  const shared=await api(r,'/auth/v1/token?grant_type=password','',r.accounts.owner);assert.equal((await remove(r,shared.body.access_token,op)).status,409);
  await api(r,'/rest/v1/organization_members?organization_id=eq.'+r.scope.organizationId+'&user_id=eq.'+r.scope.aOwnerId,service,{status:'inactive'},'PATCH');assert.equal((await remove(r,token,op)).status,403);
  const row=await api(r,'/rest/v1/uploaded_documents?id=eq.'+second.document_id,service,undefined,'GET');assert.equal(row.body[0].deletion_state,'pending');
 }finally{await r.close();}
});

test('actual SDK verified bytes -> MANUAL no-OCR transcription/confirm -> idempotent recalc -> saved 50kg report; referenced original cannot delete',async()=>{
 const {r,client,token}=await setup();try{
  const v=await upload(r,client),draftId=randomUUID();
  const transcription={activity_name:'SYNTHETIC source electricity',quantity:100,unit:'kWh',activity_date:'2026-01-15',category:'energy',subcategory:null,activity_type:'electricity',final_scope:2,inclusion_status:'included',exclusion_reason:null,review_note:null,period_start:'2026-01-01',period_end:'2026-01-31',source_locator:'Page 1 quantity',source_text:'SYNTHETIC 100 kWh'};
  const made=await client.functions.invoke('manual-transcription',{body:{organization_id:v.organization_id,project_id:v.project_id,document_id:v.document_id,draft_id:draftId,request_id:randomUUID(),transcription}});assert.equal(made.error,null,JSON.stringify(made.data));assert.equal(made.data.data.extraction_provider,'MANUAL_TRANSCRIPTION_NO_OCR');
  const reviewed=await client.functions.invoke('confirm-draft',{body:{organization_id:v.organization_id,project_id:v.project_id,draft_id:draftId,decision:'confirmed',request_id:randomUUID(),overrides:{review_note:'SYNTHETIC reviewed same person'}}});assert.equal(reviewed.error,null,JSON.stringify(reviewed.data));
  const request={organization_id:v.organization_id,project_id:v.project_id,actor_user_id:r.scope.aOwnerId,force_recalculate:true,request_id:randomUUID()};
  const first=await client.functions.invoke('recalculate-project',{body:request});assert.equal(first.error,null,JSON.stringify(first.data));const replay=await client.functions.invoke('recalculate-project',{body:request});assert.equal(replay.error,null);assert.equal(replay.data.data.replayed,true);assert.deepEqual(replay.data.data.calculation_result_ids,first.data.data.calculation_result_ids);
  const results=await client.from('calculation_results').select('*').eq('project_id',v.project_id).order('calc_version');assert.deepEqual(results.data.map(x=>x.calc_version),[1,2]);assert.equal(results.data[1].co2e_kg,50);
  const saved=await client.functions.invoke('generate-report',{body:{organization_id:v.organization_id,project_id:v.project_id,report_version:1,claim_purpose:'internal_management',request_id:randomUUID()}});assert.equal(saved.error,null,JSON.stringify(saved.data));const read=await client.from('report_generations').select('*').eq('id',saved.data.data.report_generation_id).single();assert.equal(read.data.gross_emissions_snapshot.gross_total_co2e_kg,50);assert.equal(read.data.gross_emissions_snapshot.gross_total_co2e_kg/1000,0.05);assert.equal(read.data.payload.appendix_mappings[0].source_document_id,v.document_id);
  const refused=await remove(r,token,deletion(v));assert.equal(refused.status,409);assert.match(refused.body.error.message,/DOCUMENT_HAS_REFERENCES/);assert.equal((await client.storage.from(v.storage_bucket).download(v.storage_path)).error,null);assert.equal((await client.from('uploaded_documents').select('ocr_status,deletion_state').eq('id',v.document_id).single()).data.ocr_status,'pending');
 }finally{await r.close();}
});

test('orphan cleanup intent cannot delete a receipt registered first; cleanup prepared first prevents later registration',async()=>{
 const {r,client,token}=await setup();try{
  const registered=await upload(r,client),safe=deletion(registered,{expected_receipt_absent:true});
  const refused=await remove(r,token,safe);assert.equal(refused.status,409);assert.equal(refused.body.error.code,'RECEIPT_ALREADY_REGISTERED');
  assert.equal((await client.from('uploaded_documents').select('deletion_state').eq('id',registered.document_id).single()).data.deletion_state,'active');assert.equal((await client.storage.from(registered.storage_bucket).download(registered.storage_path)).error,null);
  const unregistered=await upload(r,client,{verify:false}),op=deletion(unregistered,{expected_receipt_absent:true});
  await r.failNext({path:'/storage/v1/object/'+unregistered.storage_bucket,method:'DELETE'});assert.equal((await remove(r,token,op)).status,502);
  const late=await client.functions.invoke('verify-upload-receipt',{body:unregistered});assert.ok(late.error);assert.equal((await late.error.context.json()).success,false);
  assert.equal((await client.from('uploaded_documents').select('id').eq('id',unregistered.document_id)).data.length,0);
  assert.equal((await remove(r,token,{...op,expected_receipt_absent:false})).status,409);
  assert.equal((await remove(r,token,{...op,action:'lookup'})).body.data.operation_status,'pending');assert.equal((await remove(r,token,op)).body.data.operation_status,'deleted');
  assert.equal((await remove(r,token,{...op,request_id:'not-a-uuid'})).status,400);
 }finally{await r.close();}
});

test('receipt with already missing original records that fact; pending deletion prevents the actual manual handler creating a draft',async()=>{
 const {r,client,token}=await setup();try{
  const missing=await upload(r,client),removed=await api(r,'/storage/v1/object/'+missing.storage_bucket,service,{prefixes:[missing.storage_path]},'DELETE');assert.equal(removed.body.length,1); // explicit synthetic service maintenance only
  const done=await remove(r,token,deletion(missing));assert.equal(done.body.data.operation_status,'deleted');assert.equal(done.body.data.original_missing,true);
  const v=await upload(r,client,{bytes:syntheticPdf('FENCED MANUAL TEST')}),op=deletion(v);await r.failNext({path:'/storage/v1/object/'+v.storage_bucket,method:'DELETE'});assert.equal((await remove(r,token,op)).status,502);
  const input={organization_id:v.organization_id,project_id:v.project_id,document_id:v.document_id,draft_id:randomUUID(),request_id:randomUUID(),transcription:{activity_name:'SYNTHETIC',quantity:100,unit:'kWh',activity_date:'2026-01-15',category:'energy',subcategory:null,activity_type:'electricity',final_scope:2,inclusion_status:'included',exclusion_reason:null,review_note:null,period_start:null,period_end:null,source_locator:'Page 1',source_text:null}};
  const late=await client.functions.invoke('manual-transcription',{body:input});assert.ok(late.error);assert.equal((await late.error.context.json()).success,false);assert.equal((await client.from('extracted_document_drafts').select('id').eq('uploaded_document_id',v.document_id)).data.length,0);
 }finally{await r.close();}
});

test('actual installed SDK frontend deletion service accepts pending object absence and same-ID confirmed recovery',async()=>{
 const {r,client}=await setup();try{
  const v=await upload(r,client),scope={organizationId:v.organization_id,projectId:v.project_id},attempt={documentId:v.document_id,requestId:randomUUID(),storageBucket:v.storage_bucket,storagePath:v.storage_path};
  assert.equal((await documentDeletionOperation(client,scope,r.scope.aOwnerId,attempt,'lookup')).operation_status,'not_found');
  await r.failNext({path:'/rest/v1/rpc/finalize_document_deletion'});await assert.rejects(documentDeletionOperation(client,scope,r.scope.aOwnerId,attempt,'delete'));
  const pending=await documentDeletionOperation(client,scope,r.scope.aOwnerId,attempt,'lookup');assert.equal(pending.phase,'object_absent');assert.equal(pending.deletion_state,'pending');
  const done=await documentDeletionOperation(client,scope,r.scope.aOwnerId,attempt,'delete');assert.equal(done.operation_status,'deleted');assert.equal(done.request_id,attempt.requestId);
 }finally{await r.close();}
});

test('actual process handler provider/read/write failures end their own lease; failed release deliberately retains blocking work',async()=>{
 for(const failure of ['provider','read','write','write-ack','release']){const {r,client,token}=await setup();try{
  const v=await upload(r,client),body={organization_id:v.organization_id,project_id:v.project_id,uploaded_document_id:v.document_id,request_id:randomUUID()};
  const fault=failure==='provider'?{point:'mock-provider'}:failure==='read'?{path:'/rest/v1/uploaded_documents',method:'GET'}:failure==='write'?{path:'/rest/v1/rpc/finish_document_processing'}:failure==='write-ack'?{path:'/rest/v1/rpc/finish_document_processing',status:200,body:[]}:{point:'mock-provider',path:'/rest/v1/rpc/release_document_processing'};
  await r.failNext(fault);const response=await client.functions.invoke('process-document',{body});assert.ok(response.error);
  assert.equal((await client.from('extracted_document_drafts').select('id').eq('uploaded_document_id',v.document_id)).data.length,0);
  const row=(await client.from('uploaded_documents').select('ocr_status,deletion_state').eq('id',v.document_id).single()).data;assert.equal(row.ocr_status,failure==='release'?'processing':'pending');
  const deletionResult=await remove(r,token,deletion(v));assert.equal(deletionResult.status,failure==='release'?409:200);if(failure==='release')assert.match(deletionResult.body.error.message,/DOCUMENT_HAS_REFERENCES/);
 }finally{await r.close();}}
});

test('actual legacy mock process handler completes its SQL wrapper lease and preserves draft reference retention (not real OCR)',async()=>{
 const {r,client,token}=await setup();try{
  const v=await upload(r,client);const result=await client.functions.invoke('process-document',{body:{organization_id:v.organization_id,project_id:v.project_id,uploaded_document_id:v.document_id,request_id:randomUUID()}});assert.equal(result.error,null,JSON.stringify(result.data));assert.equal(result.data.data.provider.name,'mock-ocr');
  assert.equal((await client.from('uploaded_documents').select('ocr_status').eq('id',v.document_id).single()).data.ocr_status,'succeeded');
  const denied=await remove(r,token,deletion(v));assert.equal(denied.status,409);assert.match(denied.body.error.message,/DOCUMENT_HAS_REFERENCES/);
 }finally{await r.close();}
});

test('readonly locate recovers orphan original request after local-reference loss, but cannot reveal or adopt another actor/mode/path intent',async()=>{
 const {r,client,token}=await setup();try{
  const v=await upload(r,client,{verify:false}),op=deletion(v,{expected_receipt_absent:true});
  const {request_id,...locate}=op;await r.failNext({path:'/storage/v1/object/'+v.storage_bucket,method:'DELETE'});assert.equal((await remove(r,token,op)).status,502);
  const located=await remove(r,token,{...locate,action:'locate'});assert.equal(located.status,200,JSON.stringify(located.body));assert.equal(located.body.data.request_id,request_id);assert.equal(located.body.data.operation_status,'pending');assert.equal(located.body.data.storage_absent,false);
  const sdkLocated=await locateDocumentDeletion(client,{organizationId:v.organization_id,projectId:v.project_id},r.scope.aOwnerId,{documentId:v.document_id,storageBucket:v.storage_bucket,storagePath:v.storage_path,expectedReceiptAbsent:true});assert.equal(sdkLocated.request_id,request_id);
  const shared=await api(r,'/auth/v1/token?grant_type=password','',r.accounts.owner);
  for(const [who,extra]of [[shared.body.access_token,{}],[token,{expected_receipt_absent:false}],[token,{storage_path:v.storage_path+'x'}]]){
   const hidden=await remove(r,who,{...locate,...extra,action:'locate'});assert.equal(hidden.status,200);assert.equal(hidden.body.data.operation_status,'not_found');assert.equal(hidden.body.data.request_id,null);assert.equal(hidden.body.data.storage_absent,null);
  }
  const lookup=await remove(r,token,{...op,action:'lookup'});assert.equal(lookup.body.data.phase,'prepared');
  assert.equal((await remove(r,token,{...locate,request_id:located.body.data.request_id})).body.data.operation_status,'deleted');
 }finally{await r.close();}
});
