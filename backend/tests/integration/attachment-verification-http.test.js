// Actual installed SDK + local HTTP/handler/SQL. Synthetic Auth/Storage substitute;
// no real Supabase or independent SQL-connection concurrency acceptance claim.
import test from 'node:test';import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';import {createRequire} from 'node:module';
import {createProductRuntime} from '../../tools/product-preview/runtime.js';
import {uploadIntake,completeIntakeRegistration} from '../../../frontend/readdy-app/src/services/documentIntake.ts';
import {syntheticPdf} from '../../tools/product-preview/showcase.js';
const require=createRequire(new URL('../../../frontend/readdy-app/package.json',import.meta.url)),{createClient}=require('@supabase/supabase-js');
const pdf=syntheticPdf('SERVER HASH TEST'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function setup(){const runtime=await createProductRuntime({port:0,scenario:'verified-upload'});const client=createClient(runtime.baseUrl,runtime.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});const signed=await client.auth.signInWithPassword(runtime.accounts.aOwner);assert.equal(signed.error,null);return {runtime,client,token:signed.data.session.access_token};}
async function post(r,path,token,body,method='POST'){const response=await fetch(r.baseUrl+path,{method,headers:{Authorization:'Bearer '+token,apikey:r.publicKey,'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();return {status:response.status,body:text?JSON.parse(text):null};}
async function upload(r,client,bytes=pdf,type='application/pdf',ext='pdf',bucket='staging-receipts'){
 const id=randomUUID(),path=`${bucket==='documents'?'':'staging/'}${r.scope.projectId}/${id}.${ext}`,result=await client.storage.from(bucket).upload(path,new File([bytes],'SYNTHETIC.'+ext,{type}),{upsert:false,contentType:type});assert.equal(result.error,null,JSON.stringify(result.error));return {organization_id:r.scope.organizationId,project_id:r.scope.projectId,document_id:id,request_id:id,storage_bucket:bucket,storage_path:path,original_filename:'SYNTHETIC.'+ext,document_type:'receipt',file_size_bytes:bytes.length,mime_type:type};
}
const verify=(r,token,input)=>post(r,'/functions/v1/verify-upload-receipt',token,input);
function journal(){const map=new Map();return {save:v=>map.set(v.documentId,{...v}),clear:v=>map.delete(v.documentId),list:(user,scope)=>[...map.values()].filter(v=>v.userId===user&&v.organizationId===scope.organizationId&&v.projectId===scope.projectId)};}

test('actual SDK Storage write -> server bytes SHA -> authoritative receipt, false client SHA cannot claim another unique hash',async()=>{
 const {runtime:r,client,token}=await setup();try{
  const probe=await client.rpc('upload_verification_contract',{p_project_id:r.scope.projectId});assert.equal(probe.error,null);assert.equal(probe.data[0].can_verify,true);assert.equal(probe.data[0].contract_version,'20261106.hash.1');
  const input=await upload(r,client),result=await verify(r,token,{...input,client_sha256:'b'.repeat(64)});assert.equal(result.status,200,JSON.stringify(result.body));const data=result.body.data;assert.equal(data.state,'verified');assert.equal(data.receipt.sha256_hash,hash(pdf));assert.equal(data.server_proof.sha256_hash,hash(pdf));assert.equal(data.receipt.hash_verification_status,'server_verified');assert.equal(data.server_proof.storage_object_id,data.receipt.verified_storage_object_id);
  const falseClaim=await client.from('uploaded_documents').select('id').eq('sha256_hash','b'.repeat(64));assert.equal(falseClaim.data.length,0);
  assert.ok((await client.storage.from(input.storage_bucket).remove([input.storage_path])).error);
  const removed=await client.from('uploaded_documents').delete().eq('id',input.document_id);assert.equal(removed.error.code,'42501');
 }finally{await r.close();}
});
test('reserved bad content/read failures retain the same reference, never insert trusted receipt, and transient read retry needs no upload',async()=>{
 const {runtime:r,client,token}=await setup();try{
  const invalid=await upload(r,client,Buffer.from('NOT A PDF'));const bad=await verify(r,token,invalid);assert.equal(bad.body.error.code,'FILE_SIGNATURE_INVALID');assert.ok((await client.storage.from(invalid.storage_bucket).remove([invalid.storage_path])).error);
  const input=await upload(r,client);await r.failNext({path:'/storage/v1/object/authenticated/'+input.storage_bucket+'/'+input.storage_path,method:'GET'});const failed=await verify(r,token,input);assert.equal(failed.body.success,false);
  const before=await client.from('uploaded_documents').select('id');assert.equal(before.data.length,0);const retried=await verify(r,token,input);assert.equal(retried.status,200,JSON.stringify(retried.body));assert.equal(retried.body.data.receipt.id,input.document_id);
  const config=await (await fetch(r.baseUrl+'/__synthetic/config')).json();assert.equal(config.storageMetrics.writes,2);
 }finally{await r.close();}
});
test('begin/complete response-loss recovery and duplicate receipt reuse preserve original IDs, target proof and protected duplicate original',async()=>{
 const {runtime:r,client,token}=await setup();try{
  const input=await upload(r,client);await r.failNext({path:'/rest/v1/rpc/begin_upload_verification',phase:'afterCommit'});assert.equal((await verify(r,token,input)).body.success,false);
  await r.failNext({path:'/rest/v1/rpc/complete_upload_verification',phase:'afterCommit'});assert.equal((await verify(r,token,input)).body.success,false);
  const recovered=await verify(r,token,input);assert.equal(recovered.status,200,JSON.stringify(recovered.body));assert.equal(recovered.body.data.receipt.id,input.document_id);
  const second=await upload(r,client),duplicate=await verify(r,token,second);assert.equal(duplicate.status,200);assert.equal(duplicate.body.data.state,'duplicate');assert.equal(duplicate.body.data.document_id,second.document_id);assert.equal(duplicate.body.data.receipt.id,input.document_id);assert.deepEqual(duplicate.body.data.server_proof,recovered.body.data.server_proof);assert.equal(duplicate.body.data.duplicate_of_document_id,input.document_id);
  assert.ok((await client.storage.from(second.storage_bucket).remove([second.storage_path])).error);assert.equal((await client.from('uploaded_documents').select('id')).data.length,1);
  const config=await (await fetch(r.baseUrl+'/__synthetic/config')).json();assert.equal(config.storageMetrics.writes,2);
 }finally{await r.close();}
});
test('wrong scope/role and ordinary receipt/RPC forgery fail; legacy same ID needs Owner review but fake legacy hash cannot block new ID',async()=>{
 const {runtime:r,client,token}=await setup();try{
  const input=await upload(r,client);const viewer=createClient(r.baseUrl,r.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});const signed=await viewer.auth.signInWithPassword(r.accounts.viewer);assert.equal((await verify(r,signed.data.session.access_token,input)).status,403);
  assert.equal((await verify(r,'invalid-synthetic-session',input)).status,401);assert.equal((await verify(r,token,{...input,project_id:r.scope.otherProjectId,storage_path:`staging/${r.scope.otherProjectId}/${input.document_id}.pdf`})).status,403);assert.equal((await verify(r,token,{...input,actor_user_id:r.scope.userId})).status,400);
  const raw={id:input.document_id,organization_id:input.organization_id,project_id:input.project_id,uploaded_by_user_id:r.scope.aOwnerId,storage_bucket:input.storage_bucket,storage_path:input.storage_path,original_filename:input.original_filename,mime_type:input.mime_type,file_size_bytes:input.file_size_bytes,sha256_hash:hash(pdf),document_type:'receipt',ocr_status:'pending',status:'active',env:'staging',is_test:true};
  assert.equal((await client.from('uploaded_documents').insert(raw)).error.code,'42501');assert.equal((await client.rpc('begin_upload_verification',{p_actor_user_id:r.scope.aOwnerId,p_input:input})).error.code,'42501');
  // Explicit trusted fixture maintenance creates an unverified historical claim.
  const legacy=await post(r,'/rest/v1/uploaded_documents','SYNTHETIC-PRODUCT-SERVICE-KEY',raw);assert.equal(legacy.status,201);const refused=await verify(r,token,input);assert.equal(refused.body.error.code,'LEGACY_RECEIPT_REQUIRES_OWNER_REVIEW');
  const fresh=await upload(r,client),success=await verify(r,token,fresh);assert.equal(success.status,200,JSON.stringify(success.body));assert.equal(success.body.data.state,'verified');assert.equal(success.body.data.receipt.id,fresh.document_id);
 }finally{await r.close();}
});
test('real frontend upload/recovery services use versioned preflight and server proof; binary runtime.handle preserves PNG bytes',async()=>{
 const {runtime:r,client,token}=await setup();try{
  const scope={organizationId:r.scope.organizationId,projectId:r.scope.projectId},j=journal();
  await r.failNext({path:'/rest/v1/rpc/upload_verification_contract',status:404});await assert.rejects(uploadIntake(client,{file:new File([pdf],'SYNTHETIC.pdf',{type:'application/pdf'}),scope,documentType:'receipt',staging:true,expectedUserId:r.scope.aOwnerId},j));assert.equal((await (await fetch(r.baseUrl+'/__synthetic/config')).json()).storageMetrics.writes,0);
  const result=await uploadIntake(client,{file:new File([pdf],'SYNTHETIC.pdf',{type:'application/pdf'}),scope,documentType:'receipt',staging:true,expectedUserId:r.scope.aOwnerId},j);assert.equal(result.verification.sha256Hash,hash(pdf));assert.equal(result.verification.contractVersion,'20261106.hash.1');assert.equal(j.list(r.scope.aOwnerId,scope).length,0);
  const again=await uploadIntake(client,{file:new File([pdf],'SYNTHETIC.pdf',{type:'application/pdf'}),scope,documentType:'receipt',staging:true,expectedUserId:r.scope.aOwnerId},j);assert.equal(again.attempt.documentId,result.attempt.documentId);
  const png=new Uint8Array([137,80,78,71,13,10,26,10,0,255,128,240]),input=await upload(r,client,png,'image/png','png');assert.equal((await verify(r,token,input)).status,200);
  const response=await r.handle(new Request(r.baseUrl+'/storage/v1/object/authenticated/'+input.storage_bucket+'/'+input.storage_path,{headers:{Authorization:'Bearer '+token}}));assert.equal(response.status,200);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),png);
  const binaryId=randomUUID(),binaryPath=`staging/${r.scope.projectId}/${binaryId}.png`,binary=new Uint8Array([...png,239]);
  const written=await r.handle(new Request(r.baseUrl+'/storage/v1/object/staging-receipts/'+binaryPath,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'image/png','x-upsert':'false'},body:binary}));assert.equal(written.status,200);
  const verified=await verify(r,token,{...input,document_id:binaryId,request_id:binaryId,storage_path:binaryPath,file_size_bytes:binary.length});assert.equal(verified.status,200);assert.equal(verified.body.data.server_proof.sha256_hash,hash(binary));
 }finally{await r.close();}
});
test('actual server hash refuses incompatible trusted lifecycle/env with an explicit recoverable conflict, never a 200 duplicate',async()=>{
 for(const reason of ['environment','archived']){const {runtime:r,client,token}=await setup();try{
  const first=await upload(r,client,pdf,'application/pdf','pdf',reason==='environment'?'documents':'staging-receipts');assert.equal((await verify(r,token,first)).status,200);
  if(reason==='archived'){const changed=await post(r,'/rest/v1/uploaded_documents?id=eq.'+first.document_id,'SYNTHETIC-PRODUCT-SERVICE-KEY',{status:'archived',archived_at:new Date().toISOString()},'PATCH');assert.equal(changed.status,200);}
  const next=await upload(r,client);for(let retry=0;retry<2;retry++){const conflict=await verify(r,token,next);assert.equal(conflict.status,409);assert.equal(conflict.body.success,false);assert.equal(conflict.body.error.code,'HASH_EXISTS_DIFFERENT_LIFECYCLE_OR_ENV');assert.equal(conflict.body.error.details.document_id,next.document_id);}
  assert.equal((await client.from('uploaded_documents').select('id')).data.length,1);assert.equal((await (await fetch(r.baseUrl+'/__synthetic/config')).json()).storageMetrics.writes,2);
 }finally{await r.close();}}
});
