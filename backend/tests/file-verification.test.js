import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {verifyStoredFile} from '../../modules/file-verification/index.js';
import {validateVerificationInput} from '../src/services/verify-upload-receipt.js';
const pdf=new TextEncoder().encode('%PDF-1.4\nSYNTHETIC ONLY\n%%EOF');
const check=(body=pdf,patch={},options={})=>verifyStoredFile({storage:{read:async()=>({body,mimeType:'application/pdf',contentLength:null,...patch})},reference:{opaque:'synthetic'},expected:{size:pdf.length,mimeType:'application/pdf'},...options});
test('portable verifier hashes actual bounded bytes/Blob/stream without a caller hash authority',async()=>{
  for(const body of [pdf,new Blob([pdf]),new ReadableStream({start(c){c.enqueue(pdf.slice(0,7));c.enqueue(pdf.slice(7));c.close();}})])assert.equal((await check(body)).sha256,createHash('sha256').update(pdf).digest('hex'));
});
test('portable verifier supports canonical PDF/PNG/JPEG signatures and rejects misleading MIME/signature/size',async()=>{
  for(const [bytes,type]of [[new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'],[new Uint8Array([255,216,255,0]),'image/jpeg']])assert.equal((await verifyStoredFile({storage:{read:async()=>({body:bytes,mimeType:type,contentLength:bytes.length})},reference:{},expected:{size:bytes.length,mimeType:type}})).mimeType,type);
  for(const [body,patch,code]of [[pdf,{mimeType:'image/png'},'FILE_MIME_MISMATCH'],[new Uint8Array(pdf.length),{},'FILE_SIGNATURE_INVALID'],[pdf.slice(1),{},'FILE_SIZE_MISMATCH'],[pdf,{contentLength:1},'FILE_SIZE_MISMATCH'],[pdf,{contentLength:NaN},'FILE_LENGTH_INVALID']])await assert.rejects(check(body,patch),e=>e.code===code);
});
test('portable verifier enforces actual stream maximum even with missing or false Content-Length',async()=>{
  for(const contentLength of [null,1]){let cancelled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(16));c.enqueue(new Uint8Array(17));},cancel(){cancelled=true;}});await assert.rejects(check(stream,{contentLength},{maxBytes:32}),e=>e.code==='FILE_TOO_LARGE');assert.equal(cancelled,true);}
  await assert.rejects(check(pdf,{contentLength:999},{maxBytes:32}),e=>e.code==='FILE_TOO_LARGE');
});
test('portable verifier interruption/timeout fail explicitly, and another attempt can retry original bytes',async()=>{
  const broken=new ReadableStream({start(c){c.error(new Error('synthetic broken stream'));}});await assert.rejects(check(broken),e=>e.code==='FILE_READ_FAILED');
  await assert.rejects(check(new ReadableStream({start(){}}),{},{timeoutMs:10}),e=>e.code==='FILE_READ_TIMEOUT');
  assert.equal((await check()).size,pdf.length);
});
test('non-cooperative adapter late body is cancelled after timeout instead of being read/hash-processed',async()=>{
  let cancelled=false;const storage={read:async()=>{await new Promise(resolve=>setTimeout(resolve,25));return {body:new ReadableStream({cancel(){cancelled=true;}}),mimeType:'application/pdf',contentLength:null};}};
  await assert.rejects(verifyStoredFile({storage,reference:{},expected:{size:pdf.length,mimeType:'application/pdf'},timeoutMs:5}),e=>e.code==='FILE_READ_TIMEOUT');await new Promise(resolve=>setTimeout(resolve,35));assert.equal(cancelled,true);
});
test('verification service rejects malformed extension substrings before any storage or RPC call',()=>{
  const org='11111111-1111-4111-8111-111111111111',project='22222222-2222-4222-8222-222222222222',doc='33333333-3333-4333-8333-333333333333';
  for(const ext of ['pdfBAD','BADpng'])assert.throws(()=>validateVerificationInput({organization_id:org,project_id:project,document_id:doc,request_id:doc,storage_bucket:'staging-receipts',storage_path:`staging/${project}/${doc}.${ext}`,original_filename:'SYNTHETIC.pdf',document_type:'receipt',file_size_bytes:pdf.length,mime_type:'application/pdf'}),e=>e.code==='VERIFICATION_PATH_INVALID');
});
