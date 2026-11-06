import { serveWithCors } from '../_shared/cors.ts';
import { parseJson, successEnvelope, toErrorEnvelope, methodNotAllowed } from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import { validateRecalculateProjectInput } from '../../../src/contracts/contracts.js';
import { recalculate_project } from '../../../src/services/recalculate-project.js';
import { AuthzError, requireOrganizationWriteAccess } from '../_shared/authz.ts';
import { externalActionsBlockedInCurrentEnv } from '../_shared/staging-guard.ts';
import { insertActionLog } from '../_shared/action-log.ts';

serveWithCors(async (request: Request) => {
 if (request.method !== 'POST') return methodNotAllowed(request);
 let requestId: string | undefined;
 try {
  const input=validateRecalculateProjectInput(await parseJson(request));requestId=input.request_id;
  const supabase=createServiceRoleClient();
  const actor=await requireOrganizationWriteAccess(request,supabase,input.organization_id);
  // JWT actor is authoritative; actor_user_id remains a legacy DTO field.
  const intent={p_organization_id:input.organization_id,p_project_id:input.project_id,
   p_actor_user_id:actor.user_id,p_request_id:input.request_id,
   p_force_recalculate:input.force_recalculate,p_formula_version:input.formula_version};
  const prepared=await supabase.rpc('recalculation_request_v2',{
   ...intent,p_action:input.action==='lookup'?'lookup':'prepare',
  });
  if(prepared.error)throw prepared.error;
  const state=(Array.isArray(prepared.data)?prepared.data[0]:prepared.data)?.result;
  if(!state)throw new Error('RECALCULATION_RESPONSE_MISSING');
  if(input.action==='lookup'||state.operation_status==='completed'){
   return successEnvelope(request,state,{status:state.operation_status,requestId});
  }
  if(state.operation_status!=='pending'||!state.input_snapshot)throw new Error('RECALCULATION_PREPARATION_INVALID');
  // Complete SQL inputs avoid REST page caps. Versions are assigned in SQL.
  const summary=recalculate_project({organization_id:input.organization_id,project_id:input.project_id,
   activities:state.input_snapshot.activities,factors:state.input_snapshot.factors,
   formula_version:input.formula_version});
  const committed=await supabase.rpc('commit_recalculation_v2',{
   ...intent,p_input_snapshot:state.input_snapshot,p_calculation_results:summary.calculation_results,
  });
  if(committed.error)throw committed.error;
  const result=(Array.isArray(committed.data)?committed.data[0]:committed.data)?.result;
  if(!result||result.operation_status!=='completed')throw new Error('RECALCULATION_COMMIT_UNCONFIRMED');
  // Transactional audit and request authority live in SQL; no log on replay.
  if(!result.replayed)await insertActionLog(supabase,{
   user_id:actor.user_id,organization_id:input.organization_id,project_id:input.project_id,
   action:'recalculate-project',table_name:'calculation_results',record_id:String(input.project_id),
   metadata:{...result,external_actions_blocked:externalActionsBlockedInCurrentEnv()},
  }).catch(error=>console.error('recalculate-project action log failed',error));
  return successEnvelope(request,result,{status:'completed',requestId});
 }catch(error){
  const detail=error as {code?:string;message?:string};
  const denied=error instanceof AuthzError||detail.code==='42501';
  const invalid=detail.code==='22023'||(error instanceof Error&&!('code' in error));
  return toErrorEnvelope(request,error,{
   code:error instanceof AuthzError?error.code:(detail.message?.match(/RECALCULATION_[A-Z_]+|UNSUPPORTED_FORMULA_VERSION/)?.[0]||'RECALCULATE_PROJECT_FAILED'),
   httpStatus:error instanceof AuthzError?error.httpStatus:denied?403:invalid?400:409,requestId,
  });
 }
}, {allowedMethods:['POST']});
