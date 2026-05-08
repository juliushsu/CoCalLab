/**
 * Emission Factor canonical types.
 * All display text goes through i18n — never render raw codes to users.
 * Replace string unions with Codex canonical enums when available.
 */

// ─── Source type codes ────────────────────────────────────────────────────────
// Extended per CTO directive: distinguish org-specific / monitored from external sources
export type FactorSourceType =
  | 'official'      // 官方政府/國際機構來源
  | 'global'        // 全球資料庫（ecoinvent, IPCC 等）
  | 'industry'      // 產業標準
  | 'fallback'      // 備用係數
  | 'org_specific'  // 組織自訂係數（organization-specific factors）
  | 'monitored';    // 自家監測來源（on-site monitoring / direct measurement）

// ─── Org-source sub-type ─────────────────────────────────────────────────────
// CTO directive: 自家監測來源 / 自家量測活動數據 / organization-specific factors 需明確區分
export type OrgSourceSubtype =
  | 'monitoring_source'     // 自家監測來源（設備、感測器、計量系統）
  | 'direct_activity_data'  // 自家量測活動數據（直接排放數據、能源量測）
  | 'org_factor';           // 組織自訂排放係數（具備方法學與驗證條件）

// ─── Resolution priority tier ────────────────────────────────────────────────
// Factor resolution 優先序層級（數字越小優先序越高）
// org_specific / monitored 在具備檢定、方法學與驗證條件下，應高於外部來源
export type ResolutionPriorityTier =
  | 'tier_0_validated_org'  // 最高：已驗證的組織自訂係數（具備第三方檢定）
  | 'tier_1_primary'        // 高：主要資料（現場量測、直接採購）
  | 'tier_2_secondary'      // 中：次要資料（行業平均、文獻）
  | 'tier_3_tertiary'       // 低：估算資料（全球平均、代理值）
  | 'tier_4_fallback';      // 最低：備用係數

// ─── Data level (canonical) ───────────────────────────────────────────────────
// Aligned with Codex canonical proposal:
// - primary   = 一級資料: on-site measurements, direct procurement data
// - secondary = 二級資料: industry averages, literature, databases
// - hybrid    = 混合資料: mix of primary and secondary sources
// - fallback  = 備援資料: global averages, proxy values, last-resort estimates
export type DataLevel = 'primary' | 'secondary' | 'hybrid' | 'fallback';

// ─── Applicable module codes ──────────────────────────────────────────────────
export type ApplicableModule =
  | 'ghg_inventory'       // GHG 溫室氣體盤查
  | 'product_cfp'         // 產品碳足跡 (ISO 14067)
  | 'lca'                 // 生命周期評估 (LCA)
  | 'esg_report'          // ESG 報告
  | 'scope2_market'       // Scope 2 市場基礎法
  | 'ifrs_s1_s2';         // IFRS S1/S2 揭露

// ─── Factor status codes ──────────────────────────────────────────────────────
export type FactorStatus = 'active' | 'stale' | 'deprecated' | 'pending_review';

// ─── Platform-governed source status ─────────────────────────────────────────
// Represents the platform's governance state of a factor source.
// Tenants should NOT interpret these as action items for themselves.
export type SourceUpdateStatus =
  | 'active_latest'       // 最新啟用：平台已確認為最新版本
  | 'new_version_detected' // 平台偵測到新版本：平台正在評估更新
  | 'pending_platform_review' // 待平台審核：平台內部審核中
  | 'deprecated'          // 已淘汰：此版本已停止維護
  | 'legacy_reference';   // 僅供舊報告追溯：不建議新計算使用

// ─── Emission factor DTO stub ─────────────────────────────────────────────────
// Adapter placeholder — replace with Codex canonical schema when available.
export interface EmissionFactorDTO {
  id: string;
  factor_value: number;
  unit: string;
  source_name: string;
  source_code: string;
  version: string;
  published_date: string | null;
  effective_from: string | null;
  effective_to: string | null;
  last_checked: string | null;
  last_synced: string | null;
  status: FactorStatus;
  is_org_override: boolean;
  scope: string | null;
  category: string | null;
  region: string | null;
  gas_type: string | null;
  notes: string | null;
}

// ─── Factor source (whitelist) DTO ────────────────────────────────────────────
// Aligned with Codex canonical schema proposal
export interface FactorSourceDTO {
  id: string;
  source_name: string;
  source_code: string;
  region: string | null;
  country_code: string | null;
  source_type: FactorSourceType;
  is_enabled: boolean;
  priority: number;
  last_updated: string | null;
  update_status: SourceUpdateStatus;
  description: string | null;
  url: string | null;
  // ─── Canonical fields (Codex aligned) ─────────────────────────────────────
  /** Data quality level per Codex canonical: primary | secondary | hybrid | fallback */
  data_level: DataLevel;
  /** Applicable calculation/reporting modules */
  applicable_modules: ApplicableModule[];
  /** If true, render as featured card (e.g. CFP_P_02) */
  is_featured?: boolean;
  /** Short note shown on featured card */
  featured_note?: string | null;
  // ─── Org-source fields (CTO directive) ────────────────────────────────────
  /** Sub-type for org_specific / monitored sources */
  org_source_subtype?: OrgSourceSubtype | null;
  /** Factor resolution priority tier */
  resolution_priority_tier?: ResolutionPriorityTier | null;
  /**
   * Whether this source requires validation (檢定/方法學/驗證) to be elevated
   * in factor resolution. If true and not yet validated, priority is NOT elevated.
   */
  requires_validation?: boolean;
  /** Whether validation/certification has been completed */
  is_validated?: boolean;
  /** Validation body or methodology reference */
  validation_reference?: string | null;
}
