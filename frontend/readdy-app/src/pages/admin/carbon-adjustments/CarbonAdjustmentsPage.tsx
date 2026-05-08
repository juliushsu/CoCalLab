import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '@/components/layout/AdminLayout';
import type { AdjustmentTypeCode } from '@/types/carbonAdjustment';
import {
  mockCarbonAdjustments,
  mockEmissionsSummary,
  mockApplications,
  mockRuleResults,
} from '@/mocks/carbonAdjustments.fixture';
import {
  fetchAdjustmentItems,
  fetchAdjustmentCertificates,
  fetchAdjustmentApplications,
  type AdjustmentItemRow,
  type AdjustmentCertificateRow,
  type AdjustmentApplicationRow,
} from '@/services/adjustmentService';
import AdjustmentDetailDrawer from './components/AdjustmentDetailDrawer';
import EmissionsSummaryPanel from './components/EmissionsSummaryPanel';
import ItemsTab from './components/ItemsTab';
import CertificatesTab from './components/CertificatesTab';
import ApplicationsTab from './components/ApplicationsTab';
import RuleResultTab from './components/RuleResultTab';

type TabKey = 'items' | 'certificates' | 'applications' | 'ruleResult';

const TYPE_COLORS: Record<AdjustmentTypeCode, string> = {
  offset_credit: 'bg-green-50 text-green-600',
  renewable_electricity: 'bg-yellow-50 text-yellow-600',
  carbon_removal: 'bg-teal-50 text-teal-600',
  carbon_storage: 'bg-slate-50 text-slate-600',
};
const TYPE_ICONS: Record<AdjustmentTypeCode, string> = {
  offset_credit: 'ri-leaf-line',
  renewable_electricity: 'ri-flashlight-line',
  carbon_removal: 'ri-recycle-line',
  carbon_storage: 'ri-archive-line',
};

// ── Data origin badge ─────────────────────────────────────────────────────────
function DataBadge({ isReal, realLabel, mockLabel }: { isReal: boolean; realLabel: string; mockLabel: string }) {
  if (isReal) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <i className="ri-checkbox-circle-line text-xs"></i>
        {realLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      <i className="ri-error-warning-line text-xs"></i>
      {mockLabel}
    </span>
  );
}

function TypeSummaryCard({ type, count, total, isReal }: { type: AdjustmentTypeCode; count: number; total: number; isReal: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[type]}`}>
        <i className={`${TYPE_ICONS[type]} text-base`}></i>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 truncate">{t(`carbonAdjustments.adjustmentTypes.${type}`)}</p>
        <p className="text-base font-bold text-gray-900">{count} <span className="text-xs font-normal text-gray-400">items</span></p>
        <p className="text-xs text-teal-600 font-medium">{total.toLocaleString()} tCO₂e</p>
        {!isReal && (
          <span className="text-[10px] text-amber-500">Mock</span>
        )}
      </div>
    </div>
  );
}

// ── Map DB row → legacy DTO shape for ItemsTab (which still uses CarbonAdjustmentDTO) ──
function mapItemRowToDTO(row: AdjustmentItemRow) {
  return {
    id: row.id,
    project_id: row.project_id,
    org_id: row.organization_id,
    adjustment_type: (row.adjustment_type === 'renewable_electricity_attribute'
      ? 'renewable_electricity'
      : row.adjustment_type) as AdjustmentTypeCode,
    status: (row.status === 'active' ? 'approved' : row.status) as any,
    target_type: row.target_type as any,
    target_label: row.name,
    certificate_number: null,
    registry_program: null,
    vintage_year: row.vintage_year,
    issue_date: row.effective_from,
    retirement_date: row.effective_to,
    quantity_tco2e: Number(row.quantity_total_tco2e),
    quantity_available_tco2e: Number(row.quantity_available_tco2e),
    unit: 'tCO₂e',
    verification_status: row.certificate_verification_status as any,
    verifier_name: null,
    verification_date: null,
    approval_status: row.approval_status as any,
    proof_document_status: row.proof_document_status as any,
    jurisdiction: row.jurisdiction_code,
    eligible_use: row.claim_purpose as any,
    claim_purpose: row.claim_purpose as any,
    double_counting_check: (row.double_counting_status === 'clear' ? 'clear' : row.double_counting_status === 'flagged' ? 'flagged' : 'unknown') as any,
    notes: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_test: row.is_test,
  };
}

export default function CarbonAdjustmentsPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || undefined;
  const orgId = searchParams.get('organizationId') || undefined;

  const [activeTab, setActiveTab] = useState<TabKey>('items');
  const [selectedAdjustment, setSelectedAdjustment] = useState<any | null>(null);

  // ── Real DB state ─────────────────────────────────────────────────────────
  const [realItems, setRealItems] = useState<AdjustmentItemRow[]>([]);
  const [realCerts, setRealCerts] = useState<AdjustmentCertificateRow[]>([]);
  const [realApps, setRealApps] = useState<AdjustmentApplicationRow[]>([]);
  const [itemsIsReal, setItemsIsReal] = useState(false);
  const [certsIsReal, setCertsIsReal] = useState(false);
  const [appsIsReal, setAppsIsReal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = { project_id: projectId, org_id: orgId };
    setLoading(true);
    Promise.all([
      fetchAdjustmentItems(params),
      fetchAdjustmentCertificates(params),
      fetchAdjustmentApplications(params),
    ]).then(([itemsRes, certsRes, appsRes]) => {
      setRealItems(itemsRes.items);
      setItemsIsReal(itemsRes.isReal);
      setRealCerts(certsRes.certificates);
      setCertsIsReal(certsRes.isReal);
      setRealApps(appsRes.applications);
      setAppsIsReal(appsRes.isReal);
    }).finally(() => setLoading(false));
  }, [projectId, orgId]);

  // ── Decide which data to show: real DB or fallback mock ──────────────────
  const adjustmentDTOs = useMemo(() => {
    if (itemsIsReal && realItems.length > 0) {
      return realItems.map(mapItemRowToDTO);
    }
    return mockCarbonAdjustments;
  }, [realItems, itemsIsReal]);

  const summary = mockEmissionsSummary;
  const ruleResults = mockRuleResults;

  const typeSummaries = useMemo(() => {
    const types: AdjustmentTypeCode[] = ['offset_credit', 'renewable_electricity', 'carbon_removal', 'carbon_storage'];
    return types.map((type) => {
      const items = adjustmentDTOs.filter((a) => a.adjustment_type === type);
      const approvedTotal = items
        .filter((a) => a.status === 'approved')
        .reduce((sum, a) => sum + a.quantity_tco2e, 0);
      return { type, count: items.length, total: approvedTotal };
    });
  }, [adjustmentDTOs]);

  const tabs: { key: TabKey; label: string; icon: string; count?: number; isReal: boolean }[] = [
    { key: 'items', label: t('carbonAdjustments.tabs.items'), icon: 'ri-list-check-2', count: adjustmentDTOs.length, isReal: itemsIsReal },
    { key: 'certificates', label: t('carbonAdjustments.tabs.certificates'), icon: 'ri-file-shield-2-line', count: certsIsReal ? realCerts.length : adjustmentDTOs.filter(a => a.certificate_number).length, isReal: certsIsReal },
    { key: 'applications', label: t('carbonAdjustments.tabs.applications'), icon: 'ri-send-plane-line', count: appsIsReal ? realApps.length : mockApplications.length, isReal: appsIsReal },
    { key: 'ruleResult', label: t('carbonAdjustments.tabs.ruleResult'), icon: 'ri-scales-3-line', count: ruleResults.length, isReal: false },
  ];

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('carbonAdjustments.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('carbonAdjustments.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer whitespace-nowrap">
              <i className="ri-upload-line"></i>
              {t('carbonAdjustments.uploadCertificate')}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer whitespace-nowrap">
              <i className="ri-add-line"></i>
              {t('carbonAdjustments.addAdjustment')}
            </button>
          </div>
        </div>

        {/* ── Page-level data status overview ─────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">資料來源狀態 · Canonical Seed v2026.04.07</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5 p-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500 font-medium">總排放量（Gross）</span>
              <DataBadge isReal={true} realLabel="Real · calculation_results" mockLabel="Mock" />
              <span className="text-xs text-gray-400">從 Supabase 聚合真實計算結果</span>
            </div>
            <div className="flex flex-col gap-1.5 p-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500 font-medium">調整項目 / 憑證</span>
              <DataBadge
                isReal={itemsIsReal}
                realLabel="Real · carbon_adjustment_items"
                mockLabel={loading ? '載入中...' : 'Mock · fallback fixture'}
              />
              <span className="text-xs text-gray-400">
                {itemsIsReal ? `${realItems.length} 筆 canonical seed 資料` : 'DB 無資料，顯示 fixture fallback'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 p-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500 font-medium">申請狀態</span>
              <DataBadge
                isReal={appsIsReal}
                realLabel="Real · adjustment_applications"
                mockLabel={loading ? '載入中...' : 'Mock · fallback fixture'}
              />
              <span className="text-xs text-gray-400">
                {appsIsReal ? `${realApps.length} 筆 canonical seed 資料` : 'DB 無資料，顯示 fixture fallback'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 p-3 bg-gray-50 rounded-lg">
              <span className="text-xs text-gray-500 font-medium">規則引擎結果</span>
              <DataBadge isReal={false} realLabel="Real" mockLabel="Mock · 待 adjustment-rule-result" />
              <span className="text-xs text-gray-400">edge function 尚未部署</span>
            </div>
          </div>
        </div>

        {/* Emissions Summary Panel */}
        <EmissionsSummaryPanel summary={summary} />

        {/* Type summary cards */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">調整類型摘要</p>
            {!itemsIsReal && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                <i className="ri-error-warning-line text-xs"></i>
                Fallback Mock
              </span>
            )}
            {itemsIsReal && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <i className="ri-checkbox-circle-line text-xs"></i>
                Real · canonical seed
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {typeSummaries.map((s) => (
              <TypeSummaryCard key={s.type} type={s.type} count={s.count} total={s.total} isReal={itemsIsReal} />
            ))}
          </div>
        </div>

        {/* 4-Tab section */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? 'border-teal-500 text-teal-700 bg-teal-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <i className={`${tab.icon} text-base`}></i>
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === tab.key ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {/* Per-tab data origin indicator */}
                {tab.isReal ? (
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-600 border border-green-100">
                    Real
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-600 border border-amber-100">
                    Mock
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {activeTab === 'items' && (
              <ItemsTab
                adjustments={adjustmentDTOs}
                onSelect={setSelectedAdjustment}
                isReal={itemsIsReal}
              />
            )}
            {activeTab === 'certificates' && (
              <CertificatesTab
                adjustments={adjustmentDTOs}
                realCertificates={certsIsReal ? realCerts : null}
                isReal={certsIsReal}
              />
            )}
            {activeTab === 'applications' && (
              <ApplicationsTab
                applications={mockApplications}
                realApplications={appsIsReal ? realApps : null}
                isReal={appsIsReal}
              />
            )}
            {activeTab === 'ruleResult' && (
              <RuleResultTab ruleResults={ruleResults} adjustments={adjustmentDTOs} />
            )}
          </div>
        </div>

        {/* Codex pending note — only show if still using mock */}
        {(!itemsIsReal || !certsIsReal || !appsIsReal) && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">仍在 Fallback Mock 的區塊</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {!itemsIsReal && (
                <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <i className="ri-error-warning-line text-amber-500 text-sm mt-0.5 flex-shrink-0"></i>
                  <div>
                    <p className="text-xs font-medium text-gray-700">Items tab</p>
                    <p className="text-xs text-gray-400 mt-0.5">carbon_adjustment_items 有資料但 org/project 篩選無結果，顯示 fixture fallback</p>
                  </div>
                </div>
              )}
              {!certsIsReal && (
                <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <i className="ri-error-warning-line text-amber-500 text-sm mt-0.5 flex-shrink-0"></i>
                  <div>
                    <p className="text-xs font-medium text-gray-700">Certificates tab</p>
                    <p className="text-xs text-gray-400 mt-0.5">adjustment_certificates 有資料但篩選無結果</p>
                  </div>
                </div>
              )}
              {!appsIsReal && (
                <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <i className="ri-error-warning-line text-amber-500 text-sm mt-0.5 flex-shrink-0"></i>
                  <div>
                    <p className="text-xs font-medium text-gray-700">Applications tab</p>
                    <p className="text-xs text-gray-400 mt-0.5">adjustment_applications 有資料但篩選無結果</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg">
                <i className="ri-code-box-line text-teal-500 text-sm mt-0.5 flex-shrink-0"></i>
                <div>
                  <p className="text-xs font-medium text-gray-700 font-mono">adjustment-rule-result edge function</p>
                  <p className="text-xs text-gray-400 mt-0.5">規則引擎 API，目前 fallback mock</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedAdjustment && (
        <AdjustmentDetailDrawer
          adjustment={selectedAdjustment}
          onClose={() => setSelectedAdjustment(null)}
        />
      )}
    </AdminLayout>
  );
}
