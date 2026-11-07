import {serveWithCors} from '../_shared/cors.ts';
import {parseJson,successEnvelope,errorEnvelope,methodNotAllowed} from '../_shared/http.ts';
import {createServiceRoleClient} from '../_shared/supabase-client.ts';
import {AuthzError,requireOrganizationWriteAccess} from '../_shared/authz.ts';
import {deleteUploadedDocument,validateDeletionInput} from '../../../src/services/delete-uploaded-document.js';
serveWithCors(async(request:Request)=>{
 if(request.method!=='POST')return methodNotAllowed(request);
 let input;
 try{
  input=validateDeletionInput(await parseJson(request));
  const client=createServiceRoleClient(),actor=await requireOrganizationWriteAccess(request,client,input.organization_id);
  const operation=await deleteUploadedDocument({client,actorUserId:actor.user_id,input});
  return successEnvelope(request,operation,{requestId:input.request_id,status:operation.operation_status});
 }catch(cause){
  const denied=cause instanceof AuthzError;
  const record=typeof cause==='object'&&cause!==null?cause:null;
  const code=record&&'code' in record&&typeof record.code==='string'&&record.code?record.code:'DOCUMENT_DELETE_UNCONFIRMED';
  const message=record&&'message' in record&&typeof record.message==='string'&&record.message?record.message:'Deletion not confirmed';
  const status=record&&'status' in record&&typeof record.status==='number'&&record.status?record.status:409;
  return errorEnvelope(request,{code:denied?cause.code:code,message,details:input?{organization_id:input.organization_id,project_id:input.project_id,document_id:input.document_id,request_id:input.request_id,operation_status:'unconfirmed',recovery:'Keep the same reference. Lookup saved operation; no automatic undo, new ID, byte resend or receipt hard deletion.'}:null},{requestId:input?.request_id,status:'unconfirmed',httpStatus:denied?cause.httpStatus:status});
 }
},{allowedMethods:['POST']});
