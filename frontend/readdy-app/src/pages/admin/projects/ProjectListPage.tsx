import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import EmptyState from '../../../components/base/EmptyState';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import ConfirmDialog from '../../../components/base/ConfirmDialog';
import StatusBadge from '../../../components/base/StatusBadge';
import { getProjects } from '../../../services/projectService';
import { getOrganizations } from '../../../services/organizationService';
import { getSupabaseClient } from '../../../lib/supabase';
import type { Project, ProjectStatus } from '../../../types/project';
import type { Organization } from '../../../types/organization';

export default function ProjectListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [projectsData, orgsData] = await Promise.all([
        getProjects(),
        getOrganizations(),
      ]);
      setProjects(projectsData);
      setOrganizations(orgsData);
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError(t('common.errors.load_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.project_code || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesOrganization =
      !selectedOrganization || project.organization_id === selectedOrganization;
    const matchesStatus = !selectedStatus || project.status === selectedStatus;
    return matchesSearch && matchesOrganization && matchesStatus;
  });

  const handleDelete = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      setIsDeleting(true);
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectToDelete.id);
      if (deleteError) throw deleteError;
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (err) {
      console.error('Delete failed:', err);
      setError(t('common.errors.delete_failed'));
    } finally {
      setIsDeleting(false);
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
      <div className="w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('projects.title')}</h1>
            <p className="text-sm text-gray-600 mt-1">{t('projects.list_description')}</p>
          </div>
          <button
            onClick={() => navigate('/admin/projects/create')}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap flex items-center gap-2"
          >
            <i className="ri-add-line"></i>
            {t('projects.create_button')}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('projects.search_placeholder')}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <select
              value={selectedOrganization}
              onChange={(e) => setSelectedOrganization(e.target.value)}
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">{t('common.all')} - {t('projects.filter_by_organization')}</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ProjectStatus | '')}
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="">{t('common.all')} - {t('projects.filter_by_status')}</option>
              <option value="draft">{t('common.status_draft')}</option>
              <option value="active">{t('common.status_active')}</option>
              <option value="closed">{t('common.status_closed')}</option>
              <option value="archived">{t('common.status_archived')}</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {filteredProjects.length === 0 ? (
          <EmptyState
            icon="ri-folder-3-line"
            title={t('projects.empty_title')}
            description={t('projects.empty_description')}
            actionLabel={t('projects.create_button')}
            onAction={() => navigate('/admin/projects/create')}
          />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex-1">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('projects.fields.name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('projects.fields.code')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('projects.fields.organization')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('projects.fields.reporting_period')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.created_at')}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('common.table_actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProjects.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{project.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{project.project_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">{project.organization_name || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {new Date(project.reporting_start_date).toLocaleDateString()} -{' '}
                          {new Date(project.reporting_end_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {new Date(project.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/admin/projects/${project.id}`)}
                            className="w-8 h-8 flex items-center justify-center text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                            title={t('common.view')}
                          >
                            <i className="ri-eye-line"></i>
                          </button>
                          <button
                            onClick={() => navigate(`/admin/projects/${project.id}/edit`)}
                            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                            title={t('common.edit')}
                          >
                            <i className="ri-edit-line"></i>
                          </button>
                          <button
                            onClick={() => handleDelete(project)}
                            className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title={t('common.delete')}
                          >
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={deleteDialogOpen}
          onClose={() => { setDeleteDialogOpen(false); setProjectToDelete(null); }}
          onConfirm={confirmDelete}
          title={t('projects.delete_confirm_title')}
          message={t('projects.delete_confirm_message')}
          confirmLabel={t('common.delete')}
          loading={isDeleting}
          type="danger"
        />
      </div>
    </AdminLayout>
  );
}