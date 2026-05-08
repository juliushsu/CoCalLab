/**
 * Capability / Report-type canonical codes.
 * These codes are intentionally kept as opaque strings so the frontend
 * never hard-codes business logic — all display text goes through i18n.
 *
 * When Codex delivers the canonical schema, replace the string union with
 * the authoritative enum / const from the shared DTO package.
 */

// ─── Report type codes ────────────────────────────────────────────────────────
// Canonical codes — do NOT display raw values to users; use REPORT_TYPE_LABELS.
export type ReportTypeCode =
  | 'carbon_inventory'   // 碳排放報告書 / GHG Inventory Report
  | 'esg'                // ESG 報告書
  | 'ifrs_s1_s2'         // IFRS S1 / S2 會計揭露
  | 'product_cfp';       // 產品碳足跡 / Product Carbon Footprint

// ─── Capability codes ─────────────────────────────────────────────────────────
// Feature-flag identifiers — driven by subscription plan features.
export type CapabilityCode =
  | 'carbon_inventory'
  | 'esg'
  | 'ifrs_s1_s2'
  | 'product_cfp'
  | 'lifecycle_assessment';

// ─── Lifecycle stage codes ────────────────────────────────────────────────────
export type LifecycleStageCode =
  | 'raw_material'
  | 'manufacturing'
  | 'transport'
  | 'packaging'
  | 'use'
  | 'end_of_life';

// ─── Capability gate status ───────────────────────────────────────────────────
export type CapabilityGateStatus = 'available' | 'unavailable' | 'coming_soon';

export interface CapabilityGate {
  code: CapabilityCode;
  status: CapabilityGateStatus;
}

// ─── Report template descriptor ───────────────────────────────────────────────
// Adapter / DTO placeholder — Codex will define the canonical shape.
// Frontend only reads `template_code` and `report_type`; never guesses DB columns.
export interface ReportTemplateDescriptor {
  template_code: string;       // e.g. "ghg_inventory_v1"
  report_type: ReportTypeCode;
  display_name_i18n_key: string; // points to i18n key
  is_available: boolean;
  requires_capability: CapabilityCode;
}

// ─── Product Carbon project stub ─────────────────────────────────────────────
// Placeholder DTO — replace with Codex canonical schema when available.
export interface ProductCarbonProjectStub {
  id: string;
  name: string;
  product_code: string;
  status: 'draft' | 'in_progress' | 'completed';
  total_co2e_kg: number | null;
  created_at: string;
}

export interface LifecycleStageEntry {
  stage: LifecycleStageCode;
  co2e_kg: number | null;
  data_quality: 'primary' | 'secondary' | 'estimated' | null;
  notes: string;
}
