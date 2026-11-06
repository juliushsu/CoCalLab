// Fresh PGlite/catalog substitute. Independent SQL-connection lock-wait races NOT_RUN.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {createLocalWorkflow} from '../../tools/local-workflow/engine.js';
const bytes=Buffer.from('%PDF-1.4\nSYNTHETIC SQL HASH TEST\n%%EOF\n'),sha=createHash('sha256').update(bytes).digest('hex');
async function setup(){
 const f=await createLocalWorkflow(),{db,scope}=f;
 async function role(name,fn){await db.exec('begin');try{await db.exec('set local role '+name);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[scope.userId]);const result=await fn();await db.exec('commit');return result;}catch(error){await db.exec('rollback');throw error;}}
 async function object(bucket='staging-receipts'){const id=randomUUID(),path=`${bucket==='documents'?'':'staging/'}${scope.projectId}/${id}.pdf`;const row=(await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4) returning *',[bucket,path,scope.userId,{size:bytes.length,mimetype:'application/pdf'}])).rows[0];return {organization_id:scope.organizationId,project_id:scope.projectId,document_id:id,request_id:id,storage_bucket:bucket,storage_path:path,original_filename:'SYNTHETIC.pdf',document_type:'receipt',file_size_bytes:bytes.length,mime_type:'application/pdf',object_id:row.id};}
 const input=await object();
 const clean=input=>Object.fromEntries(Object.entries(input).filter(([key])=>key!=='object_id'));
 const begin=(input,actor=scope.userId)=>role('service_role',()=>db.query('select * from begin_upload_verification($1,$2)',[actor,clean(input)]));
 const complete=(input,hash=sha)=>role('service_role',()=>db.query('select * from complete_upload_verification($1,$2,$3,$4,$5,$6)',[scope.userId,input.document_id,input.request_id,hash,bytes.length,'application/pdf']));
 const receipt=input=>({id:input.document_id,organization_id:input.organization_id,project_id:input.project_id,uploaded_by_user_id:scope.userId,storage_bucket:input.storage_bucket,storage_path:input.storage_path,original_filename:input.original_filename,mime_type:input.mime_type,file_size_bytes:input.file_size_bytes,sha256_hash:'b'.repeat(64),document_type:'receipt',ocr_status:'pending',status:'active',env:'staging',is_test:true});
 async function insert(table,row){const keys=Object.keys(row);return db.query('insert into '+table+'('+keys.join(',')+') values('+keys.map((_,i)=>'$'+(i+1)).join(',')+') returning *',Object.values(row));}
 return {...f,role,object,input,clean,begin,complete,receipt,insert};
}
test('ordinary API fake receipt hash cannot occupy a trusted unique slot, including with a broad permissive policy',async()=>{
 const f=await setup();try{await f.db.exec("create policy synthetic_receipt_broad on uploaded_documents for insert to authenticated with check(true)");await assert.rejects(f.role('authenticated',()=>f.insert('uploaded_documents',f.receipt(f.input))),e=>e.code==='42501');}finally{await f.close();}
});
test('durable begin binds object generation before complete; same request replays and altered identity/actor is refused',async()=>{
 const f=await setup();try{const begun=(await f.begin(f.input)).rows[0].verification;assert.equal(begun.state,'reserved');assert.equal(begun.storage_object_id,f.input.object_id);assert.deepEqual((await f.begin(f.input)).rows[0].verification,begun);
 await assert.rejects(f.begin({...f.input,original_filename:'CHANGED.pdf'}),/intent/);await assert.rejects(f.begin(f.input,randomUUID()),e=>e.code==='42501');
 const completed=(await f.complete(f.input)).rows[0].verification;assert.equal(completed.state,'verified');assert.equal(completed.receipt.sha256_hash,sha);assert.equal(completed.receipt.hash_verification_status,'server_verified');assert.equal(completed.receipt.verified_storage_object_id,f.input.object_id);assert.deepEqual((await f.complete(f.input)).rows[0].verification,completed);
 }finally{await f.close();}
});
test('legacy fake hash remains unverified and does not block a distinct new genuine receipt; legacy same ID is not upgraded',async()=>{
 const f=await setup();try{const legacy=await f.object();await f.insert('uploaded_documents',{...f.receipt(legacy),sha256_hash:sha});await assert.rejects(f.begin(legacy),/LEGACY_RECEIPT_REQUIRES_OWNER_REVIEW/);
 await f.begin(f.input);const result=(await f.complete(f.input)).rows[0].verification;assert.equal(result.state,'verified');assert.equal(result.receipt.id,f.input.document_id);const old=(await f.db.query('select * from uploaded_documents where id=$1',[legacy.document_id])).rows[0];assert.equal(old.sha256_hash,sha);assert.equal(old.hash_verification_status,'legacy_unverified');assert.equal(old.server_verified_at,null);
 }finally{await f.close();}
});
test('server-computed duplicate maps to existing verified proof and retains the original reserved object',async()=>{
 const f=await setup();try{await f.begin(f.input);const first=(await f.complete(f.input)).rows[0].verification;const second=await f.object();await f.begin(second);const duplicate=(await f.complete(second)).rows[0].verification;assert.equal(duplicate.state,'duplicate');assert.equal(duplicate.receipt.id,f.input.document_id);assert.deepEqual(duplicate.server_proof,first.server_proof);assert.equal(duplicate.document_id,second.document_id);assert.equal(Number((await f.db.query('select count(*) n from uploaded_documents')).rows[0].n),1);
 }finally{await f.close();}
});
test('reserved/verified/duplicate ordinary object delete/recreate/metadata edits and receipt deletes cannot bypass guards',async()=>{
 const f=await setup();try{await f.begin(f.input);await f.db.exec("create policy synthetic_object_delete_broad on storage.objects for delete to authenticated using(true);create policy synthetic_receipt_delete_broad on uploaded_documents for delete to authenticated using(true);create policy synthetic_object_update_broad on storage.objects for update to authenticated using(true) with check(true)");
 await assert.rejects(f.role('authenticated',()=>f.db.query('delete from storage.objects where id=$1',[f.input.object_id])),e=>e.code==='42501');await f.complete(f.input);
 const metadata=await f.role('authenticated',()=>f.db.query('update storage.objects set metadata=$1 where id=$2 returning id',[{size:1,mimetype:'image/png'},f.input.object_id]));assert.equal(metadata.rows.length,0);
 await assert.rejects(f.role('authenticated',()=>f.db.query('delete from uploaded_documents where id=$1',[f.input.document_id])),e=>e.code==='42501');
 // Trusted maintenance is outside this guarantee; even after it removes the row,
 // an ordinary role cannot recreate this durable reserved path/generation.
 await f.role('service_role',()=>f.db.query('delete from storage.objects where id=$1',[f.input.object_id]));
 await assert.rejects(f.role('authenticated',()=>f.db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',['staging-receipts',f.input.storage_path,f.scope.userId,{size:bytes.length,mimetype:'application/pdf'}])),e=>e.code==='42501');
 await assert.rejects(f.complete(f.input),/binding|original|object/);
 }finally{await f.close();}
});
test('complete refuses object generation/owner/size/MIME drift and direct role RPC/proof forgery',async()=>{
 const f=await setup();try{await f.begin(f.input);const replacement=randomUUID();await f.db.query('update storage.objects set id=$1 where id=$2',[replacement,f.input.object_id]);await assert.rejects(f.complete(f.input),/binding/);await f.db.query('update storage.objects set id=$1 where id=$2',[f.input.object_id,replacement]);
 await f.db.query('update storage.objects set owner_id=$1 where id=$2',[randomUUID(),f.input.object_id]);await assert.rejects(f.complete(f.input),/binding/);await f.db.query('update storage.objects set owner_id=$1 where id=$2',[f.scope.userId,f.input.object_id]);
 for(const metadata of [{size:bytes.length+1,mimetype:'application/pdf'},{size:bytes.length,mimetype:'image/png'}]){await f.db.query('update storage.objects set metadata=$1 where id=$2',[metadata,f.input.object_id]);await assert.rejects(f.complete(f.input),/binding/);}await f.db.query('update storage.objects set metadata=$1 where id=$2',[{size:bytes.length,mimetype:'application/pdf'},f.input.object_id]);
 await assert.rejects(f.role('authenticated',()=>f.db.query('select * from begin_upload_verification($1,$2)',[f.scope.userId,f.clean(f.input)])),e=>e.code==='42501');
 await assert.rejects(f.role('authenticated',()=>f.db.query("insert into cocal_attachment_private.verifications(document_id) values($1)",[randomUUID()])),e=>e.code==='42501');
 for(const role of ['anon','authenticated'])await assert.rejects(f.role(role,()=>f.db.query("select cocal_attachment_private.receipt_is_reserved($1,'unrelated-bucket','unrelated-path')",[f.input.document_id])),e=>e.code==='42501');
 }finally{await f.close();}
});
test('trusted hash in another environment or archived lifecycle is an explicit conflict, not a compatible duplicate',async()=>{
 for(const reason of ['environment','archived']){const f=await setup();try{
  const original=reason==='environment'?await f.object('documents'):f.input;await f.begin(original);await f.complete(original);
  if(reason==='archived')await f.role('service_role',()=>f.db.query("update uploaded_documents set status='archived',archived_at=now() where id=$1",[original.document_id]));
  const next=reason==='environment'?f.input:await f.object();await f.begin(next);await assert.rejects(f.complete(next),/HASH_EXISTS_DIFFERENT_LIFECYCLE_OR_ENV/);
  assert.equal((await f.db.query('select state from cocal_attachment_private.verifications where document_id=$1',[next.document_id])).rows[0].state,'reserved');
 }finally{await f.close();}}
});
