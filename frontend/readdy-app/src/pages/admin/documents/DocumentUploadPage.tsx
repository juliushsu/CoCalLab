import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';

// ─── Manual Entry Modal (placeholder until Codex write RPC) ──────────────────
interface ManualEntryModalProps {
  onClose: () => void;
  onNavigate: () => void;
}
function ManualEntryModal({ onClose, onNavigate }: ManualEntryModalProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 flex items-center justify-center bg-teal-100 rounded-full flex-shrink-0">
            <i className="ri-edit-line text-teal-600 text-xl"></i>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">{t('documents.uploadMethods.manual')}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t('documents.manualEntryHint')}</p>
          </div>
        </div>
        <div className="space-y-3 mb-5">
          <button
            onClick={onNavigate}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 transition-colors cursor-pointer text-left"
          >
            <div className="w-9 h-9 flex items-center justify-center bg-teal-100 rounded-lg flex-shrink-0">
              <i className="ri-add-circle-line text-teal-600 text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-semibold text-teal-800">{t('activities.create_button')}</p>
              <p className="text-xs text-teal-600">{t('activities.create.modalDesc')}</p>
            </div>
            <i className="ri-arrow-right-line text-teal-400 ml-auto flex-shrink-0"></i>
          </button>
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <i className="ri-information-line text-amber-500 text-sm flex-shrink-0"></i>
            <p className="text-xs text-amber-700">{t('documents.uploadMethods.excelBadge')} — {t('documents.uploadMethods.excelDesc')}</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
import ReadonlyBanner from '../../../components/feature/ReadonlyBanner';
import { IS_STAGING } from '../../../utils/staging';
import { useSubscriptionStatus } from '../../../hooks/useSubscriptionStatus';
import { getProjects } from '../../../services/projectService';
import { uploadDocument, checkDuplicateDocument } from '../../../services/documentService';
import { getCurrentUserOrganizationId } from '../../../services/organizationService';
import { EdgeFunctionService } from '../../../services/edgeFunction';
import type { Project } from '../../../types/project';
import type { DocumentType } from '../../../types/document';

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'classifying' | 'completed' | 'failed';
  currentStep?: string;
  error?: string;
  documentId?: string;
}

// 重複檔案確認對話框
interface DuplicateWarningDialogProps {
  filename: string;
  existingFilename: string;
  existingDate: string;
  onContinue: () => void;
  onCancel: () => void;
}

function DuplicateWarningDialog({
  filename,
  existingFilename,
  existingDate,
  onContinue,
  onCancel,
}: DuplicateWarningDialogProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 flex items-center justify-center bg-yellow-100 rounded-full flex-shrink-0">
            <i className="ri-alert-line text-yellow-600 text-xl"></i>
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            {t('documents.duplicate_warning_title', '偵測到重複檔案')}
          </h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {t('documents.duplicate_warning_desc', '您正在上傳的檔案與此專案中已存在的檔案內容相同：')}
        </p>
        <div className="bg-gray-50 rounded-lg p-3 mb-5 text-sm space-y-1">
          <div className="flex gap-2">
            <span className="text-gray-500 w-20 flex-shrink-0">{t('documents.fields.fileName', '檔案名稱')}：</span>
            <span className="text-gray-900 font-medium truncate">{existingFilename}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-20 flex-shrink-0">{t('documents.fields.uploadedAt', '上傳時間')}：</span>
            <span className="text-gray-900">{existingDate}</span>
          </div>
          <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
            <span className="text-gray-500 w-20 flex-shrink-0">{t('documents.duplicate_new_file', '新檔案')}：</span>
            <span className="text-gray-700 truncate">{filename}</span>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          {t('documents.duplicate_confirm_question', '是否仍要繼續上傳？')}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            {t('common.cancel', '取消')}
          </button>
          <button
            onClick={onContinue}
            className="px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 transition-colors whitespace-nowrap cursor-pointer"
          >
            {t('documents.duplicate_continue', '仍要上傳')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DocumentUploadPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedProject, setSelectedProject] = useState<string>(
    searchParams.get('project_id') || ''
  );
  const [documentType, setDocumentType] = useState<DocumentType>('receipt');
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // 重複檔案確認狀態
  const [duplicateDialog, setDuplicateDialog] = useState<{
    uploadFileId: string;
    filename: string;
    existingFilename: string;
    existingDate: string;
    resolve: (proceed: boolean) => void;
  } | null>(null);

  const [resolvedOrgId, setResolvedOrgId] = useState<string | null>(
    searchParams.get('organization_id') || null
  );

  const { isReadonly } = useSubscriptionStatus(resolvedOrgId || undefined);

  useEffect(() => {
    async function init() {
      try {
        setIsLoadingProjects(true);
        const [data, orgId] = await Promise.all([
          getProjects(),
          resolvedOrgId ? Promise.resolve(resolvedOrgId) : getCurrentUserOrganizationId(),
        ]);
        setProjects(data);
        if (!resolvedOrgId && orgId) {
          setResolvedOrgId(orgId);
        }
      } catch (error) {
        console.error('Failed to init upload page:', error);
      } finally {
        setIsLoadingProjects(false);
      }
    }
    init();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, []);

  // 三種上傳入口的 ref
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    // reset value so same file can be re-selected
    e.target.value = '';
  }, []);

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      const maxSize = 10 * 1024 * 1024;
      if (!validTypes.includes(file.type)) {
        alert(`${file.name}: ${t('errors.invalidFile')}`);
        return false;
      }
      if (file.size > maxSize) {
        alert(`${file.name}: ${t('errors.fileTooLarge')}`);
        return false;
      }
      return true;
    });

    setUploadFiles(prev => [
      ...prev,
      ...validFiles.map(file => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
        status: 'pending' as const,
      })),
    ]);
  };

  const removeFile = (id: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== id));
  };

  /**
   * 顯示重複檔案確認對話框，回傳使用者是否繼續上傳
   */
  const confirmDuplicate = (
    uploadFileId: string,
    filename: string,
    existingFilename: string,
    existingDate: string
  ): Promise<boolean> => {
    return new Promise(resolve => {
      setDuplicateDialog({ uploadFileId, filename, existingFilename, existingDate, resolve });
    });
  };

  const getErrorMessage = (error: any): string => {
    if (!error) return t('errors.uploadFailed');
    const errorMsg = error.message || String(error);
    if (errorMsg.includes('JWT') || errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
      return t('errors.authFailed');
    }
    if (errorMsg.includes('permission') || errorMsg.includes('forbidden') || errorMsg.includes('403')) {
      return t('errors.permissionDenied');
    }
    if (errorMsg.includes('payload') || errorMsg.includes('invalid') || errorMsg.includes('400')) {
      return t('errors.invalidPayload');
    }
    if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('timeout')) {
      return t('errors.networkError');
    }
    return errorMsg;
  };

  const handleUpload = async () => {
    if (isReadonly) {
      alert(t('subscription.readonlyBanner.message'));
      return;
    }
    if (!selectedProject) {
      alert(t('documents.selectProject'));
      return;
    }
    if (uploadFiles.length === 0) return;
    if (!resolvedOrgId) {
      alert(t('documents.orgNotFound'));
      return;
    }

    setIsUploading(true);

    for (const uploadFile of uploadFiles) {
      if (uploadFile.status !== 'pending') continue;
      try {
        // Step 0: 計算 SHA-256 並檢查重複
        const arrayBuffer = await uploadFile.file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const sha256Hash = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        const duplicate = await checkDuplicateDocument(sha256Hash, selectedProject);
        if (duplicate) {
          const proceed = await confirmDuplicate(
            uploadFile.id,
            uploadFile.file.name,
            duplicate.original_filename,
            new Date(duplicate.created_at).toLocaleString('zh-TW')
          );
          if (!proceed) {
            // 使用者選擇取消，跳過此檔案
            setUploadFiles(prev => prev.filter(f => f.id !== uploadFile.id));
            continue;
          }
        }

        // Step 1: 上傳到 Storage + 建立 DB 記錄
        setUploadFiles(prev =>
          prev.map(f =>
            f.id === uploadFile.id
              ? { ...f, status: 'uploading', progress: 20, currentStep: t('documents.steps.uploading') }
              : f
          )
        );

        const { documentId } = await uploadDocument(
          uploadFile.file,
          selectedProject,
          resolvedOrgId,
          documentType
        );

        setUploadFiles(prev =>
          prev.map(f => (f.id === uploadFile.id ? { ...f, progress: 40, documentId } : f))
        );

        // Step 2: process-document (OCR)
        setUploadFiles(prev =>
          prev.map(f =>
            f.id === uploadFile.id
              ? { ...f, status: 'processing', progress: 50, currentStep: t('documents.steps.processing') }
              : f
          )
        );

        const processResult = await EdgeFunctionService.invoke({
          functionName: 'process-document',
          payload: { document_id: documentId, project_id: selectedProject },
        });

        if (!processResult.success) {
          throw new Error(processResult.error?.message || 'process-document 失敗');
        }

        setUploadFiles(prev =>
          prev.map(f => (f.id === uploadFile.id ? { ...f, progress: 70 } : f))
        );

        // Step 3: classify-document
        setUploadFiles(prev =>
          prev.map(f =>
            f.id === uploadFile.id
              ? { ...f, status: 'classifying', progress: 80, currentStep: t('documents.steps.classifying') }
              : f
          )
        );

        const classifyResult = await EdgeFunctionService.invoke({
          functionName: 'classify-document',
          payload: { document_id: documentId },
        });

        if (!classifyResult.success) {
          throw new Error(classifyResult.error?.message || 'classify-document 失敗');
        }

        setUploadFiles(prev =>
          prev.map(f =>
            f.id === uploadFile.id
              ? { ...f, status: 'completed', progress: 100, currentStep: t('documents.steps.completed') }
              : f
          )
        );
      } catch (error) {
        console.error('Upload failed:', error);
        setUploadFiles(prev =>
          prev.map(f =>
            f.id === uploadFile.id
              ? {
                  ...f,
                  status: 'failed',
                  error: getErrorMessage(error),
                  currentStep: t('documents.steps.failed'),
                }
              : f
          )
        );
      }
    }

    setIsUploading(false);

    const hasSuccess = uploadFiles.some(f => f.status === 'completed');
    if (hasSuccess) {
      setShowSuccessDialog(true);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusColor = (s: UploadFile['status']) => {
    const map: Record<UploadFile['status'], string> = {
      pending: 'text-gray-500',
      uploading: 'text-teal-600',
      processing: 'text-yellow-600',
      classifying: 'text-orange-500',
      completed: 'text-green-600',
      failed: 'text-red-600',
    };
    return map[s];
  };

  const getStatusIcon = (s: UploadFile['status']) => {
    const map: Record<UploadFile['status'], string> = {
      pending: 'ri-time-line',
      uploading: 'ri-upload-line',
      processing: 'ri-file-search-line',
      classifying: 'ri-ai-generate',
      completed: 'ri-check-line',
      failed: 'ri-error-warning-line',
    };
    return map[s];
  };

  const completedCount = uploadFiles.filter(f => f.status === 'completed').length;
  const failedCount = uploadFiles.filter(f => f.status === 'failed').length;

  return (
    <AdminLayout>
      {/* 手動輸入 Modal */}
      {showManualModal && (
        <ManualEntryModal
          onClose={() => setShowManualModal(false)}
          onNavigate={() => {
            setShowManualModal(false);
            // Navigate to activities page with ?create=true to auto-open the create modal
            const params = new URLSearchParams();
            params.set('create', 'true');
            if (selectedProject) params.set('projectId', selectedProject);
            navigate(`/admin/activities?${params.toString()}`);
          }}
        />
      )}

      {/* 重複檔案確認對話框 */}
      {duplicateDialog && (
        <DuplicateWarningDialog
          filename={duplicateDialog.filename}
          existingFilename={duplicateDialog.existingFilename}
          existingDate={duplicateDialog.existingDate}
          onContinue={() => {
            duplicateDialog.resolve(true);
            setDuplicateDialog(null);
          }}
          onCancel={() => {
            duplicateDialog.resolve(false);
            setDuplicateDialog(null);
          }}
        />
      )}

      {isReadonly && (
        <ReadonlyBanner
          onRenew={() => navigate('/admin/subscription')}
          onContact={() => window.open('mailto:support@cacalab.com', '_blank')}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {t('documents.uploadPage')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t('documents.uploadWarning')}</p>
        </div>
        <button
          onClick={() => navigate('/admin/documents/list')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 whitespace-nowrap cursor-pointer"
        >
          {t('documents.list')}
        </button>
      </div>

      {!resolvedOrgId && !isLoadingProjects && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            <i className="ri-error-warning-line mr-2"></i>
            {t('documents.orgNotFound')}
          </p>
        </div>
      )}

      {!isUploading && (completedCount > 0 || failedCount > 0) && (
        <div className={`mb-4 p-3 rounded-lg border ${failedCount > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <p className={`text-sm font-medium ${failedCount > 0 ? 'text-yellow-800' : 'text-green-800'}`}>
            <i className={`mr-2 ${failedCount > 0 ? 'ri-alert-line' : 'ri-check-line'}`}></i>
            {t('documents.uploadSummary', { success: completedCount, failed: failedCount })}
          </p>
          {completedCount > 0 && failedCount === 0 && (
            <button
              onClick={() => navigate('/admin/documents/list')}
              className="mt-2 text-sm text-green-700 underline cursor-pointer"
            >
              {t('documents.viewList')}
            </button>
          )}
        </div>
      )}

      {/* 專案與文件類型選擇 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('documents.fields.project')}{' '}
              <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              disabled={isLoadingProjects || isUploading || isReadonly}
            >
              <option value="">{t('documents.selectProject')}</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.project_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('documents.fields.documentType')}
            </label>
            <select
              value={documentType}
              onChange={e => setDocumentType(e.target.value as DocumentType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              disabled={isUploading || isReadonly}
            >
              <option value="receipt">{t('documents.types.receipt')}</option>
              <option value="invoice">{t('documents.types.invoice')}</option>
              <option value="bill">{t('documents.types.bill')}</option>
              <option value="contract">{t('documents.types.contract')}</option>
              <option value="report">{t('documents.types.report')}</option>
              <option value="other">{t('documents.types.other')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 上傳區域 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        {/* Staging Upload Warning */}
        {IS_STAGING && (
          <div className="mb-4 flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-test-tube-line text-amber-600 text-base"></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
                {t('staging.upload_env_label', 'STAGING ENVIRONMENT')}
              </p>
              <p className="text-xs text-amber-700 mb-1">
                {t(
                  'staging.upload_warning',
                  '此為測試環境，上傳資料將存入 staging bucket，不進入正式系統。'
                )}
              </p>
              <p className="text-xs text-amber-600 font-mono">
                {t('staging.upload_bucket_label', 'Bucket')}:{' '}
                <span className="font-bold">
                  {documentType === 'receipt' ? 'staging-receipts' : 'staging-attachments'}
                </span>
                {'　'}
                {t('staging.upload_path_label', 'Path')}:{' '}
                <span className="font-bold">staging/{'{projectId}'}/TEST_&lt;timestamp&gt;_&lt;filename&gt;</span>
              </p>
            </div>
          </div>
        )}

        {/* ── 拍照收據提示 Banner ── */}
        <div className="mb-5 flex items-start gap-3 p-4 bg-teal-50 border border-teal-200 rounded-lg">
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
            <i className="ri-camera-line text-teal-600 text-xl"></i>
          </div>
          <div>
            <p className="text-sm font-semibold text-teal-800 mb-1">
              {t('documents.receiptTips.title', '拍照收據小提示')}
            </p>
            <ul className="space-y-0.5">
              <li className="text-xs text-teal-700 flex items-center gap-1.5">
                <i className="ri-checkbox-circle-line text-teal-500 flex-shrink-0"></i>
                {t('documents.receiptTips.center', '請將收據置於畫面中央，避免陰影與模糊')}
              </li>
              <li className="text-xs text-teal-700 flex items-center gap-1.5">
                <i className="ri-checkbox-circle-line text-teal-500 flex-shrink-0"></i>
                {t('documents.receiptTips.multiple', '支援多張拍照，每張將獨立送出 OCR 辨識')}
              </li>
              <li className="text-xs text-teal-700 flex items-center gap-1.5">
                <i className="ri-checkbox-circle-line text-teal-500 flex-shrink-0"></i>
                {t('documents.receiptTips.formats', '支援 JPG、PNG、PDF 格式，單檔上限 10 MB')}
              </li>
            </ul>
          </div>
        </div>

        {/* ── Section 1: 快速建立 / 上傳 ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-teal-500 rounded-full"></div>
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {t('documents.sectionQuickCreate')}
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 拍照上傳 */}
            <label
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                isReadonly || isUploading
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                  : 'border-teal-300 bg-teal-50 hover:border-teal-500 hover:bg-teal-100 cursor-pointer'
              }`}
            >
              <div className="w-9 h-9 flex items-center justify-center">
                <i className={`ri-camera-line text-2xl ${isReadonly || isUploading ? 'text-gray-400' : 'text-teal-600'}`}></i>
              </div>
              <span className={`text-sm font-semibold whitespace-nowrap ${isReadonly || isUploading ? 'text-gray-400' : 'text-teal-700'}`}>
                {t('documents.uploadMethods.camera')}
              </span>
              <span className={`text-xs text-center leading-tight ${isReadonly || isUploading ? 'text-gray-400' : 'text-teal-600'}`}>
                {t('documents.uploadMethods.cameraDesc')}
              </span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full whitespace-nowrap ${isReadonly || isUploading ? 'bg-gray-200 text-gray-400' : 'bg-teal-600 text-white'}`}>
                {t('documents.uploadMethods.recommended')}
              </span>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handleFileSelect} className="hidden" disabled={isUploading || isReadonly} />
            </label>

            {/* 從相簿選擇 */}
            <label
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                isReadonly || isUploading
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 cursor-pointer'
              }`}
            >
              <div className="w-9 h-9 flex items-center justify-center">
                <i className={`ri-image-line text-2xl ${isReadonly || isUploading ? 'text-gray-400' : 'text-gray-600'}`}></i>
              </div>
              <span className={`text-sm font-semibold whitespace-nowrap ${isReadonly || isUploading ? 'text-gray-400' : 'text-gray-700'}`}>
                {t('documents.uploadMethods.gallery')}
              </span>
              <span className={`text-xs text-center leading-tight ${isReadonly || isUploading ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('documents.uploadMethods.galleryDesc')}
              </span>
              <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" disabled={isUploading || isReadonly} />
            </label>

            {/* 上傳 PDF */}
            <label
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                isReadonly || isUploading
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 cursor-pointer'
              }`}
            >
              <div className="w-9 h-9 flex items-center justify-center">
                <i className={`ri-file-pdf-line text-2xl ${isReadonly || isUploading ? 'text-gray-400' : 'text-gray-600'}`}></i>
              </div>
              <span className={`text-sm font-semibold whitespace-nowrap ${isReadonly || isUploading ? 'text-gray-400' : 'text-gray-700'}`}>
                {t('documents.uploadMethods.pdf')}
              </span>
              <span className={`text-xs text-center leading-tight ${isReadonly || isUploading ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('documents.uploadMethods.pdfDesc')}
              </span>
              <input ref={pdfInputRef} type="file" accept=".pdf" multiple onChange={handleFileSelect} className="hidden" disabled={isUploading || isReadonly} />
            </label>

            {/* 手動輸入 */}
            <button
              type="button"
              onClick={() => !isReadonly && setShowManualModal(true)}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                isReadonly
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                  : 'border-emerald-300 bg-emerald-50 hover:border-emerald-500 hover:bg-emerald-100 cursor-pointer'
              }`}
            >
              <div className="w-9 h-9 flex items-center justify-center">
                <i className={`ri-edit-line text-2xl ${isReadonly ? 'text-gray-400' : 'text-emerald-600'}`}></i>
              </div>
              <span className={`text-sm font-semibold whitespace-nowrap ${isReadonly ? 'text-gray-400' : 'text-emerald-700'}`}>
                {t('documents.uploadMethods.manual')}
              </span>
              <span className={`text-xs text-center leading-tight ${isReadonly ? 'text-gray-400' : 'text-emerald-600'}`}>
                {t('documents.uploadMethods.manualDesc')}
              </span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full whitespace-nowrap ${isReadonly ? 'bg-gray-200 text-gray-400' : 'bg-emerald-100 text-emerald-700 border border-emerald-300'}`}>
                {t('documents.uploadMethods.manualBadge')}
              </span>
            </button>
          </div>

          {/* Manual entry hint */}
          <p className="mt-2 text-xs text-gray-400 flex items-center gap-1.5">
            <i className="ri-lightbulb-line text-amber-400"></i>
            {t('documents.manualEntryHint')}
          </p>
        </div>

        {/* ── Section 2: 批次匯入 ── */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-gray-400 rounded-full"></div>
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {t('documents.sectionBatchImport')}
            </span>
          </div>

          {/* 拖曳區 */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="text-xs text-gray-400 whitespace-nowrap">{t('documents.uploadArea.orDragDrop')}</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors mb-3 ${
              isDragging
                ? 'border-teal-500 bg-teal-50'
                : isReadonly
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                : 'border-gray-300 bg-gray-50 hover:border-teal-400'
            }`}
          >
            <i className={`ri-upload-cloud-2-line text-3xl mb-2 ${isReadonly ? 'text-gray-300' : 'text-gray-400'}`}></i>
            <h3 className={`text-sm font-medium mb-1 ${isReadonly ? 'text-gray-400' : 'text-gray-900'}`}>
              {isDragging ? t('documents.uploadArea.dragActive') : t('documents.uploadArea.title')}
            </h3>
            <p className={`text-xs mb-3 ${isReadonly ? 'text-gray-400' : 'text-gray-500'}`}>
              {isReadonly ? t('subscription.readonlyBanner.message') : t('documents.uploadArea.subtitle')}
            </p>
            <label
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
                isReadonly
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-teal-600 text-white hover:bg-teal-700 cursor-pointer'
              }`}
            >
              <i className="ri-folder-open-line mr-2"></i>
              {t('documents.uploadArea.selectFiles')}
              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} className="hidden" disabled={isUploading || isReadonly} />
            </label>
          </div>

          {/* Excel / CSV 匯入卡片 */}
          <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
            <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg flex-shrink-0">
              <i className="ri-file-excel-2-line text-xl text-gray-400"></i>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-500">{t('documents.uploadMethods.excel')}</span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-200 text-gray-500 whitespace-nowrap">
                  {t('documents.uploadMethods.excelBadge')}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{t('documents.uploadMethods.excelDesc')}</p>
            </div>
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-200 rounded-lg cursor-not-allowed whitespace-nowrap flex-shrink-0"
            >
              <i className="ri-download-line"></i>
              {t('documents.uploadMethods.template')}
            </button>
          </div>
        </div>
      </div>

      {/* 檔案列表 */}
      {uploadFiles.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {t('documents.list')} ({uploadFiles.length})
          </h3>
          <div className="space-y-3">
            {uploadFiles.map(uploadFile => (
              <div
                key={uploadFile.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center flex-1 min-w-0">
                  <i className={`${getStatusIcon(uploadFile.status)} text-2xl ${getStatusColor(uploadFile.status)} mr-3`}></i>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {uploadFile.file.name}
                      </p>
                      {/* STAGING FILE badge — 僅封測環境顯示 */}
                      {IS_STAGING && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold tracking-widest rounded uppercase border border-amber-200 whitespace-nowrap flex-shrink-0">
                          {t('staging.staging_file_badge', 'STAGING FILE')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center mt-1 space-x-4">
                      <span className="text-xs text-gray-500">
                        {formatFileSize(uploadFile.file.size)}
                      </span>
                      {uploadFile.currentStep && (
                        <span className={`text-xs font-medium ${getStatusColor(uploadFile.status)}`}>
                          {uploadFile.currentStep}
                        </span>
                      )}
                      {uploadFile.error && (
                        <span className="text-xs text-red-600">{uploadFile.error}</span>
                      )}
                    </div>
                    {(uploadFile.status === 'uploading' ||
                      uploadFile.status === 'processing' ||
                      uploadFile.status === 'classifying') && (
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="bg-teal-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadFile.progress}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                </div>
                {uploadFile.status === 'pending' && (
                  <button
                    onClick={() => removeFile(uploadFile.id)}
                    className="ml-4 p-2 text-gray-400 hover:text-red-600 cursor-pointer"
                    disabled={isUploading}
                  >
                    <i className="ri-close-line text-xl"></i>
                  </button>
                )}
                {uploadFile.status === 'completed' && (
                  <i className="ri-check-line text-xl text-green-600 ml-4"></i>
                )}
                {uploadFile.status === 'failed' && (
                  <i className="ri-error-warning-line text-xl text-red-600 ml-4"></i>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setUploadFiles([])}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              disabled={isUploading}
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleUpload}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center gap-2"
              disabled={
                isUploading ||
                isReadonly ||
                !selectedProject ||
                !resolvedOrgId ||
                uploadFiles.filter(f => f.status === 'pending').length === 0
              }
            >
              {isUploading && <i className="ri-loader-4-line animate-spin"></i>}
              <i className="ri-upload-line"></i>
              {isUploading ? t('documents.uploadProgress.uploading') : t('common.upload')}
            </button>
          </div>
        </div>
      )}

      {/* 成功對話框 */}
      {showSuccessDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <i className="ri-check-line text-2xl text-green-600"></i>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('documents.uploadSuccess')}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {t('documents.uploadSuccessMessage', { count: completedCount })}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSuccessDialog(false)}
                className="px-4 py-2 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                {t('common.close')}
              </button>
              <button
                onClick={() => navigate('/admin/documents/drafts')}
                className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-file-list-3-line mr-2"></i>
                {t('documents.goToDrafts')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
