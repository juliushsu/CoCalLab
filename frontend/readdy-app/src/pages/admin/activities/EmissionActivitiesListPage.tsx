import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../../components/layout/AdminLayout';
import ReadonlyBanner from '../../../components/feature/ReadonlyBanner';
import { DataOriginLegend } from '../../../components/feature/DataOriginLegend';
import { DataOriginBadge } from '../../../components/base/DataOriginBadge';
import LoadingState from '../../../components/base/LoadingState';
import EmptyState from '../../../components/base/EmptyState';
import ErrorState from '../../../components/base/ErrorState';
import CreateActivityModal from './components/CreateActivityModal';
import { useSubscriptionStatus } from '../../../hooks/useSubscriptionStatus';
import { getEmissionActivities } from '../../../services/activityService';
import { getSupabaseClient } from '../../../lib/supabase';
import { IS_STAGING } from '../../../utils/staging';
import { inferBadgeType } from '../../../types/dataOrigin';
import type { EmissionActivity } from '../../../types/activity';
import type { DataOriginMeta } from '../../../types/dataOrigin';

export default function EmissionActivitiesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || undefined;
  const organizationId = searchParams.get('organizationId') || undefined;

  const { isReadonly } = useSubscriptionStatus(organizationId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<EmissionActivity[]>([]);
  const [filterScope, setFilterScope] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterInclusion, setFilterInclusion] = useState('');

  // Auto-open create modal when ?create=true
  const [showCreateModal, setShowCreateModal] = useState(
    searchParams.get('create') === 'true'
  );

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEmissionActivities(projectId);
      setActivities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errors.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    if (isReadonly) return;
    setShowCreateModal(true);
  };

  const handleCloseCreate = () => {
    setShowCreateModal(false);
    // Remove ?create=true from URL
    if (searchParams.get('create')) {
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
  };

  const handleCreated = () => {
    handleCloseCreate();
    loadData();
  };

  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      const scopeVal = a.final_scope ?? a.suggested_scope;
      if (filterScope && String(scopeVal) !== filterScope) return false;
      if (filterCategory && !(a.category || '').toLowerCase().includes(filterCategory.toLowerCase())) return false;
      if (filterInclusion && a.inclusion_status !== filterInclusion) return false;
      return true;
    });
  }, [activities, filterScope, filterCategory, filterInclusion]);

  const handleResetFilters = () => {
    setFilterScope('');
    setFilterCategory('');
    setFilterInclusion('');
  };

  const handleViewDetail = (id: string) => {
    navigate(`/admin/activities/${id}`);
  };

  const handleViewSourceDocument = async (documentId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data: doc } = await supabase
        .from('uploaded_documents')
        .select('original_filename, storage_path, storage_bucket')
        .eq('id', documentId)
        .maybeSingle();

      if (doc) {
        alert(`${t('activities.fields.source_document')}\n\n${t('documents.fields.file_name')}: ${doc.original_filename}\n${t('documents.fields.status')}: ${doc.storage_path ? t('documents.status.completed') : t('documents.status.pending')}`);
      } else {
        alert(t('activities.detail_page.no_source_document'));
      }
    } catch (err) {
      console.error('Failed to load source document:', err);
      alert(t('common.errors.load_failed'));
    }
  };

  /** 從 activity 推導 DataOriginMeta（等 Codex 定義欄位後直接 map） */
  const getActivityOriginMeta = (activity: EmissionActivity): DataOriginMeta | undefined => {
    if (!IS_STAGING) return undefined;
    // mock fixture data 的 id 是純數字字串
    const isFixture = /^\d+$/.test(activity.id);
    if (isFixture) return { is_fixture: true, env: 'staging' };
    // 有 [TEST] 前綴的是使用者測試資料
    if (activity.activity_name?.startsWith('[TEST]')) return { is_test: true, env: 'staging' };
    return undefined;
  };

  /** Map category code → display label */
  const getCategoryLabel = (category: string): string => {
    if (!category || category === 'unclassified') return t('activities.unclassified');
    const key = `activities.categoryLabels.${category}`;
    const translated = t(key);
    // If key not found, i18next returns the key itself — fall back to capitalised raw value
    if (translated === key) {
      return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
    }
    return translated;
  };

  /** Map scope number → display label */
  const getScopeLabel = (scope: number | null | undefined): string => {
    if (scope == null) return '-';
    const key = `activities.scope.scope_${scope}`;
    const translated = t(key);
    if (translated === key) return `Scope ${scope}`;
    return translated;
  };

  const getInclusionLabel = (status: string) => {
    switch (status) {
      case 'included': return t('activities.inclusion.included');
      case 'excluded': return t('activities.inclusion.excluded');
      case 'pending': return t('activities.inclusion.pending');
      default: return status;
    }
  };

  const getInclusionColor = (status: string) => {
    const map: Record<string, string> = {
      included: 'bg-green-100 text-green-800',
      excluded: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <AdminLayout>
        <LoadingState message={t('activities.loading_message')} />
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
      {/* Create Activity Modal */}
      {showCreateModal && (
        <CreateActivityModal
          projectId={projectId}
          onClose={handleCloseCreate}
          onCreated={handleCreated}
        />
      )}

      {isReadonly && <ReadonlyBanner />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('activities.title')}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {t('activities.total_count', { count: activities.length })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenCreate}
              disabled={isReadonly}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center gap-2"
            >
              <i className="ri-add-line"></i>
              {t('activities.create_button')}
            </button>
            <button
              onClick={() => navigate('/admin/documents/upload')}
              disabled={isReadonly}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              <i className="ri-upload-line mr-2"></i>
              {t('documents.upload_button')}
            </button>
          </div>
        </div>

        {/* Data Origin Legend (staging only) */}
        {IS_STAGING && (
          <div className="mb-4">
            <DataOriginLegend />
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('activities.filters.scope')}
              </label>
              <select
                value={filterScope}
                onChange={e => setFilterScope(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">{t('common.all')}</option>
                <option value="1">{t('activities.scope.scope_1')}</option>
                <option value="2">{t('activities.scope.scope_2')}</option>
                <option value="3">{t('activities.scope.scope_3')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('activities.filters.category')}
              </label>
              <input
                type="text"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                placeholder={t('activities.placeholders.category')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('activities.filters.inclusion_status')}
              </label>
              <select
                value={filterInclusion}
                onChange={e => setFilterInclusion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">{t('common.all')}</option>
                <option value="included">{t('activities.inclusion.included')}</option>
                <option value="excluded">{t('activities.inclusion.excluded')}</option>
                <option value="pending">{t('activities.inclusion.pending')}</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleResetFilters}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 whitespace-nowrap cursor-pointer"
              >
                {t('common.reset')}
              </button>
            </div>
          </div>
        </div>

        {/* Activities Table */}
        {filteredActivities.length === 0 ? (
          <EmptyState
            icon="ri-file-list-3-line"
            title={t('activities.empty_title')}
            description={t('activities.empty_description')}
            actionLabel={t('activities.create_button')}
            onAction={handleOpenCreate}
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('activities.fields.activity_name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('activities.fields.category')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('activities.fields.scope')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('activities.fields.quantity')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('activities.fields.activity_date')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('activities.fields.inclusion_status')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.table_actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredActivities.map(activity => {
                    const originMeta = getActivityOriginMeta(activity);
                    const badgeType = originMeta ? inferBadgeType(originMeta) : null;
                    const isProtected = originMeta?.is_seed || originMeta?.data_protection_level === 'protected_seed';
                    const scopeVal = activity.final_scope ?? activity.suggested_scope;

                    return (
                      <tr key={activity.id} className={`hover:bg-gray-50 ${isProtected ? 'bg-violet-50/30' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {activity.activity_name || t('activities.unclassified')}
                              </div>
                              {activity.source_document_id && (
                                <button
                                  onClick={() => handleViewSourceDocument(activity.source_document_id!)}
                                  className="text-xs text-teal-600 hover:text-teal-800 mt-0.5 cursor-pointer underline"
                                >
                                  <i className="ri-file-text-line mr-1"></i>
                                  {t('activities.fields.source_document')}
                                </button>
                              )}
                            </div>
                            {badgeType && (
                              <DataOriginBadge type={badgeType} variant="row-tag" showTooltip />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {getCategoryLabel(activity.category)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {getScopeLabel(scopeVal)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {activity.quantity != null
                              ? `${activity.quantity} ${activity.unit || ''}`
                              : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {activity.activity_date || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getInclusionColor(
                              activity.inclusion_status
                            )}`}
                          >
                            {getInclusionLabel(activity.inclusion_status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleViewDetail(activity.id)}
                            className="text-teal-600 hover:text-teal-900 cursor-pointer"
                          >
                            {t('common.view')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
