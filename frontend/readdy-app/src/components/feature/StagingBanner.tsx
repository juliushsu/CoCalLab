import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface StagingBannerProps {
  dismissible?: boolean;
}

/**
 * StagingBanner
 *
 * 固定高度 h-8（32px），永不換行，永不影響下方 layout 位移。
 * - mobile (< sm)   : 僅顯示 ⚠ TEST MODE badge，節省橫向空間
 * - tablet (sm~lg)  : 顯示縮短版說明文字
 * - desktop (≥ lg)  : 顯示完整說明文字
 */
export default function StagingBanner({ dismissible = false }: StagingBannerProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="h-8 overflow-hidden bg-amber-500 text-amber-950 text-xs font-bold tracking-widest flex items-center justify-center gap-2 px-4 select-none whitespace-nowrap">
      <i className="ri-test-tube-line text-sm w-4 h-4 flex items-center justify-center flex-shrink-0"></i>

      {/* desktop: full text */}
      <span className="hidden lg:inline uppercase truncate">
        {t('staging.banner_label', '⚠ STAGING ENVIRONMENT — 測試環境，資料不進入正式系統')}
      </span>

      {/* tablet: shorter text */}
      <span className="hidden sm:inline lg:hidden uppercase truncate">
        ⚠ STAGING ENVIRONMENT
      </span>

      {/* mobile: minimal */}
      <span className="sm:hidden uppercase">⚠ STAGING</span>

      <span className="px-1.5 py-0.5 bg-amber-950/20 rounded text-amber-900 font-extrabold text-[10px] tracking-widest flex-shrink-0">
        {t('staging.test_mode_badge', 'TEST MODE')}
      </span>

      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="ml-1 p-0.5 hover:bg-amber-600/30 rounded cursor-pointer flex-shrink-0"
          aria-label="dismiss staging banner"
        >
          <i className="ri-close-line text-sm w-4 h-4 flex items-center justify-center"></i>
        </button>
      )}
    </div>
  );
}
