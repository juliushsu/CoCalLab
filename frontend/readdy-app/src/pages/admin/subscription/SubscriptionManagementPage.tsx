import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import SubscriptionStatusCard from '../../../components/feature/SubscriptionStatusCard';
import type { Subscription, UsageStatistics } from '../../../types/subscription';
import type { CapabilityCode, CapabilityGateStatus } from '../../../types/capability';
import { getSupabaseClient, isSupabaseConnected } from '../../../lib/supabase';

// ─── Capability gate adapter ──────────────────────────────────────────────────
// TODO: Replace with real capability gate from Codex subscription API.
// When Codex delivers the feature-flag endpoint, swap this with:
//   GET /api/capabilities → { code, status }[]
// or read from subscription.features.capabilities[]
function getCapabilityStatus(_code: CapabilityCode): CapabilityGateStatus {
  const ENABLED: CapabilityCode[] = ['carbon_inventory'];
  const COMING_SOON: CapabilityCode[] = ['esg', 'ifrs_s1_s2', 'product_cfp', 'lifecycle_assessment'];
  if (ENABLED.includes(_code)) return 'available';
  if (COMING_SOON.includes(_code)) return 'coming_soon';
  return 'unavailable';
}

const CAPABILITY_LIST: { code: CapabilityCode; icon: string }[] = [
  { code: 'carbon_inventory',    icon: 'ri-leaf-line' },
  { code: 'esg',                 icon: 'ri-earth-line' },
  { code: 'ifrs_s1_s2',          icon: 'ri-bank-line' },
  { code: 'product_cfp',         icon: 'ri-box-3-line' },
  { code: 'lifecycle_assessment', icon: 'ri-recycle-line' },
];

// ─── Capability row ───────────────────────────────────────────────────────────
function CapabilityRow({ code, icon }: { code: CapabilityCode; icon: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const status = getCapabilityStatus(code);

  const statusConfig: Record<CapabilityGateStatus, { cls: string; label: string; icon: string }> = {
    available:   { cls: 'bg-green-100 text-green-700',  label: t('capabilities.available'),   icon: 'ri-checkbox-circle-fill' },
    unavailable: { cls: 'bg-gray-100 text-gray-500',    label: t('capabilities.unavailable'), icon: 'ri-lock-line' },
    coming_soon: { cls: 'bg-amber-100 text-amber-700',  label: t('reportTypes.comingSoon'),   icon: 'ri-time-line' },
  };
  const cfg = statusConfig[status];

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          status === 'available' ? 'bg-teal-50' : 'bg-gray-50'
        }`}>
          <i className={`${icon} text-base ${status === 'available' ? 'text-teal-600' : 'text-gray-400'}`}></i>
        </div>
        <div>
          <p className={`text-sm font-medium ${status === 'available' ? 'text-gray-900' : 'text-gray-400'}`}>
            {t(`capabilities.${code}`)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {t(`capabilities.${code}_desc`)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
          <i className={`${cfg.icon} text-xs`}></i>
          {cfg.label}
        </span>
        {status !== 'available' && (
          <button
            onClick={() => navigate('/admin/subscription')}
            className="text-xs text-amber-600 hover:text-amber-700 font-medium whitespace-nowrap cursor-pointer"
          >
            {t('capabilities.upgradeButton')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SubscriptionManagementPage() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageStatistics | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!isSupabaseConnected()) {
        setError(t('errors.networkError'));
        return;
      }

      const supabase = getSupabaseClient();

      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        console.error('Failed to load subscription:', subError);
        setError(t('errors.loadFailed'));
        return;
      }

      if (!subData) {
        setError(t('subscription.notFound'));
        return;
      }

      const mappedSubscription: Subscription = {
        id: subData.id,
        organization_id: subData.organization_id,
        plan: subData.plan_code,
        status: subData.status,
        start_date: subData.period_start,
        end_date: subData.period_end,
        auto_renew: true,
        max_projects: subData.features?.max_projects ?? 20,
        max_documents_per_month: subData.features?.max_documents_per_month ?? 500,
        max_activities_per_project: subData.features?.max_activities_per_project ?? 1000,
        max_users: subData.features?.max_users ?? 10,
        current_projects: 0,
        current_documents_this_month: 0,
        current_users: 1,
        features: {
          ai_report_generation: subData.features?.ai_report_generation ?? true,
          advanced_analytics: subData.features?.advanced_analytics ?? true,
          api_access: subData.features?.api_access ?? false,
          custom_emission_factors: subData.features?.custom_emission_factors ?? false,
          priority_support: subData.features?.priority_support ?? false,
          white_label: subData.features?.white_label ?? false,
        },
        created_at: subData.created_at,
        updated_at: subData.updated_at,
      };

      const [{ count: projectCount }, { count: docCount }] = await Promise.all([
        supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', subData.organization_id),
        supabase
          .from('uploaded_documents')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', subData.organization_id),
      ]);

      mappedSubscription.current_projects = projectCount || 0;
      mappedSubscription.current_documents_this_month = docCount || 0;

      const mockUsage: UsageStatistics = {
        organization_id: subData.organization_id,
        current_period_start: subData.period_start,
        current_period_end: subData.period_end,
        projects_count: projectCount || 0,
        documents_count: docCount || 0,
        activities_count: 0,
        users_count: 1,
        storage_used_mb: 0,
        api_calls_count: 0,
      };

      setSubscription(mappedSubscription);
      setUsage(mockUsage);
    } catch (err) {
      console.error('Failed to load subscription:', err);
      setError(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => setUpgradeDialogOpen(true);
  const handleRenew = () => console.log('Renew subscription');
  const handleManage = () => console.log('Manage subscription');

  if (loading) return <AdminLayout><LoadingState /></AdminLayout>;
  if (error || !subscription) return <AdminLayout><ErrorState message={error || t('errors.loadFailed')} onRetry={loadSubscriptionData} /></AdminLayout>;

  const usagePercentage = {
    projects:  (subscription.current_projects / subscription.max_projects) * 100,
    documents: (subscription.current_documents_this_month / subscription.max_documents_per_month) * 100,
    users:     (subscription.current_users / subscription.max_users) * 100,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('subscription.title')}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subscription Status Card */}
          <div className="lg:col-span-1">
            <SubscriptionStatusCard
              subscription={subscription}
              onUpgrade={handleUpgrade}
              onRenew={handleRenew}
              onManage={handleManage}
            />
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Usage Overview */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {t('subscription.usage.title')}
              </h3>
              <div className="space-y-4">
                {/* Projects */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{t('subscription.usage.projects')}</span>
                    <span className="text-sm text-gray-600">{subscription.current_projects} / {subscription.max_projects}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${usagePercentage.projects >= 90 ? 'bg-red-600' : usagePercentage.projects >= 70 ? 'bg-orange-600' : 'bg-teal-600'}`} style={{ width: `${Math.min(usagePercentage.projects, 100)}%` }}></div>
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{t('subscription.usage.documents')}</span>
                    <span className="text-sm text-gray-600">{subscription.current_documents_this_month} / {subscription.max_documents_per_month}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${usagePercentage.documents >= 90 ? 'bg-red-600' : usagePercentage.documents >= 70 ? 'bg-orange-600' : 'bg-teal-600'}`} style={{ width: `${Math.min(usagePercentage.documents, 100)}%` }}></div>
                  </div>
                </div>

                {/* Users */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{t('subscription.usage.users')}</span>
                    <span className="text-sm text-gray-600">{subscription.current_users} / {subscription.max_users}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${usagePercentage.users >= 90 ? 'bg-red-600' : usagePercentage.users >= 70 ? 'bg-orange-600' : 'bg-teal-600'}`} style={{ width: `${Math.min(usagePercentage.users, 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Capability Tiers ── */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('capabilities.sectionTitle')}
                </h3>
                <span className="text-xs text-gray-400">{t('capabilities.sectionDesc')}</span>
              </div>
              <p className="text-xs text-gray-400 mb-5">{t('capabilities.upgradeHint')}</p>
              <div>
                {CAPABILITY_LIST.map(({ code, icon }) => (
                  <CapabilityRow key={code} code={code} icon={icon} />
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {t('subscription.features.title')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(subscription.features).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${value ? 'bg-teal-100' : 'bg-gray-100'}`}>
                      {value ? (
                        <i className="ri-check-line text-sm text-teal-600"></i>
                      ) : (
                        <i className="ri-close-line text-sm text-gray-400"></i>
                      )}
                    </div>
                    <span className={`text-sm ${value ? 'text-gray-900' : 'text-gray-400'}`}>
                      {t(`subscription.features.${key}`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan Limits */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {t('subscription.limits.title')}
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-gray-600">{t('subscription.limits.maxProjects')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{subscription.max_projects}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('subscription.limits.projects')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('subscription.limits.maxDocuments')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{subscription.max_documents_per_month}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('subscription.limits.documents')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('subscription.limits.maxActivities')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{subscription.max_activities_per_project}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('subscription.limits.activities')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">{t('subscription.limits.maxUsers')}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{subscription.max_users}</p>
                  <p className="text-xs text-gray-500 mt-1">{t('subscription.limits.users')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upgrade Dialog */}
        {upgradeDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {t('subscription.upgradeDialog.title')}
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                {t('subscription.upgradeDialog.description')}
              </p>
              
              {/* Plan Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {(['basic', 'professional', 'enterprise'] as const).map((plan) => (
                  <div
                    key={plan}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      plan === 'professional' ? 'border-teal-600 bg-teal-50' : 'border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      {t(`subscription.plans.${plan}`)}
                    </h4>
                    {plan === 'professional' && (
                      <span className="inline-block px-2 py-1 text-xs font-medium text-teal-700 bg-teal-100 rounded mb-2">
                        {t('subscription.planComparison.currentPlan')}
                      </span>
                    )}
                    <p className="text-2xl font-bold text-gray-900 mb-1">
                      {plan === 'enterprise' ? t('subscription.planComparison.contactSales') : `NT$ ${plan === 'basic' ? '2,990' : '9,990'}`}
                    </p>
                    {plan !== 'enterprise' && (
                      <p className="text-sm text-gray-600">{t('subscription.planComparison.perMonth')}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setUpgradeDialogOpen(false)}
                  className="px-4 py-2 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => setUpgradeDialogOpen(false)}
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
                >
                  {t('subscription.upgradeDialog.confirmButton')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}