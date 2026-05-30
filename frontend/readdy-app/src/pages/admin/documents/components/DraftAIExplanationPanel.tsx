import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExtractedDocumentDraft } from '../../../../types/document';

type ConfidenceLevel = 'high' | 'medium' | 'low' | 'missing';

type FieldDef = {
  labelKey: string;
  value: string | null;
  level: ConfidenceLevel;
  basisKey: string;
  reference: string;
};

const confidenceConfig: Record<
  ConfidenceLevel,
  { labelKey: string; container: string; text: string; icon: string }
> = {
  high: {
    labelKey: 'aiExplanation.confidence.high',
    container: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    icon: 'ri-checkbox-circle-line text-emerald-500',
  },
  medium: {
    labelKey: 'aiExplanation.confidence.medium',
    container: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    icon: 'ri-error-warning-line text-amber-500',
  },
  low: {
    labelKey: 'aiExplanation.confidence.low',
    container: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    icon: 'ri-alert-line text-red-500',
  },
  missing: {
    labelKey: 'aiExplanation.confidence.missing',
    container: 'bg-gray-50 border-gray-200',
    text: 'text-gray-500',
    icon: 'ri-question-line text-gray-400',
  },
};

interface DraftAIExplanationPanelProps {
  draft: ExtractedDocumentDraft;
  onClose?: () => void;
}

function deriveConfidenceLevel(score?: number | null): ConfidenceLevel {
  if (score == null) return 'missing';
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function safeDraftReference(draftId: string, field: string): string {
  return `draft:${draftId.slice(0, 8)} field:${field}`;
}

function inferDocumentTypeFromFilename(filename?: string): string | null {
  if (!filename) return null;
  const lower = filename.toLowerCase();
  if (lower.includes('invoice') || lower.includes('發票')) return 'invoice';
  if (lower.includes('receipt') || lower.includes('收據')) return 'receipt';
  if (lower.includes('bill') || lower.includes('帳單')) return 'bill';
  if (lower.includes('contract') || lower.includes('合約')) return 'contract';
  if (lower.includes('report') || lower.includes('報告')) return 'report';
  return null;
}

function FieldRow({ field }: { field: FieldDef }) {
  const { t } = useTranslation();
  const cfg = confidenceConfig[field.level];

  return (
    <div className={`rounded-lg border p-3 ${cfg.container}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t(field.labelKey)}
        </p>
        <span className={`inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-xs font-medium ${cfg.text}`}>
          <i className={`${cfg.icon} text-xs`} />
          {t(cfg.labelKey)}
        </span>
      </div>
      <p className={`mt-1 text-sm font-medium ${field.value ? 'text-gray-900' : 'text-gray-400 italic'}`}>
        {field.value || t('aiExplanation.emptyValue')}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        {t(field.basisKey)}
      </p>
      <p className="mt-1 text-xs font-mono text-gray-400">
        <i className="ri-link-unlink-m mr-1 text-gray-300" />
        {t('aiExplanation.fieldReference')}: {field.reference}
      </p>
    </div>
  );
}

export default function DraftAIExplanationPanel({ draft, onClose }: DraftAIExplanationPanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  const confidenceLevel = deriveConfidenceLevel(draft.confidence_score);
  const confidenceLabel = t(confidenceConfig[confidenceLevel].labelKey);
  const candidateDocType = inferDocumentTypeFromFilename(draft.document?.original_filename);
  const candidateDocTypeLabel = candidateDocType
    ? t(`aiExplanation.docTypeCandidates.${candidateDocType}`)
    : null;

  const activityValue =
    draft.suggested_category || draft.suggested_scope
      ? t('aiExplanation.activityValue', {
          category: draft.suggested_category || t('aiExplanation.unknownCandidate'),
          scope: draft.suggested_scope ? `Scope ${draft.suggested_scope}` : t('aiExplanation.unknownCandidate'),
        })
      : null;

  const fields: FieldDef[] = [
    {
      labelKey: 'aiExplanation.fields.detectedDocType',
      value: candidateDocTypeLabel,
      level: candidateDocTypeLabel ? 'medium' : 'missing',
      basisKey: candidateDocTypeLabel
        ? 'aiExplanation.basis.detectedDocType'
        : 'aiExplanation.basis.detectedDocTypeMissing',
      reference: draft.document?.original_filename
        ? safeDraftReference(draft.id, 'document.original_filename')
        : safeDraftReference(draft.id, 'document.original_filename_missing'),
    },
    {
      labelKey: 'aiExplanation.fields.suggestedActivity',
      value: activityValue,
      level: activityValue ? confidenceLevel : 'missing',
      basisKey: activityValue
        ? 'aiExplanation.basis.suggestedActivity'
        : 'aiExplanation.basis.suggestedActivityMissing',
      reference: activityValue
        ? `${safeDraftReference(draft.id, 'suggested_category')}, ${safeDraftReference(draft.id, 'suggested_scope')}`
        : safeDraftReference(draft.id, 'candidate_activity_missing'),
    },
    {
      labelKey: 'aiExplanation.fields.suggestedScope',
      value: draft.suggested_scope ? `Scope ${draft.suggested_scope}` : null,
      level: draft.suggested_scope ? confidenceLevel : 'missing',
      basisKey: draft.suggested_scope
        ? 'aiExplanation.basis.suggestedScope'
        : 'aiExplanation.basis.suggestedScopeMissing',
      reference: draft.suggested_scope
        ? safeDraftReference(draft.id, 'suggested_scope')
        : safeDraftReference(draft.id, 'suggested_scope_missing'),
    },
    {
      labelKey: 'aiExplanation.fields.suggestedCategory',
      value: draft.suggested_category || null,
      level: draft.suggested_category ? confidenceLevel : 'missing',
      basisKey: draft.suggested_category
        ? 'aiExplanation.basis.suggestedCategory'
        : 'aiExplanation.basis.suggestedCategoryMissing',
      reference: draft.suggested_category
        ? safeDraftReference(draft.id, 'suggested_category')
        : safeDraftReference(draft.id, 'suggested_category_missing'),
    },
    {
      labelKey: 'aiExplanation.fields.extractionConfidence',
      value:
        draft.confidence_score != null
          ? `${(draft.confidence_score * 100).toFixed(0)}% (${confidenceLabel})`
          : null,
      level: confidenceLevel,
      basisKey: 'aiExplanation.basis.confidence',
      reference: safeDraftReference(draft.id, 'confidence_score'),
    },
  ];

  const missingFields = [
    draft.parsed_vendor ? null : t('aiExplanation.missing.vendor'),
    draft.parsed_quantity != null ? null : t('aiExplanation.missing.quantity'),
    draft.parsed_unit ? null : t('aiExplanation.missing.unit'),
    draft.suggested_scope ? null : t('aiExplanation.missing.scope'),
    draft.suggested_category ? null : t('aiExplanation.missing.category'),
    draft.suggested_activity_date ? null : t('aiExplanation.missing.activityDate'),
  ].filter((field): field is string => Boolean(field));

  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-amber-50">
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <i className="ri-robot-line text-base text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {t('aiExplanation.title')}
            </p>
            <p className="text-xs text-amber-700">
              {t('aiExplanation.subtitle')}
            </p>
          </div>
        </button>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="hidden rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 sm:inline-flex">
            {t('aiExplanation.levelBadge')}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(value => !value)}
            className="cursor-pointer text-gray-400 hover:text-gray-600"
            aria-label={t('aiExplanation.toggle')}
          >
            <i className={`text-sm ${expanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={event => {
                onClose();
              }}
              className="cursor-pointer text-gray-400 hover:text-gray-600"
              aria-label={t('common.close')}
            >
              <i className="ri-close-line text-base" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 px-4 pb-4">
          <div className="rounded-lg border border-amber-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              {t('aiExplanation.previewNoticeTitle')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              {t('aiExplanation.previewNoticeDesc')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
            {[
              'aiExplanation.trust.needsReview',
              'aiExplanation.trust.doesNotApprove',
              'aiExplanation.trust.noActivity',
              'aiExplanation.trust.noFactor',
              'aiExplanation.trust.notVerified',
              'aiExplanation.trust.notCompliance',
            ].map(key => (
              <span key={key} className="rounded border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-600">
                {t(key)}
              </span>
            ))}
          </div>

          <div className={`rounded-lg border p-3 ${confidenceConfig[confidenceLevel].container}`}>
            <p className={`text-xs font-semibold ${confidenceConfig[confidenceLevel].text}`}>
              {t('aiExplanation.overallConfidence')}: {confidenceLabel}
              {draft.confidence_score != null && (
                <span className="ml-1 font-normal">
                  ({(draft.confidence_score * 100).toFixed(0)}%)
                </span>
              )}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              {t('aiExplanation.confidenceDisclaimer')}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('aiExplanation.fieldBreakdownTitle')}
            </p>
            <div className="space-y-2">
              {fields.map(field => (
                <FieldRow key={field.labelKey} field={field} />
              ))}
            </div>
          </div>

          {missingFields.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-red-700">
                <i className="ri-error-warning-line" />
                {t('aiExplanation.missingDataTitle')} ({missingFields.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missingFields.map(field => (
                  <span key={field} className="rounded border border-red-200 bg-white px-2 py-0.5 text-xs text-red-600">
                    {field}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-red-500">
                {t('aiExplanation.missingDataHint')}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="text-xs font-semibold text-stone-700">
              {t('aiExplanation.reviewReminderTitle')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              {t('aiExplanation.reviewReminderDesc')}
            </p>
          </div>

          <p className="text-right text-xs text-gray-400">
            <i className="ri-information-line mr-1" />
            {t('aiExplanation.referenceNote', { draftId: draft.id.slice(0, 8) })}
          </p>
        </div>
      )}
    </div>
  );
}
