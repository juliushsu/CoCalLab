import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSupabaseClient } from '@/lib/supabase';
import { IS_STAGING } from '@/utils/staging';
import { getSuggestedScope } from '@/utils/categoryScope';

interface CreateActivityModalProps {
  projectId?: string;
  onClose: () => void;
  onCreated: () => void;
}

interface FormData {
  activity_name: string;
  category: string;
  final_scope: string;
  quantity: string;
  unit: string;
  activity_date: string;
  notes: string;
}

const SCOPE_OPTIONS = ['1', '2', '3'];

const CATEGORY_OPTIONS = [
  'energy',
  'transport',
  'waste',
  'water',
  'materials',
  'refrigerants',
  'business_travel',
  'employee_commuting',
  'other',
];

export default function CreateActivityModal({ projectId, onClose, onCreated }: CreateActivityModalProps) {
  const { t } = useTranslation();

  const [form, setForm] = useState<FormData>({
    activity_name: '',
    category: '',
    final_scope: '',
    quantity: '',
    unit: '',
    activity_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track whether user has manually overridden the auto-suggested scope
  const [scopeOverridden, setScopeOverridden] = useState(false);
  // Track the last auto-suggested scope so we can detect manual changes
  const [suggestedScope, setSuggestedScope] = useState<string | null>(null);

  const handleChange = (field: keyof FormData, value: string) => {
    if (field === 'category') {
      const suggested = getSuggestedScope(value);
      if (suggested && !scopeOverridden) {
        // Auto-fill scope only if user hasn't manually overridden it
        setSuggestedScope(suggested);
        setForm(prev => ({ ...prev, category: value, final_scope: suggested }));
      } else if (!value) {
        // Category cleared — reset scope suggestion state
        setSuggestedScope(null);
        setScopeOverridden(false);
        setForm(prev => ({ ...prev, category: value, final_scope: '' }));
      } else {
        setSuggestedScope(suggested);
        setForm(prev => ({ ...prev, category: value }));
      }
      return;
    }

    if (field === 'final_scope') {
      // User manually changed scope — mark as overridden
      if (suggestedScope && value !== suggestedScope) {
        setScopeOverridden(true);
      } else if (value === suggestedScope) {
        // User changed back to suggested value — clear override flag
        setScopeOverridden(false);
      }
    }

    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validate = (): string | null => {
    if (!form.activity_name.trim()) return t('activities.create.errors.nameRequired');
    if (!form.activity_date) return t('activities.create.errors.dateRequired');
    if (form.quantity && isNaN(Number(form.quantity))) return t('activities.create.errors.quantityInvalid');
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('errors.unauthorized'));

      // Get org id from project if projectId provided
      let organizationId: string | null = null;
      if (projectId) {
        const { data: proj } = await supabase
          .from('projects')
          .select('organization_id')
          .eq('id', projectId)
          .maybeSingle();
        organizationId = proj?.organization_id ?? null;
      }

      if (!organizationId) {
        // fallback: get first org for user
        const { data: member } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .maybeSingle();
        organizationId = member?.organization_id ?? null;
      }

      if (!organizationId) throw new Error(t('documents.orgNotFound'));

      const activityName = IS_STAGING
        ? `[TEST] ${form.activity_name.trim()}`
        : form.activity_name.trim();

      const payload: Record<string, any> = {
        organization_id: organizationId,
        activity_name: activityName,
        activity_date: form.activity_date,
        category: form.category || 'unclassified',
        activity_type: 'manual',
        activity_code: `MANUAL-${Date.now()}`,
        quantity: form.quantity ? Number(form.quantity) : 0,
        unit: form.unit || '-',
        data_quality: 'primary',
        inclusion_status: 'pending',
        status: 'active',
        created_by_user_id: user.id,
      };

      if (form.final_scope) {
        payload.final_scope = Number(form.final_scope);
        payload.suggested_scope = Number(form.final_scope);
      }

      if (form.notes.trim()) {
        payload.review_note = form.notes.trim();
      }

      if (projectId) {
        payload.project_id = projectId;
      }

      const { error: insertError } = await supabase
        .from('emission_activities')
        .insert(payload);

      if (insertError) throw insertError;

      onCreated();
    } catch (err: any) {
      console.error('Create activity failed:', err);
      setError(err.message || t('errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryLabel = (cat: string) => {
    return t(`activities.categoryLabels.${cat}`, cat);
  };

  const getScopeHelperText = (): { text: string; type: 'suggested' | 'overridden' | 'none' | 'no-suggestion' } => {
    if (!form.category) return { text: '', type: 'none' };
    if (suggestedScope === null) return { text: t('activities.create.scopeNoSuggestion'), type: 'no-suggestion' };
    if (scopeOverridden) return { text: t('activities.create.scopeOverridden'), type: 'overridden' };
    if (form.final_scope === suggestedScope) return { text: t('activities.create.scopeSuggested'), type: 'suggested' };
    return { text: '', type: 'none' };
  };

  const scopeHelper = getScopeHelperText();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center bg-teal-100 rounded-lg flex-shrink-0">
              <i className="ri-add-circle-line text-teal-600 text-lg"></i>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{t('activities.create.title')}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{t('activities.create.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Staging notice */}
        {IS_STAGING && (
          <div className="mx-6 mt-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <i className="ri-test-tube-line text-amber-500 text-sm flex-shrink-0"></i>
            <p className="text-xs text-amber-700">{t('activities.create.stagingNotice')}</p>
          </div>
        )}

        {/* Pending write API notice */}
        <div className="mx-6 mt-4 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <i className="ri-information-line text-blue-500 text-sm flex-shrink-0"></i>
          <p className="text-xs text-blue-700">{t('activities.create.pendingWriteNotice')}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Activity Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('activities.fields.activity_name')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={form.activity_name}
              onChange={e => handleChange('activity_name', e.target.value)}
              placeholder={t('activities.create.placeholders.name')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled={submitting}
            />
          </div>

          {/* Category + Scope row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('activities.fields.category')}
              </label>
              <select
                value={form.category}
                onChange={e => handleChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={submitting}
              >
                <option value="">{t('activities.create.placeholders.selectCategory')}</option>
                {CATEGORY_OPTIONS.map(cat => (
                  <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('activities.fields.scope')}
                {suggestedScope && !scopeOverridden && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-normal text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">
                    <i className="ri-magic-line text-xs"></i>
                    Auto
                  </span>
                )}
                {scopeOverridden && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-normal text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                    <i className="ri-edit-line text-xs"></i>
                    Manual
                  </span>
                )}
              </label>
              <select
                value={form.final_scope}
                onChange={e => handleChange('final_scope', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                  suggestedScope && !scopeOverridden && form.final_scope
                    ? 'border-teal-300 bg-teal-50/30'
                    : scopeOverridden
                    ? 'border-orange-300 bg-orange-50/20'
                    : 'border-gray-300'
                }`}
                disabled={submitting}
              >
                <option value="">{t('activities.create.placeholders.selectScope')}</option>
                {SCOPE_OPTIONS.map(s => (
                  <option key={s} value={s}>Scope {s}</option>
                ))}
              </select>
              {/* Scope helper text */}
              {scopeHelper.type !== 'none' && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${
                  scopeHelper.type === 'suggested' ? 'text-teal-600' :
                  scopeHelper.type === 'overridden' ? 'text-orange-600' :
                  'text-gray-400'
                }`}>
                  <i className={`${
                    scopeHelper.type === 'suggested' ? 'ri-magic-line' :
                    scopeHelper.type === 'overridden' ? 'ri-edit-line' :
                    'ri-information-line'
                  } text-xs`}></i>
                  {scopeHelper.text}
                </p>
              )}
            </div>
          </div>

          {/* Quantity + Unit row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('activities.fields.quantity')}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.quantity}
                onChange={e => handleChange('quantity', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('activities.fields.unit')}
              </label>
              <input
                type="text"
                value={form.unit}
                onChange={e => handleChange('unit', e.target.value)}
                placeholder={t('activities.create.placeholders.unit')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Activity Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('activities.fields.activity_date')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="date"
              value={form.activity_date}
              onChange={e => handleChange('activity_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled={submitting}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('activities.create.fields.notes')}
              <span className="text-gray-400 text-xs ml-1">({t('common.optional')})</span>
            </label>
            <textarea
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              placeholder={t('activities.create.placeholders.notes')}
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              disabled={submitting}
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{form.notes.length}/500</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <i className="ri-error-warning-line text-red-500 text-sm flex-shrink-0"></i>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <i className="ri-loader-4-line animate-spin"></i>}
              {submitting ? t('activities.create.submitting') : t('activities.create.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
