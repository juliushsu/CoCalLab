import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import EmptyState from '../../../components/base/EmptyState';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import ConfirmDialog from '../../../components/base/ConfirmDialog';
import StatusBadge from '../../../components/base/StatusBadge';
import ReadonlyBanner from '../../../components/feature/ReadonlyBanner';
import { useSubscriptionStatus } from '../../../hooks/useSubscriptionStatus';
import { getUploadedDocuments, deleteDocument } from '../../../services/documentService';
import { getProjects } from '../../../services/projectService';
import type { UploadedDocument, OcrStatus, DocumentType } from '../../../types/document';
import type { Project } from '../../../types/project';

type ToastType = 'success' | 'error';

interface Toast {
  type: ToastType;
  message: string;
}

export default function UploadedDocumentListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const organizationId = searchParams.get('organization_id') || undefined;
  const projectIdParam = searchParams.get('projectId') || undefined;

  const { isReadonly } = useSubscriptionStatus(organizationId);

  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>(projectIdParam || '');
  const [selectedStatus, setSelectedStatus] = useState<OcrStatus | ''>('');
  const [selectedType, setSelectedType] = useState<DocumentType | ''>('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<UploadedDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    if (projectIdParam) {
      setSelectedProject(projectIdParam);
    }
  }, [projectIdParam]);

  useEffect(() => {
    loadData();
  }, [projectIdParam]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [documentsData, projectsData] = await Promise.all([
        getUploadedDocuments(projectIdParam),
        getProjects(),
      ]);
      setDocuments(documentsData);
      setProjects(projectsData);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setError(t('errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;

    if (isReadonly) {
      showToast('error', t('subscription.readonlyBanner.message'));
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
      return;
    }

    try {
      setIsDeleting(true);
      await deleteDocument(documentToDelete.id);
      setDocuments(prev => prev.filter(d => d.id !== documentToDelete.id));
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
      showToast('success', t('documents.deleteSuccess'));
    } catch (err) {
      console.error('Failed to delete document:', err);
      showToast('error', t('errors.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    if (searchQuery && !doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedProject && doc.project_id !== selectedProject) {
      return false;
    }
    if (selectedStatus && doc.ocr_status !== selectedStatus) {
      return false;
    }
    if (selectedType && doc.document_type !== selectedType) {
      return false;
    }
    return true;
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: OcrStatus): string => {
    switch (status) {
      case 'pending': return 'gray';
      case 'processing': return 'blue';
      case 'succeeded': return 'green';
      case 'failed': return 'red';
      default: return 'gray';
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
      {isReadonly && (
        <ReadonlyBanner
          onRenew={() => navigate('/admin/subscription')}
          onContact={() => window.open('mailto:support@cocallab.com', '_blank')}
        />
      )}

      {/* Toast 通知 */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg p-4 shadow-lg flex items-center gap-3 border ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              toast.type === 'success' ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            <i
              className={`text-xl ${
                toast.type === 'success'
                  ? 'ri-check-line text-green-600'
                  : 'ri-error-warning-line text-red-600'
              }`}
            ></i>
          </div>
          <p
            className={`text-sm font-medium flex-1 ${
              toast.type === 'success' ? 'text-green-900' : 'text-red-900'
            }`}
          >
            {toast.message}
          </p>
          <button
            onClick={() => setToast(null)}
            className={`cursor-pointer ${
              toast.type === 'success'
                ? 'text-green-600 hover:text-green-800'
                : 'text-red-600 hover:text-red-800'
            }`}
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('documents.listPage')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('documents.listDescription')}
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/documents/upload')}
          className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 whitespace-nowrap cursor-pointer"
        >
          <i className="ri-upload-line mr-2"></i>
          {t('documents.upload')}
        </button>
      </div>

      {/* 搜尋與篩選 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <input
              type="text"
              placeholder={t('documents.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            >
              <option value="">{t('documents.filterByProject')}</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as OcrStatus | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            >
              <option value="">{t('documents.filterByStatus')}</option>
              <option value="pending">{t('documents.processingStatus.pending')}</option>
              <option value="processing">{t('documents.processingStatus.processing')}</option>
              <option value="succeeded">{t('documents.processingStatus.completed')}</option>
              <option value="failed">{t('documents.processingStatus.failed')}</option>
            </select>
          </div>
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as DocumentType | '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            >
              <option value="">{t('documents.filterByType')}</option>
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

      {/* 文件列表 */}
      {filteredDocuments.length === 0 ? (
        <EmptyState
          icon="ri-file-text-line"
          title={t('documents.emptyTitle')}
          description={t('documents.emptyDescription')}
          actionLabel={t('documents.uploadButton')}
          onAction={() => navigate('/admin/documents/upload')}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('documents.fields.fileName')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('documents.fields.project')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('documents.fields.documentType')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('documents.fields.fileSize')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('documents.fields.processingStatus')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('documents.fields.uploadedAt')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <i className="ri-file-text-line text-xl text-gray-400 mr-3"></i>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{doc.original_filename}</div>
                          <div className="text-xs text-gray-500">{doc.mime_type || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{doc.project_name || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {t(`documents.types.${doc.document_type}`)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatFileSize(doc.file_size_bytes)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge
                        status={doc.ocr_status}
                        label={t(`documents.processingStatus.${doc.ocr_status}`)}
                        color={getStatusColor(doc.ocr_status)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatDate(doc.created_at)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {doc.file_url && (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="text-teal-600 hover:text-teal-900 cursor-pointer"
                            title={t('common.view')}
                          >
                            <i className="ri-eye-line text-lg"></i>
                          </a>
                        )}
                        {doc.ocr_status === 'succeeded' && (
                          <button
                            onClick={() => navigate(`/admin/documents/drafts?document=${doc.id}`)}
                            className="text-teal-600 hover:text-teal-900 cursor-pointer"
                            title={t('documents.draftReview')}
                          >
                            <i className="ri-file-list-3-line text-lg"></i>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setDocumentToDelete(doc);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={isReadonly}
                          className="text-red-600 hover:text-red-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title={t('common.delete')}
                        >
                          <i className="ri-delete-bin-line text-lg"></i>
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

      {/* 刪除確認對話框 */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        title={t('documents.deleteConfirmTitle')}
        message={t('documents.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setDocumentToDelete(null);
        }}
        isProcessing={isDeleting}
        type="danger"
      />
    </AdminLayout>
  );
}
