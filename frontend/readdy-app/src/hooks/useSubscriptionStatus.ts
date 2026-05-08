import { useState, useEffect } from 'react';
import { EdgeFunctionService } from '../services/edgeFunction';
import { getSubscriptionStatus, isReadonly, getReadonlyReason } from '../utils/subscription';
import type { SubscriptionStatus } from '../utils/subscription';
import type { ApiMeta } from '../services/types';

/**
 * 訂閱狀態 Hook 返回值
 */
interface UseSubscriptionStatusReturn {
  status: SubscriptionStatus;
  isReadonly: boolean;
  reason?: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 訂閱狀態 Hook
 * 用於檢查當前組織或專案的訂閱狀態
 */
export function useSubscriptionStatus(
  organizationId?: string
): UseSubscriptionStatusReturn {
  const [status, setStatus] = useState<SubscriptionStatus>('active');
  const [reason, setReason] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!organizationId) {
      setStatus('active');
      setReason(undefined);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 呼叫 enforce-subscription-status Edge Function
      const response = await EdgeFunctionService.invoke<{ meta: ApiMeta }>({
        functionName: 'enforce-subscription-status',
        payload: { organization_id: organizationId },
      });

      if (response.success && response.meta) {
        const newStatus = getSubscriptionStatus(response.meta);
        const newReason = getReadonlyReason(response.meta);
        
        setStatus(newStatus);
        setReason(newReason);
      } else {
        // Edge Function 回傳錯誤，預設為 active 避免誤鎖
        console.warn('enforce-subscription-status returned error:', response.error);
        setError(response.error?.message || '無法取得訂閱狀態');
        setStatus('active');
      }
    } catch (err) {
      // Edge Function 不存在或網路錯誤，預設為 active 避免誤鎖
      console.warn('Failed to fetch subscription status (Edge Function may not exist):', err);
      setError(err instanceof Error ? err.message : '發生未知錯誤');
      setStatus('active');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [organizationId]);

  return {
    status,
    isReadonly: isReadonly(status),
    reason,
    loading,
    error,
    refresh: fetchStatus,
  };
}