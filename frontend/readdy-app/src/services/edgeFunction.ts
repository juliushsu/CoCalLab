import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import type { ApiResponse, EdgeFunctionOptions } from './types';

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
        return {
          success: false,
          error: {
            code: error.name || 'EDGE_FUNCTION_ERROR',
            message: error.message || 'Edge Function invocation failed',
            details: { originalError: error },
          },
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