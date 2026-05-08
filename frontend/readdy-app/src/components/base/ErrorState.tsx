import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  action?: ReactNode | { label: string; onClick: () => void };
}

export function ErrorState({ title, message, onRetry, action }: ErrorStateProps) {
  const { t } = useTranslation();
  const isActionObject = (
    value: ErrorStateProps['action']
  ): value is { label: string; onClick: () => void } => (
    typeof value === 'object' &&
    value !== null &&
    !('type' in value) &&
    'label' in value &&
    'onClick' in value
  );
  const fallbackAction = onRetry ? (
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
    >
      {t('common.actions.retry')}
    </button>
  ) : null;
  const renderedAction: ReactNode = action
    ? (isActionObject(action)
      ? (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
        >
          {action.label}
        </button>
      )
      : action)
    : fallbackAction;

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
      {renderedAction}
    </div>
  );
}

export default ErrorState;
