import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
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
import {manualProjects,readManualActivities,calculateManualProject,lookupManualCalculation,nextManualReport,saveManualReport,type ManualProject,type ReportAttempt} from '../../../services/manualWorkflow';
import {reportReference,saveReportReference,clearManualReference} from '../../../services/manualRecovery';
import {calculationReference,readCalculationReference,clearCalculationReference,calculationRawReference,abandonCalculationReference} from '../../../services/calculationRecovery';
import {resolveNavigationScope} from '../../../services/navigationScope';
import {useAuth} from '../../../hooks/useAuth';
import {useTenantNavigation} from '../../../hooks/useTenantNavigation';
import { getSupabaseClient } from '../../../lib/supabase';
import { IS_STAGING } from '../../../utils/staging';
import { inferBadgeType } from '../../../types/dataOrigin';
import type { EmissionActivity } from '../../../types/activity';
import type { DataOriginMeta } from '../../../types/dataOrigin';

export default function EmissionActivitiesListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search=searchParams.toString();
  const selection=useMemo(()=>resolveNavigationScope('/admin/activities','?'+search),[search]);
  const projectId='projectId' in selection?selection.projectId:undefined;
  const selectedOrg='organizationId' in selection?selection.organizationId:undefined;
  const {session,authEpoch,loading:authLoading,isAuthenticationCurrent}=useAuth();
  const userId=session?.user.id??'';
  const context=useMemo(()=>({search,userId,authEpoch}),[search,userId,authEpoch]);
  const current=useRef<typeof context|null>(context);
  const isCurrent=useCallback(()=>current.current===context&&isAuthenticationCurrent(context.authEpoch,context.userId),[context,isAuthenticationCurrent]);
  const [projects,setProjects]=useState<ManualProject[]>([]),[organizationId,setOrganizationId]=useState<string|undefined>();
  const [loaded,setLoaded]=useState<typeof context|null>(null);
  const subscription=useSubscriptionStatus(loaded===context?organizationId:undefined,{failClosed:true,scopeKey:context});
  const navigation=useTenantNavigation();
  const isReadonly=subscription.isReadonly||subscription.loading||Boolean(subscription.error)||!['owner','admin','editor'].includes(navigation.role??'');
  const reportAttempt=useRef<ReportAttempt|null>(null);
  const [pendingCalculation,setPendingCalculation]=useState<string|null>(null);
  const [working,setWorking]=useState(false),[operationMessage,setOperationMessage]=useState(''),[savedReport,setSavedReport]=useState<string|null>(null);
  useLayoutEffect(()=>{current.current=context;reportAttempt.current=null;setPendingCalculation(null);setOperationMessage('');setSavedReport(null);setWorking(false);return()=>{if(current.current===context)current.current=null;};},[context]);
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

  const loadData = useCallback(async () => {
    if(authLoading)return;
    try {
      setLoading(true);setError(null);
      if(selection.kind==='invalid')throw new Error('組織或專案網址不一致。');
      const options=await manualProjects(getSupabaseClient(),userId,isCurrent,selectedOrg);
      const project=projectId?options.find(row=>row.id===projectId):undefined;
      if(projectId&&!project)throw new Error('專案不可存取。');
      const data=project?await readManualActivities(getSupabaseClient(),{organizationId:project.organization_id,projectId:project.id},userId,isCurrent):(await Promise.all(options.map(row=>readManualActivities(getSupabaseClient(),{organizationId:row.organization_id,projectId:row.id},userId,isCurrent)))).flat();
      if(!isCurrent())return;setProjects(options);setOrganizationId(project?.organization_id??selectedOrg);setActivities(data);
    } catch (err) {if(isCurrent()){setActivities([]);setError(err instanceof Error?err.message:t('common.errors.load_failed'));}}
    finally {if(isCurrent()){setLoading(false);setLoaded(context);}}
  },[authLoading,context,isCurrent,projectId,selectedOrg,selection,userId,t]);
  useEffect(()=>{void loadData();},[loadData]);
  useEffect(()=>{if(!projectId||!organizationId||loaded!==context)return;try{setPendingCalculation(readCalculationReference(sessionStorage,{projectId,organizationId},userId)?.requestId??null);}catch(cause){setOperationMessage(cause instanceof Error?cause.message:'計算恢復參考不可讀。');}},[projectId,organizationId,loaded,context,userId]);
  const run=async(kind:'calculate'|'report'|'lookup')=>{
    if(!projectId||!organizationId||!isCurrent()||working||isReadonly)return;
    const scope={projectId,organizationId};setWorking(true);setOperationMessage('');
    try{
      if(kind==='calculate'){
        if(reportReference(sessionStorage,scope,userId))throw new Error('此專案有尚未核對的報告請求；請先按保存報告快照／重試恢復，或明確放棄本機參考，再執行新計算。');
        const attempt=calculationReference(sessionStorage,scope,userId);setPendingCalculation(attempt.requestId);
        const result=await calculateManualProject(getSupabaseClient(),scope,userId,attempt.requestId,isCurrent);
        if(!isCurrent())return;clearCalculationReference(sessionStorage,scope,userId,attempt.requestId);setPendingCalculation(readCalculationReference(sessionStorage,scope,userId)?.requestId??null);reportAttempt.current=null;setSavedReport(null);
        setOperationMessage((result.replayed?'原操作已核對，未新增計算版本：':'計算已保存：')+result.calculated_count+'筆已計算、'+result.pending_factor_count+'筆待補係數、'+result.excluded_count+'筆排除、'+result.error_count+'筆錯誤；待補不是零。操作 '+attempt.requestId+'。請查看活動明細確認係數來源與版本。');
      }else if(kind==='lookup'){
        const prior=readCalculationReference(sessionStorage,scope,userId);if(!prior){setOperationMessage('此使用者／專案沒有本機待核對計算參考；未建立新操作。');return;}
        const result=await lookupManualCalculation(getSupabaseClient(),scope,userId,prior.requestId,isCurrent);if(!isCurrent())return;
        if(result.operation_status==='completed'&&result.input_matches_current&&result.results_are_latest){clearCalculationReference(sessionStorage,scope,userId,prior.requestId);setPendingCalculation(readCalculationReference(sessionStorage,scope,userId)?.requestId??null);setOperationMessage('原計算已保存並核對，未增加版本；操作 '+prior.requestId+'，'+result.calculated_count+'筆已計算、'+result.pending_factor_count+'筆待補、'+result.excluded_count+'筆排除、'+result.error_count+'筆錯誤。');}
        else if(result.operation_status==='historical')setOperationMessage('查回的是原操作歷史結果，不能視為目前計算完成。輸入'+(result.input_matches_current?'相同':'已改變')+'；保存版本'+(result.results_are_latest?'仍為latest':'已被取代或缺少')+'。可保留操作 '+prior.requestId+' 後明確放棄本機參考，再以新操作重算。');
        else setOperationMessage(result.operation_status==='not_found'?'服務端未找到已提交的此操作；這不代表零排放。按計算並保存／重試會沿用同一ID。':result.input_matches_current?'原計算尚未完成；保留同一ID重試，未視為成功。':'原計算尚未完成且輸入已改變；保留原ID供核對。如需計算新輸入，請明確放棄本機參考再建立新操作。');
      }else{
        if(readCalculationReference(sessionStorage,scope,userId))throw new Error('此專案有待核對計算，請先查回或用同一ID重試；不能將未知計算當作報告已完成。');
        reportAttempt.current??=reportReference(sessionStorage,scope,userId)??await nextManualReport(getSupabaseClient(),scope,userId,isCurrent);
        saveReportReference(sessionStorage,scope,userId,reportAttempt.current);
        const result=await saveManualReport(getSupabaseClient(),scope,userId,reportAttempt.current,isCurrent);
        if(!isCurrent())return;clearManualReference(sessionStorage,scope,userId,'report',reportAttempt.current.requestId);setSavedReport(result.id);reportAttempt.current=null;
        setOperationMessage('報告快照已保存並重讀核對：'+result.gross_emissions_snapshot.gross_total_co2e_kg+' kgCO₂e = '+(result.gross_emissions_snapshot.gross_total_co2e_kg/1000)+' tCO₂e。');
      }
    }catch(cause){if(isCurrent())setOperationMessage(cause instanceof Error?cause.message:'操作未確認，請重讀後核對。');}
    finally{if(isCurrent())setWorking(false);}
  };
  const handleOpenCreate = () => {
    if (isReadonly || !projectId) return;
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

  const handleViewDetail = (activity: EmissionActivity) => {
    navigate(`/admin/activities/${activity.id}?`+new URLSearchParams({organization_id:activity.organization_id!,project_id:activity.project_id}));
  };

  const handleViewSourceDocument = (activity:EmissionActivity) => {navigate('/admin/documents/list?'+new URLSearchParams({organization_id:activity.organization_id!,projectId:activity.project_id,document:activity.source_document_id!}));};

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

  if (loading || loaded!==context) {
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
      {showCreateModal && projectId && organizationId && !isReadonly && (
        <CreateActivityModal
          projectId={projectId}
          organizationId={organizationId}
          userId={userId}
          isCurrent={isCurrent}
          onClose={handleCloseCreate}
          onCreated={handleCreated}
        />
      )}

      {isReadonly && projectId && <ReadonlyBanner />}

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
              disabled={isReadonly||!projectId||working}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center gap-2"
            >
              <i className="ri-add-line"></i>
              {t('activities.create_button')}
            </button>
            <button
              onClick={() => navigate('/admin/documents/upload?'+new URLSearchParams({organization_id:organizationId??'',project_id:projectId??''}))}
              disabled={isReadonly}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              <i className="ri-upload-line mr-2"></i>
              {t('documents.upload_button')}
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-3 items-center"><label>目前專案<select aria-label="目前專案" value={projectId??''} onChange={e=>{const project=projects.find(row=>row.id===e.target.value);current.current=null;setShowCreateModal(false);setSearchParams(project?{organization_id:project.organization_id,projectId:project.id}:{});}} className="ml-2 rounded border p-2"><option value="">全部已授權專案（新增／計算需選擇）</option>{projects.map(row=><option key={row.id} value={row.id}>{row.name}（{row.project_code}）</option>)}</select></label>
        <button type="button" disabled={!projectId||working||isReadonly} onClick={()=>void run('calculate')} className="rounded border p-2 disabled:opacity-50">計算並保存／重試</button>
        <button type="button" disabled={!projectId||working||isReadonly} onClick={()=>void run('report')} className="rounded border p-2 disabled:opacity-50">保存報告快照／重試</button>
        <button type="button" onClick={()=>void loadData()} disabled={working} className="rounded border p-2">重新讀取</button>
        <button type="button" disabled={!projectId||!organizationId||working} onClick={()=>{if(!projectId||!organizationId)return;try{const scope={projectId,organizationId},prior=reportReference(sessionStorage,scope,userId);if(prior)clearManualReference(sessionStorage,scope,userId,'report',prior.requestId);reportAttempt.current=null;setOperationMessage('已放棄此使用者／專案的本機報告恢復參考；不會刪除任何伺服器報告。下次保存會建立新快照。');}catch(cause){setOperationMessage(String(cause));}}} className="rounded border p-2">放棄報告恢復參考（不刪除報告）</button>
        <button type="button" disabled={!projectId||!organizationId||working||isReadonly} onClick={()=>void run('lookup')} className="rounded border p-2 disabled:opacity-50">核對待確認計算（不新增版本）</button>
        <button type="button" disabled={!projectId||!organizationId||working} onClick={()=>{if(!projectId||!organizationId||!isCurrent())return;try{const scope={projectId,organizationId},captured=calculationRawReference(sessionStorage,scope,userId);abandonCalculationReference(sessionStorage,scope,userId,captured);setPendingCalculation(readCalculationReference(sessionStorage,scope,userId)?.requestId??null);setOperationMessage('已清除此使用者／專案的本機計算參考（含損壞參考）；不取消或刪除任何伺服器計算。下次按計算會建立新操作。');}catch(cause){setOperationMessage(String(cause));}}} className="rounded border p-2">放棄計算本機參考（不取消伺服器操作）</button>
        {savedReport&&<button type="button" onClick={()=>navigate('/admin/reports/'+savedReport+'?'+new URLSearchParams({organization_id:organizationId??'',project_id:projectId??''}))} className="rounded border p-2">開啟已保存報告</button>}</div>
        {projectId&&<p className="mb-3 text-sm">盤查期間：{projects.find(row=>row.id===projectId)?.reporting_start_date} ～ {projects.find(row=>row.id===projectId)?.reporting_end_date}。數量與單位由人工輸入；係數不使用正式預設測試值。</p>}
        {pendingCalculation&&<p className="mb-3 text-sm">待核對計算操作：{pendingCalculation}。重試沿用此ID；本機參考不是伺服器完成證明。</p>}
        {working&&<p role="status">處理中，等待伺服器保存／核對結果…</p>}
        {operationMessage&&<p role="status" className="mb-4 border rounded p-3">{operationMessage}</p>}
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
            actionLabel={projectId&&!isReadonly?t('activities.create_button'):undefined}
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
                                <p className="text-xs text-gray-500">{projects.find(row=>row.id===activity.project_id)?.name} · {activity.organization_id?.slice(0,8)}</p>
                              </div>
                              {activity.source_document_id && (
                                <button
                                  onClick={() => handleViewSourceDocument(activity)}
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
                            onClick={() => handleViewDetail(activity)}
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
