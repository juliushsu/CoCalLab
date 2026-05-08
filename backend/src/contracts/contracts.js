const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const INCLUSION_STATUS = ['included', 'excluded', 'pending'];
export const SUBSCRIPTION_STATUS = ['active', 'grace_period', 'readonly', 'suspended', 'canceled'];
export const CLAIM_PURPOSE_CODES = [
  'taiwan_carbon_fee',
  'voluntary_claim',
  'ifrs_s2_note',
  'esg_note',
  'internal_management',
];

export const API_ENVELOPE_CONTRACT = {
  success: 'boolean',
  data: 'object|null',
  error: '{code,message,details?,reason?}|null',
  meta: '{request_id,timestamp,status,reason,warnings[]}',
};

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function assertUuid(value, name) {
  assertString(value, name);
  if (!UUID_RE.test(value)) {
    throw new Error(`${name} must be a valid uuid`);
  }
}

function assertArray(value, name) {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }
}

function assertOptionalObject(value, name) {
  if (value === undefined || value === null) return;
  assertObject(value, name);
}

function assertOptionalString(value, name) {
  if (value === undefined || value === null) return;
  assertString(value, name);
}

export const PROCESS_DOCUMENT_CONTRACT = {
  input: {
    required: ['organization_id', 'project_id', 'uploaded_document_id'],
    optional: ['ocr_payload', 'provider_hint', 'request_id'],
  },
  output: {
    required: ['draft_id', 'status', 'normalized_payload'],
    optional: ['warnings', 'provider'],
  },
};

export const CLASSIFY_DOCUMENT_CONTRACT = {
  input: {
    required: ['organization_id', 'project_id', 'draft_id'],
    optional: ['normalized_payload', 'model_hint', 'request_id'],
  },
  output: {
    required: ['draft_id', 'classification_status', 'suggested_category', 'confidence_score'],
    optional: ['suggested_scope', 'inclusion_status', 'review_note', 'provider'],
  },
};

export const CONFIRM_DRAFT_CONTRACT = {
  input: {
    required: ['organization_id', 'project_id', 'draft_id', 'decision'],
    optional: ['overrides', 'request_id'],
  },
  output: {
    required: ['draft_id', 'draft_status', 'inclusion_status'],
    optional: ['emission_activity_id', 'calculation_result_id'],
  },
};

export const RECALCULATE_PROJECT_CONTRACT = {
  input: {
    required: ['organization_id', 'project_id', 'actor_user_id', 'force_recalculate'],
    optional: ['request_id'],
  },
  output: {
    required: ['project_id', 'processed_activities', 'calculated_count', 'pending_factor_count', 'excluded_count'],
    optional: ['error_count'],
  },
};

export const GENERATE_REPORT_CONTRACT = {
  input: {
    required: ['organization_id', 'project_id', 'report_version'],
    optional: ['claim_purpose', 'request_id'],
  },
  output: {
    required: [
      'report_generation_id',
      'status',
      'claim_purpose',
      'gross_emissions_snapshot',
      'adjustment_summary',
      'claim_results',
      'adjustment_manifest',
      'payload',
      'warning_count',
    ],
    optional: ['legal_entity_snapshot', 'site_snapshot', 'boundary_snapshot'],
  },
};

export const RUN_AI_AUDIT_CONTRACT = {
  input: {
    required: ['organization_id', 'project_id', 'report_generation_id'],
    optional: ['model_hint', 'request_id'],
  },
  output: {
    required: ['ai_audit_result_id', 'status', 'summary_text', 'recommended_actions'],
    optional: ['provider'],
  },
};

export const ENFORCE_SUBSCRIPTION_CONTRACT = {
  input: {
    required: ['organization_id'],
    optional: ['as_of', 'request_id'],
  },
  output: {
    required: ['organization_id', 'effective_status', 'can_write_formal_data', 'can_generate_report'],
    optional: ['reason'],
  },
};

export function validateProcessDocumentInput(input) {
  assertObject(input, 'input');
  assertUuid(input.organization_id, 'organization_id');
  assertUuid(input.project_id, 'project_id');
  assertUuid(input.uploaded_document_id, 'uploaded_document_id');
  assertOptionalObject(input.ocr_payload, 'ocr_payload');
  assertOptionalString(input.provider_hint, 'provider_hint');
  assertOptionalString(input.request_id, 'request_id');
  return input;
}

export function validateClassifyDocumentInput(input) {
  assertObject(input, 'input');
  assertUuid(input.organization_id, 'organization_id');
  assertUuid(input.project_id, 'project_id');
  assertUuid(input.draft_id, 'draft_id');
  assertOptionalObject(input.normalized_payload, 'normalized_payload');
  assertOptionalString(input.model_hint, 'model_hint');
  assertOptionalString(input.request_id, 'request_id');
  return input;
}

export function validateConfirmDraftInput(input) {
  assertObject(input, 'input');
  assertUuid(input.organization_id, 'organization_id');
  assertUuid(input.project_id, 'project_id');
  assertUuid(input.draft_id, 'draft_id');
  if (input.decision !== 'confirmed' && input.decision !== 'rejected') {
    throw new Error('decision must be confirmed or rejected');
  }
  assertOptionalObject(input.overrides, 'overrides');
  assertOptionalString(input.request_id, 'request_id');
  return input;
}

export function validateRecalculateProjectInput(input) {
  assertObject(input, 'input');
  assertUuid(input.organization_id, 'organization_id');
  assertUuid(input.project_id, 'project_id');
  assertUuid(input.actor_user_id, 'actor_user_id');
  if (typeof input.force_recalculate !== 'boolean') {
    throw new Error('force_recalculate must be boolean');
  }
  assertOptionalString(input.request_id, 'request_id');
  return input;
}

export function validateGenerateReportInput(input) {
  assertObject(input, 'input');
  assertUuid(input.organization_id, 'organization_id');
  assertUuid(input.project_id, 'project_id');
  if (!Number.isInteger(input.report_version) || input.report_version < 1) {
    throw new Error('report_version must be positive integer');
  }
  if (input.claim_purpose !== undefined && !CLAIM_PURPOSE_CODES.includes(input.claim_purpose)) {
    throw new Error('claim_purpose is invalid');
  }
  assertOptionalString(input.request_id, 'request_id');
  return input;
}

export function validateRunAiAuditInput(input) {
  assertObject(input, 'input');
  assertUuid(input.organization_id, 'organization_id');
  assertUuid(input.project_id, 'project_id');
  assertUuid(input.report_generation_id, 'report_generation_id');
  assertOptionalString(input.model_hint, 'model_hint');
  assertOptionalString(input.request_id, 'request_id');
  return input;
}

export function validateEnforceSubscriptionInput(input) {
  assertObject(input, 'input');
  assertUuid(input.organization_id, 'organization_id');
  if (input.as_of !== undefined) {
    assertString(input.as_of, 'as_of');
    if (Number.isNaN(Date.parse(input.as_of))) {
      throw new Error('as_of must be valid ISO datetime string');
    }
  }
  assertOptionalString(input.request_id, 'request_id');
  return input;
}

export function validateLocalizedMessage(value, name) {
  assertObject(value, name);
  assertString(value.zh_tw, `${name}.zh_tw`);
  assertString(value.en, `${name}.en`);
  assertString(value.ja, `${name}.ja`);
  return value;
}

export function validateInclusionStatus(value, name = 'inclusion_status') {
  if (!INCLUSION_STATUS.includes(value)) {
    throw new Error(`${name} must be included, excluded, or pending`);
  }
  return value;
}

export function validateSubscriptionStatus(value, name = 'subscription_status') {
  if (!SUBSCRIPTION_STATUS.includes(value)) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

export function validateFactorCandidates(factors) {
  assertArray(factors, 'factors');
  for (const factor of factors) {
    assertObject(factor, 'factor');
    assertUuid(factor.id, 'factor.id');
    assertString(factor.activity_type, 'factor.activity_type');
    assertString(factor.category, 'factor.category');
    assertString(factor.unit, 'factor.unit');
  }
  return factors;
}
