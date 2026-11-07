import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {manualScope,manualFormValues,manualReceiptEligible,requireMatchingManualAttempt,manualJournalKey,readManualAttempt,writeManualAttempt,abandonManualAttempt,submitManualTranscription,confirmManualTranscription,readManualDraft,MANUAL_PROVIDER,type ManualAttempt} from '../src/services/manualTranscription.ts';
import type {ExtractedDocumentDraft} from '../src/types/document.ts';
const O='00000000-0000-4000-8000-000000000001',P='00000000-0000-4000-8000-000000000002',D='00000000-0000-4000-8000-000000000003',U='00000000-0000-4000-8000-000000000004',R='00000000-0000-4000-8000-000000000005';
const scope={organizationId:O,projectId:P,documentId:D};
const form=()=>({activity_name:'SYNTHETIC electricity',quantity:'100',unit:'kWh',activity_date:'2026-01-15',category:'energy',activity_type:'electricity',final_scope:'2',inclusion_status:'included',source_locator:'SYNTHETIC p1',period_start:'',period_end:'',review_note:'',exclusion_reason:'',source_text:''});
const attempt=():ManualAttempt=>({draftId:R,requestId:U,transcription:manualFormValues(form())});
function sdk(data:unknown,status=200){const requests:{url:string;body:Record<string,unknown>}[]=[];const client=createClient('http://synthetic-manual.invalid','synthetic-public',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{requests.push({url:String(input),body:JSON.parse(String(init?.body||'{}'))});return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});}}});return {client,requests};}
const draft=()=>({id:R,organization_id:O,project_id:P,uploaded_document_id:D,extraction_provider:MANUAL_PROVIDER,is_latest:true,status:'pending_review',raw_payload:{manual_transcription:{user_id:U}},normalized_payload:manualFormValues(form())}) as unknown as ExtractedDocumentDraft;
test('manual entry requires exact explicit tenant/project/document and rejects conflicts',()=>{
 assert.deepEqual(manualScope(D,'?organization_id='+O+'&projectId='+P),scope);
 for(const search of ['', '?organization_id='+O,'?organization_id='+O+'&organizationId='+P+'&projectId='+P])assert.throws(()=>manualScope(D,search));
});
test('new manual UI only enables active server-verified receipts, preserving legacy read access without promoting historical claims',()=>{
 const row={status:'active',deletion_state:'active',hash_verification_status:'server_verified',server_verified_at:'2026-11-07T00:00:00Z',verified_storage_object_id:D,sha256_hash:'a'.repeat(64)} as const;
 assert.equal(manualReceiptEligible(row),true);
 for(const patch of [{status:'archived'},{deletion_state:'pending'},{deletion_state:'deleted'},{hash_verification_status:'legacy_unverified'},{server_verified_at:null},{server_verified_at:'invalid'},{verified_storage_object_id:null},{verified_storage_object_id:'invalid'},{sha256_hash:'client claim'}])assert.equal(manualReceiptEligible({...row,...patch}),false);
});
test('manual values preserve real zero, unknown period and immutable canonical fields without 0/kg fallback',()=>{
 const values=manualFormValues({...form(),quantity:'0'});assert.equal(values.quantity,0);assert.equal(values.period_start,null);assert.equal(values.subcategory,null);assert.equal(values.unit,'kWh');
 for(const change of [{quantity:''},{quantity:'-1'},{quantity:'NaN'},{quantity:'1.123456789'},{unit:''},{source_locator:''},{activity_date:''},{activity_date:'2026-02-30'},{final_scope:''},{inclusion_status:'excluded',exclusion_reason:''},{period_start:'2026-01-01',period_end:''}])assert.throws(()=>manualFormValues({...form(),...change}));
});
test('journal is product/user/tenant/project/document scoped; corrupt data never silently becomes a new attempt',()=>{
 const map=new Map<string,string>(),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
 const a=attempt();writeManualAttempt(storage,scope,U,a);assert.deepEqual(readManualAttempt(storage,scope,U),a);assert.equal(readManualAttempt(storage,scope,R),null);
 const other={...scope,documentId:R};writeManualAttempt(storage,other,U,a);abandonManualAttempt(storage,scope,U);assert.equal(readManualAttempt(storage,scope,U),null);assert.deepEqual(readManualAttempt(storage,other,U),a);
 map.set(manualJournalKey(scope,U),'{bad');assert.throws(()=>readManualAttempt(storage,scope,U),/損壞/);
});
test('SDK create sends original fixed identity and no caller actor/provider; failures/mismatches and stale response reject',async()=>{
 const data={draft_id:R,document_id:D,organization_id:O,project_id:P,extraction_provider:MANUAL_PROVIDER};const h=sdk({success:true,data});
 await submitManualTranscription(h.client,scope,attempt(),()=>true);await submitManualTranscription(h.client,scope,attempt(),()=>true);
 assert.deepEqual(h.requests[0].body,h.requests[1].body);assert.equal('actor_user_id' in h.requests[0].body,false);assert.equal('extraction_provider' in h.requests[0].body,false);
 for(const harness of [sdk({success:false,error:{message:'denied'}}),sdk({success:true,data:{...data,organization_id:P}}),sdk({message:'denied'},403)])await assert.rejects(submitManualTranscription(harness.client,scope,attempt(),()=>true));
 const blocked=sdk({success:true,data});await assert.rejects(submitManualTranscription(blocked.client,scope,attempt(),()=>false));assert.equal(blocked.requests.length,0);
 let current=true;const late=createClient('http://synthetic-manual.invalid','synthetic-public',{global:{fetch:async()=>{current=false;return new Response(JSON.stringify({success:true,data}),{headers:{'Content-Type':'application/json'}});}}});await assert.rejects(submitManualTranscription(late,scope,attempt(),()=>current));
});
test('existing draft read and confirmation are scoped and use fixed request plus review note only',async()=>{
 const h=sdk(draft());assert.equal((await readManualDraft(h.client,scope))?.id,R);assert.ok(h.requests[0].url.includes('organization_id=eq.'+O));
 const mismatch=sdk({...draft(),uploaded_document_id:R});await assert.rejects(readManualDraft(mismatch.client,scope));
 const confirmed=sdk({success:true,data:{draft_id:R,draft_status:'confirmed'},meta:{warnings:[]}});const intent={requestId:U,decision:'confirmed' as const,reviewNote:'SYNTHETIC same-person confirmation'};
 await confirmManualTranscription(confirmed.client,scope,draft(),intent,()=>true);assert.deepEqual(confirmed.requests[0].body.overrides,{review_note:intent.reviewNote});assert.equal(confirmed.requests[0].body.request_id,U);
});

test('a stale local confirmation reference cannot transfer its intent to a newer saved draft',()=>{const a=attempt();requireMatchingManualAttempt(a,{id:R});assert.throws(()=>requireMatchingManualAttempt(a,{id:D}),/舊草稿/);});
