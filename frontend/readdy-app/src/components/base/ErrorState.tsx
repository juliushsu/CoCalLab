import { useTranslation } from 'react-i18next';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="w-16 h-16 flex items-center justify-center bg-red-50 rounded-full mb-4">
        <i className="ri-error-warning-line text-3xl text-red-600"></i>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {title || t('common.errors.load_failed')}
      </h3>
      {message && (
        <p className="text-sm text-gray-600 text-center max-w-md mb-6">{message}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
        >
          {t('common.actions.retry')}
        </button>
      )}
    </div>
  );
}

export default ErrorState;