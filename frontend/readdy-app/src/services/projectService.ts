import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import type { Project, ProjectStatistics, CreateProjectInput } from '../types/project';
import { IS_STAGING } from '../utils/staging';

/**
 * 取得所有專案列表
 * 對齊 DB schema: project_code, reporting_start_date, reporting_end_date
 */
export async function getProjects(): Promise<Project[]> {
  if (!isSupabaseConnected()) {
    console.warn('Supabase not connected, returning empty array');
    return [];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*, organization:organizations(display_name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch projects:', error);
    throw error;
  }

  return (data || []).map((item: any) => ({
    ...item,
    organization_name: item.organization?.display_name,
    // 前端相容別名
    code: item.project_code,
    start_date: item.reporting_start_date,
    end_date: item.reporting_end_date,
  })) as Project[];
}

/**
 * 根據 ID 取得單一專案
 */
export async function getProjectById(id: string): Promise<Project | null> {
  if (!isSupabaseConnected()) {
    console.warn('Supabase not connected');
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*, organization:organizations(display_name)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch project:', error);
    throw error;
  }

  if (!data) return null;

  return {
    ...data,
    organization_name: (data as any).organization?.display_name,
    code: data.project_code,
    start_date: data.reporting_start_date,
    end_date: data.reporting_end_date,
  } as Project;
}

/**
 * 取得專案統計資訊
 * inclusion_status DB enum 值為 'included'（非 'include'）
 */
export async function getProjectStatistics(projectId: string): Promise<ProjectStatistics> {
  if (!isSupabaseConnected()) {
    console.warn('Supabase not connected');
    return {
      total_documents: 0,
      total_activities: 0,
      total_emissions: 0,
      completion_rate: 0,
      documents_uploaded: 0,
      activities_confirmed: 0,
      calculation_completed: false,
      report_generated: false,
    };
  }

  const supabase = getSupabaseClient();

  const [
    { count: documentCount },
    { count: activityCount },
    { count: confirmedActivityCount },
    { data: emissionsData },
    { count: calculationCount },
    { count: reportCount },
  ] = await Promise.all([
    supabase
      .from('uploaded_documents')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId),
    supabase
      .from('emission_activities')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId),
    supabase
      .from('emission_activities')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('inclusion_status', 'included'),   // DB enum 值是 'included'
    supabase
      .from('calculation_results')
      .select('co2e_total')
      .eq('project_id', projectId),
    supabase
      .from('calculation_results')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId),
    supabase
      .from('report_generations')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId),
  ]);

  const totalEmissions =
    (emissionsData as any[] | null)?.reduce(
      (sum: number, item: any) => sum + (item.co2e_total || 0),
      0
    ) || 0;

  const completionRate =
    activityCount && activityCount > 0
      ? Math.round(((confirmedActivityCount || 0) / activityCount) * 100)
      : 0;

  return {
    total_documents: documentCount || 0,
    total_activities: activityCount || 0,
    total_emissions: totalEmissions,
    completion_rate: completionRate,
    documents_uploaded: documentCount || 0,
    activities_confirmed: confirmedActivityCount || 0,
    calculation_completed: (calculationCount || 0) > 0,
    report_generated: (reportCount || 0) > 0,
  };
}

/**
 * 建立新專案
 * 對齊 DB schema 必填欄位：project_code / reporting_start_date / reporting_end_date /
 *   boundary_type / base_currency / is_test / env
 */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  if (!isSupabaseConnected()) {
    throw new Error('Supabase not connected');
  }

  const supabase = getSupabaseClient();

  const insertPayload = {
    organization_id: input.organization_id,
    project_code: input.project_code || '',
    name: input.name,
    description: input.description || null,
    reporting_start_date: input.reporting_start_date,
    reporting_end_date: input.reporting_end_date,
    boundary_type: input.boundary_type || 'operational_control',
    status: input.status || 'draft',
    base_currency: input.base_currency || 'TWD',
    is_test: IS_STAGING,
    env: IS_STAGING ? 'staging' : 'production',
  };

  const { data, error } = await supabase
    .from('projects')
    .insert(insertPayload)
    .select('*, organization:organizations(display_name)')
    .maybeSingle();

  if (error) {
    console.error('Failed to create project:', error);
    throw error;
  }

  if (!data) {
    throw new Error('No data returned after insert');
  }

  return {
    ...data,
    organization_name: (data as any).organization?.display_name,
    code: data.project_code,
    start_date: data.reporting_start_date,
    end_date: data.reporting_end_date,
  } as Project;
}
