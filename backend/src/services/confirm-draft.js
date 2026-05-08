import { normalizeUnit } from './unit-normalization.js';

export function confirm_draft_to_emission_activity({ draft, decision, overrides = {}, next_activity_code }) {
  if (decision === 'rejected') {
    return {
      draft_status: 'rejected',
      emission_activity: null,
      inclusion_status: 'excluded',
    };
  }

  const normalizedPayload = draft.normalized_payload || {};
  const quantity = overrides.quantity ?? normalizedPayload.quantity ?? 0;
  const unit = overrides.unit ?? normalizedPayload.unit ?? 'kg';
  const normalized = normalizeUnit(Number(quantity), unit);

  return {
    draft_status: 'confirmed',
    inclusion_status: overrides.inclusion_status ?? draft.inclusion_status ?? 'pending',
    emission_activity: {
      organization_id: draft.organization_id,
      project_id: draft.project_id,
      source_document_id: draft.uploaded_document_id,
      source_draft_id: draft.id,
      activity_code: next_activity_code,
      activity_name: overrides.activity_name ?? draft.suggested_category ?? 'unclassified_activity',
      activity_date: overrides.activity_date ?? normalizedPayload.activity_date,
      category: overrides.category ?? draft.suggested_category ?? 'unclassified',
      subcategory: overrides.subcategory ?? draft.suggested_subcategory ?? null,
      activity_type: overrides.activity_type ?? draft.activity_type ?? 'other',
      quantity: Number(quantity),
      unit,
      normalized_quantity: normalized.ok ? normalized.normalized_quantity : null,
      normalized_unit: normalized.ok ? normalized.normalized_unit : null,
      inclusion_status: overrides.inclusion_status ?? draft.inclusion_status ?? 'pending',
      exclusion_reason: overrides.exclusion_reason ?? null,
      review_note: overrides.review_note ?? draft.review_note ?? null,
      suggested_scope: overrides.suggested_scope ?? draft.suggested_scope ?? null,
      final_scope: overrides.final_scope ?? null,
      confidence_score: overrides.confidence_score ?? draft.confidence_score ?? null,
      status: 'active',
    },
  };
}
