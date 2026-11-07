import { serveWithCors } from '../_shared/cors.ts';
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
import {isProtectedManualDraft} from '../../../src/services/manual-source-guard.js';

serveWithCors(async (request: Request) => {
  if (request.method !== 'POST') {
    return methodNotAllowed(request);
  }

  let leaseClient;
  let leaseActorId: string | undefined;
  let leaseId: string | undefined;
  let processingFinished=false;
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

    // Read every historical draft before any provider work. SQL repeats the fence at commit.
    let offset=0,total: number | undefined;
    const seen=new Set<string>();
    while(true){
      const history=await supabase.from('extracted_document_drafts').select('id,extraction_provider,raw_payload',{count:'exact'}).eq('organization_id',input.organization_id).eq('project_id',input.project_id).eq('uploaded_document_id',input.uploaded_document_id).order('id').range(offset,offset+199);
      if(history.error)throw history.error;
      if(!Array.isArray(history.data)||!Number.isSafeInteger(history.count)||history.count===null||history.count<0||total!==undefined&&total!==history.count)throw new Error('MANUAL_HISTORY_READ_INCOMPLETE');
      total=history.count;
      for(const row of history.data){if(seen.has(row.id))throw new Error('MANUAL_HISTORY_READ_INCOMPLETE');seen.add(row.id);if(isProtectedManualDraft(row))return errorEnvelope(request,{code:'MANUAL_SOURCE_RETAINED',message:'This document has retained manual transcription history; provider processing is not permitted'},{httpStatus:409,requestId:input.request_id});}
      if(seen.size===total)break;
      if(!history.data.length||seen.size>total)throw new Error('MANUAL_HISTORY_READ_INCOMPLETE');
      offset+=history.data.length;
    }

    // A durable lease precedes provider/read work. It is not OCR enablement or
    // a timeout-based claim that an interrupted provider has stopped.
    leaseClient=supabase;leaseActorId=actor.user_id;leaseId=crypto.randomUUID();
    const begun=await supabase.rpc('begin_document_processing',{
      p_actor_user_id:actor.user_id,p_organization_id:input.organization_id,
      p_project_id:input.project_id,p_document_id:input.uploaded_document_id,
      p_lease_id:leaseId,p_request_id:input.request_id||null,
    });
    if(begun.error)return toErrorEnvelope(request,new Error(begun.error.message),{
      code:'DOCUMENT_PROCESSING_NOT_STARTED',httpStatus:begun.error.code==='42501'?403:409,requestId:input.request_id,
    });
    if(!Array.isArray(begun.data)||begun.data.length!==1||begun.data[0]?.lease_id!==leaseId)throw new Error('Processing lease was not confirmed; provider not called');

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

    const { data: rpcRows, error: rpcError } = await supabase.rpc('finish_document_processing', {
      p_actor_user_id:actor.user_id,p_lease_id:leaseId,
      p_payload:{raw_payload:ocrPayload,normalized_payload:normalized.normalized_payload,
        status:normalized.status,confidence_score:normalized.confidence_score,
        provider:providerName,model:providerModel},
    });

    if (rpcError) {
      return toErrorEnvelope(request, rpcError, {
        code: 'PROCESS_DOCUMENT_ATOMIC_FAILED',
        httpStatus: 409,
        requestId: input.request_id,
      });
    }
    const rpcResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if(!rpcResult||typeof rpcResult.draft_id!=='string')throw new Error('Processing draft save was not confirmed');
    const saved=await supabase.from('extracted_document_drafts').select('id,organization_id,project_id,uploaded_document_id')
      .eq('id',rpcResult.draft_id).eq('organization_id',input.organization_id).eq('project_id',input.project_id).eq('uploaded_document_id',input.uploaded_document_id).single();
    if(saved.error||!saved.data||saved.data.id!==rpcResult.draft_id)throw new Error('Processing draft was not read back');
    processingFinished=true;
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
  } finally {
    // Only this handler knows its provider work has ended. Failed release or a
    // process crash deliberately retains the lease for Owner investigation.
    if(leaseClient&&leaseId&&leaseActorId&&!processingFinished){
      try{
        const released=await leaseClient.rpc('release_document_processing',{p_actor_user_id:leaseActorId,p_lease_id:leaseId});
        if(released.error)console.error('process-document lease retained; Owner reconciliation required',released.error);
      }catch(error){console.error('process-document lease retained; Owner reconciliation required',error);}
    }
  }
}, { allowedMethods: ['POST'] });
