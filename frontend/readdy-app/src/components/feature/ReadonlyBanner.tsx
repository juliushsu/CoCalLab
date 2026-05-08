import { useTranslation } from 'react-i18next';

interface ReadonlyBannerProps {
  onRenew?: () => void;
  onContact?: () => void;
}

export function ReadonlyBanner({ onRenew, onContact }: ReadonlyBannerProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-red-50 border-b border-red-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <i className="ri-error-warning-line text-2xl text-red-600"></i>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                {t('subscription.readonly_banner_title')}
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {t('subscription.readonly_banner_message')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onRenew && (
              <button
                onClick={onRenew}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
              >
                {t('subscription.readonly_banner_renew_button')}
              </button>
            )}
            {onContact && (
              <button
                onClick={onContact}
                className="px-4 py-2 bg-white text-red-700 text-sm font-medium rounded-lg border border-red-300 hover:bg-red-50 transition-colors whitespace-nowrap"
              >
                {t('subscription.readonly_banner_contact_button')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReadonlyBanner;