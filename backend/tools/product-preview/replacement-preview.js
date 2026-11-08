// LOCAL SYNTHETIC ONLY. No cloud URL, secrets, imported business data or mock success.
// Starts its own loopback API and seeds a retained 100kWh/50kg historical report
// via the actual verification/manual/confirmation/recalculation/report handlers.
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createProductRuntime} from './runtime.js';
if(process.argv.length!==2)throw new Error('Usage: node backend/tools/product-preview/replacement-preview.js (dedicated loopback4214 only)');
const runtime=await createProductRuntime({scenario:'manual-transcription',port:4214});
try{
 const call=async(name,body,token)=>{const response=await fetch(runtime.baseUrl+'/functions/v1/'+name,{method:'POST',headers:{apikey:runtime.publicKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok||!data.success)throw new Error(name+' failed: '+(data.error?.message||response.status));return data.data;};
 const auth=await fetch(runtime.baseUrl+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:runtime.publicKey,'Content-Type':'application/json'},body:JSON.stringify(runtime.accounts.aOwner)});const session=await auth.json();if(!auth.ok||!session.access_token)throw new Error('Synthetic login failed');
 const fixture=runtime.config.manifest.fixtures.a,scope={organization_id:fixture.organizationId,project_id:fixture.projectId};
 const transcription={activity_name:'SYNTHETIC 保留原版100kWh',activity_date:'2026-01-15',category:'energy',subcategory:null,activity_type:'electricity',quantity:100,unit:'kWh',final_scope:2,inclusion_status:'included',exclusion_reason:null,review_note:'SYNTHETIC 人工確認，非OCR',period_start:null,period_end:null,source_locator:'SYNTHETIC page1',source_text:null};
 const draft=await call('manual-transcription',{...scope,document_id:fixture.document.documentId,draft_id:randomUUID(),request_id:randomUUID(),transcription},session.access_token);
 const confirmed=await call('confirm-draft',{...scope,draft_id:draft.draft_id,decision:'confirmed',request_id:randomUUID()},session.access_token);
 const calculation=await call('recalculate-project',{...scope,actor_user_id:session.user.id,force_recalculate:true,formula_version:'v1.0.0',request_id:randomUUID(),action:'calculate'},session.access_token);
 if(calculation.operation_status!=='completed')throw new Error('Initial calculation was not completed');
 const report=await call('generate-report',{...scope,report_version:1,language:'zh-TW',claim_purpose:'internal_management',request_id:randomUUID()},session.access_token);
 const savedResponse=await fetch(runtime.baseUrl+'/rest/v1/report_generations?id=eq.'+report.report_generation_id,{headers:{apikey:runtime.publicKey,Authorization:'Bearer '+session.access_token}}),saved=(await savedResponse.json())[0];
 if(!savedResponse.ok||saved?.gross_emissions_snapshot?.gross_total_co2e_kg!==50||saved.integrity_status!=='server_verified')throw new Error('Expected actual saved synthetic50kg report; no fallback');
 const root=new URL('../../../',import.meta.url);let checkoutSHA='UNKNOWN',sourceDirty=true;try{checkoutSHA=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();const paths=['backend/src','backend/supabase','backend/tools/product-preview','frontend/readdy-app/src','frontend/readdy-app/tools/local-preview','modules'];sourceDirty=execFileSync('git',['status','--porcelain','--',...paths],{cwd:root,encoding:'utf8'}).trim().length>0;}catch{/* no invented source identity */}
 const query=new URLSearchParams({organization_id:scope.organization_id,projectId:scope.project_id});
 console.log(JSON.stringify({synthetic:true,pid:process.pid,api:runtime.baseUrl,app:'http://127.0.0.1:4215/login',checkoutSHA,sourceDirty,startedAt:new Date().toISOString(),account:runtime.accounts.aOwner.email,password:'synthetic-local-only',scope,documentId:fixture.document.documentId,draftId:draft.draft_id,activityId:confirmed.emission_activity_id,calculationIds:calculation.calculation_result_ids,reportId:report.report_generation_id,savedKg:50,activitiesUrl:'http://127.0.0.1:4215/admin/activities?'+query,reportUrl:'http://127.0.0.1:4215/admin/reports/'+report.report_generation_id+'?'+query,notice:'LOCAL SYNTHETIC ONLY. Existing ports/projects preserved. API4214 restart creates fresh synthetic IDs/data. No managedSupabase/JWT/Storage/Edge or native save acceptance.'},null,2));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await runtime.close();process.exit(0);});
}catch(error){await runtime.close();throw error;}
