import { useTranslation } from 'react-i18next';
import type { AdjustmentApplicationDTO } from '@/types/carbonAdjustment';
import type { AdjustmentApplicationRow } from '@/services/adjustmentService';

interface Props {
  applications: AdjustmentApplicationDTO[];
  realApplications?: AdjustmentApplicationRow[] | null;
  isReal?: boolean;
}

export default function ApplicationsTab({ applications, realApplications, isReal = false }: Props) {
  const { t } = useTranslation();

  const statusColors: Record<string, string> = {
    evaluated: 'bg-sky-100 text-sky-700',
    applied: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    reversed: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="space-y-4">
      {/* Block-level data origin banner */}
      {isReal ? (
        <div className="flex items-start gap-3 px-4 py-3 bg-green-50 rounded-xl border border-green-200">
          <i className="ri-checkbox-circle-fill text-green-500 text-base mt-0.5 flex-shrink-0"></i>
          <div>
            <p className="text-sm font-semibold text-green-800">真實資料 · 申請狀態</p>
            <p className="text-xs text-green-600 mt-0.5">資料來自 Supabase <code className="font-mono bg-green-100 px-1 rounded">adjustment_applications</code> table（canonical seed v2026.04.07）。</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
          <i className="ri-error-warning-line text-amber-500 text-base mt-0.5 flex-shrink-0"></i>
          <div>
            <p className="text-sm font-semibold text-amber-800">Fallback Mock · 申請狀態</p>
            <p className="text-xs text-amber-600 mt-0.5">adjustment_applications table 已存在但篩選無結果，顯示 fixture fallback。</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {applications.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">{t('carbonAdjustments.empty.title')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  t('carbonAdjustments.fields.claimPurpose'),
                  t('carbonAdjustments.fields.targetLabel'),
                  t('carbonAdjustments.fields.inventoryImpactMode'),
                  t('carbonAdjustments.fields.requestedQuantity'),
                  t('carbonAdjustments.fields.eligibleQuantity'),
                  t('carbonAdjustments.fields.appliedQuantity'),
                  t('carbonAdjustments.fields.disallowedQuantity'),
                  t('carbonAdjustments.fields.applicationStatus'),
                  t('carbonAdjustments.fields.disallowReasons'),
                ].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {applications.map((app) => {
                const isBlocked = app.is_blocked_by_verification || app.is_blocked_by_approval;
                return (
                  <tr key={app.id} className={`hover:bg-gray-50/50 ${isBlocked ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 whitespace-nowrap">
                        {t(`carbonAdjustments.claimPurpose.${app.claim_purpose}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-xs text-gray-400">{t(`carbonAdjustments.targetType.${app.target_type}`)}</span>
                        <p className="text-xs text-gray-700 mt-0.5">{app.target_label}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-600 whitespace-nowrap">
                        {t(`carbonAdjustments.inventoryImpactMode.${app.inventory_impact_mode}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700 whitespace-nowrap">{app.requested_quantity_tco2e.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium whitespace-nowrap ${app.eligible_quantity_tco2e > 0 ? 'text-teal-700' : 'text-gray-300'}`}>
                        {app.eligible_quantity_tco2e.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold whitespace-nowrap ${app.applied_quantity_tco2e > 0 ? 'text-green-700' : 'text-gray-300'}`}>
                        {app.applied_quantity_tco2e.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium whitespace-nowrap ${app.disallowed_quantity_tco2e > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                        {app.disallowed_quantity_tco2e > 0 ? app.disallowed_quantity_tco2e.toLocaleString() : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[app.application_status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {t(`carbonAdjustments.applicationStatus.${app.application_status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {app.disallow_reasons.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {app.disallow_reasons.map((r) => (
                            <span key={r} className="inline-flex items-center gap-1 text-xs text-red-500 whitespace-nowrap">
                              <i className="ri-close-circle-line text-xs"></i>
                              {t(`carbonAdjustments.disallowReasons.${r}`, r)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
