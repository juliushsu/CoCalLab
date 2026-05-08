/**
 * Carbon Adjustment & Certificate canonical types.
 * Adapter / DTO 接入口 — 等 Codex 定義 DB schema 後替換 mock。
 *
 * NAMING RULES:
 * - Do NOT display raw type codes to users — always use i18n label mapping.
 * - All fields are optional-safe for partial DTO responses.
 */

// ─── Item type codes ──────────────────────────────────────────────────────────
export type AdjustmentTypeCode =
  | 'offset_credit'         // 碳權 / 減量額度
  | 'renewable_electricity' // 綠電 / 再生能源屬性憑證
  | 'carbon_removal'        // 碳移除
  | 'carbon_storage';       // 碳儲存

// ─── Claim purpose codes ──────────────────────────────────────────────────────
// Codex canonical — never display raw code, always use i18n mapping.
export type ClaimPurposeCode =
  | 'scope2_market_based'
  | 'voluntary_offset'
  | 'compliance_offset'
  | 'net_zero_claim'
  | 'carbon_neutral_claim';

// ─── Target type codes ────────────────────────────────────────────────────────
// Adapter space — not always project-level.
export type TargetTypeCode = 'organization' | 'project' | 'product' | 'facility';

// ─── Verification status ──────────────────────────────────────────────────────
// Full set — unverified / pending / verified / rejected
export type VerificationStatusCode =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'third_party_verified'
  | 'self_declared'
  | 'rejected';

// ─── Approval status ──────────────────────────────────────────────────────────
// draft → submitted → approved / rejected / revoked
export type ApprovalStatusCode =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'revoked';

// ─── Application status ───────────────────────────────────────────────────────
// evaluated → applied / rejected / reversed
export type ApplicationStatusCode =
  | 'evaluated'
  | 'applied'
  | 'rejected'
  | 'reversed';

// ─── Inventory impact mode ────────────────────────────────────────────────────
// Codex canonical — never display raw code.
export type InventoryImpactMode =
  | 'disclosure_only'
  | 'market_based_adjustment'
  | 'regulatory_deduction'
  | 'claim_only';

// ─── Double-counting check status ─────────────────────────────────────────────
export type DoubleCounting = 'clear' | 'flagged' | 'unknown';

// ─── Proof document status ────────────────────────────────────────────────────
export type ProofDocumentStatus = 'not_uploaded' | 'uploaded' | 'verified' | 'rejected';

// ─── Legacy status (kept for backward compat) ─────────────────────────────────
export type AdjustmentStatusCode =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'expired';

// ─── Eligible use codes (alias for ClaimPurposeCode) ─────────────────────────
export type EligibleUseCode = ClaimPurposeCode;

// ─── Main Item DTO ────────────────────────────────────────────────────────────
// Codex canonical DTO 接入口 — replace mock adapter when schema is ready.
export interface CarbonAdjustmentDTO {
  id: string;
  project_id: string | null;
  org_id: string | null;

  // Classification
  adjustment_type: AdjustmentTypeCode;
  status: AdjustmentStatusCode;

  // Target (adapter space — not always project)
  target_type?: TargetTypeCode | null;
  target_label?: string | null;

  // Quantity
  quantity_tco2e: number;
  quantity_available_tco2e?: number | null;  // available after deductions
  unit: string;

  // Certificate fields
  certificate_number: string | null;
  registry_program: string | null;
  vintage_year: number | null;
  issue_date: string | null;
  retirement_date: string | null;

  // Verification
  verification_status: VerificationStatusCode;
  verifier_name: string | null;
  verification_date: string | null;

  // Approval (new)
  approval_status?: ApprovalStatusCode | null;

  // Proof document
  proof_document_status?: ProofDocumentStatus | null;

  // Jurisdiction & eligibility
  jurisdiction: string | null;
  eligible_use: EligibleUseCode | null;
  claim_purpose?: ClaimPurposeCode | null;
  double_counting_check: DoubleCounting;

  // Metadata
  notes: string | null;
  created_at: string;
  updated_at: string;

  // Data origin fields (reserved for Codex)
  data_origin?: string | null;
  is_fixture?: boolean;
  is_seed?: boolean;
  is_test?: boolean;
}

// ─── Application DTO ──────────────────────────────────────────────────────────
// Represents a claim application linking an adjustment item to a target.
export interface AdjustmentApplicationDTO {
  id: string;
  adjustment_id: string;
  target_type: TargetTypeCode;
  target_id: string;
  target_label: string;

  claim_purpose: ClaimPurposeCode;
  inventory_impact_mode: InventoryImpactMode;

  requested_quantity_tco2e: number;
  eligible_quantity_tco2e: number;
  applied_quantity_tco2e: number;
  disallowed_quantity_tco2e: number;

  application_status: ApplicationStatusCode;
  disallow_reasons: string[];

  // Blocking flags
  is_blocked_by_verification: boolean;
  is_blocked_by_approval: boolean;

  created_at: string;
  updated_at: string;
}

// ─── Rule Result DTO ──────────────────────────────────────────────────────────
// Codex rule engine output — replace mock when rule engine is ready.
export interface RuleResultDTO {
  id: string;
  adjustment_id: string;
  claim_purpose: ClaimPurposeCode;
  jurisdiction: string | null;
  inventory_impact_mode: InventoryImpactMode;

  requested_tco2e: number;
  eligible_tco2e: number;
  disallowed_tco2e: number;

  rule_hints: string[];   // human-readable rule reasons (i18n keys or plain text)
  rule_engine_version: string | null;
  evaluated_at: string | null;

  // Flags
  is_mock: boolean;
  rule_engine_applied: boolean;
}

// ─── Emissions summary DTO ────────────────────────────────────────────────────
export interface EmissionsSummaryDTO {
  project_id: string;
  period: string;

  gross_emissions_tco2e: number;

  total_adjustments_tco2e: number;
  adjustments_by_type: {
    type: AdjustmentTypeCode;
    quantity_tco2e: number;
    count: number;
    approved_count: number;
  }[];

  claimable_result_tco2e: number;
  claimable_note: string | null;
  claim_purpose_label?: string | null;  // adapter space

  has_pending_adjustments: boolean;
  rule_engine_applied: boolean;
}
