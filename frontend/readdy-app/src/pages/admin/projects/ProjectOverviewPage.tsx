import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import StatusBadge from '../../../components/base/StatusBadge';
import ReadonlyBanner from '../../../components/feature/ReadonlyBanner';
import { useSubscriptionStatus } from '../../../hooks/useSubscriptionStatus';
import { getProjectOverview } from '../../../services/projectService';
import { projectOverviewSelection, matchingProjectOverviewState, formatProjectEmissionTonnes, type ProjectOverview } from '../../../services/projectStatistics';
import { useAuth } from '../../../hooks/useAuth';
import { currentSession } from '../../../services/navigationScope';
import EmptyState from '../../../components/base/EmptyState';

import GovernanceBanner from '../../../components/feature/GovernanceBanner';

export default function ProjectOverviewPage() {
  const { t, i18n } = useTranslation();
  const locale=i18n.resolvedLanguage||i18n.language;
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const {session,loading:authLoading}=useAuth();
  const [retry,setRetry]=useState(0);
  const search=searchParams.toString();
  const key=useMemo(()=>({id,search,session,retry}),[id,search,session,retry]);
  type ReadState={status:'success';detail:ProjectOverview|null}|{status:'error';reason:'signIn'|'sessionExpired'|'readFailed'|'invalidScope'};
  const [result,setResult]=useState<{key:typeof key;value:ReadState}|null>(null);
  const state=matchingProjectOverviewState(result,key);
  const organizationId=state?.status==='success'?state.detail?.project.organization_id:undefined;
  const {isReadonly}=useSubscriptionStatus(organizationId);
  useEffect(()=>{
    let active=true;
    if(authLoading)return()=>{active=false;};
    if(!currentSession(key.session)){
      setResult({key,value:{status:'error',reason:'signIn'}});
      return()=>{active=false;};
    }
    try{
      const selected=projectOverviewSelection(key.id,key.search);
      void getProjectOverview(selected).then(detail=>{
        if(active)setResult({key,value:currentSession(key.session)?{status:'success',detail}:{status:'error',reason:'sessionExpired'}});
      }).catch(()=>{
        if(active)setResult({key,value:{status:'error',reason:'readFailed'}});
      });
    }catch{setResult({key,value:{status:'error',reason:'invalidScope'}});}
    return()=>{active=false;};
  },[key,authLoading]);
  const reload=()=>setRetry(value=>value+1);
  const project=state?.status==='success'?state.detail?.project:null;
  const statistics=state?.status==='success'?state.detail?.statistics:null;
  const handleEditProject = () => {
    if (isReadonly) {
      alert(t('subscription.readonly_banner_message'));
      return;
    }
    navigate(`/admin/projects/${id}/edit?organization_id=${organizationId}`);
  };

  const handleUploadDocuments = () => {
    if (isReadonly) {
      alert(t('subscription.readonly_banner_message'));
      return;
    }
    navigate(`/admin/documents/upload?project_id=${id}&organization_id=${organizationId}`);
  };

  const handleGenerateReport = () => {
    if (isReadonly) {
      alert(t('subscription.readonly_banner_message'));
      return;
    }
    navigate(`/admin/reports?project_id=${id}&organization_id=${organizationId}`);
  };

  if (authLoading || !state) {
    return (
      <AdminLayout>
        <div role="status" aria-label={t('projects.overview.statistics.loading')}><LoadingState message={t('projects.overview.statistics.loading')} /></div>
      </AdminLayout>
    );
  }

  if(!currentSession(session))return <AdminLayout><ErrorState message={t('projects.overview.statistics.sessionExpired')} /></AdminLayout>;
  if(state.status==='error')return <AdminLayout><ErrorState message={t(`projects.overview.statistics.${state.reason}`)} onRetry={reload} /></AdminLayout>;
  if(!project||!statistics)return <AdminLayout><EmptyState title={t('projects.overview.statistics.emptyTitle')} description={t('projects.overview.statistics.emptyDescription')} actionLabel={t('projects.overview.statistics.retry')} onAction={reload}/></AdminLayout>;

  return (
    <AdminLayout>
      {isReadonly && (
        <ReadonlyBanner
          onRenew={() => navigate('/admin/subscription')}
          onContact={() => window.open('mailto:support@cocallab.com', '_blank')}
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

        {/* Beta / Governance notice */}
        <GovernanceBanner
          variant="beta"
          message={t('projects.betaNoticeDesc', '目前專案直接綁定工作空間（Workspace）。盤查法人（Legal Entity）與據點（Site）將於下一階段獨立管理。')}
        />

        {/* Basic Info Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('projects.overview.basic_info')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('projects.fields.organization')}</p>
              <p className="text-sm font-medium text-gray-900">{project.organization_name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('projects.overview.statistics.boundary')}</p>
              <p className="text-sm font-medium text-gray-900">{['operational_control','financial_control','equity_share'].includes(project.boundary_type)?t(`projects.overview.statistics.boundaryTypes.${project.boundary_type}`):t('projects.overview.statistics.unknown')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('common.status')}</p>
              <StatusBadge status={project.status} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('projects.fields.reporting_period')}</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date(project.reporting_start_date).toLocaleDateString(locale)} - {new Date(project.reporting_end_date).toLocaleDateString(locale)}
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
              <p className="text-sm font-medium text-gray-900">{new Date(project.created_at).toLocaleDateString(locale)}</p>
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
                {statistics.total_documents}
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
                {statistics.total_activities}
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
                {formatProjectEmissionTonnes(statistics.total_emissions,locale,t('projects.overview.statistics.unknown'))}
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
                {statistics.inclusion_rate === null ? '—' : statistics.inclusion_rate+'%'}
              </span>
            </div>
            <p className="text-sm text-gray-600">{t('projects.overview.statistics.inclusionRate')}</p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-teal-600 h-2 rounded-full transition-all"
                style={{ width: `${statistics.inclusion_rate ?? 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div role="status" className="mb-6 rounded-lg border border-teal-100 bg-teal-50 p-4 text-sm text-gray-700">
          <p>{t('projects.overview.statistics.scopeNote')}</p>
          <p>{t('projects.overview.statistics.counts',{active:statistics.active_activities,included:statistics.included_activities,calculated:statistics.calculated_activities})}{' '}
          {statistics.total_emissions_kg===null?t('projects.overview.statistics.incompleteTotal'):t('projects.overview.statistics.savedTotal',{kg:statistics.total_emissions_kg.toLocaleString(locale,{maximumSignificantDigits:15})})}</p>
          <p>{t('projects.overview.statistics.rateNote')}{' '}{t('projects.overview.statistics.reportStatus',{status:t(statistics.report_generated?'projects.overview.statistics.reportAvailable':'projects.overview.statistics.reportUnavailable')})}</p>
          <button type="button" onClick={reload} className="mt-2 underline">{t('projects.overview.statistics.retry')}</button>
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
              onClick={() => navigate(`/admin/activities?projectId=${id}&organizationId=${organizationId}`)}
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
