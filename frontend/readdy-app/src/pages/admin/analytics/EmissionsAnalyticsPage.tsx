import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '@/components/layout/AdminLayout';
import type { DimensionCode, ChartDataPoint, TrendDataPoint } from '@/types/analytics';
import {
  fetchAnalyticsEmissions,
  adaptToChartDataPoints,
  adaptToTrendDataPoints,
  type AnalyticsEmissionsResponse,
} from '@/services/analyticsService';

// ─── ISO Category key list ────────────────────────────────────────────────────
const ISO_CATEGORY_CODES = [
  'category_1', 'category_2', 'category_3',
  'category_4', 'category_5', 'category_6',
] as const;
type IsoCategoryCode = typeof ISO_CATEGORY_CODES[number];

// ─── Mock fallback data ───────────────────────────────────────────────────────
const MOCK_GHG_SCOPE_ITEMS = [
  { classification_code: 'scope_1', value_tco2e: 1240, percentage: 38 },
  { classification_code: 'scope_2', value_tco2e: 890,  percentage: 27 },
  { classification_code: 'scope_3', value_tco2e: 1150, percentage: 35 },
];

const MOCK_ISO_CATEGORY_ITEMS = [
  { classification_code: 'category_1', value_tco2e: 1240, percentage: 32 },
  { classification_code: 'category_2', value_tco2e: 890,  percentage: 23 },
  { classification_code: 'category_3', value_tco2e: 480,  percentage: 12 },
  { classification_code: 'category_4', value_tco2e: 750,  percentage: 19 },
  { classification_code: 'category_5', value_tco2e: 280,  percentage: 7  },
  { classification_code: 'category_6', value_tco2e: 220,  percentage: 6  },
];

const MOCK_TREND: TrendDataPoint[] = [
  { period: '2023-Q1', value: 820, dimension_label: 'Total' },
  { period: '2023-Q2', value: 780, dimension_label: 'Total' },
  { period: '2023-Q3', value: 850, dimension_label: 'Total' },
  { period: '2023-Q4', value: 830, dimension_label: 'Total' },
  { period: '2024-Q1', value: 760, dimension_label: 'Total' },
  { period: '2024-Q2', value: 720, dimension_label: 'Total' },
];

const MOCK_HOTSPOT: ChartDataPoint[] = [
  { label: '電力消耗 - 製造廠', value: 890, color: '#0d9488', percentage: 27 },
  { label: '柴油 - 物流車隊',   value: 480, color: '#14b8a6', percentage: 15 },
  { label: '天然氣 - 鍋爐',     value: 420, color: '#5eead4', percentage: 13 },
  { label: '採購鋼鐵',          value: 380, color: '#99f6e4', percentage: 12 },
  { label: '商務飛行',          value: 320, color: '#ccfbf1', percentage: 10 },
  { label: '廢水處理',          value: 280, color: '#f0fdf4', percentage: 9  },
  { label: '包裝材料',          value: 240, color: '#ecfdf5', percentage: 7  },
  { label: '員工通勤',          value: 200, color: '#d1fae5', percentage: 6  },
];

const DIMENSIONS: DimensionCode[] = ['ghg_scope', 'iso_category', 'department', 'hotspot'];

const ISO_CAT_COLORS: Record<IsoCategoryCode, string> = {
  category_1: '#0d9488',
  category_2: '#14b8a6',
  category_3: '#5eead4',
  category_4: '#99f6e4',
  category_5: '#2dd4bf',
  category_6: '#0f766e',
};

// ─── Animated Bar Chart ───────────────────────────────────────────────────────
function BarChart({ data, unit, animate = true }: { data: ChartDataPoint[]; unit: string; animate?: boolean }) {
  const [widths, setWidths] = useState<number[]>(data.map(() => 0));
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const animatedRef = useRef(false);

  useEffect(() => {
    animatedRef.current = false;
    setWidths(data.map(() => 0));
  }, [data]);

  useEffect(() => {
    if (!animate || animatedRef.current) return;
    animatedRef.current = true;
    const timer = setTimeout(() => {
      setWidths(data.map((item) => (item.value / maxVal) * 100));
    }, 80);
    return () => clearTimeout(timer);
  }, [data, maxVal, animate]);

  return (
    <div className="space-y-3">
      {data.map((item, idx) => (
        <div key={item.label} className="flex items-center gap-3">
          <div className="w-32 text-xs text-gray-600 text-right truncate flex-shrink-0">{item.label}</div>
          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
            <div
              className="h-full rounded-full flex items-center justify-end pr-2"
              style={{
                width: `${widths[idx] ?? 0}%`,
                backgroundColor: item.color ?? '#0d9488',
                transition: animate ? `width ${0.4 + idx * 0.06}s cubic-bezier(0.4,0,0.2,1)` : 'none',
              }}
            >
              {(widths[idx] ?? 0) > 15 && (
                <span className="text-[10px] text-white font-semibold whitespace-nowrap">{item.percentage}%</span>
              )}
            </div>
          </div>
          <div className="w-24 text-xs text-gray-500 text-right flex-shrink-0">
            {item.value.toLocaleString()} {unit}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Animated Trend Chart ─────────────────────────────────────────────────────
function TrendChart({ data, unit }: { data: TrendDataPoint[]; unit: string }) {
  const [heights, setHeights] = useState<number[]>(data.map(() => 0));
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const minVal = Math.min(...data.map((d) => d.value));
  const range = maxVal - minVal || 1;

  useEffect(() => {
    setHeights(data.map(() => 0));
    const timer = setTimeout(() => {
      setHeights(data.map((point) => ((point.value - minVal) / range) * 70 + 20));
    }, 100);
    return () => clearTimeout(timer);
  }, [data, minVal, range]);

  // Trend delta
  const delta = data.length >= 2
    ? (((data[data.length - 1].value - data[0].value) / data[0].value) * 100).toFixed(1)
    : null;
  const isDown = delta !== null && parseFloat(delta) < 0;

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 h-32">
        {data.map((point, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span
              className="text-[10px] text-gray-500 transition-opacity duration-500"
              style={{ opacity: heights[i] > 0 ? 1 : 0 }}
            >
              {point.value}
            </span>
            <div
              className="w-full bg-teal-500 rounded-t-sm"
              style={{
                height: `${heights[i]}%`,
                transition: `height ${0.5 + i * 0.07}s cubic-bezier(0.4,0,0.2,1)`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {data.map((point, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-gray-400 truncate">{point.period}</div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">{unit}</div>
        {delta !== null && (
          <div className={`flex items-center gap-1 text-xs font-medium ${isDown ? 'text-emerald-600' : 'text-rose-500'}`}>
            <i className={`${isDown ? 'ri-arrow-down-line' : 'ri-arrow-up-line'} w-3 h-3 flex items-center justify-center`}></i>
            <span>{Math.abs(parseFloat(delta))}% vs 起始期</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pulse Loader (simulates live computation) ────────────────────────────────
function PulseLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="relative w-12 h-12 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-teal-200 animate-ping opacity-60" />
        <div className="absolute inset-1 rounded-full border-2 border-teal-400 animate-ping opacity-40" style={{ animationDelay: '0.15s' }} />
        <i className="ri-bar-chart-2-line text-teal-600 text-xl w-5 h-5 flex items-center justify-center relative z-10"></i>
      </div>
      <div className="text-sm text-gray-500 animate-pulse">{label}</div>
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-1.5 h-6 bg-teal-400 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.1}s`, animationDuration: '0.8s' }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Data Source Badge ────────────────────────────────────────────────────────
function DataSourceBadge({ isReal }: { isReal: boolean }) {
  const { t } = useTranslation();
  if (isReal) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
        <i className="ri-checkbox-circle-fill w-3 h-3 flex items-center justify-center"></i>
        Real
      </span>
    );
  }
  return (
    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
      {t('analytics.mockLabel')}
    </span>
  );
}

// ─── GHG Scope View ───────────────────────────────────────────────────────────
interface GHGScopeViewProps {
  data: ChartDataPoint[];
  trendData: TrendDataPoint[];
  unit: string;
  isReal: boolean;
}

function GHGScopeView({ data, trendData, unit, isReal }: GHGScopeViewProps) {
  const { t } = useTranslation();
  const totalCo2e = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Distribution */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {t('analytics.charts.distributionTitle')} — {t('analytics.dimensions.ghg_scope')}
          </h3>
          <DataSourceBadge isReal={isReal} />
        </div>
        <div className="flex items-center gap-4 mb-4 p-3 bg-teal-50 rounded-lg">
          <div className="w-12 h-12 flex items-center justify-center bg-teal-100 rounded-full flex-shrink-0">
            <i className="ri-pie-chart-line text-teal-600 text-xl w-5 h-5 flex items-center justify-center"></i>
          </div>
          <div>
            <div className="text-xl font-bold text-teal-700">{totalCo2e.toLocaleString()}</div>
            <div className="text-xs text-teal-600">{unit}</div>
          </div>
        </div>
        <BarChart data={data} unit={unit} />
      </div>

      {/* Trend */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">{t('analytics.charts.trendTitle')}</h3>
          <DataSourceBadge isReal={isReal} />
        </div>
        <TrendChart data={trendData} unit={unit} />
      </div>
    </div>
  );
}

// ─── ISO Category View ────────────────────────────────────────────────────────
interface ISOCategoryViewProps {
  items: { classification_code: string; value_tco2e: number; percentage: number }[];
  unit: string;
  isReal: boolean;
}

function ISOCategoryView({ items, unit, isReal }: ISOCategoryViewProps) {
  const { t } = useTranslation();
  const totalValue = items.reduce((s, v) => s + v.value_tco2e, 0);
  const maxVal = Math.max(...items.map((v) => v.value_tco2e), 1);
  const [barWidths, setBarWidths] = useState<number[]>(items.map(() => 0));

  useEffect(() => {
    setBarWidths(items.map(() => 0));
    const timer = setTimeout(() => {
      setBarWidths(items.map((item) => (item.value_tco2e / maxVal) * 100));
    }, 100);
    return () => clearTimeout(timer);
  }, [items, maxVal]);

  const codeToKey = (code: string): string => code.replace('category_', 'cat');

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 px-4 py-3 bg-teal-50 border border-teal-200 rounded-lg">
        <i className="ri-information-line text-teal-600 w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0"></i>
        <p className="text-xs text-teal-700 leading-relaxed">
          {t('analytics.isoCategory.scopeVsIsoNote')}
        </p>
      </div>

      {isReal ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
          <i className="ri-checkbox-circle-fill text-emerald-600 text-sm flex-shrink-0"></i>
          <p className="text-xs text-emerald-700">{t('analytics.realDataConnected')}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <i className="ri-error-warning-line text-amber-500 text-sm flex-shrink-0"></i>
          <p className="text-xs text-amber-700">{t('analytics.mockDataNotice')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {t('analytics.charts.distributionTitle')} — {t('analytics.dimensions.iso_category')}
            </h3>
            <div className="flex items-center gap-2">
              <DataSourceBadge isReal={isReal} />
              <div className="flex items-center gap-1 px-2 py-1 bg-teal-50 rounded-lg">
                <span className="text-xs font-bold text-teal-700">{totalValue.toLocaleString()}</span>
                <span className="text-xs text-teal-500">{unit}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {items.map((item, idx) => {
              const catKey = codeToKey(item.classification_code);
              const catI18n = t(`analytics.isoCategory.categories.${catKey}`, { returnObjects: true }) as {
                label: string; name: string; subtitle: string;
              };
              const catNum = item.classification_code.replace('category_', '');
              const color = ISO_CAT_COLORS[item.classification_code as IsoCategoryCode] ?? '#0d9488';

              return (
                <div key={item.classification_code} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {catNum}
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-gray-800 block truncate">
                          {catI18n?.label ?? item.classification_code} — {catI18n?.name ?? ''}
                        </span>
                        <span className="text-[10px] text-gray-400 block truncate">{catI18n?.subtitle ?? ''}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <span className="text-xs font-semibold text-gray-700">{item.value_tco2e.toLocaleString()}</span>
                      <span className="text-[10px] text-gray-400 ml-1">{unit}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full rounded-full flex items-center justify-end pr-1.5"
                        style={{
                          width: `${barWidths[idx] ?? 0}%`,
                          backgroundColor: color,
                          transition: `width ${0.5 + idx * 0.07}s cubic-bezier(0.4,0,0.2,1)`,
                        }}
                      >
                        {(barWidths[idx] ?? 0) > 15 && (
                          <span className="text-[9px] text-white font-bold">{item.percentage}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <i className="ri-book-open-line text-gray-500 w-4 h-4 flex items-center justify-center"></i>
            <h4 className="text-xs font-semibold text-gray-700">{t('analytics.isoCategory.helperTitle')}</h4>
          </div>
          {ISO_CATEGORY_CODES.map((code) => {
            const catKey = codeToKey(code);
            const catI18n = t(`analytics.isoCategory.categories.${catKey}`, { returnObjects: true }) as {
              label: string; name: string; subtitle: string;
            };
            const catNum = code.replace('category_', '');
            const color = ISO_CAT_COLORS[code];
            return (
              <div key={code} className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold text-white flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: color }}
                >
                  {catNum}
                </span>
                <div>
                  <p className="text-xs font-medium text-gray-800">{catI18n?.label ?? code}</p>
                  <p className="text-[11px] text-gray-600 leading-snug">{catI18n?.name ?? ''}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{catI18n?.subtitle ?? ''}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Coming Soon Placeholder ──────────────────────────────────────────────────
function ComingSoonView({ dimension }: { dimension: DimensionCode }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
        <i className="ri-time-line w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0"></i>
        <div>
          <span className="font-medium text-gray-700">{t(`analytics.dimensions.${dimension}`)} — </span>
          <span>此維度尚未接入真實 API，待 Codex analytics-emissions 支援後啟用。</span>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {t('analytics.charts.distributionTitle')} — {t(`analytics.dimensions.${dimension}`)}
          </h3>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
            Mock · Coming Soon
          </span>
        </div>
        <BarChart data={MOCK_HOTSPOT} unit={t('analytics.unit')} />
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function EmissionsAnalyticsPage() {
  const { t } = useTranslation();
  const [activeDimension, setActiveDimension] = useState<DimensionCode>('ghg_scope');

  const [ghgScopeData, setGhgScopeData] = useState<AnalyticsEmissionsResponse | null>(null);
  const [isoCategoryData, setIsoCategoryData] = useState<AnalyticsEmissionsResponse | null>(null);
  const [ghgLoading, setGhgLoading] = useState(false);
  const [isoLoading, setIsoLoading] = useState(false);
  const [ghgIsReal, setGhgIsReal] = useState(false);
  const [isoIsReal, setIsoIsReal] = useState(false);

  // Simulated "computing" state for UX
  const [computing, setComputing] = useState(false);

  const getGhgLabel = useCallback((code: string): string => {
    return t(`analytics.ghgScope.${code}`, code);
  }, [t]);

  const getIsoCatLabel = useCallback((code: string): string => {
    const catKey = code.replace('category_', 'cat');
    const obj = t(`analytics.isoCategory.categories.${catKey}`, { returnObjects: true }) as { label?: string } | string;
    if (typeof obj === 'object' && obj?.label) return obj.label;
    return code;
  }, [t]);

  // Fetch GHG Scope
  useEffect(() => {
    if (activeDimension !== 'ghg_scope' || ghgScopeData !== null) return;
    setGhgLoading(true);
    setComputing(true);
    fetchAnalyticsEmissions({ dimension: 'ghg_scope' })
      .then((res) => {
        if (res) {
          setGhgScopeData(res);
          setGhgIsReal(!res.is_mock);
        }
      })
      .finally(() => {
        setGhgLoading(false);
        // Keep computing animation a bit longer for UX feel
        setTimeout(() => setComputing(false), 600);
      });
  }, [activeDimension, ghgScopeData]);

  // Fetch ISO Category
  useEffect(() => {
    if (activeDimension !== 'iso_category' || isoCategoryData !== null) return;
    setIsoLoading(true);
    setComputing(true);
    fetchAnalyticsEmissions({ dimension: 'iso_category' })
      .then((res) => {
        if (res) {
          setIsoCategoryData(res);
          setIsoIsReal(!res.is_mock);
        }
      })
      .finally(() => {
        setIsoLoading(false);
        setTimeout(() => setComputing(false), 600);
      });
  }, [activeDimension, isoCategoryData]);

  // Simulate computing animation when switching dimensions
  const handleDimensionChange = (dim: DimensionCode) => {
    if (dim === activeDimension) return;
    setComputing(true);
    setTimeout(() => {
      setActiveDimension(dim);
      setComputing(false);
    }, 500);
  };

  const ghgChartData = useMemo((): ChartDataPoint[] => {
    if (ghgScopeData?.items?.length) {
      return adaptToChartDataPoints(ghgScopeData.items, 'ghg_scope', getGhgLabel);
    }
    return MOCK_GHG_SCOPE_ITEMS.map((item) => ({
      label: getGhgLabel(item.classification_code),
      value: item.value_tco2e,
      percentage: item.percentage,
      color: { scope_1: '#0d9488', scope_2: '#14b8a6', scope_3: '#5eead4' }[item.classification_code] ?? '#0d9488',
    }));
  }, [ghgScopeData, getGhgLabel]);

  const isoCategoryItems = useMemo(() => {
    if (isoCategoryData?.items?.length) return isoCategoryData.items;
    return MOCK_ISO_CATEGORY_ITEMS;
  }, [isoCategoryData]);

  const trendData = useMemo((): TrendDataPoint[] => {
    const src = ghgScopeData?.trend ?? isoCategoryData?.trend;
    if (src?.length) return adaptToTrendDataPoints(src);
    return MOCK_TREND;
  }, [ghgScopeData, isoCategoryData]);

  const isIsoCategory = activeDimension === 'iso_category';
  const isGhgScope = activeDimension === 'ghg_scope';
  const isLoading = (ghgLoading && isGhgScope) || (isoLoading && isIsoCategory) || computing;

  // Summary stats for header cards
  const totalEmissions = isGhgScope
    ? ghgChartData.reduce((s, d) => s + d.value, 0)
    : isoCategoryItems.reduce((s, d) => s + d.value_tco2e, 0);

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('analytics.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('analytics.subtitle')}</p>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-xs text-teal-700 font-medium">
              {isLoading ? '運算中...' : '資料就緒'}
            </span>
          </div>
        </div>

        {/* Summary cards */}
        {(isGhgScope || isIsoCategory) && !isLoading && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">總排放量</div>
              <div className="text-xl font-bold text-gray-900">{totalEmissions.toLocaleString()}</div>
              <div className="text-xs text-gray-400">{t('analytics.unit')}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">資料來源</div>
              <div className="flex items-center gap-2 mt-1">
                {(isGhgScope ? ghgIsReal : isoIsReal) ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium text-emerald-700">真實資料</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-sm font-medium text-amber-700">Mock 資料</span>
                  </>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">analytics-emissions API</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">分析維度</div>
              <div className="text-sm font-medium text-gray-900 mt-1">{t(`analytics.dimensions.${activeDimension}`)}</div>
              <div className="text-xs text-gray-400 mt-0.5">{isGhgScope ? 'GHG Protocol' : 'ISO 14064-1'}</div>
            </div>
          </div>
        )}

        {/* Dimension selector */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <i className="ri-filter-3-line text-gray-500 w-4 h-4 flex items-center justify-center"></i>
            <span className="text-sm font-medium text-gray-700">{t('analytics.dimensionSelector')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {DIMENSIONS.map((dim) => {
              const isConnected = dim === 'ghg_scope' || dim === 'iso_category';
              return (
                <button
                  key={dim}
                  onClick={() => handleDimensionChange(dim)}
                  className={`px-4 py-2 text-sm rounded-lg cursor-pointer whitespace-nowrap transition-all duration-200 flex items-center gap-2 ${
                    activeDimension === dim
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t(`analytics.dimensions.${dim}`)}
                  {!isConnected && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      activeDimension === dim ? 'bg-teal-500 text-teal-100' : 'bg-gray-200 text-gray-500'
                    }`}>
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200">
            <PulseLoader label="正在聚合排放資料..." />
          </div>
        ) : isIsoCategory ? (
          <ISOCategoryView
            items={isoCategoryItems}
            unit={t('analytics.unit')}
            isReal={isoIsReal}
          />
        ) : isGhgScope ? (
          <GHGScopeView
            data={ghgChartData}
            trendData={trendData}
            unit={t('analytics.unit')}
            isReal={ghgIsReal}
          />
        ) : (
          <ComingSoonView dimension={activeDimension} />
        )}

        {/* Hotspot Top 10 — only shown for GHG/ISO views, clearly labeled as mock */}
        {(isGhgScope || isIsoCategory) && !isLoading && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">{t('analytics.charts.hotspotTitle')}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                  {t('analytics.mockLabel')} · 待 Codex hotspot API
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              熱點分析尚未接入真實 API，以下為示範資料。待 Codex 提供 <code className="bg-gray-100 px-1 rounded">analytics-emissions?dimension=hotspot</code> 後替換。
            </p>
            <BarChart data={MOCK_HOTSPOT} unit={t('analytics.unit')} />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
