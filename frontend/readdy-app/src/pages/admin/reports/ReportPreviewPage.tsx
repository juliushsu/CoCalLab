import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {resolveNavigationScope} from '../../../services/navigationScope';
import {workflowHref} from '../../../services/workflowNavigation';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import { ErrorState } from '../../../components/base/ErrorState';
import { EmptyState } from '../../../components/base/EmptyState';
import { StatusBadge } from '../../../components/base/StatusBadge';
import ReadonlyBanner from '../../../components/feature/ReadonlyBanner';
import GovernanceBanner from '../../../components/feature/GovernanceBanner';
import { useSubscriptionStatus } from '../../../hooks/useSubscriptionStatus';
import { EdgeFunctionService } from '../../../services/edgeFunction';
import type { ApiResponse } from '../../../services/types';
import type { ReportVersion, ReportSection, ReportStatistics } from '../../../types/report';
import { getReportData } from '../../../services/reportService';
import {reportExportPreflight,exportCurrentSnapshot,saveReportFile,reportExportIsBusy,releaseReportExportAttempt,reportExportVisitNotice,type ReportExportAttempt} from '../../../services/reportDownload';
import {readAuthorizedReportSnapshot} from '../../../services/reportExportRead';
import {getSupabaseClient} from '../../../lib/supabase';
import {useAuth} from '../../../hooks/useAuth';
import ReportOutlinePanel from './components/ReportOutlinePanel';
import {reportIntegrityExportBlock,reportIntegrityNotice} from '../../../services/reportIntegrity';

// Generate Report Response Type
interface GenerateReportResponse {
  report_generation_id: string;
  status: 'generating' | 'completed' | 'failed';
}

// Regenerate Section Response Type
interface RegenerateSectionResponse {
  section_id: string;
  section_type: string;
  title: string;
  content: string;
  is_ai_generated: boolean;
  updated_at: string;
  message: string;
}

function createReportRequestId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `report-${Date.now()}`;
}

export default function ReportPreviewPage() {
  const { t } = useTranslation();
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportVersion | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [statistics, setStatistics] = useState<ReportStatistics | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportNotice,setExportNotice]=useState('');
  const {authEpoch,user,isAuthenticationCurrent}=useAuth();

  // Generate Report States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateWarnings, setGenerateWarnings] = useState<string[]>([]);

  // Regenerate Section States
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  // 訂閱狀態檢查
  const scope=resolveNavigationScope('/admin/reports/'+reportId,searchParams.toString());
  const organizationId='organizationId' in scope?scope.organizationId:undefined;
  const projectId='projectId' in scope?scope.projectId:undefined;
  const invalidScope=scope.kind==='invalid';
  const { status, isReadonly, reason, loading: statusLoading, error:subscriptionError } = useSubscriptionStatus(organizationId);

  const exportBlock=reportExportPreflight({loading:statusLoading,error:subscriptionError,isReadonly}) ?? reportIntegrityExportBlock(report?.saved_snapshot?.integrity_status);
  const exportContext=useMemo(()=>({authEpoch,user:user?.id,reportId,organizationId,projectId,exportBlock}),[authEpoch,user?.id,reportId,organizationId,projectId,exportBlock]);
  const [exportAttempt,setExportAttempt]=useState<ReportExportAttempt<typeof exportContext>|null>(null);
  const activeExportAttempt=useRef<ReportExportAttempt<typeof exportContext>|null>(null);
  const previousExportContext=useRef(exportContext);
  const exporting=reportExportIsBusy(exportAttempt,exportContext);
  const currentExport=useRef<typeof exportContext|null>(exportContext);currentExport.current=exportContext;
  useLayoutEffect(()=>{currentExport.current=exportContext;const attempt=activeExportAttempt.current,previous=previousExportContext.current;previousExportContext.current=exportContext;activeExportAttempt.current=null;setExportAttempt(null);setExportNotice(notice=>reportExportVisitNotice(attempt,previous,exportContext,notice));setExportDialogOpen(false);return()=>{if(currentExport.current===exportContext)currentExport.current=null;};},[exportContext]);
  // Generation continuity follows identity/scope only; export preflight refreshes must not strand its busy state.
  const generationScope=useMemo(()=>({authEpoch,user:user?.id,reportId,organizationId,projectId}),[authEpoch,user?.id,reportId,organizationId,projectId]);
  const currentGeneration=useRef<typeof generationScope|null>(generationScope);currentGeneration.current=generationScope;
  useLayoutEffect(()=>{currentGeneration.current=generationScope;return()=>{if(currentGeneration.current===generationScope)currentGeneration.current=null;};},[generationScope]);
  const loadSequence = useRef(0);
  const loadReportData = useCallback(async () => {
    const sequence = ++loadSequence.current;
    const current=()=>sequence===loadSequence.current&&Boolean(user?.id&&isAuthenticationCurrent(authEpoch,user.id));
    try {
      setLoading(true);
      setError(null);
      setReport(null); setSections([]); setStatistics(null);
      
      // 使用 reportService 取得資料（會自動處理 Supabase 連線狀態）
      if(invalidScope)throw new Error('組織／專案範圍不明確。');
      if(!current())throw new Error('登入狀態已失效。');
      const response = await getReportData(reportId || '',{organizationId,projectId});
      const {report,sections,statistics}=response;
      if(!current())return;
      if((!organizationId||!projectId)&&'resolvedScope' in response&&response.resolvedScope?.organizationId){
        navigate('/admin/reports/'+encodeURIComponent(reportId||'')+'?'+new URLSearchParams({organization_id:response.resolvedScope.organizationId,projectId:response.resolvedScope.projectId}),{replace:true});return;
      }
      
      if (!current()) return;
      setReport(report);
      setSections(sections);
      setStatistics(statistics);
    } catch (err) {
      console.error('Failed to load report:', err);
      if (sequence === loadSequence.current) setError(t('errors.loadFailed'));
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [reportId, t,organizationId,projectId,invalidScope,navigate,authEpoch,user?.id,isAuthenticationCurrent]);

  useEffect(() => {
    void loadReportData();
    return () => { loadSequence.current += 1; };
  }, [loadReportData]);

  const handleEditSection = (section: ReportSection) => {
    if (isReadonly) {
      alert(t('subscription.readonlyBanner.message'));
      return;
    }
    setEditingSection(section.id);
    setEditContent(section.content);
  };

  const handleSaveSection = async () => {
    if (isReadonly) {
      alert(t('subscription.readonlyBanner.message'));
      return;
    }

    try {
      // TODO: 實際 API 呼叫（等 Supabase schema 建立後啟用）
      // const supabase = getSupabaseClient();
      // await supabase
      //   .from('report_sections')
      //   .update({
      //     content: editContent,
      //     is_user_modified: true,
      //     updated_at: new Date().toISOString(),
      //   })
      //   .eq('id', editingSection);
      
      setSections(prev =>
        prev.map(s =>
          s.id === editingSection
            ? { ...s, content: editContent, is_user_modified: true }
            : s
        )
      );
      setEditingSection(null);
    } catch (err) {
      console.error('Failed to save section:', err);
    }
  };

  /**
   * 呼叫 generate-report Edge Function
   * 保存報告快照；不代表章節完整或商業驗收
   */
  const handleGenerateReport = async (projectId: string) => {
    const generationContext=currentGeneration.current;
    const current=()=>generationContext!==null&&currentGeneration.current===generationContext&&Boolean(user?.id&&isAuthenticationCurrent(authEpoch,user.id));
    if(!current())return;
    if (isReadonly) {
      setGenerateError(t('subscription.readonlyBanner.message'));
      return;
    }
    if (!projectId || !organizationId) {
      setGenerateError(t('reports.generate_dialog.missingContextError'));
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setGenerateWarnings([]);

    try {
      const currentVersion = Number(report?.version_number || 0);
      // Staging-safe UI allocation for this preview-only path; backend/RPC should eventually allocate atomically.
      const reportVersion = Number.isFinite(currentVersion) && currentVersion > 0 ? currentVersion + 1 : 1;
      const requestId = createReportRequestId();

      // 呼叫 generate-report Edge Function
      const response: ApiResponse<GenerateReportResponse> = await EdgeFunctionService.invoke({
        functionName: 'generate-report',
        payload: {
          organization_id: organizationId,
          project_id: projectId,
          report_version: reportVersion,
          language: 'zh-TW',
          claim_purpose: 'internal_management',
          request_id: requestId,
        },
      });

      if(!current())return;
      // 處理錯誤
      if (!response.success || response.error) {
        const details = response.error?.details || {};
        console.error('[ReportPreviewPage] generate-report failed', {
          functionName: 'generate-report',
          httpStatus: details.httpStatus,
          backendValidationMessage: response.error?.message,
          requestId: response.meta?.request_id || details.requestId || requestId,
        });
        setGenerateError(response.error?.message || t('reports.generateError'));
        return;
      }

      const result = response.data;
      if (!result || typeof result.report_generation_id !== 'string' || !result.report_generation_id) {
        throw new Error(t('errors.loadFailed'));
      }
      if (response.meta?.warnings?.length) {
        setGenerateWarnings(response.meta.warnings.map(w => w.message));
      }
      // Read the persisted report through the route; generation does not return chapters.
      navigate(`/admin/reports/${encodeURIComponent(result.report_generation_id)}?${new URLSearchParams({organization_id:organizationId,projectId})}`);

    } catch (err) {
      if(!current())return;
      console.error('Failed to generate report:', err);
      setGenerateError(err instanceof Error ? err.message : t('reports.generateError'));
    } finally {
      if(current())setIsGenerating(false);
    }
  };

  /**
   * 呼叫 regenerate-section Edge Function
   * 重新產生單一章節
   */
  const handleRegenerateSection = async (sectionId: string) => {
    if (isReadonly) {
      setRegenerateError(t('subscription.readonlyBanner.message'));
      return;
    }

    setRegeneratingSection(sectionId);
    setRegenerateError(null);

    try {
      // 呼叫 regenerate-section Edge Function
      const response: ApiResponse<RegenerateSectionResponse> = await EdgeFunctionService.invoke({
        functionName: 'regenerate-section',
        payload: {
          section_id: sectionId,
          regenerate_reason: 'user_request', // user_request | data_updated | quality_issue
          preserve_user_edits: false,
        },
      });

      // 處理錯誤
      if (!response.success || response.error) {
        setRegenerateError(response.error?.message || t('reports.regenerateError'));
        return;
      }

      // 處理成功
      const result = response.data;

      // 更新章節內容
      setSections(prev =>
        prev.map(s =>
          s.id === sectionId
            ? {
                ...s,
                content: result.content,
                is_ai_generated: result.is_ai_generated,
                is_user_modified: false,
                updated_at: result.updated_at,
              }
            : s
        )
      );

      // 處理 warnings
      if (response.meta?.warnings && response.meta.warnings.length > 0) {
        console.warn('Regenerate section warnings:', response.meta.warnings);
      }

      // 顯示成功訊息
      console.log('Section regenerated successfully:', result.message);

    } catch (err) {
      console.error('Failed to regenerate section:', err);
      setRegenerateError(err instanceof Error ? err.message : t('reports.regenerateError'));
    } finally {
      setRegeneratingSection(null);
    }
  };

  const handleExportReport = async (format:'html'|'json') => {
    if(exporting||exportBlock||!reportId||!projectId||!organizationId||!user)return;
    const captured=exportContext;
    const attempt={context:captured};
    const isCurrent=()=>currentExport.current===captured&&isAuthenticationCurrent(captured.authEpoch,captured.user||'')&&!captured.exportBlock;
    activeExportAttempt.current=attempt;setExportAttempt(attempt);setExportNotice('正在向伺服器確認匯出權限與保存快照…');
    try{
      const requested=await exportCurrentSnapshot(()=>readAuthorizedReportSnapshot(getSupabaseClient(),reportId,projectId,organizationId),format,isCurrent,saveReportFile);
      if(isCurrent()){setExportNotice(requested?'已向瀏覽器提出下載請求；請核對實際檔案，未宣稱作業系統已存檔。':'操作範圍已變更，未下載。');setExportDialogOpen(false);}
    }catch(error){if(isCurrent())setExportNotice(error instanceof Error?error.message:'匯出失敗，未產生檔案。');}
    finally{activeExportAttempt.current=releaseReportExportAttempt(activeExportAttempt.current,attempt);if(currentExport.current!==null)setExportAttempt(active=>releaseReportExportAttempt(active,attempt));}
  };

  if (loading) {
    return (
      <AdminLayout>
        <LoadingState />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <ErrorState message={error} onRetry={loadReportData} />
      </AdminLayout>
    );
  }

  if (!report) return <AdminLayout><EmptyState title={t('reports.previewSection.noContent')} description={t('reports.snapshot.notFound', '找不到可存取的報告。')} /></AdminLayout>;

  return (
    <AdminLayout>
      {/* Readonly Banner */}
      {isReadonly && (
        <ReadonlyBanner
          onRenew={() => navigate('/admin/subscription')}
          onContact={() => window.open('mailto:support@cocallab.com', '_blank')}
        />
      )}

      <div className="space-y-6">
        {/* Beta / Governance notice */}
        <GovernanceBanner
          variant="beta"
          message={t('reports.betaReportWarningDesc', '目前生成報告僅供測試與內部盤查流程驗證，正式申報/查驗前需人工審核。盤查法人與據點資訊將於下一階段完整顯示。')}
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate(workflowHref('/admin/reports/history','/admin/reports/'+reportId,searchParams.toString(),organizationId||null)||'/admin/reports/history')}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2"
            >
              <i className="ri-arrow-left-line"></i>
              {t('reports.previewSection.backToHistory')}
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{t('reports.previewPage.title')}</h1>
            <p className="text-sm text-gray-600 mt-1">{report.project_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setExportDialogOpen(true)}
              disabled={exporting||Boolean(exportBlock)||!organizationId||!projectId||report.report_status!=='completed'}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              <i className="ri-download-line mr-2"></i>
              {t('reports.previewPage.exportReport')}
            </button>
          </div>
        </div>

        {/* Generate Error */}
        {generateError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <i className="ri-error-warning-line text-red-600 text-xl mr-3"></i>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">{t('reports.generateError')}</h3>
                <p className="text-sm text-red-700 mt-1">{generateError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Generate Warnings */}
        {generateWarnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex">
              <i className="ri-alert-line text-yellow-600 text-xl mr-3"></i>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-800">{t('reports.generateWarnings')}</h3>
                <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                  {generateWarnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {isGenerating && <p role="status" className="rounded-lg bg-blue-50 p-4 text-blue-700">{t('reports.generating')}</p>}

        {/* Regenerate Error */}
        {regenerateError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <i className="ri-error-warning-line text-red-600 text-xl mr-3"></i>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">{t('reports.regenerateError')}</h3>
                <p className="text-sm text-red-700 mt-1">{regenerateError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Report Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-4 gap-6">
            <div>
              <span className="text-sm text-gray-600">{t('reports.previewPage.version')}</span>
              <p className="text-lg font-semibold text-gray-900 mt-1">v{report.version_number}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600">{t('reports.previewPage.status')}</span>
              <div className="mt-1">
                <StatusBadge status={report.report_status} type="report" />
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600">{t('reports.previewPage.generatedAt')}</span>
              <p className="text-sm text-gray-900 mt-1">
                {new Date(report.generated_at).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-600">{t('reports.previewPage.sections')}</span>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {report.total_sections > 0 ? `${report.completed_sections} / ${report.total_sections}` : t('reports.previewSection.noContent')}
              </p>
            </div>
          </div>
        </div>

        {/* Statistics */}
        {statistics && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('reports.statistics.title')}
            </h2>
            <div className="grid grid-cols-4 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">{t('reports.statistics.totalEmissions')}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {statistics.total_emissions.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">tCO₂e</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">{t('reports.statistics.scope1Emissions')}</p>
                <p className="text-2xl font-bold text-red-700 mt-2">
                  {statistics.scope1_emissions.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">tCO₂e</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">{t('reports.statistics.scope2Emissions')}</p>
                <p className="text-2xl font-bold text-orange-700 mt-2">
                  {statistics.scope2_emissions.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">tCO₂e</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">{t('reports.statistics.scope3Emissions')}</p>
                <p className="text-2xl font-bold text-blue-700 mt-2">
                  {statistics.scope3_emissions.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">tCO₂e</p>
              </div>
            </div>
            {(statistics.unclassified_emissions ?? 0) > 0 && <p className="mt-4 text-sm text-amber-700">
              {t('reports.snapshot.unclassified', '總排放量包含未分類排放，尚未分配至 Scope 1–3：')}{' '}
              {statistics.unclassified_emissions.toLocaleString(undefined, { maximumFractionDigits: 6 })} tCO₂e
            </p>}
          </div>
        )}

        {!statistics && <p className="text-sm text-gray-500">{t('reports.snapshot.statisticsUnknown', '此報告未提供完整排放統計，無法顯示總量。')}</p>}

        <p role="status" className="mb-4 rounded bg-amber-50 p-3 text-sm">{exportNotice||exportBlock||'HTML／JSON每次由服務端核對權限並重讀保存快照；PDF／Word尚未提供。'}</p>
        <p role="status" className="mb-4 text-sm">{reportIntegrityNotice(report.saved_snapshot?.integrity_status)}</p>
        <ReportOutlinePanel snapshot={report.saved_snapshot} />

        {/* Sections */}
        <div className="space-y-4">
          {sections.length === 0 ? (
            <EmptyState
              title={t('reports.previewSection.noContent')}
              description=""
            />
          ) : (
            sections.map((section) => (
              <div key={section.id} className="bg-white rounded-lg border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {section.section_order}. {section.title}
                      </h3>
                      {section.is_ai_generated && (
                        <span className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded">
                          {t('reports.previewPage.aiGenerated')}
                        </span>
                      )}
                      {section.is_user_modified && (
                        <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded">
                          {t('reports.previewPage.userModified')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditSection(section)}
                        disabled={isGenerating || regeneratingSection === section.id || isReadonly}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('reports.previewPage.editSection')}
                      >
                        <i className="ri-edit-line text-lg"></i>
                      </button>
                      <button
                        onClick={() => handleRegenerateSection(section.id)}
                        disabled={isGenerating || regeneratingSection !== null || isReadonly}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('reports.previewPage.regenerateSection')}
                      >
                        {regeneratingSection === section.id ? (
                          <i className="ri-loader-4-line text-lg animate-spin"></i>
                        ) : (
                          <i className="ri-refresh-line text-lg"></i>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {editingSection === section.id ? (
                    <div className="space-y-4">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                        disabled={isReadonly}
                      />
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setEditingSection(null)}
                          className="px-4 py-2 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap"
                        >
                          {t('common.cancel')}
                        </button>
                        <button
                          onClick={handleSaveSection}
                          disabled={isReadonly}
                          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          {t('common.save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="prose max-w-none">
                      <p className="text-gray-700 whitespace-pre-wrap">{section.content}</p>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Export Dialog */}
        {exportDialogOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {t('reports.exportDialog.title')}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('reports.exportDialog.selectFormat')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['html','json'] as const).map(format=><button key={format} onClick={()=>void handleExportReport(format)} disabled={exporting||Boolean(exportBlock)} className="rounded border px-4 py-3 disabled:opacity-50">下載 {format.toUpperCase()}</button>)}
                  </div><p className="mt-3 text-sm">PDF／Word尚未提供。檔案依保存快照產生，不代表正式查驗報告。</p><p role="status">{exportNotice||exportBlock}</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setExportDialogOpen(false)}
                  className="px-4 py-2 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
