// Frontend-importable typed examples for CaCalLab V1 edge contracts.

export type LocalizedMessage = {
  zh_tw: string;
  en: string;
  ja: string;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
    reason?: LocalizedMessage | null;
  } | null;
  meta: {
    request_id: string;
    timestamp: string;
    status: string;
    reason: LocalizedMessage | null;
    warnings: unknown[];
  };
};

export type ProcessDocumentRequest = {
  organization_id: string;
  project_id: string;
  uploaded_document_id: string;
  ocr_payload?: Record<string, unknown>;
  provider_hint?: string;
  request_id?: string;
};

export type ProcessDocumentResponse = {
  draft_id: string;
  status: string;
  normalized_payload: Record<string, unknown>;
  warnings: unknown[];
  provider: {
    name: string;
    model: string;
  };
};

export const PROCESS_DOCUMENT_REQUEST_EXAMPLE: ProcessDocumentRequest = {
  organization_id: 'a1111111-1111-4111-8111-111111111111',
  project_id: 'a3333333-1111-4111-8111-111111111111',
  uploaded_document_id: 'a4444444-1111-4111-8111-111111111111',
  provider_hint: 'mock',
  request_id: 'req-process-001',
};

export const PROCESS_DOCUMENT_SUCCESS_EXAMPLE: ApiEnvelope<ProcessDocumentResponse> = {
  success: true,
  data: {
    draft_id: 'a5555555-1111-4111-8111-111111111111',
    status: 'pending_review',
    normalized_payload: {
      vendor: 'Taiwan Power',
      normalized_quantity: 1200,
      normalized_unit: 'kWh',
    },
    warnings: [],
    provider: {
      name: 'mock-ocr',
      model: 'mock-ocr-v1',
    },
  },
  error: null,
  meta: {
    request_id: 'req-process-001',
    timestamp: '2026-03-16T12:00:00.000Z',
    status: 'pending_review',
    reason: null,
    warnings: [],
  },
};

export type ConfirmDraftRequest = {
  organization_id: string;
  project_id: string;
  draft_id: string;
  decision: 'confirmed' | 'rejected';
  overrides?: Record<string, unknown>;
  request_id?: string;
};

export type ConfirmDraftResponse = {
  draft_id: string;
  emission_activity_id: string | null;
  calculation_result_id: string | null;
  draft_status: string;
  inclusion_status: 'included' | 'excluded' | 'pending';
};

export const CONFIRM_DRAFT_REQUEST_EXAMPLE: ConfirmDraftRequest = {
  organization_id: 'a1111111-1111-4111-8111-111111111111',
  project_id: 'a3333333-1111-4111-8111-111111111111',
  draft_id: 'a5555555-1111-4111-8111-111111111111',
  decision: 'confirmed',
  overrides: {
    final_scope: 2,
    review_note: 'Reviewed by operator',
  },
  request_id: 'req-confirm-001',
};

export const CONFIRM_DRAFT_SUCCESS_EXAMPLE: ApiEnvelope<ConfirmDraftResponse> = {
  success: true,
  data: {
    draft_id: 'a5555555-1111-4111-8111-111111111111',
    emission_activity_id: 'a7777777-1111-4111-8111-111111111111',
    calculation_result_id: 'a8888888-1111-4111-8111-111111111111',
    draft_status: 'confirmed',
    inclusion_status: 'included',
  },
  error: null,
  meta: {
    request_id: 'req-confirm-001',
    timestamp: '2026-03-16T12:01:00.000Z',
    status: 'confirmed',
    reason: null,
    warnings: [],
  },
};

export type GenerateReportRequest = {
  organization_id: string;
  project_id: string;
  report_version: number;
  claim_purpose?: 'taiwan_carbon_fee' | 'voluntary_claim' | 'ifrs_s2_note' | 'esg_note' | 'internal_management';
  request_id?: string;
};

export type GenerateReportResponse = {
  report_generation_id: string;
  status: string;
  claim_purpose: 'taiwan_carbon_fee' | 'voluntary_claim' | 'ifrs_s2_note' | 'esg_note' | 'internal_management';
  gross_emissions_snapshot: Record<string, unknown>;
  adjustment_summary: Record<string, unknown>;
  claim_results: Record<string, unknown>;
  adjustment_manifest: Record<string, unknown>[];
  payload: Record<string, unknown>;
  warning_count: number;
};

export const GENERATE_REPORT_REQUEST_EXAMPLE: GenerateReportRequest = {
  organization_id: 'a1111111-1111-4111-8111-111111111111',
  project_id: 'a3333333-1111-4111-8111-111111111111',
  report_version: 1,
  claim_purpose: 'internal_management',
  request_id: 'req-report-001',
};

export const GENERATE_REPORT_SUCCESS_EXAMPLE: ApiEnvelope<GenerateReportResponse> = {
  success: true,
  data: {
    report_generation_id: 'a9000000-1111-4111-8111-111111111111',
    status: 'completed',
    claim_purpose: 'internal_management',
    gross_emissions_snapshot: {
      gross_total_co2e_kg: 610.8,
      scope_totals: { scope_1: 0, scope_2: 610.8, scope_3: 0 },
      category_totals: { energy: 610.8 },
    },
    adjustment_summary: {
      claim_purpose: 'internal_management',
      application_count: 1,
      requested_total_tco2e: 10,
      eligible_total_tco2e: 8,
      disallowed_total_tco2e: 2,
    },
    claim_results: {
      claim_purpose: 'internal_management',
      inventory_impact_mode: 'market_based_adjustment',
      gross_co2e_kg: 610.8,
      eligible_deduction_tco2e: 8,
      eligible_deduction_kg: 8000,
      claim_net_co2e_kg: 0,
    },
    adjustment_manifest: [
      {
        adjustment_application_id: 'b1333333-1111-4111-8111-111111111111',
        adjustment_item_id: 'b1111111-1111-4111-8111-111111111111',
        claim_purpose: 'internal_management',
        status: 'applied',
      },
    ],
    payload: {
      project_metadata: {
        project_id: 'a3333333-1111-4111-8111-111111111111',
      },
      boundary_summary: {
        included_count: 1,
        pending_count: 1,
      },
    },
    warning_count: 1,
  },
  error: null,
  meta: {
    request_id: 'req-report-001',
    timestamp: '2026-03-16T12:02:00.000Z',
    status: 'completed',
    reason: null,
    warnings: [
      {
        zh_tw: '報告含有 pending 項目，請先補齊資料',
        en: 'Report includes pending items; complete data before final use',
        ja: 'レポートに pending 項目があります。正式利用前にデータを補完してください',
      },
    ],
  },
};

export type AnalyticsDimension = 'ghg_scope' | 'iso_category';

export type EmissionsAnalyticsRequest = {
  organization_id: string;
  project_id?: string;
  dimension: AnalyticsDimension;
  request_id?: string;
};

export type EmissionsAnalyticsRow = {
  classification_system_code: AnalyticsDimension;
  classification_code: string;
  total_co2e_kg: number;
  activity_count: number;
};

export type EmissionsAnalyticsResponse = {
  organization_id: string;
  project_id?: string;
  dimension: AnalyticsDimension;
  rows: EmissionsAnalyticsRow[];
  total_co2e_kg: number;
};

export const EMISSIONS_ANALYTICS_SUCCESS_EXAMPLE: ApiEnvelope<EmissionsAnalyticsResponse> = {
  success: true,
  data: {
    organization_id: 'a1111111-1111-4111-8111-111111111111',
    project_id: 'a3333333-1111-4111-8111-111111111111',
    dimension: 'iso_category',
    rows: [
      { classification_system_code: 'iso_category', classification_code: 'category_1', total_co2e_kg: 0, activity_count: 0 },
      { classification_system_code: 'iso_category', classification_code: 'category_2', total_co2e_kg: 610.8, activity_count: 1 },
      { classification_system_code: 'iso_category', classification_code: 'category_3', total_co2e_kg: 0, activity_count: 0 },
      { classification_system_code: 'iso_category', classification_code: 'category_4', total_co2e_kg: 0, activity_count: 0 },
      { classification_system_code: 'iso_category', classification_code: 'category_5', total_co2e_kg: 0, activity_count: 0 },
      { classification_system_code: 'iso_category', classification_code: 'category_6', total_co2e_kg: 0, activity_count: 0 },
    ],
    total_co2e_kg: 610.8,
  },
  error: null,
  meta: {
    request_id: 'req-analytics-001',
    timestamp: '2026-04-07T12:00:00.000Z',
    status: 'completed',
    reason: null,
    warnings: [],
  },
};

export type AdjustmentRuleResultRequest = {
  organization_id: string;
  adjustment_item_id: string;
  claim_purpose: 'taiwan_carbon_fee' | 'voluntary_claim' | 'ifrs_s2_note' | 'esg_note' | 'internal_management';
  requested_quantity_tco2e: number;
  project_id?: string;
  report_generation_id?: string;
  request_id?: string;
};

export type AdjustmentRuleResultResponse = {
  organization_id: string;
  project_id?: string;
  adjustment_item_id: string;
  report_generation_id?: string;
  claim_purpose: 'taiwan_carbon_fee' | 'voluntary_claim' | 'ifrs_s2_note' | 'esg_note' | 'internal_management';
  requested: number;
  eligible: number;
  disallowed: number;
  disallow_reasons: string[];
  inventory_impact_mode: string;
};

export const ADJUSTMENT_RULE_RESULT_SUCCESS_EXAMPLE: ApiEnvelope<AdjustmentRuleResultResponse> = {
  success: true,
  data: {
    organization_id: 'a1111111-1111-4111-8111-111111111111',
    project_id: 'a3333333-1111-4111-8111-111111111111',
    adjustment_item_id: 'b1111111-1111-4111-8111-111111111111',
    report_generation_id: 'a9000000-1111-4111-8111-111111111111',
    claim_purpose: 'internal_management',
    requested: 10,
    eligible: 8,
    disallowed: 2,
    disallow_reasons: [],
    inventory_impact_mode: 'market_based_adjustment',
  },
  error: null,
  meta: {
    request_id: 'req-adjustment-rule-001',
    timestamp: '2026-04-07T12:10:00.000Z',
    status: 'completed',
    reason: null,
    warnings: [],
  },
};
