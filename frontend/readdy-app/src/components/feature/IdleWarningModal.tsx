import { useTranslation } from 'react-i18next';

interface IdleWarningModalProps {
  countdown: number;
  onStayLoggedIn: () => void;
  onLogoutNow: () => void;
}

export default function IdleWarningModal({
  countdown,
  onStayLoggedIn,
  onLogoutNow,
}: IdleWarningModalProps) {
  const { t } = useTranslation();

  // Compute progress ring (0–100)
  const progress = Math.round((countdown / 60) * 100);
  const circumference = 2 * Math.PI * 22; // r=22
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />

        <div className="px-6 pt-6 pb-5">
          {/* Icon + countdown ring */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative w-16 h-16 flex items-center justify-center mb-3">
              {/* SVG ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
                <circle
                  cx="24" cy="24" r="22"
                  fill="none"
                  stroke="#FEF3C7"
                  strokeWidth="3"
                />
                <circle
                  cx="24" cy="24" r="22"
                  fill="none"
                  stroke={countdown <= 10 ? '#EF4444' : '#F59E0B'}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                />
              </svg>
              {/* Countdown number */}
              <span className={`relative text-xl font-bold tabular-nums ${countdown <= 10 ? 'text-red-500' : 'text-amber-600'}`}>
                {countdown}
              </span>
            </div>

            <h2 className="text-base font-semibold text-gray-900 text-center">
              {t('session.idleWarningTitle')}
            </h2>
            <p className="text-sm text-gray-500 text-center mt-1.5 leading-relaxed">
              {t('session.idleWarningMessage', { seconds: countdown })}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onStayLoggedIn}
              className="w-full py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
            >
              {t('session.stayLoggedIn')}
            </button>
            <button
              onClick={onLogoutNow}
              className="w-full py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              {t('session.logoutNow')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
