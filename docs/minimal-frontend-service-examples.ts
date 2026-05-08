// Minimal frontend-side service examples for calling CaCalLab V1 edge functions.

import type {
  ApiEnvelope,
  ProcessDocumentRequest,
  ProcessDocumentResponse,
  ConfirmDraftRequest,
  ConfirmDraftResponse,
  GenerateReportRequest,
  GenerateReportResponse,
  EmissionsAnalyticsRequest,
  EmissionsAnalyticsResponse,
  AdjustmentRuleResultRequest,
  AdjustmentRuleResultResponse,
} from '../src/contracts/frontend-examples';

const EDGE_BASE_URL = 'https://<your-project-ref>.supabase.co/functions/v1';

async function callEdge<TReq, TRes>(path: string, payload: TReq, accessToken: string): Promise<ApiEnvelope<TRes>> {
  const response = await fetch(`${EDGE_BASE_URL}/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      'x-request-id': crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });

  const envelope = (await response.json()) as ApiEnvelope<TRes>;

  if (!envelope.success) {
    throw new Error(`${envelope.error?.code || 'UNKNOWN'}: ${envelope.error?.message || 'unknown'}`);
  }

  return envelope;
}

async function callEdgeGet<TRes>(path: string, params: URLSearchParams, accessToken: string): Promise<ApiEnvelope<TRes>> {
  const response = await fetch(`${EDGE_BASE_URL}/${path}?${params.toString()}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'x-request-id': crypto.randomUUID(),
    },
  });

  const envelope = (await response.json()) as ApiEnvelope<TRes>;
  if (!envelope.success) {
    throw new Error(`${envelope.error?.code || 'UNKNOWN'}: ${envelope.error?.message || 'unknown'}`);
  }
  return envelope;
}

export function processDocument(payload: ProcessDocumentRequest, accessToken: string) {
  return callEdge<ProcessDocumentRequest, ProcessDocumentResponse>('process-document', payload, accessToken);
}

export function confirmDraft(payload: ConfirmDraftRequest, accessToken: string) {
  return callEdge<ConfirmDraftRequest, ConfirmDraftResponse>('confirm-draft', payload, accessToken);
}

export function generateReport(payload: GenerateReportRequest, accessToken: string) {
  return callEdge<GenerateReportRequest, GenerateReportResponse>('generate-report', payload, accessToken);
}

export function getEmissionsAnalytics(params: EmissionsAnalyticsRequest, accessToken: string) {
  const query = new URLSearchParams({
    organization_id: params.organization_id,
    dimension: params.dimension,
  });

  if (params.project_id) query.set('project_id', params.project_id);
  if (params.request_id) query.set('request_id', params.request_id);

  return callEdgeGet<EmissionsAnalyticsResponse>('analytics-emissions', query, accessToken);
}

export function getAdjustmentRuleResult(params: AdjustmentRuleResultRequest, accessToken: string) {
  const query = new URLSearchParams({
    organization_id: params.organization_id,
    adjustment_item_id: params.adjustment_item_id,
    claim_purpose: params.claim_purpose,
    requested_quantity_tco2e: String(params.requested_quantity_tco2e),
  });

  if (params.project_id) query.set('project_id', params.project_id);
  if (params.report_generation_id) query.set('report_generation_id', params.report_generation_id);
  if (params.request_id) query.set('request_id', params.request_id);

  return callEdgeGet<AdjustmentRuleResultResponse>('adjustment-rule-result', query, accessToken);
}
