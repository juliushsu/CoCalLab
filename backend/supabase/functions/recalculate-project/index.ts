import {
  parseJson,
  successEnvelope,
  toErrorEnvelope,
  methodNotAllowed,
  errorEnvelope,
} from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import { validateRecalculateProjectInput } from '../../../src/contracts/contracts.js';
import { recalculate_project } from '../../../src/services/recalculate-project.js';
import { enforce_subscription_readonly } from '../../../src/services/enforce-subscription-readonly.js';
import { AuthzError, requireOrganizationWriteAccess } from '../_shared/authz.ts';
import { externalActionsBlockedInCurrentEnv } from '../_shared/staging-guard.ts';
import { insertActionLog } from '../_shared/action-log.ts';

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return methodNotAllowed(request);
  }

  try {
    const input = validateRecalculateProjectInput(await parseJson(request));
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
        message: 'Subscription does not allow recalculation writes',
        reason: enforcement.reason,
      }, {
        status: 'readonly',
        reason: enforcement.reason,
        requestId: input.request_id,
        httpStatus: 403,
      });
    }

    const { data: activities, error: activitiesError } = await supabase
      .from('emission_activities')
      .select('*')
      .eq('organization_id', input.organization_id)
      .eq('project_id', input.project_id)
      .eq('status', 'active');
    if (activitiesError) throw activitiesError;

    const { data: factors, error: factorsError } = await supabase
      .from('emission_factors')
      .select('*')
      .eq('status', 'active')
      .or(`organization_id.eq.${input.organization_id},organization_id.is.null`);
    if (factorsError) throw factorsError;

    const { data: previousResults, error: previousError } = await supabase
      .from('calculation_results')
      .select('*')
      .eq('organization_id', input.organization_id)
      .eq('project_id', input.project_id);
    if (previousError) throw previousError;

    const summary = recalculate_project({
      organization_id: input.organization_id,
      project_id: input.project_id,
      activities: activities || [],
      factors: factors || [],
      previous_calculation_results: previousResults || [],
    });

    const { data: rpcRows, error: rpcError } = await supabase.rpc('recalculate_project_atomic', {
      p_organization_id: input.organization_id,
      p_project_id: input.project_id,
      p_actor_user_id: actor.user_id,
      p_calculation_results: summary.calculation_results,
      p_request_id: input.request_id || null,
    });

    if (rpcError) {
      return toErrorEnvelope(request, rpcError, {
        code: 'RECALCULATE_PROJECT_ATOMIC_FAILED',
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
      action: 'recalculate-project',
      table_name: 'calculation_results',
      record_id: String(input.project_id),
      metadata: {
        request_id: input.request_id || null,
        processed_activities: rpcResult.processed_activities,
        calculated_count: rpcResult.calculated_count,
        pending_factor_count: rpcResult.pending_factor_count,
        excluded_count: rpcResult.excluded_count,
        error_count: rpcResult.error_count,
        external_actions_blocked: externalBlocked,
      },
    }).catch((logError) => {
      console.error('recalculate-project action log failed', logError);
    });

    return successEnvelope(request, {
      project_id: rpcResult.project_id,
      processed_activities: rpcResult.processed_activities,
      calculated_count: rpcResult.calculated_count,
      pending_factor_count: rpcResult.pending_factor_count,
      excluded_count: rpcResult.excluded_count,
      error_count: rpcResult.error_count,
    }, {
      status: 'completed',
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
      code: 'RECALCULATE_PROJECT_FAILED',
      httpStatus: 400,
    });
  }
});
