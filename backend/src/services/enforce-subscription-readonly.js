import { t } from '../i18n/messages.js';
import { validateSubscriptionStatus } from '../contracts/contracts.js';

function pickLatest(subscriptions) {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return null;
  }

  return [...subscriptions].sort((a, b) => {
    const aEnd = new Date(a.period_end).getTime();
    const bEnd = new Date(b.period_end).getTime();
    return bEnd - aEnd;
  })[0];
}

export function enforce_subscription_readonly({ organization_id, subscriptions, as_of = new Date().toISOString() }) {
  const target = pickLatest(subscriptions);

  if (!target) {
    return {
      organization_id,
      effective_status: 'readonly',
      can_write_formal_data: false,
      can_generate_report: false,
      reason: t('subscription_readonly'),
    };
  }

  validateSubscriptionStatus(target.status);

  const now = new Date(as_of).getTime();
  const periodEnd = new Date(target.period_end).getTime();
  const graceUntil = target.grace_until ? new Date(target.grace_until).getTime() : null;

  let effective_status = target.status;

  if (target.status === 'active' && now > periodEnd) {
    if (graceUntil && now <= graceUntil) {
      effective_status = 'grace_period';
    } else {
      effective_status = 'readonly';
    }
  }

  if (target.status === 'grace_period' && graceUntil && now > graceUntil) {
    effective_status = 'readonly';
  }

  if (target.status === 'canceled') {
    effective_status = 'readonly';
  }

  if (target.status === 'suspended') {
    effective_status = 'suspended';
  }

  if (effective_status === 'active' || effective_status === 'grace_period') {
    return {
      organization_id,
      effective_status,
      can_write_formal_data: true,
      can_generate_report: true,
      reason: null,
    };
  }

  if (effective_status === 'suspended') {
    return {
      organization_id,
      effective_status,
      can_write_formal_data: false,
      can_generate_report: false,
      reason: t('subscription_suspended'),
    };
  }

  return {
    organization_id,
    effective_status: 'readonly',
    can_write_formal_data: false,
    can_generate_report: false,
    reason: t('subscription_readonly'),
  };
}
