import { normalizeUnit } from './unit-normalization.js';

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseQuantity(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

export function normalize_extracted_document_draft(input) {
  const raw = input?.ocr_payload ?? {};

  const vendor = pickFirstString(raw.vendor, raw.supplier, raw.merchant, raw.store_name);
  const activity_date = parseDate(raw.activity_date || raw.invoice_date || raw.date);
  const quantity = parseQuantity(raw.quantity || raw.usage || raw.amount);
  const unit = pickFirstString(raw.unit, raw.usage_unit, raw.quantity_unit);
  const amount_twd = parseQuantity(raw.amount_twd || raw.total_amount || raw.total);
  const currency = pickFirstString(raw.currency) || 'TWD';

  const warnings = [];
  let normalized_quantity = null;
  let normalized_unit = null;

  if (quantity !== null && unit) {
    const normalized = normalizeUnit(quantity, unit);
    if (normalized.ok) {
      normalized_quantity = normalized.normalized_quantity;
      normalized_unit = normalized.normalized_unit;
    } else {
      warnings.push(normalized.warning);
    }
  }

  const completeness_score = [vendor, activity_date, quantity, unit]
    .filter((value) => value !== null && value !== undefined)
    .length / 4;

  return {
    normalized_payload: {
      vendor,
      activity_date,
      quantity,
      unit,
      normalized_quantity,
      normalized_unit,
      amount_twd,
      currency,
      raw_text_snippets: Array.isArray(raw.text_blocks) ? raw.text_blocks : [],
    },
    confidence_score: Number(completeness_score.toFixed(4)),
    status: completeness_score < 0.5 ? 'needs_clarification' : 'pending_review',
    warnings,
  };
}
