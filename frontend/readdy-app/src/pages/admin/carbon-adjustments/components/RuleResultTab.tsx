import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { RuleResultDTO, CarbonAdjustmentDTO } from '@/types/carbonAdjustment';
import { fetchAdjustmentRuleResults } from '@/services/adjustmentService';
import { mockRuleResults } from '@/mocks/carbonAdjustments.fixture';

interface Props {
  ruleResults: RuleResultDTO[];   // mock fallback passed from parent
  adjustments: CarbonAdjustmentDTO[];
  projectId?: string;
}

export default function RuleResultTab({ ruleResults: mockFallback, adjustments, projectId }: Props) {
  const { t } = useTranslation();

  const [results, setResults] = useState<RuleResultDTO[]>(mockFallback);
  const [isReal, setIsReal] = useState(false);
  const [loading, setLoading] = useState(false);

  const adjMap = Object.fromEntries(adjustments.map((a) => [a.id, a]));

  // ── Fetch from real API ────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    fetchAdjustmentRuleResults({ project_id: projectId })
      .then((res) => {
        if (res?.results?.length) {
          setResults(res.results);
          setIsReal(!res.is_mock && res.rule_engine_applied);
        } else {
          // API unavailable or returned empty — use mock fallback
          setResults(mockFallback.length ? mockFallback : mockRuleResults);
          setIsReal(false);
        }
      })
      .catch(() => {
        setResults(mockFallback.length ? mockFallback : mockRuleResults);
        setIsReal(false);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-gray-400">
          <i className="ri-loader-4-line animate-spin text-xl"></i>
          <span className="text-sm">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banners — only show when NOT real */}
      {!isReal && (
        <div className="space-y-2">
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
            <i className="ri-error-warning-line text-amber-500 text-base mt-0.5 flex-shrink-0"></i>
            <div>
              <p className="text-sm font-semibold text-amber-800">{t('carbonAdjustments.ruleResult.mockBanner')}</p>
              <p className="text-xs text-amber-600 mt-0.5">{t('carbonAdjustments.ruleResult.eligibilityBanner')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200">
            <i className="ri-information-line text-gray-400 text-sm mt-0.5 flex-shrink-0"></i>
            <p className="text-xs text-gray-500">{t('carbonAdjustments.ruleResult.notAppliedBanner')}</p>
          </div>
        </div>
      )}

      {/* Real data badge */}
      {isReal && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 rounded-xl border border-green-200">
          <i className="ri-checkbox-circle-line text-green-600 text-sm flex-shrink-0"></i>
          <p className="text-xs text-green-700">{t('carbonAdjustments.ruleResult.realDataConnected')}</p>
        </div>
      )}

      {/* Rule result cards */}
      <div className="space-y-3">
        {results.map((rule) => {
          const adj = adjMap[rule.adjustment_id];
          const isEligible = rule.eligible_tco2e > 0 && rule.disallowed_tco2e === 0;
          const isPartial = rule.eligible_tco2e > 0 && rule.disallowed_tco2e > 0;
          const isDisallowed = rule.eligible_tco2e === 0;

          const cardBorder = isEligible
            ? 'border-green-200 bg-green-50/30'
            : isPartial
            ? 'border-amber-200 bg-amber-50/20'
            : 'border-red-100 bg-red-50/20';

          return (
            <div key={rule.id} className={`rounded-xl border p-5 ${cardBorder}`}>
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">
                      {t(`carbonAdjustments.claimPurpose.${rule.claim_purpose}`)}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{rule.jurisdiction ?? '—'}</span>
                    {adj && (
                      <>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">
                          {t(`carbonAdjustments.adjustmentTypes.${adj.adjustment_type}`)}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('carbonAdjustments.fields.inventoryImpactMode')}：
                    {t(`carbonAdjustments.inventoryImpactMode.${rule.inventory_impact_mode}`)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                  {isEligible && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      <i className="ri-checkbox-circle-line text-xs"></i>
                      {t('carbonAdjustments.ruleResult.eligible')}
                    </span>
                  )}
                  {isDisallowed && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      <i className="ri-close-circle-line text-xs"></i>
                      {t('carbonAdjustments.ruleResult.disallowed')}
                    </span>
                  )}
                  {isPartial && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      <i className="ri-error-warning-line text-xs"></i>
                      Partial
                    </span>
                  )}
                  {rule.is_mock && !isReal && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                      MOCK
                    </span>
                  )}
                </div>
              </div>

              {/* Quantity grid */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-white/70 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">{t('carbonAdjustments.fields.requestedQuantity')}</p>
                  <p className="text-lg font-bold text-gray-800">{rule.requested_tco2e.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">tCO₂e</p>
                </div>
                <div className={`rounded-lg p-3 ${rule.eligible_tco2e > 0 ? 'bg-green-50' : 'bg-white/70'}`}>
                  <p className="text-xs text-gray-400 mb-1">{t('carbonAdjustments.fields.eligibleQuantity')}</p>
                  <p className={`text-lg font-bold ${rule.eligible_tco2e > 0 ? 'text-green-700' : 'text-gray-300'}`}>
                    {rule.eligible_tco2e.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">tCO₂e</p>
                </div>
                <div className={`rounded-lg p-3 ${rule.disallowed_tco2e > 0 ? 'bg-red-50' : 'bg-white/70'}`}>
                  <p className="text-xs text-gray-400 mb-1">{t('carbonAdjustments.fields.disallowedQuantity')}</p>
                  <p className={`text-lg font-bold ${rule.disallowed_tco2e > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                    {rule.disallowed_tco2e.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">tCO₂e</p>
                </div>
              </div>

              {/* Rule hints */}
              {rule.rule_hints.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {t('carbonAdjustments.ruleResult.ruleHints')}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {rule.rule_hints.map((hint) => (
                      <div key={hint} className="flex items-center gap-2 text-xs text-red-600">
                        <i className="ri-close-circle-line text-xs flex-shrink-0"></i>
                        {t(`carbonAdjustments.disallowReasons.${hint}`, hint)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Engine info */}
              <div className="border-t border-gray-100 pt-3 mt-3 flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                <span>
                  {t('carbonAdjustments.ruleResult.ruleEngineVersion')}：
                  {rule.rule_engine_version ?? '—'}
                </span>
                <span>
                  {t('carbonAdjustments.ruleResult.evaluatedAt')}：
                  {rule.evaluated_at ?? t('carbonAdjustments.ruleResult.notEvaluated')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
