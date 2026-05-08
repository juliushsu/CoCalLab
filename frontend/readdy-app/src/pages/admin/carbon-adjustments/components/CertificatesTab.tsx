import { useTranslation } from 'react-i18next';
import type { CarbonAdjustmentDTO, VerificationStatusCode, ProofDocumentStatus } from '@/types/carbonAdjustment';
import type { AdjustmentCertificateRow } from '@/services/adjustmentService';

interface Props {
  adjustments: CarbonAdjustmentDTO[];
  realCertificates?: AdjustmentCertificateRow[] | null;
  isReal?: boolean;
}

function VerificationBadge({ status }: { status: VerificationStatusCode }) {
  const { t } = useTranslation();
  const map: Record<string, string> = {
    unverified: 'bg-gray-100 text-gray-500',
    pending: 'bg-amber-100 text-amber-700',
    verified: 'bg-green-100 text-green-700',
    third_party_verified: 'bg-green-100 text-green-700',
    self_declared: 'bg-sky-100 text-sky-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {t(`carbonAdjustments.verificationStatusFull.${status}`)}
    </span>
  );
}

function ProofBadge({ status }: { status: ProofDocumentStatus | null | undefined }) {
  const { t } = useTranslation();
  if (!status) return <span className="text-gray-300 text-xs">—</span>;
  const map: Record<string, string> = {
    not_uploaded: 'bg-red-50 text-red-500 border border-red-100',
    uploaded: 'bg-amber-50 text-amber-600 border border-amber-100',
    verified: 'bg-green-50 text-green-600 border border-green-100',
    rejected: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status === 'not_uploaded' && <i className="ri-upload-line text-xs"></i>}
      {status === 'uploaded' && <i className="ri-time-line text-xs"></i>}
      {status === 'verified' && <i className="ri-checkbox-circle-line text-xs"></i>}
      {t(`carbonAdjustments.proofDocumentStatus.${status}`)}
    </span>
  );
}

export default function CertificatesTab({ adjustments, realCertificates, isReal = false }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Block-level data origin banner */}
      {isReal ? (
        <div className="flex items-start gap-3 px-4 py-3 bg-green-50 rounded-xl border border-green-200">
          <i className="ri-checkbox-circle-fill text-green-500 text-base mt-0.5 flex-shrink-0"></i>
          <div>
            <p className="text-sm font-semibold text-green-800">真實資料 · 憑證列表</p>
            <p className="text-xs text-green-600 mt-0.5">資料來自 Supabase <code className="font-mono bg-green-100 px-1 rounded">adjustment_certificates</code> table（canonical seed v2026.04.07）。</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
          <i className="ri-error-warning-line text-amber-500 text-base mt-0.5 flex-shrink-0"></i>
          <div>
            <p className="text-sm font-semibold text-amber-800">Fallback Mock · 憑證列表</p>
            <p className="text-xs text-amber-600 mt-0.5">adjustment_certificates table 已存在但篩選無結果，顯示 fixture fallback。</p>
          </div>
        </div>
      )}
      {/* Upload != Apply notice */}
      <div className="flex items-start gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
        <i className="ri-information-line text-gray-400 text-base mt-0.5 flex-shrink-0"></i>
        <div>
          <p className="text-sm font-medium text-gray-700">{t('carbonAdjustments.notices.uploadNotApply')}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t('carbonAdjustments.eligibilityNotice')}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {[
                t('carbonAdjustments.fields.certificateNumber'),
                t('carbonAdjustments.fields.registryProgram'),
                t('carbonAdjustments.fields.issueDate'),
                t('carbonAdjustments.fields.retirementDate'),
                t('carbonAdjustments.fields.quantity'),
                t('carbonAdjustments.fields.verificationStatus'),
                t('carbonAdjustments.fields.approvalStatus'),
                t('carbonAdjustments.fields.doubleCountingCheck'),
                t('carbonAdjustments.fields.proofDocumentStatus'),
              ].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {adjustments.map((adj) => {
              const canApply = adj.verification_status === 'third_party_verified' || adj.verification_status === 'verified';
              const isApproved = adj.approval_status === 'approved';
              const dcColors: Record<string, string> = {
                clear: 'text-green-600',
                flagged: 'text-red-500',
                unknown: 'text-gray-400',
              };
              const dcIcons: Record<string, string> = {
                clear: 'ri-shield-check-line',
                flagged: 'ri-shield-cross-line',
                unknown: 'ri-question-line',
              };
              return (
                <tr key={adj.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-gray-700 whitespace-nowrap">
                      {adj.certificate_number ?? <span className="text-gray-300">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 whitespace-nowrap">{adj.registry_program ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 whitespace-nowrap">{adj.issue_date ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 whitespace-nowrap">{adj.retirement_date ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">{adj.quantity_tco2e.toLocaleString()} tCO₂e</span>
                  </td>
                  <td className="px-4 py-3">
                    <VerificationBadge status={adj.verification_status} />
                  </td>
                  <td className="px-4 py-3">
                    {adj.approval_status ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${isApproved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {t(`carbonAdjustments.approvalStatus.${adj.approval_status}`)}
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 text-xs whitespace-nowrap ${dcColors[adj.double_counting_check]}`}>
                      <i className={`${dcIcons[adj.double_counting_check]} text-sm`}></i>
                      {t(`carbonAdjustments.doubleCounting.${adj.double_counting_check}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <ProofBadge status={adj.proof_document_status} />
                      {/* Blocking notice */}
                      {!canApply && (
                        <span className="text-xs text-red-400 whitespace-nowrap flex items-center gap-1">
                          <i className="ri-forbid-line text-xs"></i>
                          {t('carbonAdjustments.notices.unverifiedBlocked').slice(0, 20)}…
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
