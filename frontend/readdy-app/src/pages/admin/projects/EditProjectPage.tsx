import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import type { UpdateProjectInput, ProjectType } from '../../../types/project';
import type { Organization } from '../../../types/organization';

export default function EditProjectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<UpdateProjectInput>({
    id: id || '',
    name: '',
    code: '',
    organization_id: '',
    project_type: 'corporate',
    start_date: '',
    end_date: '',
    description: '',
    status: 'draft',
    baseline_year: undefined,
    reduction_target: undefined,
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // TODO: Replace with actual Supabase queries
      // Load project data
      // const { data: projectData, error: projectError } = await supabase
      //   .from('projects')
      //   .select('*')
      //   .eq('id', id)
      //   .single();
      // if (projectError) throw projectError;
      
      // Load organizations
      // const { data: orgsData, error: orgsError } = await supabase
      //   .from('organizations')
      //   .select('*')
      //   .eq('status', 'active');
      // if (orgsError) throw orgsError;
      
      // setFormData(projectData);
      // setOrganizations(orgsData || []);
    } catch (err) {
      console.error('Failed to load project:', err);
      setError(t('errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = t('errors.required');
    }

    if (!formData.organization_id) {
      newErrors.organization_id = t('errors.required');
    }

    if (!formData.start_date) {
      newErrors.start_date = t('errors.required');
    }

    if (!formData.end_date) {
      newErrors.end_date = t('errors.required');
    }

    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      if (startDate > endDate) {
        newErrors.end_date = t('errors.startDateAfterEndDate');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsSaving(true);
      
      // TODO: Implement Supabase update
      // const { error: updateError } = await supabase
      //   .from('projects')
      //   .update(formData)
      //   .eq('id', id);
      // if (updateError) throw updateError;
      
      navigate('/admin/projects');
    } catch (err) {
      console.error('Failed to update project:', err);
      setErrors({ submit: t('errors.saveFailed') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof UpdateProjectInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <LoadingState />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <ErrorState message={error} onRetry={loadData} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/projects')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <i className="ri-arrow-left-line"></i>
            {t('common.back')}
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">{t('projects.edit')}</h1>
          <p className="text-sm text-gray-600 mt-1">{t('projects.detail')}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-6">
            {/* Project Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('projects.fields.name')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={t('projects.placeholders.name')}
                className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            {/* Project Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('projects.fields.code')}
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                placeholder={t('projects.placeholders.code')}
                className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Organization */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('projects.fields.organization')} <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.organization_id}
                onChange={(e) => handleChange('organization_id', e.target.value)}
                className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.organization_id ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">{t('projects.selectOrganization')}</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              {errors.organization_id && <p className="text-xs text-red-500 mt-1">{errors.organization_id}</p>}
            </div>

            {/* Project Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('projects.fields.projectType')} <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.project_type}
                onChange={(e) => handleChange('project_type', e.target.value as ProjectType)}
                className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="corporate">{t('projects.types.corporate')}</option>
                <option value="event">{t('projects.types.event')}</option>
                <option value="product">{t('projects.types.product')}</option>
                <option value="project">{t('projects.types.project')}</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('projects.fields.status')} <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="draft">{t('status.draft')}</option>
                <option value="in_progress">{t('status.in_progress')}</option>
                <option value="completed">{t('status.completed')}</option>
                <option value="archived">{t('status.archived')}</option>
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
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    errors.start_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.start_date && <p className="text-xs text-red-500 mt-1">{errors.start_date}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('projects.fields.endDate')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                  className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    errors.end_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.end_date && <p className="text-xs text-red-500 mt-1">{errors.end_date}</p>}
              </div>
            </div>

            {/* Baseline Year & Reduction Target */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('projects.fields.baseline')}
                </label>
                <input
                  type="number"
                  value={formData.baseline_year || ''}
                  onChange={(e) => handleChange('baseline_year', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="2023"
                  min="2000"
                  max="2100"
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('projects.fields.target')}
                </label>
                <input
                  type="number"
                  value={formData.reduction_target || ''}
                  onChange={(e) => handleChange('reduction_target', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="10"
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
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
                className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isSaving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}