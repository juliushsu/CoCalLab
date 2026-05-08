function byCo2Desc(a, b) {
  return Number(b.co2e_kg || 0) - Number(a.co2e_kg || 0);
}

function localizeSummary(stats) {
  const { included, pending, excluded, topCategory, totalCo2e } = stats;

  return {
    zh_tw: `本次健檢共納入 ${included} 筆活動，排除 ${excluded} 筆，待確認 ${pending} 筆。主要排放來源為 ${topCategory}，總排放 ${totalCo2e.toFixed(2)} kgCO2e。`,
    en: `This audit includes ${included} activities, excludes ${excluded}, and leaves ${pending} pending. The main hotspot is ${topCategory}, with total emissions of ${totalCo2e.toFixed(2)} kgCO2e.`,
    ja: `今回の監査では、算入 ${included} 件、除外 ${excluded} 件、保留 ${pending} 件です。主なホットスポットは ${topCategory} で、総排出量は ${totalCo2e.toFixed(2)} kgCO2e です。`,
  };
}

export function run_ai_audit({ report_payload, model_info = {} }) {
  const included = report_payload.included_activities_summary || [];
  const excluded = report_payload.excluded_items_summary || [];
  const pendingCount = report_payload.boundary_summary?.pending_count || 0;

  const totalCo2e = included.reduce((sum, row) => sum + Number(row.co2e_kg || 0), 0);

  const categoryTotals = report_payload.category_totals || {};
  const topCategory = Object.entries(categoryTotals)
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || 'n/a';

  const completeness_flags = [];
  if (pendingCount > 0) {
    completeness_flags.push({
      code: 'PENDING_ITEMS_EXISTS',
      severity: 'high',
      count: pendingCount,
    });
  }

  const anomaly_flags = [];
  for (const activity of included) {
    if (Number(activity.co2e_kg || 0) > 10000) {
      anomaly_flags.push({
        code: 'HIGH_SINGLE_ACTIVITY',
        severity: 'medium',
        emission_activity_id: activity.emission_activity_id,
        co2e_kg: Number(activity.co2e_kg || 0),
      });
    }
  }

  const exclusion_review_flags = excluded
    .filter((item) => !item.exclusion_reason)
    .map((item) => ({
      code: 'MISSING_EXCLUSION_REASON',
      severity: 'medium',
      emission_activity_id: item.emission_activity_id,
    }));

  const hotspot_ranking = [...included]
    .sort(byCo2Desc)
    .slice(0, 5)
    .map((item, index) => ({
      rank: index + 1,
      emission_activity_id: item.emission_activity_id,
      category: item.category,
      co2e_kg: Number(item.co2e_kg || 0),
    }));

  const recommended_actions = [];
  if (pendingCount > 0) {
    recommended_actions.push({
      action_id: 'complete-pending-activities',
      priority: 'high',
      description: {
        zh_tw: '請優先完成 pending 活動的人工確認與因子補齊。',
        en: 'Prioritize manual confirmation and factor completion for pending activities.',
        ja: 'pending 活動の手動確認と係数補完を優先してください。',
      },
    });
  }

  if (hotspot_ranking.length > 0) {
    recommended_actions.push({
      action_id: 'mitigate-top-hotspot',
      priority: 'medium',
      description: {
        zh_tw: '針對前 1-3 名 hotspot 類別規劃減量行動。',
        en: 'Plan reduction actions for the top 1-3 hotspot categories.',
        ja: '上位 1-3 位のホットスポットカテゴリに対して削減施策を策定してください。',
      },
    });
  }

  return {
    status: 'completed',
    model_provider: model_info.model_provider || 'rule-engine',
    model_name: model_info.model_name || 'heuristic-audit',
    model_version: model_info.model_version || 'v1',
    completeness_flags,
    anomaly_flags,
    exclusion_review_flags,
    hotspot_ranking,
    summary_text: localizeSummary({
      included: included.length,
      excluded: excluded.length,
      pending: pendingCount,
      topCategory,
      totalCo2e,
    }),
    recommended_actions,
    confidence_score: 0.72,
    token_usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}
