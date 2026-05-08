import {
  parseJson,
  successEnvelope,
  toErrorEnvelope,
  methodNotAllowed,
} from '../_shared/http.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import { validateEnforceSubscriptionInput } from '../../../src/contracts/contracts.js';
import { enforce_subscription_readonly } from '../../../src/services/enforce-subscription-readonly.js';

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return methodNotAllowed(request);
  }

  try {
    const input = validateEnforceSubscriptionInput(await parseJson(request));
    const supabase = createServiceRoleClient();

    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', input.organization_id)
      .order('period_end', { ascending: false });

    if (subError) throw subError;

    const enforcement = enforce_subscription_readonly({
      organization_id: input.organization_id,
      subscriptions: subscriptions || [],
      as_of: input.as_of,
    });

    const latest = subscriptions?.[0];
    if (latest && latest.status !== enforcement.effective_status) {
      const patch: Record<string, unknown> = {
        status: enforcement.effective_status,
      };

      if (enforcement.effective_status === 'readonly') {
        patch.readonly_from = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update(patch)
        .eq('id', latest.id);

      if (updateError) throw updateError;
    }

    const { error: auditError } = await supabase.from('audit_logs').insert({
      organization_id: input.organization_id,
      actor_type: 'edge_function',
      action: 'enforce_subscription_status',
      entity_type: 'subscription',
      entity_id: latest?.id || null,
      status: 'recorded',
      after_state: {
        effective_status: enforcement.effective_status,
        can_write_formal_data: enforcement.can_write_formal_data,
        can_generate_report: enforcement.can_generate_report,
      },
      metadata: {
        request_id: input.request_id || null,
      },
    });

    if (auditError) throw auditError;

    return successEnvelope(request, enforcement, {
      status: enforcement.effective_status,
      reason: enforcement.reason,
      requestId: input.request_id,
    });
  } catch (error) {
    return toErrorEnvelope(request, error, {
      code: 'ENFORCE_SUBSCRIPTION_STATUS_FAILED',
      httpStatus: 400,
    });
  }
});
