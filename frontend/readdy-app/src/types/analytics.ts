/**
 * Analytics / Chart adapter canonical types.
 * Dimension selector + chart adapter pattern.
 * Replace DTO stubs with Codex canonical schema when available.
 *
 * NAMING RULES:
 * - Do NOT use 'level' as a primary dimension name.
 * - Use canonical codes: ghg_scope / iso_category / department / hotspot
 * - Do NOT display raw codes — always use i18n label mapping.
 */

// ─── Dimension codes ──────────────────────────────────────────────────────────
// 'level' is REMOVED. Use ghg_scope / iso_category instead.
export type DimensionCode =
  | 'ghg_scope'      // GHG Protocol Scope 1/2/3
  | 'iso_category'   // ISO 14064 / GHG Protocol category
  | 'department'     // 部門分析
  | 'hotspot';       // 熱點分析

// ─── Chart type codes ─────────────────────────────────────────────────────────
export type ChartTypeCode = 'distribution' | 'trend' | 'hotspot';

// ─── Generic data point ───────────────────────────────────────────────────────
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  percentage?: number;
}

// ─── Trend data point ─────────────────────────────────────────────────────────
export interface TrendDataPoint {
  period: string;   // e.g. "2024-Q1"
  value: number;
  dimension_label: string;
}

// ─── Chart adapter DTO ────────────────────────────────────────────────────────
// Adapter interface — Codex will provide real data via this shape.
export interface ChartAdapterDTO {
  dimension: DimensionCode;
  chart_type: ChartTypeCode;
  title_i18n_key: string;
  data: ChartDataPoint[];
  trend_data?: TrendDataPoint[];
  unit: string;
  generated_at: string | null;
}

// ─── AI Governance types ──────────────────────────────────────────────────────
export type AIProviderCode = 'openai' | 'anthropic' | 'azure_openai' | 'custom';

/**
 * AIFeatureCode — canonical codes, never display raw to users.
 * Always use i18n mapping: t(`aiGovernance.features.featureNames.${code}`)
 */
export type AIFeatureCode =
  | 'ai_report_generation_enabled'
  | 'ai_audit_enabled'
  | 'ai_classification_enabled'
  | 'ai_ocr_enabled';

export type AIJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Platform-only: provider/model config. NOT shown to customers. */
export interface AIProviderConfigDTO {
  id: string;
  provider: AIProviderCode;
  model_name: string;
  is_active: boolean;
  max_tokens: number | null;
  temperature: number | null;
  notes: string | null;
}

/** System-wide or org-level feature toggle. */
export interface AIFeatureToggleDTO {
  feature: AIFeatureCode;
  is_enabled: boolean;
  org_id: string | null;  // null = system-wide
}

/** Usage summary — platform view (full) and customer view (quota only). */
export interface AIUsageSummaryDTO {
  period: string;
  total_requests: number;
  total_tokens: number;
  estimated_cost_usd: number;
  failed_requests: number;
  quota_limit: number | null;
  quota_used: number;
}

export interface AIJobLogDTO {
  id: string;
  feature: AIFeatureCode;
  status: AIJobStatus;
  org_id: string | null;
  project_id: string | null;
  started_at: string;
  completed_at: string | null;
  tokens_used: number | null;
  cost_usd: number | null;
  error_message: string | null;
}

/**
 * CustomerAIStatusDTO — what customers can see.
 * No provider internals, no API keys, no cost details.
 */
export interface CustomerAIStatusDTO {
  enabled_features: AIFeatureCode[];
  quota_used: number;
  quota_limit: number | null;
  /** Display-safe model version label, e.g. "GPT-4o (2024-11)" */
  model_version_label: string;
  quota_reset_date: string | null;
}
