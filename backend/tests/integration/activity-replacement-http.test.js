// Local synthetic Auth/Storage transport; real handlers, SDK, services and SQL migrations.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';
import {createProductRuntime} from '../../tools/product-preview/runtime.js';
import {saveManualActivity,calculateManualProject,saveManualReport,readManualActivities} from '../../../frontend/readdy-app/src/services/manualWorkflow.ts';
import {replacementOperation,canonicalReplacementIntent} from '../../../frontend/readdy-app/src/services/activityReplacement.ts';
import {readActivityLineage} from '../../../frontend/readdy-app/src/services/activityLineage.ts';
import {readActivityDetail} from '../../../frontend/readdy-app/src/services/activityDetail.ts';
import {readProjectOverview} from '../../../frontend/readdy-app/src/services/projectStatistics.ts';
const {createClient}=createRequire(new URL('../../../frontend/readdy-app/package.json',import.meta.url))('@supabase/supabase-js');
const input={activity_name:'SYNTHETIC original electricity',activity_date:'2026-01-15',category:'energy',activity_type:'electricity',quantity:'100',unit:'kWh',inclusion_status:'included',final_scope:'2',notes:'SYNTHETIC',exclusion_reason:''};
const correction={activity_name:'SYNTHETIC corrected electricity',activity_date:'2026-01-15',category:'energy',subcategory:null,activity_type:'electricity',quantity:120,unit:'kWh',data_quality:'primary',inclusion_status:'included',exclusion_reason:null,review_note:'SYNTHETIC correction',final_scope:2,status:'active'};
async function setup(options={}){const runtime=await createProductRuntime({port:0,...options}),client=createClient(runtime.baseUrl,runtime.publicKey,{auth:{persistSession:false,autoRefreshToken:false}}),login=await client.auth.signInWithPassword(runtime.accounts.owner);assert.equal(login.error,null);return {runtime,client,scope:{organizationId:runtime.scope.organizationId,projectId:runtime.scope.projectId},user:runtime.scope.userId,token:login.data.session.access_token};}
async function analytics(f){const url=new URL('/functions/v1/analytics-emissions',f.runtime.baseUrl);url.search=new URLSearchParams({organization_id:f.scope.organizationId,project_id:f.scope.projectId,dimension:'ghg_scope'}).toString();const response=await fetch(url,{headers:{Authorization:'Bearer '+f.token,apikey:f.runtime.publicKey}});return {status:response.status,body:await response.json()};}
async function row(f,table,id){const result=await f.client.from(table).select('*').eq('id',id).eq('organization_id',f.scope.organizationId).eq('project_id',f.scope.projectId).single();assert.equal(result.error,null);return result.data;}
async function close(f){await f.client.auth.signOut({scope:'local'});await f.runtime.close();}
async function api(f,path,token,body,method='POST'){const response=await fetch(f.runtime.baseUrl+path,{method,headers:{Authorization:'Bearer '+token,apikey:f.runtime.publicKey,'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json().catch(()=>null)};}
test('actual services correct100→120 with loss/lookup, preserve original rows/report and count only120→60kg across views/list/detail/stats/report',async()=>{
 const f=await setup();try{
  const old=await saveManualActivity(f.client,f.scope,f.user,randomUUID(),input),calc=await calculateManualProject(f.client,f.scope,f.user,randomUUID()),report=await saveManualReport(f.client,f.scope,f.user,{requestId:randomUUID(),version:1});assert.equal(report.gross_emissions_snapshot.gross_total_co2e_kg,50);
  const oldActivity=await row(f,'emission_activities',old.id),oldCalculation=await row(f,'calculation_results',calc.calculation_result_ids[0]),oldReport=await row(f,'report_generations',report.id);
  const ref={requestId:randomUUID(),predecessorId:old.id,intent:canonicalReplacementIntent({mode:'correct',reason:'SYNTHETIC meter correction',input:correction})};
  await f.runtime.failNext({path:'/rest/v1/rpc/replace_emission_activity',phase:'afterCommit'});await assert.rejects(()=>replacementOperation(f.client,f.scope,f.user,ref,'replace'));
  const saved=await replacementOperation(f.client,f.scope,f.user,ref,'lookup');assert.equal(saved.replayed,true);assert.equal(saved.operation_status,'completed');assert.equal(saved.activity.quantity,120);assert.notEqual(saved.activity_id,old.id);assert.equal(saved.recalculation_required,true);
  const before=await readProjectOverview(f.client,{projectId:f.scope.projectId,organizationId:f.scope.organizationId});assert.equal(before.statistics.total_emissions_kg,null);assert.equal(before.statistics.total_activities,1);
  const incomplete=await analytics(f);assert.equal(incomplete.status,409,JSON.stringify(incomplete.body));assert.equal(incomplete.body.error.code,'ANALYTICS_CALCULATION_INCOMPLETE');assert.match(incomplete.body.error.message,/先重新計算/);
  const family=await readActivityLineage(f.client,f.scope,old.id);assert.deepEqual(family.versions.map(r=>r.version_index),[1,2]);assert.equal(family.versions[0].successor_activity_id,saved.activity_id);assert.equal(family.versions[1].is_effective,true);
  const all=await readManualActivities(f.client,f.scope,f.user);assert.equal(all.length,2);assert.equal(all.filter(r=>r.is_effective).length,1);assert.equal(all.find(r=>r.id===old.id).successor_activity_id,saved.activity_id);
  const historical=await readActivityDetail(f.client,{activityId:old.id,organizationId:f.scope.organizationId,projectId:f.scope.projectId});assert.equal(historical.calculation,null);assert.equal(historical.historicalCalculation.co2e_kg,50);assert.equal(historical.version.is_effective,false);
  const currentBefore=await readActivityDetail(f.client,{activityId:saved.activity_id,organizationId:f.scope.organizationId,projectId:f.scope.projectId});assert.equal(currentBefore.calculation,null);
  await calculateManualProject(f.client,f.scope,f.user,randomUUID());const report2=await saveManualReport(f.client,f.scope,f.user,{requestId:randomUUID(),version:2});assert.equal(report2.gross_emissions_snapshot.gross_total_co2e_kg,60);assert.deepEqual(report2.payload.appendix_mappings.map(m=>m.emission_activity_id),[saved.activity_id]);
  const overview=await readProjectOverview(f.client,{projectId:f.scope.projectId,organizationId:f.scope.organizationId});assert.equal(overview.statistics.total_emissions_kg,60);assert.equal(overview.statistics.total_emissions,0.06);assert.equal((await analytics(f)).body.data.total_co2e_kg,60);
  assert.deepEqual(await row(f,'emission_activities',old.id),oldActivity);assert.deepEqual(await row(f,'calculation_results',oldCalculation.id),oldCalculation);assert.deepEqual(await row(f,'report_generations',report.id),oldReport);
  assert.equal((await replacementOperation(f.client,f.scope,f.user,ref,'replace')).activity_id,saved.activity_id);
 }finally{await close(f);}
});
test('exclude inherits nonzero quantity/unit, effective collection removes predecessor, and original request later replays as historical',async()=>{
 const f=await setup();try{
  const old=await saveManualActivity(f.client,f.scope,f.user,randomUUID(),input),correctRef={requestId:randomUUID(),predecessorId:old.id,intent:canonicalReplacementIntent({mode:'correct',reason:'SYNTHETIC correction',input:correction})},corrected=await replacementOperation(f.client,f.scope,f.user,correctRef,'replace');
  const excludeRef={requestId:randomUUID(),predecessorId:corrected.activity_id,intent:canonicalReplacementIntent({mode:'exclude',reason:'SYNTHETIC outside inventory boundary',input:{}})},excluded=await replacementOperation(f.client,f.scope,f.user,excludeRef,'replace');assert.equal(excluded.activity.quantity,120);assert.equal(excluded.activity.unit,'kWh');assert.equal(excluded.activity.inclusion_status,'excluded');assert.equal(excluded.activity.exclusion_reason,excludeRef.intent.reason);
  const oldReplay=await replacementOperation(f.client,f.scope,f.user,correctRef,'lookup');assert.equal(oldReplay.operation_status,'historical');assert.equal(oldReplay.activity_id,corrected.activity_id);assert.equal(oldReplay.is_effective,false);
  const calculated=await calculateManualProject(f.client,f.scope,f.user,randomUUID());assert.equal(calculated.excluded_count,1);assert.equal(calculated.processed_activities,1);
  const report=await saveManualReport(f.client,f.scope,f.user,{requestId:randomUUID(),version:1});assert.equal(report.gross_emissions_snapshot.gross_total_co2e_kg,0);assert.equal(report.payload.boundary_summary.excluded_count,1);assert.deepEqual(report.payload.appendix_mappings.map(m=>m.emission_activity_id),[excluded.activity_id]);
  const actual=await readActivityLineage(f.client,f.scope,old.id);assert.deepEqual(actual.versions.map(r=>r.mode),['original','correct','exclude']);assert.deepEqual(actual.versions.map(r=>r.version_index),[1,2,3]);assert.equal((await analytics(f)).status,200);
 }finally{await close(f);}
});
test('analytics preserves actual calculated zero and empty values while pending-factor included activity remains an explicit error',async()=>{
 for(const quantity of ['0','100']){const f=await setup({withFactor:quantity==='0'});try{
  assert.equal((await analytics(f)).status,200);await saveManualActivity(f.client,f.scope,f.user,randomUUID(),{...input,quantity});await calculateManualProject(f.client,f.scope,f.user,randomUUID());
  const value=await analytics(f);if(quantity==='0'){assert.equal(value.status,200);assert.equal(value.body.data.total_co2e_kg,0);}else{assert.equal(value.status,409);assert.equal(value.body.error.code,'ANALYTICS_CALCULATION_INCOMPLETE');}
 }finally{await close(f);}}
});
test('replacement HTTP rejects forged source/actor, viewer/cross-tenant/revoked lookup, changed intent and legacy in-place mutation of either version',async()=>{
 const f=await setup();try{
  const old=await saveManualActivity(f.client,f.scope,f.user,randomUUID(),input),body={organization_id:f.scope.organizationId,project_id:f.scope.projectId,predecessor_activity_id:old.id,request_id:randomUUID(),mode:'correct',reason:'SYNTHETIC correction',input:correction,action:'replace'},path='/functions/v1/replace-emission-activity';
  for(const patch of [{actor_user_id:randomUUID()},{input:{...correction,source_document_id:randomUUID()}},{mode:'exclude',input:{quantity:0,unit:'kg'}}])assert.equal((await api(f,path,f.token,{...body,...patch})).status,400);
  for(const account of ['viewer','otherOwner']){const temporary=createClient(f.runtime.baseUrl,f.runtime.publicKey,{auth:{persistSession:false,autoRefreshToken:false}});try{const login=await temporary.auth.signInWithPassword(f.runtime.accounts[account]);assert.equal(login.error,null);assert.equal((await api(f,path,login.data.session.access_token,body)).status,403);}finally{await temporary.auth.signOut({scope:'local'});}}
  const saved=await api(f,path,f.token,body);assert.equal(saved.status,200,JSON.stringify(saved.body));const newId=saved.body.data.activity_id,original=await row(f,'emission_activities',old.id),successor=await row(f,'emission_activities',newId);
  const conflict=await api(f,path,f.token,{...body,reason:'different reason'});assert.equal(conflict.status,409);assert.match(conflict.body.error.message,/INTENT_CONFLICT/);
  const reused=await api(f,path,f.token,{...body,request_id:randomUUID()});assert.equal(reused.status,409);assert.match(reused.body.error.message,/SUPERSEDED/);
  for(const id of [old.id,newId]){const mutation=await api(f,'/functions/v1/save-manual-activity',f.token,{organization_id:body.organization_id,project_id:body.project_id,activity_id:id,request_id:randomUUID(),input:{...correction,quantity:999}});assert.equal(mutation.status,409);assert.match(mutation.body.error.message,/VERSION_RETAINED/);}
  const member='/rest/v1/organization_members?organization_id=eq.'+f.scope.organizationId+'&user_id=eq.'+f.user;
  assert.equal((await api(f,member,'SYNTHETIC-PRODUCT-SERVICE-KEY',{status:'inactive'},'PATCH')).status,200);assert.equal((await api(f,path,f.token,{...body,action:'lookup'})).status,403);
  assert.equal((await api(f,member,'SYNTHETIC-PRODUCT-SERVICE-KEY',{status:'active'},'PATCH')).status,200);const recovered=await api(f,path,f.token,{...body,action:'lookup'});assert.equal(recovered.status,200);assert.equal(recovered.body.data.activity_id,newId);
  assert.deepEqual(await row(f,'emission_activities',old.id),original);assert.deepEqual(await row(f,'emission_activities',newId),successor);
 }finally{await close(f);}
});
test('source-linked MANUAL correction retains original receipt/draft provenance and immutable historical report',async()=>{
 const f=await setup({scenario:'manual-transcription'});try{
  const original=f.runtime.config.manifest.fixtures.a,scope={organization_id:f.scope.organizationId,project_id:f.scope.projectId},draftId=randomUUID(),transcription={...correction,activity_name:'SYNTHETIC source transcription',quantity:100,period_start:null,period_end:null,source_locator:'SYNTHETIC page 1',source_text:null};delete transcription.data_quality;delete transcription.status;
  const created=await api(f,'/functions/v1/manual-transcription',f.token,{...scope,document_id:original.document.documentId,draft_id:draftId,request_id:randomUUID(),transcription});assert.equal(created.status,200,JSON.stringify(created.body));
  const confirmed=await api(f,'/functions/v1/confirm-draft',f.token,{...scope,draft_id:draftId,decision:'confirmed',request_id:randomUUID(),overrides:{review_note:'SYNTHETIC source checked'}});assert.equal(confirmed.status,200,JSON.stringify(confirmed.body));
  const oldId=confirmed.body.data.emission_activity_id;await calculateManualProject(f.client,f.scope,f.user,randomUUID());const report=await saveManualReport(f.client,f.scope,f.user,{requestId:randomUUID(),version:1}),oldDraft=await row(f,'extracted_document_drafts',draftId),receipt=await row(f,'uploaded_documents',original.document.documentId);
  const replacement=await replacementOperation(f.client,f.scope,f.user,{requestId:randomUUID(),predecessorId:oldId,intent:canonicalReplacementIntent({mode:'correct',reason:'SYNTHETIC human correction; retained original source',input:correction})},'replace');assert.equal(replacement.activity.source_document_id,original.document.documentId);assert.equal(replacement.activity.source_draft_id,draftId);
  assert.deepEqual(await row(f,'extracted_document_drafts',draftId),oldDraft);assert.deepEqual(await row(f,'uploaded_documents',original.document.documentId),receipt);assert.deepEqual(await row(f,'report_generations',report.id),report);
  await calculateManualProject(f.client,f.scope,f.user,randomUUID());assert.equal((await saveManualReport(f.client,f.scope,f.user,{requestId:randomUUID(),version:2})).gross_emissions_snapshot.gross_total_co2e_kg,60);
 }finally{await close(f);}
});
