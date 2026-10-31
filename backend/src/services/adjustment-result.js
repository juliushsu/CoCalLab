/** Normalize the SQL eligibility row without treating valid zeroes as missing. */
export function normalizeAdjustmentEvaluationResult(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('Adjustment evaluation returned no result');
  }
  const quantity = (key) => {
    const value = row[key];
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value)) || Number(value) < 0) {
      throw new Error(`Invalid adjustment evaluation ${key}`);
    }
    return Number(value);
  };
  const requested = quantity('requested');
  const eligible = quantity('eligible');
  const disallowed = quantity('disallowed');
  if (Math.abs(requested - eligible - disallowed) > 0.000001) {
    throw new Error('Inconsistent adjustment evaluation quantities');
  }
  if (!Array.isArray(row.disallow_reasons) || !row.disallow_reasons.every((reason) => typeof reason === 'string')) {
    throw new Error('Invalid adjustment evaluation reasons');
  }
  return { ...row, requested, eligible, disallowed };
}
