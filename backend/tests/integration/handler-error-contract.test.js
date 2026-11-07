// Real handler/SQL path, synthetic local HTTP/Auth adapter; not native Edge UAT.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {createProductRuntime} from '../../tools/product-preview/runtime.js';
test('upload/delete error boundaries retain validation, AuthzError, plain SDK error and operation recovery contracts',async()=>{
 const r=await createProductRuntime({port:0,scenario:'verified-upload'});
 async function post(path,token,body){const response=await fetch(r.baseUrl+path,{method:'POST',headers:{apikey:r.publicKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
 try{
  const signed=await post('/auth/v1/token?grant_type=password',null,r.accounts.owner),viewer=await post('/auth/v1/token?grant_type=password',null,r.accounts.viewer),token=signed.body.access_token;
  const id=randomUUID(),scope={organization_id:r.scope.organizationId,project_id:r.scope.projectId},upload={...scope,document_id:id,request_id:id,storage_bucket:'staging-receipts',storage_path:`staging/${r.scope.projectId}/${id}.pdf`,original_filename:'SYNTHETIC.pdf',document_type:'receipt',file_size_bytes:30,mime_type:'application/pdf'},deletion={...scope,document_id:id,request_id:randomUUID()};
  for(const [route,input]of [['verify-upload-receipt',upload],['delete-uploaded-document',deletion]]){
   const forbidden=await post('/functions/v1/'+route,viewer.body.access_token,input);assert.equal(forbidden.status,403);assert.equal(forbidden.body.error.code,'FORBIDDEN_ROLE');assert.equal(forbidden.body.success,false);
   const missing=await post('/functions/v1/'+route,null,input);assert.equal(missing.status,401);assert.equal(missing.body.error.code,'AUTH_REQUIRED');
   const invalid=await post('/functions/v1/'+route,token,{...input,document_id:'not-a-uuid'});assert.equal(invalid.status,400);assert.equal(typeof invalid.body.error.message,'string');assert.equal(invalid.body.success,false);
  }
  await r.failNext({path:'/rest/v1/subscriptions',method:'GET'});
  const sdk=await post('/functions/v1/verify-upload-receipt',token,upload);assert.equal(sdk.status,409);assert.equal(sdk.body.error.code,'SYNTHETIC_FAULT');assert.match(sdk.body.error.message,/Synthetic injected failure/);assert.equal(sdk.body.data,null);assert.equal(sdk.body.error.details.document_id,id);
  const operation=await post('/functions/v1/delete-uploaded-document',token,deletion);assert.equal(operation.status,409);assert.match(operation.body.error.code,/DOCUMENT_ORPHAN_IDENTITY_UNCONFIRMED/);assert.equal(operation.body.error.details.request_id,deletion.request_id);assert.equal(operation.body.error.details.operation_status,'unconfirmed');
 }finally{await r.close();}
});
