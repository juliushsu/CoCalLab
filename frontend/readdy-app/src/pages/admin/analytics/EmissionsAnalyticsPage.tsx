import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '@/components/layout/AdminLayout';
import { getOrganizations } from '@/services/organizationService';
import { isSupabaseConnected } from '@/lib/supabase';
import { fetchAnalyticsEmissions, type AnalyticsEmissionsResponse } from '@/services/analyticsService';
import type { AnalyticsDimension } from '@/services/analyticsContract';
import type { Organization } from '@/types/organization';

export default function EmissionsAnalyticsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const organizationId = searchParams.get('organization_id') || searchParams.get('organizationId') || '';
  const projectId = searchParams.get('project_id') || undefined;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationError, setOrganizationError] = useState('');
  const [dimension, setDimension] = useState<AnalyticsDimension>('ghg_scope');
  const [result, setResult] = useState<{ key: string; data: AnalyticsEmissionsResponse } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const key = `${organizationId}/${projectId || ''}/${dimension}/${retry}`;
  const data = result?.key === key ? result.data : null;
  const error = failure?.key === key ? failure.message : '';
  const loading = Boolean(organizationId && !data && !error);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConnected()) {
      setOrganizationError('尚未設定服務連線，無法載入組織與分析資料。');
      return;
    }
    getOrganizations().then((rows) => { if (active) setOrganizations(rows); })
      .catch(() => { if (active) setOrganizationError('無法載入組織，請稍後重新整理。'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    fetchAnalyticsEmissions({ organization_id: organizationId, project_id: projectId, dimension })
      .then((response) => { if (active) setResult({ key, data: response }); })
      .catch((cause: unknown) => {
        if (active) setFailure({ key, message: cause instanceof Error ? cause.message : '無法載入分析資料。' });
      });
    return () => { active = false; };
  }, [organizationId, projectId, dimension, key]);

  const label = (code: string) => {
    if (dimension === 'ghg_scope') return t(`analytics.ghgScope.${code}`, code);
    const category = t(`analytics.isoCategory.categories.${code.replace('category_', 'cat')}`, { returnObjects: true });
    return typeof category === 'object' && category && 'label' in category ? String(category.label) : code;
  };
  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div><h1 className="text-2xl font-semibold text-gray-900">{t('analytics.title')}</h1><p className="text-sm text-gray-500 mt-1">{t('analytics.subtitle')}</p></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-4">
          <label className="text-sm text-gray-700">組織
            <select className="ml-2 border rounded p-2" value={organizationId} onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              next.delete('organizationId'); next.delete('project_id');
              if (event.target.value) next.set('organization_id', event.target.value);
              else next.delete('organization_id');
              setSearchParams(next);
            }}>
              <option value="">請選擇組織</option>
              {organizationId && !organizations.some(org => org.id === organizationId) && <option value={organizationId}>目前指定的組織</option>}
              {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-gray-700">{t('analytics.dimensionSelector')}
            <select className="ml-2 border rounded p-2" value={dimension} onChange={(event) => setDimension(event.target.value as AnalyticsDimension)}>
              <option value="ghg_scope">{t('analytics.dimensions.ghg_scope')}</option>
              <option value="iso_category">{t('analytics.dimensions.iso_category')}</option>
            </select>
          </label>
        </div>
        {organizationError && <div role="alert" className="p-4 bg-red-50 text-red-800 rounded-xl">{organizationError}</div>}
        {!organizationId ? <p className="p-6 bg-white rounded-xl">請先選擇組織，以載入該組織的排放分析。</p>
          : error ? <div role="alert" className="p-6 bg-red-50 text-red-800 rounded-xl"><p>分析資料載入失敗：{error}</p><button className="mt-3 underline" onClick={() => setRetry(value => value + 1)}>重試</button></div>
          : loading ? <p role="status" className="p-6 bg-white rounded-xl">正在載入排放資料...</p>
          : data && <>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500">總排放量（tCO₂e）{projectId ? ' · 目前專案' : ' · 組織全部專案'}</p>
              <p className="text-2xl font-semibold text-teal-700">{data.total_tco2e.toLocaleString(undefined, { maximumFractionDigits: 6 })}</p>
              <p className="text-xs text-gray-500 mt-2">資料來源：已納入且有效的活動與最新計算結果。零值不代表所有活動均已完成計算。</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 overflow-x-auto">
              <h2 className="text-base font-semibold mb-4">{t('analytics.charts.distributionTitle')}</h2>
              {data.items.length === 0 ? <p>目前沒有可顯示的分析資料。</p> : <table className="w-full text-sm">
                <thead><tr className="text-left border-b"><th className="py-2">分類</th><th>排放量（tCO₂e）</th><th>占比</th></tr></thead>
                <tbody>{data.items.map(item => <tr key={item.classification_code} className="border-b">
                  <td className="py-3">{label(item.classification_code)}</td>
                  <td>{item.value_tco2e.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                  <td><span>{item.percentage.toFixed(1)}%</span><div aria-hidden="true" className="h-2 bg-teal-100 mt-1 rounded"><div className="h-2 bg-teal-600 rounded" style={{ width: `${item.percentage}%` }} /></div></td>
                </tr>)}</tbody>
              </table>}
            </div>
            <p className="text-sm text-gray-500">趨勢與熱點分析尚未提供，完成後才會顯示。</p>
          </>}
      </div>
    </AdminLayout>
  );
}
