import type { AdjustmentItemRow } from './adjustmentService';
import type {
  CarbonAdjustmentDTO, AdjustmentTypeCode, AdjustmentStatusCode, ApprovalStatusCode,
  VerificationStatusCode, ProofDocumentStatus, TargetTypeCode, ClaimPurposeCode,
} from '../types/carbonAdjustment';

function quantity(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value)) || Number(value) < 0) {
    throw new Error('Invalid adjustment quantity');
  }
  return Number(value);
}

/** Preserve lifecycle and review independently: an active row is not an approval. */
export function mapAdjustmentItem(row: AdjustmentItemRow): CarbonAdjustmentDTO {
  const approval: ApprovalStatusCode | null = row.approval_status === 'pending' ? 'submitted' :
    ['draft', 'submitted', 'approved', 'rejected', 'revoked'].includes(row.approval_status)
      ? row.approval_status as ApprovalStatusCode : null;
  let status: AdjustmentStatusCode = 'pending_review';
  if (['inactive', 'revoked', 'expired'].includes(row.status)) status = row.status as AdjustmentStatusCode;
  else if (row.status === 'active') {
    if (approval === 'approved') status = 'approved';
    else if (approval === 'draft') status = 'draft';
    else if (approval === 'rejected' || approval === 'revoked') status = 'rejected';
  } else if (row.status === 'draft') status = 'draft';
  const type = row.adjustment_type === 'renewable_electricity_attribute' ? 'renewable_electricity' : row.adjustment_type;
  const types: AdjustmentTypeCode[] = ['offset_credit', 'renewable_electricity', 'carbon_removal', 'carbon_storage', 'regulatory_deduction'];
  if (!types.includes(type as AdjustmentTypeCode)) throw new Error('Unsupported adjustment type');
  const verification: VerificationStatusCode = ['unverified', 'pending', 'verified', 'rejected'].includes(row.certificate_verification_status)
    ? row.certificate_verification_status as VerificationStatusCode : 'unverified';
  const proof: ProofDocumentStatus | null = row.proof_document_status === 'missing' ? 'not_uploaded' :
    ['not_uploaded', 'uploaded', 'verified', 'rejected'].includes(row.proof_document_status)
      ? row.proof_document_status as ProofDocumentStatus : null;
  const target = ['organization', 'project', 'product', 'facility'].includes(row.target_type)
    ? row.target_type as TargetTypeCode : null;
  const purpose = ['taiwan_carbon_fee', 'voluntary_claim', 'ifrs_s2_note', 'esg_note', 'internal_management'].includes(row.claim_purpose)
    ? row.claim_purpose as ClaimPurposeCode : null;
  return {
    id: row.id, project_id: row.project_id, org_id: row.organization_id,
    adjustment_type: type as AdjustmentTypeCode, status,
    target_type: target, target_label: row.name,
    certificate_number: null, registry_program: null, vintage_year: row.vintage_year,
    // Item validity dates do not establish certificate issue or retirement dates.
    issue_date: null, retirement_date: null,
    quantity_tco2e: quantity(row.quantity_total_tco2e),
    quantity_available_tco2e: quantity(row.quantity_available_tco2e), unit: 'tCO₂e',
    verification_status: verification, verifier_name: null, verification_date: null,
    approval_status: approval, proof_document_status: proof,
    jurisdiction: row.jurisdiction_code, eligible_use: purpose, claim_purpose: purpose,
    double_counting_check: row.double_counting_status === 'clear' ? 'clear' :
      ['suspected', 'blocked', 'flagged'].includes(row.double_counting_status) ? 'flagged' : 'unknown',
    notes: row.description, created_at: row.created_at, updated_at: row.updated_at,
    is_test: row.is_test,
  };
}
