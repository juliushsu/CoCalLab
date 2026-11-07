import {serveWithCors} from '../_shared/cors.ts';
import {parseJson,successEnvelope,toErrorEnvelope,methodNotAllowed,errorEnvelope} from '../_shared/http.ts';
import {createServiceRoleClient} from '../_shared/supabase-client.ts';
import {AuthzError,requireOrganizationWriteAccess} from '../_shared/authz.ts';
import {validateManualActivityInput} from '../../../src/contracts/manual-activity.js';
import {enforce_subscription_readonly} from '../../../src/services/enforce-subscription-readonly.js';

serveWithCors(async(request:Request)=>{
 if(request.method!=='POST')return methodNotAllowed(request);
 try{
  const input=validateManualActivityInput(await parseJson(request)),client=createServiceRoleClient();
  const actor=await requireOrganizationWriteAccess(request,client,input.organization_id);
  const subscriptions=await client.from('subscriptions').select('*').eq('organization_id',input.organization_id).order('period_end',{ascending:false});
  if(subscriptions.error)throw subscriptions.error;
  const enforcement=enforce_subscription_readonly({organization_id:input.organization_id,subscriptions:subscriptions.data||[]});
  if(!enforcement.can_write_formal_data)return errorEnvelope(request,{code:'SUBSCRIPTION_READONLY',message:'Subscription does not allow manual activity changes',reason:enforcement.reason},{httpStatus:403,status:'readonly',requestId:input.request_id});
  const result=await client.rpc('save_manual_activity_atomic',{p_organization_id:input.organization_id,p_project_id:input.project_id,p_actor_user_id:actor.user_id,p_activity_id:input.activity_id,p_input:input.input,p_request_id:input.request_id});
  if(result.error){const code=result.error.message?.match(/(?:ACTIVITY_[A-Z_]+|REPORT_SOURCE_RETAINED)/)?.[0]||'ACTIVITY_SAVE_FAILED';return toErrorEnvelope(request,new Error(result.error.message),{code,httpStatus:code.includes('RETAINED')?409:result.error.code==='42501'?403:409,requestId:input.request_id});}
  const saved=Array.isArray(result.data)?result.data[0]:result.data,row=saved?.activity_data;
  if(!row||row.id!==input.activity_id||row.organization_id!==input.organization_id||row.project_id!==input.project_id||typeof saved.replayed!=='boolean')throw new Error('ACTIVITY_SAVE_NOT_CONFIRMED');
  return successEnvelope(request,{activity:row,replayed:saved.replayed},{status:'saved',requestId:input.request_id});
 }catch(error){return toErrorEnvelope(request,error,{code:error instanceof AuthzError?error.code:'ACTIVITY_INPUT_INVALID',httpStatus:error instanceof AuthzError?error.httpStatus:400});}
},{allowedMethods:['POST']});
