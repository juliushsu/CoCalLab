import { ReactNode, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  // 支援兩種 open/isOpen 寫法
  open?: boolean;
  isOpen?: boolean;
  // 支援多種關閉回呼寫法
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  // 支援多種確認文字寫法
  confirmText?: string;
  confirmLabel?: string;
  // 支援多種取消文字寫法
  cancelText?: string;
  cancelLabel?: string;
  confirmButtonClass?: string;
  isLoading?: boolean;
  loading?: boolean;
  isProcessing?: boolean;
  isDanger?: boolean;
  // 支援 variant 與 type 兩種危險樣式寫法
  variant?: 'primary' | 'danger';
  type?: 'danger' | 'default';
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  confirmButtonClass,
  isLoading = false,
  loading = false,
  isProcessing: processing = false,
  isDanger: danger = false,
  variant = 'primary',
  type,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  const isVisible = open ?? isOpen ?? false;
  const isProcessing = isLoading || loading || processing;
  const handleClose = useMemo(() => onClose ?? onCancel ?? (() => {}), [onClose, onCancel]);
  const confirmBtnText = confirmText ?? confirmLabel ?? t('common.confirm');
  const cancelBtnText = cancelText ?? cancelLabel ?? t('common.cancel');

  const isDanger = danger || variant === 'danger' || type === 'danger';
  const defaultConfirmClass = isDanger
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-teal-600 hover:bg-teal-700';
  const finalConfirmClass = confirmButtonClass ?? defaultConfirmClass;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible && !isProcessing) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible, isProcessing, handleClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={!isProcessing ? handleClose : undefined}
      />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        {children && <div className="mb-4">{children}</div>}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {cancelBtnText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2 ${finalConfirmClass}`}
          >
            {isProcessing && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {confirmBtnText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
