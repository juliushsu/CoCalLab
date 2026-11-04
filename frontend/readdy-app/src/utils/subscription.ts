import type { ApiMeta } from '../services/types.ts';

/**
 * 訂閱狀態類型
 */
export type SubscriptionStatus = 'active' | 'grace_period' | 'readonly' | 'suspended' | 'expired';

/**
 * 檢查是否為唯讀狀態
 */
export function isReadonly(status?: SubscriptionStatus | string): boolean {
  if (!status) return false;
  return ['readonly', 'suspended', 'expired'].includes(status);
}

/**
 * 檢查是否為活躍狀態
 */
export function isActive(status?: SubscriptionStatus | string): boolean {
  return status === 'active';
}

/**
 * 從 API Meta 取得訂閱狀態
 */
export function getSubscriptionStatus(meta?: ApiMeta): SubscriptionStatus {
  return meta?.status || 'active';
}

/**
 * 從 API Meta 取得唯讀原因
 */
export function getReadonlyReason(meta?: ApiMeta): string | undefined {
  return meta?.reason;
}

/**
 * 取得狀態顯示文字
 */
export function getStatusLabel(status: SubscriptionStatus): string {
  const labels: Record<SubscriptionStatus, string> = {
    active: '正常',
    grace_period: '寬限期',
    readonly: '唯讀',
    suspended: '已暫停',
    expired: '已過期',
  };
  return labels[status] || status;
}

/**
 * 取得狀態顏色
 */
export function getStatusColor(status: SubscriptionStatus): string {
  const colors: Record<SubscriptionStatus, string> = {
    active: 'green',
    grace_period: 'yellow',
    readonly: 'yellow',
    suspended: 'orange',
    expired: 'red',
  };
  return colors[status] || 'gray';
}
/** Strict network contract: absent/unknown status must not imply active. */
export function verifiedSubscriptionStatus(meta?: ApiMeta): SubscriptionStatus {
  if (!meta || typeof meta.status !== 'string' || !['active','grace_period','readonly','suspended','expired'].includes(meta.status)) throw new Error('無法確認訂閱狀態');
  return meta.status!;
}
