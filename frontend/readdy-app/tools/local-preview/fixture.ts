// PREVIEW ONLY. Volatile synthetic identities/data; every SDK request intercepted.
import {createClient} from '@supabase/supabase-js';
import {createLogoutSafeStorage} from '../../src/services/authPersistence';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const time='2026-11-04T00:00:00Z';
const accounts:Record<string,{id:string;organizations:string[]}>={
  'a@preview.invalid':{id:id(101),organizations:[id(1)]},
  'b@preview.invalid':{id:id(102),organizations:[id(2)]},
  'shared@preview.invalid':{id:id(103),organizations:[id(1),id(2)]},
};
const previewNamespace='cocal-synthetic-local-preview:';
const remembered=sessionStorage.getItem(previewNamespace+'account');
let active:typeof accounts[string]|null=remembered?accounts[remembered]??null:null;
const user=()=>active?{id:active.id,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:time}:null;
const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRu0AAAAASUVORK5CYII='),c=>c.charCodeAt(0));
const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const organizations=[1,2].map(n=>({id:id(n),slug:'synthetic-'+n,legal_name:'SYNTHETIC '+(n===1?'A':'B'),display_name:'SYNTHETIC '+(n===1?'A':'B'),status:'active',country_code:'TW',created_at:time,updated_at:time}));
const projects=organizations.map((org,i)=>({id:id(11+i),organization_id:org.id,project_code:'TEST-'+(i===0?'A':'B'),name:'SYNTHETIC Project '+(i===0?'A':'B'),status:'active',boundary_type:'operational_control',reporting_start_date:'2026-01-01',reporting_end_date:'2026-12-31',created_at:time,updated_at:time,organization:org}));
const documents=projects.map((p,i)=>({id:id(21+i),organization_id:p.organization_id,project_id:p.id,uploaded_by_user_id:id(101+i),storage_bucket:'staging-receipts',storage_path:'staging/'+p.id+'/'+id(21+i)+'.png',original_filename:'SYNTHETIC-'+(i===0?'A':'B')+'.png',mime_type:'image/png',file_size_bytes:bytes.length,sha256_hash:sha,document_type:'receipt',ocr_status:'pending',status:'active',metadata:{synthetic:true,intake_mode:'upload_only'},received_date:'2026-11-04',archived_at:null,created_at:time,updated_at:time}));
const key='cocal-preview-only-auth-v1';
const authStorage=createLogoutSafeStorage({getItem:key=>sessionStorage.getItem(previewNamespace+key),setItem:(key,value)=>{sessionStorage.setItem(previewNamespace+key,value);},removeItem:key=>{sessionStorage.removeItem(previewNamespace+key);}},key);
const json=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});
function allowed(org:string){return Boolean(active?.organizations.includes(org));}
function session(){const exp=Math.floor(Date.now()/1000)+3600;return {access_token:'eyJhbGciOiJub25lIn0.'+btoa(JSON.stringify({sub:active!.id,session_id:'preview-'+active!.id,exp}))+'.synthetic',refresh_token:'synthetic-refresh-only',token_type:'bearer',expires_in:3600,expires_at:exp,user:user()};}
const client=createClient('https://synthetic-local-preview.invalid','synthetic-not-a-key',{auth:{storageKey:key,storage:authStorage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,init)=>{
  const parsed=new URL(String(url)),method=init?.method??'GET';
  if(parsed.origin!=='https://synthetic-local-preview.invalid')throw new Error('PREVIEW_NO_EXTERNAL_SERVICE');
  if(parsed.pathname==='/auth/v1/user')return active?json(user()):json({message:'synthetic signed out'},401);
  if(parsed.pathname==='/auth/v1/token'){
    const body=JSON.parse(String(init?.body));
    if(parsed.searchParams.get('grant_type')==='refresh_token')return active?json(session()):json({message:'synthetic signed out'},401);
    const account=accounts[String(body.email).toLowerCase()];
    if(!account||body.password!=='SYNTHETIC-ONLY')return json({error:'invalid_grant',error_code:'invalid_credentials',msg:'Synthetic preview login rejected'},400);
    active=account;sessionStorage.setItem(previewNamespace+'account',String(body.email).toLowerCase());return json(session());
  }
  if(parsed.pathname==='/auth/v1/logout'){active=null;sessionStorage.removeItem(previewNamespace+'account');return new Response(null,{status:204});}
  if(!active)return json({message:'synthetic authentication required'},401);
  if(parsed.pathname==='/rest/v1/rpc/upload_intake_contract'){
    const project=projects.find(p=>p.id===JSON.parse(String(init?.body)).p_project_id&&allowed(p.organization_id));
    return json(project?[{project_id:project.id,organization_id:project.organization_id,contract_version:'20261102.2',can_write:false}]:[]);
  }
  if(parsed.pathname==='/functions/v1/enforce-subscription-status')return json({success:true,data:null,error:null,meta:{request_id:'SYNTHETIC-PREVIEW',timestamp:time,status:'readonly',reason:'Synthetic preview is read-only',warnings:[]}});
  if(parsed.pathname.startsWith('/storage/v1/object/')){
    if(method!=='GET')return json({message:'PREVIEW_READ_ONLY'},403);
    const path=parsed.pathname.slice('/storage/v1/object/'.length);
    const row=documents.find(d=>d.storage_bucket+'/'+d.storage_path===path&&allowed(d.organization_id));
    return row?new Response(bytes,{headers:{'Content-Type':'image/png'}}):json({message:'synthetic object denied'},403);
  }
  if(!['GET','HEAD'].includes(method))return json({message:'PREVIEW_READ_ONLY: no resource writes'},403);
  const table=parsed.pathname.slice('/rest/v1/'.length);
  const members=active.organizations.map(org=>({id:id(201+(org===id(1)?0:1)),organization_id:org,user_id:active!.id,role:active!.id===id(103)&&org===id(2)?'viewer':'owner',status:'active',created_at:time,updated_at:time}));
  const data:Record<string,Record<string,unknown>[]>={
    organizations:organizations.filter(o=>allowed(o.id)),projects:projects.filter(p=>allowed(p.organization_id)),organization_members:members,
    uploaded_documents:documents.filter(d=>allowed(d.organization_id)),subscriptions:active.organizations.map(org=>({organization_id:org,plan_code:'SYNTHETIC',status:'readonly',period_start:'2026-01-01',period_end:'2026-12-31'})),
    extracted_document_drafts:[],emission_activities:[],calculation_results:[],report_generations:[],
  };
  if(!Object.hasOwn(data,table))return json({message:'PREVIEW_UNSUPPORTED: this endpoint is not supplied, no success fallback'},501);
  let rows=data[table];
  for(const [column,condition] of parsed.searchParams){
    if(condition.startsWith('eq.'))rows=rows.filter(row=>String(row[column])===condition.slice(3));
    if(condition.startsWith('in.('))rows=rows.filter(row=>condition.slice(4,-1).split(',').includes(String(row[column])));
  }
  const count=rows.length;
  const start=Number(parsed.searchParams.get('offset')??0),limit=Number(parsed.searchParams.get('limit')??count);
  rows=rows.slice(start,start+limit);
  const accept=new Headers(init?.headers).get('accept')??'';
  const payload=accept.includes('vnd.pgrst.object+json')?(rows[0]??null):rows;
  if(method==='HEAD')return new Response(null,{headers:{'Content-Range':count?start+'-'+(start+rows.length-1)+'/'+count:'*/0'}});
  return json(payload,200,{'Content-Range':count?start+'-'+(start+rows.length-1)+'/'+count:'*/0'});
}}});
export const getSupabaseClient=()=>client;
export const getAuthStorage=()=>authStorage;
export const isSupabaseConnected=()=>true;
