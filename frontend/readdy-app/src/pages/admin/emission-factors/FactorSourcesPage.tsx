import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '@/components/layout/AdminLayout';
import type {
  FactorSourceDTO,
  FactorSourceType,
  DataLevel,
  ApplicableModule,
  OrgSourceSubtype,
  ResolutionPriorityTier,
  SourceUpdateStatus,
} from '@/types/emissionFactor';

// ─── Mock data (aligned with Codex canonical schema) ──────────────────────────
const MOCK_SOURCES: FactorSourceDTO[] = [
  // ── 台灣環境部 CFP_P_02（featured 置頂，仍受 filter 影響）──────────────────
  {
    id: 'cfp_p_02',
    source_name: '台灣環境部 CFP_P_02',
    source_code: 'CFP_P_02',
    region: '台灣',
    country_code: 'TW',
    source_type: 'official',
    is_enabled: true,
    priority: 0,
    last_updated: '2024-03-01',
    update_status: 'active_latest',
    description:
      '台灣環境部公告之產品/服務碳足跡排放係數資料庫（CFP_P_02），專用於 ISO 14067 產品碳足跡計算，不適用於一般 GHG 盤查。',
    url: 'https://cfp.epa.gov.tw',
    data_level: 'secondary',
    applicable_modules: ['product_cfp', 'lca'],
    is_featured: true,
    featured_note:
      '此來源僅適用於產品碳足跡（CFP）與 LCA 模組，不可混用於一般 GHG 盤查係數。',
    resolution_priority_tier: 'tier_2_secondary',
  },
  // ── 自家監測來源（CTO 指示：三個子類型）────────────────────────────────────
  {
    id: 'org_monitor_01',
    source_name: '廠區電力監測系統（EMS）',
    source_code: 'ORG_EMS_MAIN',
    region: null,
    country_code: null,
    source_type: 'monitored',
    is_enabled: true,
    priority: 1,
    last_updated: '2026-04-01',
    update_status: 'active_latest',
    description:
      '廠區能源管理系統（EMS）即時電力量測數據，具備 ISO 50001 認證，可作為 Scope 2 直接量測依據。',
    url: null,
    data_level: 'primary',
    applicable_modules: ['ghg_inventory', 'esg_report', 'ifrs_s1_s2'],
    org_source_subtype: 'monitoring_source',
    resolution_priority_tier: 'tier_1_primary',
    requires_validation: true,
    is_validated: true,
    validation_reference: 'ISO 50001:2018 認證 / 第三方計量檢定',
  },
  {
    id: 'org_direct_01',
    source_name: '製程直接排放量測（Scope 1）',
    source_code: 'ORG_DIRECT_S1',
    region: null,
    country_code: null,
    source_type: 'monitored',
    is_enabled: true,
    priority: 2,
    last_updated: '2026-03-15',
    update_status: 'pending_platform_review',
    description:
      '製程燃燒與逸散排放直接量測數據，依 ISO 14064-1 方法學建立，尚未完成第三方驗證。',
    url: null,
    data_level: 'primary',
    applicable_modules: ['ghg_inventory'],
    org_source_subtype: 'direct_activity_data',
    resolution_priority_tier: 'tier_1_primary',
    requires_validation: true,
    is_validated: false,
    validation_reference: null,
  },
  {
    id: 'org_factor_01',
    source_name: '組織自訂排放係數（供應鏈）',
    source_code: 'ORG_FACTOR_SC',
    region: null,
    country_code: null,
    source_type: 'org_specific',
    is_enabled: true,
    priority: 3,
    last_updated: '2026-02-01',
    update_status: 'pending_platform_review',
    description:
      '依供應商實際數據建立的組織自訂排放係數，已通過內部方法學審查，待第三方驗證後可提升優先序。',
    url: null,
    data_level: 'primary',
    applicable_modules: ['ghg_inventory', 'esg_report'],
    org_source_subtype: 'org_factor',
    resolution_priority_tier: 'tier_1_primary',
    requires_validation: true,
    is_validated: false,
    validation_reference: null,
  },
  // ── 一般外部來源 ──────────────────────────────────────────────────────────
  {
    id: '1',
    source_name: '台灣環保署排放係數',
    source_code: 'TW_EPA',
    region: '台灣',
    country_code: 'TW',
    source_type: 'official',
    is_enabled: true,
    priority: 4,
    last_updated: '2024-01-15',
    update_status: 'active_latest',
    description: '台灣環境保護署公告之溫室氣體排放係數管理表，適用於一般 GHG 盤查',
    url: 'https://ghgregistry.epa.gov.tw',
    data_level: 'secondary',
    applicable_modules: ['ghg_inventory', 'esg_report', 'ifrs_s1_s2'],
    resolution_priority_tier: 'tier_2_secondary',
  },
  {
    id: '2',
    source_name: 'IPCC AR6 排放係數',
    source_code: 'IPCC_AR6',
    region: '全球',
    country_code: null,
    source_type: 'global',
    is_enabled: true,
    priority: 5,
    last_updated: '2023-09-01',
    update_status: 'active_latest',
    description: 'IPCC 第六次評估報告（AR6）溫室氣體排放係數，全球通用',
    url: 'https://www.ipcc.ch/ar6',
    data_level: 'secondary',
    applicable_modules: ['ghg_inventory', 'esg_report', 'ifrs_s1_s2', 'product_cfp'],
    resolution_priority_tier: 'tier_2_secondary',
  },
  {
    id: '3',
    source_name: 'UK DEFRA 排放係數',
    source_code: 'UK_DEFRA',
    region: '英國',
    country_code: 'GB',
    source_type: 'official',
    is_enabled: true,
    priority: 6,
    last_updated: '2023-06-01',
    update_status: 'new_version_detected',
    description: '英國環境、食品及農村事務部（DEFRA）排放係數，適用英國境內盤查',
    url: 'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
    data_level: 'secondary',
    applicable_modules: ['ghg_inventory', 'scope2_market'],
    resolution_priority_tier: 'tier_2_secondary',
  },
  {
    id: '4',
    source_name: 'ecoinvent 3.9',
    source_code: 'ECOINVENT_39',
    region: '全球',
    country_code: null,
    source_type: 'global',
    is_enabled: true,
    priority: 7,
    last_updated: '2023-09-15',
    update_status: 'active_latest',
    description: 'ecoinvent 生命周期評估資料庫 v3.9，提供高精度一級資料',
    url: 'https://ecoinvent.org',
    data_level: 'primary',
    applicable_modules: ['lca', 'product_cfp', 'ghg_inventory'],
    resolution_priority_tier: 'tier_1_primary',
  },
  {
    id: '5',
    source_name: 'GHG Protocol 供應鏈係數',
    source_code: 'GHGP_SC',
    region: '全球',
    country_code: null,
    source_type: 'industry',
    is_enabled: true,
    priority: 8,
    last_updated: '2022-12-01',
    update_status: 'new_version_detected',
    description: 'GHG Protocol 企業價值鏈（範疇三）計算指引係數',
    url: 'https://ghgprotocol.org',
    data_level: 'secondary',
    applicable_modules: ['ghg_inventory', 'esg_report'],
    resolution_priority_tier: 'tier_2_secondary',
  },
  {
    id: '6',
    source_name: '混合來源係數（製程 + 文獻）',
    source_code: 'HYBRID_PROC',
    region: '全球',
    country_code: null,
    source_type: 'industry',
    is_enabled: true,
    priority: 9,
    last_updated: '2023-03-01',
    update_status: 'active_latest',
    description: '結合現場量測與文獻資料的混合來源係數，適用於資料不完整的製程邊界',
    url: null,
    data_level: 'hybrid',
    applicable_modules: ['ghg_inventory', 'lca'],
    resolution_priority_tier: 'tier_2_secondary',
  },
  {
    id: '7',
    source_name: '備用全球平均係數',
    source_code: 'FALLBACK_GLOBAL',
    region: '全球',
    country_code: null,
    source_type: 'fallback',
    is_enabled: false,
    priority: 99,
    last_updated: '2022-01-01',
    update_status: 'legacy_reference',
    description: '當無法找到適用係數時使用的備用全球平均值，精度最低，僅供舊報告追溯',
    url: null,
    data_level: 'fallback',
    applicable_modules: ['ghg_inventory'],
    resolution_priority_tier: 'tier_4_fallback',
  },
];

// ─── Style maps ───────────────────────────────────────────────────────────────
const SOURCE_TYPE_COLORS: Record<FactorSourceType, string> = {
  official: 'bg-emerald-100 text-emerald-700',
  global: 'bg-sky-100 text-sky-700',
  industry: 'bg-violet-100 text-violet-700',
  fallback: 'bg-gray-100 text-gray-600',
  org_specific: 'bg-teal-100 text-teal-700',
  monitored: 'bg-cyan-100 text-cyan-700',
};

const DATA_LEVEL_COLORS: Record<DataLevel, string> = {
  primary: 'bg-teal-100 text-teal-700 border border-teal-200',
  secondary: 'bg-amber-50 text-amber-700 border border-amber-200',
  hybrid: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
  fallback: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const DATA_LEVEL_ICONS: Record<DataLevel, string> = {
  primary: 'ri-medal-line',
  secondary: 'ri-bar-chart-2-line',
  hybrid: 'ri-git-merge-line',
  fallback: 'ri-archive-line',
};

// Platform governance status — NOT tenant action items
const UPDATE_STATUS_CONFIG: Record<SourceUpdateStatus, { color: string; icon: string; bgClass: string }> = {
  active_latest: {
    color: 'text-emerald-600',
    icon: 'ri-checkbox-circle-line',
    bgClass: '',
  },
  new_version_detected: {
    color: 'text-amber-600',
    icon: 'ri-refresh-line',
    bgClass: 'bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5',
  },
  pending_platform_review: {
    color: 'text-sky-600',
    icon: 'ri-time-line',
    bgClass: 'bg-sky-50 border border-sky-200 rounded-md px-2 py-0.5',
  },
  deprecated: {
    color: 'text-red-500',
    icon: 'ri-forbid-line',
    bgClass: 'bg-red-50 border border-red-200 rounded-md px-2 py-0.5',
  },
  legacy_reference: {
    color: 'text-gray-400',
    icon: 'ri-history-line',
    bgClass: 'bg-gray-50 border border-gray-200 rounded-md px-2 py-0.5',
  },
};

const MODULE_COLORS: Record<ApplicableModule, string> = {
  ghg_inventory: 'bg-emerald-50 text-emerald-700',
  product_cfp: 'bg-orange-50 text-orange-700',
  lca: 'bg-lime-50 text-lime-700',
  esg_report: 'bg-sky-50 text-sky-700',
  scope2_market: 'bg-indigo-50 text-indigo-700',
  ifrs_s1_s2: 'bg-rose-50 text-rose-700',
};

const ORG_SUBTYPE_ICONS: Record<OrgSourceSubtype, string> = {
  monitoring_source: 'ri-sensor-line',
  direct_activity_data: 'ri-pulse-line',
  org_factor: 'ri-building-2-line',
};

const ORG_SUBTYPE_COLORS: Record<OrgSourceSubtype, string> = {
  monitoring_source: 'bg-cyan-50 border-cyan-200',
  direct_activity_data: 'bg-teal-50 border-teal-200',
  org_factor: 'bg-emerald-50 border-emerald-200',
};

const RESOLUTION_TIER_COLORS: Record<ResolutionPriorityTier, string> = {
  tier_0_validated_org: 'bg-emerald-600 text-white',
  tier_1_primary: 'bg-teal-500 text-white',
  tier_2_secondary: 'bg-amber-400 text-white',
  tier_3_tertiary: 'bg-gray-400 text-white',
  tier_4_fallback: 'bg-gray-300 text-gray-600',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function DataLevelBadge({ level, label }: { level: DataLevel; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${DATA_LEVEL_COLORS[level]}`}>
      <i className={`${DATA_LEVEL_ICONS[level]} w-3 h-3 flex items-center justify-center`}></i>
      {label}
    </span>
  );
}

function ModuleChip({ module, label }: { module: ApplicableModule; label: string }) {
  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${MODULE_COLORS[module]}`}>
      {label}
    </span>
  );
}

function ResolutionTierBadge({ tier, label }: { tier: ResolutionPriorityTier; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${RESOLUTION_TIER_COLORS[tier]}`}>
      <i className="ri-stack-line w-3 h-3 flex items-center justify-center"></i>
      {label}
    </span>
  );
}

/** Platform governance status tag — clearly labeled as platform-managed */
function PlatformStatusTag({
  status,
  label,
}: {
  status: SourceUpdateStatus;
  label: string;
}) {
  const cfg = UPDATE_STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cfg.color} ${cfg.bgClass}`}>
      <i className={`${cfg.icon} w-3 h-3 flex items-center justify-center`}></i>
      {label}
    </span>
  );
}

// ─── Validation Status Indicator ─────────────────────────────────────────────

function ValidationIndicator({
  requiresValidation,
  isValidated,
  validationRef,
  t,
}: {
  requiresValidation?: boolean;
  isValidated?: boolean;
  validationRef?: string | null;
  t: (key: string) => string;
}) {
  if (!requiresValidation) return null;

  if (isValidated) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
        <i className="ri-shield-check-line text-emerald-600 w-3.5 h-3.5 flex items-center justify-center flex-shrink-0"></i>
        <div>
          <span className="text-[10px] font-semibold text-emerald-700">
            {t('factorSources.orgSources.validationPassed')}
          </span>
          {validationRef && (
            <span className="text-[10px] text-emerald-600 ml-1">— {validationRef}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
      <i className="ri-shield-line text-amber-500 w-3.5 h-3.5 flex items-center justify-center flex-shrink-0"></i>
      <span className="text-[10px] font-semibold text-amber-700">
        {t('factorSources.orgSources.validationPending')}
      </span>
      <span className="text-[10px] text-amber-600">
        — {t('factorSources.orgSources.validationPendingNote')}
      </span>
    </div>
  );
}

// ─── Org Source Card ──────────────────────────────────────────────────────────

interface OrgSourceCardProps {
  source: FactorSourceDTO;
  onToggle: (id: string) => void;
  levelLabel: string;
  moduleLabels: Record<ApplicableModule, string>;
  subtypeLabel: string;
  resolutionLabel: string;
  statusLabel: string;
  t: (key: string) => string;
}

function OrgSourceCard({
  source,
  onToggle,
  levelLabel,
  moduleLabels,
  subtypeLabel,
  resolutionLabel,
  statusLabel,
  t,
}: OrgSourceCardProps) {
  const subtype = source.org_source_subtype;
  const bgClass = subtype ? ORG_SUBTYPE_COLORS[subtype] : 'bg-gray-50 border-gray-200';
  const iconClass = subtype ? ORG_SUBTYPE_ICONS[subtype] : 'ri-building-line';

  return (
    <div className={`border rounded-xl px-5 py-4 ${bgClass}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 flex items-center justify-center bg-white/70 rounded-lg flex-shrink-0 mt-0.5">
            <i className={`${iconClass} text-teal-600 text-base`}></i>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900">{source.source_name}</span>
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${SOURCE_TYPE_COLORS[source.source_type]}`}>
                {subtypeLabel}
              </span>
              <DataLevelBadge level={source.data_level} label={levelLabel} />
              {source.resolution_priority_tier && (
                <ResolutionTierBadge
                  tier={source.resolution_priority_tier}
                  label={resolutionLabel}
                />
              )}
              {!source.is_enabled && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 rounded-full">
                  {t('factorSources.disabled')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-gray-400 font-mono">{source.source_code}</span>
              <PlatformStatusTag status={source.update_status} label={statusLabel} />
              {source.last_updated && (
                <span className="text-xs text-gray-400">
                  {t('factorSources.fields.lastUpdated')}: {source.last_updated}
                </span>
              )}
            </div>

            {source.description && (
              <p className="text-xs text-gray-600 mt-1.5">{source.description}</p>
            )}

            <div className="mt-2">
              <ValidationIndicator
                requiresValidation={source.requires_validation}
                isValidated={source.is_validated}
                validationRef={source.validation_reference}
                t={t}
              />
            </div>

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] text-gray-400 font-medium mr-0.5">
                {t('factorSources.applicableModules')}:
              </span>
              {source.applicable_modules.map((mod) => (
                <ModuleChip key={mod} module={mod} label={moduleLabels[mod]} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onToggle(source.id)}
            className={`px-3 py-1.5 text-xs rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
              source.is_enabled
                ? 'bg-white/70 text-gray-600 hover:bg-white'
                : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
            }`}
          >
            {source.is_enabled ? t('factorSources.toggleDisable') : t('factorSources.toggleEnable')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Featured CFP_P_02 Card ───────────────────────────────────────────────────

interface FeaturedSourceCardProps {
  source: FactorSourceDTO;
  onToggle: (id: string) => void;
  levelLabel: string;
  moduleLabels: Record<ApplicableModule, string>;
  statusLabel: string;
  t: (key: string) => string;
}

function FeaturedSourceCard({ source, onToggle, levelLabel, moduleLabels, statusLabel, t }: FeaturedSourceCardProps) {
  return (
    <div className="relative bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl px-5 py-5 overflow-hidden">
      <div className="absolute top-0 right-0">
        <div className="bg-orange-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-lg tracking-wide">
          CFP ONLY
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 flex items-center justify-center bg-orange-100 rounded-xl flex-shrink-0">
            <i className="ri-leaf-line text-orange-600 text-lg"></i>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 text-base">{source.source_name}</span>
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${SOURCE_TYPE_COLORS[source.source_type]}`}>
                {t(`factorSources.sourceTypes.${source.source_type}`)}
              </span>
              <DataLevelBadge level={source.data_level} label={levelLabel} />
              {!source.is_enabled && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 rounded-full">
                  {t('factorSources.disabled')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-gray-400 font-mono">{source.source_code}</span>
              {source.region && (
                <span className="text-xs text-gray-500">
                  <i className="ri-map-pin-line mr-0.5"></i>{source.region}
                </span>
              )}
              <PlatformStatusTag status={source.update_status} label={statusLabel} />
              {source.last_updated && (
                <span className="text-xs text-gray-400">
                  {t('factorSources.fields.lastUpdated')}: {source.last_updated}
                </span>
              )}
            </div>

            {source.description && (
              <p className="text-xs text-gray-600 mt-1.5">{source.description}</p>
            )}

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] text-gray-400 font-medium mr-0.5">
                {t('factorSources.applicableModules')}:
              </span>
              {source.applicable_modules.map((mod) => (
                <ModuleChip key={mod} module={mod} label={moduleLabels[mod]} />
              ))}
            </div>

            {source.featured_note && (
              <div className="mt-2.5 flex items-start gap-1.5 px-3 py-2 bg-orange-100 rounded-lg">
                <i className="ri-alert-line text-orange-500 w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 mt-0.5"></i>
                <p className="text-[11px] text-orange-700 leading-relaxed">{source.featured_note}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-orange-600 cursor-pointer rounded-lg hover:bg-orange-100"
            >
              <i className="ri-external-link-line text-sm"></i>
            </a>
          )}
          <button
            onClick={() => onToggle(source.id)}
            className={`px-3 py-1.5 text-xs rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
              source.is_enabled
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
          >
            {source.is_enabled ? t('factorSources.toggleDisable') : t('factorSources.toggleEnable')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Regular Source Card ──────────────────────────────────────────────────────

interface SourceCardProps {
  source: FactorSourceDTO;
  onToggle: (id: string) => void;
  levelLabel: string;
  moduleLabels: Record<ApplicableModule, string>;
  statusLabel: string;
  t: (key: string) => string;
}

function SourceCard({ source, onToggle, levelLabel, moduleLabels, statusLabel, t }: SourceCardProps) {
  return (
    <div className={`bg-white border rounded-xl px-5 py-4 transition-all ${source.is_enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg flex-shrink-0 text-xs font-bold text-gray-600 mt-0.5">
            {source.priority}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900">{source.source_name}</span>
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${SOURCE_TYPE_COLORS[source.source_type]}`}>
                {t(`factorSources.sourceTypes.${source.source_type}`)}
              </span>
              <DataLevelBadge level={source.data_level} label={levelLabel} />
              {!source.is_enabled && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 rounded-full">
                  {t('factorSources.disabled')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-gray-400 font-mono">{source.source_code}</span>
              {source.region && (
                <span className="text-xs text-gray-500">
                  <i className="ri-map-pin-line mr-0.5"></i>{source.region}
                </span>
              )}
              <PlatformStatusTag status={source.update_status} label={statusLabel} />
              {source.last_updated && (
                <span className="text-xs text-gray-400">
                  {t('factorSources.fields.lastUpdated')}: {source.last_updated}
                </span>
              )}
            </div>

            {source.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{source.description}</p>
            )}

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] text-gray-400 font-medium mr-0.5">
                {t('factorSources.applicableModules')}:
              </span>
              {source.applicable_modules.map((mod) => (
                <ModuleChip key={mod} module={mod} label={moduleLabels[mod]} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-teal-600 cursor-pointer rounded-lg hover:bg-gray-100"
            >
              <i className="ri-external-link-line text-sm"></i>
            </a>
          )}
          <button
            onClick={() => onToggle(source.id)}
            className={`px-3 py-1.5 text-xs rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
              source.is_enabled
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
            }`}
          >
            {source.is_enabled ? t('factorSources.toggleDisable') : t('factorSources.toggleEnable')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FactorSourcesPage() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<FactorSourceDTO[]>(MOCK_SOURCES);
  const [filterType, setFilterType] = useState<FactorSourceType | 'all'>('all');
  const [filterLevel, setFilterLevel] = useState<DataLevel | 'all'>('all');

  const orgSources = sources.filter(
    (s) => s.source_type === 'monitored' || s.source_type === 'org_specific'
  );
  const featuredSource = sources.find((s) => s.is_featured);
  const regularSources = sources.filter(
    (s) => !s.is_featured && s.source_type !== 'monitored' && s.source_type !== 'org_specific'
  );

  const filteredOrgSources = orgSources.filter((s) => {
    const matchType = filterType === 'all' || s.source_type === filterType;
    const matchLevel = filterLevel === 'all' || s.data_level === filterLevel;
    return matchType && matchLevel;
  });

  const featuredMatchesFilter =
    featuredSource &&
    (filterType === 'all' || featuredSource.source_type === filterType) &&
    (filterLevel === 'all' || featuredSource.data_level === filterLevel);

  const filteredRegular = regularSources.filter((s) => {
    const matchType = filterType === 'all' || s.source_type === filterType;
    const matchLevel = filterLevel === 'all' || s.data_level === filterLevel;
    return matchType && matchLevel;
  });

  const toggleEnabled = (id: string) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, is_enabled: !s.is_enabled } : s)));
  };

  const levelLabel = (level: DataLevel): string => t(`factorSources.dataLevels.${level}`);
  const statusLabel = (status: SourceUpdateStatus): string =>
    t(`factorSources.platformStatus.${status}`);

  const moduleLabels: Record<ApplicableModule, string> = {
    ghg_inventory: t('factorSources.modules.ghg_inventory'),
    product_cfp: t('factorSources.modules.product_cfp'),
    lca: t('factorSources.modules.lca'),
    esg_report: t('factorSources.modules.esg_report'),
    scope2_market: t('factorSources.modules.scope2_market'),
    ifrs_s1_s2: t('factorSources.modules.ifrs_s1_s2'),
  };

  const subtypeLabel = (source: FactorSourceDTO): string => {
    if (source.org_source_subtype) {
      return t(`factorSources.orgSources.subtypes.${source.org_source_subtype}`);
    }
    return t(`factorSources.sourceTypes.${source.source_type}`);
  };

  const resolutionLabel = (tier: ResolutionPriorityTier): string =>
    t(`factorSources.resolutionTiers.${tier}`);

  const showOrgSection =
    filterType === 'all' || filterType === 'monitored' || filterType === 'org_specific';

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {t('factorSources.title')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{t('factorSources.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
              <i className="ri-refresh-line w-4 h-4 flex items-center justify-center"></i>
              {t('factorSources.syncAll')}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer whitespace-nowrap">
              <i className="ri-add-line w-4 h-4 flex items-center justify-center"></i>
              {t('factorSources.addSource')}
            </button>
          </div>
        </div>

        {/* Codex note */}
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <i className="ri-information-line w-4 h-4 flex items-center justify-center mt-0.5 flex-shrink-0"></i>
          <span>{t('factorSources.codexNote')}</span>
        </div>

        {/* ── Platform governance status legend ─────────────────────────────── */}
        <div className="flex items-start gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
          <i className="ri-shield-star-line w-4 h-4 flex items-center justify-center text-gray-400 mt-0.5 flex-shrink-0"></i>
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-600 mb-1.5">
              {t('factorSources.platformStatusLegend.title')}
            </p>
            <p className="text-[11px] text-gray-500 mb-2">
              {t('factorSources.platformStatusLegend.desc')}
            </p>
            <div className="flex flex-wrap gap-3">
              {(['active_latest', 'new_version_detected', 'pending_platform_review', 'deprecated', 'legacy_reference'] as SourceUpdateStatus[]).map((s) => (
                <PlatformStatusTag key={s} status={s} label={t(`factorSources.platformStatus.${s}`)} />
              ))}
            </div>
          </div>
        </div>

        {/* ── CFP_P_02 Featured Card ─────────────────────────────────────────── */}
        {featuredSource && featuredMatchesFilter && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-700">
                {t('factorSources.featuredSection')}
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-700 rounded-full">
                {t('factorSources.featuredBadge')}
              </span>
            </div>
            <FeaturedSourceCard
              source={featuredSource}
              onToggle={toggleEnabled}
              levelLabel={levelLabel(featuredSource.data_level)}
              moduleLabels={moduleLabels}
              statusLabel={statusLabel(featuredSource.update_status)}
              t={t}
            />
          </div>
        )}

        {/* ── Org Sources Section ────────────────────────────────────────────── */}
        {showOrgSection && filteredOrgSources.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl">
              <i className="ri-building-2-line w-4 h-4 flex items-center justify-center text-teal-600 mt-0.5 flex-shrink-0"></i>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-teal-800">
                    {t('factorSources.orgSources.sectionTitle')}
                  </p>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-600 text-white rounded-full">
                    {t('factorSources.orgSources.sectionBadge')}
                  </span>
                </div>
                <p className="text-xs text-teal-700 mt-0.5">
                  {t('factorSources.orgSources.sectionDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
              <i className="ri-stack-line w-4 h-4 flex items-center justify-center text-gray-500 mt-0.5 flex-shrink-0"></i>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-700 mb-1.5">
                  {t('factorSources.orgSources.resolutionNote')}
                </p>
                <p className="text-xs text-gray-500">
                  {t('factorSources.orgSources.resolutionDesc')}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(['tier_0_validated_org', 'tier_1_primary', 'tier_2_secondary', 'tier_3_tertiary', 'tier_4_fallback'] as ResolutionPriorityTier[]).map((tier) => (
                    <ResolutionTierBadge key={tier} tier={tier} label={t(`factorSources.resolutionTiers.${tier}`)} />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['monitoring_source', 'direct_activity_data', 'org_factor'] as OrgSourceSubtype[]).map((subtype) => (
                <div key={subtype} className={`flex items-start gap-2 px-3 py-2.5 border rounded-lg ${ORG_SUBTYPE_COLORS[subtype]}`}>
                  <i className={`${ORG_SUBTYPE_ICONS[subtype]} w-4 h-4 flex items-center justify-center text-teal-600 mt-0.5 flex-shrink-0`}></i>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-800">
                      {t(`factorSources.orgSources.subtypes.${subtype}`)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {t(`factorSources.orgSources.subtypeDesc.${subtype}`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {filteredOrgSources.map((source) => (
                <OrgSourceCard
                  key={source.id}
                  source={source}
                  onToggle={toggleEnabled}
                  levelLabel={levelLabel(source.data_level)}
                  moduleLabels={moduleLabels}
                  subtypeLabel={subtypeLabel(source)}
                  resolutionLabel={source.resolution_priority_tier ? resolutionLabel(source.resolution_priority_tier) : ''}
                  statusLabel={statusLabel(source.update_status)}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Data Level Legend ──────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
          <i className="ri-information-line w-4 h-4 flex items-center justify-center text-gray-400 mt-0.5 flex-shrink-0"></i>
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-600 mb-1.5">
              {t('factorSources.dataLevelLegend.title')}
            </p>
            <div className="flex flex-wrap gap-3">
              {(['primary', 'secondary', 'hybrid', 'fallback'] as DataLevel[]).map((level) => (
                <div key={level} className="flex items-center gap-1.5">
                  <DataLevelBadge level={level} label={levelLabel(level)} />
                  <span className="text-[11px] text-gray-500">
                    {t(`factorSources.dataLevelLegend.${level}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
              {t('factorSources.filterByType')}:
            </span>
            {(['all', 'official', 'global', 'industry', 'monitored', 'org_specific', 'fallback'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 text-xs rounded-full cursor-pointer whitespace-nowrap transition-colors ${
                  filterType === type
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'all' ? t('common.all') : t(`factorSources.sourceTypes.${type}`)}
              </button>
            ))}
          </div>

          <div className="hidden sm:block w-px h-5 bg-gray-200"></div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
              {t('factorSources.filterByLevel')}:
            </span>
            {(['all', 'primary', 'secondary', 'hybrid', 'fallback'] as const).map((level) => (
              <button
                key={level}
                onClick={() => setFilterLevel(level)}
                className={`px-3 py-1.5 text-xs rounded-full cursor-pointer whitespace-nowrap transition-colors ${
                  filterLevel === level
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {level === 'all' ? t('common.all') : levelLabel(level)}
              </button>
            ))}
          </div>
        </div>

        {/* ── External Source Cards ──────────────────────────────────────────── */}
        {(filterType === 'all' || !['monitored', 'org_specific'].includes(filterType)) && (
          <div className="space-y-3">
            {filteredRegular.length === 0 && filteredOrgSources.length === 0 && !featuredMatchesFilter ? (
              <div className="bg-white border border-gray-200 rounded-xl px-6 py-12 text-center text-gray-400">
                <i className="ri-database-2-line text-3xl block mb-2"></i>
                {t('factorSources.empty.title')}
              </div>
            ) : (
              filteredRegular.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  onToggle={toggleEnabled}
                  levelLabel={levelLabel(source.data_level)}
                  moduleLabels={moduleLabels}
                  statusLabel={statusLabel(source.update_status)}
                  t={t}
                />
              ))
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
