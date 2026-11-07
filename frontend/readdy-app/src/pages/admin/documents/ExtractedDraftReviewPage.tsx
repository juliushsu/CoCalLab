import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
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
import DraftAIExplanationPanel from './components/DraftAIExplanationPanel';
import { draftReviewScope, draftReviewDestination, draftReviewValues, isSyntheticDraft, isProtectedManualDraft, validateDraftReviewRows, submitDraftDecision, submitDraftBatch, type DraftReviewScope } from '../../../services/draftReview';
import { useAuth } from '../../../hooks/useAuth';
import { currentSession } from '../../../services/navigationScope';

export default function ExtractedDraftReviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {session,loading:authLoading}=useAuth();
  const search=searchParams.toString();
  const context=useMemo(()=>({search,session}),[search,session]);
  const currentContext=useRef<typeof context|null>(context);
  const busy=useRef(false);
  const [loadedContext,setLoadedContext]=useState<typeof context|null>(null);
  const selected=useMemo<{scope:DraftReviewScope;error:string|null}>(()=>{try{return {scope:draftReviewScope(search),error:null};}catch(error){return {scope:{},error:error instanceof Error?error.message:'草稿範圍無效。'};}},[search]);
  const organizationId=selected.scope.organizationId;
  const projectIdParam=selected.scope.projectId;
  const scopedHref=(path:'/admin/activities'|'/admin/documents/upload')=>draftReviewDestination(path,selected.scope);

  const [drafts, setDrafts] = useState<ExtractedDocumentDraft[]>([]);
  const confirmableDrafts=drafts.filter(draft=>!isSyntheticDraft(draft)&&!isProtectedManualDraft(draft));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsRefresh,setNeedsRefresh]=useState(false);

  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showBatchConfirmDialog, setShowBatchConfirmDialog] = useState(false);

  const [editNote, setEditNote] = useState('');
  const [editScope, setEditScope] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [expandedExplanationDrafts, setExpandedExplanationDrafts] = useState<Set<string>>(new Set());

  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorToastMessage, setErrorToastMessage] = useState('');

  const subscription=useSubscriptionStatus(organizationId);
  const isReadonly=subscription.isReadonly||subscription.loading||Boolean(subscription.error)||!organizationId||!currentSession(session)||needsRefresh;
  useLayoutEffect(()=>{
    currentContext.current=context;busy.current=false;
    setSelectedDrafts(new Set());setActiveDraftId(null);setShowConfirmDialog(false);setShowRejectDialog(false);setShowBatchConfirmDialog(false);
    setIsProcessing(false);setShowSuccessToast(false);setShowErrorToast(false);setExpandedExplanationDrafts(new Set());
    return()=>{if(currentContext.current===context)currentContext.current=null;};
  },[context]);
  const loadDrafts=useCallback(async()=>{
    if(authLoading)return;
    setIsLoading(true);setError(null);
    try{
      if(!currentSession(context.session))throw new Error('請先登入有效的工作階段。');
      if(selected.error)throw new Error(selected.error);
      const rows=await getExtractedDrafts(projectIdParam,organizationId,selected.scope.documentId);
      if(currentContext.current!==context)return;
      if(!currentSession(context.session))throw new Error('工作階段已失效，請重新登入。');
      const validated=validateDraftReviewRows(rows,selected.scope);
      setDrafts(validated);setSelectedDrafts(prev=>new Set([...prev].filter(id=>validated.some(row=>row.id===id))));
      setNeedsRefresh(false);setShowErrorToast(false);setShowSuccessToast(false);
    }catch(cause){
      if(currentContext.current===context){setDrafts([]);setError(cause instanceof Error?cause.message:'草稿讀取失敗。');}
    }finally{
      if(currentContext.current===context){setIsLoading(false);setLoadedContext(context);}
    }
  },[authLoading,context,selected,projectIdParam,organizationId]);
  useEffect(()=>{void loadDrafts();},[loadDrafts]);
  const showError=(message:string)=>{setErrorToastMessage(message);setShowErrorToast(true);};
  const requireRefresh=(message:string)=>{
    setNeedsRefresh(true);setShowConfirmDialog(false);setShowRejectDialog(false);setShowBatchConfirmDialog(false);
    showError(message+' 請先重新讀取草稿再操作；伺服器可能已保存，勿直接重送。');
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

  const handleSingle=async(decision:'confirmed'|'rejected')=>{
    if(!activeDraftId||isReadonly||busy.current||loadedContext!==context)return;
    const captured=context,isCurrent=()=>currentContext.current===captured&&currentSession(captured.session);
    busy.current=true;setIsProcessing(true);setShowSuccessToast(false);setShowErrorToast(false);
    try{
      const draft=drafts.find(row=>row.id===activeDraftId);
      if(!draft)throw new Error('草稿已不在目前清單，請重新讀取。');
      await submitDraftDecision(options=>EdgeFunctionService.invoke(options),draft,decision,selected.scope,
        {reviewNote:editNote,category:editCategory,scope:editScope},isCurrent);
      if(!isCurrent())return;
      setDrafts(prev=>prev.filter(row=>row.id!==draft.id));
      setSelectedDrafts(prev=>{const next=new Set(prev);next.delete(draft.id);return next;});
      setShowConfirmDialog(false);setShowRejectDialog(false);setActiveDraftId(null);setEditNote('');setEditScope('');setEditCategory('');
      setSuccessMessage(t(decision==='confirmed'?'drafts.confirm_success':'drafts.reject_success'));setShowSuccessToast(true);
    }catch(error){if(isCurrent())requireRefresh(getErrorMessage(error));}
    finally{if(currentContext.current===captured){busy.current=false;setIsProcessing(false);}}
  };
  const handleConfirmSingle=()=>handleSingle('confirmed');
  const handleRejectSingle=()=>handleSingle('rejected');
  const handleConfirmBatch=async()=>{
    if(!selectedDrafts.size||isReadonly||busy.current||loadedContext!==context)return;
    const captured=context,isCurrent=()=>currentContext.current===captured&&currentSession(captured.session);
    busy.current=true;setIsProcessing(true);setShowSuccessToast(false);setShowErrorToast(false);
    try{
      const rows=drafts.filter(row=>selectedDrafts.has(row.id));
      if(rows.length!==selectedDrafts.size)throw new Error('選取清單已變更，請重新讀取。');
      const {succeeded,failed}=await submitDraftBatch(options=>EdgeFunctionService.invoke(options),rows,selected.scope,isCurrent);
      if(!isCurrent())return;
      setDrafts(prev=>prev.filter(row=>!succeeded.includes(row.id)));setSelectedDrafts(new Set(failed));setShowBatchConfirmDialog(false);
      if(failed.length)requireRefresh('已確認保存 '+succeeded.length+' 筆，另有 '+failed.length+' 筆未確認保存；項目仍保留於清單。');
      else{setSuccessMessage(t('drafts.batch_confirm_success',{count:succeeded.length}));setShowSuccessToast(true);}
    }catch(error){if(isCurrent())requireRefresh(getErrorMessage(error));}
    finally{if(currentContext.current===captured){busy.current=false;setIsProcessing(false);}}
  };

  const openConfirmDialog = (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) return;
    if(isProtectedManualDraft(draft)){navigate('/admin/documents/'+draft.uploaded_document_id+'/transcribe?'+new URLSearchParams({organization_id:draft.organization_id,projectId:draft.project_id}));return;}
    setActiveDraftId(draftId);
    setEditScope(draft.suggested_scope?.toString() || '');
    setEditCategory(draft.suggested_category || '');
    setEditNote('');
    setShowConfirmDialog(true);
  };

  const openRejectDialog = (draftId: string) => {
    const row=drafts.find(d=>d.id===draftId);if(row&&isProtectedManualDraft(row)){navigate('/admin/documents/'+row.uploaded_document_id+'/transcribe?'+new URLSearchParams({organization_id:row.organization_id,projectId:row.project_id}));return;}
    setActiveDraftId(draftId);
    setEditNote('');
    setShowRejectDialog(true);
  };

  const toggleSelectAll = () => {
    if (selectedDrafts.size === confirmableDrafts.length) {
      setSelectedDrafts(new Set());
    } else {
      setSelectedDrafts(new Set(confirmableDrafts.map(d => d.id)));
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

  const toggleExplanation = (draftId: string) => {
    setExpandedExplanationDrafts(prev => {
      const next = new Set(prev);
      if (next.has(draftId)) {
        next.delete(draftId);
      } else {
        next.add(draftId);
      }
      return next;
    });
  };

  if (authLoading || loadedContext!==context || isLoading) {
    return (
      <AdminLayout>
        <LoadingState message={t('drafts.loading_message')} />
      </AdminLayout>
    );
  }

  if(!currentSession(session))return <AdminLayout><ErrorState message="工作階段已失效，請重新登入。" /></AdminLayout>;

  if (error) {
    return (
      <AdminLayout>
        <ErrorState message={error} onRetry={loadDrafts} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {subscription.isReadonly && (
        <ReadonlyBanner
          onRenew={() => navigate('/admin/subscription')}
          onContact={() => window.open('mailto:support@cocallab.com', '_blank')}
        />
      )}

      {needsRefresh&&<p role="alert" className="mb-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm">上次操作結果未確認；請重新讀取草稿，確認伺服器狀態後再提交。</p>}
      {(!organizationId||subscription.loading||subscription.error)&&<p role="status" className="mb-4 rounded border border-amber-200 bg-amber-50 p-4 text-sm">
        {!organizationId?'請從目前組織／專案帶入 organization_id 後進行審核；此清單目前唯讀。':subscription.error?'無法確認訂閱寫入狀態；請稍後重試。':'正在確認組織訂閱狀態，暫停審核操作。'}
      </p>}
      <button type="button" onClick={()=>void loadDrafts()} disabled={isProcessing} className="mb-4 text-sm underline disabled:opacity-50">重新讀取草稿</button>
      {/* 成功 Toast */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <i className="ri-check-line text-xl text-green-600"></i>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">{successMessage}</p>
            <button
              onClick={() => navigate(scopedHref('/admin/activities'))}
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
            onClick={() => navigate(scopedHref('/admin/documents/upload'))}
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
          onAction={() => navigate(scopedHref('/admin/documents/upload'))}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex items-center">
            <input
              type="checkbox"
              checked={selectedDrafts.size === confirmableDrafts.length && confirmableDrafts.length > 0}
              onChange={toggleSelectAll}
              disabled={isReadonly || isProcessing || !confirmableDrafts.length}
              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500 cursor-pointer"
            />
            <span className="ml-3 text-sm font-medium text-gray-700">
              {selectedDrafts.size === confirmableDrafts.length && confirmableDrafts.length > 0
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
                    disabled={isReadonly || isProcessing || isSyntheticDraft(draft) || isProtectedManualDraft(draft)}
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
                          {draftReviewValues(draft).activityDate}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          {t('drafts.quantity')}
                        </label>
                        <p className="text-sm text-gray-900">
                          {draftReviewValues(draft).quantity} {draftReviewValues(draft).unit}
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
                    <p className="mb-2 text-xs text-gray-500">擷取來源：{draft.extraction_provider || '未提供（未證實為真實 OCR）'}</p>
                    {isProtectedManualDraft(draft)&&<button type="button" onClick={()=>openConfirmDialog(draft.id)} className="mb-3 text-sm text-teal-800 underline">人工轉錄來源（非OCR）：開啟唯讀轉錄與確認</button>}
                    {isSyntheticDraft(draft)&&<p className="mb-3 text-sm text-amber-700">Mock／合成測試草稿，不能確認為正式活動；可駁回。</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => openConfirmDialog(draft.id)}
                        disabled={isReadonly || isProcessing || isSyntheticDraft(draft)}
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
                      <button
                        onClick={() => toggleExplanation(draft.id)}
                        className={`px-3 py-1.5 text-sm font-medium border rounded-lg whitespace-nowrap cursor-pointer ${
                          expandedExplanationDrafts.has(draft.id)
                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700'
                        }`}
                      >
                        <i className="ri-robot-line mr-1"></i>
                        {t('aiExplanation.toggle')}
                      </button>
                    </div>
                    {expandedExplanationDrafts.has(draft.id) && (
                      <div className="mt-3">
                        <DraftAIExplanationPanel
                          draft={draft}
                          onClose={() => toggleExplanation(draft.id)}
                        />
                      </div>
                    )}
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
          open
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
          open
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
          open
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
