import { serveWithCors } from '../_shared/cors.ts';
import {
  parseJson,
  successEnvelope,
  toErrorEnvelope,
  methodNotAllowed,
  errorEnvelope,
} from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import { validateGenerateReportInput } from '../../../src/contracts/contracts.js';
import { build_report_payload } from '../../../src/services/build-report-payload.js';
import { enforce_subscription_readonly } from '../../../src/services/enforce-subscription-readonly.js';
import { AuthzError, requireOrganizationWriteAccess } from '../_shared/authz.ts';
import { externalActionsBlockedInCurrentEnv } from '../_shared/staging-guard.ts';
import { insertActionLog } from '../_shared/action-log.ts';

const DEFAULT_CLAIM_PURPOSE = 'internal_management';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toNumber(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function round10(value: number): number {
  return Number(value.toFixed(10));
}

serveWithCors(async (request: Request) => {
  if (request.method !== 'POST') {
    return methodNotAllowed(request);
  }

  try {
    const input = validateGenerateReportInput(await parseJson(request));
    const supabase = createServiceRoleClient();
    const actor = await requireOrganizationWriteAccess(request, supabase, input.organization_id);

    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', input.organization_id)
      .order('period_end', { ascending: false });
    if (subError) throw subError;

    const enforcement = enforce_subscription_readonly({
      organization_id: input.organization_id,
      subscriptions: subscriptions || [],
    });

    if (!enforcement.can_generate_report) {
      return errorEnvelope(request, {
        code: 'SUBSCRIPTION_REPORT_BLOCKED',
        message: 'Subscription does not allow report generation',
        reason: enforcement.reason,
      }, {
        status: 'readonly',
        reason: enforcement.reason,
        requestId: input.request_id,
        httpStatus: 403,
      });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', input.project_id)
      .eq('organization_id', input.organization_id)
      .single();
    if (projectError) {
      return toErrorEnvelope(request, projectError, {
        code: 'PROJECT_NOT_FOUND',
        httpStatus: 404,
        requestId: input.request_id,
      });
    }

    if(input.request_id){
      const prior=await supabase.rpc('report_snapshot_request_v2',{p_organization_id:input.organization_id,p_project_id:input.project_id,p_actor_user_id:actor.user_id,p_request_id:input.request_id,p_report_version:input.report_version,p_claim_purpose:input.claim_purpose||DEFAULT_CLAIM_PURPOSE});
      if(prior.error)return toErrorEnvelope(request,new Error(prior.error.message||'Report request lookup failed'),{code:prior.error.message?.match(/REPORT_SNAPSHOT_(?:UNVERIFIED|INTEGRITY_MISMATCH)/)?.[0]||'REPORT_REQUEST_CONFLICT',httpStatus:prior.error.code==='42501'?403:409,requestId:input.request_id});
      const saved=Array.isArray(prior.data)?prior.data[0]:prior.data;
if(saved){if(saved.status!=='completed')throw new Error('REPORT_SAVE_NOT_CONFIRMED');return successEnvelope(request,{report_generation_id:saved.id,status:saved.status,claim_purpose:saved.claim_purpose,integrity_status:saved.integrity_status,gross_emissions_snapshot:saved.gross_emissions_snapshot,adjustment_summary:saved.adjustment_summary,claim_results:saved.claim_results,adjustment_manifest:saved.adjustment_manifest,legal_entity_snapshot:saved.legal_entity_snapshot,site_snapshot:saved.site_snapshot,boundary_snapshot:saved.boundary_snapshot,payload:saved.payload,warning_count:saved.warning_count},{status:saved.status,warnings:saved.payload?.data_gaps_and_warnings||[],requestId:input.request_id});}
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from('organizations')
      .select('id, slug, legal_name, display_name, tax_id, country_code, timezone')
      .eq('id', input.organization_id)
      .single();
    if (workspaceError) throw workspaceError;

    let legalEntity = null;
    if (project.legal_entity_id) {
      const { data, error } = await supabase
        .from('legal_entities')
        .select('id, workspace_id, entity_code, registered_name, display_name, tax_id, country_code, registration_address, industry_code, status')
        .eq('id', project.legal_entity_id)
        .eq('workspace_id', input.organization_id)
        .single();
      if (error) throw error;
      legalEntity = data;
    }

    let site = null;
    if (project.site_id) {
      const { data, error } = await supabase
        .from('sites')
        .select('id, workspace_id, legal_entity_id, site_code, site_name, facility_type, address, country_code, timezone, cbam_installation_ref, status')
        .eq('id', project.site_id)
        .eq('workspace_id', input.organization_id)
        .single();
      if (error) throw error;
      site = data;
    }

    // SQL checks the latest completed calculation authority and full current inputs/results.
    // Writable public rows alone are never accepted as report calculation evidence.
    const source=await supabase.rpc('report_calculation_inputs',{p_organization_id:input.organization_id,p_project_id:input.project_id,p_actor_user_id:actor.user_id});
    if(source.error)return toErrorEnvelope(request,new Error(source.error.message),{code:source.error.message?.match(/(?:CALCULATION_AUTHORITY|REPORT_SOURCE)_[A-Z_]+/)?.[0]||'REPORT_SOURCE_INVALID',httpStatus:source.error.code==='42501'?403:409,requestId:input.request_id});
    const trusted=(Array.isArray(source.data)?source.data[0]:source.data)?.result;
    if(!trusted||!Array.isArray(trusted.activities)||!Array.isArray(trusted.calculation_results)||!Array.isArray(trusted.factors)||!trusted.calculation_authority||typeof trusted.calculation_authority.request_id!=='string'||!trusted.calculation_authority.request_id)throw new Error('CALCULATION_AUTHORITY_REQUIRED');
    const activities=trusted.activities,calcResults=trusted.calculation_results;

    const payload = build_report_payload({
      project,
      workspace,
      legal_entity: legalEntity,
      site,
      activities: activities || [],
      calculation_results: calcResults || [],
    });

    const claimPurpose = input.claim_purpose || DEFAULT_CLAIM_PURPOSE;
    const grossTotalKg = Object.values(payload.scope_totals || {}).reduce((sum, value) => sum + toNumber(value), 0);

    const { data: adjustmentRows, error: adjustmentError } = await supabase
      .from('adjustment_applications')
      .select('id, project_id, adjustment_item_id, certificate_id, claim_purpose, requested_quantity_tco2e, eligible_quantity_tco2e, disallowed_quantity_tco2e, disallow_reasons, inventory_impact_mode, status, metadata, created_at')
      .eq('organization_id', input.organization_id)
      .eq('claim_purpose', claimPurpose)
      .in('status', ['approved', 'applied'])
      .or(`project_id.is.null,project_id.eq.${input.project_id}`)
      .order('created_at', { ascending: false });
    if (adjustmentError) throw adjustmentError;

    const requestedTotalTco2e = (adjustmentRows || []).reduce(
      (sum, row) => sum + toNumber(row.requested_quantity_tco2e),
      0,
    );
    const eligibleTotalTco2e = (adjustmentRows || []).reduce(
      (sum, row) => sum + toNumber(row.eligible_quantity_tco2e),
      0,
    );
    const disallowedTotalTco2e = (adjustmentRows || []).reduce(
      (sum, row) => sum + toNumber(row.disallowed_quantity_tco2e),
      0,
    );

    const impactModes = Array.from(new Set((adjustmentRows || [])
      .map((row) => String(row.inventory_impact_mode || 'claim_only'))));

    const grossEmissionsSnapshot = {
      gross_total_co2e_kg: round10(grossTotalKg),
      scope_totals: payload.scope_totals,
      category_totals: payload.category_totals,
    };

    const adjustmentSummary = {
      claim_purpose: claimPurpose,
      application_count: (adjustmentRows || []).length,
      requested_total_tco2e: round10(requestedTotalTco2e),
      eligible_total_tco2e: round10(eligibleTotalTco2e),
      disallowed_total_tco2e: round10(disallowedTotalTco2e),
    };

    const eligibleDeductionKg = eligibleTotalTco2e * 1000;
    const claimResults = {
      claim_purpose: claimPurpose,
      inventory_impact_mode: impactModes.length <= 1 ? (impactModes[0] || 'claim_only') : 'mixed',
      gross_co2e_kg: round10(grossTotalKg),
      eligible_deduction_tco2e: round10(eligibleTotalTco2e),
      eligible_deduction_kg: round10(eligibleDeductionKg),
      claim_net_co2e_kg: round10(Math.max(grossTotalKg - eligibleDeductionKg, 0)),
    };

    const adjustmentManifest = (adjustmentRows || []).map((row) => ({
      adjustment_application_id: row.id,
      project_id: row.project_id,
      adjustment_item_id: row.adjustment_item_id,
      certificate_id: row.certificate_id,
      claim_purpose: row.claim_purpose,
      status: row.status,
      requested_quantity_tco2e: round10(toNumber(row.requested_quantity_tco2e)),
      eligible_quantity_tco2e: round10(toNumber(row.eligible_quantity_tco2e)),
      disallowed_quantity_tco2e: round10(toNumber(row.disallowed_quantity_tco2e)),
      disallow_reasons: row.disallow_reasons || [],
      inventory_impact_mode: row.inventory_impact_mode || 'claim_only',
      metadata: row.metadata || {},
      created_at: row.created_at,
    }));

    const payloadHash = await sha256Hex(JSON.stringify(payload));

    const { data: rpcRows, error: rpcError } = await supabase.rpc('generate_report_snapshot_atomic_v2', {
      p_organization_id: input.organization_id,
      p_project_id: input.project_id,
      p_generated_by_user_id: actor.user_id,
      p_report_version: input.report_version,
      p_payload: payload,
      p_payload_hash: payloadHash,
      p_reporting_period_start: project.reporting_start_date,
      p_reporting_period_end: project.reporting_end_date,
      p_included_activity_count: payload.boundary_summary.included_count,
      p_excluded_activity_count: payload.boundary_summary.excluded_count,
      p_pending_activity_count: payload.boundary_summary.pending_count,
      p_scope_totals: payload.scope_totals,
      p_category_totals: payload.category_totals,
      p_factor_sources: payload.factor_sources_used,
      p_warning_count: payload.data_gaps_and_warnings.length,
      p_based_on_calculated_at: new Date().toISOString(),
      p_request_id: input.request_id || crypto.randomUUID(),
      p_snapshot: {calculation_authority:trusted.calculation_authority,claim_purpose:claimPurpose,gross_emissions_snapshot:grossEmissionsSnapshot,adjustment_summary:adjustmentSummary,claim_results:claimResults,adjustment_manifest:adjustmentManifest},
    });

    if (rpcError) {
      return toErrorEnvelope(request, rpcError, {
        code: rpcError.message?.match(/(?:REPORT_SNAPSHOT_(?:UNVERIFIED|INTEGRITY_MISMATCH)|CALCULATION_AUTHORITY_[A-Z_]+|REPORT_(?:SOURCE|CALCULATION_AUTHORITY)_[A-Z_]+)/)?.[0]||'GENERATE_REPORT_ATOMIC_FAILED',
        httpStatus: rpcError.code==='42501'?403:409,
        requestId: input.request_id,
      });
    }

    const rpcResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;

    const verified=await supabase.rpc('read_verified_report_snapshot',{p_organization_id:input.organization_id,p_project_id:input.project_id,p_actor_user_id:actor.user_id,p_report_id:rpcResult.report_generation_id});
    const savedReport=Array.isArray(verified.data)?verified.data[0]:verified.data,savedError=verified.error;
    if(savedError)return toErrorEnvelope(request,new Error(savedError.message||'Verified report read failed'),{code:savedError.message?.match(/REPORT_SNAPSHOT_(?:UNVERIFIED|INTEGRITY_MISMATCH)/)?.[0]||'REPORT_VERIFIED_READ_UNAVAILABLE',httpStatus:savedError.code==='42501'?403:409,requestId:input.request_id});
    if(!savedReport||savedReport.status!=='completed'||savedReport.integrity_status!=='server_verified')throw new Error('REPORT_SAVE_NOT_CONFIRMED');
    const savedWarnings=savedReport.payload?.data_gaps_and_warnings||[];
    const externalBlocked = externalActionsBlockedInCurrentEnv();

    await insertActionLog(supabase, {
      user_id: actor.user_id,
      organization_id: input.organization_id,
      project_id: input.project_id,
      action: 'generate-report',
      table_name: 'report_generations',
      record_id: String(rpcResult.report_generation_id),
      metadata: {
        request_id: input.request_id || null,
        report_version: input.report_version,
        warning_count: payload.data_gaps_and_warnings.length,
        claim_purpose: claimPurpose,
        adjustment_application_count: adjustmentManifest.length,
        external_actions_blocked: externalBlocked,
      },
    }).catch((logError) => {
      console.error('generate-report action log failed', logError);
    });

    return successEnvelope(request, {
      report_generation_id: savedReport.id,
      status: savedReport.status,
      integrity_status:savedReport.integrity_status,
      claim_purpose: savedReport.claim_purpose,
      gross_emissions_snapshot: savedReport.gross_emissions_snapshot,
      adjustment_summary: savedReport.adjustment_summary,
      claim_results: savedReport.claim_results,
      adjustment_manifest: savedReport.adjustment_manifest,
      legal_entity_snapshot: savedReport.legal_entity_snapshot,
      site_snapshot: savedReport.site_snapshot,
      boundary_snapshot: savedReport.boundary_snapshot,
      payload: savedReport.payload,
      warning_count: savedReport.warning_count,
    }, {
      status: savedReport.status,
      warnings: savedWarnings,
      requestId: input.request_id,
    });
  } catch (error) {
    if (error instanceof AuthzError) {
      return toErrorEnvelope(request, error, {
        code: error.code,
        httpStatus: error.httpStatus,
      });
    }

    return toErrorEnvelope(request, error, {
      code: 'GENERATE_REPORT_FAILED',
      httpStatus: 400,
    });
  }
}, { allowedMethods: ['POST'] });
