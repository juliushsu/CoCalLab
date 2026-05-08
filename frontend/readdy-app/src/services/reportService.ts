import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import type { ReportVersion, ReportStatistics } from '../types/report';

/**
 * 取得報告資料
 * 注意：report_sections 表目前不存在，sections 回傳空陣列
 * statistics 由 report_generations 的 scope_totals / category_totals 欄位提供
 */
export async function getReportData(reportId: string) {
  if (!isSupabaseConnected()) {
    console.warn('Supabase not connected, returning empty data structure');
    return { report: null, sections: [], statistics: null };
  }

  const supabase = getSupabaseClient();

  try {
    const { data: reportData, error: reportError } = await supabase
      .from('report_generations')
      .select('*, project:projects(name)')
      .eq('id', reportId)
      .maybeSingle();

    if (reportError) {
      console.error('Failed to fetch report:', reportError);
      return { report: null, sections: [], statistics: null };
    }

    if (!reportData) {
      return { report: null, sections: [], statistics: null };
    }

    // 將 DB 欄位對應到前端 ReportVersion type
    const report: ReportVersion = {
      id: reportData.id,
      project_id: reportData.project_id,
      project_name: (reportData as any).project?.name || '',
      version_number: reportData.report_version,
      report_status: reportData.status as ReportVersion['report_status'],
      generated_by: reportData.generated_by_user_id || 'system',
      generated_at: reportData.created_at,
      completed_at: reportData.status === 'completed' ? reportData.updated_at : undefined,
      error_message: reportData.error_message,
      // report_sections 表尚未建立，暫用固定值
      total_sections: 10,
      completed_sections: reportData.status === 'completed' ? 10 : 0,
      created_at: reportData.created_at,
      updated_at: reportData.updated_at,
    };

    // 從 scope_totals 建構 statistics
    const scopeTotals = (reportData.scope_totals as Record<string, number>) || {};
    const statistics: ReportStatistics | null =
      Object.keys(scopeTotals).length > 0
        ? {
            total_emissions:
              (scopeTotals['scope_1'] || 0) +
              (scopeTotals['scope_2'] || 0) +
              (scopeTotals['scope_3'] || 0),
            scope1_emissions: scopeTotals['scope_1'] || 0,
            scope2_emissions: scopeTotals['scope_2'] || 0,
            scope3_emissions: scopeTotals['scope_3'] || 0,
            total_activities:
              (reportData.included_activity_count || 0) +
              (reportData.excluded_activity_count || 0) +
              (reportData.pending_activity_count || 0),
            included_activities: reportData.included_activity_count || 0,
            excluded_activities: reportData.excluded_activity_count || 0,
            verified_activities: 0,
            emission_by_category: Object.entries(
              (reportData.category_totals as Record<string, number>) || {}
            ).map(([category, emissions]) => ({
              category,
              emissions: emissions as number,
              percentage: 0,
            })),
          }
        : null;

    return { report, sections: [], statistics };
  } catch (err) {
    console.error('Unexpected error in getReportData:', err);
    return { report: null, sections: [], statistics: null };
  }
}
