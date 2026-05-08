import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '@/components/layout/AdminLayout';
import type { EmissionFactorDTO, FactorStatus, FactorSourceType } from '@/types/emissionFactor';

// ─── Mock data (replace with Codex DTO adapter when available) ────────────────
const MOCK_FACTORS: EmissionFactorDTO[] = [
  {
    id: '1',
    factor_value: 0.4977,
    unit: 'kgCO2e/kWh',
    source_name: '台灣電力排放係數',
    source_code: 'TW_EPA_ELEC',
    version: '2023',
    published_date: '2023-12-01',
    effective_from: '2023-01-01',
    effective_to: '2023-12-31',
    last_checked: '2024-03-15',
    last_synced: '2024-03-15',
    status: 'active',
    is_org_override: false,
    scope: 'scope_2',
    category: '電力',
    region: 'TW',
    gas_type: 'CO2',
    notes: '台灣環保署公告電力排放係數',
  },
  {
    id: '2',
    factor_value: 2.68,
    unit: 'kgCO2e/L',
    source_name: 'IPCC AR6 柴油',
    source_code: 'IPCC_AR6_DIESEL',
    version: 'AR6',
    published_date: '2021-08-09',
    effective_from: '2022-01-01',
    effective_to: null,
    last_checked: '2024-01-10',
    last_synced: '2024-01-10',
    status: 'active',
    is_org_override: false,
    scope: 'scope_1',
    category: '移動燃燒',
    region: 'GLOBAL',
    gas_type: 'CO2',
    notes: 'IPCC 第六次評估報告柴油排放係數',
  },
  {
    id: '3',
    factor_value: 1.92,
    unit: 'kgCO2e/L',
    source_name: '自訂汽油係數（組織覆蓋）',
    source_code: 'ORG_GASOLINE_CUSTOM',
    version: '2024-Q1',
    published_date: '2024-01-01',
    effective_from: '2024-01-01',
    effective_to: null,
    last_checked: '2024-04-01',
    last_synced: '2024-04-01',
    status: 'active',
    is_org_override: true,
    scope: 'scope_1',
    category: '移動燃燒',
    region: 'TW',
    gas_type: 'CO2',
    notes: '組織自訂汽油排放係數，覆蓋全球預設值',
  },
  {
    id: '4',
    factor_value: 0.233,
    unit: 'kgCO2e/kWh',
    source_name: 'UK DEFRA 2022 電力',
    source_code: 'UK_DEFRA_ELEC_2022',
    version: '2022',
    published_date: '2022-06-01',
    effective_from: '2022-01-01',
    effective_to: '2022-12-31',
    last_checked: '2023-06-01',
    last_synced: '2023-06-01',
    status: 'stale',
    is_org_override: false,
    scope: 'scope_2',
    category: '電力',
    region: 'GB',
    gas_type: 'CO2',
    notes: '英國 DEFRA 2022 年電力排放係數，已有更新版本',
  },
  {
    id: '5',
    factor_value: 3.15,
    unit: 'kgCO2e/kg',
    source_name: 'ecoinvent 3.9 鋼鐵',
    source_code: 'ECOINVENT_39_STEEL',
    version: '3.9',
    published_date: '2023-09-01',
    effective_from: '2023-09-01',
    effective_to: null,
    last_checked: '2024-02-20',
    last_synced: '2024-02-20',
    status: 'active',
    is_org_override: false,
    scope: 'scope_3',
    category: '採購商品',
    region: 'GLOBAL',
    gas_type: 'CO2e',
    notes: 'ecoinvent 3.9 鋼鐵生產排放係數',
  },
  {
    id: '6',
    factor_value: 0.0,
    unit: 'kgCO2e/kWh',
    source_name: '舊版再生能源係數',
    source_code: 'TW_RE_OLD',
    version: '2019',
    published_date: '2019-01-01',
    effective_from: '2019-01-01',
    effective_to: '2021-12-31',
    last_checked: '2022-01-01',
    last_synced: '2022-01-01',
    status: 'deprecated',
    is_org_override: false,
    scope: 'scope_2',
    category: '電力',
    region: 'TW',
    gas_type: 'CO2',
    notes: '已棄用，請使用最新版本',
  },
];

const STATUS_COLORS: Record<FactorStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  stale: 'bg-amber-100 text-amber-700',
  deprecated: 'bg-red-100 text-red-700',
  pending_review: 'bg-sky-100 text-sky-700',
};

const STATUS_ICONS: Record<FactorStatus, string> = {
  active: 'ri-checkbox-circle-line',
  stale: 'ri-time-line',
  deprecated: 'ri-close-circle-line',
  pending_review: 'ri-eye-line',
};

export default function EmissionFactorsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FactorStatus | 'all'>('all');
  const [filterScope, setFilterScope] = useState<string>('all');
  const [selectedFactor, setSelectedFactor] = useState<EmissionFactorDTO | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = MOCK_FACTORS.filter((f) => {
    const matchSearch =
      !search ||
      f.source_name.toLowerCase().includes(search.toLowerCase()) ||
      f.source_code.toLowerCase().includes(search.toLowerCase()) ||
      (f.category ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || f.status === filterStatus;
    const matchScope = filterScope === 'all' || f.scope === filterScope;
    return matchSearch && matchStatus && matchScope;
  });

  const openDrawer = (factor: EmissionFactorDTO) => {
    setSelectedFactor(factor);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedFactor(null), 300);
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {t('emissionFactors.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t('emissionFactors.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
              <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
              {t('emissionFactors.syncNow')}
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
              <i className="ri-upload-2-line w-4 h-4 flex items-center justify-center"></i>
              {t('emissionFactors.importFactors')}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer whitespace-nowrap">
              <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
              {t('emissionFactors.addFactor')}
            </button>
          </div>
        </div>

        {/* Codex note */}
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <i className="ri-information-line w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0"></i>
          <span>{t('emissionFactors.codexNote')}</span>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 flex items-center justify-center"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('emissionFactors.searchPlaceholder')}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FactorStatus | 'all')}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="all">{t('emissionFactors.filterByStatus')}</option>
            {(['active', 'stale', 'deprecated', 'pending_review'] as FactorStatus[]).map((s) => (
              <option key={s} value={s}>{t(`emissionFactors.status.${s}`)}</option>
            ))}
          </select>
          <select
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="all">{t('emissionFactors.filterByScope')}</option>
            <option value="scope_1">{t('activities.scope.scope_1')}</option>
            <option value="scope_2">{t('activities.scope.scope_2')}</option>
            <option value="scope_3">{t('activities.scope.scope_3')}</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                    {t('emissionFactors.fields.sourceName')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                    {t('emissionFactors.fields.factorValue')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                    {t('emissionFactors.fields.version')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                    {t('emissionFactors.fields.scope')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                    {t('emissionFactors.fields.lastSynced')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                    {t('emissionFactors.fields.status')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                    {t('common.table_actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      <i className="ri-database-2-line text-3xl block mb-2"></i>
                      {t('emissionFactors.empty.title')}
                    </td>
                  </tr>
                ) : (
                  filtered.map((factor) => (
                    <tr key={factor.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium text-gray-900">{factor.source_name}</div>
                            <div className="text-xs text-gray-400 font-mono">{factor.source_code}</div>
                          </div>
                          {factor.is_org_override && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700 rounded whitespace-nowrap">
                              {t('emissionFactors.orgOverrideBadge')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-gray-900">{factor.factor_value}</span>
                        <span className="text-xs text-gray-400 ml-1">{factor.unit}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded font-mono">
                          {factor.version}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {factor.scope ? t(`activities.scope.${factor.scope}`) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {factor.last_synced ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_COLORS[factor.status]}`}>
                          <i className={`${STATUS_ICONS[factor.status]} w-3 h-3 flex items-center justify-center`}></i>
                          {t(`emissionFactors.status.${factor.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openDrawer(factor)}
                          className="text-teal-600 hover:text-teal-800 text-xs cursor-pointer whitespace-nowrap"
                        >
                          {t('emissionFactors.viewDetail')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {drawerOpen && selectedFactor && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={closeDrawer} />
          <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">{t('emissionFactors.drawerTitle')}</h2>
              <button onClick={closeDrawer} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer rounded-lg hover:bg-gray-100">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="flex-1 px-6 py-4 space-y-4">
              {/* Status + override badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full font-medium ${STATUS_COLORS[selectedFactor.status]}`}>
                  <i className={`${STATUS_ICONS[selectedFactor.status]} w-3 h-3 flex items-center justify-center`}></i>
                  {t(`emissionFactors.status.${selectedFactor.status}`)}
                </span>
                {selectedFactor.is_org_override && (
                  <span className="px-2.5 py-1 text-xs font-semibold bg-violet-100 text-violet-700 rounded-full">
                    {t('emissionFactors.orgOverrideBadge')}
                  </span>
                )}
              </div>

              {/* Core info */}
              <div className="space-y-3">
                {[
                  { label: t('emissionFactors.fields.sourceName'), value: selectedFactor.source_name },
                  { label: t('emissionFactors.fields.sourceCode'), value: selectedFactor.source_code, mono: true },
                  { label: t('emissionFactors.fields.factorValue'), value: `${selectedFactor.factor_value} ${selectedFactor.unit}`, mono: true },
                  { label: t('emissionFactors.fields.version'), value: selectedFactor.version, mono: true },
                  { label: t('emissionFactors.fields.scope'), value: selectedFactor.scope ? t(`activities.scope.${selectedFactor.scope}`) : '—' },
                  { label: t('emissionFactors.fields.category'), value: selectedFactor.category ?? '—' },
                  { label: t('emissionFactors.fields.region'), value: selectedFactor.region ?? '—' },
                  { label: t('emissionFactors.fields.gasType'), value: selectedFactor.gas_type ?? '—' },
                  { label: t('emissionFactors.fields.publishedDate'), value: selectedFactor.published_date ?? '—' },
                  { label: t('emissionFactors.fields.effectiveFrom'), value: selectedFactor.effective_from ?? '—' },
                  { label: t('emissionFactors.fields.effectiveTo'), value: selectedFactor.effective_to ?? '—' },
                  { label: t('emissionFactors.fields.lastChecked'), value: selectedFactor.last_checked ?? '—' },
                  { label: t('emissionFactors.fields.lastSynced'), value: selectedFactor.last_synced ?? '—' },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex justify-between items-start gap-4">
                    <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
                    <span className={`text-xs text-gray-900 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
                  </div>
                ))}
              </div>

              {selectedFactor.notes && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">{t('emissionFactors.fields.notes')}</p>
                  <p className="text-sm text-gray-700">{selectedFactor.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
