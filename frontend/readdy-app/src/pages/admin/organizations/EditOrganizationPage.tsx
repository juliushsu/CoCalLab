import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import GovernanceBanner from '../../../components/feature/GovernanceBanner';
import { getOrganizationById, updateOrganization } from '../../../services/organizationService';
import { isSupabaseConnected } from '../../../lib/supabase';
import type { Organization, UpdateOrganizationInput } from '../../../types/organization';

export default function EditOrganizationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [form, setForm] = useState<UpdateOrganizationInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [retry, setRetry] = useState(0);
  const saveGeneration = useRef(0);
  // Invalidate pending saves before a new route paints and on unmount.
  useLayoutEffect(() => {
    saveGeneration.current += 1;
    setSaving(false);
    return () => { saveGeneration.current += 1; };
  }, [id]);


  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(''); setForm(null); setSaveError('');
    const load = async () => {
      if (!id) throw new Error('缺少組織識別碼。');
      if (!isSupabaseConnected()) throw new Error('尚未設定服務連線。');
      const row = await getOrganizationById(id);
      if (!row) throw new Error('找不到組織，或您沒有存取權限。');
      if (active) {
        setOrganization(row);
        setForm({id:row.id,legal_name:row.legal_name,display_name:row.display_name,tax_id:row.tax_id || '',country_code:row.country_code,timezone:row.timezone});
      }
    };
    load().catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : '無法載入組織。');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || form.id !== id || saving) return;
    const generation = saveGeneration.current;
    setSaving(true); setSaveError('');
    try {
      await updateOrganization(form);
      if (generation === saveGeneration.current) navigate('/admin/organizations');
    } catch (error: unknown) {
      if (generation === saveGeneration.current) setSaveError(error instanceof Error ? error.message : '儲存失敗。請確認您具備管理權限，且組織可寫入。');
    } finally { if (generation === saveGeneration.current) setSaving(false); }
  };
  const fields = [
    { key:'legal_name' as const, label:'法定名稱', required:true },
    { key:'display_name' as const, label:t('organizations.fields.name'), required:true },
    { key:'tax_id' as const, label:t('organizations.fields.taxId'), required:false },
    { key:'country_code' as const, label:'國家代碼（兩碼）', required:true },
    { key:'timezone' as const, label:'時區（例如 Asia/Taipei）', required:true },
  ];
  return <AdminLayout><div className="max-w-3xl mx-auto">
    {loading || (form && form.id !== id) ? <LoadingState /> : loadError ? <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} /> : form && <>
      <h1 className="text-2xl font-semibold mb-6">{t('organizations.edit')}</h1>
      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-6">
        <GovernanceBanner variant="internal" message={t('organizations.workspaceNoticeDesc', '此處編輯工作空間資訊；盤查法人與據點另行管理。')} />
        <p className="text-sm text-gray-500">代碼：{organization?.slug} · 狀態：{organization?.status}（唯讀）</p>
        <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
          {fields.map(field => <label key={field.key} className="block text-sm font-medium text-gray-700">
            {field.label}{field.required ? ' *' : ''}
            <input className="mt-2 w-full px-4 py-2 border rounded-lg" type="text" required={field.required} value={form[field.key] || ''}
              maxLength={field.key === 'country_code' ? 2 : undefined}
              onChange={event => setForm(current => current ? {...current,[field.key]:event.target.value} : current)} />
          </label>)}
        </fieldset>
        {saveError && <p role="alert" className="p-4 bg-red-50 text-red-700 rounded-lg">{saveError}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className="px-4 py-2 border rounded-lg" disabled={saving} onClick={() => navigate('/admin/organizations')}>{t('common.cancel')}</button>
          <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-50" disabled={saving}>{saving ? t('common.loading') : t('common.save')}</button>
        </div>
      </form>
    </>}
  </div></AdminLayout>;
}
