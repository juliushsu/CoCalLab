/**
 * DataOrigin DTO
 *
 * 預留 adapter 接入位，等 Codex 定義 schema 後替換。
 * 前端只使用 canonical code，UI 層用 mapping 顯示文字。
 */

/** 資料保護等級 */
export type DataProtectionLevel =
  | 'protected_seed'   // 示範資料，不可直接修改
  | 'user_test'        // 使用者測試資料，可正常 CRUD
  | 'fixture_generated' // 系統生成，可標示並可清理
  | 'production';      // 正式資料

/** 資料建立模式 */
export type DataCreatedByMode =
  | 'seed'
  | 'fixture'
  | 'test'
  | 'user'
  | 'system';

/** 環境標識 */
export type DataEnv = 'staging' | 'production';

/**
 * DataOriginMeta — 附加在任何資料 DTO 上的 origin 欄位
 * 等 Codex 定義 DB 欄位後，從 API response 直接 map 過來
 */
export interface DataOriginMeta {
  data_protection_level?: DataProtectionLevel;
  created_by_mode?: DataCreatedByMode;
  is_fixture?: boolean;
  is_seed?: boolean;
  is_test?: boolean;
  env?: DataEnv;
  /** 是否為本地模擬（未真正寫入後端） */
  is_local_only?: boolean;
}

/**
 * 從 DataOriginMeta 推導出 UI 顯示用的 badge 類型
 */
export type DataOriginBadgeType =
  | 'demo'        // 示範資料（protected_seed）
  | 'test'        // 測試資料（user_test / is_test）
  | 'fixture'     // 系統生成（fixture_generated / is_fixture）
  | 'readonly'    // 唯讀保護
  | 'clearable'   // 可清理
  | 'local_only'; // 僅本地模擬

/**
 * 從 meta 推導 badge type
 */
export function inferBadgeType(meta: DataOriginMeta): DataOriginBadgeType | null {
  if (meta.is_local_only) return 'local_only';
  if (meta.data_protection_level === 'protected_seed' || meta.is_seed) return 'demo';
  if (meta.data_protection_level === 'fixture_generated' || meta.is_fixture) return 'fixture';
  if (meta.data_protection_level === 'user_test' || meta.is_test) return 'test';
  return null;
}
