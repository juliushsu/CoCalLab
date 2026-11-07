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

    if(draft.extraction_provider===MANUAL_PROVIDER){
      const transcription=canonicalManualTranscription(draft.normalized_payload);
      const intent=manualConfirmationIntent(input,transcription);
      const normalized=normalizeUnit(transcription.quantity,transcription.unit);
      let calculation=null;
      if(intent.decision==='confirmed'&&!draft.raw_payload?.manual_transcription?.confirmation){
        const factors=await supabase.from('emission_factors').select('*').eq('status','active').or(`organization_id.eq.${input.organization_id},organization_id.is.null`);
        if(factors.error)throw factors.error;
        calculation=calculate_emission_activity({activity:{...transcription,organization_id:input.organization_id,project_id:input.project_id},factors:factors.data||[]});
      }
      const result=await supabase.rpc('confirm_manual_draft_atomic_v2',{p_organization_id:input.organization_id,p_project_id:input.project_id,p_draft_id:input.draft_id,p_actor_user_id:actor.user_id,p_intent:intent,p_calculation_result:calculation,p_normalized_quantity:normalized.normalized_quantity,p_normalized_unit:normalized.normalized_unit});
      if(result.error)return toErrorEnvelope(request,new Error(result.error.message),{code:'MANUAL_CONFIRMATION_NOT_SAVED',httpStatus:result.error.code==='42501'?403:409,requestId:input.request_id});
      const row=Array.isArray(result.data)?result.data[0]:result.data;
      if(!row||row.draft_id!==input.draft_id)throw new Error('Manual confirmation was not read back');
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
          return toErrorEnvelope(request,new Error('Saved manual calculation could not be verified'),{code:'MANUAL_CONFIRMATION_READBACK_FAILED',httpStatus:409,requestId:input.request_id});
        }
        persistedCalculation=candidate;
      }else if(row.draft_status!=='rejected'||row.emission_activity_id!==null){
        return toErrorEnvelope(request,new Error('Manual confirmation has no saved calculation reference'),{code:'MANUAL_CONFIRMATION_READBACK_FAILED',httpStatus:409,requestId:input.request_id});
      }
      return successEnvelope(request,{...row,calculation_status:persistedCalculation?.status??null,error_code:persistedCalculation?.error_code??null,co2e_kg:persistedCalculation?.co2e_kg??null,calculation_warnings:persistedCalculation?.warnings??null},{status:row.draft_status,warnings:persistedCalculation?.warnings||[],requestId:input.request_id});
    }

    const { count, error: countError } = await supabase
      .from('emission_activities')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', input.project_id);

    if (countError) throw countError;

    const transformed = confirm_draft_to_emission_activity({
      draft,
      decision: input.decision,
      overrides: input.overrides,
      next_activity_code: buildActivityCode((count || 0) + 1),
    });

    let calculationResult: Record<string, unknown> | null = null;
    const warnings: unknown[] = [];

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

      if (Array.isArray(calculationResult.warnings)) {
        warnings.push(...calculationResult.warnings);
      }
    }

    const { data: rpcRows, error: rpcError } = await supabase.rpc('confirm_draft_atomic', {
      p_organization_id: input.organization_id,
      p_project_id: input.project_id,
      p_draft_id: input.draft_id,
      p_decision: input.decision,
      p_draft_status: transformed.draft_status,
      p_draft_review_note: input.overrides?.review_note || draft.review_note || null,
      p_draft_reviewed_at: new Date().toISOString(),
      p_emission_activity: transformed.emission_activity,
      p_calculation_result: calculationResult,
      p_actor_user_id: actor.user_id,
      p_request_id: input.request_id || null,
    });

    if (rpcError) {
      return toErrorEnvelope(request, rpcError, {
        code: 'CONFIRM_DRAFT_ATOMIC_FAILED',
        httpStatus: 409,
        requestId: input.request_id,
      });
    }

    const rpcResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    const externalBlocked = externalActionsBlockedInCurrentEnv();

    await insertActionLog(supabase, {
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

    return successEnvelope(request, {
      draft_id: rpcResult.draft_id,
      emission_activity_id: rpcResult.emission_activity_id,
      calculation_result_id: rpcResult.calculation_result_id,
      draft_status: rpcResult.draft_status,
      inclusion_status: rpcResult.inclusion_status,
    }, {
      status: rpcResult.draft_status,
      warnings,
      requestId: input.request_id,
    });
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
