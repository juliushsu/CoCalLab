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

function buildActivityCode(index: number): string {
  return `STG-EA-${String(index).padStart(6, '0')}`;
}

Deno.serve(async (request: Request) => {
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
});
