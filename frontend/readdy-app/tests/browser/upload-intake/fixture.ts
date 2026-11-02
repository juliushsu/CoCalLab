import {createClient} from '@supabase/supabase-js';
import {listIntakeProjects,getIntakeAccess,uploadIntake,reconcileIntake,type IntakeScope,type IntakeAttempt,type IntakeStage} from '../../../src/services/documentIntake';
import {browserIntakeRecovery} from '../../../src/services/intakeRecovery';
export const organizationId='00000000-0000-4000-8000-000000000001';
export const projectId='00000000-0000-4000-8000-000000000002';
const cases=['success','row-failed','old-contract','lost-saved','viewer','cross-scope'];
const scenario=new URLSearchParams(location.search).get('case')||'success';
const userId=`00000000-0000-4000-8000-${String(100+Math.max(cases.indexOf(scenario),0)).padStart(12,'0')}`;
const user={id:userId,aud:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
export const session={access_token:'synthetic-user-token',refresh_token:'synthetic-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user};
interface State {objectPosts:number;rowPosts:number;lastInsert?:Record<string,unknown>;saved?:Record<string,unknown>;object?:{bucket:string;path:string;bytes:number[]};canCommit?:boolean}
const stateKey=`explicit-synthetic-intake-server:${scenario}`;
const state:State=JSON.parse(sessionStorage.getItem(stateKey)||'{"objectPosts":0,"rowPosts":0}');
function evidence(){sessionStorage.setItem(stateKey,JSON.stringify(state));document.getElementById('evidence')!.textContent=`fixture=${scenario}; object writes=${state.objectPosts}; row writes=${state.rowPosts}; row saved=${Boolean(state.saved)}`;}
document.getElementById('commit-fixture')!.onclick=()=>{state.canCommit=true;state.saved=state.lastInsert;evidence();};
// Browser-memory fixture only: exercises the real file-input change handler
// without reading a host file or changing extension/file-system permissions.
document.getElementById('use-fixture')!.onclick=()=>{
  const input=document.querySelector<HTMLInputElement>('input[type=file]');if(!input||input.disabled)return;
  const transfer=new DataTransfer();transfer.items.add(new File(['%PDF-1.7\nSYNTHETIC INTAKE TEST ONLY\n%%EOF\n'],'synthetic.pdf',{type:'application/pdf'}));
  input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
};
const json=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});
const key='explicit-synthetic-intake-auth';
const authMemory=new Map([[key,JSON.stringify(session)]]);
const client=createClient('https://synthetic-intake.invalid','test-only-key',{
  auth:{storageKey:key,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storage:{getItem:key=>authMemory.get(key)??null,setItem:(key,value)=>{authMemory.set(key,value);},removeItem:key=>{authMemory.delete(key);}}},
  global:{fetch:async(url,init)=>{
    const path=new URL(String(url)),method=init?.method||'GET';
    if(path.pathname==='/auth/v1/user')return json(user);
    if(path.pathname==='/rest/v1/projects')return json([{id:projectId,organization_id:organizationId,name:'Synthetic tenant A project',project_code:'TEST-ONLY'}],200,{'Content-Range':'0-0/1'});
    if(path.pathname==='/rest/v1/rpc/upload_intake_contract')return scenario==='old-contract'?json({message:'contract not installed'},404):json([{project_id:projectId,organization_id:scenario==='cross-scope'?'00000000-0000-4000-8000-000000000009':organizationId,contract_version:'20261102',can_write:scenario!=='viewer'}]);
    if(path.pathname.startsWith('/storage/v1/object/')){
      const full=path.pathname.slice('/storage/v1/object/'.length);
      if(method==='GET')return state.object&&`${state.object.bucket}/${state.object.path}`===full?new Response(new Uint8Array(state.object.bytes),{headers:{'Content-Type':'application/pdf'}}):json({message:'synthetic missing object'},404);
      if(method!=='POST')throw new Error('No synthetic mutation other than upload is allowed');
      const file=(init?.body as FormData).get('') as File;
      const parts=full.split('/');state.object={bucket:parts.shift()!,path:parts.join('/'),bytes:Array.from(new Uint8Array(await file.arrayBuffer()))};
      state.objectPosts++;evidence();return json({Id:'00000000-0000-4000-8000-000000000010',Key:full});
    }
    if(path.pathname==='/rest/v1/uploaded_documents'){
      if(method==='GET')return json(state.saved&&(!path.searchParams.has('id')||path.searchParams.get('id')===`eq.${state.saved.id}`)?[state.saved]:[]);
      if(method!=='POST')throw new Error('No synthetic DELETE/UPDATE is allowed');
      state.rowPosts++;state.lastInsert=JSON.parse(String(init?.body));
      if(scenario==='row-failed'&&!state.canCommit){evidence();return json({message:'synthetic row rejected',code:'23505'},409);}
      state.saved=state.lastInsert;evidence();
      if(scenario==='lost-saved')throw new Error('synthetic response lost AFTER commit');
      return json(state.saved,201);
    }
    throw new Error('Unexpected synthetic request '+method+' '+path.pathname);
  }},
});
evidence();
export const getUploadProjects=(org?:string)=>listIntakeProjects(client,org);
export const getUploadAccess=(scope:IntakeScope,expectedUserId:string,isCurrent=()=>true)=>getIntakeAccess(client,scope,expectedUserId,isCurrent);
export const uploadDocument=(file:File,projectId:string,organizationId:string,documentType:string,expectedUserId:string,isCurrent=()=>true,onStage:(stage:IntakeStage)=>void=()=>{})=>uploadIntake(client,{file,scope:{projectId,organizationId},documentType,expectedUserId,staging:true},browserIntakeRecovery(),isCurrent,onStage);
export const recheckUploadReceipt=(attempt:IntakeAttempt,isCurrent=()=>true)=>reconcileIntake(client,attempt,isCurrent,browserIntakeRecovery());
export const getIntakeRecovery=(userId:string,scope:IntakeScope)=>browserIntakeRecovery().list(userId,scope);
