import { readProjectOverview, type ProjectSelection } from './projectStatistics';
import { projectUpdatePayload, requireUpdatedRow } from './entityUpdateContract';
import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import type { Project, ProjectStatistics, CreateProjectInput, UpdateProjectInput } from '../types/project';
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

/** Exact read-only project + statistics; configuration failures are never empty success. */
export async function getProjectOverview(selected:ProjectSelection) {
  if (!isSupabaseConnected()) throw new Error('專案資料服務尚未設定。');
  return readProjectOverview(getSupabaseClient(),selected);
}
export async function getProjectStatistics(projectId:string, organizationId?:string):Promise<ProjectStatistics> {
  const result=await getProjectOverview({projectId,organizationId});
  if (!result) throw new Error('找不到可存取的專案。');
  return result.statistics;
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

/** The original tenant is an UPDATE filter, never an editable assignment. */
export async function updateProject(input: UpdateProjectInput): Promise<Project> {
  const payload = projectUpdatePayload(input);
  if (!isSupabaseConnected()) throw new Error('Supabase not connected');
  const result = await getSupabaseClient().from('projects')
    .update(payload).eq('id', input.id).eq('organization_id', input.organization_id)
    .select('*, organization:organizations(display_name)').single();
  const data = requireUpdatedRow(result);
  return {
    ...data,
    organization_name: (data as { organization?: { display_name?: string } }).organization?.display_name,
    code: data.project_code,
    start_date: data.reporting_start_date,
    end_date: data.reporting_end_date,
  } as Project;
}
