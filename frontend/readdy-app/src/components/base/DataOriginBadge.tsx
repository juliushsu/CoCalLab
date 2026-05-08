import { useTranslation } from 'react-i18next';
import type { DataOriginBadgeType } from '@/types/dataOrigin';

interface DataOriginBadgeProps {
  type: DataOriginBadgeType;
  /** 顯示為 inline 小 badge（預設）或 block banner */
  variant?: 'badge' | 'banner' | 'row-tag';
  /** 是否顯示 tooltip 說明 */
  showTooltip?: boolean;
  className?: string;
}

const BADGE_CONFIG: Record<
  DataOriginBadgeType,
  { icon: string; colorClass: string; bannerClass: string; rowTagClass: string }
> = {
  demo: {
    icon: 'ri-shield-star-line',
    colorClass: 'bg-violet-100 text-violet-700 border border-violet-200',
    bannerClass: 'bg-violet-50 border-violet-200 text-violet-800',
    rowTagClass: 'bg-violet-50 text-violet-600 border border-violet-200',
  },
  test: {
    icon: 'ri-test-tube-line',
    colorClass: 'bg-amber-100 text-amber-700 border border-amber-200',
    bannerClass: 'bg-amber-50 border-amber-200 text-amber-800',
    rowTagClass: 'bg-amber-50 text-amber-600 border border-amber-200',
  },
  fixture: {
    icon: 'ri-robot-line',
    colorClass: 'bg-sky-100 text-sky-700 border border-sky-200',
    bannerClass: 'bg-sky-50 border-sky-200 text-sky-800',
    rowTagClass: 'bg-sky-50 text-sky-600 border border-sky-200',
  },
  readonly: {
    icon: 'ri-lock-line',
    colorClass: 'bg-gray-100 text-gray-600 border border-gray-200',
    bannerClass: 'bg-gray-50 border-gray-200 text-gray-700',
    rowTagClass: 'bg-gray-50 text-gray-500 border border-gray-200',
  },
  clearable: {
    icon: 'ri-delete-bin-6-line',
    colorClass: 'bg-red-100 text-red-600 border border-red-200',
    bannerClass: 'bg-red-50 border-red-200 text-red-700',
    rowTagClass: 'bg-red-50 text-red-500 border border-red-200',
  },
  local_only: {
    icon: 'ri-computer-line',
    colorClass: 'bg-orange-100 text-orange-700 border border-orange-200',
    bannerClass: 'bg-orange-50 border-orange-200 text-orange-800',
    rowTagClass: 'bg-orange-50 text-orange-600 border border-orange-200',
  },
};

export function DataOriginBadge({
  type,
  variant = 'badge',
  showTooltip = false,
  className = '',
}: DataOriginBadgeProps) {
  const { t } = useTranslation();
  const config = BADGE_CONFIG[type];
  const label = t(`dataOrigin.badges.${type}`);
  const tooltip = showTooltip ? t(`dataOrigin.tooltips.${type}`) : undefined;

  if (variant === 'banner') {
    return (
      <div
        className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border ${config.bannerClass} ${className}`}
        title={tooltip}
      >
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
          <i className={`${config.icon} text-sm`}></i>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
          {showTooltip && (
            <p className="text-xs mt-0.5 opacity-80">{t(`dataOrigin.tooltips.${type}`)}</p>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'row-tag') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded ${config.rowTagClass} ${className}`}
        title={tooltip}
      >
        <i className={`${config.icon} text-[10px]`}></i>
        {label}
      </span>
    );
  }

  // default: badge
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${config.colorClass} ${className}`}
      title={tooltip}
    >
      <i className={`${config.icon} text-xs`}></i>
      {label}
    </span>
  );
}

export default DataOriginBadge;
