import {
  parseJson,
  successEnvelope,
  toErrorEnvelope,
  methodNotAllowed,
  errorEnvelope,
} from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import { validateRunAiAuditInput } from '../../../src/contracts/contracts.js';
import { getLlmProvider } from '../../../src/providers/index.js';
import { enforce_subscription_readonly } from '../../../src/services/enforce-subscription-readonly.js';
import { AuthzError, requireOrganizationWriteAccess } from '../_shared/authz.ts';
import {
  externalActionsBlockedInCurrentEnv,
  externalGuardWarning,
} from '../_shared/staging-guard.ts';
import { insertActionLog } from '../_shared/action-log.ts';

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return methodNotAllowed(request);
  }

  try {
    const input = validateRunAiAuditInput(await parseJson(request));
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

    if (!enforcement.can_generate_report) {
      return errorEnvelope(request, {
        code: 'SUBSCRIPTION_REPORT_BLOCKED',
        message: 'Subscription does not allow AI audit writes',
        reason: enforcement.reason,
      }, {
        status: 'readonly',
        reason: enforcement.reason,
        requestId: input.request_id,
        httpStatus: 403,
      });
    }

    const { data: report, error: reportError } = await supabase
      .from('report_generations')
      .select('id, payload')
      .eq('id', input.report_generation_id)
      .eq('organization_id', input.organization_id)
      .eq('project_id', input.project_id)
      .single();

    if (reportError) {
      return toErrorEnvelope(request, reportError, {
        code: 'REPORT_NOT_FOUND',
        httpStatus: 404,
        requestId: input.request_id,
      });
    }

    const externalBlocked = externalActionsBlockedInCurrentEnv();
    const requestedProvider = input.model_hint || Deno.env.get('LLM_PROVIDER') || 'mock';
    const providerHint = externalBlocked ? 'mock' : requestedProvider;
    const warnings: unknown[] = [];
    if (externalBlocked && requestedProvider.toLowerCase() !== 'mock') {
      const warning = externalGuardWarning();
      if (warning) warnings.push(warning);
    }

    const provider = getLlmProvider(providerHint);
    const llmResult = await provider.auditReport({
      report_payload: report.payload,
      context: {
        organization_id: input.organization_id,
        project_id: input.project_id,
        report_generation_id: report.id,
      },
    });

    const audit = llmResult.audit;

    const { data: rpcRows, error: rpcError } = await supabase.rpc('run_ai_audit_atomic', {
      p_organization_id: input.organization_id,
      p_project_id: input.project_id,
      p_report_generation_id: report.id,
      p_run_by_user_id: actor.user_id,
      p_model_provider: audit.model_provider,
      p_model_name: audit.model_name,
      p_model_version: audit.model_version,
      p_input_snapshot: report.payload,
      p_completeness_flags: audit.completeness_flags,
      p_anomaly_flags: audit.anomaly_flags,
      p_exclusion_review_flags: audit.exclusion_review_flags,
      p_hotspot_ranking: audit.hotspot_ranking,
      p_summary_text: audit.summary_text,
      p_recommended_actions: audit.recommended_actions,
      p_token_usage: audit.token_usage,
      p_confidence_score: audit.confidence_score,
      p_request_id: input.request_id || null,
    });

    if (rpcError) {
      return toErrorEnvelope(request, rpcError, {
        code: 'RUN_AI_AUDIT_ATOMIC_FAILED',
        httpStatus: 409,
        requestId: input.request_id,
      });
    }

    const rpcResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;

    await insertActionLog(supabase, {
      user_id: actor.user_id,
      organization_id: input.organization_id,
      project_id: input.project_id,
      action: 'run-ai-audit',
      table_name: 'ai_audit_results',
      record_id: String(rpcResult.ai_audit_result_id),
      metadata: {
        request_id: input.request_id || null,
        report_generation_id: report.id,
        provider: {
          name: llmResult.provider,
          model: llmResult.model,
        },
        external_actions_blocked: externalBlocked,
      },
    }).catch((logError) => {
      console.error('run-ai-audit action log failed', logError);
    });

    return successEnvelope(request, {
      ai_audit_result_id: rpcResult.ai_audit_result_id,
      status: rpcResult.status,
      summary_text: audit.summary_text,
      recommended_actions: audit.recommended_actions,
      provider: {
        name: llmResult.provider,
        model: llmResult.model,
      },
    }, {
      status: rpcResult.status,
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
      code: 'RUN_AI_AUDIT_FAILED',
      httpStatus: 400,
    });
  }
});
