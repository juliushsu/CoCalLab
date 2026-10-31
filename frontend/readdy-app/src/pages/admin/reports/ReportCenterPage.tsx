import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '@/components/layout/AdminLayout';
import type { ReportTypeCode, CapabilityGateStatus } from '@/types/capability';
import GovernanceBanner from '@/components/feature/GovernanceBanner';

// ─── Feature-flag adapter ─────────────────────────────────────────────────────
// TODO: Replace with real capability gate from Codex subscription API.
// Currently all flags are hardcoded for staging skeleton.
// When Codex delivers the feature-flag endpoint, swap this function with
// an API call: GET /api/capabilities → { code, status }[]
function getCapabilityStatus(code: ReportTypeCode): CapabilityGateStatus {
  const ENABLED: ReportTypeCode[] = ['carbon_inventory'];
  const COMING_SOON: ReportTypeCode[] = ['esg', 'ifrs_s1_s2', 'product_cfp'];
  if (ENABLED.includes(code)) return 'available';
  if (COMING_SOON.includes(code)) return 'coming_soon';
  return 'unavailable';
}

// ─── Report type card config ──────────────────────────────────────────────────
interface ReportTypeConfig {
  code: ReportTypeCode;
  icon: string;
  color: string;
  route: string;
}

const REPORT_TYPES: ReportTypeConfig[] = [
  {
    code: 'carbon_inventory',
    icon: 'ri-leaf-line',
    color: 'teal',
    route: '/admin/reports/history',
  },
  {
    code: 'esg',
    icon: 'ri-earth-line',
    color: 'emerald',
    route: '/admin/reports/esg',
  },
  {
    code: 'ifrs_s1_s2',
    icon: 'ri-bank-line',
    color: 'amber',
    route: '/admin/reports/ifrs',
  },
  {
    code: 'product_cfp',
    icon: 'ri-box-3-line',
    color: 'orange',
    route: '/admin/product-carbon',
  },
];

// ─── Color map ────────────────────────────────────────────────────────────────
const COLOR_MAP: Record<string, { bg: string; icon: string; badge: string; btn: string }> = {
  teal:    { bg: 'bg-teal-50',    icon: 'text-teal-600',    badge: 'bg-teal-100 text-teal-700',    btn: 'bg-teal-600 hover:bg-teal-700 text-white' },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', btn: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700',   btn: 'bg-amber-600 hover:bg-amber-700 text-white' },
  orange:  { bg: 'bg-orange-50',  icon: 'text-orange-600',  badge: 'bg-orange-100 text-orange-700',  btn: 'bg-orange-600 hover:bg-orange-700 text-white' },
};

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: CapabilityGateStatus }) {
  const { t } = useTranslation();
  if (status === 'available') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <i className="ri-checkbox-circle-fill text-xs"></i>
        {t('capabilities.available')}
      </span>
    );
  }
  if (status === 'coming_soon') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <i className="ri-time-line text-xs"></i>
        {t('reportTypes.comingSoon')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      <i className="ri-lock-line text-xs"></i>
      {t('capabilities.unavailable')}
    </span>
  );
}

// ─── Report type card ─────────────────────────────────────────────────────────
interface ReportTypeCardProps {
  config: ReportTypeConfig;
  status: CapabilityGateStatus;
}

function ReportTypeCard({ config, status }: ReportTypeCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const colors = COLOR_MAP[config.color] ?? COLOR_MAP.teal;
  const isAvailable = status === 'available';
  const isComingSoon = status === 'coming_soon';

  const handleClick = () => {
    if (isAvailable) {
      navigate(config.route);
    }
  };

  return (
    <div
      className={`relative rounded-2xl border p-6 flex flex-col gap-4 transition-all duration-200 ${
        isAvailable
          ? 'border-gray-200 bg-white cursor-pointer hover:border-gray-300'
          : 'border-gray-100 bg-gray-50/50 cursor-not-allowed'
      }`}
      onClick={handleClick}
    >
      {/* Icon + status */}
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isAvailable ? colors.bg : 'bg-gray-100'}`}>
          <i className={`${config.icon} text-2xl ${isAvailable ? colors.icon : 'text-gray-400'}`}></i>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Title + desc */}
      <div>
        <h3 className={`text-base font-semibold mb-1 ${isAvailable ? 'text-gray-900' : 'text-gray-400'}`}>
          {t(`reportTypes.${config.code}`)}
        </h3>
        <p className={`text-sm leading-relaxed ${isAvailable ? 'text-gray-500' : 'text-gray-400'}`}>
          {t(`reportTypes.typeDesc.${config.code}`)}
        </p>
      </div>

      {/* CTA */}
      <div className="mt-auto pt-2">
        {isAvailable ? (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(config.route); }}
            className={`w-full py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${colors.btn}`}
          >
            <i className="ri-arrow-right-line mr-1.5"></i>
            {t('common.view')}
          </button>
        ) : isComingSoon ? (
          <div className="w-full py-2 rounded-lg text-sm font-medium text-center text-gray-400 bg-gray-100 cursor-not-allowed">
            <i className="ri-time-line mr-1.5"></i>
            {t('reportTypes.comingSoon')}
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/admin/subscription'); }}
            className="w-full py-2 rounded-lg text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors whitespace-nowrap"
          >
            <i className="ri-vip-crown-line mr-1.5"></i>
            {t('capabilities.upgradeButton')}
          </button>
        )}
      </div>

      {/* Overlay for unavailable */}
      {!isAvailable && (
        <div className="absolute inset-0 rounded-2xl bg-white/40 pointer-events-none" />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportCenterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('capabilities.sectionDesc')}</p>
        </div>

        {/* Beta / Governance notice */}
        <GovernanceBanner
          variant="beta"
          message={t('reports.betaReportWarningDesc', '目前生成報告僅供測試與內部盤查流程驗證，正式申報/查驗前需人工審核。盤查法人與據點資訊將於下一階段完整顯示。')}
        />

        {/* Report type grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5 mb-10">
          {REPORT_TYPES.map((cfg) => (
            <ReportTypeCard
              key={cfg.code}
              config={cfg}
              status={getCapabilityStatus(cfg.code)}
            />
          ))}
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">{t('carbonAdjustments.summary.title')}</h2>
          <p className="mt-2 text-sm text-gray-500">{t('reports.snapshot.centerNotice', '請至報告歷史選擇專案，查看該專案已完成報告的保存快照。')}</p>
          <button onClick={() => navigate('/admin/reports/history')} className="mt-3 text-sm text-teal-700 hover:underline">
            {t('reports.history_page.view_report')} &rarr;
          </button>
        </div>

        {/* Quick access — carbon inventory history */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {t('reports.list_title')}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">{t('reportTypes.carbon_inventory')}</p>
            </div>
            <button
              onClick={() => navigate('/admin/reports/history')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 rounded-xl hover:bg-teal-100 transition-colors whitespace-nowrap"
            >
              <i className="ri-history-line"></i>
              {t('reports.history_page.view_report')}
            </button>
          </div>
          <p className="text-sm text-gray-400">
            {t('reports.list_description')}
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
