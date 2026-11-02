import {createClient} from '@supabase/supabase-js';
import {createLogoutSafeStorage} from '../../../src/services/authPersistence';
export const organizationId='00000000-0000-4000-8000-000000000001';
export const projectId='00000000-0000-4000-8000-000000000002';
const scenario=new URLSearchParams(location.search).get('case')||'failed-login';
const userId=scenario==='refresh'?'00000000-0000-4000-8000-000000000902':'00000000-0000-4000-8000-000000000901';
const user={id:userId,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
let tokenSequence=0;
function session(seconds=3600){const exp=Math.floor(Date.now()/1000)+seconds;return {access_token:'eyJhbGciOiJub25lIn0.'+btoa(JSON.stringify({sub:userId,session_id:'synthetic-family',exp,iat:Date.now()/1000,nonce:++tokenSequence}))+'.synthetic',refresh_token:'synthetic-refresh-only',token_type:'bearer',expires_in:seconds,expires_at:exp,user};}
const storageKey='explicit-synthetic-auth-upload';
const memory=new Map([[storageKey,JSON.stringify(session())]]);
const authStorage=createLogoutSafeStorage({getItem:key=>memory.get(key)??null,setItem:(key,value)=>{memory.set(key,value);},removeItem:key=>{memory.delete(key);}},storageKey);
export const getAuthStorage=()=>authStorage;
export const isSupabaseConnected=()=>true;
let objectPosts=0,rowPosts=0,refreshes=0;
let object:{bucket:string;path:string;bytes:ArrayBuffer;mime:string}|undefined,saved:Record<string,unknown>|undefined;
const json=(value:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json',...headers}});
function evidence(){document.getElementById('evidence')!.textContent=`case=${scenario}; object writes=${objectPosts}; receipt writes=${rowPosts}; saved=${Boolean(saved)}; refreshes=${refreshes}; stored MIME=${object?.mime??'none'}`;}
const client=createClient('https://synthetic-auth-upload.invalid','synthetic-not-a-key',{
  auth:{storageKey,storage:authStorage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:async(url,init)=>{
    const parsed=new URL(String(url)),method=init?.method??'GET';
    if(parsed.origin!=='https://synthetic-auth-upload.invalid')throw new Error('No external requests authorized in this fixture');
    if(parsed.pathname==='/auth/v1/user')return json(user);
    if(parsed.pathname==='/auth/v1/token'){
      const body=JSON.parse(String(init?.body));
      if(parsed.searchParams.get('grant_type')==='refresh_token'){refreshes++;evidence();return json(session());}
      if(body.password==='synthetic-wrong')return json({error:'invalid_grant',error_code:'invalid_credentials',msg:'SYNTHETIC incorrect password'},400);
      return json(session(body.password==='synthetic-short'?12:3600));
    }
    if(parsed.pathname==='/auth/v1/logout')return new Response(null,{status:204});
    if(parsed.pathname==='/rest/v1/projects')return json([{id:projectId,organization_id:organizationId,name:'SYNTHETIC project',project_code:'LOCAL-ONLY'}],200,{'Content-Range':'0-0/1'});
    if(parsed.pathname==='/rest/v1/rpc/upload_intake_contract')return json([{project_id:projectId,organization_id:organizationId,contract_version:'20261102.2',can_write:true}]);
    if(parsed.pathname.startsWith('/storage/v1/object/')){
      const path=parsed.pathname.slice('/storage/v1/object/'.length);
      if(method==='GET')return object&&`${object.bucket}/${object.path}`===path?new Response(object.bytes,{headers:{'Content-Type':object.mime}}):json({message:'missing synthetic object'},404);
      if(method!=='POST'||!(init?.body instanceof FormData))throw new Error('Unexpected Storage mutation');
      const file=init.body.get('') as File,parts=path.split('/');
      object={bucket:parts.shift()!,path:parts.join('/'),bytes:await file.arrayBuffer(),mime:file.type};objectPosts++;evidence();
      if(scenario==='refresh'){await client.auth.refreshSession();await new Promise(resolve=>setTimeout(resolve,0));}
      return json({Id:'synthetic-object',Key:path});
    }
    if(parsed.pathname==='/rest/v1/uploaded_documents'){
      if(method==='GET')return json(saved?[saved]:[]);
      if(method!=='POST')throw new Error('No update/delete in synthetic fixture');
      const row=JSON.parse(String(init?.body));
      if(!object||row.mime_type!==object.mime||row.file_size_bytes!==object.bytes.byteLength)throw new Error('Fixture metadata mismatch');
      saved=row;rowPosts++;evidence();return json(saved,201);
    }
    throw new Error('Unexpected synthetic request '+method+' '+parsed.pathname);
  }},
});
export const getSupabaseClient=()=>client;
document.getElementById('use-fixture')!.onclick=()=>{
  const input=document.querySelector<HTMLInputElement>('input[type=file]');if(!input||input.disabled)return;
  const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array([255,216,255,0,83,89,78,84,72])],'synthetic-alias.jpg',{type:'image/jpg'}));
  input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
};
evidence();
