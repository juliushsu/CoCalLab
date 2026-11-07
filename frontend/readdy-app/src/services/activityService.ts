import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import type { EmissionActivity } from '../types/activity';
import { readActivityDetail, type ActivityDetailSelection } from './activityDetail';

/** Real read-only detail. Configuration/query failures are not an empty record. */
export async function getEmissionActivityDetail(selection: ActivityDetailSelection) {
  if (!isSupabaseConnected()) throw new Error('活動資料服務尚未設定，無法讀取。');
  return readActivityDetail(getSupabaseClient(), selection);
}

/**
 * 取得排放活動列表
 * 對齊 DB schema emission_activities
 */
export async function getEmissionActivities(projectId?: string): Promise<EmissionActivity[]> {
  if (!isSupabaseConnected()) {
    throw new Error('活動資料服務尚未設定，無法讀取。');
  }

  const supabase = getSupabaseClient();

  let query = supabase
    .from('effective_emission_activities')
    .select('*, project:projects(name)')
    .order('activity_date', { ascending: false });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch emission activities:', error);
    throw error;
  }

  return (data || []).map((item: any) => ({
    ...item,
    project_name: item.project?.name,
  })) as EmissionActivity[];
}
