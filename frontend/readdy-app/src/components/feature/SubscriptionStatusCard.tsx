import { useTranslation } from 'react-i18next';
import type { Subscription } from '../../types/subscription';

interface SubscriptionStatusCardProps {
  subscription: Subscription;
  onUpgrade?: () => void;
  onRenew?: () => void;
  onManage?: () => void;
}

export function SubscriptionStatusCard({
  subscription,
  onUpgrade,
  onRenew,
  onManage,
}: SubscriptionStatusCardProps) {
  const { t } = useTranslation();

  const isExpired = subscription.status === 'expired';
  const isActive = subscription.status === 'active';

  const daysRemaining = Math.ceil(
    (new Date(subscription.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const isExpiringSoon = isActive && daysRemaining <= 7;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('subscription.card_title')}
        </h3>
        {isExpired && (
          <span className="px-3 py-1 text-sm font-medium text-red-700 bg-red-50 rounded-full">
            {t('subscription.status_types.expired')}
          </span>
        )}
        {isActive && (
          <span className="px-3 py-1 text-sm font-medium text-teal-700 bg-teal-50 rounded-full">
            {t('subscription.status_types.active')}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <span className="text-sm text-gray-600">{t('subscription.card_current_plan')}</span>
          <span className="text-sm font-semibold text-gray-900">
            {t(`subscription.plans.${subscription.plan}`)}
          </span>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <span className="text-sm text-gray-600">{t('subscription.card_valid_period')}</span>
          <span className="text-sm text-gray-900">
            {new Date(subscription.start_date).toLocaleDateString()} -{' '}
            {new Date(subscription.end_date).toLocaleDateString()}
          </span>
        </div>

        {isActive && (
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <span className="text-sm text-gray-600">{t('subscription.card_days_remaining')}</span>
            <span className={`text-sm font-semibold ${isExpiringSoon ? 'text-orange-600' : 'text-gray-900'}`}>
              {daysRemaining} {t('common.time.days')}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between py-3">
          <span className="text-sm text-gray-600">{t('subscription.card_auto_renew')}</span>
          <span className="text-sm text-gray-900">
            {subscription.auto_renew ? t('subscription.card_enabled') : t('subscription.card_disabled')}
          </span>
        </div>
      </div>

      {isExpiringSoon && (
        <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-800">
            {t('subscription.warnings_expiring_soon', { days: daysRemaining })}
          </p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {isExpired && onRenew && (
          <button
            onClick={onRenew}
            className="flex-1 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            {t('subscription.card_renew_button')}
          </button>
        )}
        {isActive && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="flex-1 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            {t('subscription.card_upgrade_button')}
          </button>
        )}
        {onManage && (
          <button
            onClick={onManage}
            className="flex-1 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            {t('subscription.card_manage_button')}
          </button>
        )}
      </div>
    </div>
  );
}

export default SubscriptionStatusCard;