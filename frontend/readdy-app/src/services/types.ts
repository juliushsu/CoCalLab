/**
 * 統一 API Response Envelope
 * 依照 Codex contract 定義
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

/**
 * API 錯誤結構
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * API Meta 資訊
 */
export interface ApiMeta {
  status?: 'active' | 'readonly' | 'suspended' | 'expired';
  reason?: string;
  warnings?: ApiWarning[];
  timestamp?: string;
  request_id?: string;
}

/**
 * API 警告結構
 */
export interface ApiWarning {
  code: string;
  message: string;
  field?: string;
  severity?: 'low' | 'medium' | 'high';
}

/**
 * Edge Function 呼叫選項
 */
export interface EdgeFunctionOptions {
  functionName: string;
  payload?: Record<string, unknown>;
  headers?: Record<string, string>;
}
