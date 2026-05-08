const CLASSIFICATION_RULES = [
  {
    name: 'electricity_bill',
    match: (payload) => /electric|台電|電費/i.test(`${payload.vendor || ''} ${payload.raw_text_snippets?.join(' ') || ''}`),
    category: 'energy',
    subcategory: 'purchased_electricity',
    activity_type: 'electricity',
    suggested_scope: 2,
    base_confidence: 0.9,
  },
  {
    name: 'fuel_receipt',
    match: (payload) => /diesel|gasoline|fuel|加油|汽油|柴油/i.test(`${payload.vendor || ''} ${payload.raw_text_snippets?.join(' ') || ''}`),
    category: 'stationary_combustion',
    subcategory: 'fuel',
    activity_type: 'fuel',
    suggested_scope: 1,
    base_confidence: 0.85,
  },
  {
    name: 'transport_ticket',
    match: (payload) => /uber|taxi|rail|高鐵|台鐵|flight|機票/i.test(`${payload.vendor || ''} ${payload.raw_text_snippets?.join(' ') || ''}`),
    category: 'business_travel',
    subcategory: 'transport',
    activity_type: 'transport',
    suggested_scope: 3,
    base_confidence: 0.8,
  },
  {
    name: 'waste_disposal',
    match: (payload) => /waste|廢棄|清運/i.test(`${payload.vendor || ''} ${payload.raw_text_snippets?.join(' ') || ''}`),
    category: 'waste',
    subcategory: 'waste_treatment',
    activity_type: 'waste',
    suggested_scope: 3,
    base_confidence: 0.75,
  },
];

export function classify_document_draft(input) {
  const payload = input.normalized_payload || {};

  const rule = CLASSIFICATION_RULES.find((item) => item.match(payload));
  if (!rule) {
    return {
      classification_status: 'classified',
      suggested_category: 'unclassified',
      suggested_subcategory: 'manual_review',
      activity_type: 'other',
      suggested_scope: null,
      confidence_score: 0.45,
      inclusion_status: 'pending',
      review_note: 'No deterministic rule match; manual review required',
    };
  }

  const quantityBoost = payload.normalized_quantity ? 0.05 : 0;
  const dateBoost = payload.activity_date ? 0.03 : 0;
  const confidence = Math.min(0.99, rule.base_confidence + quantityBoost + dateBoost);

  return {
    classification_status: 'classified',
    suggested_category: rule.category,
    suggested_subcategory: rule.subcategory,
    activity_type: rule.activity_type,
    suggested_scope: rule.suggested_scope,
    confidence_score: Number(confidence.toFixed(4)),
    inclusion_status: confidence >= 0.7 ? 'included' : 'pending',
    review_note: `Matched rule: ${rule.name}`,
  };
}
