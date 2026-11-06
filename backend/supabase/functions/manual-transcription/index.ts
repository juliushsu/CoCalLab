import {serveWithCors} from '../_shared/cors.ts';
import {parseJson,successEnvelope,toErrorEnvelope,methodNotAllowed,errorEnvelope} from '../_shared/http.ts';
import {createServiceRoleClient} from '../_shared/supabase-client.ts';
import {AuthzError,requireOrganizationWriteAccess} from '../_shared/authz.ts';
import {validateManualTranscriptionInput,MANUAL_PROVIDER} from '../../../src/contracts/manual-transcription.js';
import {enforce_subscription_readonly} from '../../../src/services/enforce-subscription-readonly.js';

serveWithCors(async(request:Request)=>{
  if(request.method!=='POST')return methodNotAllowed(request);
  try{
    const input=validateManualTranscriptionInput(await parseJson(request));
    const client=createServiceRoleClient(),actor=await requireOrganizationWriteAccess(request,client,input.organization_id);
    const subscriptions=await client.from('subscriptions').select('*').eq('organization_id',input.organization_id).order('period_end',{ascending:false});
    if(subscriptions.error)throw subscriptions.error;
    const enforcement=enforce_subscription_readonly({organization_id:input.organization_id,subscriptions:subscriptions.data||[]});
    if(!enforcement.can_write_formal_data)return errorEnvelope(request,{code:'SUBSCRIPTION_READONLY',message:'Subscription does not allow manual transcription',reason:enforcement.reason},{httpStatus:403,status:'readonly',requestId:input.request_id});
    const result=await client.rpc('create_manual_transcription_atomic',{p_organization_id:input.organization_id,p_project_id:input.project_id,p_document_id:input.document_id,p_draft_id:input.draft_id,p_actor_user_id:actor.user_id,p_request_id:input.request_id,p_transcription:input.transcription});
    if(result.error)return toErrorEnvelope(request,new Error(result.error.message),{code:'MANUAL_TRANSCRIPTION_NOT_SAVED',httpStatus:result.error.code==='42501'?403:409,requestId:input.request_id});
    const saved=Array.isArray(result.data)?result.data[0]:result.data,row=saved?.draft_data;
    if(!row||row.id!==input.draft_id||row.extraction_provider!==MANUAL_PROVIDER)throw new Error('Manual save was not confirmed');
    const provenance=row.raw_payload?.manual_transcription;
    return successEnvelope(request,{draft_id:row.id,document_id:row.uploaded_document_id,organization_id:row.organization_id,project_id:row.project_id,extraction_provider:row.extraction_provider,draft_status:row.status,transcribed_by_user_id:provenance?.user_id,transcribed_at:provenance?.transcribed_at,replayed:saved.replayed,transcription:row.normalized_payload},{status:row.status,requestId:input.request_id});
  }catch(error){return toErrorEnvelope(request,error,{code:error instanceof AuthzError?error.code:'MANUAL_TRANSCRIPTION_INVALID',httpStatus:error instanceof AuthzError?error.httpStatus:400});}
},{allowedMethods:['POST']});
