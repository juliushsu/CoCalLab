import { t } from '../i18n/messages.js';

const UNIT_MAP = {
  kwh: { base_unit: 'kWh', multiplier: 1 },
  'kw-h': { base_unit: 'kWh', multiplier: 1 },
  wh: { base_unit: 'kWh', multiplier: 0.001 },
  mwh: { base_unit: 'kWh', multiplier: 1000 },
  l: { base_unit: 'L', multiplier: 1 },
  liter: { base_unit: 'L', multiplier: 1 },
  liters: { base_unit: 'L', multiplier: 1 },
  ml: { base_unit: 'L', multiplier: 0.001 },
  kg: { base_unit: 'kg', multiplier: 1 },
  g: { base_unit: 'kg', multiplier: 0.001 },
  ton: { base_unit: 'kg', multiplier: 1000 },
  tonne: { base_unit: 'kg', multiplier: 1000 },
  km: { base_unit: 'km', multiplier: 1 },
  m: { base_unit: 'km', multiplier: 0.001 },
  m3: { base_unit: 'm3', multiplier: 1 },
};

export function normalizeUnit(quantity, unit) {
  if (typeof quantity !== 'number' || Number.isNaN(quantity) || quantity < 0) {
    throw new Error('quantity must be a non-negative number');
  }

  const rawUnit = (unit || '').trim().toLowerCase();
  const matched = UNIT_MAP[rawUnit];

  if (!matched) {
    return {
      ok: false,
      normalized_quantity: null,
      normalized_unit: null,
      warning: t('unit_not_supported'),
    };
  }

  return {
    ok: true,
    normalized_quantity: Number((quantity * matched.multiplier).toFixed(8)),
    normalized_unit: matched.base_unit,
    warning: null,
  };
}
