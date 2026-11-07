import { serveWithCors } from '../_shared/cors.ts';
import {
  parseJson,
  successEnvelope,
  toErrorEnvelope,
  methodNotAllowed,
  errorEnvelope,
} from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import { validateConfirmDraftInput } from '../../../src/contracts/contracts.js';
import { confirm_draft_to_emission_activity } from '../../../src/services/confirm-draft.js';
import { enforce_subscription_readonly } from '../../../src/services/enforce-subscription-readonly.js';
import { calculate_emission_activity } from '../../../src/services/calculate-emission-activity.js';
import { AuthzError, requireOrganizationWriteAccess } from '../_shared/authz.ts';
import { externalActionsBlockedInCurrentEnv } from '../_shared/staging-guard.ts';
import { insertActionLog } from '../_shared/action-log.ts';
import {MANUAL_PROVIDER,canonicalManualTranscription,manualConfirmationIntent} from '../../../src/contracts/manual-transcription.js';
import {normalizeUnit} from '../../../src/services/unit-normalization.js';
import {isProtectedManualDraft} from '../../../src/services/manual-source-guard.js';
import {draftConfirmationSourceSnapshot} from '../../../src/services/draft-confirmation-source.js';

function buildActivityCode(index: number): string {
  return `STG-EA-${String(index).padStart(6, '0')}`;
}

serveWithCors(async (request: Request) => {
  if (request.method !== 'POST') {
    return methodNotAllowed(request);
  }

  try {
    const input = validateConfirmDraftInput(await parseJson(request));
    const supabase = createServiceRoleClient();
    const actor = await requireOrganizationWriteAccess(request, supabase, input.organization_id);

    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', input.organization_id)
      .order('period_end', { ascending: false });

    if (subError) throw subError;

    const enforcement = enforce_subscription_readonly({
      organization_id: input.organization_id,
      subscriptions: subscriptions || [],
    });

    if (!enforcement.can_write_formal_data) {
      return errorEnvelope(request, {
        code: 'SUBSCRIPTION_READONLY',
        message: 'Subscription does not allow formal data writes',
        reason: enforcement.reason,
      }, {
        status: 'readonly',
        reason: enforcement.reason,
        requestId: input.request_id,
        httpStatus: 403,
      });
    }

    const { data: draft, error: draftError } = await supabase
      .from('extracted_document_drafts')
      .select('*')
      .eq('id', input.draft_id)
      .eq('organization_id', input.organization_id)
      .eq('project_id', input.project_id)
      .single();

    if (draftError) {
      return toErrorEnvelope(request, draftError, {
        code: 'DRAFT_NOT_FOUND',
        httpStatus: 404,
        requestId: input.request_id,
      });
    }
    // Capture exactly the initial row used below, before lookup or factor-read await points.
    const initialDraftSource=draftConfirmationSourceSnapshot(draft);

    async function savedConfirmation(row:{draft_id:string;draft_status:string;emission_activity_id:string|null;calculation_result_id:string|null},manual:boolean){
      const failureCode=manual?'MANUAL_CONFIRMATION_READBACK_FAILED':'DRAFT_CONFIRMATION_READBACK_FAILED';
      if(!row||row.draft_id!==input.draft_id||row.draft_status!==input.decision)return toErrorEnvelope(request,new Error('Saved confirmation identity/decision is not verified'),{code:failureCode,httpStatus:409,requestId:input.request_id});
      // Replay reads the immutable confirmation's calculation ID, not a newly
      // calculated result or the project's current latest version.
      let persistedCalculation=null;
      if(row.calculation_result_id){
        const saved=await supabase.from('calculation_results')
          .select('id,organization_id,project_id,emission_activity_id,status,error_code,co2e_kg,warnings')
          .eq('id',row.calculation_result_id).eq('organization_id',input.organization_id)
          .eq('project_id',input.project_id).eq('emission_activity_id',row.emission_activity_id).maybeSingle();
        const candidate=saved.data,sameId=(left:unknown,right:unknown)=>typeof left==='string'&&typeof right==='string'&&left.toLowerCase()===right.toLowerCase();
        const validAmount=candidate?.co2e_kg===null||typeof candidate?.co2e_kg==='number'&&Number.isFinite(candidate.co2e_kg)&&candidate.co2e_kg>=0;
        if(saved.error||!candidate||!sameId(candidate.id,row.calculation_result_id)||!sameId(candidate.organization_id,input.organization_id)||!sameId(candidate.project_id,input.project_id)||!sameId(candidate.emission_activity_id,row.emission_activity_id)||!['calculated','pending_factor','error','superseded'].includes(candidate.status)||!Array.isArray(candidate.warnings)||!(candidate.error_code===null||typeof candidate.error_code==='string')||!validAmount||candidate.status==='calculated'&&candidate.co2e_kg===null||['pending_factor','error'].includes(candidate.status)&&candidate.co2e_kg!==null){
          return toErrorEnvelope(request,new Error('Saved calculation could not be verified'),{code:failureCode,httpStatus:409,requestId:input.request_id});
        }
        persistedCalculation=candidate;
      }else if(row.draft_status!=='rejected'||row.emission_activity_id!==null){
        return toErrorEnvelope(request,new Error('Confirmation has no saved calculation reference'),{code:failureCode,httpStatus:409,requestId:input.request_id});
      }
      return successEnvelope(request,{...row,calculation_status:persistedCalculation?.status??null,error_code:persistedCalculation?.error_code??null,co2e_kg:persistedCalculation?.co2e_kg??null,calculation_warnings:persistedCalculation?.warnings??null},{status:row.draft_status,warnings:persistedCalculation?.warnings||[],requestId:input.request_id});
    }

    if(isProtectedManualDraft(draft)){
      // Broad MANUAL detection is shared with SQL. Only canonical MANUAL data can enter v2;
      // historical aliases/malformed provenance never fall through to the old confirmation path.
      if(draft.extraction_provider!==MANUAL_PROVIDER)return errorEnvelope(request,{code:'MANUAL_CONFIRMATION_REQUIRES_PROVENANCE',message:'Historical MANUAL source requires review; it is not automatically promoted to canonical manual transcription'},{httpStatus:409,requestId:input.request_id});
      const transcription=canonicalManualTranscription(draft.normalized_payload),intent=manualConfirmationIntent(input,transcription);
      if(!draft.raw_payload?.manual_transcription?.confirmation&&(draft.is_latest!==true||!['pending_review','needs_clarification'].includes(draft.status)))return errorEnvelope(request,{code:'MANUAL_CONFIRMATION_NOT_PENDING',message:'Manual draft is not latest and pending; no calculation was run'},{httpStatus:409,requestId:input.request_id});
      const normalized=normalizeUnit(transcription.quantity,transcription.unit);
      let calculation=null;
      if(intent.decision==='confirmed'&&!draft.raw_payload?.manual_transcription?.confirmation){
        const factors=await supabase.from('emission_factors').select('*').eq('status','active').or(`organization_id.eq.${input.organization_id},organization_id.is.null`);
        if(factors.error)throw factors.error;
        calculation=calculate_emission_activity({activity:{...transcription,organization_id:input.organization_id,project_id:input.project_id},factors:factors.data||[]});
      }
      const result=await supabase.rpc('confirm_manual_draft_atomic_v2',{p_organization_id:input.organization_id,p_project_id:input.project_id,p_draft_id:input.draft_id,p_actor_user_id:actor.user_id,p_intent:intent,p_calculation_result:calculation,p_normalized_quantity:normalized.normalized_quantity,p_normalized_unit:normalized.normalized_unit});
      if(result.error)return toErrorEnvelope(request,new Error(result.error.message),{code:'MANUAL_CONFIRMATION_NOT_SAVED',httpStatus:result.error.code==='42501'?403:409,requestId:input.request_id});
      return savedConfirmation(Array.isArray(result.data)?result.data[0]:result.data,true);
    }

    if(typeof input.request_id!=='string'||!input.request_id.trim()||input.request_id.length>200)return errorEnvelope(request,{code:'DRAFT_CONFIRMATION_REQUEST_REQUIRED',message:'A stable request_id is required; missing identities are not generated on retry'},{httpStatus:400});
    const requestArgs={p_organization_id:input.organization_id,p_project_id:input.project_id,p_draft_id:input.draft_id,p_actor_user_id:actor.user_id,p_request_id:input.request_id,p_intent:{decision:input.decision,overrides:input.overrides||{}}};
    const prior=await supabase.rpc('draft_confirmation_request',requestArgs);
    if(prior.error)return toErrorEnvelope(request,new Error(prior.error.message),{code:prior.error.message?.match(/(?:DRAFT_CONFIRMATION|MANUAL)_[A-Z_]+/)?.[0]||'DRAFT_CONFIRMATION_LOOKUP_FAILED',httpStatus:prior.error.code==='42501'?403:409,requestId:input.request_id});
    const previous=(Array.isArray(prior.data)?prior.data[0]:prior.data)?.result;
    if(previous?.operation_status==='completed')return savedConfirmation(previous,false);
    if(previous?.operation_status!=='not_found')return toErrorEnvelope(request,new Error('Confirmation lookup was not verified'),{code:'DRAFT_CONFIRMATION_LOOKUP_FAILED',httpStatus:409,requestId:input.request_id});

    if(draft.is_latest!==true||!['pending_review','needs_clarification'].includes(draft.status))return errorEnvelope(request,{code:'DRAFT_CONFIRMATION_NOT_PENDING',message:'Draft is not latest and pending; no provider or calculation was run'},{httpStatus:409,requestId:input.request_id});
    let offset=0,total:number|undefined;const seen=new Set<string>();
    while(true){
      const history=await supabase.from('extracted_document_drafts').select('id,extraction_provider,raw_payload',{count:'exact'}).eq('organization_id',input.organization_id).eq('project_id',input.project_id).eq('uploaded_document_id',draft.uploaded_document_id).order('id').range(offset,offset+199);
      if(history.error)throw history.error;
      if(!Array.isArray(history.data)||!Number.isSafeInteger(history.count)||history.count===null||history.count<0||total!==undefined&&total!==history.count)throw new Error('MANUAL_HISTORY_READ_INCOMPLETE');
      total=history.count;
      for(const item of history.data){if(seen.has(item.id))throw new Error('MANUAL_HISTORY_READ_INCOMPLETE');seen.add(item.id);if(isProtectedManualDraft(item))return errorEnvelope(request,{code:'MANUAL_SOURCE_RETAINED',message:'This document has MANUAL history; a non-MANUAL branch cannot create another activity'},{httpStatus:409,requestId:input.request_id});}
      if(seen.size===total)break;if(!history.data.length||seen.size>total)throw new Error('MANUAL_HISTORY_READ_INCOMPLETE');offset+=history.data.length;
    }

    const { count, error: countError } = await supabase
      .from('emission_activities')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', input.project_id).eq('organization_id',input.organization_id);

    if (countError) throw countError;
    if(!Number.isSafeInteger(count)||count===null||count<0)throw new Error('ACTIVITY_COUNT_UNCONFIRMED');

    const transformed = confirm_draft_to_emission_activity({
      draft,
      decision: input.decision,
      overrides: input.overrides,
      next_activity_code: buildActivityCode((count || 0) + 1),
    });

    let calculationResult: Record<string, unknown> | null = null;

    if (input.decision === 'confirmed' && transformed.emission_activity) {
      const { data: factors, error: factorsError } = await supabase
        .from('emission_factors')
        .select('*')
        .eq('status', 'active')
        .or(`organization_id.eq.${input.organization_id},organization_id.is.null`);

      if (factorsError) throw factorsError;

      calculationResult = calculate_emission_activity({
        activity: transformed.emission_activity,
        factors: factors || [],
      });

    }

    const { data: rpcRows, error: rpcError } = await supabase.rpc('commit_draft_confirmation', {
      ...requestArgs,
      p_emission_activity: transformed.emission_activity,
      p_calculation_result: calculationResult,
      p_expected_source:initialDraftSource,
    });

    if (rpcError) {
      return toErrorEnvelope(request, rpcError, {
        code: rpcError.message?.match(/(?:DRAFT_CONFIRMATION|MANUAL)_[A-Z_]+/)?.[0]||'CONFIRM_DRAFT_ATOMIC_FAILED',
        httpStatus: rpcError.code==='42501'?403:409,
        requestId: input.request_id,
      });
    }

    const rpcResult = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows)?.result;
    if(rpcResult?.operation_status!=='completed')throw new Error('DRAFT_CONFIRMATION_NOT_CONFIRMED');
    const externalBlocked = externalActionsBlockedInCurrentEnv();

    if(!rpcResult.replayed)await insertActionLog(supabase, {
      user_id: actor.user_id,
      organization_id: input.organization_id,
      project_id: input.project_id,
      action: 'confirm-draft',
      table_name: 'extracted_document_drafts',
      record_id: String(rpcResult.draft_id),
      metadata: {
        request_id: input.request_id || null,
        decision: input.decision,
        emission_activity_id: rpcResult.emission_activity_id,
        calculation_result_id: rpcResult.calculation_result_id,
        external_actions_blocked: externalBlocked,
      },
    }).catch((logError) => {
      console.error('confirm-draft action log failed', logError);
    });

    return savedConfirmation(rpcResult,false);
  } catch (error) {
    if (error instanceof AuthzError) {
      return toErrorEnvelope(request, error, {
        code: error.code,
        httpStatus: error.httpStatus,
      });
    }

    return toErrorEnvelope(request, error, {
      code: 'CONFIRM_DRAFT_FAILED',
      httpStatus: 400,
    });
  }
}, { allowedMethods: ['POST'] });
