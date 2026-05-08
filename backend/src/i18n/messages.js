export const MESSAGES = {
  unit_not_supported: {
    zh_tw: '單位不支援，請人工確認',
    en: 'Unsupported unit, manual review required',
    ja: '未対応の単位のため、手動確認が必要です',
  },
  factor_not_found: {
    zh_tw: '找不到對應排放因子，已標記為 pending',
    en: 'No matching emission factor found; marked as pending',
    ja: '適合する排出係数が見つからないため、pending として処理しました',
  },
  activity_excluded: {
    zh_tw: '此活動已排除於計算範圍',
    en: 'This activity is excluded from calculation',
    ja: 'この活動は計算対象外です',
  },
  subscription_readonly: {
    zh_tw: '訂閱狀態為唯讀，禁止新增或修改正式資料',
    en: 'Subscription is readonly; formal data write is blocked',
    ja: 'サブスクリプションが読み取り専用のため、正式データの書き込みは禁止されています',
  },
  subscription_suspended: {
    zh_tw: '訂閱已停用，僅允許最小存取',
    en: 'Subscription is suspended; minimal access only',
    ja: 'サブスクリプション停止中のため、最小限のアクセスのみ許可されます',
  },
  report_has_pending_items: {
    zh_tw: '報告含有 pending 項目，請先補齊資料',
    en: 'Report includes pending items; complete data before final use',
    ja: 'レポートに pending 項目があります。正式利用前にデータを補完してください',
  },
  ai_summary_placeholder: {
    zh_tw: 'AI 健檢摘要待產生',
    en: 'AI audit summary pending',
    ja: 'AI 監査サマリーは未生成です',
  },
};

export function t(messageKey) {
  const value = MESSAGES[messageKey];
  if (!value) {
    throw new Error(`Missing i18n key: ${messageKey}`);
  }
  return value;
}
