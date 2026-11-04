import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EdgeFunctionService } from '../services/edgeFunction';
import { getSubscriptionStatus, isReadonly, getReadonlyReason, verifiedSubscriptionStatus } from '../utils/subscription';
import type { SubscriptionStatus } from '../utils/subscription';
import { createSubscriptionFence } from '../services/subscriptionFence';
import type { ApiMeta } from '../services/types';

interface Options { failClosed?: boolean; scopeKey?: unknown }
interface Result { status: SubscriptionStatus; reason?: string; error: string | null }
/** Presentation only. Every write still requires server-side permission checks. */
export function useSubscriptionStatus(organizationId?: string, options: Options = {}) {
  const {failClosed = false, scopeKey} = options;
  const scope = useMemo(() => ({organizationId, scopeKey, failClosed}), [organizationId, scopeKey, failClosed]);
  const fence = useRef(createSubscriptionFence<typeof scope>()).current;
  fence.select(scope);
  const [result, setResult] = useState<{scope: typeof scope; value: Result} | null>(null);
  const [pending, setPending] = useState<typeof scope | null>(null);
  const fetchStatus = useCallback(async () => {
    const current = fence.begin(scope);
    if (!current) return;
    if (!organizationId) {
      if (current()) setResult({scope, value: {status: failClosed ? 'readonly' : 'active', error: null}});
      return;
    }
    setPending(scope);
    try {
      const response = await EdgeFunctionService.invoke<{meta: ApiMeta}>({
        functionName: 'enforce-subscription-status', payload: {organization_id: organizationId},
      });
      if (!response.success || !response.meta) {
        throw new Error(response.error?.message || '無法取得訂閱狀態');
      }
      if (current()) setResult({scope, value: {status: failClosed ? verifiedSubscriptionStatus(response.meta) : getSubscriptionStatus(response.meta), reason: getReadonlyReason(response.meta), error: null}});
    } catch (cause) {
      if (current()) setResult({scope, value: {status: failClosed ? 'readonly' : 'active', error: cause instanceof Error ? cause.message : '無法取得訂閱狀態'}});
    } finally {
      if (current()) setPending(null);
    }
  }, [scope, organizationId, failClosed, fence]);
  const cancel = useCallback(() => fence.cancel(scope), [fence, scope]);
  useEffect(() => {
    fence.select(scope);
    void fetchStatus();
    return cancel;
  }, [fetchStatus, cancel, fence, scope]);
  const value = result?.scope === scope ? result.value : {status: failClosed ? 'readonly' as const : 'active' as const, error: null};
  return {...value, isReadonly: isReadonly(value.status), loading: Boolean(organizationId) && (result?.scope !== scope || pending === scope), refresh: fetchStatus};
}
