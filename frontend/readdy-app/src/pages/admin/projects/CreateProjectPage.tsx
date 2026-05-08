import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/layout/AdminLayout';
import { IS_STAGING, withTestPrefix } from '@/utils/staging';
import { getOrganizations } from '@/services/organizationService';
import { createProject } from '@/services/projectService';
import type { CreateProjectInput, BoundaryType } from '@/types/project';
import type { Organization } from '@/types/organization';

interface FormData {
  name: string;
  project_code: string;
  organization_id: string;
  reporting_start_date: string;
  reporting_end_date: string;
  boundary_type: BoundaryType;
  base_currency: string;
  description: string;
  status: 'draft' | 'active';
}

const BOUNDARY_TYPE_OPTIONS: { value: BoundaryType; labelKey: string }[] = [
  { value: 'operational_control', labelKey: 'projects.boundaryTypes.operationalControl' },
  { value: 'financial_control',   labelKey: 'projects.boundaryTypes.financialControl'   },
  { value: 'equity_share',        labelKey: 'projects.boundaryTypes.equityShare'        },
];

const CURRENCY_OPTIONS = [
  { value: 'TWD', label: 'TWD — 新台幣' },
  { value: 'USD', label: 'USD — 美元' },
  { value: 'EUR', label: 'EUR — 歐元' },
  { value: 'JPY', label: 'JPY — 日圓' },
  { value: 'CNY', label: 'CNY — 人民幣' },
];

export default function CreateProjectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<FormData>({
    name: '',
    project_code: '',
    organization_id: '',
    reporting_start_date: '',
    reporting_end_date: '',
    boundary_type: 'operational_control',
    base_currency: 'TWD',
    description: '',
    status: 'draft',
  });

  const loadOrganizations = useCallback(async () => {
    setOrgsLoading(true);
    try {
      const data = await getOrganizations();
      setOrganizations(data);
      // 若只有一個 org，自動選取
      if (data.length === 1) {
        setFormData((prev) => ({ ...prev, organization_id: data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
    } finally {
      setOrgsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('errors.required');
    }
    if (!formData.organization_id) {
      newErrors.organization_id = t('errors.required');
    }
    if (!formData.reporting_start_date) {
      newErrors.reporting_start_date = t('errors.required');
    }
    if (!formData.reporting_end_date) {
      newErrors.reporting_end_date = t('errors.required');
    }
    if (formData.reporting_start_date && formData.reporting_end_date) {
      if (new Date(formData.reporting_start_date) > new Date(formData.reporting_end_date)) {
        newErrors.reporting_end_date = t('errors.startDateAfterEndDate');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsLoading(true);

      const input: CreateProjectInput = {
        organization_id: formData.organization_id,
        project_code: formData.project_code.trim(),
        name: withTestPrefix(formData.name),
        description: formData.description.trim() || undefined,
        reporting_start_date: formData.reporting_start_date,
        reporting_end_date: formData.reporting_end_date,
        boundary_type: formData.boundary_type,
        base_currency: formData.base_currency,
        status: formData.status,
      };

      await createProject(input);
      navigate('/admin/projects');
    } catch (err) {
      console.error('Failed to create project:', err);
      setErrors({ submit: t('errors.saveFailed') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const hasNoOrgs = !orgsLoading && organizations.length === 0;
  const autoSelected = !orgsLoading && organizations.length === 1;

  return (
    <AdminLayout>
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/projects')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors cursor-pointer"
          >
            <i className="ri-arrow-left-line"></i>
            {t('common.back')}
          </button>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-gray-900">
              {t('projects.create_title')}
            </h1>
            {IS_STAGING && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-extrabold tracking-widest rounded uppercase border border-amber-200">
                TEST MODE
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {t('projects.detail')}
          </p>
          {IS_STAGING && (
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg mt-3">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-test-tube-line text-amber-600 text-sm"></i>
              </div>
              <p className="text-xs text-amber-700">
                {t('staging.test_prefix_hint')}
              </p>
            </div>
          )}
        </div>

        {/* ── No Organizations Empty State ── */}
        {hasNoOrgs && (
          <div className="bg-white rounded-lg border border-amber-200 p-8 text-center">
            <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4 bg-amber-50 rounded-full">
              <i className="ri-building-line text-2xl text-amber-500"></i>
            </div>
            <h2 className="text-base font-semibold text-gray-800 mb-2">
              {t('projects.noOrganizations')}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {t('projects.noOrganizationsHint')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => navigate('/admin/organizations/create')}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-add-line"></i>
                {t('projects.createOrganization')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/projects')}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                {t('common.back')}
              </button>
            </div>
          </div>
        )}

        {/* ── Form (only shown when orgs exist or still loading) ── */}
        {!hasNoOrgs && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="space-y-6">

              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('projects.fields.name')} <span className="text-red-500">*</span>
                </label>
                {IS_STAGING ? (
                  <div className={`flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'}`}>
                    <span className="px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 border-r border-gray-300 whitespace-nowrap select-none">
                      [TEST]
                    </span>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder={t('projects.placeholders.name')}
                      className="flex-1 px-4 py-2 text-sm focus:outline-none bg-white"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder={t('projects.placeholders.name')}
                    className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                  />
                )}
                {IS_STAGING && formData.name && (
                  <p className="mt-1 text-xs text-amber-600">
                    {t('staging.preview_label')}：
                    <span className="font-medium">[TEST] {formData.name}</span>
                  </p>
                )}
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* Project Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('projects.fields.code')}
                </label>
                <input
                  type="text"
                  value={formData.project_code}
                  onChange={(e) => handleChange('project_code', e.target.value)}
                  placeholder={t('projects.placeholders.code')}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-xs text-gray-500 mt-1">{t('common.optional')}</p>
              </div>

              {/* Organization */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('projects.fields.organization')} <span className="text-red-500">*</span>
                </label>

                {orgsLoading ? (
                  <div className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400">
                    {t('common.loading')}
                  </div>
                ) : (
                  <>
                    <select
                      value={formData.organization_id}
                      onChange={(e) => handleChange('organization_id', e.target.value)}
                      className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer ${errors.organization_id ? 'border-red-500' : 'border-gray-300'}`}
                    >
                      <option value="">{t('projects.selectOrganization')}</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.display_name}
                        </option>
                      ))}
                    </select>
                    {autoSelected && (
                      <p className="text-xs text-teal-600 mt-1 flex items-center gap-1">
                        <i className="ri-checkbox-circle-line"></i>
                        {t('projects.autoSelectedOrg')}
                      </p>
                    )}
                    {errors.organization_id && (
                      <p className="text-xs text-red-500 mt-1">{errors.organization_id}</p>
                    )}
                  </>
                )}
              </div>

              {/* Boundary Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('projects.fields.boundaryType')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.boundary_type}
                  onChange={(e) => handleChange('boundary_type', e.target.value as BoundaryType)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  {BOUNDARY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('projects.fields.startDate')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.reporting_start_date}
                    onChange={(e) => handleChange('reporting_start_date', e.target.value)}
                    className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${errors.reporting_start_date ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.reporting_start_date && (
                    <p className="text-xs text-red-500 mt-1">{errors.reporting_start_date}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('projects.fields.endDate')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.reporting_end_date}
                    onChange={(e) => handleChange('reporting_end_date', e.target.value)}
                    className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${errors.reporting_end_date ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  {errors.reporting_end_date && (
                    <p className="text-xs text-red-500 mt-1">{errors.reporting_end_date}</p>
                  )}
                </div>
              </div>

              {/* Base Currency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('projects.fields.baseCurrency')}
                </label>
                <select
                  value={formData.base_currency}
                  onChange={(e) => handleChange('base_currency', e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('projects.fields.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder={t('projects.placeholders.description')}
                  rows={4}
                  maxLength={500}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {formData.description.length} / 500
                </p>
              </div>

              {/* Submit Error */}
              {errors.submit && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => navigate('/admin/projects')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isLoading || orgsLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                >
                  {isLoading ? t('common.loading') : t('common.create')}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}
