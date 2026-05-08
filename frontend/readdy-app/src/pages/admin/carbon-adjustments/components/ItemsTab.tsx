import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CarbonAdjustmentDTO, AdjustmentTypeCode, AdjustmentStatusCode } from '@/types/carbonAdjustment';

const TYPE_ICONS: Record<AdjustmentTypeCode, string> = {
  offset_credit: 'ri-leaf-line',
  renewable_electricity: 'ri-flashlight-line',
  carbon_removal: 'ri-recycle-line',
  carbon_storage: 'ri-archive-line',
};
const TYPE_COLORS: Record<AdjustmentTypeCode, string> = {
  offset_credit: 'bg-green-50 text-green-600',
  renewable_electricity: 'bg-yellow-50 text-yellow-600',
  carbon_removal: 'bg-teal-50 text-teal-600',
  carbon_storage: 'bg-slate-50 text-slate-600',
};

interface Props {
  adjustments: CarbonAdjustmentDTO[];
  onSelect: (adj: CarbonAdjustmentDTO) => void;
  isReal?: boolean;
}

export default function ItemsTab({ adjustments, onSelect, isReal = false }: Props) {
  const { t } = useTranslation();
  const [filterType, setFilterType] = useState<AdjustmentTypeCode | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<AdjustmentStatusCode | 'all'>('all');
  const [search, setSearch] = useState('');

  const allTypes: AdjustmentTypeCode[] = ['offset_credit', 'renewable_electricity', 'carbon_removal', 'carbon_storage'];
  const allStatuses: AdjustmentStatusCode[] = ['draft', 'pending_review', 'approved', 'rejected', 'expired'];

  const filtered = useMemo(() => adjustments.filter((a) => {
    if (filterType !== 'all' && a.adjustment_type !== filterType) return false;
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (a.certificate_number ?? '').toLowerCase().includes(q) ||
        (a.registry_program ?? '').toLowerCase().includes(q) ||
        (a.jurisdiction ?? '').toLowerCase().includes(q) ||
        (a.target_label ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [adjustments, filterType, filterStatus, search]);

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    pending_review: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    expired: 'bg-gray-100 text-gray-400',
  };

  return (
    <div className="space-y-4">
      {/* Block-level data origin banner */}
      {isReal ? (
        <div className="flex items-start gap-3 px-4 py-3 bg-green-50 rounded-xl border border-green-200">
          <i className="ri-checkbox-circle-fill text-green-500 text-base mt-0.5 flex-shrink-0"></i>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-green-800">真實資料 · 調整項目列表</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                Real · carbon_adjustment_items · canonical seed v2026.04.07
              </span>
            </div>
            <p className="text-xs text-green-600 mt-0.5">
              資料來自 Supabase <code className="font-mono bg-green-100 px-1 rounded">carbon_adjustment_items</code> table（stg_core_closed_beta seed）。
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
          <i className="ri-error-warning-line text-amber-500 text-base mt-0.5 flex-shrink-0"></i>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-amber-800">Fallback Mock · 調整項目列表</p>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                Mock · carbon_adjustment_items 篩選無結果
              </span>
            </div>
            <p className="text-xs text-amber-600 mt-0.5">
              DB table 已存在但目前篩選條件無資料，顯示 fixture fallback。請確認 org/project 參數是否正確。
            </p>
          </div>
        </div>
      )}

      {/* Gross immutable notice */}
      <div className="flex items-start gap-2 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
        <i className="ri-information-line text-gray-400 text-sm mt-0.5 flex-shrink-0"></i>
        <p className="text-xs text-gray-500">{t('carbonAdjustments.notices.grossImmutable')}</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('carbonAdjustments.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as AdjustmentTypeCode | 'all')}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none cursor-pointer"
        >
          <option value="all">{t('carbonAdjustments.filterByType')}</option>
          {allTypes.map((type) => (
            <option key={type} value={type}>{t(`carbonAdjustments.adjustmentTypes.${type}`)}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as AdjustmentStatusCode | 'all')}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none cursor-pointer"
        >
          <option value="all">{t('carbonAdjustments.filterByStatus')}</option>
          {allStatuses.map((s) => (
            <option key={s} value={s}>{t(`carbonAdjustments.status.${s}`)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">{t('carbonAdjustments.empty.title')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  t('carbonAdjustments.fields.adjustmentType'),
                  t('carbonAdjustments.fields.targetType'),
                  t('carbonAdjustments.fields.quantity'),
                  t('carbonAdjustments.fields.quantityAvailable'),
                  t('carbonAdjustments.fields.vintageYear'),
                  t('carbonAdjustments.fields.jurisdiction'),
                  t('carbonAdjustments.fields.approvalStatus'),
                  '',
                ].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap ${i >= 2 && i <= 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((adj) => (
                <tr key={adj.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => onSelect(adj)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[adj.adjustment_type]}`}>
                        <i className={`${TYPE_ICONS[adj.adjustment_type]} text-sm`}></i>
                      </div>
                      <span className="text-sm text-gray-700 whitespace-nowrap">{t(`carbonAdjustments.adjustmentTypes.${adj.adjustment_type}`)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-xs text-gray-400">{adj.target_type ? t(`carbonAdjustments.targetType.${adj.target_type}`) : '—'}</span>
                      {adj.target_label && <p className="text-xs text-gray-600 mt-0.5 truncate max-w-[140px]">{adj.target_label}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">{adj.quantity_tco2e.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-semibold whitespace-nowrap ${(adj.quantity_available_tco2e ?? 0) > 0 ? 'text-teal-700' : 'text-gray-300'}`}>
                      {adj.quantity_available_tco2e?.toLocaleString() ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm text-gray-600">{adj.vintage_year ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 whitespace-nowrap">{adj.jurisdiction ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {adj.approval_status ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[adj.approval_status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {t(`carbonAdjustments.approvalStatus.${adj.approval_status}`)}
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={(e) => { e.stopPropagation(); onSelect(adj); }} className="text-xs text-teal-600 hover:text-teal-800 font-medium whitespace-nowrap cursor-pointer">
                      {t('carbonAdjustments.viewDetail')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
