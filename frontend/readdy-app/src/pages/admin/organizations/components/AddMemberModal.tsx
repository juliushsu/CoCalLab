import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MemberRole } from '../../../../types/organization';
import { addOrganizationMember } from '../../../../services/organizationService';
import { IS_STAGING } from '../../../../utils/staging';

interface AddMemberModalProps {
  organizationId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const ROLE_OPTIONS: Exclude<MemberRole, 'owner'>[] = ['admin', 'editor', 'viewer'];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE_ICONS: Record<string, string> = {
  admin:  'ri-shield-star-line',
  editor: 'ri-edit-2-line',
  viewer: 'ri-eye-line',
};

export default function AddMemberModal({ organizationId, onSuccess, onClose }: AddMemberModalProps) {
  const { t } = useTranslation();
  const [email, setEmail]         = useState('');
  const [role, setRole]           = useState<Exclude<MemberRole, 'owner'>>('editor');
  const [activateMode, setActivateMode] = useState(false);
  const [userId, setUserId]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const isValidUuid  = (v: string) => UUID_REGEX.test(v.trim());

  // Active 模式必須有合法 user_id；invited 模式只需 email
  const canSubmit = isValidEmail(email) &&
    (activateMode ? (!!userId && isValidUuid(userId)) : true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError(t('organizations.members.errors.invalidEmail'));
      return;
    }
    if (activateMode && (!userId || !isValidUuid(userId))) {
      setError(t('organizations.members.errors.activeRequiresUserId'));
      return;
    }

    setSubmitting(true);
    try {
      await addOrganizationMember({
        organization_id: organizationId,
        invited_email:   email,
        role,
        user_id: activateMode ? userId.trim() : undefined,
      });
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'DUPLICATE_MEMBER') {
          setError(t('organizations.members.errors.duplicateEmail'));
        } else {
          setError(t('organizations.members.errors.addFailed'));
        }
      } else {
        setError(t('organizations.members.errors.addFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-md mx-4 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {t('organizations.members.addMemberTitle')}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* ── Mode status banner ── */}
          {activateMode ? (
            <div className="flex items-start gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
              <div className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
                <i className="ri-checkbox-circle-line"></i>
              </div>
              <div>
                <div className="font-semibold">{t('organizations.members.activeModeLabel')}</div>
                <div className="mt-0.5 text-green-600">{t('organizations.members.activeModeDesc')}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
              <div className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
                <i className="ri-mail-send-line"></i>
              </div>
              <div>
                <div className="font-semibold">{t('organizations.members.invitedModeLabel')}</div>
                <div className="mt-0.5 text-yellow-600">{t('organizations.members.invitedModeDesc')}</div>
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('organizations.members.fields.email')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null); }}
              placeholder={t('organizations.members.placeholders.email')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled={submitting}
              required
            />
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('organizations.members.fields.role')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`px-3 py-2 text-xs rounded-lg border transition-all cursor-pointer text-left ${
                    role === r
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <i className={`${ROLE_ICONS[r]} text-sm`}></i>
                    {t(`organizations.members.roles.${r}`)}
                  </div>
                  <div className={`text-xs mt-0.5 leading-tight ${role === r ? 'text-teal-600' : 'text-gray-400'}`}>
                    {t(`organizations.members.roleDescriptions.${r}`)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Staging: activate toggle ── */}
          {IS_STAGING && (
            <div className={`border rounded-lg p-3 space-y-3 transition-colors ${
              activateMode ? 'border-teal-300 bg-teal-50/30' : 'border-dashed border-amber-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded">STAGING</span>
                  <span className="text-sm text-gray-700 font-medium">{t('organizations.members.stagingActivateToggle')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setActivateMode(p => !p); setUserId(''); setError(null); }}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${activateMode ? 'bg-teal-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${activateMode ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {activateMode && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {t('organizations.members.fields.userId')}
                    <span className="text-red-500 ml-1">*</span>
                    <span className="text-gray-400 font-normal ml-1">（active 模式必填）</span>
                  </label>
                  <input
                    type="text"
                    value={userId}
                    onChange={e => { setUserId(e.target.value); setError(null); }}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className={`w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 font-mono ${
                      userId && !isValidUuid(userId)
                        ? 'border-red-400 bg-red-50 focus:ring-red-300'
                        : userId && isValidUuid(userId)
                          ? 'border-green-400 bg-green-50 focus:ring-teal-500'
                          : 'border-gray-300 focus:ring-teal-500'
                    }`}
                    disabled={submitting}
                    required={activateMode}
                  />
                  {/* Validation feedback */}
                  {userId && !isValidUuid(userId) && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {t('organizations.members.errors.invalidUserId')}
                    </p>
                  )}
                  {userId && isValidUuid(userId) && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <i className="ri-checkbox-circle-line"></i>
                      {t('organizations.members.stagingUidValid')}
                    </p>
                  )}
                  {!userId && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <i className="ri-alert-line"></i>
                      {t('organizations.members.stagingUidRequired')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
              <i className="ri-error-warning-line shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center gap-2 transition-colors ${
                activateMode
                  ? 'bg-teal-600 hover:bg-teal-700'
                  : 'bg-gray-500 hover:bg-gray-600'
              }`}
            >
              {submitting ? (
                <><i className="ri-loader-4-line animate-spin"></i>{t('common.loading')}</>
              ) : activateMode ? (
                <><i className="ri-user-follow-line"></i>{t('organizations.members.addActiveButton')}</>
              ) : (
                <><i className="ri-mail-send-line"></i>{t('organizations.members.addInviteButton')}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
