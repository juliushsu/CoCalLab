import type { ApiError, ApiWarning } from '../services/types';

/**
 * 錯誤處理工具
 */
export class ErrorHandler {
  /**
   * 格式化錯誤訊息
   */
  static formatError(error?: ApiError): string {
    if (!error) return '發生未知錯誤';
    
    // 根據錯誤代碼提供友善訊息
    const errorMessages: Record<string, string> = {
      SUPABASE_NOT_CONNECTED: 'Supabase 尚未連接，請聯絡系統管理員',
      EDGE_FUNCTION_ERROR: 'Edge Function 呼叫失敗',
      UNAUTHORIZED: '您沒有權限執行此操作',
      NOT_FOUND: '找不到指定的資源',
      VALIDATION_ERROR: '資料驗證失敗',
      SUBSCRIPTION_EXPIRED: '訂閱已過期，請續約',
      SUBSCRIPTION_SUSPENDED: '訂閱已暫停',
      UNEXPECTED_ERROR: '發生未預期的錯誤',
    };

    return errorMessages[error.code] || error.message || '發生錯誤';
  }

  /**
   * 格式化警告訊息
   */
  static formatWarning(warning: ApiWarning): string {
    return warning.message;
  }

  /**
   * 格式化多個警告
   */
  static formatWarnings(warnings?: ApiWarning[]): string[] {
    if (!warnings || warnings.length === 0) return [];
    return warnings.map(w => this.formatWarning(w));
  }

  /**
   * 取得錯誤嚴重程度
   */
  static getErrorSeverity(error?: ApiError): 'error' | 'warning' | 'info' {
    if (!error) return 'info';
    
    const criticalCodes = [
      'UNAUTHORIZED',
      'SUBSCRIPTION_EXPIRED',
      'SUBSCRIPTION_SUSPENDED',
    ];
    
    return criticalCodes.includes(error.code) ? 'error' : 'warning';
  }

  /**
   * 檢查是否為訂閱相關錯誤
   */
  static isSubscriptionError(error?: ApiError): boolean {
    if (!error) return false;
    return error.code.startsWith('SUBSCRIPTION_');
  }

  /**
   * 檢查是否為權限錯誤
   */
  static isAuthError(error?: ApiError): boolean {
    if (!error) return false;
    return ['UNAUTHORIZED', 'FORBIDDEN', 'UNAUTHENTICATED'].includes(error.code);
  }
}