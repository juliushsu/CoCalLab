import {
  parseJson,
  successEnvelope,
  toErrorEnvelope,
  methodNotAllowed,
  errorEnvelope,
} from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import { validateClassifyDocumentInput } from '../../../src/contracts/contracts.js';
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
    const input = validateClassifyDocumentInput(await parseJson(request));
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
        message: 'Subscription does not allow draft classification writes',
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
      .select('id, organization_id, project_id, normalized_payload')
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

    const normalizedPayload = input.normalized_payload || draft.normalized_payload;
    const externalBlocked = externalActionsBlockedInCurrentEnv();
    const requestedProvider = input.model_hint || Deno.env.get('LLM_PROVIDER') || 'mock';
    const providerHint = externalBlocked ? 'mock' : requestedProvider;
    const warnings: unknown[] = [];
    if (externalBlocked && requestedProvider.toLowerCase() !== 'mock') {
      const warning = externalGuardWarning();
      if (warning) warnings.push(warning);
    }

    const provider = getLlmProvider(providerHint);
    const llmResult = await provider.classifyDraft({
      normalized_payload: normalizedPayload,
      context: {
        organization_id: input.organization_id,
        project_id: input.project_id,
        draft_id: input.draft_id,
      },
    });

    const classification = llmResult.classification;

    const { data: rpcRows, error: rpcError } = await supabase.rpc('classify_document_atomic', {
      p_organization_id: input.organization_id,
      p_project_id: input.project_id,
      p_draft_id: input.draft_id,
      p_classification_status: classification.classification_status,
      p_suggested_category: classification.suggested_category,
      p_suggested_scope: classification.suggested_scope,
      p_confidence_score: classification.confidence_score,
      p_review_note: classification.review_note,
      p_provider: llmResult.provider,
      p_model: llmResult.model,
      p_request_id: input.request_id || null,
    });

    if (rpcError) {
      return toErrorEnvelope(request, rpcError, {
        code: 'CLASSIFY_DOCUMENT_ATOMIC_FAILED',
        httpStatus: 409,
        requestId: input.request_id,
      });
    }

    const rpcResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;

    await insertActionLog(supabase, {
      user_id: actor.user_id,
      organization_id: input.organization_id,
      project_id: input.project_id,
      action: 'classify-document',
      table_name: 'extracted_document_drafts',
      record_id: String(rpcResult.draft_id),
      metadata: {
        request_id: input.request_id || null,
        provider: {
          name: llmResult.provider,
          model: llmResult.model,
        },
        external_actions_blocked: externalBlocked,
      },
    }).catch((logError) => {
      console.error('classify-document action log failed', logError);
    });

    return successEnvelope(request, {
      draft_id: rpcResult.draft_id,
      classification_status: rpcResult.classification_status,
      suggested_category: rpcResult.suggested_category,
      suggested_scope: rpcResult.suggested_scope,
      confidence_score: rpcResult.confidence_score,
      review_note: rpcResult.review_note,
      provider: {
        name: llmResult.provider,
        model: llmResult.model,
      },
    }, {
      status: rpcResult.classification_status,
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
      code: 'CLASSIFY_DOCUMENT_FAILED',
      httpStatus: 400,
    });
  }
});
