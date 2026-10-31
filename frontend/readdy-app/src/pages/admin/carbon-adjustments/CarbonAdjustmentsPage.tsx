import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '@/components/layout/AdminLayout';
import { getOrganizations } from '@/services/organizationService';
import { getProjects } from '@/services/projectService';
import { isSupabaseConnected } from '@/lib/supabase';
import type { Organization } from '@/types/organization';
import type { Project } from '@/types/project';
import type { CarbonAdjustmentDTO } from '@/types/carbonAdjustment';
import {
  fetchAdjustmentItems, fetchAdjustmentCertificates, fetchAdjustmentApplications, fetchGrossEmissions,
  type AdjustmentItemRow, type AdjustmentCertificateRow, type AdjustmentApplicationRow,
} from '@/services/adjustmentService';
import AdjustmentDetailDrawer from './components/AdjustmentDetailDrawer';
import ItemsTab from './components/ItemsTab';
import RuleResultTab from './components/RuleResultTab';
import { mapAdjustmentItem } from '@/services/adjustmentItemAdapter';

type TabKey = 'items' | 'certificates' | 'applications' | 'ruleResult';

export default function CarbonAdjustmentsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || undefined;
  const orgId = searchParams.get('organizationId') || undefined;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [scopeLoading, setScopeLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('items');
  const [selectedAdjustment, setSelectedAdjustment] = useState<CarbonAdjustmentDTO | null>(null);
  const [items, setItems] = useState<AdjustmentItemRow[]>([]);
  const [certificates, setCertificates] = useState<AdjustmentCertificateRow[]>([]);
  const [applications, setApplications] = useState<AdjustmentApplicationRow[]>([]);
  const [gross, setGross] = useState<number | null>(null);
  const scopeKey = `${orgId || ''}:${projectId || ''}`;
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!isSupabaseConnected()) {
      setScopeError('尚未連接資料服務，請聯絡管理員。'); setScopeLoading(false); return;
    }
    Promise.all([getOrganizations(), getProjects()]).then(([orgs, projectRows]) => {
      if (active) { setOrganizations(orgs); setProjects(projectRows); }
    }).catch(() => { if (active) setScopeError('組織與專案載入失敗。'); })
      .finally(() => { if (active) setScopeLoading(false); });
    return () => { active = false; };
  }, []);
  const selectedOrg = organizations.find((org) => org.id === orgId);
  const selectedProject = projects.find((project) => project.id === projectId && project.organization_id === orgId);
  const validScope = Boolean(selectedOrg && (!projectId || selectedProject));
  useEffect(() => {
    let active = true;
    setLoadedScope(null);
    setItems([]); setCertificates([]); setApplications([]); setGross(null); setSelectedAdjustment(null); setError(null);
    if (!validScope || !orgId) { setLoading(false); return; }
    setLoading(true);
    const params = { project_id: projectId, org_id: orgId };
    Promise.all([fetchAdjustmentItems(params), fetchAdjustmentCertificates(params), fetchAdjustmentApplications(params), fetchGrossEmissions(params)])
      .then(([itemResult, certificateResult, applicationResult, grossResult]) => {
        if (!active) return;
        itemResult.items.forEach(mapAdjustmentItem);
        setItems(itemResult.items); setCertificates(certificateResult.certificates);
        setApplications(applicationResult.applications); setGross(grossResult?.gross_tco2e ?? null);
        setLoadedScope(scopeKey);
      }).catch(() => { if (active) setError('調整資料載入失敗，請稍後再試。'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, orgId, validScope, scopeKey]);
  const adjustments = useMemo(() => items.map(mapAdjustmentItem), [items]);
  const tabs: { key: TabKey; count?: number }[] = [
    { key: 'items', count: items.length }, { key: 'certificates', count: certificates.length },
    { key: 'applications', count: applications.length }, { key: 'ruleResult' },
  ];
  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        <div><h1 className="text-2xl font-bold text-gray-900">{t('carbonAdjustments.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('carbonAdjustments.subtitle')}</p></div>
        <div className="flex flex-wrap gap-4 rounded-xl border bg-white p-4">
          <label className="text-sm">組織
            <select aria-label="組織" value={orgId || ''} className="ml-2 rounded border p-2" onChange={(event) => {
              const next = new URLSearchParams(searchParams); next.delete('projectId');
              if (event.target.value) next.set('organizationId', event.target.value); else next.delete('organizationId');
              setSearchParams(next);
            }}><option value="">請選擇組織</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.display_name || org.legal_name}</option>)}</select>
          </label>
          <label className="text-sm">專案
            <select aria-label="專案" disabled={!selectedOrg} value={projectId || ''} className="ml-2 rounded border p-2" onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              if (event.target.value) next.set('projectId', event.target.value); else next.delete('projectId');
              setSearchParams(next);
            }}><option value="">所有專案</option>{projects.filter((project) => project.organization_id === orgId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
          </label>
        </div>
        {scopeLoading && <p role="status">{t('common.loading')}</p>}
        {scopeError && <p role="alert" className="text-red-700">{scopeError}</p>}
        {orgId && !scopeLoading && !validScope && <p role="alert">無法存取所選組織或專案，請重新選擇。</p>}
        {!orgId && <p className="rounded-xl border bg-amber-50 p-4">請先從組織或專案選擇頁面進入。</p>}
        {error && <p role="alert" className="rounded-xl border bg-red-50 p-4 text-red-700">{error}</p>}
        {loading && <p role="status">{t('common.loading')}</p>}
        {validScope && loadedScope === scopeKey && !loading && !error && <>
          <div className="rounded-xl border bg-white p-5">
            <p className="text-sm text-gray-500">{t('carbonAdjustments.summary.grossEmissions')}</p>
            <p className="mt-2 text-2xl font-bold">{gross === null ? '—' : gross.toLocaleString()} <span className="text-sm font-normal">tCO₂e</span></p>
            <p className="mt-2 text-sm text-gray-500">資格試算不代表已核准扣抵；此處不推算可宣稱淨排放量。</p>
          </div>
          <div className="rounded-2xl border bg-white overflow-hidden">
            <div className="flex border-b overflow-x-auto">
              {tabs.map((tab) => <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-4 whitespace-nowrap text-sm ${activeTab === tab.key ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-500' : 'text-gray-500'}`}>
                {t(`carbonAdjustments.tabs.${tab.key}`)}{tab.count === undefined ? '' : ` (${tab.count})`}
              </button>)}
            </div>
            <div className="p-5">
              {activeTab === 'items' && <ItemsTab adjustments={adjustments} onSelect={setSelectedAdjustment} isReal />}
              {activeTab === 'certificates' && (certificates.length === 0 ? <p>尚無憑證資料。</p> :
                <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b">
                  <th className="p-3">憑證編號</th><th className="p-3">核證計畫</th><th className="p-3">可用量 tCO₂e</th><th className="p-3">審核狀態</th>
                </tr></thead><tbody>{certificates.map((row) => <tr key={row.id} className="border-b">
                  <td className="p-3">{row.certificate_number}</td><td className="p-3">{row.program}</td>
                  <td className="p-3">{Number(row.retired_quantity_available_tco2e).toLocaleString()}</td>
                  <td className="p-3">{t(`carbonAdjustments.approvalStatus.${row.approval_status}`, { defaultValue: '待確認' })}</td>
                </tr>)}</tbody></table></div>)}
              {activeTab === 'applications' && (applications.length === 0 ? <p>尚無申請資料。</p> :
                <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b">
                  <th className="p-3">申請用途</th><th className="p-3">申請量 tCO₂e</th><th className="p-3">合格量 tCO₂e</th><th className="p-3">狀態</th>
                </tr></thead><tbody>{applications.map((row) => <tr key={row.id} className="border-b">
                  <td className="p-3">{t(`carbonAdjustments.claimPurpose.${row.claim_purpose}`, { defaultValue: '待確認用途' })}</td>
                  <td className="p-3">{Number(row.requested_quantity_tco2e).toLocaleString()}</td><td className="p-3">{Number(row.eligible_quantity_tco2e).toLocaleString()}</td>
                  <td className="p-3">{t(`carbonAdjustments.applicationStatus.${row.status}`, { defaultValue: '待確認' })}</td>
                </tr>)}</tbody></table></div>)}
              {activeTab === 'ruleResult' && <RuleResultTab adjustments={adjustments} projectId={projectId} orgId={orgId} />}
            </div>
          </div>
        </>}
      </div>
      {loadedScope === scopeKey && selectedAdjustment && <AdjustmentDetailDrawer adjustment={selectedAdjustment} onClose={() => setSelectedAdjustment(null)} />}
    </AdminLayout>
  );
}
