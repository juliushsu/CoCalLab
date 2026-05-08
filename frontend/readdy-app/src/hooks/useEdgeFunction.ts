import { useState, useCallback } from 'react';
import { EdgeFunctionService } from '../services/edgeFunction';
import type { ApiResponse, EdgeFunctionOptions } from '../services/types';

/**
 * Edge Function Hook 狀態
 */
interface UseEdgeFunctionState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  meta: ApiResponse<T>['meta'];
}

/**
 * Edge Function Hook 返回值
 */
interface UseEdgeFunctionReturn<T> extends UseEdgeFunctionState<T> {
  invoke: (payload?: Record<string, unknown>) => Promise<ApiResponse<T>>;
  reset: () => void;
}

/**
 * Edge Function Hook
 * 提供統一的 Edge Function 呼叫介面
 */
export function useEdgeFunction<T = unknown>(
  functionName: string
): UseEdgeFunctionReturn<T> {
  const [state, setState] = useState<UseEdgeFunctionState<T>>({
    data: null,
    loading: false,
    error: null,
    meta: undefined,
  });

  const invoke = useCallback(
    async (payload?: Record<string, unknown>): Promise<ApiResponse<T>> => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const options: EdgeFunctionOptions = {
        functionName,
        payload,
      };

      const response = await EdgeFunctionService.invoke<T>(options);

      setState({
        data: response.data || null,
        loading: false,
        error: response.error?.message || null,
        meta: response.meta,
      });

      return response;
    },
    [functionName]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      meta: undefined,
    });
  }, []);

  return {
    ...state,
    invoke,
    reset,
  };
}