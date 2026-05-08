import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '@/components/layout/AdminLayout';
import type { LifecycleStageCode, ProductCarbonProjectStub, LifecycleStageEntry } from '@/types/capability';

// ─── Feature-flag adapter ─────────────────────────────────────────────────────
// TODO: Replace with real capability gate from Codex subscription API.
// Staging skeleton: product_cfp is gated (coming_soon).
const PRODUCT_CFP_AVAILABLE = false;

// ─── Lifecycle stage order ────────────────────────────────────────────────────
const LIFECYCLE_STAGES: LifecycleStageCode[] = [
  'raw_material',
  'manufacturing',
  'transport',
  'packaging',
  'use',
  'end_of_life',
];

const STAGE_ICONS: Record<LifecycleStageCode, string> = {
  raw_material:   'ri-plant-line',
  manufacturing:  'ri-settings-3-line',
  transport:      'ri-truck-line',
  packaging:      'ri-archive-line',
  use:            'ri-user-line',
  end_of_life:    'ri-recycle-line',
};

// ─── Mock stub data (staging only) ───────────────────────────────────────────
const MOCK_PROJECTS: ProductCarbonProjectStub[] = [
  {
    id: 'pcfp-001',
    name: '環保水瓶 500ml',
    product_code: 'ECO-BTL-500',
    status: 'in_progress',
    total_co2e_kg: 1.24,
    created_at: '2025-03-01T00:00:00Z',
  },
  {
    id: 'pcfp-002',
    name: '辦公椅 Model A',
    product_code: 'CHAIR-A-2024',
    status: 'draft',
    total_co2e_kg: null,
    created_at: '2025-03-15T00:00:00Z',
  },
];

const MOCK_STAGES: LifecycleStageEntry[] = LIFECYCLE_STAGES.map((stage) => ({
  stage,
  co2e_kg: null,
  data_quality: null,
  notes: '',
}));

// ─── Gated overlay ────────────────────────────────────────────────────────────
function GatedOverlay() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl">
      <div className="text-center max-w-sm px-6">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="ri-lock-line text-3xl text-amber-600"></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t('productCarbon.gated.title')}
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {t('productCarbon.gated.desc')}
        </p>
        <button
          onClick={() => navigate('/admin/subscription')}
          className="px-6 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition-colors whitespace-nowrap"
        >
          <i className="ri-vip-crown-line mr-2"></i>
          {t('productCarbon.gated.upgradeButton')}
        </button>
      </div>
    </div>
  );
}

// ─── Project list card ────────────────────────────────────────────────────────
function ProjectCard({ project }: { project: ProductCarbonProjectStub }) {
  const { t } = useTranslation();
  const statusColors: Record<ProductCarbonProjectStub['status'], string> = {
    draft:       'bg-gray-100 text-gray-600',
    in_progress: 'bg-teal-100 text-teal-700',
    completed:   'bg-green-100 text-green-700',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <i className="ri-box-3-line text-orange-500 text-xl"></i>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{project.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{project.product_code}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {project.total_co2e_kg != null && (
          <span className="text-sm font-medium text-gray-700">
            {project.total_co2e_kg.toFixed(2)} kgCO₂e
          </span>
        )}
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[project.status]}`}>
          {t(`productCarbon.status.${project.status}`)}
        </span>
      </div>
    </div>
  );
}

// ─── Lifecycle stage row ──────────────────────────────────────────────────────
function LifecycleStageRow({ entry, index }: { entry: LifecycleStageEntry; index: number }) {
  const { t } = useTranslation();
  const [co2e, setCo2e] = useState(entry.co2e_kg?.toString() ?? '');
  const [notes, setNotes] = useState(entry.notes);

  return (
    <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100">
      {/* Step indicator */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
          <i className={`${STAGE_ICONS[entry.stage]} text-orange-500 text-base`}></i>
        </div>
        {index < LIFECYCLE_STAGES.length - 1 && (
          <div className="w-px h-4 bg-gray-200"></div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 mb-2">
          {t(`productCarbon.lifecycleStages.${entry.stage}`)}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="number"
              value={co2e}
              onChange={(e) => setCo2e(e.target.value)}
              placeholder="0.00"
              className="w-28 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
            <span className="text-xs text-gray-400 whitespace-nowrap">kgCO₂e</span>
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('common.optional')}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>
      </div>

      {/* Data quality badge */}
      <div className="flex-shrink-0">
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
          {entry.data_quality ? t(`productCarbon.dataQuality.${entry.data_quality}`) : '—'}
        </span>
      </div>
    </div>
  );
}

// ─── Total result block ───────────────────────────────────────────────────────
function TotalResultBlock() {
  const { t } = useTranslation();
  // Placeholder — will be driven by real calculation from Codex API
  const mockTotal = 1.24;
  const mockBreakdown: { stage: LifecycleStageCode; value: number }[] = [
    { stage: 'raw_material',  value: 0.42 },
    { stage: 'manufacturing', value: 0.31 },
    { stage: 'transport',     value: 0.18 },
    { stage: 'packaging',     value: 0.15 },
    { stage: 'use',           value: 0.10 },
    { stage: 'end_of_life',   value: 0.08 },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('productCarbon.totalResult.title')}
      </h3>
      <p className="text-xs text-gray-400 mb-5">{t('productCarbon.totalResult.disclaimer')}</p>

      {/* Total */}
      <div className="flex items-baseline gap-2 mb-6">
        <span className="text-4xl font-bold text-orange-600">{mockTotal.toFixed(2)}</span>
        <span className="text-sm text-gray-500">kgCO₂e / 件</span>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {t('productCarbon.totalResult.breakdown')}
        </p>
        {mockBreakdown.map(({ stage, value }) => {
          const pct = (value / mockTotal) * 100;
          return (
            <div key={stage} className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-28 flex-shrink-0">
                {t(`productCarbon.lifecycleStages.${stage}`)}
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-orange-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">
                {value.toFixed(2)} kg
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Certification status block ───────────────────────────────────────────────
function CertificationStatusBlock() {
  const { t } = useTranslation();
  const certs = [
    { key: 'iso14067', icon: 'ri-award-line', ready: false },
    { key: 'epd',      icon: 'ri-file-text-line', ready: false },
  ];
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        {t('productCarbon.certificationStatus.title')}
      </h3>
      <p className="text-xs text-gray-400 mb-5">
        {t('productCarbon.certificationStatus.desc')}
      </p>
      <div className="space-y-3">
        {certs.map(({ key, icon, ready }) => (
          <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                <i className={`${icon} text-gray-400`}></i>
              </div>
              <span className="text-sm text-gray-700">
                {t(`productCarbon.certificationStatus.${key}`)}
              </span>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
              ready ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {ready ? t('capabilities.available') : t('productCarbon.certificationStatus.placeholder')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Create project modal ─────────────────────────────────────────────────────
function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('productCarbon.createTitle')}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('productCarbon.fields.productName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              placeholder={t('productCarbon.fields.productName')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('productCarbon.fields.productCode')}
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              placeholder="e.g. PROD-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('productCarbon.fields.functionalUnit')}
            </label>
            <input
              type="text"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              placeholder="e.g. 1 件 / 1 kg"
            />
          </div>
        </div>

        {/* Codex note */}
        <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs text-amber-700">
            <i className="ri-information-line mr-1"></i>
            此為前端骨架，建立後資料暫存於本地。待 Codex 定義 product_carbon_projects 資料表與 RPC 後，將接入正式後端。
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            {t('common.cancel')}
          </button>
          <button
            disabled={!name.trim()}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {t('common.create')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProductCarbonPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProductCarbonProjectStub | null>(
    MOCK_PROJECTS[0] ?? null
  );

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => navigate('/admin/reports')}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                {t('reports.title')}
              </button>
              <i className="ri-arrow-right-s-line text-gray-300"></i>
              <span className="text-sm text-gray-600">{t('productCarbon.title')}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t('productCarbon.subtitle')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('productCarbon.listDesc')}</p>
          </div>
          <button
            onClick={() => PRODUCT_CFP_AVAILABLE && setShowCreate(true)}
            disabled={!PRODUCT_CFP_AVAILABLE}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <i className="ri-add-line text-base"></i>
            {t('productCarbon.createButton')}
          </button>
        </div>

        {/* Main content — gated */}
        <div className="relative">
          {!PRODUCT_CFP_AVAILABLE && <GatedOverlay />}

          <div className={!PRODUCT_CFP_AVAILABLE ? 'pointer-events-none select-none' : ''}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: project list */}
              <div className="lg:col-span-1 space-y-4">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  {t('productCarbon.listTitle')}
                </h2>
                {MOCK_PROJECTS.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                    <i className="ri-box-3-line text-3xl text-gray-300 mb-2 block"></i>
                    <p className="text-sm text-gray-400">{t('productCarbon.emptyTitle')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {MOCK_PROJECTS.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProject(p)}
                        className={`cursor-pointer transition-all ${
                          selectedProject?.id === p.id ? 'ring-2 ring-orange-400 rounded-xl' : ''
                        }`}
                      >
                        <ProjectCard project={p} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: lifecycle + results */}
              <div className="lg:col-span-2 space-y-6">
                {selectedProject ? (
                  <>
                    {/* Lifecycle stages */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">
                        {t('productCarbon.lifecycleStages.title')}
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          {selectedProject.name}
                        </span>
                      </h3>
                      <div className="space-y-3">
                        {MOCK_STAGES.map((entry, i) => (
                          <LifecycleStageRow key={entry.stage} entry={entry} index={i} />
                        ))}
                      </div>
                    </div>

                    {/* Total result */}
                    <TotalResultBlock />

                    {/* Certification status */}
                    <CertificationStatusBlock />
                  </>
                ) : (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                    <i className="ri-box-3-line text-4xl text-gray-200 mb-3 block"></i>
                    <p className="text-sm text-gray-400">{t('productCarbon.emptyDesc')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </AdminLayout>
  );
}
