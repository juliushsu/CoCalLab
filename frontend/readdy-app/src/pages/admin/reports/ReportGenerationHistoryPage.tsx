import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mockEmissionsSummary } from '@/mocks/carbonAdjustments.fixture';
import AdminLayout from '@/components/layout/AdminLayout';
import { fetchLatestGlobalSnapshot } from '@/services/reportSnapshotService';
import type { EmissionsSummaryDTO } from '@/types/carbonAdjustment';
import { getSupabaseClient, isSupabaseConnected } from '@/lib/supabase';
import { EdgeFunctionService } from '@/services/edgeFunction';
import LoadingState from '@/components/base/LoadingState';
import EmptyState from '@/components/base/EmptyState';
import ErrorState from '@/components/base/ErrorState';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  project_code: string;
}

interface ReportGeneration {
  id: string;
  project_id: string;
  project_name?: string;
  report_version: number;
  status: 'generating' | 'completed' | 'failed';
  included_activity_count: number;
  excluded_activity_count: number;
  pending_activity_count: number;
  reporting_period_start: string;
  reporting_period_end: string;
  scope_totals: Record<string, number> | null;
  category_totals: Record<string, number> | null;
  warning_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditResult {
  id: string;
  status: string;
  summary_text: { zh_tw?: string; en?: string; ja?: string } | null;
  completeness_flags: Array<{ code: string; count?: number; severity?: string }>;
  anomaly_flags: Array<{ code: string; count?: number; severity?: string }>;
  exclusion_review_flags: Array<{ code: string; count?: number; severity?: string }>;
  hotspot_ranking: Array<{ rank: number; co2e_kg: number; category: string; emission_activity_id?: string }>;
  recommended_actions: Array<{
    priority: string;
    action_id: string;
    description: { zh_tw?: string; en?: string; ja?: string };
  }>;
  confidence_score: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReportGeneration['status'] }) {
  const { t } = useTranslation();
  const map: Record<ReportGeneration['status'], { cls: string; label: string }> = {
    generating: { cls: 'bg-blue-100 text-blue-700', label: t('reports.status.generating') },
    completed:  { cls: 'bg-green-100 text-green-700', label: t('reports.status.completed') },
    failed:     { cls: 'bg-red-100 text-red-700', label: t('reports.status.failed') },
  };
  const { cls, label } = map[status] ?? map.failed;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Generate Dialog ──────────────────────────────────────────────────────────

interface GenerateDialogProps {
  projects: Project[];
  onClose: () => void;
  onSuccess: () => void;
}

function GenerateDialog({ projects, onClose, onSuccess }: GenerateDialogProps) {
  const { t } = useTranslation();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [reportLanguage, setReportLanguage] = useState('zh');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedProjectId) {
      setError(t('reports.generate_dialog.selectProjectError'));
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const response = await EdgeFunctionService.invoke({
        functionName: 'generate-report',
        payload: {
          project_id: selectedProjectId,
          language: reportLanguage,
          report_type: 'annual',
        },
      });
      if (!response.success) {
        throw new Error(response.error?.message || t('errors.generic'));
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('reports.generate_dialog.title')}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-5">{t('reports.generate_dialog.description')}</p>

        <div className="space-y-4 mb-6">
          {/* 專案選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('projects.fields.name')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={generating}
                className="w-full appearance-none px-3 py-2.5 pr-8 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white disabled:opacity-50"
              >
                <option value="">{t('projects.select_project_type')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.project_code})
                  </option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
            </div>
          </div>

          {/* 語言 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('reports.generate_dialog.language')}
            </label>
            <div className="relative">
              <select
                value={reportLanguage}
                onChange={(e) => setReportLanguage(e.target.value)}
                disabled={generating}
                className="w-full appearance-none px-3 py-2.5 pr-8 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white disabled:opacity-50"
              >
                <option value="zh">繁體中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
              <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <i className="ri-error-warning-line text-red-500 mt-0.5 flex-shrink-0"></i>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedProjectId}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generating ? (
              <>
                <i className="ri-loader-4-line animate-spin"></i>
                {t('reports.generate_dialog.generating')}
              </>
            ) : (
              <>
                <i className="ri-file-add-line"></i>
                {t('reports.generate')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AI Audit Dialog ──────────────────────────────────────────────────────────

interface AuditDialogProps {
  result: AuditResult;
  onClose: () => void;
}

function AuditDialog({ result, onClose }: AuditDialogProps) {
  const { t, i18n } = useTranslation();

  // 取得對應語系的文字
  const getLangText = (obj: { zh_tw?: string; en?: string; ja?: string } | null | undefined): string => {
    if (!obj) return '';
    const lang = i18n.language;
    if (lang === 'zh' || lang === 'zh-TW') return obj.zh_tw || obj.en || '';
    if (lang === 'ja') return obj.ja || obj.en || '';
    return obj.en || obj.zh_tw || '';
  };

  const summaryText = getLangText(result.summary_text);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">{t('audit.results_summary')}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 摘要 */}
        {summaryText && (
          <div className="mb-5 p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <p className="text-sm text-gray-700">{summaryText}</p>
          </div>
        )}

        {/* 信心分數 */}
        {result.confidence_score != null && (
          <div className="mb-5 flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">{t('audit.confidence_score')}：</span>
            <span className="text-sm font-semibold text-teal-700">
              {(Number(result.confidence_score) * 100).toFixed(0)}%
            </span>
          </div>
        )}

        {/* 完整性檢查 */}
        {result.completeness_flags.length > 0 && (
          <div className="mb-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('audit.completeness_check')}</h4>
            <div className="space-y-2">
              {result.completeness_flags.map((flag, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <i className="ri-alert-fill text-yellow-500 w-4 h-4 flex items-center justify-center"></i>
                    <span className="text-sm text-gray-700">{flag.code}</span>
                  </div>
                  {flag.count != null && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      flag.severity === 'high' ? 'bg-red-100 text-red-700' :
                      flag.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {flag.count} 筆 · {flag.severity}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 異常值檢查 */}
        {result.anomaly_flags.length > 0 ? (
          <div className="mb-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('audit.anomaly_check')}</h4>
            <div className="space-y-2">
              {result.anomaly_flags.map((flag, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 bg-red-50 rounded-lg">
                  <i className="ri-error-warning-fill text-red-500 w-4 h-4 flex items-center justify-center"></i>
                  <span className="text-sm text-gray-700">{flag.code}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('audit.anomaly_check')}</h4>
            <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-lg">
              <i className="ri-checkbox-circle-fill text-green-500 w-4 h-4 flex items-center justify-center"></i>
              <span className="text-sm text-gray-700">未發現異常值</span>
            </div>
          </div>
        )}

        {/* 排放熱點 */}
        {result.hotspot_ranking.length > 0 && (
          <div className="mb-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('audit.emission_hotspots')}</h4>
            <div className="space-y-2">
              {result.hotspot_ranking.slice(0, 5).map((h, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center bg-teal-100 text-teal-700 text-xs font-bold rounded-full">
                      {h.rank}
                    </span>
                    <span className="text-sm text-gray-700">{h.category}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {h.co2e_kg.toFixed(2)} kgCO₂e
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 改善建議 */}
        {result.recommended_actions.length > 0 && (
          <div className="mb-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('audit.recommended_actions')}</h4>
            <ul className="space-y-2">
              {result.recommended_actions.slice(0, 5).map((action, i) => (
                <li key={i} className="flex items-start gap-2 p-2.5 bg-orange-50 rounded-lg">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 ${
                    action.priority === 'high' ? 'bg-red-100 text-red-700' :
                    action.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {action.priority}
                  </span>
                  <span className="text-sm text-gray-700">{getLangText(action.description)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportGenerationHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [reports, setReports] = useState<ReportGeneration[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(false);

  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  // ── Three-layer snapshot state ──────────────────────────────────────────────
  const [snapshotSummary, setSnapshotSummary] = useState<EmissionsSummaryDTO>(mockEmissionsSummary);
  const [snapshotIsReal, setSnapshotIsReal] = useState(false);

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!isSupabaseConnected()) {
      setError(t('common.errors.load_failed'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();

      const [{ data: reportData, error: reportErr }, { data: projectData, error: projectErr }] =
        await Promise.all([
          supabase
            .from('report_generations')
            .select('*, project:projects(name)')
            .order('created_at', { ascending: false }),
          supabase
            .from('projects')
            .select('id, name, project_code')
            .order('name'),
        ]);

      if (reportErr) throw reportErr;
      if (projectErr) throw projectErr;

      setReports(
        (reportData || []).map((r: any) => ({
          ...r,
          project_name: r.project?.name ?? '',
        }))
      );
      setProjects(projectData || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Fetch snapshot ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchLatestGlobalSnapshot().then((res) => {
      if (res) {
        setSnapshotSummary(res.summary);
        setSnapshotIsReal(res.isReal);
      }
    });
  }, []);

  // ── Run AI Audit ────────────────────────────────────────────────────────────

  const handleRunAudit = async (report: ReportGeneration) => {
    setAuditingId(report.id);
    setAuditError(null);
    try {
      const response = await EdgeFunctionService.invoke<AuditResult>({
        functionName: 'run-ai-audit',
        payload: {
          report_generation_id: report.id,
          project_id: report.project_id,
        },
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || t('audit.failed'));
      }

      setAuditResult(response.data);
    } catch (err: unknown) {
      setAuditError(err instanceof Error ? err.message : t('audit.failed'));
    } finally {
      setAuditingId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('reports.list_title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('reports.list_description')}</p>
          </div>
          <button
            onClick={() => {
              setGenerateSuccess(false);
              setShowGenerateDialog(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors"
          >
            <i className="ri-file-add-line text-base w-4 h-4 flex items-center justify-center"></i>
            {t('reports.generate_button')}
          </button>
        </div>

        {/* Three-layer emissions summary panel */}
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">{t('carbonAdjustments.reportSummary.title')}</h2>
              {snapshotIsReal ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <i className="ri-checkbox-circle-line text-xs"></i>
                  {t('carbonAdjustments.reportSummary.realData')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  {t('carbonAdjustments.reportSummary.mockData')}
                </span>
              )}
            </div>
            <Link to="/admin/carbon-adjustments" className="text-xs text-teal-600 hover:underline whitespace-nowrap">
              {t('carbonAdjustments.reportSummary.viewAdjustments')} &rarr;
            </Link>
          </div>
          {/* Rule engine warning — always show until rule engine is connected */}
          {!snapshotIsReal && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <i className="ri-error-warning-line text-amber-500 text-sm mt-0.5 flex-shrink-0"></i>
              <p className="text-xs text-amber-700">{t('carbonAdjustments.reportSummary.ruleEngineNotice')}</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            {/* Gross */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="flex items-center gap-1.5 mb-1">
                <i className="ri-lock-line text-gray-400 text-xs w-3 h-3 flex items-center justify-center"></i>
                <span className="text-xs text-gray-500 font-medium">{t('carbonAdjustments.reportSummary.grossLabel')}</span>
              </div>
              <div className="text-xl font-bold text-gray-800">{snapshotSummary.gross_emissions_tco2e.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-0.5">{t('carbonAdjustments.summary.unit')}</div>
              <p className="text-[10px] text-gray-400 mt-1">{t('carbonAdjustments.notices.grossImmutable')}</p>
            </div>
            {/* Adjustments */}
            <div className="bg-teal-50 rounded-lg p-4 border border-teal-100">
              <div className="flex items-center gap-1.5 mb-1">
                <i className="ri-subtract-line text-teal-500 text-xs w-3 h-3 flex items-center justify-center"></i>
                <span className="text-xs text-teal-600 font-medium">{t('carbonAdjustments.reportSummary.adjustmentsLabel')}</span>
              </div>
              <div className="text-xl font-bold text-teal-700">-{snapshotSummary.total_adjustments_tco2e.toLocaleString()}</div>
              <div className="text-xs text-teal-500 mt-0.5">{t('carbonAdjustments.summary.unit')}</div>
              {snapshotSummary.has_pending_adjustments && (
                <p className="text-[10px] text-amber-600 mt-1">{t('carbonAdjustments.summary.pendingNote')}</p>
              )}
            </div>
            {/* Claim result */}
            <div className="bg-teal-700 rounded-lg p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <i className="ri-flag-line text-teal-200 text-xs w-3 h-3 flex items-center justify-center"></i>
                <span className="text-xs text-teal-200 font-medium">{t('carbonAdjustments.reportSummary.claimLabel')}</span>
              </div>
              <div className="text-xl font-bold text-white">{snapshotSummary.claimable_result_tco2e.toLocaleString()}</div>
              <div className="text-xs text-teal-300 mt-0.5">{t('carbonAdjustments.summary.unit')}</div>
              {snapshotSummary.claim_purpose_label && (
                <p className="text-[10px] text-teal-200 mt-1">
                  {t('carbonAdjustments.reportSummary.claimPurposeLabel')}：{snapshotSummary.claim_purpose_label}
                </p>
              )}
              {!snapshotIsReal && (
                <p className="text-[10px] text-teal-300 mt-1">{t('carbonAdjustments.reportSummary.previewNotice')}</p>
              )}
            </div>
          </div>
          {/* Period label */}
          {snapshotSummary.period && (
            <p className="text-[10px] text-gray-400 mt-3 text-right">{snapshotSummary.period}</p>
          )}
        </div>

        {/* Success banner */}
        {generateSuccess && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <i className="ri-checkbox-circle-fill text-green-500 text-lg w-5 h-5 flex items-center justify-center"></i>
            <p className="text-sm text-green-700">{t('reports.generate_dialog.success')}</p>
            <button
              onClick={() => setGenerateSuccess(false)}
              className="ml-auto text-green-500 hover:text-green-700"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
        )}

        {/* Audit error banner */}
        {auditError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <i className="ri-error-warning-line text-red-500 text-lg w-5 h-5 flex items-center justify-center"></i>
            <p className="text-sm text-red-700">{auditError}</p>
            <button
              onClick={() => setAuditError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <i className="ri-close-line"></i>
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <LoadingState message={t('common.loading')} />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchData} />
        ) : reports.length === 0 ? (
          <EmptyState
            title={t('reports.empty_title')}
            description={t('reports.empty_description')}
            action={{
              label: t('reports.generate_button'),
              onClick: () => setShowGenerateDialog(true),
            }}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">
                    {t('projects.fields.name')}
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                    {t('reports.history_page.version_number')}
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                    {t('reports.history_page.status')}
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                    {t('activities.title')}
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                    {t('reports.history_page.generated_at')}
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">
                    {t('common.table_actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {report.project_name || '-'}
                      </div>
                      {report.reporting_period_start && (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {report.reporting_period_start} ～ {report.reporting_period_end}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-700">
                        v{report.report_version}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={report.status} />
                      {report.warning_count > 0 && (
                        <div className="mt-1">
                          <span className="text-xs text-yellow-600">
                            <i className="ri-alert-line mr-0.5"></i>
                            {report.warning_count} 個警告
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-700">
                        {report.included_activity_count ?? 0} 筆
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-500">
                        {formatDate(report.created_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* 檢視報告 */}
                        {report.status === 'completed' && (
                          <button
                            onClick={() => navigate(`/admin/reports/${report.id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors whitespace-nowrap"
                          >
                            <i className="ri-eye-line w-3.5 h-3.5 flex items-center justify-center"></i>
                            {t('reports.history_page.view_report')}
                          </button>
                        )}

                        {/* AI 稽核 */}
                        {report.status === 'completed' && (
                          <button
                            onClick={() => handleRunAudit(report)}
                            disabled={auditingId === report.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {auditingId === report.id ? (
                              <>
                                <i className="ri-loader-4-line animate-spin w-3.5 h-3.5 flex items-center justify-center"></i>
                                {t('audit.running')}
                              </>
                            ) : (
                              <>
                                <i className="ri-robot-line w-3.5 h-3.5 flex items-center justify-center"></i>
                                {t('audit.run_button')}
                              </>
                            )}
                          </button>
                        )}

                        {/* 失敗時顯示錯誤 */}
                        {report.status === 'failed' && report.error_message && (
                          <span className="text-xs text-red-500 max-w-[160px] truncate" title={report.error_message}>
                            {report.error_message}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showGenerateDialog && (
        <GenerateDialog
          projects={projects}
          onClose={() => setShowGenerateDialog(false)}
          onSuccess={() => {
            setGenerateSuccess(true);
            fetchData();
          }}
        />
      )}

      {auditResult && (
        <AuditDialog
          result={auditResult}
          onClose={() => setAuditResult(null)}
        />
      )}
    </AdminLayout>
  );
}
