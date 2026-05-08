import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import EmptyState from '../../../components/base/EmptyState';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import StatusBadge from '../../../components/base/StatusBadge';
import { getOrganizations } from '../../../services/organizationService';
import type { Organization } from '../../../types/organization';

export default function OrganizationListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getOrganizations();
      setOrganizations(data);
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setError(t('common.errors.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const filteredOrganizations = organizations.filter(org => {
    const query = searchQuery.toLowerCase();
    const primaryName = (org.display_name || org.legal_name || '').toLowerCase();
    return (
      primaryName.includes(query) ||
      (org.legal_name || '').toLowerCase().includes(query) ||
      (org.tax_id || '').toLowerCase().includes(query)
    );
  });

  return (
    <AdminLayout>
      <div className="w-full h-full flex flex-col">
        {/* Header — 永遠顯示，不受 loading/error 影響 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {t('organizations.title')}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {t('organizations.list_description')}
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/organizations/create')}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer"
          >
            <i className="ri-add-line"></i>
            {t('organizations.create_button')}
          </button>
        </div>

        {/* Search — 永遠顯示 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="relative max-w-sm">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('organizations.search_placeholder')}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content — 依狀態顯示 */}
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={loadOrganizations} />
        ) : filteredOrganizations.length === 0 ? (
          <EmptyState
            icon="ri-building-line"
            title={t('organizations.empty_title')}
            description={t('organizations.empty_description')}
            actionLabel={t('organizations.create_button')}
            onAction={() => navigate('/admin/organizations/create')}
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex-1">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('organizations.fields.name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('organizations.fields.tax_id')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.created_at')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrganizations.map(org => {
                    const primaryName = org.display_name || org.legal_name;
                    const showSubtitle =
                      org.legal_name &&
                      org.display_name &&
                      org.legal_name !== org.display_name;

                    return (
                      <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{primaryName}</div>
                          {showSubtitle && (
                            <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                              {org.legal_name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">{org.tax_id || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={org.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            {new Date(org.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/admin/organizations/${org.id}/members`)}
                              className="w-8 h-8 flex items-center justify-center text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                              title={t('organizations.members.title')}
                            >
                              <i className="ri-team-line"></i>
                            </button>
                            <button
                              onClick={() => navigate(`/admin/organizations/${org.id}/edit`)}
                              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                              title={t('common.edit')}
                            >
                              <i className="ri-edit-line"></i>
                            </button>
                          </div>
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