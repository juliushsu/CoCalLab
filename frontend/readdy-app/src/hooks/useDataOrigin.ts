import { useMemo } from 'react';
import { IS_STAGING } from '@/utils/staging';
import type { DataOriginMeta, DataOriginBadgeType } from '@/types/dataOrigin';
import { inferBadgeType } from '@/types/dataOrigin';

/**
 * useDataOrigin
 *
 * 根據 DataOriginMeta 推導出 UI 顯示所需的狀態。
 * 等 Codex 定義 DB 欄位後，meta 直接從 API response 傳入。
 */
export function useDataOrigin(meta?: DataOriginMeta) {
  return useMemo(() => {
    if (!meta) {
      return {
        badgeType: null as DataOriginBadgeType | null,
        isProtectedSeed: false,
        isUserTest: false,
        isFixture: false,
        isLocalOnly: false,
        isReadonly: false,
        isClearable: false,
        canEdit: true,
        canDelete: true,
      };
    }

    const badgeType = inferBadgeType(meta);
    const isProtectedSeed =
      meta.data_protection_level === 'protected_seed' || !!meta.is_seed;
    const isUserTest =
      meta.data_protection_level === 'user_test' || (!!meta.is_test && !isProtectedSeed);
    const isFixture =
      meta.data_protection_level === 'fixture_generated' || !!meta.is_fixture;
    const isLocalOnly = !!meta.is_local_only;

    // protected seed 唯讀；fixture 在 staging 下可清理
    const isReadonly = isProtectedSeed;
    const isClearable = isFixture && IS_STAGING;

    return {
      badgeType,
      isProtectedSeed,
      isUserTest,
      isFixture,
      isLocalOnly,
      isReadonly,
      isClearable,
      canEdit: !isProtectedSeed && !isLocalOnly,
      canDelete: !isProtectedSeed,
    };
  }, [meta]);
}
