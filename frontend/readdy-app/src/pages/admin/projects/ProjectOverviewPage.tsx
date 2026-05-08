import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import StatusBadge from '../../../components/base/StatusBadge';
import ReadonlyBanner from '../../../components/feature/ReadonlyBanner';
import { useSubscriptionStatus } from '../../../hooks/useSubscriptionStatus';
import { getProjectById, getProjectStatistics } from '../../../services/projectService';
import type { Project, ProjectStatistics } from '../../../types/project';

export default function ProjectOverviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [statistics, setStatistics] = useState<ProjectStatistics | null>(null);

  const organizationId = searchParams.get('organization_id') || undefined;
  const { status, isReadonly, reason, loading: statusLoading } = useSubscriptionStatus(organizationId);

  useEffect(() => {
    loadProjectData();
  }, [id]);

  const loadProjectData = async () => {
    if (!id) {
      setError(t('errors.loadFailed'));
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 使用 projectService 取得專案資料
      const projectData = await getProjectById(id);
      if (!projectData) {
        setError(t('errors.loadFailed'));
        return;
      }
      setProject(projectData);

      // 使用 projectService 取得統計資料
      const statsData = await getProjectStatistics(id);
      setStatistics(statsData);
    } catch (err) {
      console.error('Failed to load project:', err);
      setError(t('errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditProject = () => {
    if (isReadonly) {
      alert(t('subscription.readonly_banner_message'));
      return;
    }
    navigate(`/admin/projects/${id}/edit`);
  };

  const handleUploadDocuments = () => {
    if (isReadonly) {
      alert(t('subscription.readonly_banner_message'));
      return;
    }
    navigate(`/admin/documents/upload?project_id=${id}`);
  };

  const handleGenerateReport = () => {
    if (isReadonly) {
      alert(t('subscription.readonly_banner_message'));
      return;
    }
    navigate(`/admin/reports?project_id=${id}`);
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <LoadingState />
      </AdminLayout>
    );
  }

  if (error || !project) {
    return (
      <AdminLayout>
        <ErrorState message={error || t('common.errors.load_failed')} onRetry={loadProjectData} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {isReadonly && (
        <ReadonlyBanner
          onRenew={() => navigate('/admin/subscription')}
          onContact={() => window.open('mailto:support@cacalab.com', '_blank')}
        />
      )}

      <div className="w-full h-full flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin/projects')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors cursor-pointer"
          >
            <i className="ri-arrow-left-line"></i>
            {t('common.back')}
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
              <p className="text-sm text-gray-600 mt-1">{project.project_code}</p>
            </div>
            <button
              onClick={handleEditProject}
              disabled={isReadonly}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-edit-line"></i>
              {t('common.edit')}
            </button>
          </div>
        </div>

        {/* Basic Info Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('projects.overview.basic_info')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('projects.fields.organization')}</p>
              <p className="text-sm font-medium text-gray-900">{project.organization_name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('projects.fields.project_type')}</p>
              <p className="text-sm font-medium text-gray-900">{t(`projects.types.${project.project_type}`)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('common.status')}</p>
              <StatusBadge status={project.status} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('projects.fields.reporting_period')}</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(project.reporting_start_date).toLocaleDateString()} - {new Date(project.reporting_end_date).toLocaleDateString()}
              </p>
            </div>
            {project.baseline_year && (
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('projects.fields.baseline')}</p>
                <p className="text-sm font-medium text-gray-900">{project.baseline_year}</p>
              </div>
            )}
            {project.reduction_target && (
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('projects.fields.target')}</p>
                <p className="text-sm font-medium text-gray-900">{project.reduction_target}%</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('common.created_at')}</p>
              <p className="text-sm font-medium text-gray-900">{new Date(project.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          {project.description && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">{t('projects.fields.description')}</p>
              <p className="text-sm text-gray-700">{project.description}</p>
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 flex items-center justify-center bg-blue-50 rounded-lg">
                <i className="ri-file-text-line text-blue-600 text-xl"></i>
              </div>
              <span className="text-2xl font-semibold text-gray-900">
                {statistics?.total_documents || 0}
              </span>
            </div>
            <p className="text-sm text-gray-600">{t('projects.overview.total_documents')}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 flex items-center justify-center bg-green-50 rounded-lg">
                <i className="ri-list-check-2 text-green-600 text-xl"></i>
              </div>
              <span className="text-2xl font-semibold text-gray-900">
                {statistics?.total_activities || 0}
              </span>
            </div>
            <p className="text-sm text-gray-600">{t('projects.overview.total_activities')}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 flex items-center justify-center bg-orange-50 rounded-lg">
                <i className="ri-fire-line text-orange-600 text-xl"></i>
              </div>
              <span className="text-2xl font-semibold text-gray-900">
                {statistics?.total_emissions?.toFixed(2) || '0.00'}
              </span>
            </div>
            <p className="text-sm text-gray-600">{t('projects.overview.total_emissions')}</p>
            <p className="text-xs text-gray-500 mt-1">tCO2e</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 flex items-center justify-center bg-teal-50 rounded-lg">
                <i className="ri-pie-chart-line text-teal-600 text-xl"></i>
              </div>
              <span className="text-2xl font-semibold text-gray-900">
                {statistics?.completion_rate || 0}%
              </span>
            </div>
            <p className="text-sm text-gray-600">{t('projects.overview.completion_rate')}</p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-teal-600 h-2 rounded-full transition-all"
                style={{ width: `${statistics?.completion_rate || 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('projects.overview.quick_actions')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleUploadDocuments}
              disabled={isReadonly}
              className="p-4 border border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition-all text-left group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white"
            >
              <div className="w-10 h-10 flex items-center justify-center bg-teal-50 rounded-lg mb-3 group-hover:bg-teal-100 transition-colors">
                <i className="ri-upload-cloud-line text-teal-600 text-xl"></i>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">{t('projects.overview.upload_documents')}</p>
              <p className="text-xs text-gray-500">{t('projects.overview.upload_documents_desc')}</p>
            </button>

            <button
              onClick={() => navigate(`/admin/activities?project_id=${id}`)}
              className="p-4 border border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition-all text-left group cursor-pointer"
            >
              <div className="w-10 h-10 flex items-center justify-center bg-teal-50 rounded-lg mb-3 group-hover:bg-teal-100 transition-colors">
                <i className="ri-list-check text-teal-600 text-xl"></i>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">{t('projects.overview.view_activities')}</p>
              <p className="text-xs text-gray-500">{t('projects.overview.view_activities_desc')}</p>
            </button>

            <button
              onClick={handleGenerateReport}
              disabled={isReadonly}
              className="p-4 border border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition-all text-left group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white"
            >
              <div className="w-10 h-10 flex items-center justify-center bg-teal-50 rounded-lg mb-3 group-hover:bg-teal-100 transition-colors">
                <i className="ri-file-chart-line text-teal-600 text-xl"></i>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">{t('projects.overview.generate_report')}</p>
              <p className="text-xs text-gray-500">{t('projects.overview.generate_report_desc')}</p>
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}