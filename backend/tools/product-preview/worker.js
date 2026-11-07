// Isolated worker: actual checked-in Deno handlers + installed SDK + SQL-backed HTTP.
import { parentPort, workerData } from 'node:worker_threads';
import { createServer } from 'node:http';
import { registerHooks, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createLocalWorkflow } from '../local-workflow/engine.js';
import { seedShowcase } from './showcase.js';
import { seedManualScenario } from './manual-scenario.js';
import {MockOcrProvider} from '../../src/providers/mock-ocr-provider.js';

const PUBLIC_KEY = 'SYNTHETIC-PRODUCT-PUBLIC-KEY';
const SERVICE_KEY = 'SYNTHETIC-PRODUCT-SERVICE-KEY';
// WHATWG Fetch bad-port set, checked against Node 24's bundled Undici constants.
// Windows can assign one of these when listening on port 0; never advertise it.
const fetchBlockedPorts=new Set([1,7,9,11,13,15,17,19,20,21,22,23,25,37,42,43,53,69,77,79,87,95,101,102,103,104,109,110,111,113,115,117,119,123,135,137,139,143,161,179,389,427,465,512,513,514,515,526,530,531,532,540,548,554,556,563,587,601,636,989,990,993,995,1719,1720,1723,2049,3659,4045,4190,5060,5061,6000,6566,6665,6666,6667,6668,6669,6679,6697,10080]);
const require = createRequire(new URL('../../../frontend/readdy-app/package.json', import.meta.url));
const sdkUrl = pathToFileURL(require.resolve('@supabase/supabase-js')).href;
registerHooks({ resolve(specifier, context, next) {
  if (/^https:\/\/esm[.]sh\/@supabase\/supabase-js@/.test(specifier)) return next(sdkUrl, context);
  if (specifier === 'npm:@supabase/supabase-js@2.49.4') return next(sdkUrl, context);
  if (/^(?:npm:|jsr:)/.test(specifier)) throw new Error('Unapproved external module in the synthetic product worker');
  if (/^https?:/.test(specifier)) throw new Error('External module loading is blocked in the synthetic product worker');
  return next(specifier, context);
} });

const tables = new Set(['organizations','organization_members','subscriptions','projects','emission_activities','emission_factors',
  'calculation_results','report_generations','adjustment_applications','legal_entities','sites','action_logs','audit_logs','uploaded_documents','extracted_document_drafts']);
const rpcs = new Set(['recalculate_project_atomic','recalculation_contract','recalculation_request_v2','commit_recalculation_v2','generate_report_atomic','generate_report_snapshot_atomic_v2','report_snapshot_request_v2','read_verified_report_snapshot','upload_intake_contract',
  'list_my_organizations','get_project_for_navigation','confirm_draft_atomic','create_manual_transcription_atomic','confirm_manual_draft_atomic_v2','upload_verification_contract','begin_upload_verification','complete_upload_verification','document_deletion_contract','document_deletion_request','finalize_document_deletion','begin_document_processing','finish_document_processing','release_document_processing','save_manual_activity_atomic','report_calculation_inputs','classify_document_atomic','process_document_atomic']);
const handlers = new Map(), columns = new Map(), jsonColumns = new Map(), users = new Map(), sessions = new Map();
const originals=new Map();
const storageMetrics={writes:0,reads:0};
let registering = '', baseUrl = '', flow, server, fault = null, previewConfig, dbQueue = Promise.resolve();
// Explicit in-process test-only provider failure. The legacy mock provider is
// still a mock; this exercises lease cleanup, never real OCR acceptance.
const mockExtract=MockOcrProvider.prototype.extractDocument;
MockOcrProvider.prototype.extractDocument=async function(...args){
 if(fault?.point==='mock-provider'){if(fault.path)fault={...fault,point:undefined};else fault=null;throw new Error('SYNTHETIC_PROVIDER_FAILURE');}
 return mockExtract.apply(this,args);
};
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type':'application/json', ...headers } });
// PostgreSQL numeric/int8 arrive as strings in PGlite; PostgREST emits JSON numbers.
// Keep JSON/UUID/text untouched. This is transport adaptation, never calculation.
function wireRows(result) {
  const numeric = new Set((result.fields || []).filter(field => [20,21,23,700,701,1700].includes(field.dataTypeID)).map(field => field.name));
  const dates = new Set((result.fields || []).filter(field => field.dataTypeID===1082).map(field => field.name));
  return result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key,value]) => [key,value!==null&&dates.has(key)?(value instanceof Date?value.toISOString():String(value)).slice(0,10):value !== null && numeric.has(key) ? Number(value) : value])));
}
function sqlIdentifier(name) { if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Unsupported local SQL identifier'); return '"' + name + '"'; }
function actor(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (token === SERVICE_KEY) return { role:'service_role', user:null };
  const session = sessions.get(token);
  return session && session.expires_at * 1000 > Date.now() ? { role:'authenticated', user:session.user } : { role:'anon', user:null };
}
async function database(request, operation) {
  const next = dbQueue.then(async () => {
    const identity = actor(request);
    await flow.db.exec('begin');
    try {
      await flow.db.exec('set local role ' + identity.role);
      await flow.db.query("select set_config('request.jwt.claim.sub',$1,true)", [identity.user?.id || '']);
      const result = await operation(); await flow.db.exec('commit'); return result;
    } catch (error) { await flow.db.exec('rollback'); throw error; }
  });
  dbQueue = next.catch(() => {}); return next;
}
function splitTop(value) {
  const result = []; let depth = 0, start = 0;
  for (let i = 0; i < value.length; i++) { if (value[i] === '(') depth++; if (value[i] === ')') depth--; if (value[i] === ',' && depth === 0) { result.push(value.slice(start,i)); start = i + 1; } }
  result.push(value.slice(start)); return result;
}
function filters(table, url, params) {
  const names = columns.get(table);
  const column = name => { if (!names.has(name)) throw new Error('Unsupported local filter column: ' + name); return sqlIdentifier(name); };
  const bind = value => { params.push(value); return '$' + params.length; };
  function condition(name, value) {
    const field = column(name);
    if (value === 'is.null') return field + ' is null';
    if (value === 'not.is.null') return field + ' is not null';
    if (value.startsWith('in.(') && value.endsWith(')')) {
      const values = splitTop(value.slice(4,-1)).map(v => v.replace(/^"|"$/g,''));
      return values.length && values[0] !== '' ? field + ' in (' + values.map(bind).join(',') + ')' : 'false';
    }
    const operators = { eq:'=', neq:'<>', gt:'>', gte:'>=', lt:'<', lte:'<=' };
    const dot = value.indexOf('.'), op = operators[value.slice(0,dot)];
    if (!op) throw new Error('Unsupported local filter operator');
    return field + op + bind(value.slice(dot+1));
  }
  const predicates = [];
  for (const [name, value] of url.searchParams) {
    if (['select','order','limit','offset','on_conflict','columns'].includes(name)) continue;
    if (name === 'or') {
      const parts = splitTop(value.replace(/^\(|\)$/g,''));
      predicates.push('(' + parts.map(item => { const dot = item.indexOf('.'); return condition(item.slice(0,dot),item.slice(dot+1)); }).join(' or ') + ')');
    } else predicates.push(condition(name,value));
  }
  return predicates.length ? ' where ' + predicates.join(' and ') : '';
}
async function rest(request, url, table) {
  if (!tables.has(table)) return json({ code:'LOCAL_TABLE_UNSUPPORTED', message:'This synthetic adapter does not implement this table' },404);
  return database(request, async () => {
    const params = [], where = filters(table,url,params), prefer = request.headers.get('prefer') || '', single = (request.headers.get('accept') || '').includes('application/vnd.pgrst.object+json');
    if (['GET','HEAD'].includes(request.method)) {
      const count = Number((await flow.db.query('select count(*) as n from public.' + sqlIdentifier(table) + where,params)).rows[0].n);
      const limit = Math.min(1000,Math.max(0,Number(url.searchParams.get('limit') || 1000))),offset = Math.max(0,Number(url.searchParams.get('offset') || 0));
      if (!Number.isSafeInteger(limit) || !Number.isSafeInteger(offset)) throw new Error('Invalid local pagination');
      let order = '';
      if (url.searchParams.has('order')) order = ' order by ' + url.searchParams.get('order').split(',').map(item => { const [name,direction='asc'] = item.split('.'); if (!columns.get(table).has(name)||!['asc','desc'].includes(direction)) throw new Error('Unsupported local order'); return sqlIdentifier(name)+' '+direction; }).join(',');
      const rows = wireRows(await flow.db.query('select * from public.' + sqlIdentifier(table) + where + order + ' limit ' + limit + ' offset ' + offset,params));
      const headers = prefer.includes('count=exact') ? { 'Content-Range':count ? `${offset}-${offset+rows.length-1}/${count}` : '*/0' } : {};
      if (request.method === 'HEAD') return new Response(null,{status:200,headers});
      if (single && rows.length !== 1) return json({code:'PGRST116',details:`The result contains ${rows.length} rows`,message:'JSON object requested, multiple (or no) rows returned'},406,headers);
      return json(single?rows[0]:rows,200,headers);
    }
    if (!['POST','PATCH','DELETE'].includes(request.method)) return json({message:'Method not allowed'},405);
    let rows;
    if (request.method === 'DELETE') rows = wireRows(await flow.db.query('delete from public.'+sqlIdentifier(table)+where+' returning *',params));
    else {
      const payload = await request.json(), objects = Array.isArray(payload)?payload:[payload]; rows = [];
      for (const object of objects) {
        if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error('Invalid local row body');
        const keys = Object.keys(object); if (!keys.length || keys.some(key => !columns.get(table).has(key))) throw new Error('Unknown local row column');
        // PostgREST transports JSON scalars as JSON, not an unquoted SQL string.
        const rowValues=keys.map(key=>object[key]!==null&&jsonColumns.get(table)?.has(key)?JSON.stringify(object[key]):object[key]);
        if (request.method === 'POST') rows.push(...wireRows(await flow.db.query('insert into public.'+sqlIdentifier(table)+'('+keys.map(sqlIdentifier).join(',')+') values('+keys.map((_,i)=>'$'+(i+1)).join(',')+') returning *',rowValues)));
        else {
          const values = [...params,...rowValues];
          rows.push(...wireRows(await flow.db.query('update public.'+sqlIdentifier(table)+' set '+keys.map((key,i)=>sqlIdentifier(key)+'=$'+(params.length+i+1)).join(',')+where+' returning *',values)));
        }
      }
    }
    if (!prefer.includes('return=representation')) return new Response(null,{status:request.method==='POST'?201:204});
    if (single && rows.length !== 1) return json({code:'PGRST116',details:`The result contains ${rows.length} rows`,message:'JSON object requested, multiple (or no) rows returned'},406);
    return json(single?rows[0]:rows,request.method==='POST'?201:200);
  });
}
async function rpc(request,name) {
  if (!rpcs.has(name)) return json({code:'PGRST202',message:'Synthetic preview RPC is not supported'},404);
  const input = await request.json();
  return database(request, async () => {
    const procedures = (await flow.db.query(`select p.pronargs,p.proargnames,array(select format_type(t,null) from unnest(p.proargtypes::oid[]) t) as types
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1`,[name])).rows;
    if (procedures.length !== 1) throw new Error('RPC unavailable or ambiguous: '+name);
    const procedure=procedures[0], names=procedure.proargnames.slice(0,procedure.pronargs), keys=Object.keys(input);
    if(keys.some(key=>!names.includes(key)))throw new Error('Unknown RPC argument');
    return json(wireRows(await flow.db.query('select * from public.'+sqlIdentifier(name)+'('+keys.map((key,i)=>sqlIdentifier(key)+' => $'+(i+1)+'::'+procedure.types[names.indexOf(key)]).join(',')+')',keys.map(key=>input[key]!==null&&['json','jsonb'].includes(procedure.types[names.indexOf(key)])?JSON.stringify(input[key]):input[key]))));
  });
}
async function storageRead(request,url){
  if(['POST','PUT'].includes(request.method)&&workerData.scenario==='verified-upload'){
    const match=url.pathname.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
    if(!match||request.headers.get('x-upsert')==='true')return json({message:'Only exact non-upsert synthetic writes are supported'},409);
    const bucket=decodeURIComponent(match[1]),path=decodeURIComponent(match[2]);let bytes,mime;
    if((request.headers.get('content-type')||'').startsWith('multipart/form-data')){
      const form=await request.formData(),files=[...form.values()].filter(value=>value instanceof Blob);
      if(files.length!==1)return json({message:'One file part required'},400);mime=files[0].type;bytes=new Uint8Array(await files[0].arrayBuffer());
    }else{mime=request.headers.get('content-type');bytes=new Uint8Array(await request.arrayBuffer());}
    if(!bytes.length||bytes.length>10485760)return json({message:'Synthetic upload size invalid'},413);
    return database(request,async()=>{
      const user=actor(request).user;
      const row=request.method==='POST'?(await flow.db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4) returning id',[bucket,path,user?.id||null,{size:bytes.length,mimetype:mime}])).rows[0]:(await flow.db.query('update storage.objects set metadata=$3 where bucket_id=$1 and name=$2 returning id',[bucket,path,{size:bytes.length,mimetype:mime}])).rows[0];
      if(!row)return json({message:'Synthetic object write was not permitted'},403);
      originals.set(bucket+'/'+path,{bytes,mime});storageMetrics.writes++;
      return json({Key:bucket+'/'+path,Id:row.id},200);
    });
  }
  if(request.method==='DELETE'&&['manual-transcription','verified-upload'].includes(workerData.scenario)){
    const match=url.pathname.match(/^\/storage\/v1\/object\/([^/]+)$/),body=await request.json();
    if(!match||!Array.isArray(body.prefixes)||!body.prefixes.length||body.prefixes.length>10||body.prefixes.some(value=>typeof value!=='string'))return json({message:'Unsupported synthetic delete request'},400);
    const bucket=decodeURIComponent(match[1]);
    return database(request,async()=>{
      const removed=(await flow.db.query('delete from storage.objects where bucket_id=$1 and name=any($2::text[]) returning id,bucket_id,name',[bucket,body.prefixes])).rows;
      for(const row of removed)originals.delete(row.bucket_id+'/'+row.name);
      return json(removed);
    });
  }
  if(request.method!=='GET')return json({message:'Synthetic showcase Storage is read-only; upload/delete are not implemented'},405);
  if(url.pathname.startsWith('/storage/v1/object/public/'))return json({message:'Public originals are not available'},404);
  const match=url.pathname.match(/^\/storage\/v1\/object\/(?:authenticated\/)?([^/]+)\/(.+)$/);
  if(!match)return json({message:'Only authenticated synthetic original downloads are implemented'},404);
  const bucket=decodeURIComponent(match[1]),path=decodeURIComponent(match[2]);
  return database(request,async()=>{
    const rows=(await flow.db.query('select bucket_id,name from storage.objects where bucket_id=$1 and name=$2',[bucket,path])).rows;
    const original=rows.length===1&&originals.get(bucket+'/'+path);
    if(original)storageMetrics.reads++;
    return original?new Response(original.bytes,{headers:{'Content-Type':original.mime,'Content-Length':String(original.bytes.length),'Cache-Control':'no-store'}}):json({message:'Original does not exist or is inaccessible'},404);
  });
}
function makeSession(user) {
  const expires_at = Math.floor(Date.now()/1000)+3600;
  const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token=encoded({alg:'none',typ:'JWT'})+'.'+encoded({sub:user.id,exp:expires_at,session_id:user.id,aud:'authenticated'})+'.SYNTHETIC_NOT_A_SIGNATURE';
  const session={access_token:token,refresh_token:'synthetic-refresh-'+user.id,token_type:'bearer',expires_at,expires_in:3600,user}; sessions.set(token,session); return session;
}
async function dispatch(request) {
  const origin=request.headers.get('origin');
  if(origin&&!/^http:\/\/(?:127[.]0[.]0[.]1|localhost):\d+$/.test(origin))return json({message:'Only loopback preview origins are allowed'},403);
  const response=request.method==='OPTIONS'?new Response(null,{status:204}):await dispatchInner(request);
  if(origin){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');response.headers.set('Access-Control-Allow-Headers','authorization,apikey,content-type,prefer,x-client-info,x-request-id,x-correlation-id,range,range-unit,x-upsert,cache-control');response.headers.set('Access-Control-Allow-Methods','GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');response.headers.set('Access-Control-Expose-Headers','Content-Range');}
  return response;
}
async function dispatchInner(request) {
  const url=new URL(request.url);
  if(!['127.0.0.1','localhost'].includes(url.hostname))return json({message:'Non-local target blocked'},403);
  if(url.pathname==='/health')return json({synthetic:true,productHandlers:[...handlers.keys()],scope:flow.scope});
  if(url.pathname==='/__synthetic/config'&&request.method==='GET')return json({synthetic:true,...previewConfig});
  if(url.pathname==='/auth/v1/token'&&request.method==='POST'){
    const input=await request.json();
    const account=[...users.values()].find(value=>url.searchParams.get('grant_type')==='refresh_token'?'synthetic-refresh-'+value.user.id===input.refresh_token:value.email===input.email&&value.password===input.password);
    return account?json(makeSession(account.user)):json({message:'Synthetic sign-in rejected',error_code:'invalid_credentials'},400);
  }
  if(url.pathname==='/auth/v1/user')return actor(request).user?json(actor(request).user):json({message:'Synthetic token rejected'},401);
  if(url.pathname==='/auth/v1/logout'&&request.method==='POST'){sessions.delete((request.headers.get('authorization')||'').replace(/^Bearer\s+/i,''));return new Response(null,{status:204});}
  const armed=fault&&fault.path===url.pathname&&(fault.method||'POST')===request.method?fault:null;
  if(armed){
    fault=null;
    // In-process test-only interleaving, not a business HTTP endpoint or SQL concurrency proof.
    if(armed.phase==='beforeDispatch'&&armed.revokeMembership){
      const {organizationId,userId}=armed.revokeMembership;
      if(![organizationId,userId].every(value=>typeof value==='string'&&/^[0-9a-f-]{36}$/i.test(value)))throw new Error('Invalid synthetic revocation scope');
      await database(new Request(baseUrl,{headers:{Authorization:'Bearer '+SERVICE_KEY}}),()=>flow.db.query("update organization_members set status='inactive' where organization_id=$1 and user_id=$2",[organizationId,userId]));
    }else if(armed.phase!=='afterCommit')return json(armed.body??{code:'SYNTHETIC_FAULT',message:'Synthetic injected failure before operation'},armed.status||503);
  }
  let response;
  try {
    const functionName=url.pathname.match(/^\/functions\/v1\/([^/]+)$/)?.[1];
    const rpcName=url.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
    const table=url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
    if(functionName)response=handlers.has(functionName)?await handlers.get(functionName)(request):json({message:'No such product handler'},404);
    else if(rpcName)response=await rpc(request,rpcName);
    else if(table)response=await rest(request,url,table);
    else if(url.pathname.startsWith('/storage/v1/'))response=originals.size||workerData.scenario==='verified-upload'?await storageRead(request,url):json({message:'No original file is seeded by the manual-activity fixture'},404);
    else response=json({message:'Synthetic route unavailable'},404);
  } catch(error){response=json({code:error.code||'LOCAL_ADAPTER_ERROR',message:error.message,details:error.detail||null},400);}
  return armed?.phase==='afterCommit'?json({code:'SYNTHETIC_RESPONSE_LOST',message:'Synthetic failure after the database committed'},armed.status||503):response;
}

try {
  flow=await createLocalWorkflow(); // Initialization only. No lab receive/review/calculate/snapshot is called.
  const scope={...flow.scope,otherOrganizationId:randomUUID(),otherProjectId:randomUUID(),viewerId:randomUUID(),outsiderId:randomUUID(),otherOwnerId:randomUUID(),...(workerData.scenario!=='manual'?{aOwnerId:randomUUID()}: {})};
  await flow.db.query("update organizations set env='staging',is_test=true where id=$1",[scope.organizationId]);
  await flow.db.query("update projects set env='staging',is_test=true where id=$1",[scope.projectId]);
  await flow.db.query("update organization_members set role='owner' where organization_id=$1 and user_id=$2",[scope.organizationId,scope.userId]);
  await flow.db.query("insert into organizations(id,slug,legal_name,display_name,env,is_test) values($1,$2,'SYNTHETIC B','SYNTHETIC B','staging',true)",[scope.otherOrganizationId,'synthetic-product-b-'+scope.otherOrganizationId]);
  await flow.db.query("insert into projects(id,organization_id,project_code,name,reporting_start_date,reporting_end_date,env,is_test) values($1,$2,'SYNTHETIC-B','SYNTHETIC B','2026-01-01','2026-12-31','staging',true)",[scope.otherProjectId,scope.otherOrganizationId]);
  await flow.db.query("insert into subscriptions(organization_id,plan_code,status,period_start,period_end) values($1,'SYNTHETIC','active','2020-01-01','2099-01-01')",[scope.otherOrganizationId]);
  for(const [org,user]of [[scope.otherOrganizationId,scope.userId],[scope.organizationId,scope.viewerId]])await flow.db.query("insert into organization_members(organization_id,user_id,role,status) values($1,$2,'viewer','active')",[org,user]);
  await flow.db.query("insert into organization_members(organization_id,user_id,role,status) values($1,$2,'owner','active')",[scope.otherOrganizationId,scope.otherOwnerId]);
  if(scope.aOwnerId)await flow.db.query("insert into organization_members(organization_id,user_id,role,status) values($1,$2,'owner','active')",[scope.organizationId,scope.aOwnerId]);
  if(workerData.withFactor)for(const [org,factor]of [[scope.organizationId,scope.factorId],[scope.otherOrganizationId,randomUUID()]])await flow.db.query(`insert into emission_factors(id,organization_id,factor_key,factor_name,source_name,category,subcategory,activity_type,unit,co2e_kg_per_unit,valid_from,version,quality_tier,status,metadata,env,is_test)
    values($1,$2,'SYNTHETIC-0.5','SYNTHETIC custom factor','SYNTHETIC TEST ONLY','energy','purchased_electricity','electricity','kWh',0.5,'2026-01-01',1,'custom','active','{"synthetic":true}','staging',true)`,[factor,org]);
  for(const row of (await flow.db.query("select table_name,column_name,data_type from information_schema.columns where table_schema='public'")).rows){if(!columns.has(row.table_name)){columns.set(row.table_name,new Set());jsonColumns.set(row.table_name,new Set());}columns.get(row.table_name).add(row.column_name);if(['json','jsonb'].includes(row.data_type))jsonColumns.get(row.table_name).add(row.column_name);}
  const accounts={owner:{email:'owner@product-preview.invalid',password:'synthetic-local-only'},viewer:{email:'viewer@product-preview.invalid',password:'synthetic-local-only'},outsider:{email:'outsider@product-preview.invalid',password:'synthetic-local-only'},otherOwner:{email:'b-owner@product-preview.invalid',password:'synthetic-local-only'}};
  if(scope.aOwnerId)accounts.aOwner={email:'a-owner@product-preview.invalid',password:'synthetic-local-only'};
  for(const [name,id]of [['owner',scope.userId],['viewer',scope.viewerId],['outsider',scope.outsiderId],['otherOwner',scope.otherOwnerId],...(scope.aOwnerId?[['aOwner',scope.aOwnerId]]:[])])users.set(name,{...accounts[name],user:{id,email:accounts[name].email,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{synthetic:true},created_at:'2026-01-01T00:00:00Z'}});
  server=createServer(async(req,res)=>{try{const body=[];for await(const chunk of req)body.push(chunk);const request=new Request(baseUrl+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(body)})});const response=await dispatch(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(error){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({message:error.message}));}});
  if(workerData.port!==0&&fetchBlockedPorts.has(workerData.port))throw new Error('Configured preview port is blocked by Fetch');
  for(let attempt=0;;attempt++){
    await new Promise((resolve,reject)=>{const failed=error=>reject(error);server.once('error',failed);server.listen(workerData.port,'127.0.0.1',()=>{server.removeListener('error',failed);resolve();});});
    if(!fetchBlockedPorts.has(server.address().port))break;
    // Close only this newly-created listener; ask the OS for another ephemeral
    // port at most twice. No port scanning or other-process changes occur.
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    if(workerData.port!==0||attempt>=2)throw new Error('OS assigned Fetch-blocked preview ports; local runtime was not started');
  }
  baseUrl='http://127.0.0.1:'+server.address().port;
  const localFetch=globalThis.fetch;
  globalThis.fetch=(input,init)=>{const target=new URL(typeof input==='string'||input instanceof URL?input:input.url);if(target.origin!==baseUrl)throw new Error('Outbound fetch outside this dedicated synthetic API is blocked');return localFetch(input,init);};
  previewConfig={baseUrl,publicKey:PUBLIC_KEY,scope,accounts,scenario:workerData.scenario,storageMetrics};
globalThis.Deno={env:{get(name){const values={SUPABASE_URL:baseUrl,SUPABASE_ANON_KEY:PUBLIC_KEY,SUPABASE_SERVICE_ROLE_KEY:SERVICE_KEY,REPORT_EXPORT_POLICY:workerData.exportPolicy??undefined,APP_ENV:'staging',ENV:'staging',CORS_ALLOWED_ORIGINS:'http://127.0.0.1:4213,http://localhost:4213,http://127.0.0.1:4193,http://localhost:4193,http://127.0.0.1:4195,http://localhost:4195,http://127.0.0.1:4197,http://localhost:4197,http://127.0.0.1:4199,http://localhost:4199,http://127.0.0.1:4201,http://localhost:4201,http://127.0.0.1:4203,http://localhost:4203,http://127.0.0.1:4205,http://localhost:4205,http://127.0.0.1:4207,http://localhost:4207,http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174,http://127.0.0.1:4173,http://localhost:4173'};return values[name];}},serve(handler){handlers.set(registering,handler);return {shutdown:async()=>{}};}};
  for(const name of ['save-manual-activity','classify-document','recalculate-project','generate-report','enforce-subscription-status','export-report-snapshot','verify-upload-receipt','delete-uploaded-document','process-document',...(workerData.scenario!=='manual'?['confirm-draft']:[]),...(['manual-transcription','verified-upload'].includes(workerData.scenario)?['manual-transcription']:[])]){registering=name;await import(new URL('../../supabase/functions/'+name+'/index.ts',import.meta.url));}
  if(workerData.scenario==='showcase')previewConfig.manifest=await seedShowcase({db:flow.db,baseUrl,scope,accounts,originals});
  if(workerData.scenario==='manual-transcription'){
    previewConfig.manifest=await seedManualScenario({db:flow.db,scope,originals});
    // Actual local verifier reads the synthetic bytes and writes the receipt via
    // its service-only SQL chain. Never stamp a trusted flag in a fixture.
    for(const fixture of Object.values(previewConfig.manifest.fixtures)){
      const original=fixture.document;
      const account=[...users.values()].find(entry=>entry.user.id===(fixture.organizationId===scope.organizationId?scope.aOwnerId:scope.otherOwnerId));
      if(!account)throw new Error('Synthetic verification actor missing');
      const session=makeSession(account.user);
      const response=await handlers.get('verify-upload-receipt')(new Request(baseUrl+'/functions/v1/verify-upload-receipt',{method:'POST',headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({organization_id:fixture.organizationId,project_id:fixture.projectId,document_id:original.documentId,request_id:original.documentId,storage_bucket:original.bucket,storage_path:original.path,original_filename:original.originalFilename,document_type:'receipt',file_size_bytes:original.bytes,mime_type:'application/pdf'})}));
      const result=await response.json();if(!response.ok||!result.success)throw new Error('Synthetic original verification failed: '+JSON.stringify(result));
    }
    previewConfig.manifest.notRun=previewConfig.manifest.notRun.filter(value=>value!=='server byte/hash attestation');
    previewConfig.manifest.cases.push('Synthetic original bytes verified by checked-in local handler; not real Storage/JWT acceptance');
  }
  if(workerData.scenario==='verified-upload')previewConfig.manifest={synthetic:true,scenario:'verified-upload',fixtures:{a:{organizationId:scope.organizationId,projectId:scope.projectId},b:{organizationId:scope.otherOrganizationId,projectId:scope.otherProjectId}},notRun:['real Supabase Auth/JWT/Storage','independent SQL connection lock-wait races','service-role maintenance attestation']};
  parentPort.on('message',async message=>{try{
    let value;
    if(message.kind==='request'){const input=message.value,response=await dispatch(new Request(input.url,{method:input.method,headers:input.headers,...(['GET','HEAD'].includes(input.method)?{}:{body:input.body})}));value={status:response.status,headers:[...response.headers],body:response.body?new Uint8Array(await response.arrayBuffer()):null};}
    else if(message.kind==='fault'){fault=message.value;value=true;}
    else if(message.kind==='close'){await new Promise(resolve=>server.close(resolve));await dbQueue;await flow.close();value=true;}
    else throw new Error('Unknown worker command');
    parentPort.postMessage({id:message.id,value});
  }catch(error){parentPort.postMessage({id:message.id,error:{message:error.message,code:error.code}});}});
  parentPort.postMessage({kind:'ready',scope,baseUrl,publicKey:PUBLIC_KEY,accounts,config:previewConfig});
}catch(error){if(server)server.close();if(flow)await flow.close().catch(()=>{});parentPort.postMessage({kind:'fatal',message:error.message,code:error.code});}
