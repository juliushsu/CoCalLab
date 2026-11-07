import {serveWithCors} from '../_shared/cors.ts';
import {parseJson,successEnvelope,errorEnvelope,toErrorEnvelope,methodNotAllowed} from '../_shared/http.ts';
import {createServiceRoleClient} from '../_shared/supabase-client.ts';
import {requireOrganizationWriteAccess,AuthzError} from '../_shared/authz.ts';
import {enforce_subscription_readonly} from '../../../src/services/enforce-subscription-readonly.js';
import {exportSnapshotInput,exportSavedSnapshot} from '../../../src/services/report-export.js';

serveWithCors(async(request:Request)=>{
 if(request.method!=='POST')return methodNotAllowed(request);
 // Default closed. Owner-approved deployment/configuration is separate from local development.
 if(Deno.env.get('REPORT_EXPORT_POLICY')!=='tenant_write_v1')return errorEnvelope(request,{code:'EXPORT_NOT_ENABLED',message:'Server export policy is not enabled'},{httpStatus:403});
 try{
  let input;try{input=exportSnapshotInput(await parseJson(request));}catch{return errorEnvelope(request,{code:'INVALID_EXPORT_INPUT',message:'Exact organization/project/report IDs are required; actor and policy cannot be supplied'},{httpStatus:400});}
  const db=createServiceRoleClient();
  const authorize=async()=>{
   const actor=await requireOrganizationWriteAccess(request,db,input.organization_id);
   const {data,error}=await db.from('subscriptions').select('*').eq('organization_id',input.organization_id);
   if(error)throw error;
   const enforcement=enforce_subscription_readonly({organization_id:input.organization_id,subscriptions:data||[]});
   if(!enforcement.can_write_formal_data)throw new AuthzError('EXPORT_READONLY','Subscription does not permit export',403);
   return actor;
  };
  const actor=await authorize();
  const project=await db.from('projects').select('id,organization_id').eq('id',input.project_id).eq('organization_id',input.organization_id).maybeSingle();
  if(project.error)throw project.error;
  if(!project.data)return errorEnvelope(request,{code:'REPORT_NOT_FOUND',message:'No matching saved report'},{httpStatus:404});
  const result=await db.rpc('read_verified_report_snapshot',{p_organization_id:input.organization_id,p_project_id:input.project_id,p_actor_user_id:actor.user_id,p_report_id:input.report_id});
  if(result.error){const code=result.error.message?.match(/REPORT_SNAPSHOT_(?:UNVERIFIED|INTEGRITY_MISMATCH)/)?.[0]||'REPORT_VERIFIED_READ_UNAVAILABLE';return errorEnvelope(request,{code,message:result.error.message||'Verified report read unavailable'},{httpStatus:result.error.code==='42501'?403:409});}
  const row=Array.isArray(result.data)?result.data[0]:result.data;
  if(!row)return errorEnvelope(request,{code:'REPORT_NOT_FOUND',message:'No matching completed saved report'},{httpStatus:404});
  const snapshot=exportSavedSnapshot(row,input);
  await authorize(); // Recheck revocation/subscription after async snapshot reads.
  return successEnvelope(request,{snapshot,policy:'tenant_write_v1'});
 }catch(error){
  if(error instanceof AuthzError)return errorEnvelope(request,{code:error.code,message:error.message},{httpStatus:error.httpStatus});
  return toErrorEnvelope(request,error,{code:'EXPORT_SNAPSHOT_FAILED',httpStatus:400});
 }
}, {allowedMethods:['POST']});
