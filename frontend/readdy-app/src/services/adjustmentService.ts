/**
 * Adjustment Service — read path adapter
 * Connects to Codex `adjustment-rule-result` edge function.
 * Also reads real Supabase tables: carbon_adjustment_items, adjustment_certificates, adjustment_applications.
 */

import { getSupabaseClient } from '@/lib/supabase';
import { EdgeFunctionService } from './edgeFunction';
import type { RuleResultDTO } from '@/types/carbonAdjustment';

// ─── Codex canonical response shape ──────────────────────────────────────────
export interface AdjustmentRuleResultResponse {
  results: RuleResultDTO[];
  rule_engine_version: string | null;
  evaluated_at: string | null;
  is_mock: boolean;
  rule_engine_applied: boolean;
}

// ─── Gross Emissions from calculation_results ─────────────────────────────────
export interface GrossEmissionsResult {
  gross_tco2e: number;
  activity_count: number;
  project_id: string | null;
  is_real: boolean;
}

export async function fetchGrossEmissions(params: {
  project_id?: string;
  org_id?: string;
}): Promise<GrossEmissionsResult | null> {
  try {
    const supabase = getSupabaseClient();

    let query = supabase
      .from('calculation_results')
      .select('co2e_kg, project_id, emission_activity_id')
      .eq('is_latest', true)
      .eq('status', 'success');

    if (params.project_id) {
      query = query.eq('project_id', params.project_id);
    }
    if (params.org_id) {
      query = query.eq('organization_id', params.org_id);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return null;
    }

    const totalKg = data.reduce((sum, row) => sum + (Number(row.co2e_kg) || 0), 0);
    const gross_tco2e = Math.round(totalKg / 1000 * 100) / 100;

    return {
      gross_tco2e,
      activity_count: data.length,
      project_id: params.project_id ?? null,
      is_real: true,
    };
  } catch {
    return null;
  }
}

// ─── Rule Result ──────────────────────────────────────────────────────────────
export interface FetchRuleResultParams {
  adjustment_id?: string;
  project_id?: string;
  org_id?: string;
}

export async function fetchAdjustmentRuleResults(
  params: FetchRuleResultParams
): Promise<AdjustmentRuleResultResponse | null> {
  const response = await EdgeFunctionService.invoke<AdjustmentRuleResultResponse>({
    functionName: 'adjustment-rule-result',
    payload: { ...params },
  });

  if (!response.success || !response.data) {
    return null;
  }

  return response.data;
}

// ─── Real DB: carbon_adjustment_items ─────────────────────────────────────────
export interface AdjustmentItemRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  adjustment_type: string;
  name: string;
  description: string | null;
  claim_purpose: string;
  quantity_total_tco2e: number;
  quantity_available_tco2e: number;
  quantity_reserved_tco2e: number;
  quantity_consumed_tco2e: number;
  usage_lock_status: string;
  target_type: string;
  target_id: string | null;
  jurisdiction_code: string;
  vintage_year: number | null;
  effective_from: string | null;
  effective_to: string | null;
  certificate_verification_status: string;
  approval_status: string;
  double_counting_status: string;
  proof_document_status: string;
  status: string;
  metadata: Record<string, unknown>;
  is_test: boolean;
  env: string;
  created_at: string;
  updated_at: string;
}

export interface AdjustmentCertificateRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  carbon_adjustment_item_id: string;
  program: string;
  registry: string | null;
  certificate_number: string;
  serial_number: string | null;
  vintage_year: number | null;
  issue_date: string | null;
  retirement_date: string | null;
  retired_quantity_tco2e: number;
  retired_quantity_available_tco2e: number;
  quantity_reserved_tco2e: number;
  quantity_consumed_tco2e: number;
  usage_lock_status: string;
  verification_status: string;
  approval_status: string;
  double_counting_check_status: string;
  proof_attachment_bucket: string | null;
  proof_attachment_path: string | null;
  proof_attachment_hash: string | null;
  metadata: Record<string, unknown>;
  is_test: boolean;
  env: string;
  created_at: string;
  updated_at: string;
}

export interface AdjustmentApplicationRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  report_generation_id: string | null;
  adjustment_item_id: string;
  certificate_id: string | null;
  claim_purpose: string;
  requested_quantity_tco2e: number;
  eligible_quantity_tco2e: number;
  disallowed_quantity_tco2e: number;
  disallow_reasons: string[];
  inventory_impact_mode: string;
  status: string;
  submitted_by_user_id: string | null;
  approved_by_user_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  applied_at: string | null;
  metadata: Record<string, unknown>;
  is_test: boolean;
  env: string;
  created_at: string;
  updated_at: string;
}

export interface FetchAdjustmentItemsResult {
  items: AdjustmentItemRow[];
  isReal: boolean;
}

export interface FetchCertificatesResult {
  certificates: AdjustmentCertificateRow[];
  isReal: boolean;
}

export interface FetchApplicationsResult {
  applications: AdjustmentApplicationRow[];
  isReal: boolean;
}

export async function fetchAdjustmentItems(params: {
  project_id?: string;
  org_id?: string;
}): Promise<FetchAdjustmentItemsResult> {
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('carbon_adjustment_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (params.project_id) {
      query = query.eq('project_id', params.project_id);
    }
    if (params.org_id) {
      query = query.eq('organization_id', params.org_id);
    }

    const { data, error } = await query;
    if (error || !data) return { items: [], isReal: false };
    return { items: data as AdjustmentItemRow[], isReal: data.length > 0 };
  } catch {
    return { items: [], isReal: false };
  }
}

export async function fetchAdjustmentCertificates(params: {
  project_id?: string;
  org_id?: string;
}): Promise<FetchCertificatesResult> {
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('adjustment_certificates')
      .select('*')
      .order('created_at', { ascending: false });

    if (params.project_id) {
      query = query.eq('project_id', params.project_id);
    }
    if (params.org_id) {
      query = query.eq('organization_id', params.org_id);
    }

    const { data, error } = await query;
    if (error || !data) return { certificates: [], isReal: false };
    return { certificates: data as AdjustmentCertificateRow[], isReal: data.length > 0 };
  } catch {
    return { certificates: [], isReal: false };
  }
}

export async function fetchAdjustmentApplications(params: {
  project_id?: string;
  org_id?: string;
}): Promise<FetchApplicationsResult> {
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('adjustment_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (params.project_id) {
      query = query.eq('project_id', params.project_id);
    }
    if (params.org_id) {
      query = query.eq('organization_id', params.org_id);
    }

    const { data, error } = await query;
    if (error || !data) return { applications: [], isReal: false };
    return { applications: data as AdjustmentApplicationRow[], isReal: data.length > 0 };
  } catch {
    return { applications: [], isReal: false };
  }
}
