import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { EmissionsSummaryDTO } from '@/types/carbonAdjustment';
import { fetchGrossEmissions } from '@/services/adjustmentService';

interface Props {
  summary: EmissionsSummaryDTO;
  projectId?: string;
  orgId?: string;
}

export default function EmissionsSummaryPanel({ summary, projectId, orgId }: Props) {
  const { t } = useTranslation();

  // ── Real gross emissions from calculation_results ──────────────────────────
  const [realGross, setRealGross] = useState<number | null>(null);
  const [grossIsReal, setGrossIsReal] = useState(false);
  const [grossLoading, setGrossLoading] = useState(true);

  useEffect(() => {
    setGrossLoading(true);
    fetchGrossEmissions({ project_id: projectId, org_id: orgId })
      .then((res) => {
        if (res && res.is_real && res.gross_tco2e > 0) {
          setRealGross(res.gross_tco2e);
          setGrossIsReal(true);
        } else {
          setRealGross(null);
          setGrossIsReal(false);
        }
      })
      .catch(() => {
        setRealGross(null);
        setGrossIsReal(false);
      })
      .finally(() => setGrossLoading(false));
  }, [projectId, orgId]);

  const displayGross = grossIsReal && realGross !== null ? realGross : summary.gross_emissions_tco2e;

  const adjustmentPct = displayGross > 0
    ? ((summary.total_adjustments_tco2e / displayGross) * 100).toFixed(1)
    : '0.0';

  const claimableResult = grossIsReal && realGross !== null
    ? Math.max(0, realGross - summary.total_adjustments_tco2e)
    : summary.claimable_result_tco2e;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{t('carbonAdjustments.summary.title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{summary.period}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!summary.rule_engine_applied && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <i className="ri-error-warning-line text-xs"></i>
              {t('carbonAdjustments.ruleResult.mockBanner')}
            </span>
          )}
          {summary.claim_purpose_label && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
              <i className="ri-flag-line text-xs"></i>
              {summary.claim_purpose_label}
            </span>
          )}
        </div>
      </div>

      {/* Three-layer summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">

        {/* ── Gross Emissions ── REAL DATA from calculation_results ─────────── */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-400 flex-shrink-0"></div>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t('carbonAdjustments.summary.grossEmissions')}
            </span>
          </div>

          {/* Data origin badge — block level */}
          <div className="mt-1 mb-2">
            {grossLoading ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                <i className="ri-loader-4-line animate-spin text-xs"></i>
                載入中
              </span>
            ) : grossIsReal ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <i className="ri-checkbox-circle-line text-xs"></i>
                Real · calculation_results
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                <i className="ri-error-warning-line text-xs"></i>
                Mock · 待 Codex 資料
              </span>
            )}
          </div>

          <p className="text-2xl font-bold text-gray-900">
            {grossLoading ? (
              <span className="text-gray-300">—</span>
            ) : (
              displayGross.toLocaleString()
            )}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{t('carbonAdjustments.summary.unit')}</p>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">{t('carbonAdjustments.summary.grossDesc')}</p>
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <i className="ri-lock-line text-xs"></i>
            {t('carbonAdjustments.notices.grossImmutable')}
          </p>
        </div>

        {/* ── Adjustments ── MOCK (no carbon_adjustments table yet) ─────────── */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-teal-400 flex-shrink-0"></div>
            <span className="text-xs font-semibold text-teal-600 uppercase tracking-wide">
              {t('carbonAdjustments.summary.adjustments')}
            </span>
          </div>

          {/* Block-level mock badge */}
          <div className="mt-1 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <i className="ri-error-warning-line text-xs"></i>
              Mock · 待 carbon_adjustments schema
            </span>
          </div>

          <p className="text-2xl font-bold text-teal-700">
            -{summary.total_adjustments_tco2e.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{t('carbonAdjustments.summary.unit')} ({adjustmentPct}%)</p>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">{t('carbonAdjustments.summary.adjustmentsDesc')}</p>
          <div className="mt-3 space-y-1.5">
            {summary.adjustments_by_type.map((item) => (
              <div key={item.type} className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{t(`carbonAdjustments.adjustmentTypes.${item.type}`)}</span>
                <span className={`font-medium ${item.approved_count > 0 ? 'text-teal-700' : 'text-gray-300'}`}>
                  {item.quantity_tco2e > 0 ? `-${item.quantity_tco2e.toLocaleString()}` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Claimable Result ── derived (gross real + adjustments mock) ────── */}
        <div className="px-6 py-5 bg-teal-50/40">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-teal-600 flex-shrink-0"></div>
            <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
              {t('carbonAdjustments.summary.claimableResult')}
            </span>
          </div>

          {/* Block-level badge — mixed: gross real + adjustments mock */}
          <div className="mt-1 mb-2">
            {grossIsReal ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                <i className="ri-information-line text-xs"></i>
                部分真實 · 調整項仍為 Mock
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                <i className="ri-error-warning-line text-xs"></i>
                Mock · 估算值
              </span>
            )}
          </div>

          <p className="text-2xl font-bold text-teal-800">
            {grossLoading ? (
              <span className="text-gray-300">—</span>
            ) : (
              claimableResult.toLocaleString()
            )}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{t('carbonAdjustments.summary.unit')}</p>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">{t('carbonAdjustments.summary.claimableDesc')}</p>
          {summary.claim_purpose_label ? (
            <p className="text-xs text-teal-600 mt-2 flex items-center gap-1">
              <i className="ri-flag-line text-xs"></i>
              {summary.claim_purpose_label}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <i className="ri-flag-line text-xs"></i>
              <span className="italic">{t('carbonAdjustments.fields.claimPurpose')}：—</span>
            </p>
          )}
          {summary.has_pending_adjustments && (
            <div className="mt-3 flex items-start gap-1.5 px-2.5 py-2 bg-amber-50 rounded-lg border border-amber-100">
              <i className="ri-time-line text-amber-500 text-xs mt-0.5 flex-shrink-0"></i>
              <p className="text-xs text-amber-700">{t('carbonAdjustments.summary.pendingNote')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
        <i className="ri-information-line text-gray-400 text-sm flex-shrink-0"></i>
        <p className="text-xs text-gray-400">{t('carbonAdjustments.notAppliedNotice')}</p>
      </div>
    </div>
  );
}
