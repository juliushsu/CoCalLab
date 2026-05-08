/**
 * Analytics Service — read path adapter
 * Connects to Codex `analytics-emissions` edge function.
 *
 * Contract (Codex canonical):
 *   POST /functions/v1/analytics-emissions
 *   Body: { project_id?, org_id?, dimension: 'ghg_scope' | 'iso_category', period? }
 *   Response envelope: { success, data: AnalyticsEmissionsResponse }
 *
 * Fallback: if edge function unavailable, returns null → caller shows mock.
 */

import { EdgeFunctionService } from './edgeFunction';
import type { ChartDataPoint, TrendDataPoint } from '@/types/analytics';

// ─── Codex canonical response shape ──────────────────────────────────────────
export interface AnalyticsEmissionsItem {
  classification_code: string;   // e.g. 'scope_1', 'category_1'
  classification_label?: string; // optional human label from backend
  value_tco2e: number;
  percentage: number;
}

export interface AnalyticsTrendItem {
  period: string;
  value_tco2e: number;
}

export interface AnalyticsEmissionsResponse {
  dimension: string;
  items: AnalyticsEmissionsItem[];
  trend?: AnalyticsTrendItem[];
  total_tco2e: number;
  generated_at: string | null;
  is_mock?: boolean;
}

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

// ─── Service call ─────────────────────────────────────────────────────────────
export interface FetchAnalyticsParams {
  dimension: 'ghg_scope' | 'iso_category';
  project_id?: string;
  org_id?: string;
  period?: string;
}

export async function fetchAnalyticsEmissions(
  params: FetchAnalyticsParams
): Promise<AnalyticsEmissionsResponse | null> {
  const response = await EdgeFunctionService.invoke<AnalyticsEmissionsResponse>({
    functionName: 'analytics-emissions',
    payload: params,
  });

  if (!response.success || !response.data) {
    return null;
  }

  return response.data;
}
