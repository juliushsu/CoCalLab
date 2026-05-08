import {
  parseJson,
  successEnvelope,
  toErrorEnvelope,
  methodNotAllowed,
  errorEnvelope,
} from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import { validateProcessDocumentInput } from '../../../src/contracts/contracts.js';
import { normalize_extracted_document_draft } from '../../../src/services/normalize-extracted-document-draft.js';
import { getOcrProvider } from '../../../src/providers/index.js';
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
    const input = validateProcessDocumentInput(await parseJson(request));
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
        message: 'Subscription does not allow document processing writes',
        reason: enforcement.reason,
      }, {
        status: 'readonly',
        reason: enforcement.reason,
        requestId: input.request_id,
        httpStatus: 403,
      });
    }

    let providerName = 'direct-input';
    let providerModel = 'none';
    let ocrPayload = input.ocr_payload || null;
    const providerWarnings: unknown[] = [];
    const externalBlocked = externalActionsBlockedInCurrentEnv();

    if (!ocrPayload) {
      const { data: doc, error: docError } = await supabase
        .from('uploaded_documents')
        .select('id, original_filename, mime_type, storage_path')
        .eq('id', input.uploaded_document_id)
        .eq('organization_id', input.organization_id)
        .eq('project_id', input.project_id)
        .single();

      if (docError) {
        return toErrorEnvelope(request, docError, {
          code: 'DOCUMENT_NOT_FOUND',
          httpStatus: 404,
          requestId: input.request_id,
        });
      }

      const requestedProvider = input.provider_hint || Deno.env.get('OCR_PROVIDER') || 'mock';
      const providerHint = externalBlocked ? 'mock' : requestedProvider;
      if (externalBlocked && requestedProvider.toLowerCase() !== 'mock') {
        const warning = externalGuardWarning();
        if (warning) providerWarnings.push(warning);
      }

      const provider = getOcrProvider(providerHint);
      const extracted = await provider.extractDocument({
        organization_id: input.organization_id,
        project_id: input.project_id,
        uploaded_document_id: input.uploaded_document_id,
        original_filename: doc.original_filename,
        mime_type: doc.mime_type,
        storage_path: doc.storage_path,
      });

      providerName = extracted.provider;
      providerModel = extracted.model;
      ocrPayload = extracted.raw_payload;
      providerWarnings.push(...extracted.warnings);
    }

    const normalized = normalize_extracted_document_draft({ ocr_payload: ocrPayload });

    const { data: rpcRows, error: rpcError } = await supabase.rpc('process_document_atomic', {
      p_organization_id: input.organization_id,
      p_project_id: input.project_id,
      p_uploaded_document_id: input.uploaded_document_id,
      p_raw_payload: ocrPayload,
      p_normalized_payload: normalized.normalized_payload,
      p_status: normalized.status,
      p_confidence_score: normalized.confidence_score,
      p_provider: providerName,
      p_model: providerModel,
      p_request_id: input.request_id || null,
    });

    if (rpcError) {
      return toErrorEnvelope(request, rpcError, {
        code: 'PROCESS_DOCUMENT_ATOMIC_FAILED',
        httpStatus: 409,
        requestId: input.request_id,
      });
    }

    const rpcResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    const warnings = [...providerWarnings, ...normalized.warnings];

    await insertActionLog(supabase, {
      user_id: actor.user_id,
      organization_id: input.organization_id,
      project_id: input.project_id,
      action: 'process-document',
      table_name: 'extracted_document_drafts',
      record_id: String(rpcResult.draft_id),
      metadata: {
        request_id: input.request_id || null,
        provider: {
          name: providerName,
          model: providerModel,
        },
        external_actions_blocked: externalBlocked,
      },
    }).catch((logError) => {
      console.error('process-document action log failed', logError);
    });

    return successEnvelope(request, {
      draft_id: rpcResult.draft_id,
      status: rpcResult.status,
      normalized_payload: rpcResult.normalized_payload,
      warnings,
      provider: {
        name: providerName,
        model: providerModel,
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
      code: 'PROCESS_DOCUMENT_FAILED',
      httpStatus: 400,
    });
  }
});
