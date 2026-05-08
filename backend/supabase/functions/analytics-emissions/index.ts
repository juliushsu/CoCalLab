import {
  methodNotAllowed,
  successEnvelope,
  toErrorEnvelope,
} from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import { AuthzError, requireOrganizationReadAccess } from '../_shared/authz.ts';

const DIMENSIONS = new Set(['ghg_scope', 'iso_category']);

Deno.serve(async (request: Request) => {
  if (request.method !== 'GET') {
    return methodNotAllowed(request);
  }

  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organization_id');
    const projectId = url.searchParams.get('project_id');
    const dimension = url.searchParams.get('dimension');
    const requestId = url.searchParams.get('request_id') || undefined;

    if (!organizationId) {
      throw new Error('organization_id is required');
    }

    if (!dimension || !DIMENSIONS.has(dimension)) {
      throw new Error('dimension must be ghg_scope or iso_category');
    }

    const supabase = createServiceRoleClient();
    await requireOrganizationReadAccess(request, supabase, organizationId);

    const { data: rows, error } = await supabase.rpc('get_emissions_analytics', {
      p_organization_id: organizationId,
      p_project_id: projectId,
      p_dimension: dimension,
    });

    if (error) {
      return toErrorEnvelope(request, error, {
        code: 'ANALYTICS_QUERY_FAILED',
        httpStatus: 400,
        requestId,
      });
    }

    const normalizedRows = (rows || []).map((row: Record<string, unknown>) => ({
      classification_system_code: row.classification_system_code,
      classification_code: row.classification_code,
      total_co2e_kg: Number(row.total_co2e_kg || 0),
      activity_count: Number(row.activity_count || 0),
    }));

    const total = normalizedRows.reduce((sum: number, row: { total_co2e_kg: number }) => sum + row.total_co2e_kg, 0);

    return successEnvelope(request, {
      organization_id: organizationId,
      project_id: projectId,
      dimension,
      rows: normalizedRows,
      total_co2e_kg: total,
    }, {
      status: 'completed',
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
      code: 'ANALYTICS_REQUEST_INVALID',
      httpStatus: 400,
    });
  }
});
