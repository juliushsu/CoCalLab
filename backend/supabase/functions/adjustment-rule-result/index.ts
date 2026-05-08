import {
  methodNotAllowed,
  successEnvelope,
  toErrorEnvelope,
} from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import { AuthzError, requireOrganizationReadAccess } from '../_shared/authz.ts';

const CLAIM_PURPOSES = new Set([
  'taiwan_carbon_fee',
  'voluntary_claim',
  'ifrs_s2_note',
  'esg_note',
  'internal_management',
]);

Deno.serve(async (request: Request) => {
  if (request.method !== 'GET') {
    return methodNotAllowed(request);
  }

  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organization_id');
    const projectId = url.searchParams.get('project_id');
    const adjustmentItemId = url.searchParams.get('adjustment_item_id');
    const reportGenerationId = url.searchParams.get('report_generation_id');
    const claimPurpose = url.searchParams.get('claim_purpose');
    const requestedQuantity = Number(url.searchParams.get('requested_quantity_tco2e') || '0');
    const requestId = url.searchParams.get('request_id') || undefined;

    if (!organizationId) throw new Error('organization_id is required');
    if (!adjustmentItemId) throw new Error('adjustment_item_id is required');
    if (!claimPurpose || !CLAIM_PURPOSES.has(claimPurpose)) {
      throw new Error('claim_purpose is invalid');
    }
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      throw new Error('requested_quantity_tco2e must be > 0');
    }

    const supabase = createServiceRoleClient();
    await requireOrganizationReadAccess(request, supabase, organizationId);

    const { data: rows, error } = await supabase.rpc('evaluate_adjustment_eligibility', {
      p_organization_id: organizationId,
      p_project_id: projectId,
      p_adjustment_item_id: adjustmentItemId,
      p_claim_purpose: claimPurpose,
      p_requested_quantity_tco2e: requestedQuantity,
      p_report_generation_id: reportGenerationId,
    });

    if (error) {
      return toErrorEnvelope(request, error, {
        code: 'ADJUSTMENT_RULE_EVAL_FAILED',
        httpStatus: 400,
        requestId,
      });
    }

    const result = Array.isArray(rows) ? rows[0] : rows;

    return successEnvelope(request, {
      organization_id: organizationId,
      project_id: projectId,
      adjustment_item_id: adjustmentItemId,
      report_generation_id: reportGenerationId,
      claim_purpose: result?.claim_purpose || claimPurpose,
      requested: Number(result?.requested || requestedQuantity),
      eligible: Number(result?.eligible || 0),
      disallowed: Number(result?.disallowed || requestedQuantity),
      disallow_reasons: result?.disallow_reasons || [],
      inventory_impact_mode: result?.inventory_impact_mode || 'claim_only',
    }, {
      status: 'completed',
      warnings: result?.disallow_reasons || [],
      requestId,
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return toErrorEnvelope(request, error, {
        code: error.code,
        httpStatus: error.httpStatus,
      });
    }

    return toErrorEnvelope(request, error, {
      code: 'ADJUSTMENT_RULE_REQUEST_INVALID',
      httpStatus: 400,
    });
  }
});
