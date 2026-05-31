import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import type { ApiResponse, EdgeFunctionOptions } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readResponseBody(response: Response): Promise<unknown> {
  const clone = response.clone();
  try {
    return await clone.json();
  } catch {
    try {
      return await response.clone().text();
    } catch {
      return null;
    }
  }
}

async function extractFunctionErrorDetails(functionName: string, error: unknown): Promise<Record<string, unknown>> {
  const details: Record<string, unknown> = { functionName };
  if (!isRecord(error)) return details;

  if (typeof error.name === 'string') details.originalErrorName = error.name;
  if (typeof error.message === 'string') details.originalErrorMessage = error.message;

  const context = error.context;
  if (context instanceof Response) {
    details.httpStatus = context.status;
    const responseBody = await readResponseBody(context);

    if (isRecord(responseBody)) {
      const backendError = responseBody.error;
      const meta = responseBody.meta;
      if (isRecord(backendError)) {
        if (typeof backendError.code === 'string') details.backendCode = backendError.code;
        if (typeof backendError.message === 'string') details.backendMessage = backendError.message;
      }
      if (isRecord(meta) && typeof meta.request_id === 'string') {
        details.requestId = meta.request_id;
      }
    } else if (typeof responseBody === 'string') {
      details.responseText = responseBody.slice(0, 500);
    }
  }

  return details;
}

/**
 * Edge Function Service Layer
 * 統一處理所有 Edge Function 呼叫
 */
export class EdgeFunctionService {
  /**
   * 呼叫 Edge Function
   */
  static async invoke<T = unknown>(
    options: EdgeFunctionOptions
  ): Promise<ApiResponse<T>> {
    const { functionName, payload = {}, headers = {} } = options;

    // 檢查 Supabase 連接狀態
    if (!isSupabaseConnected()) {
      return {
        success: false,
        error: {
          code: 'SUPABASE_NOT_CONNECTED',
          message: 'Supabase is not connected. Please configure environment variables.',
        },
      };
    }

    try {
      const supabase = getSupabaseClient();

      // 呼叫 Edge Function
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });

      // 處理 Edge Function 錯誤
      if (error) {
        const details = await extractFunctionErrorDetails(functionName, error);
        const backendCode = typeof details.backendCode === 'string' ? details.backendCode : undefined;
        const backendMessage = typeof details.backendMessage === 'string' ? details.backendMessage : undefined;
        const requestId = typeof details.requestId === 'string' ? details.requestId : undefined;
        const httpStatus = typeof details.httpStatus === 'number' ? details.httpStatus : undefined;

        console.error('[EdgeFunctionService] Edge Function invocation failed', {
          functionName,
          httpStatus,
          backendCode,
          backendMessage,
          requestId,
        });

        return {
          success: false,
          error: {
            code: backendCode || error.name || 'EDGE_FUNCTION_ERROR',
            message: backendMessage || error.message || 'Edge Function invocation failed',
            details,
          },
          meta: requestId ? { request_id: requestId } : undefined,
        };
      }

      // 解析 response envelope
      return this.parseResponse<T>(data);
    } catch (err) {
      // 處理未預期錯誤
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'An unexpected error occurred',
          details: { originalError: err },
        },
      };
    }
  }

  /**
   * 解析 Edge Function response
   * 確保符合統一 envelope 格式
   */
  private static parseResponse<T>(data: unknown): ApiResponse<T> {
    // 如果已經是正確的 envelope 格式
    if (
      data &&
      typeof data === 'object' &&
      'success' in data &&
      typeof (data as ApiResponse).success === 'boolean'
    ) {
      return data as ApiResponse<T>;
    }

    // 如果是原始資料，包裝成 envelope
    return {
      success: true,
      data: data as T,
    };
  }
}
