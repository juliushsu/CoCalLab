import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import { ErrorState } from '../../../components/base/ErrorState';
import { EmptyState } from '../../../components/base/EmptyState';
import { StatusBadge } from '../../../components/base/StatusBadge';
import ReadonlyBanner from '../../../components/feature/ReadonlyBanner';
import { useSubscriptionStatus } from '../../../hooks/useSubscriptionStatus';
import { EdgeFunctionService } from '../../../services/edgeFunction';
import type { ApiResponse } from '../../../services/types';
import type { ReportVersion, ReportSection, ReportStatistics } from '../../../types/report';
import { getReportData } from '../../../services/reportService';

// Generate Report Response Type
interface GenerateReportResponse {
  report_version_id: string;
  project_id: string;
  version_number: number;
  total_sections: number;
  completed_sections: number;
  report_status: 'generating' | 'completed' | 'failed';
  sections: Array<{
    section_id: string;
    section_type: string;
    section_order: number;
    title: string;
    content: string;
    is_ai_generated: boolean;
  }>;
  statistics?: ReportStatistics;
  message: string;
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

  // Generate Report States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateProgress, setGenerateProgress] = useState<{
    completed: number;
    total: number;
    currentSection?: string;
  } | null>(null);
  const [generateWarnings, setGenerateWarnings] = useState<string[]>([]);

  // Regenerate Section States
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  // 訂閱狀態檢查
  const organizationId = searchParams.get('organization_id') || undefined;
  const { status, isReadonly, reason, loading: statusLoading } = useSubscriptionStatus(organizationId);

  useEffect(() => {
    loadReportData();
  }, [reportId]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 使用 reportService 取得資料（會自動處理 Supabase 連線狀態）
      const { report, sections, statistics } = await getReportData(reportId || '');
      
      setReport(report);
      setSections(sections);
      setStatistics(statistics);
    } catch (err) {
      console.error('Failed to load report:', err);
      setError(t('errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

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
   * 產生完整報告，包含所有章節
   */
  const handleGenerateReport = async (projectId: string) => {
    if (isReadonly) {
      setGenerateError(t('subscription.readonlyBanner.message'));
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setGenerateWarnings([]);
    setGenerateProgress({ completed: 0, total: 10 });

    try {
      // 呼叫 generate-report Edge Function
      const response: ApiResponse<GenerateReportResponse> = await EdgeFunctionService.invoke({
        functionName: 'generate-report',
        payload: {
          project_id: projectId,
          report_type: 'full', // full | summary | custom
          include_statistics: true,
          include_charts: true,
          language: 'zh-TW',
        },
      });

      // 處理錯誤
      if (!response.success || response.error) {
        setGenerateError(response.error?.message || t('reports.generateError'));
        return;
      }

      // 處理成功
      const result = response.data;
      
      // 更新報告資料
      setReport({
        id: result.report_version_id,
        project_id: result.project_id,
        project_name: report?.project_name || '',
        version_number: result.version_number,
        report_status: result.report_status,
        generated_by: 'current-user',
        generated_at: new Date().toISOString(),
        completed_at: result.report_status === 'completed' ? new Date().toISOString() : undefined,
        total_sections: result.total_sections,
        completed_sections: result.completed_sections,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 更新章節資料
      setSections(result.sections.map(s => ({
        id: s.section_id,
        report_version_id: result.report_version_id,
        section_type: s.section_type as any,
        section_order: s.section_order,
        title: s.title,
        content: s.content,
        is_ai_generated: s.is_ai_generated,
        is_user_modified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })));

      // 更新統計資料
      if (result.statistics) {
        setStatistics(result.statistics);
      }

      // 更新進度
      setGenerateProgress({
        completed: result.completed_sections,
        total: result.total_sections,
      });

      // 處理 warnings
      if (response.meta?.warnings && response.meta.warnings.length > 0) {
        setGenerateWarnings(response.meta.warnings.map(w => w.message));
      }

      // 顯示成功訊息
      console.log('Report generated successfully:', result.message);

    } catch (err) {
      console.error('Failed to generate report:', err);
      setGenerateError(err instanceof Error ? err.message : t('reports.generateError'));
    } finally {
      setIsGenerating(false);
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

  const handleExportReport = async (format: 'pdf' | 'docx' | 'html') => {
    if (isReadonly) {
      alert(t('subscription.readonlyBanner.message'));
      setExportDialogOpen(false);
      return;
    }

    try {
      // TODO: 呼叫 Edge Function 匯出報告（等 Edge Function 部署後啟用）
      // const { data } = await supabase.functions.invoke('export-report', {
      //   body: { report_version_id: reportId, format },
      // });
      
      console.log('Exporting report as:', format);
      setExportDialogOpen(false);
    } catch (err) {
      console.error('Failed to export report:', err);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <LoadingState />
      </AdminLayout>
    );
  }

  if (error || !report) {
    return (
      <AdminLayout>
        <ErrorState message={error || t('errors.loadFailed')} onRetry={loadReportData} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Readonly Banner */}
      {isReadonly && (
        <ReadonlyBanner
          onRenew={() => navigate('/admin/subscription')}
          onContact={() => window.open('mailto:support@cacalab.com', '_blank')}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('/admin/reports/history')}
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
              disabled={isReadonly}
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

        {/* Generate Progress */}
        {isGenerating && generateProgress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <i className="ri-loader-4-line text-blue-600 text-xl mr-3 animate-spin"></i>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-800">{t('reports.generating')}</h3>
                <p className="text-sm text-gray-900">
                  {t('reports.generateProgress', {
                    completed: generateProgress.completed,
                    total: generateProgress.total,
                  })}
                </p>
                {generateProgress.currentSection && (
                  <p className="text-xs text-blue-600 mt-1">
                    {t('reports.currentSection')}: {generateProgress.currentSection}
                  </p>
                )}
                <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(generateProgress.completed / generateProgress.total) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

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
                {report.completed_sections} / {report.total_sections}
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
                <p className="text-xs text-gray-500 mt-1">{t('reports.statistics.unit')}</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-600">{t('reports.statistics.scope1Emissions')}</p>
                <p className="text-2xl font-bold text-red-700 mt-2">
                  {statistics.scope1_emissions.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{t('reports.statistics.unit')}</p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">{t('reports.statistics.scope2Emissions')}</p>
                <p className="text-2xl font-bold text-orange-700 mt-2">
                  {statistics.scope2_emissions.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{t('reports.statistics.unit')}</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">{t('reports.statistics.scope3Emissions')}</p>
                <p className="text-2xl font-bold text-blue-700 mt-2">
                  {statistics.scope3_emissions.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{t('reports.statistics.unit')}</p>
              </div>
            </div>
          </div>
        )}

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
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => handleExportReport('pdf')}
                      disabled={isReadonly}
                      className="px-4 py-3 text-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="ri-file-pdf-line text-2xl text-red-600 mb-1"></i>
                      <p className="text-sm font-medium text-gray-900">PDF</p>
                    </button>
                    <button
                      onClick={() => handleExportReport('docx')}
                      disabled={isReadonly}
                      className="px-4 py-3 text-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="ri-file-word-line text-2xl text-blue-600 mb-1"></i>
                      <p className="text-sm font-medium text-gray-900">Word</p>
                    </button>
                    <button
                      onClick={() => handleExportReport('html')}
                      disabled={isReadonly}
                      className="px-4 py-3 text-center border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <i className="ri-file-code-line text-2xl text-orange-600 mb-1"></i>
                      <p className="text-sm font-medium text-gray-900">HTML</p>
                    </button>
                  </div>
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