import {serveWithCors} from '../_shared/cors.ts';
import {parseJson,successEnvelope,toErrorEnvelope,methodNotAllowed,errorEnvelope} from '../_shared/http.ts';
import {createServiceRoleClient} from '../_shared/supabase-client.ts';
import {AuthzError,requireOrganizationWriteAccess} from '../_shared/authz.ts';
import {validateActivityReplacementInput} from '../../../src/contracts/activity-replacement.js';
import {enforce_subscription_readonly} from '../../../src/services/enforce-subscription-readonly.js';
serveWithCors(async(request:Request)=>{
 if(request.method!=='POST')return methodNotAllowed(request);
 try{
  const input=validateActivityReplacementInput(await parseJson(request)),client=createServiceRoleClient(),actor=await requireOrganizationWriteAccess(request,client,input.organization_id);
  const subscriptions=await client.from('subscriptions').select('*').eq('organization_id',input.organization_id).order('period_end',{ascending:false});if(subscriptions.error)throw subscriptions.error;
  const enforcement=enforce_subscription_readonly({organization_id:input.organization_id,subscriptions:subscriptions.data||[]});
  if(!enforcement.can_write_formal_data)return errorEnvelope(request,{code:'SUBSCRIPTION_READONLY',message:'Subscription does not allow replacement or operation lookup',reason:enforcement.reason},{httpStatus:403,status:'readonly',requestId:input.request_id});
  const saved=await client.rpc('replace_emission_activity',{p_organization_id:input.organization_id,p_project_id:input.project_id,p_actor_user_id:actor.user_id,p_predecessor_activity_id:input.predecessor_activity_id,p_request_id:input.request_id,p_mode:input.mode,p_reason:input.reason,p_input:input.input,p_action:input.action});
  if(saved.error)return toErrorEnvelope(request,new Error(saved.error.message),{code:saved.error.message?.match(/(?:ACTIVITY_REPLACEMENT|REPLACEMENT|ACTIVITY|SOURCE)_[A-Z_]+/)?.[0]||'ACTIVITY_REPLACEMENT_FAILED',httpStatus:saved.error.code==='42501'?403:409,requestId:input.request_id});
  const result=(Array.isArray(saved.data)?saved.data[0]:saved.data)?.result;
  if(!result||result.organization_id!==input.organization_id||result.project_id!==input.project_id||result.predecessor_activity_id!==input.predecessor_activity_id||result.request_id!==input.request_id||result.mode!==input.mode||!['not_found','completed','historical'].includes(result.operation_status))return errorEnvelope(request,{code:'ACTIVITY_REPLACEMENT_UNCONFIRMED',message:'Saved replacement identity was not verified; retain the same request for lookup'},{httpStatus:409,requestId:input.request_id});
  return successEnvelope(request,result,{status:result.operation_status,requestId:input.request_id});
 }catch(error){return toErrorEnvelope(request,error,{code:error instanceof AuthzError?error.code:'ACTIVITY_REPLACEMENT_INPUT_INVALID',httpStatus:error instanceof AuthzError?error.httpStatus:400});}
},{allowedMethods:['POST']});
