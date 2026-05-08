import { useTranslation } from 'react-i18next';
import { IS_STAGING } from '../../utils/staging';

interface GovernanceBannerProps {
  variant: 'beta' | 'internal' | 'mock' | 'readonly' | 'immutable';
  title?: string;
  message: string;
  /** Optional action button */
  actionLabel?: string;
  onAction?: () => void;
  /** Allow dismissal? */
  dismissible?: boolean;
}

/**
 * Unified Governance Banner
 *
 * Single component for all governance-related warnings across the app.
 * Ensures consistent styling for beta, internal, mock, readonly, and immutable warnings.
 *
 * Variants:
 * - beta: amber — closed beta / test-only notice
 * - internal: amber/dark — platform internal, not for tenant workflow
 * - mock: sky — data is mock, not real backend
 * - readonly: slate — view-only mode
 * - immutable: stone — data cannot be modified (not readonly permission, but data nature)
 */
export default function GovernanceBanner({
  variant,
  title,
  message,
  actionLabel,
  onAction,
}: GovernanceBannerProps) {
  const { t } = useTranslation();

  // If not staging, suppress mock banners (they're irrelevant in production)
  if (variant === 'mock' && !IS_STAGING) return null;

  const styles = {
    beta: {
      wrapper: 'bg-amber-50 border-amber-200',
      icon: 'ri-flashlight-line text-amber-600',
      title: 'text-amber-900',
      message: 'text-amber-800',
      badge: 'bg-amber-100 text-amber-700 border-amber-300',
      action: 'bg-amber-600 text-white hover:bg-amber-700',
    },
    internal: {
      wrapper: 'bg-amber-50 border-amber-200',
      icon: 'ri-shield-keyhole-line text-amber-700',
      title: 'text-amber-900',
      message: 'text-amber-800',
      badge: 'bg-amber-200 text-amber-800 border-amber-400',
      action: 'bg-amber-700 text-white hover:bg-amber-800',
    },
    mock: {
      wrapper: 'bg-sky-50 border-sky-200',
      icon: 'ri-database-2-line text-sky-600',
      title: 'text-sky-900',
      message: 'text-sky-800',
      badge: 'bg-sky-100 text-sky-700 border-sky-300',
      action: 'bg-sky-600 text-white hover:bg-sky-700',
    },
    readonly: {
      wrapper: 'bg-slate-50 border-slate-200',
      icon: 'ri-eye-line text-slate-600',
      title: 'text-slate-900',
      message: 'text-slate-700',
      badge: 'bg-slate-100 text-slate-600 border-slate-300',
      action: 'bg-slate-600 text-white hover:bg-slate-700',
    },
    immutable: {
      wrapper: 'bg-stone-50 border-stone-200',
      icon: 'ri-lock-line text-stone-600',
      title: 'text-stone-900',
      message: 'text-stone-700',
      badge: 'bg-stone-100 text-stone-600 border-stone-300',
      action: 'bg-stone-600 text-white hover:bg-stone-700',
    },
  };

  const s = styles[variant];
  const defaultTitle = {
    beta: t('governance.betaTitle', 'Beta Notice'),
    internal: t('governance.internalTitle', 'Platform Internal'),
    mock: t('governance.mockTitle', 'Mock Data'),
    readonly: t('governance.readonlyTitle', 'Read-Only'),
    immutable: t('governance.immutableTitle', 'Immutable Data'),
  }[variant];

  return (
    <div className={`border rounded-lg p-3 mb-4 ${s.wrapper}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <i className={`${s.icon} text-lg w-5 h-5 flex items-center justify-center`}></i>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border ${s.badge}`}>
              {defaultTitle}
            </span>
            {title && (
              <span className={`text-sm font-semibold ${s.title}`}>
                {title}
              </span>
            )}
          </div>
          <p className={`text-sm mt-1 ${s.message}`}>
            {message}
          </p>
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className={`mt-2 px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap transition-colors ${s.action}`}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}