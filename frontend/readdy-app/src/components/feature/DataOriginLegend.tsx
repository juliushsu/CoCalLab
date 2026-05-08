import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IS_STAGING } from '@/utils/staging';

/**
 * DataOriginLegend
 *
 * 在 staging 環境下顯示資料標示說明面板。
 * 讓使用者清楚了解各種資料標記的意義與可執行的操作。
 */
export function DataOriginLegend() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (!IS_STAGING) return null;

  const items = [
    {
      icon: 'ri-shield-star-line',
      colorClass: 'text-violet-600 bg-violet-50',
      badgeClass: 'bg-violet-100 text-violet-700 border border-violet-200',
      label: t('dataOrigin.badges.demo'),
      desc: t('dataOrigin.legend.demo'),
    },
    {
      icon: 'ri-test-tube-line',
      colorClass: 'text-amber-600 bg-amber-50',
      badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
      label: t('dataOrigin.badges.test'),
      desc: t('dataOrigin.legend.test'),
    },
    {
      icon: 'ri-robot-line',
      colorClass: 'text-sky-600 bg-sky-50',
      badgeClass: 'bg-sky-100 text-sky-700 border border-sky-200',
      label: t('dataOrigin.badges.fixture'),
      desc: t('dataOrigin.legend.fixture'),
    },
    {
      icon: 'ri-computer-line',
      colorClass: 'text-orange-600 bg-orange-50',
      badgeClass: 'bg-orange-100 text-orange-700 border border-orange-200',
      label: t('dataOrigin.badges.local_only'),
      desc: t('dataOrigin.legend.local_only'),
    },
  ];

  return (
    <div className="border border-amber-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-information-line text-amber-600 text-sm"></i>
          </div>
          <span className="text-xs font-semibold text-amber-800">
            {t('dataOrigin.legend.title')}
          </span>
        </div>
        <div className="w-4 h-4 flex items-center justify-center">
          {expanded
            ? <i className="ri-arrow-up-s-line text-amber-600 text-sm"></i>
            : <i className="ri-arrow-down-s-line text-amber-600 text-sm"></i>
          }
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-start gap-2.5">
              <div className={`w-6 h-6 flex items-center justify-center rounded flex-shrink-0 ${item.colorClass}`}>
                <i className={`${item.icon} text-xs`}></i>
              </div>
              <div className="min-w-0">
                <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded ${item.badgeClass}`}>
                  {item.label}
                </span>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DataOriginLegend;
