import {serveWithCors} from '../_shared/cors.ts';
import {parseJson,successEnvelope,errorEnvelope,methodNotAllowed} from '../_shared/http.ts';
import {AuthzError,requireOrganizationWriteAccess} from '../_shared/authz.ts';
import {createServiceRoleClient} from '../_shared/supabase-client.ts';
import {enforce_subscription_readonly} from '../../../src/services/enforce-subscription-readonly.js';
import {verifyUploadReceipt,validateVerificationInput} from '../../../src/services/verify-upload-receipt.js';
import {createSupabasePrivateFileAdapter} from '../../../src/adapters/supabase-private-file.js';
serveWithCors(async(request:Request)=>{
 if(request.method!=='POST')return methodNotAllowed(request);
 let input;
 try{
  input=validateVerificationInput(await parseJson(request));
  const client=createServiceRoleClient(),actor=await requireOrganizationWriteAccess(request,client,input.organization_id);
  const subscriptions=await client.from('subscriptions').select('*').eq('organization_id',input.organization_id).order('period_end',{ascending:false});
  if(subscriptions.error)throw subscriptions.error;
  if(!enforce_subscription_readonly({organization_id:input.organization_id,subscriptions:subscriptions.data||[]}).can_write_formal_data)return errorEnvelope(request,{code:'SUBSCRIPTION_READONLY',message:'Subscription does not allow receipt verification'},{httpStatus:403,status:'readonly',requestId:input.request_id});
  const storage=createSupabasePrivateFileAdapter({url:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')});
  const data=await verifyUploadReceipt({client,storage,actorUserId:actor.user_id,input,signal:request.signal});
  return successEnvelope(request,data,{status:data.state,requestId:input.request_id});
 }catch(cause){
  const code=cause instanceof AuthzError?cause.code:cause?.code||'VERIFICATION_NOT_CONFIRMED';
  return errorEnvelope(request,{code,message:cause?.message||'Verification not confirmed',details:input?{document_id:input.document_id,request_id:input.request_id,verification_state:'unconfirmed',retry:'Keep the same document/request IDs; no automatic cleanup or byte resend'}:null},{httpStatus:cause instanceof AuthzError?cause.httpStatus:cause?.status||409,status:'unconfirmed',requestId:input?.request_id});
 }
},{allowedMethods:['POST']});
