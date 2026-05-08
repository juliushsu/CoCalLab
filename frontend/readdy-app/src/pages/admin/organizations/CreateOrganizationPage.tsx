import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import { IS_STAGING, withTestPrefix } from '../../../utils/staging';
import { getSupabaseClient } from '../../../lib/supabase';

interface FormData {
  legal_name: string;
  display_name: string;
  tax_id: string;
  country_code: string;
  timezone: string;
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 64);
}

export default function CreateOrganizationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormData>({
    legal_name: '',
    display_name: '',
    tax_id: '',
    country_code: 'TW',
    timezone: 'Asia/Taipei',
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.legal_name.trim()) {
      newErrors.legal_name = t('organizations.validation.nameRequired', '法定名稱為必填');
    }
    if (!formData.display_name.trim()) {
      newErrors.display_name = t('organizations.validation.displayNameRequired', '顯示名稱為必填');
    }
    if (formData.tax_id && !/^\d{8}$/.test(formData.tax_id)) {
      newErrors.tax_id = t('organizations.validation.taxIdInvalid', '統一編號格式不正確（需為 8 位數字）');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setLoading(true);
      setErrors({});
      const supabase = getSupabaseClient();

      const legalName = IS_STAGING ? withTestPrefix(formData.legal_name) : formData.legal_name;
      const displayName = IS_STAGING ? withTestPrefix(formData.display_name) : formData.display_name;
      const slug = toSlug(displayName) || toSlug(legalName) || `org-${Date.now()}`;

      const payload: Record<string, unknown> = {
        legal_name: legalName,
        display_name: displayName,
        slug,
        tax_id: formData.tax_id.trim() || null,
        country_code: formData.country_code,
        timezone: formData.timezone,
        status: 'active',
        is_test: IS_STAGING,
        env: IS_STAGING ? 'staging' : 'production',
      };

      // 取得目前 session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired, please login again');

      const res = await fetch(
        `${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/create-organization`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Create organization failed');
      }

      navigate('/admin/organizations');
    } catch (err: unknown) {
      console.error('Create organization failed:', err);
      const msg = (err as { message?: string })?.message;
      if (msg?.includes('slug')) {
        setErrors({ slug: t('organizations.validation.slugTaken', '此名稱已被使用，請換一個顯示名稱') });
      } else if (msg?.includes('Session')) {
        setErrors({ submit: t('organizations.messages.sessionExpired', '登入已過期，請重新登入') });
      } else {
        setErrors({ submit: t('organizations.messages.createFailed', '建立失敗，請稍後再試') });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const previewSlug = toSlug(
    IS_STAGING ? withTestPrefix(formData.display_name || formData.legal_name) : (formData.display_name || formData.legal_name)
  );

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
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold text-gray-900">
              {t('organizations.create_title', '建立組織')}
            </h1>
            {IS_STAGING && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-extrabold tracking-widest rounded uppercase border border-amber-200">
                {t('staging.test_mode_badge', 'TEST MODE')}
              </span>
            )}
          </div>
          {IS_STAGING && (
            <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg mt-3">
              <i className="ri-test-tube-line text-amber-600 text-sm w-4 h-4 flex items-center justify-center"></i>
              <p className="text-xs text-amber-700">
                {t('staging.test_prefix_hint', '此環境建立的資料將自動加上 [TEST] 標記，例如：[TEST] 組織名稱')}
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-6">
            {/* Legal Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.legalName', '法定名稱')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.legal_name}
                onChange={e => handleChange('legal_name', e.target.value)}
                placeholder={t('organizations.fields.legalNamePlaceholder', '請輸入公司登記名稱')}
                className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${errors.legal_name ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.legal_name && <p className="mt-1 text-sm text-red-500">{errors.legal_name}</p>}
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.displayName', '顯示名稱')} <span className="text-red-500">*</span>
              </label>
              {IS_STAGING ? (
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-transparent">
                  <span className="px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 border-r border-gray-300 whitespace-nowrap select-none">
                    [TEST]
                  </span>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={e => handleChange('display_name', e.target.value)}
                    placeholder={t('organizations.fields.displayNamePlaceholder', '對外顯示的商業名稱')}
                    className={`flex-1 px-4 py-2 text-sm focus:outline-none bg-white ${errors.display_name ? 'bg-red-50' : ''}`}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={e => handleChange('display_name', e.target.value)}
                  placeholder={t('organizations.fields.displayNamePlaceholder', '對外顯示的商業名稱')}
                  className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${errors.display_name ? 'border-red-500' : 'border-gray-300'}`}
                />
              )}
              {errors.display_name && <p className="mt-1 text-sm text-red-500">{errors.display_name}</p>}
              {errors.slug && <p className="mt-1 text-sm text-red-500">{errors.slug}</p>}
              {previewSlug && (
                <p className="mt-1 text-xs text-gray-500">
                  Slug 預覽：<span className="font-mono text-teal-700">{previewSlug}</span>
                </p>
              )}
            </div>

            {/* Tax ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.taxId', '統一編號')}
              </label>
              <input
                type="text"
                value={formData.tax_id}
                onChange={e => handleChange('tax_id', e.target.value)}
                placeholder={t('organizations.fields.taxIdPlaceholder', '請輸入 8 位數統一編號（選填）')}
                maxLength={8}
                className={`w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 ${errors.tax_id ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.tax_id && <p className="mt-1 text-sm text-red-500">{errors.tax_id}</p>}
            </div>

            {/* Country Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.countryCode', '國家 / 地區')}
              </label>
              <select
                value={formData.country_code}
                onChange={e => handleChange('country_code', e.target.value)}
                className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="TW">台灣 (TW)</option>
                <option value="JP">日本 (JP)</option>
                <option value="US">美國 (US)</option>
                <option value="SG">新加坡 (SG)</option>
              </select>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('organizations.fields.timezone', '時區')}
              </label>
              <select
                value={formData.timezone}
                onChange={e => handleChange('timezone', e.target.value)}
                className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="Asia/Taipei">Asia/Taipei (UTC+8)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                <option value="America/New_York">America/New_York (UTC-5/-4)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (UTC-8/-7)</option>
                <option value="Europe/London">Europe/London (UTC+0/+1)</option>
                <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
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
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-500 rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                {loading ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
