import { useTranslation } from 'react-i18next';
import type { CarbonAdjustmentDTO } from '@/types/carbonAdjustment';

interface Props {
  adjustment: CarbonAdjustmentDTO | null;
  onClose: () => void;
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-800">{value ?? <span className="text-gray-300">—</span>}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 pt-1 border-t border-gray-100">
      {children}
    </h3>
  );
}

function StatusBadge({ colorClass, children }: { colorClass: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      {children}
    </span>
  );
}

export default function AdjustmentDetailDrawer({ adjustment, onClose }: Props) {
  const { t } = useTranslation();

  if (!adjustment) return null;

  // ── i18n label mappings (no raw code exposed) ──────────────────────────────
  const typeLabel        = t(`carbonAdjustments.adjustmentTypes.${adjustment.adjustment_type}`);
  const statusLabel      = t(`carbonAdjustments.status.${adjustment.status}`);
  const verificationLabel = t(`carbonAdjustments.verificationStatusFull.${adjustment.verification_status}`);
  const doubleCountingLabel = t(`carbonAdjustments.doubleCounting.${adjustment.double_counting_check}`);
  const eligibleUseLabel = adjustment.eligible_use
    ? t(`carbonAdjustments.eligibleUse.${adjustment.eligible_use}`)
    : null;
  const approvalLabel    = adjustment.approval_status
    ? t(`carbonAdjustments.approvalStatus.${adjustment.approval_status}`)
    : null;
  const proofDocLabel    = adjustment.proof_document_status
    ? t(`carbonAdjustments.proofDocumentStatus.${adjustment.proof_document_status}`)
    : null;
  const targetTypeLabel  = adjustment.target_type
    ? t(`carbonAdjustments.targetType.${adjustment.target_type}`)
    : null;
  const claimPurposeLabel = adjustment.claim_purpose
    ? t(`carbonAdjustments.claimPurpose.${adjustment.claim_purpose}`)
    : null;

  // ── Color maps ─────────────────────────────────────────────────────────────
  const statusColors: Record<string, string> = {
    draft:          'bg-gray-100 text-gray-600',
    pending_review: 'bg-amber-100 text-amber-700',
    approved:       'bg-green-100 text-green-700',
    rejected:       'bg-red-100 text-red-700',
    expired:        'bg-gray-100 text-gray-500',
  };
  const approvalColors: Record<string, string> = {
    draft:     'bg-gray-100 text-gray-600',
    submitted: 'bg-amber-100 text-amber-700',
    approved:  'bg-green-100 text-green-700',
    rejected:  'bg-red-100 text-red-700',
    revoked:   'bg-orange-100 text-orange-700',
  };
  const verificationColors: Record<string, string> = {
    unverified:          'bg-gray-100 text-gray-500',
    pending:             'bg-amber-100 text-amber-700',
    verified:            'bg-green-100 text-green-700',
    third_party_verified:'bg-teal-100 text-teal-700',
    self_declared:       'bg-sky-100 text-sky-700',
    rejected:            'bg-red-100 text-red-700',
  };
  const doubleCountingColors: Record<string, string> = {
    clear:   'bg-green-100 text-green-700',
    flagged: 'bg-red-100 text-red-700',
    unknown: 'bg-gray-100 text-gray-500',
  };
  const proofDocColors: Record<string, string> = {
    not_uploaded: 'bg-gray-100 text-gray-500',
    uploaded:     'bg-amber-100 text-amber-700',
    verified:     'bg-green-100 text-green-700',
    rejected:     'bg-red-100 text-red-700',
  };

  const typeIcons: Record<string, string> = {
    offset_credit:        'ri-leaf-line',
    renewable_electricity:'ri-flashlight-line',
    carbon_removal:       'ri-recycle-line',
    carbon_storage:       'ri-archive-line',
  };

  // ── Blocking notices ───────────────────────────────────────────────────────
  const isBlocked = adjustment.status !== 'approved' || adjustment.approval_status !== 'approved';
  const isVerificationPending = ['unverified', 'pending'].includes(adjustment.verification_status);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
              <i className={`${typeIcons[adjustment.adjustment_type] ?? 'ri-file-list-line'} text-teal-600 text-lg`}></i>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{t('carbonAdjustments.drawerTitle')}</h2>
              <p className="text-xs text-gray-400">{typeLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            <i className="ri-close-line text-gray-500 text-lg"></i>
          </button>
        </div>

        {/* Notices */}
        <div className="px-6 pt-4 space-y-2">
          {isBlocked && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
              <i className="ri-information-line text-amber-500 text-sm mt-0.5 flex-shrink-0"></i>
              <p className="text-xs text-amber-700">{t('carbonAdjustments.notAppliedNotice')}</p>
            </div>
          )}
          {isVerificationPending && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-100">
              <i className="ri-error-warning-line text-red-400 text-sm mt-0.5 flex-shrink-0"></i>
              <p className="text-xs text-red-700">{t('carbonAdjustments.notices.unverifiedBlocked')}</p>
            </div>
          )}
          <div className="flex items-start gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
            <i className="ri-error-warning-line text-gray-400 text-sm mt-0.5 flex-shrink-0"></i>
            <p className="text-xs text-gray-500">{t('carbonAdjustments.eligibilityNotice')}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* ── Section: Status overview ──────────────────────────────────── */}
          <div>
            <SectionTitle>{t('carbonAdjustments.drawer.sectionStatus')}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              <StatusBadge colorClass={statusColors[adjustment.status] ?? 'bg-gray-100 text-gray-600'}>
                {statusLabel}
              </StatusBadge>
              {approvalLabel && (
                <StatusBadge colorClass={approvalColors[adjustment.approval_status ?? ''] ?? 'bg-gray-100 text-gray-600'}>
                  <i className="ri-checkbox-circle-line text-xs"></i>
                  {approvalLabel}
                </StatusBadge>
              )}
              <StatusBadge colorClass={verificationColors[adjustment.verification_status] ?? 'bg-gray-100 text-gray-500'}>
                <i className="ri-verified-badge-line text-xs"></i>
                {verificationLabel}
              </StatusBadge>
              <StatusBadge colorClass={doubleCountingColors[adjustment.double_counting_check] ?? 'bg-gray-100 text-gray-500'}>
                <i className="ri-shield-check-line text-xs"></i>
                {doubleCountingLabel}
              </StatusBadge>
              {proofDocLabel && (
                <StatusBadge colorClass={proofDocColors[adjustment.proof_document_status ?? ''] ?? 'bg-gray-100 text-gray-500'}>
                  <i className="ri-file-text-line text-xs"></i>
                  {proofDocLabel}
                </StatusBadge>
              )}
              {adjustment.is_fixture && (
                <StatusBadge colorClass="bg-sky-100 text-sky-700">
                  <i className="ri-settings-3-line text-xs"></i>
                  {t('dataOrigin.badges.fixture')}
                </StatusBadge>
              )}
            </div>
          </div>

          {/* ── Section: Certificate info ─────────────────────────────────── */}
          <div>
            <SectionTitle>{t('carbonAdjustments.drawer.sectionCertificate')}</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label={t('carbonAdjustments.fields.certificateNumber')} value={adjustment.certificate_number} />
              <FieldRow label={t('carbonAdjustments.fields.registryProgram')} value={adjustment.registry_program} />
              <FieldRow label={t('carbonAdjustments.fields.vintageYear')} value={adjustment.vintage_year?.toString()} />
              <FieldRow label={t('carbonAdjustments.fields.issueDate')} value={adjustment.issue_date} />
              <FieldRow label={t('carbonAdjustments.fields.retirementDate')} value={adjustment.retirement_date} />
              <FieldRow
                label={t('carbonAdjustments.fields.quantity')}
                value={
                  <span className="font-semibold text-teal-700">
                    {adjustment.quantity_tco2e.toLocaleString()} {adjustment.unit}
                  </span>
                }
              />
              {adjustment.quantity_available_tco2e != null && (
                <FieldRow
                  label={t('carbonAdjustments.fields.quantityAvailable')}
                  value={
                    <span className={`font-semibold ${adjustment.quantity_available_tco2e > 0 ? 'text-teal-700' : 'text-gray-400'}`}>
                      {adjustment.quantity_available_tco2e.toLocaleString()} {adjustment.unit}
                    </span>
                  }
                />
              )}
            </div>
          </div>

          {/* ── Section: Verification ─────────────────────────────────────── */}
          <div>
            <SectionTitle>{t('carbonAdjustments.drawer.sectionVerification')}</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label={t('carbonAdjustments.fields.verificationStatus')} value={verificationLabel} />
              <FieldRow label={t('carbonAdjustments.fields.verifierName')} value={adjustment.verifier_name} />
              <FieldRow label={t('carbonAdjustments.fields.verificationDate')} value={adjustment.verification_date} />
              <FieldRow label={t('carbonAdjustments.fields.proofDocumentStatus')} value={proofDocLabel} />
            </div>
          </div>

          {/* ── Section: Jurisdiction & Eligibility ───────────────────────── */}
          <div>
            <SectionTitle>{t('carbonAdjustments.drawer.sectionJurisdiction')}</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label={t('carbonAdjustments.fields.jurisdiction')} value={adjustment.jurisdiction} />
              <FieldRow label={t('carbonAdjustments.fields.eligibleUse')} value={eligibleUseLabel} />
              <FieldRow label={t('carbonAdjustments.fields.doubleCountingCheck')} value={doubleCountingLabel} />
            </div>
          </div>

          {/* ── Section: Application & Claim ──────────────────────────────── */}
          <div>
            <SectionTitle>{t('carbonAdjustments.drawer.sectionApplication')}</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              {targetTypeLabel && (
                <FieldRow label={t('carbonAdjustments.fields.targetType')} value={targetTypeLabel} />
              )}
              {adjustment.target_label && (
                <FieldRow label={t('carbonAdjustments.fields.targetLabel')} value={adjustment.target_label} />
              )}
              {claimPurposeLabel && (
                <FieldRow label={t('carbonAdjustments.fields.claimPurpose')} value={claimPurposeLabel} />
              )}
              {approvalLabel && (
                <FieldRow label={t('carbonAdjustments.fields.approvalStatus')} value={approvalLabel} />
              )}
            </div>

            {/* Blocking notice if not approved */}
            {adjustment.approval_status && adjustment.approval_status !== 'approved' && (
              <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
                <i className="ri-lock-line text-amber-500 text-sm mt-0.5 flex-shrink-0"></i>
                <p className="text-xs text-amber-700">{t('carbonAdjustments.notices.unapprovedBlocked')}</p>
              </div>
            )}
          </div>

          {/* ── Section: Notes ────────────────────────────────────────────── */}
          {adjustment.notes && (
            <div>
              <SectionTitle>{t('carbonAdjustments.drawer.sectionNotes')}</SectionTitle>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">
                {adjustment.notes}
              </p>
            </div>
          )}

          {/* Codex note */}
          <div className="flex items-start gap-2 px-3 py-2 bg-teal-50 rounded-lg border border-teal-100">
            <i className="ri-code-box-line text-teal-500 text-sm mt-0.5 flex-shrink-0"></i>
            <p className="text-xs text-teal-700">{t('carbonAdjustments.codexNote')}</p>
          </div>
        </div>
      </div>
    </>
  );
}
