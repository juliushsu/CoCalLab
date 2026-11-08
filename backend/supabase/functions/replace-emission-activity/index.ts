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
  const recovering=input.action==='recover';
  const args={p_organization_id:input.organization_id,p_project_id:input.project_id,p_actor_user_id:actor.user_id,p_predecessor_activity_id:input.predecessor_activity_id};
  const saved=recovering?await client.rpc('recover_activity_replacement',args):await client.rpc('replace_emission_activity',{...args,p_request_id:input.request_id,p_mode:input.mode,p_reason:input.reason,p_input:input.input,p_action:input.action});
  if(saved.error){
   const code=saved.error.message?.match(/(?:ACTIVITY_REPLACEMENT|REPLACEMENT|ACTIVITY|SOURCE|MANUAL)_[A-Z_]+|verification_[a-z_]+/)?.[0]||'ACTIVITY_REPLACEMENT_FAILED';
   const explanations:Record<string,string>={verification_object_binding_changed:'原件與保存驗證不一致；更正須使用仍有效且已驗證的原件，不能自動升格舊收據。',ACTIVITY_REPLACEMENT_SOURCE_INVALID:'來源文件／草稿已失效或範圍不一致；未保存更正或排除。'};
   const explanation=explanations[code]||(/^(verification_|MANUAL_|SOURCE_)/.test(code)?'來源驗證未通過；人工更正須有仍有效的已驗證原件。舊未驗證來源僅可在合法範圍內排除，不會自動升格。':'');
   return toErrorEnvelope(request,new Error((explanation?explanation+' ':'')+saved.error.message),{code,httpStatus:saved.error.code==='42501'?403:409,requestId:input.request_id});
  }
  const result=(Array.isArray(saved.data)?saved.data[0]:saved.data)?.result;
  if(!result||result.organization_id!==input.organization_id||result.project_id!==input.project_id||result.predecessor_activity_id!==input.predecessor_activity_id||(!recovering&&(result.request_id!==input.request_id||result.mode!==input.mode))||!(recovering?['not_found','superseded','completed','historical']:['not_found','completed','historical']).includes(result.operation_status))return errorEnvelope(request,{code:'ACTIVITY_REPLACEMENT_UNCONFIRMED',message:'Saved replacement identity was not verified; retain the same request for lookup'},{httpStatus:409,requestId:input.request_id});
  if(recovering){
   const absent=['not_found','superseded'].includes(result.operation_status);
   if(absent?['activity_id','request_id','mode','reason','input','canonical_input'].some(key=>result[key]!==null):typeof result.request_id!=='string'||!result.request_id.trim()||!['correct','exclude'].includes(result.mode)||typeof result.reason!=='string'||!result.reason.trim()||result.input===null||typeof result.input!=='object'||Array.isArray(result.input)||result.canonical_input===null||typeof result.canonical_input!=='object'||Array.isArray(result.canonical_input))return errorEnvelope(request,{code:'ACTIVITY_REPLACEMENT_UNCONFIRMED',message:'Recovery did not return a verified private operation; no new request is authorized'},{httpStatus:409});
  }
  return successEnvelope(request,result,{status:result.operation_status,requestId:input.request_id});
 }catch(error){return toErrorEnvelope(request,error,{code:error instanceof AuthzError?error.code:'ACTIVITY_REPLACEMENT_INPUT_INVALID',httpStatus:error instanceof AuthzError?error.httpStatus:400});}
},{allowedMethods:['POST']});
