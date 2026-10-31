/** GET analytics adapter. Wire quantities are kgCO2e; UI quantities are tCO2e. */
import { EdgeFunctionService } from './edgeFunction';
import type { ChartDataPoint, TrendDataPoint } from '@/types/analytics';
import { analyticsQuery, parseAnalyticsResponse } from './analyticsContract';
import type { AnalyticsEmissionsItem, AnalyticsTrendItem, AnalyticsEmissionsResponse, FetchAnalyticsParams } from './analyticsContract';
export type { AnalyticsEmissionsItem, AnalyticsTrendItem, AnalyticsEmissionsResponse, FetchAnalyticsParams } from './analyticsContract';

// ─── GHG Scope code → color map ──────────────────────────────────────────────
const GHG_SCOPE_COLORS: Record<string, string> = {
  scope_1: '#0d9488',
  scope_2: '#14b8a6',
  scope_3: '#5eead4',
};

// ─── ISO Category code → color map ───────────────────────────────────────────
const ISO_CATEGORY_COLORS: Record<string, string> = {
  category_1: '#0d9488',
  category_2: '#14b8a6',
  category_3: '#5eead4',
  category_4: '#99f6e4',
  category_5: '#2dd4bf',
  category_6: '#0f766e',
};

// ─── Adapter: AnalyticsEmissionsItem[] → ChartDataPoint[] ────────────────────
export function adaptToChartDataPoints(
  items: AnalyticsEmissionsItem[],
  dimension: 'ghg_scope' | 'iso_category',
  labelFn: (code: string) => string
): ChartDataPoint[] {
  const colorMap = dimension === 'ghg_scope' ? GHG_SCOPE_COLORS : ISO_CATEGORY_COLORS;
  return items.map((item) => ({
    label: labelFn(item.classification_code),
    value: item.value_tco2e,
    percentage: item.percentage,
    color: colorMap[item.classification_code] ?? '#94a3b8',
  }));
}

// ─── Adapter: AnalyticsTrendItem[] → TrendDataPoint[] ────────────────────────
export function adaptToTrendDataPoints(trend: AnalyticsTrendItem[]): TrendDataPoint[] {
  return trend.map((t) => ({
    period: t.period,
    value: t.value_tco2e,
    dimension_label: 'Total',
  }));
}

export async function fetchAnalyticsEmissions(params: FetchAnalyticsParams): Promise<AnalyticsEmissionsResponse> {
  const response = await EdgeFunctionService.invoke<unknown>({
    functionName: 'analytics-emissions',
    method: 'GET',
    query: analyticsQuery(params),
  });
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Analytics request failed.');
  }
  return parseAnalyticsResponse(response.data, params.dimension);
}
