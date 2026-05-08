import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import type { EmissionActivity } from '../types/activity';

/**
 * 取得排放活動列表
 * 對齊 DB schema emission_activities
 */
export async function getEmissionActivities(projectId?: string): Promise<EmissionActivity[]> {
  if (!isSupabaseConnected()) {
    console.warn('Supabase not connected, returning empty array');
    return [];
  }

  const supabase = getSupabaseClient();

  let query = supabase
    .from('emission_activities')
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
