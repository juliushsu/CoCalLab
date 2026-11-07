import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {projectOverviewSelection,readProjectOverview,summarizeProjectStatistics,matchingProjectOverviewState,formatProjectEmissionTonnes} from '../src/services/projectStatistics.ts';
const P='00000000-0000-0000-0000-000000000001',O='00000000-0000-0000-0000-000000000002',A='00000000-0000-0000-0000-000000000003',B='00000000-0000-0000-0000-000000000004';
const C='00000000-0000-0000-0000-000000000005',D='00000000-0000-0000-0000-000000000006';
const selected={projectId:P,organizationId:O};
const activity=(id=A,status='active',inclusion_status='included')=>({id,organization_id:O,project_id:P,status,inclusion_status});
const calc=(id=C,emission_activity_id=A,status='calculated',co2e_kg:unknown=2545)=>({id,organization_id:O,project_id:P,emission_activity_id,is_latest:true,status,co2e_kg});
const project={id:P,organization_id:O,name:'TEST ONLY synthetic project',project_code:'TEST-P',organization:{display_name:'TEST ONLY tenant'}};
test('very small positive emissions never display as a true zero',()=>{
 assert.equal(formatProjectEmissionTonnes(0),'0');assert.equal(formatProjectEmissionTonnes(null),'未知');
 assert.equal(formatProjectEmissionTonnes(0.0000004),'4.0000e-7');assert.equal(formatProjectEmissionTonnes(2.545),'2.545');
});
type Result={data:unknown;count?:number;status?:number};
function harness(override?:(table:string,url:URL,method:string,call:number)=>Result|undefined){
 const requests:{url:URL;method:string;headers:Headers}[]=[];let call=0;
 const client=createClient('https://synthetic-sdk.invalid','test-only-public-key',{accessToken:async()=>'test-only-user-token',auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,init)=>{
  const u=new URL(String(url)),table=u.pathname.split('/').at(-1)!,method=init?.method??'GET';requests.push({url:u,method,headers:new Headers(init?.headers)});call++;
  const result=override?.(table,u,method,call)??(table==='projects'?{data:project}:table==='uploaded_documents'?{data:null,count:2}:table==='report_generations'?{data:null,count:0}:table==='effective_emission_activities'?{data:[activity()],count:1}:{data:[calc()],count:1});
  return new Response(method==='HEAD'?null:JSON.stringify(result.data),{status:result.status??200,headers:{'Content-Type':'application/json',...(result.count!==undefined?{'Content-Range':result.count===0?'*/0':`0-0/${result.count}`}:{})}});
 }}});
 return {client,requests};
}
test('project scope accepts matching UUID aliases and rejects conflicting route/project/tenant input',()=>{
 assert.deepEqual(projectOverviewSelection(P.toUpperCase(),`organizationId=${O.toUpperCase()}&projectId=${P}`),selected);
 assert.deepEqual(projectOverviewSelection(P,''),{projectId:P});
 for(const query of [`project_id=${B}`,`organization_id=${O}&organizationId=${B}`,`organization_id=${O}&organization_id=${O}`,'organization_id=','project_id=bad'])assert.throws(()=>projectOverviewSelection(P,query));
 assert.throws(()=>projectOverviewSelection(undefined,''));
});
test('latest included-active total uses kg and converts to tonnes once; irrelevant activities do not count',()=>{
 const stats=summarizeProjectStatistics([activity(),activity(B,'archived'),activity(D,'active','excluded')],[calc(),calc(P,B,'calculated',999999),calc(O,D,'calculated',999999)],2,1);
 assert.equal(stats.total_emissions_kg,2545);assert.equal(stats.total_emissions,2.545);
 assert.equal(stats.total_activities,3);assert.equal(stats.active_activities,2);assert.equal(stats.inclusion_rate,50);assert.equal(stats.report_generated,true);
});
test('project overview uses effective leaves/calculations so retained predecessor plus successor never double count',async()=>{
 const {client,requests}=harness(table=>{
  if(table==='emission_activities')return {data:[activity(A),activity(B)],count:2};
  if(table==='calculation_results')return {data:[calc(C,A,'calculated',50),calc(D,B,'calculated',60)],count:2};
  if(table==='effective_emission_activities')return {data:[activity(B)],count:1};
  if(table==='effective_calculation_results')return {data:[calc(D,B,'calculated',60)],count:1};
 });
 const overview=await readProjectOverview(client,selected);assert.equal(overview.statistics.total_emissions_kg,60);assert.equal(overview.statistics.total_activities,1);
 assert.ok(requests.some(r=>r.url.pathname.endsWith('/effective_emission_activities')));assert.ok(requests.some(r=>r.url.pathname.endsWith('/effective_calculation_results')));
});
test('valid zero is preserved, but empty or uncalculated included activities have unknown total',()=>{
 assert.equal(summarizeProjectStatistics([activity()],[calc(C,A,'calculated',0)],0,0).total_emissions,0);
 for(const calculations of [[],[calc(C,A,'pending_factor',0)],[calc(C,A,'error',500)],[calc(C,A,'superseded',500)],[calc(C,A,'calculated',null)],[calc(C,A,'calculated','100')],[calc(C,A,'calculated',-1)],[calc(C,A,'calculated',Infinity)]]){
 const stats=summarizeProjectStatistics([activity()],calculations,0,0);assert.equal(stats.total_emissions,null);assert.equal(stats.calculation_completed,false);}
 const empty=summarizeProjectStatistics([],[],0,0);assert.equal(empty.total_emissions,null);assert.equal(empty.inclusion_rate,null);
});
test('partial calculation does not present a subtotal as complete project emissions',()=>{
 const stats=summarizeProjectStatistics([activity(),activity(B)],[calc()],0,0);
 assert.equal(stats.total_emissions,null);assert.equal(stats.calculated_activities,1);assert.equal(stats.included_activities,2);
});
test('duplicate latest result, unknown activity and invalid activity state fail explicitly',()=>{
 assert.throws(()=>summarizeProjectStatistics([activity()],[calc(),calc(D)],0,0));
 assert.throws(()=>summarizeProjectStatistics([activity()],[calc(C,B)],0,0));
 assert.throws(()=>summarizeProjectStatistics([activity(A,'invalid')],[],0,0));
});
test('SDK reads only selected project, anchors tenant scope, exact counts, latest fields and completed reports',async()=>{
 const {client,requests}=harness();const result=await readProjectOverview(client,selected);
 assert.equal(result?.statistics.total_emissions,2.545);assert.equal(requests.length,5);
 for(const request of requests){assert.equal(request.headers.get('authorization'),'Bearer test-only-user-token');assert.ok(['GET','HEAD'].includes(request.method));if(!request.url.pathname.endsWith('/projects')){assert.equal(request.url.searchParams.get('project_id'),'eq.'+P);assert.equal(request.url.searchParams.get('organization_id'),'eq.'+O);}}
 const calculations=requests.find(r=>r.url.pathname.endsWith('/effective_calculation_results'))!.url;
 assert.equal(calculations.searchParams.get('is_latest'),'eq.true');assert.ok(calculations.searchParams.get('select')!.includes('co2e_kg'));assert.ok(!calculations.toString().includes('co2e_total'));
 assert.equal(requests.at(-1)!.url.searchParams.get('status'),'eq.completed');
});
test('inaccessible project returns empty without downstream queries; wrong tenant is rejected',async()=>{
 let h=harness(table=>table==='projects'?{data:null}:undefined);assert.equal(await readProjectOverview(h.client,selected),null);assert.equal(h.requests.length,1);
 h=harness(table=>table==='projects'?{data:{...project,organization_id:B}}:undefined);await assert.rejects(readProjectOverview(h.client,selected),/範圍不符/);assert.equal(h.requests.length,1);
});
test('permission/server failure at every read is an error, never zero or partial success',async()=>{
 for(const table of ['projects','uploaded_documents','effective_emission_activities','effective_calculation_results','report_generations']){
  for(const status of [403,503]){const {client}=harness(current=>current===table?{data:{message:'synthetic permission/server failure',code:'42501'},status}:undefined);
  await assert.rejects(readProjectOverview(client,selected),/讀取失敗/);}
 }
});
test('missing count and network failures are explicit errors',async()=>{
 const {client}=harness(table=>table==='uploaded_documents'?{data:null}:undefined);
 await assert.rejects(readProjectOverview(client,selected),/讀取失敗/);
 const unavailable=createClient('https://synthetic-sdk.invalid','test-only-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async()=>{throw new TypeError('Synthetic network failure');}}});
 await assert.rejects(readProjectOverview(unavailable,selected),/讀取失敗/);
});
test('server response cap smaller than requested page is followed to exact total',async()=>{
 const {client,requests}=harness((table,url)=>{
 if(table==='effective_emission_activities')return {data:[Number(url.searchParams.get('offset'))===0?activity():activity(B)],count:2};
 if(table==='effective_calculation_results')return {data:[],count:0};
 });
 const result=await readProjectOverview(client,selected);assert.equal(result?.statistics.total_activities,2);
 assert.deepEqual(requests.filter(r=>r.url.pathname.endsWith('/effective_emission_activities')).map(r=>r.url.searchParams.get('offset')),['0','1']);
});
test('truncated, changing and repeated paginated results fail instead of silently undercounting',async()=>{
 for(const kind of ['empty','count-changed','duplicate']){
 const {client}=harness((table,url)=>{
  if(table==='effective_emission_activities'){const first=Number(url.searchParams.get('offset'))===0;return {data:first?[activity()]:kind==='empty'?[]:kind==='duplicate'?[activity()]:[activity(B)],count:kind==='count-changed'&&!first?3:2};}
  return undefined;
 });
 await assert.rejects(readProjectOverview(client,selected),/不完整|變動|重複/);
 }
});
test('returned child tenant/project mismatches fail despite query filters',async()=>{
 for(const table of ['effective_emission_activities','effective_calculation_results']){const {client}=harness(t=>t===table?{data:[{...(table==='effective_emission_activities'?activity():calc()),organization_id:B}],count:1}:undefined);await assert.rejects(readProjectOverview(client,selected),/組織不符/);}
});
test('project/session/query/retry change hides old read context before the next effect',()=>{
 const key={projectId:P,session:{token:'synthetic-1'},search:'',retry:0},state={key,value:{total:2.545}};
 assert.equal(matchingProjectOverviewState(state,key),state.value);
 for(const next of [{...key,projectId:B},{...key,session:{token:'synthetic-2'}},{...key,search:'other'},{...key,retry:1}])assert.equal(matchingProjectOverviewState(state,next),null);
});

