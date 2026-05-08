import { useState, useEffect, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import type { Organization, UpdateOrganizationInput } from '../../../types/organization';
import GovernanceBanner from '../../../components/feature/GovernanceBanner';

export default function EditOrganizationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [formData, setFormData] = useState<UpdateOrganizationInput>({
    id: id || '',
    name: '',
    tax_id: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    industry: '',
    description: '',
    status: 'active',
  });

  useEffect(() => {
    loadOrganization();
  }, [id]);

  const loadOrganization = async () => {
    try {
      setLoading(true);
      // TODO: 實際 API 呼叫將由 Supabase 連接後實作
      // const { data, error } = await supabase.from('organizations').select('*').eq('id', id).single();
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock: 如果沒有資料,顯示錯誤
      setErrors({ load: t('errors.notFound') });
      setLoading(false);
    } catch (err) {
      setErrors({ load: t('errors.loadFailed') });
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = t('organizations.validation.nameRequired');
    }

    if (!formData.tax_id?.trim()) {
      newErrors.tax_id = t('organizations.validation.taxIdRequired');
    } else if (!/^\d{8}$/.test(formData.tax_id)) {
      newErrors.tax_id = t('organizations.validation.taxIdInvalid');
    }

    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = t('organizations.validation.emailInvalid');
    }

    if (formData.contact_phone && !/^[\d\s\-\+\(\)]+$/.test(formData.contact_phone)) {
      newErrors.contact_phone = t('organizations.validation.phoneInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      // TODO: 實際 API 呼叫將由 Supabase 連接後實作
      // const { data, error } = await supabase.from('organizations').update(formData).eq('id', id).select().single();
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      navigate('/admin/organizations');
    } catch (err) {
      console.error('Update failed:', err);
      setErrors({ submit: t('organizations.messages.updateFailed') });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof UpdateOrganizationInput, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <LoadingState message={t('common.loading')} />
      </AdminLayout>
    );
  }

  if (errors.load) {
    return (
      <AdminLayout>
        <ErrorState
          title={t('errors.loadFailed')}
          message={errors.load}
          action={
            <button
              onClick={() => navigate('/admin/organizations')}
              className="px-4 py-2 bg-teal-500 text-white text-sm font-medium rounded-lg hover:bg-teal-600 whitespace-nowrap cursor-pointer"
            >
              {t('common.back')}
            </button>
          }
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/organizations')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 cursor-pointer whitespace-nowrap"
          >
            <i className="ri-arrow-left-line w-4 h-4 flex items-center justify-center"></i>
            <span>{t('common.back')}</span>
          </button>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">{t('organizations.edit')}</h1>
          <p className="text-sm text-gray-600">{t('organizations.title')}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Workspace semantic notice */}
          <GovernanceBanner
            variant="internal"
            message={t('organizations.workspaceNoticeDesc', '此處編輯的是工作空間層級資訊。盤查法人（Legal Entity）與據點（Site）將於下一階段獨立管理。')}
          />

          <div className="space-y-6">
            {/* Organization Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.name')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={t('organizations.fields.namePlaceholder')}
                className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>

            {/* Tax ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.taxId')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.tax_id}
                onChange={(e) => handleChange('tax_id', e.target.value)}
                placeholder={t('organizations.fields.taxIdPlaceholder')}
                maxLength={8}
                className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.tax_id ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.tax_id && <p className="mt-1 text-sm text-red-500">{errors.tax_id}</p>}
            </div>

            {/* Contact Person */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.contactPerson')}
              </label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => handleChange('contact_person', e.target.value)}
                placeholder={t('organizations.fields.contactPersonPlaceholder')}
                className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Contact Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.contactEmail')}
              </label>
              <input
                type="email"
                value={formData.contact_email}
                onChange={(e) => handleChange('contact_email', e.target.value)}
                placeholder={t('organizations.fields.contactEmailPlaceholder')}
                className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.contact_email ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.contact_email && <p className="mt-1 text-sm text-red-500">{errors.contact_email}</p>}
            </div>

            {/* Contact Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.contactPhone')}
              </label>
              <input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => handleChange('contact_phone', e.target.value)}
                placeholder={t('organizations.fields.contactPhonePlaceholder')}
                className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.contact_phone ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.contact_phone && <p className="mt-1 text-sm text-red-500">{errors.contact_phone}</p>}
            </div>

            {/* Industry */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.industry')}
              </label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => handleChange('industry', e.target.value)}
                placeholder={t('organizations.fields.industryPlaceholder')}
                className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.address')}
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder={t('organizations.fields.addressPlaceholder')}
                className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder={t('organizations.fields.descriptionPlaceholder')}
                rows={4}
                maxLength={500}
                className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.status')}
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="active">{t('status.active')}</option>
                <option value="inactive">{t('status.inactive')}</option>
              </select>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/admin/organizations')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 whitespace-nowrap cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}