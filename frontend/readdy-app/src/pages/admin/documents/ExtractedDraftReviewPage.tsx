import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import EmptyState from '../../../components/base/EmptyState';
import ErrorState from '../../../components/base/ErrorState';
import ConfirmDialog from '../../../components/base/ConfirmDialog';
import ReadonlyBanner from '../../../components/feature/ReadonlyBanner';
import { useSubscriptionStatus } from '../../../hooks/useSubscriptionStatus';
import { getExtractedDrafts } from '../../../services/documentService';
import { EdgeFunctionService } from '../../../services/edgeFunction';
import type { ExtractedDocumentDraft } from '../../../types/document';

export default function ExtractedDraftReviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const organizationId = searchParams.get('organization_id') || undefined;
  const projectIdParam = searchParams.get('projectId') || undefined;

  const [drafts, setDrafts] = useState<ExtractedDocumentDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showBatchConfirmDialog, setShowBatchConfirmDialog] = useState(false);

  const [editNote, setEditNote] = useState('');
  const [editScope, setEditScope] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorToastMessage, setErrorToastMessage] = useState('');

  const { isReadonly } = useSubscriptionStatus(organizationId);

  // 當 projectId URL 參數變化時重新載入
  useEffect(() => {
    loadDrafts();
  }, [projectIdParam]);

  const loadDrafts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getExtractedDrafts(projectIdParam);
      setDrafts(data);
    } catch (err) {
      console.error('Failed to load drafts:', err);
      setError(t('common.errors.load_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const showError = (message: string) => {
    setErrorToastMessage(message);
    setShowErrorToast(true);
    setTimeout(() => setShowErrorToast(false), 5000);
  };

  const getErrorMessage = (error: any): string => {
    if (!error) return t('drafts.confirm_failed');
    const errorMsg = error.message || String(error);
    if (errorMsg.includes('JWT') || errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
      return t('errors.authFailed');
    }
    if (errorMsg.includes('permission') || errorMsg.includes('forbidden') || errorMsg.includes('403')) {
      return t('errors.permissionDenied');
    }
    if (errorMsg.includes('已確認過') || errorMsg.includes('already confirmed') || errorMsg.includes('duplicate')) {
      return t('drafts.errors.already_confirmed');
    }
    if (errorMsg.includes('payload') || errorMsg.includes('invalid') || errorMsg.includes('400')) {
      return t('errors.invalidPayload');
    }
    if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('timeout')) {
      return t('errors.networkError');
    }
    return errorMsg;
  };

  const handleConfirmSingle = async () => {
    if (!activeDraftId || isReadonly) return;
    try {
      setIsProcessing(true);
      const response = await EdgeFunctionService.invoke({
        functionName: 'confirm-draft',
        payload: {
          draft_id: activeDraftId,
          review_note: editNote || undefined,
          suggested_scope: editScope ? parseInt(editScope, 10) : undefined,
          suggested_category: editCategory || undefined,
        },
      });
      if (!response.success) {
        throw new Error(response.error?.message || t('drafts.confirm_failed'));
      }
      setDrafts(prev => prev.filter(d => d.id !== activeDraftId));
      setShowConfirmDialog(false);
      setActiveDraftId(null);
      setEditNote('');
      setEditScope('');
      setEditCategory('');
      setSuccessMessage(t('drafts.confirm_success'));
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
    } catch (error) {
      console.error('Failed to confirm draft:', error);
      showError(getErrorMessage(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectSingle = async () => {
    if (!activeDraftId || isReadonly) return;
    try {
      setIsProcessing(true);
      const response = await EdgeFunctionService.invoke({
        functionName: 'confirm-draft',
        payload: {
          draft_id: activeDraftId,
          status: 'rejected',
          review_note: editNote || undefined,
        },
      });
      if (!response.success) {
        throw new Error(response.error?.message || t('drafts.reject_failed'));
      }
      setDrafts(prev => prev.filter(d => d.id !== activeDraftId));
      setShowRejectDialog(false);
      setActiveDraftId(null);
      setEditNote('');
      setSuccessMessage(t('drafts.reject_success'));
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
    } catch (error) {
      console.error('Failed to reject draft:', error);
      showError(getErrorMessage(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmBatch = async () => {
    if (selectedDrafts.size === 0 || isReadonly) return;
    try {
      setIsProcessing(true);
      const draftIds = Array.from(selectedDrafts);
      const succeeded: string[] = [];
      const failed: string[] = [];
      for (const draftId of draftIds) {
        try {
          const response = await EdgeFunctionService.invoke({
            functionName: 'confirm-draft',
            payload: { draft_id: draftId },
          });
          if (response.success) {
            succeeded.push(draftId);
          } else {
            failed.push(draftId);
          }
        } catch {
          failed.push(draftId);
        }
      }
      setDrafts(prev => prev.filter(d => !succeeded.includes(d.id)));
      setSelectedDrafts(new Set());
      setShowBatchConfirmDialog(false);
      if (failed.length > 0) {
        showError(t('drafts.batch_confirm_partial', { success: succeeded.length, failed: failed.length }));
      } else {
        setSuccessMessage(t('drafts.batch_confirm_success', { count: succeeded.length }));
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 5000);
      }
    } catch (error) {
      console.error('Failed to batch confirm:', error);
      showError(getErrorMessage(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const openConfirmDialog = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) return;
    setActiveDraftId(draftId);
    setEditScope(draft.suggested_scope?.toString() || '');
    setEditCategory(draft.suggested_category || '');
    setEditNote('');
    setShowConfirmDialog(true);
  };

  const openRejectDialog = (draftId: string) => {
    setActiveDraftId(draftId);
    setEditNote('');
    setShowRejectDialog(true);
  };

  const toggleSelectAll = () => {
    if (selectedDrafts.size === drafts.length) {
      setSelectedDrafts(new Set());
    } else {
      setSelectedDrafts(new Set(drafts.map(d => d.id)));
    }
  };

  const toggleSelect = (draftId: string) => {
    setSelectedDrafts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(draftId)) {
        newSet.delete(draftId);
      } else {
        newSet.add(draftId);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <LoadingState message={t('drafts.loading_message')} />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <ErrorState message={error} onRetry={loadDrafts} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {isReadonly && (
        <ReadonlyBanner
          onRenew={() => navigate('/admin/subscription')}
          onContact={() => window.open('mailto:support@cocallab.com', '_blank')}
        />
      )}

      {/* 成功 Toast */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <i className="ri-check-line text-xl text-green-600"></i>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">{successMessage}</p>
            <button
              onClick={() => navigate('/admin/activities')}
              className="text-sm text-green-700 underline mt-1 cursor-pointer"
            >
              {t('drafts.go_to_activities')}
            </button>
          </div>
          <button
            onClick={() => setShowSuccessToast(false)}
            className="text-green-600 hover:text-green-800 cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
      )}

      {/* 錯誤 Toast */}
      {showErrorToast && (
        <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <i className="ri-error-warning-line text-xl text-red-600"></i>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">{errorToastMessage}</p>
          </div>
          <button
            onClick={() => setShowErrorToast(false)}
            className="text-red-600 hover:text-red-800 cursor-pointer"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {t('drafts.review_page')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('drafts.pending_count', { count: drafts.length })}
            {projectIdParam && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded-full">
                {t('common.filtered_by_project')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedDrafts.size > 0 && (
            <button
              onClick={() => setShowBatchConfirmDialog(true)}
              disabled={isReadonly || isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              <i className="ri-check-double-line mr-2"></i>
              {t('drafts.batch_confirm')} ({selectedDrafts.size})
            </button>
          )}
          <button
            onClick={() => navigate('/admin/documents/upload')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 whitespace-nowrap cursor-pointer"
          >
            <i className="ri-upload-line mr-2"></i>
            {t('documents.uploadPage')}
          </button>
        </div>
      </div>

      {drafts.length === 0 ? (
        <EmptyState
          title={t('drafts.empty_title')}
          description={t('drafts.empty_description')}
          actionLabel={t('documents.uploadPage')}
          onAction={() => navigate('/admin/documents/upload')}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center">
            <input
              type="checkbox"
              checked={selectedDrafts.size === drafts.length && drafts.length > 0}
              onChange={toggleSelectAll}
              disabled={isReadonly}
              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
            />
            <span className="ml-3 text-sm font-medium text-gray-700">
              {selectedDrafts.size === drafts.length
                ? t('common.deselect_all')
                : t('common.select_all')}
            </span>
          </div>

          <div className="divide-y divide-gray-200">
            {drafts.map(draft => (
              <div key={draft.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedDrafts.has(draft.id)}
                    onChange={() => toggleSelect(draft.id)}
                    disabled={isReadonly}
                    className="mt-1 w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <i className="ri-file-text-line text-gray-400"></i>
                      <h3 className="text-sm font-medium text-gray-900">
                        {draft.document?.original_filename || t('drafts.fields.document_name')}
                      </h3>
                      {draft.document?.project?.name && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-700 rounded">
                          {draft.document.project.name}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          {t('drafts.suggested_date')}
                        </label>
                        <p className="text-sm text-gray-900">
                          {draft.suggested_activity_date || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          {t('drafts.quantity')}
                        </label>
                        <p className="text-sm text-gray-900">
                          {draft.parsed_quantity} {draft.parsed_unit}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          {t('drafts.suggested_category')}
                        </label>
                        <p className="text-sm text-gray-900">
                          {draft.suggested_category || '-'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          {t('drafts.suggested_scope')}
                        </label>
                        <p className="text-sm text-gray-900">
                          {draft.suggested_scope ? `Scope ${draft.suggested_scope}` : '-'}
                        </p>
                      </div>
                    </div>
                    {(draft.parsed_vendor || draft.confidence_score) && (
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                        {draft.parsed_vendor && (
                          <span>
                            <i className="ri-store-line mr-1"></i>
                            {draft.parsed_vendor}
                          </span>
                        )}
                        {draft.confidence_score && (
                          <span>
                            <i className="ri-bar-chart-line mr-1"></i>
                            {t('drafts.confidence')}: {(draft.confidence_score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openConfirmDialog(draft.id)}
                        disabled={isReadonly || isProcessing}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                      >
                        <i className="ri-check-line mr-1"></i>
                        {t('drafts.confirm_button')}
                      </button>
                      <button
                        onClick={() => openRejectDialog(draft.id)}
                        disabled={isReadonly || isProcessing}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                      >
                        <i className="ri-close-line mr-1"></i>
                        {t('drafts.reject_button')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 確認對話框 */}
      {showConfirmDialog && (
        <ConfirmDialog
          title={t('drafts.confirm_dialog.title')}
          message={t('drafts.confirm_dialog.message')}
          confirmLabel={t('common.confirm')}
          cancelLabel={t('common.cancel')}
          onConfirm={handleConfirmSingle}
          onCancel={() => {
            setShowConfirmDialog(false);
            setActiveDraftId(null);
          }}
          isProcessing={isProcessing}
        >
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('drafts.suggested_scope')}
              </label>
              <select
                value={editScope}
                onChange={e => setEditScope(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              >
                <option value="">-</option>
                <option value="1">Scope 1</option>
                <option value="2">Scope 2</option>
                <option value="3">Scope 3</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('drafts.suggested_category')}
              </label>
              <input
                type="text"
                value={editCategory}
                onChange={e => setEditCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                placeholder={t('drafts.suggested_category')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('drafts.review_notes')}
              </label>
              <textarea
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                placeholder={t('drafts.review_notes')}
              />
            </div>
          </div>
        </ConfirmDialog>
      )}

      {/* 拒絕對話框 */}
      {showRejectDialog && (
        <ConfirmDialog
          title={t('drafts.reject_dialog.title')}
          message={t('drafts.reject_dialog.message')}
          confirmLabel={t('drafts.reject_button')}
          cancelLabel={t('common.cancel')}
          onConfirm={handleRejectSingle}
          onCancel={() => {
            setShowRejectDialog(false);
            setActiveDraftId(null);
          }}
          isProcessing={isProcessing}
          isDanger
        >
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('drafts.review_notes')}
            </label>
            <textarea
              value={editNote}
              onChange={e => setEditNote(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
              placeholder={t('drafts.reject_dialog.notes_placeholder')}
            />
          </div>
        </ConfirmDialog>
      )}

      {/* 批次確認對話框 */}
      {showBatchConfirmDialog && (
        <ConfirmDialog
          title={t('drafts.batch_confirm')}
          message={t('drafts.confirm_dialog.batch_message', { count: selectedDrafts.size })}
          confirmLabel={t('common.confirm')}
          cancelLabel={t('common.cancel')}
          onConfirm={handleConfirmBatch}
          onCancel={() => setShowBatchConfirmDialog(false)}
          isProcessing={isProcessing}
        />
      )}
    </AdminLayout>
  );
}
