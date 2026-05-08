/**
 * Staging Environment Utilities
 *
 * 控制封測 UI 的開關邏輯。
 * 部署規則：
 *   - Staging / Dev 環境：VITE_APP_ENV 未設定 或 設為 "staging"  → IS_STAGING = true
 *   - Production 環境：VITE_APP_ENV=production                  → IS_STAGING = false
 *
 * Codex 端只需在 production 部署時設定 VITE_APP_ENV=production 即可關閉所有封測 UI。
 */
export const IS_STAGING: boolean =
  (import.meta.env.VITE_APP_ENV ?? 'staging') !== 'production';

/**
 * 僅在封測環境下替資料名稱加上 [TEST] 前綴。
 * Production 環境原樣回傳，不影響正式業務規則。
 */
export const withTestPrefix = (name: string): string =>
  IS_STAGING ? `[TEST] ${name.trim()}` : name.trim();

/**
 * 取得 is_test flag（封測環境為 true）
 */
export const getIsTest = (): boolean => IS_STAGING;

/**
 * 取得環境標識字串
 */
export const getEnv = (): string =>
  IS_STAGING ? 'staging' : 'production';
