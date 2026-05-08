import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '@/components/layout/AdminLayout';
import type {
  AIProviderConfigDTO,
  AIFeatureToggleDTO,
  AIUsageSummaryDTO,
  AIJobLogDTO,
  AIFeatureCode,
  AIJobStatus,
  CustomerAIStatusDTO,
} from '@/types/analytics';

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_PROVIDERS: AIProviderConfigDTO[] = [
  { id: '1', provider: 'openai', model_name: 'gpt-4o', is_active: true, max_tokens: 4096, temperature: 0.2, notes: '主要報告產生模型' },
  { id: '2', provider: 'openai', model_name: 'gpt-4o-mini', is_active: true, max_tokens: 2048, temperature: 0.1, notes: '文件分類與 OCR 後處理' },
  { id: '3', provider: 'anthropic', model_name: 'claude-3-5-sonnet', is_active: false, max_tokens: 8192, temperature: 0.3, notes: '備用模型（未啟用）' },
];

const MOCK_FEATURES: AIFeatureToggleDTO[] = [
  { feature: 'ai_report_generation_enabled', is_enabled: true, org_id: null },
  { feature: 'ai_audit_enabled', is_enabled: true, org_id: null },
  { feature: 'ai_classification_enabled', is_enabled: true, org_id: null },
  { feature: 'ai_ocr_enabled', is_enabled: true, org_id: null },
];

const MOCK_USAGE: AIUsageSummaryDTO = {
  period: '2024-04', total_requests: 1284, total_tokens: 3_420_000,
  estimated_cost_usd: 68.4, failed_requests: 23, quota_limit: 5000, quota_used: 1284,
};

const MOCK_JOBS: AIJobLogDTO[] = [
  { id: 'j1', feature: 'ai_report_generation_enabled', status: 'completed', org_id: 'org-001', project_id: 'proj-001', started_at: '2024-04-07 09:12', completed_at: '2024-04-07 09:14', tokens_used: 3200, cost_usd: 0.064, error_message: null },
  { id: 'j2', feature: 'ai_audit_enabled', status: 'completed', org_id: 'org-001', project_id: 'proj-001', started_at: '2024-04-07 08:55', completed_at: '2024-04-07 08:56', tokens_used: 1800, cost_usd: 0.036, error_message: null },
  { id: 'j3', feature: 'ai_classification_enabled', status: 'failed', org_id: 'org-002', project_id: null, started_at: '2024-04-07 08:30', completed_at: '2024-04-07 08:30', tokens_used: null, cost_usd: null, error_message: 'Rate limit exceeded' },
  { id: 'j5', feature: 'ai_report_generation_enabled', status: 'running', org_id: 'org-001', project_id: 'proj-003', started_at: '2024-04-07 09:18', completed_at: null, tokens_used: null, cost_usd: null, error_message: null },
];

const MOCK_COST_TREND = [
  { period: '2024-01', cost: 42.1, requests: 820 },
  { period: '2024-02', cost: 55.8, requests: 1050 },
  { period: '2024-03', cost: 61.2, requests: 1180 },
  { period: '2024-04', cost: 68.4, requests: 1284 },
];

const MOCK_CUSTOMER_STATUS: CustomerAIStatusDTO = {
  enabled_features: ['ai_report_generation_enabled', 'ai_audit_enabled', 'ai_classification_enabled'],
  quota_used: 1284,
  quota_limit: 5000,
  model_version_label: 'GPT-4o (2024-11)',
  quota_reset_date: '2024-05-01',
};

const JOB_STATUS_COLORS: Record<AIJobStatus, string> = {
  queued: 'bg-gray-100 text-gray-600',
  running: 'bg-sky-100 text-sky-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

type ViewGroup = 'platform' | 'system' | 'customer';

export default function AIGovernancePage() {
  const { t } = useTranslation();
  const [activeGroup, setActiveGroup] = useState<ViewGroup>('platform');
  const [features, setFeatures] = useState<AIFeatureToggleDTO[]>(MOCK_FEATURES);

  const toggleFeature = (feature: AIFeatureCode) => {
    setFeatures((prev) => prev.map((f) => f.feature === feature ? { ...f, is_enabled: !f.is_enabled } : f));
  };

  const viewGroups: { key: ViewGroup; icon: string }[] = [
    { key: 'platform', icon: 'ri-shield-check-line' },
    { key: 'system', icon: 'ri-server-line' },
    { key: 'customer', icon: 'ri-user-line' },
  ];

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('aiGovernance.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('aiGovernance.subtitle')}</p>
        </div>

        {/* Mock notice */}
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <i className="ri-information-line w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0"></i>
          <span>{t('aiGovernance.codexNote')}</span>
        </div>

        {/* View Group Selector */}
        <div className="grid grid-cols-3 gap-3">
          {viewGroups.map(({ key, icon }) => (
            <button
              key={key}
              onClick={() => setActiveGroup(key)}
              className={`flex flex-col items-start gap-1 p-4 rounded-xl border cursor-pointer transition-colors text-left ${
                activeGroup === key
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${activeGroup === key ? 'bg-teal-100' : 'bg-gray-100'}`}>
                <i className={`${icon} text-sm ${activeGroup === key ? 'text-teal-600' : 'text-gray-500'}`}></i>
              </div>
              <span className={`text-sm font-semibold mt-1 ${activeGroup === key ? 'text-teal-700' : 'text-gray-700'}`}>
                {t(`aiGovernance.viewGroups.${key}`)}
              </span>
              <span className="text-xs text-gray-400 leading-relaxed">
                {t(`aiGovernance.viewGroups.${key}Desc`)}
              </span>
            </button>
          ))}
        </div>

        {/* ── Platform Governance ── */}
        {activeGroup === 'platform' && (
          <div className="space-y-5">
            <div className="flex items-start gap-2 px-4 py-3 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-700">
              <i className="ri-shield-check-line w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0"></i>
              <span>{t('aiGovernance.platformNotice')}</span>
            </div>

            {/* Feature Toggles */}
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('aiGovernance.features.title')}</h2>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {features.map((f) => (
                  <div key={f.feature} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {t(`aiGovernance.features.featureNames.${f.feature}`)}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {f.org_id ? t('aiGovernance.features.orgLevel') : t('aiGovernance.features.systemWide')}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFeature(f.feature)}
                      className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${f.is_enabled ? 'bg-teal-500' : 'bg-gray-200'}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${f.is_enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quota monitoring */}
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('aiGovernance.usage.quotaUsed')}</h2>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">{t('aiGovernance.usage.quotaUsed')}</span>
                  <span className="text-sm text-gray-500">
                    {MOCK_USAGE.quota_used.toLocaleString()} / {MOCK_USAGE.quota_limit?.toLocaleString() ?? t('aiGovernance.usage.unlimited')}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-teal-500"
                    style={{ width: `${MOCK_USAGE.quota_limit ? (MOCK_USAGE.quota_used / MOCK_USAGE.quota_limit) * 100 : 0}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  {[
                    { label: t('aiGovernance.usage.totalRequests'), value: MOCK_USAGE.total_requests.toLocaleString(), icon: 'ri-send-plane-line', color: 'text-teal-600 bg-teal-50' },
                    { label: t('aiGovernance.usage.totalTokens'), value: (MOCK_USAGE.total_tokens / 1000).toFixed(0) + 'K', icon: 'ri-code-box-line', color: 'text-sky-600 bg-sky-50' },
                    { label: t('aiGovernance.usage.estimatedCost'), value: `$${MOCK_USAGE.estimated_cost_usd.toFixed(2)}`, icon: 'ri-money-dollar-circle-line', color: 'text-amber-600 bg-amber-50' },
                    { label: t('aiGovernance.usage.failedRequests'), value: MOCK_USAGE.failed_requests.toString(), icon: 'ri-error-warning-line', color: 'text-red-600 bg-red-50' },
                  ].map(({ label, value, icon, color }) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                      <div className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 ${color}`}>
                        <i className={`${icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
                      </div>
                      <div>
                        <div className="text-base font-bold text-gray-900">{value}</div>
                        <div className="text-xs text-gray-500">{label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quota blocked example */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 flex items-center justify-center bg-red-100 rounded-lg flex-shrink-0">
                  <i className="ri-lock-line text-red-600 w-4 h-4 flex items-center justify-center"></i>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-red-800 text-sm">{t('aiGovernance.quota.blockedTitle')}</div>
                  <div className="text-xs text-red-600 mt-1">{t('aiGovernance.quota.blockedDesc')}</div>
                  <div className="flex items-center gap-2 mt-3">
                    <button className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer whitespace-nowrap">
                      {t('aiGovernance.quota.contactAdmin')}
                    </button>
                    <button className="px-3 py-1.5 text-xs border border-red-300 text-red-700 rounded-lg hover:bg-red-100 cursor-pointer whitespace-nowrap">
                      {t('aiGovernance.quota.upgradeButton')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── System Administration ── */}
        {activeGroup === 'system' && (
          <div className="space-y-5">
            <div className="flex items-start gap-2 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600">
              <i className="ri-lock-line w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0"></i>
              <span>{t('aiGovernance.systemNotice')}</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900">{t('aiGovernance.providers.title')}</h2>
                <button className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer whitespace-nowrap">
                  <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
                  {t('aiGovernance.providers.addProvider')}
                </button>
              </div>
              <div className="space-y-3">
                {MOCK_PROVIDERS.map((p) => (
                  <div key={p.id} className={`bg-white border rounded-xl p-4 ${p.is_active ? 'border-gray-200' : 'border-gray-100 opacity-70'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex items-center justify-center bg-teal-50 rounded-lg flex-shrink-0">
                          <i className="ri-robot-line text-teal-600 text-lg w-5 h-5 flex items-center justify-center"></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900">
                              {t(`aiGovernance.providers.providerNames.${p.provider}`)}
                            </span>
                            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{p.model_name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                              {p.is_active ? t('aiGovernance.providers.active') : t('aiGovernance.providers.inactive')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                            {p.max_tokens && <span>Max tokens: {p.max_tokens.toLocaleString()}</span>}
                            {p.temperature !== null && <span>Temp: {p.temperature}</span>}
                            {p.notes && <span className="text-gray-500">{p.notes}</span>}
                          </div>
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0">
                        <i className="ri-more-2-line w-5 h-5 flex items-center justify-center"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Job Logs */}
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('aiGovernance.jobs.title')}</h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {[t('aiGovernance.jobs.fields.feature'), t('aiGovernance.jobs.fields.status'), t('aiGovernance.jobs.fields.orgId'), t('aiGovernance.jobs.fields.startedAt'), t('aiGovernance.jobs.fields.tokensUsed'), t('aiGovernance.jobs.fields.costUsd')].map((h) => (
                          <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {MOCK_JOBS.map((job) => (
                        <tr key={job.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-700">{t(`aiGovernance.features.featureNames.${job.feature}`)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${JOB_STATUS_COLORS[job.status]}`}>
                              {job.status === 'running' && <i className="ri-loader-4-line animate-spin w-3 h-3 flex items-center justify-center"></i>}
                              {t(`aiGovernance.jobs.jobStatus.${job.status}`)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">{job.org_id ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{job.started_at}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{job.tokens_used != null ? job.tokens_used.toLocaleString() : '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{job.cost_usd != null ? `$${job.cost_usd.toFixed(4)}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Cost Trend */}
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-3">{t('aiGovernance.costs.title')}</h2>
              <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 mb-3">
                <i className="ri-information-line w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0"></i>
                <span>{t('aiGovernance.costs.mockNotice')}</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[
                  { title: t('aiGovernance.costs.costTrend'), key: 'cost' as const, color: 'bg-amber-400', fmt: (v: number) => `$${v}` },
                  { title: t('aiGovernance.costs.requestTrend'), key: 'requests' as const, color: 'bg-teal-400', fmt: (v: number) => `${v}` },
                ].map(({ title, key, color, fmt }) => {
                  const maxVal = Math.max(...MOCK_COST_TREND.map((x) => x[key]));
                  return (
                    <div key={key} className="bg-white border border-gray-200 rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
                      <div className="flex items-end gap-3 h-32">
                        {MOCK_COST_TREND.map((d, i) => {
                          const heightPct = (d[key] / maxVal) * 80 + 10;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <span className="text-[10px] text-gray-500">{fmt(d[key])}</span>
                              <div className={`w-full ${color} rounded-t-sm`} style={{ height: `${heightPct}%` }} />
                              <span className="text-[10px] text-gray-400">{d.period}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Customer-Visible Info Preview ── */}
        {activeGroup === 'customer' && (
          <div className="space-y-5">
            <div className="flex items-start gap-2 px-4 py-3 bg-sky-50 border border-sky-200 rounded-lg text-sm text-sky-700">
              <i className="ri-user-line w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0"></i>
              <span>{t('aiGovernance.customerPreviewNotice')}</span>
            </div>

            {/* Quota card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">{t('aiGovernance.customer.title')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                {[
                  { label: t('aiGovernance.customer.quotaUsed'), value: `${MOCK_CUSTOMER_STATUS.quota_used.toLocaleString()} / ${MOCK_CUSTOMER_STATUS.quota_limit?.toLocaleString() ?? t('aiGovernance.customer.unlimited')}`, icon: 'ri-bar-chart-2-line', color: 'text-teal-600 bg-teal-50' },
                  { label: t('aiGovernance.customer.modelVersion'), value: MOCK_CUSTOMER_STATUS.model_version_label, icon: 'ri-robot-line', color: 'text-sky-600 bg-sky-50' },
                  { label: t('aiGovernance.customer.quotaResetDate'), value: MOCK_CUSTOMER_STATUS.quota_reset_date ?? '—', icon: 'ri-calendar-line', color: 'text-amber-600 bg-amber-50' },
                  { label: t('aiGovernance.customer.enabledFeatures'), value: `${MOCK_CUSTOMER_STATUS.enabled_features.length}`, icon: 'ri-checkbox-circle-line', color: 'text-emerald-600 bg-emerald-50' },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} className="flex items-start gap-3 p-4 rounded-xl bg-gray-50">
                    <div className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 ${color}`}>
                      <i className={`${icon} text-sm w-4 h-4 flex items-center justify-center`}></i>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{value}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quota bar */}
              <div className="mb-5">
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full bg-teal-500"
                    style={{ width: `${MOCK_CUSTOMER_STATUS.quota_limit ? (MOCK_CUSTOMER_STATUS.quota_used / MOCK_CUSTOMER_STATUS.quota_limit) * 100 : 0}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {MOCK_CUSTOMER_STATUS.quota_limit
                    ? `${((MOCK_CUSTOMER_STATUS.quota_used / MOCK_CUSTOMER_STATUS.quota_limit) * 100).toFixed(1)}% ${t('aiGovernance.usage.quotaUsed')}`
                    : t('aiGovernance.customer.unlimited')}
                </div>
              </div>

              {/* Enabled features — customer-safe labels only */}
              <h3 className="text-sm font-medium text-gray-700 mb-3">{t('aiGovernance.customer.enabledFeatures')}</h3>
              <div className="flex flex-wrap gap-2">
                {MOCK_CUSTOMER_STATUS.enabled_features.length === 0 ? (
                  <p className="text-sm text-gray-400">{t('aiGovernance.customer.noFeaturesEnabled')}</p>
                ) : (
                  MOCK_CUSTOMER_STATUS.enabled_features.map((f) => (
                    <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
                      <i className="ri-checkbox-circle-line w-3 h-3 flex items-center justify-center"></i>
                      {t(`aiGovernance.features.customerLabels.${f}`)}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
