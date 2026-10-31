/** Wire contract: analytics-emissions GET. Backend quantities are kgCO2e. */
export type AnalyticsDimension = 'ghg_scope' | 'iso_category';
export interface AnalyticsEmissionsItem {
  classification_code: string;
  classification_label?: string;
  value_tco2e: number;
  percentage: number;
}
export interface AnalyticsTrendItem { period: string; value_tco2e: number }
export interface AnalyticsEmissionsResponse {
  dimension: AnalyticsDimension;
  items: AnalyticsEmissionsItem[];
  trend?: AnalyticsTrendItem[];
  total_tco2e: number;
  generated_at: string | null;
  is_mock: false;
}
export interface FetchAnalyticsParams {
  dimension: AnalyticsDimension;
  organization_id: string;
  project_id?: string;
}
export function analyticsQuery(params: FetchAnalyticsParams): Record<string, string> {
  if (!params.organization_id?.trim()) throw new Error('Please select an organization.');
  if (!['ghg_scope', 'iso_category'].includes(params.dimension)) throw new Error('Unsupported analytics dimension.');
  return {
    organization_id: params.organization_id,
    dimension: params.dimension,
    ...(params.project_id ? { project_id: params.project_id } : {}),
  };
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function quantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Invalid analytics emissions quantity.');
  }
  return value;
}
export function parseAnalyticsResponse(value: unknown, dimension: AnalyticsDimension): AnalyticsEmissionsResponse {
  if (!record(value) || value.dimension !== dimension || !Array.isArray(value.rows)) {
    throw new Error('Invalid analytics response.');
  }
  const total = quantity(value.total_co2e_kg);
  const seen = new Set<string>();
  const rows = value.rows.map((row: unknown) => {
    if (!record(row) || typeof row.classification_code !== 'string' ||
        !new RegExp(dimension === 'ghg_scope' ? '^scope_[1-3]$' : '^category_[1-6]$').test(row.classification_code) ||
        seen.has(row.classification_code)) throw new Error('Invalid analytics classification.');
    seen.add(row.classification_code);
    return { code: row.classification_code, kg: quantity(row.total_co2e_kg) };
  });
  const sum = rows.reduce((acc, row) => acc + row.kg, 0);
  if (Math.abs(sum - total) > Math.max(1e-8, Math.abs(total) * 1e-10)) {
    throw new Error('Analytics total does not match its rows.');
  }
  return {
    dimension,
    items: rows.map(({ code, kg }) => ({ classification_code: code, value_tco2e: kg / 1000, percentage: total === 0 ? 0 : kg / total * 100 })),
    total_tco2e: total / 1000,
    // The endpoint does not supply time-series or generation timestamps.
    generated_at: null,
    is_mock: false,
  };
}
