import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readWatchdogConfig, runWatchdog, watchdogMain, RAILWAY_API} from './railway-watchdog.mjs';

// All UUIDs, times and tokens below are explicit synthetic test inputs.
const NOW = Date.parse('2026-11-10T01:00:00Z');
const env = () => ({UAT_LIFECYCLE_ENABLED:'true', UAT_LIFECYCLE_T0_UTC:'2026-11-09T00:00:00Z',
  UAT_RAILWAY_PROJECT_ID:'11111111-1111-4111-8111-111111111111',
  UAT_RAILWAY_ENVIRONMENT_ID:'22222222-2222-4222-8222-222222222222',
  UAT_RAILWAY_SERVICE_ID:'33333333-3333-4333-8333-333333333333',
  UAT_RAILWAY_PROJECT_TOKEN:'SYNTHETIC_RAILWAY_TOKEN_SINGLE_ENV'});
const scope = () => ({data:{projectToken:{
  project:{id:env().UAT_RAILWAY_PROJECT_ID,name:'CoCalLab-UAT-LIFECYCLE-01'},
  environment:{id:env().UAT_RAILWAY_ENVIRONMENT_ID,name:'uat-lifecycle'},
}}});
const row = (n=1,status='EXITED',age=5) => ({node:{
  id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,status,
  createdAt:new Date(NOW-age*60_000).toISOString(),
  completedAt:status==='EXITED'?new Date(NOW-(age-1)*60_000).toISOString():null,
}});
const runs = (edges=[row()]) => ({data:{
  serviceInstance:{id:'44444444-4444-4444-8444-444444444444',serviceName:'uat-lifecycle-cron'},
  deploymentInstanceExecutions:{edges},
}});
function transport(payloads=[scope(),runs()]) {
  const calls=[];
  return {calls, fetchImpl:async(url,options)=>{
    calls.push({url,options});
    const payload=payloads.shift();if(payload instanceof Error)throw payload;
    return payload instanceof Response?payload:new Response(JSON.stringify(payload),{status:200});
  }};
}
async function check(payloads,code,configured=env()) {
  const t=transport(payloads);
  await assert.rejects(runWatchdog({env:configured,fetchImpl:t.fetchImpl,now:NOW}),e=>e.code===code);
  return t;
}

test('unset activation is distinctly disabled and performs no provider reads',async()=>{
  const t=transport();const r=await runWatchdog({env:{},fetchImpl:t.fetchImpl,now:NOW});
  assert.equal(r.status,'DISABLED_NOT_ARMED');assert.equal(t.calls.length,0);
});
test('malformed activation, IDs and missing token fail before a request',async()=>{
  for(const [key,value]of [['UAT_LIFECYCLE_ENABLED','True'],['UAT_RAILWAY_PROJECT_ID','other-project'],['UAT_RAILWAY_PROJECT_TOKEN','']]){
    const e=env();e[key]=value;const t=transport();await assert.rejects(runWatchdog({env:e,fetchImpl:t.fetchImpl,now:NOW}));assert.equal(t.calls.length,0);
  }
});
test('future start, invalid calendar and expired monitoring window fail before requests',async()=>{
  for(const start of ['2026-11-11T00:00:00Z','2026-02-30T00:00:00Z','2026-10-01T00:00:00Z']){
    const e=env();e.UAT_LIFECYCLE_T0_UTC=start;const t=transport();await assert.rejects(runWatchdog({env:e,fetchImpl:t.fetchImpl,now:NOW}));assert.equal(t.calls.length,0);
  }
});
test('scoped token project/environment identity and names must match before reading history',async()=>{
  for(const [kind,key]of [['project','id'],['project','name'],['environment','id'],['environment','name']]){
    const s=scope();s.data.projectToken[kind][key]='SYNTHETIC-OTHER';const t=await check([s],'PROJECT_TOKEN_SCOPE_MISMATCH');assert.equal(t.calls.length,1);
  }
});
test('account-level response cannot substitute for a project token',async()=>{
  await check([{data:{me:{id:'SYNTHETIC-ACCOUNT'}}}],'PROJECT_TOKEN_SCOPE_MISMATCH');
});
test('two bounded queries use only the project-token header and no mutations/logs/variables',async()=>{
  const t=transport();const result=await runWatchdog({env:env(),fetchImpl:t.fetchImpl,now:NOW});
  assert.equal(result.status,'RECENT_CRON_EXIT_CONFIRMED');assert.equal(t.calls.length,2);
  for(const {url,options}of t.calls){assert.equal(url,RAILWAY_API);assert.equal(options.redirect,'error');assert.equal(options.method,'POST');assert.equal(options.headers['Project-Access-Token'],env().UAT_RAILWAY_PROJECT_TOKEN);assert.equal(options.headers.Authorization,undefined);const q=JSON.parse(options.body).query;assert.match(q,/^query /);assert.doesNotMatch(q,/\b(mutation|logs|Variables|deploymentMeta)\b/);}
  assert.deepEqual(JSON.parse(t.calls[1].options.body).variables.input,{environmentId:env().UAT_RAILWAY_ENVIRONMENT_ID,serviceId:env().UAT_RAILWAY_SERVICE_ID});
  assert.equal(JSON.stringify(result).includes(env().UAT_RAILWAY_PROJECT_ID),false);
});
test('deployment SUCCESS is not accepted as a completed cron execution',async()=>{
  await check([scope(),runs([row(1,'SUCCESS')])],'CRON_STATUS_UNKNOWN');
});
test('another service or missing service binding is rejected',async()=>{
  const r=runs();r.data.serviceInstance.serviceName='SYNTHETIC-OTHER';await check([scope(),r],'SERVICE_SCOPE_MISMATCH');
});
test('empty history, stale history and pre-lease history cannot report healthy',async()=>{
  await check([scope(),runs([])],'CRON_HISTORY_MISSING_OR_INVALID');
  await check([scope(),runs([row(1,'EXITED',65)])],'PRIMARY_CRON_STALE');
  await check([scope(),runs([row(1,'EXITED',2000)])],'PRIMARY_CRON_STALE');
});
test('a later successful retry does not hide a recent crash or skipped invocation',async()=>{
  for(const status of ['CRASHED','SKIPPED','STOPPED','REMOVED'])await check([scope(),runs([row(1,'EXITED',5),row(2,status,15)])],'RECENT_CRON_FAILURE_OR_SKIP');
});
test('in-progress run is distinguished while a recent completed run exists',async()=>{
  const t=transport([scope(),runs([row(1,'RUNNING',5),row(2,'EXITED',15)])]);
  const r=await runWatchdog({env:env(),fetchImpl:t.fetchImpl,now:NOW});assert.equal(r.status,'RECENT_EXIT_WITH_RUN_IN_PROGRESS');
});
test('overlong running job and no completed job both alarm',async()=>{
  await check([scope(),runs([row(1,'RUNNING',25),row(2,'EXITED',35)])],'PRIMARY_CRON_OVERTIME');
  await check([scope(),runs([row(1,'RUNNING',5)])],'NO_RECENT_COMPLETED_CRON');
});
test('EXITED requires an actual completion timestamp',async()=>{
  const r=row();r.node.completedAt=null;await check([scope(),runs([r])],'CRON_COMPLETION_UNPROVEN');
});
test('future timestamps and duplicate run IDs fail closed',async()=>{
  const future=row();future.node.createdAt='2026-11-10T02:00:00Z';await check([scope(),runs([future])],'CRON_CLOCK_INVALID');
  await check([scope(),runs([row(),row()])],'CRON_HISTORY_INVALID');
});
test('provider failures and reflected secrets are discarded',async()=>{
  await check([new Response('SYNTHETIC secret echo',{status:403})],'PROVIDER_HTTP_FAILURE');
  await check([{errors:[{message:env().UAT_RAILWAY_PROJECT_TOKEN}],data:null}],'PROVIDER_QUERY_FAILED');
  await check([new Error('SYNTHETIC raw network details '+env().UAT_RAILWAY_PROJECT_TOKEN)],'PROVIDER_READ_FAILED');
});
test('malformed and oversized provider responses are rejected',async()=>{
  await check([new Response('not JSON')],'PROVIDER_RESPONSE_INVALID');
  await check([new Response('x'.repeat(262145))],'PROVIDER_RESPONSE_TOO_LARGE');
});
test('sanitized CLI error never echoes raw config or token',async()=>{
  const e=env();e.UAT_RAILWAY_PROJECT_TOKEN='';const output=[];
  assert.equal(await watchdogMain(e,x=>output.push(x),x=>output.push(x)),1);
  assert.equal(output.length,1);assert.equal(JSON.parse(output[0]).status,'ALERT_REQUIRED');assert.ok(!output[0].includes(e.UAT_RAILWAY_PROJECT_ID));
});
test('actual loopback HTTP exercises headers/body and never contacts Railway',async(t)=>{
  const requests=[];
  const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;requests.push({headers:req.headers,body:JSON.parse(body)});res.setHeader('Content-Type','application/json');res.end(JSON.stringify(requests.length===1?scope():runs()));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const fetchImpl=(url,options)=>{assert.equal(url,RAILWAY_API);return fetch(`http://127.0.0.1:${server.address().port}/`,options);};
  const result=await runWatchdog({env:env(),fetchImpl,now:NOW});assert.equal(result.providerReads,2);assert.equal(requests.length,2);
  assert.equal(requests[0].headers['project-access-token'],env().UAT_RAILWAY_PROJECT_TOKEN);
  assert.match(requests[1].body.query,/deploymentInstanceExecutions/);
});
test('redirects are not followed, including a potential credential destination',async(t)=>{
  let hits=0;
  const server=http.createServer((req,res)=>{hits++;res.writeHead(302,{Location:'/must-not-follow'});res.end();});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const fetchImpl=(url,options)=>fetch(`http://127.0.0.1:${server.address().port}/`,options);
  await assert.rejects(runWatchdog({env:env(),fetchImpl,now:NOW}),e=>e.code==='PROVIDER_READ_FAILED');assert.equal(hits,1);
});
test('network stalls hit a bounded abort and remain sanitized',async()=>{
  const fetchImpl=(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('SYNTHETIC stalled network')),{once:true}));
  const keepAlive=setTimeout(()=>{},1000);
  try{await assert.rejects(runWatchdog({env:env(),fetchImpl,now:NOW,timeoutMs:20}),e=>e.code==='PROVIDER_READ_FAILED');}finally{clearTimeout(keepAlive);}
});
test('malformed GraphQL errors cannot accompany a healthy scope result',async()=>{
  const s=scope();s.errors={message:'SYNTHETIC provider failure'};await check([s,runs()],'PROVIDER_QUERY_FAILED');
});
test('empty service binding cannot authenticate the requested service',async()=>{
  const r=runs();r.data.serviceInstance.id='';await check([scope(),r],'SERVICE_SCOPE_MISMATCH');
});
test('an exited job exceeding the bounded runtime still alarms',async()=>{
  const r=row(1,'EXITED',35);r.node.completedAt=new Date(NOW-60_000).toISOString();
  await check([scope(),runs([r])],'PRIMARY_CRON_OVERTIME');
});
