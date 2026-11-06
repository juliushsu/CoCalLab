import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { readDocumentLibrary, readPrivateOriginal, parseLibrarySelection, removeScopedDocument } from '../src/services/documentLibrary.ts';

// TEST ONLY: two synthetic tenants and intercepted installed-SDK transport.
// No .env, real credentials, Supabase service, JWT validation or cloud request.
const O='00000000-0000-4000-8000-000000000001',P='00000000-0000-4000-8000-000000000002';
const OB='00000000-0000-4000-8000-000000000011',PB='00000000-0000-4000-8000-000000000012';
const U='00000000-0000-4000-8000-000000000003',D='00000000-0000-4000-8000-000000000004',D2='00000000-0000-4000-8000-000000000005';
const DR='00000000-0000-4000-8000-000000000006';
const scope={organizationId:O,projectId:P},scopeB={organizationId:OB,projectId:PB};
const pdf=new TextEncoder().encode('%PDF-1.7\nSYNTHETIC DOCUMENT LIBRARY TEST ONLY\n%%EOF');
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const project=(tenantB=false)=>({id:tenantB?PB:P,organization_id:tenantB?OB:O,name:tenantB?'SYNTHETIC tenant B project':'SYNTHETIC tenant A project',project_code:tenantB?'TEST-B':'TEST-A'});
const document=(id=D,tenantB=false,bytes=pdf,mime='application/pdf')=>({
  id,organization_id:tenantB?OB:O,project_id:tenantB?PB:P,uploaded_by_user_id:U,
  storage_bucket:'staging-receipts',storage_path:`staging/${tenantB?PB:P}/${id}.pdf`,
  original_filename:'SYNTHETIC TEST ONLY.pdf',mime_type:mime,file_size_bytes:bytes.length,sha256_hash:hash(bytes),
  document_type:'receipt',ocr_status:'pending',status:'active',metadata:{synthetic:true},received_date:'2026-01-15',archived_at:null,
  created_at:'2026-01-15T00:00:00Z',updated_at:'2026-01-15T00:00:00Z',
});
type Reply={body:unknown;status?:number;count?:number};
interface HarnessOptions {
  documents?:unknown;
  projectBody?:unknown;
  projectCount?:number;
  authId?:string;
  authStatus?:number;
  projectStatus?:number;
  rowStatus?:number;
  storageStatus?:number;
  bytes?:Uint8Array;
  mime?:string;
  page?:(offset:number,call:number)=>Reply;
  hook?:(kind:'auth'|'projects'|'documents'|'storage'|'contract'|'references'|'drafts'|'linked-references'|'storage-delete'|'row-delete')=>Promise<void>|void;
  failNetwork?:'documents'|'storage';
  mutation?:boolean;
  contract?:unknown;
  contractStatus?:number;
  referencesCount?:number|null;
  referencesStatus?:number;
  drafts?:unknown;
  draftCount?:number|null;
  draftStatus?:number;
  linkedCount?:number|null;
  linkedStatus?:number;
  activities?:Array<{source_document_id:string|null;source_draft_id:string|null}>;
  removed?:unknown;
  storageDeleteStatus?:number;
  rowDeleted?:unknown;
  rowDeleteStatus?:number;
}
function sdk(options:HarnessOptions={}){
  const requests:{url:URL;method:string;headers:Headers;body?:unknown}[]=[];
  const user={id:U,aud:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  const key='synthetic-library-auth-only';
  const memory=new Map([[key,JSON.stringify({access_token:'synthetic-library-token',refresh_token:'synthetic-library-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user})]]);
  let documentCalls=0;
  const json=(body:unknown,status=200,count?:number)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...(count===undefined?{}:{'Content-Range':count===0?'*/0':`0-0/${count}`})}});
  const client=createClient('https://synthetic-library.invalid','test-only-library-key',{
    auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:key,storage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>{memory.set(key,value);},removeItem:key=>{memory.delete(key);}}},
    global:{fetch:async(url,init)=>{
      const parsed=new URL(String(url)),method=init?.method??'GET',headers=new Headers(init?.headers);
      requests.push({url:parsed,method,headers,body:init?.body});
      assert.equal(headers.get('authorization'),'Bearer synthetic-library-token');
      if(!options.mutation)assert.equal(method,'GET','read-only library transport may not create signed URLs or write objects/rows');
      if(parsed.pathname==='/auth/v1/user'){
        await options.hook?.('auth');return json(options.authStatus?{message:'SYNTHETIC auth denied'}:{...user,id:options.authId??U},options.authStatus??200);
      }
      if(parsed.pathname==='/rest/v1/projects'){
        await options.hook?.('projects');
        const body=Object.hasOwn(options,'projectBody')?options.projectBody:[project()];
        return json(options.projectStatus?{message:'SYNTHETIC project denied',code:'42501'}:body,options.projectStatus??200,options.projectCount??(Array.isArray(body)?body.length:1));
      }
      if(options.mutation&&parsed.pathname==='/rest/v1/rpc/upload_intake_contract'){
        assert.equal(method,'POST');await options.hook?.('contract');
        return options.contractStatus?json({message:'SYNTHETIC contract unavailable',code:'PGRST202'},options.contractStatus):json(Object.hasOwn(options,'contract')?options.contract:[{project_id:P,organization_id:O,contract_version:'20261102.2',can_write:true}]);
      }
      if(options.mutation&&parsed.pathname==='/rest/v1/emission_activities'){
        assert.equal(method,'HEAD');
        const indirect=parsed.searchParams.has('source_draft_id');
        await options.hook?.(indirect?'linked-references':'references');
        const ids=(parsed.searchParams.get('source_draft_id')??'in.()').slice(4,-1).split(',');
        const observed=(options.activities??[]).filter(row=>indirect?row.source_draft_id!==null&&ids.includes(row.source_draft_id):row.source_document_id===D).length;
        const count=indirect?(Object.hasOwn(options,'linkedCount')?options.linkedCount:observed):(Object.hasOwn(options,'referencesCount')?options.referencesCount:observed);
        return new Response(null,{status:(indirect?options.linkedStatus:options.referencesStatus)??200,headers:{...(count===null?{}:{'Content-Range':count===0?'*/0':`0-0/${count}`})}});
      }
      if(options.mutation&&parsed.pathname==='/rest/v1/extracted_document_drafts'){
        assert.equal(method,'GET');await options.hook?.('drafts');
        const body=Object.hasOwn(options,'drafts')?options.drafts:[];
        const count=Object.hasOwn(options,'draftCount')?options.draftCount:(Array.isArray(body)?body.length:0);
        return options.draftStatus?json({message:'SYNTHETIC draft lookup failed',code:'42501'},options.draftStatus):json(body,200,count===null?undefined:count);
      }
      if(parsed.pathname==='/rest/v1/uploaded_documents'){
        if(options.mutation&&method==='DELETE'){
          await options.hook?.('row-delete');
          // maybeSingle on DELETE requests a PostgREST object response, unlike GET.
          return options.rowDeleteStatus?json({message:'SYNTHETIC receipt delete failed',code:'42501'},options.rowDeleteStatus):json(Object.hasOwn(options,'rowDeleted')?options.rowDeleted:{id:D});
        }
        assert.equal(method,'GET');
        documentCalls++;await options.hook?.('documents');
        if(options.failNetwork==='documents')throw new TypeError('SYNTHETIC metadata network failure');
        if(options.rowStatus)return json({message:'SYNTHETIC metadata denied',code:'42501'},options.rowStatus);
        const response=options.page?.(Number(parsed.searchParams.get('offset')??0),documentCalls);
        const body=Object.hasOwn(options,'documents')?options.documents:[document()];
        return response?json(response.body,response.status??200,response.count):json(body,200,Array.isArray(body)?body.length:1);
      }
      if(parsed.pathname.startsWith('/storage/v1/object/')&&!/\/public\/|\/sign\//.test(parsed.pathname)){
        if(options.mutation&&method==='DELETE'){
          await options.hook?.('storage-delete');
          return options.storageDeleteStatus?json({message:'SYNTHETIC Storage delete failed'},options.storageDeleteStatus):json(Object.hasOwn(options,'removed')?options.removed:[{name:document().storage_path,id:D}]);
        }
        assert.equal(method,'GET');
        await options.hook?.('storage');
        if(options.failNetwork==='storage')throw new TypeError('SYNTHETIC private download network failure');
        if(options.storageStatus)return json({message:'SYNTHETIC private download denied'},options.storageStatus);
        return new Response(new Blob([options.bytes??pdf],{type:options.mime??'application/pdf'}));
      }
      throw new Error('Unexpected synthetic SDK request: '+method+' '+parsed.pathname);
    }},
  });
  return {client,requests};
}
const code=(expected:string)=>(error:unknown)=>Boolean(error&&typeof error==='object'&&'code'in error&&error.code===expected);
const documentRequests=(h:ReturnType<typeof sdk>)=>h.requests.filter(r=>r.url.pathname==='/rest/v1/uploaded_documents');
const storageRequests=(h:ReturnType<typeof sdk>)=>h.requests.filter(r=>r.url.pathname.startsWith('/storage/'));
const deleteRequests=(h:ReturnType<typeof sdk>)=>h.requests.filter(r=>r.method==='DELETE');

test('library query parsing preserves agreeing aliases and exact document UUID, rejecting conflicting or malformed scope',()=>{
  assert.deepEqual(parseLibrarySelection(`organizationId=${O}&organization_id=${O}&project_id=${P}&projectId=${P}&document=${D}`),{...scope,documentId:D});
  assert.deepEqual(parseLibrarySelection(''),{});
  assert.deepEqual(parseLibrarySelection(`organization_id=${OB}&projectId=${PB}`),scopeB);
  for(const search of [`organization_id=${O}&organizationId=${OB}`,`projectId=${P}&project_id=${PB}`,
    `organization_id=${O}&organization_id=${O}`,'organization_id=','project_id=bad','document=',`document=${D}&document=${D}`])assert.throws(()=>parseLibrarySelection(search),code('scope'));
});

test('installed SDK binds project/document reads to tenant A and independently supports tenant B without combining results',async()=>{
  for(const [selected,row,projects] of [[scope,document(),[project()]],[scopeB,document(D2,true),[project(true)]]] as const){
    const h=sdk({documents:[row],projectBody:projects});
    const result=await readDocumentLibrary(h.client,{...selected,documentId:row.id},U);
    assert.equal(result.length,1);assert.equal(result[0].organization_id,selected.organizationId);assert.equal(result[0].privatePathSupported,true);
    assert.equal(h.requests.find(r=>r.url.pathname==='/rest/v1/projects')!.url.searchParams.get('organization_id'),`eq.${selected.organizationId}`);
    const request=documentRequests(h)[0];
    assert.equal(request.url.searchParams.get('organization_id'),`eq.${selected.organizationId}`);
    assert.equal(request.url.searchParams.get('project_id'),`eq.${selected.projectId}`);
    assert.equal(request.url.searchParams.get('id'),`eq.${row.id}`);
    assert.equal(request.url.searchParams.get('limit'),'200');
    assert.match(request.url.searchParams.get('order')!,/created_at.desc.*id.asc/);
    assert.equal(storageRequests(h).length,0);
  }
});

test('org-only library remains tenant scoped and rejects returned tenant/project/document mismatches despite GET filters',async()=>{
  const h=sdk();assert.equal((await readDocumentLibrary(h.client,{organizationId:O},U)).length,1);
  assert.equal(documentRequests(h)[0].url.searchParams.has('project_id'),false);
  for(const row of [{...document(),organization_id:OB},{...document(),project_id:PB},{...document(),id:D2}]){
    const broken=sdk({documents:[row]});await assert.rejects(readDocumentLibrary(broken.client,{...scope,documentId:D},U),code('scope'));
  }
  const wrongProject=sdk({projectBody:[project(true)]});await assert.rejects(readDocumentLibrary(wrongProject.client,scope,U));
  assert.equal(documentRequests(wrongProject).length,0);
});

test('empty library is explicit; failed auth/project/metadata reads never return an empty success',async()=>{
  assert.deepEqual(await readDocumentLibrary(sdk({documents:[]}).client,scope,U),[]);
  for(const options of [{authStatus:401},{authId:OB},{projectStatus:403},{rowStatus:403},{rowStatus:503},{failNetwork:'documents' as const},{documents:null},{documents:{}}]){
    await assert.rejects(readDocumentLibrary(sdk(options).client,scope,U));
  }
});

test('pagination follows a real server cap smaller than requested and requires an exact complete count',async()=>{
  const h=sdk({page:offset=>({body:[offset===0?document():document(D2)],count:2})});
  const result=await readDocumentLibrary(h.client,scope,U);
  assert.deepEqual(result.map(row=>row.id),[D,D2]);
  assert.deepEqual(documentRequests(h).map(r=>r.url.searchParams.get('offset')),['0','1']);
});

test('pagination rejects absent/changing count, duplicates, repeated pages, overfull and truncated responses',async()=>{
  const cases:HarnessOptions[]=[
    {page:()=>({body:[document()]})},
    {page:()=>({body:[document()],count:-1})},
    {page:offset=>({body:offset===0?[document()]:[document(D2)],count:offset===0?2:3})},
    {page:()=>({body:[document(),document()],count:2})},
    {page:()=>({body:[document()],count:2})},
    {page:offset=>({body:offset===0?[document()]:[],count:2})},
    {page:()=>({body:[document(),document(D2)],count:1})},
    {page:()=>({body:Array.from({length:201},()=>document()),count:201})},
  ];
  for(const options of cases)await assert.rejects(readDocumentLibrary(sdk(options).client,scope,U),code('read'));
});

test('private download first re-reads exact metadata IDs and never creates a public or signed URL',async()=>{
  const h=sdk();const result=await readPrivateOriginal(h.client,D,scope,U);
  const metadata=documentRequests(h)[0];
  assert.equal(metadata.url.searchParams.get('id'),`eq.${D}`);assert.equal(metadata.url.searchParams.get('organization_id'),`eq.${O}`);assert.equal(metadata.url.searchParams.get('project_id'),`eq.${P}`);
  assert.equal(storageRequests(h).length,1);
  // Installed SDK uses /object/<bucket>/<path> plus the user bearer header.
  assert.equal(decodeURIComponent(storageRequests(h)[0].url.pathname),`/storage/v1/object/staging-receipts/staging/${P}/${D}.pdf`);
  assert.ok(h.requests.every(r=>r.method==='GET'&&!r.url.pathname.includes('/public/')&&!r.url.pathname.includes('/sign/')));
  assert.deepEqual(new Uint8Array(await result.blob.arrayBuffer()),pdf);
  assert.equal(result.previewable,true);assert.equal(result.previewMime,'application/pdf');
  assert.equal('file_url'in result.document,false);
});

test('metadata failure, missing row or foreign returned IDs stop before any Storage request',async()=>{
  for(const options of [{rowStatus:403},{rowStatus:503},{documents:[]},{documents:null},{documents:[{...document(),id:D2}]},{documents:[document(D2,true)]},{documents:[{...document(),project_id:PB}]}]){
    const h=sdk(options);await assert.rejects(readPrivateOriginal(h.client,D,scope,U));assert.equal(storageRequests(h).length,0);
  }
});

test('private permissions, size and valid SHA mismatches reject without public fallback',async()=>{
  for(const options of [{storageStatus:403},{storageStatus:404},{failNetwork:'storage' as const},
    {bytes:new Uint8Array([1])},{bytes:Uint8Array.from(pdf,(_,i)=>i===8?0:pdf[i])}]){
    const h=sdk(options);await assert.rejects(readPrivateOriginal(h.client,D,scope,U));
    assert.equal(storageRequests(h).length,1);assert.ok(h.requests.every(r=>!r.url.pathname.includes('/public/')));
  }
});

test('unsupported legacy path is shown as unavailable rather than guessed into a tenant or alternate bucket',async()=>{
  for(const patch of [{storage_bucket:'unknown'},{storage_path:'staging/fixtures/old.pdf'},
    {storage_path:`staging/${PB}/old.pdf`},{storage_path:`staging/${P}/../old.pdf`},
    {storage_path:`staging/${P}/encoded%2Fname.pdf`},{storage_path:`staging/${P}/back\\slash.pdf`}]){
    const options={documents:[{...document(),...patch}]};
    const list=sdk(options);assert.equal((await readDocumentLibrary(list.client,scope,U))[0].privatePathSupported,false);
    const download=sdk(options);await assert.rejects(readPrivateOriginal(download.client,D,scope,U),code('path'));assert.equal(storageRequests(download).length,0);
  }
  const old=sdk({documents:[{...document(),storage_path:`staging/${P}/合法舊檔名 legacy.pdf`}]});
  assert.equal((await readPrivateOriginal(old.client,D,scope,U)).previewable,true);
});

test('legacy URL metacharacters and control bytes are unavailable while safe Chinese and space paths still work',async()=>{
  for(const bad of ['?query=1','#fragment','\n','\r','\t','\u0000','\u001f','\u007f']){
    const row={...document(),storage_path:`staging/${P}/legacy${bad}.pdf`};
    const list=sdk({documents:[row]});assert.equal((await readDocumentLibrary(list.client,scope,U))[0].privatePathSupported,false);
    const read=sdk({documents:[row]});await assert.rejects(readPrivateOriginal(read.client,D,scope,U),code('path'));assert.equal(storageRequests(read).length,0);
    const remove=sdk({mutation:true,documents:[row]});await assert.rejects(removeScopedDocument(remove.client,D,scope,U,()=>true,{documentId:D,requestId:D2,storageBucket:row.storage_bucket,storagePath:row.storage_path}),code('path'));assert.equal(deleteRequests(remove).length,0);
  }
  const trailing={...document(),storage_path:`staging/${P}/合法中文 legacy.pdf `};
  const trailingList=sdk({documents:[trailing]});assert.equal((await readDocumentLibrary(trailingList.client,scope,U))[0].privatePathSupported,false);
  const trailingRead=sdk({documents:[trailing]});await assert.rejects(readPrivateOriginal(trailingRead.client,D,scope,U),code('path'));assert.equal(storageRequests(trailingRead).length,0);
  const trailingDelete=sdk({mutation:true,documents:[trailing]});await assert.rejects(removeScopedDocument(trailingDelete.client,D,scope,U,()=>true,{documentId:D,requestId:D2,storageBucket:trailing.storage_bucket,storagePath:trailing.storage_path}),code('path'));assert.equal(deleteRequests(trailingDelete).length,0);
  for(const [bucket,path]of [['staging-receipts',`staging/${P}/合法中文 有空白.pdf`],['documents',`${P}/合法中文 有空白.pdf`]]){
    const h=sdk({documents:[{...document(),storage_bucket:bucket,storage_path:path}]});const result=await readPrivateOriginal(h.client,D,scope,U);
    assert.equal(result.previewable,true);assert.equal(result.document.storage_path,path);
    assert.equal(decodeURIComponent(storageRequests(h)[0].url.pathname),`/storage/v1/object/${bucket}/${path}`);
  }
});

test('only matching PDF/PNG/JPEG byte signatures are previewable, while unsupported or MIME-mismatched bytes remain download-only',async()=>{
  for(const [bytes,mime] of [[pdf,'application/pdf'],[new Uint8Array([137,80,78,71,13,10,26,10,0]),'image/png'],[new Uint8Array([255,216,255,0]),'image/jpeg'],[new Uint8Array([255,216,255,1]),'image/jpg']] as const){
    const h=sdk({documents:[document(D,false,bytes,mime)],bytes,mime});const result=await readPrivateOriginal(h.client,D,scope,U);
    assert.equal(result.previewable,true);assert.equal(result.previewMime,mime==='image/jpg'?'image/jpeg':mime);
  }
  for(const [bytes,rowMime,actualMime] of [[new TextEncoder().encode('<svg>synthetic</svg>'),'image/svg+xml','image/svg+xml'],[new TextEncoder().encode('not PDF'),'application/pdf','application/pdf'],[pdf,'application/pdf','image/png'],[new Uint8Array([1,2,3]),'image/jpeg','image/jpeg']] as const){
    const h=sdk({documents:[document(D,false,bytes,rowMime)],bytes,mime:actualMime});const result=await readPrivateOriginal(h.client,D,scope,U);
    assert.equal(result.previewable,false);assert.equal(result.previewMime,null);assert.equal(result.blob.size,bytes.length);
  }
});

test('scope/session invalidation rejects an early read and late metadata or private-byte responses',async()=>{
  const early=sdk();await assert.rejects(readDocumentLibrary(early.client,scope,U,()=>false),code('context'));assert.equal(early.requests.length,0);
  for(const stage of ['documents','storage'] as const){
    let active=true;const h=sdk({hook:async kind=>{if(kind===stage){await Promise.resolve();active=false;}}});
    await assert.rejects(readPrivateOriginal(h.client,D,scope,U,()=>active),code('context'));
    assert.equal(storageRequests(h).length,stage==='documents'?0:1);
  }
  let active=true;const list=sdk({hook:async kind=>{if(kind==='documents')active=false;}});
  await assert.rejects(readDocumentLibrary(list.client,scope,U,()=>active),code('context'));
});

// Old two-service DELETE intent checks moved to new server-only contract/SQL/HTTP tests.
test('old callers without a captured durable request cannot fall back to client Storage or receipt DELETE',async()=>{const h=sdk({mutation:true});await assert.rejects(removeScopedDocument(h.client,D,scope,U),/受控刪除/);assert.equal(h.requests.filter(r=>r.method==='DELETE').length,0);});
test('pending/deleted originals are unavailable for private download, while tombstone metadata stays readable',async()=>{
 for(const deletion_state of ['pending','deleted']){const row={...document(),deletion_state,deletion_request_id:D2,deleted_at:deletion_state==='deleted'?'2026-11-06T00:00:00Z':null,status:deletion_state==='deleted'?'archived':'active'};const h=sdk({documents:[row]});const records=await readDocumentLibrary(h.client,scope,U);assert.equal(records[0].deletion_state,deletion_state);await assert.rejects(readPrivateOriginal(h.client,D,scope,U),code('missing'));assert.equal(storageRequests(h).length,0);}
});
test('invalid deletion state or deleted tombstone without completion proof is rejected, not shown as a safe active file',async()=>{for(const row of [{...document(),deletion_state:'unknown'},{...document(),deletion_state:'deleted'},{...document(),deletion_state:'pending',deletion_request_id:'bad'}]){const h=sdk({documents:[row]});await assert.rejects(readDocumentLibrary(h.client,scope,U),code('integrity'));}});
