import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import { getProjectById, updateProject } from '../../../services/projectService';
import { isSupabaseConnected } from '../../../lib/supabase';
import type { Project, UpdateProjectInput, BoundaryType } from '../../../types/project';

export default function EditProjectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [form, setForm] = useState<UpdateProjectInput | null>(null);
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
      if (!id) throw new Error('缺少專案識別碼。');
      if (!isSupabaseConnected()) throw new Error('尚未設定服務連線。');
      const row = await getProjectById(id);
      if (!row) throw new Error('找不到專案，或您沒有存取權限。');
      if (active) {
        setProject(row);
        setForm({id:row.id,organization_id:row.organization_id,name:row.name,project_code:row.project_code,description:row.description || '',reporting_start_date:row.reporting_start_date,reporting_end_date:row.reporting_end_date,boundary_type:row.boundary_type,base_currency:row.base_currency});
      }
    };
    load().catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : '無法載入專案。');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || form.id !== id || !project || saving) return;
    const generation = saveGeneration.current;
    setSaving(true); setSaveError('');
    try {
      // Always use the original loaded tenant, even if form state changes.
      await updateProject({...form,organization_id:project.organization_id});
      if (generation === saveGeneration.current) navigate(`/admin/projects/${form.id}`);
    } catch (error: unknown) {
      if (generation === saveGeneration.current) setSaveError(error instanceof Error ? error.message : '儲存失敗。請確認您具備編輯權限，且組織可寫入。');
    } finally { if (generation === saveGeneration.current) setSaving(false); }
  };
  const fields = [
    {key:'name' as const,label:t('projects.fields.name'),type:'text'},
    {key:'project_code' as const,label:t('projects.fields.code'),type:'text'},
    {key:'reporting_start_date' as const,label:t('projects.fields.startDate'),type:'date'},
    {key:'reporting_end_date' as const,label:t('projects.fields.endDate'),type:'date'},
    {key:'base_currency' as const,label:'基準貨幣（三碼）',type:'text'},
  ];
  return <AdminLayout><div className="max-w-3xl mx-auto">
    {loading || (form && form.id !== id) ? <LoadingState /> : loadError ? <ErrorState message={loadError} onRetry={() => setRetry(value => value + 1)} /> : form && <>
      <h1 className="text-2xl font-semibold mb-6">{t('projects.edit')}</h1>
      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-6">
        <p className="text-sm text-gray-500">組織：{project?.organization_name || project?.organization_id} · 狀態：{project?.status}（唯讀）</p>
        <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
          {fields.map(field => <label key={field.key} className="block text-sm font-medium text-gray-700">
            {field.label} *
            <input className="mt-2 w-full px-4 py-2 border rounded-lg" type={field.type} required value={form[field.key]}
              maxLength={field.key === 'base_currency' ? 3 : undefined}
              min={field.key === 'reporting_end_date' ? form.reporting_start_date : undefined}
              onChange={event => setForm(current => current ? {...current,[field.key]:event.target.value} : current)} />
          </label>)}
          <label className="block text-sm font-medium text-gray-700">組織邊界
            <select className="mt-2 w-full px-4 py-2 border rounded-lg" value={form.boundary_type} onChange={event => setForm(current => current ? {...current,boundary_type:event.target.value as BoundaryType} : current)}>
              <option value="operational_control">營運控制權</option><option value="financial_control">財務控制權</option><option value="equity_share">股權比例</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">{t('projects.fields.description')}
            <textarea className="mt-2 w-full px-4 py-2 border rounded-lg" rows={4} value={form.description || ''} onChange={event => setForm(current => current ? {...current,description:event.target.value} : current)} />
          </label>
        </fieldset>
        {saveError && <p role="alert" className="p-4 bg-red-50 text-red-700 rounded-lg">{saveError}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className="px-4 py-2 border rounded-lg" disabled={saving} onClick={() => navigate('/admin/projects')}>{t('common.cancel')}</button>
          <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-50" disabled={saving}>{saving ? t('common.loading') : t('common.save')}</button>
        </div>
      </form>
    </>}
  </div></AdminLayout>;
}
