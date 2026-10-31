import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { RuleResultDTO, CarbonAdjustmentDTO } from '@/types/carbonAdjustment';
import { fetchAdjustmentRuleResults } from '@/services/adjustmentService';
import { adjustmentClaimPurposes, type EvaluationClaimPurpose } from '@/services/adjustmentContract';

interface Props {
  adjustments: CarbonAdjustmentDTO[];
  projectId?: string;
  orgId?: string;
}

export default function RuleResultTab({ adjustments, projectId, orgId }: Props) {
  const { t } = useTranslation();

  const [results, setResults] = useState<RuleResultDTO[]>([]);
  const [isReal, setIsReal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const adjMap = Object.fromEntries(adjustments.map((a) => [a.id, a]));

  // Evaluate only complete, real item inputs. Never guess a claim purpose or substitute fixtures.
  useEffect(() => {
    let active = true;
    setLoading(false);
    setResults([]);
    setIsReal(false);
    setError(null);
    if (!orgId) {
      setError('請先選擇組織，再查詢調整資格。');
      return;
    }
    const candidates = adjustments.filter((item) => item.org_id === orgId &&
      adjustmentClaimPurposes.includes(item.claim_purpose as EvaluationClaimPurpose) &&
      item.quantity_tco2e > 0);
    if (!candidates.length) return;
    setLoading(true);
    Promise.all(candidates.map((item) => fetchAdjustmentRuleResults({
      organization_id: orgId,
      project_id: projectId,
      adjustment_item_id: item.id,
      claim_purpose: item.claim_purpose as EvaluationClaimPurpose,
      requested_quantity_tco2e: item.quantity_tco2e,
    }))).then((responses) => {
      if (!active) return;
      setResults(responses.flatMap((response) => response.results));
      setIsReal(true);
    }).catch(() => {
      if (active) setError('調整資格查詢失敗；未套用任何調整，請稍後再試。');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, orgId, adjustments]);

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
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!error && results.length === 0 && <p className="p-4 text-sm text-gray-500">尚無可評估的調整項目。</p>}
      {isReal && <p className="rounded-lg bg-sky-50 p-4 text-sm text-sky-800">資格試算結果；此查詢不會核准、保留或扣抵額度。</p>}

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
