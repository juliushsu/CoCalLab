import type { SupabaseClient } from '@supabase/supabase-js';
import { canonicalUuid, resolveNavigationScope } from './navigationScope.ts';
import {readActivityLineage,type ActivityLineage,type ActivityVersion} from './activityLineage.ts';

export interface ActivityDetailSelection {
  activityId: string;
  organizationId?: string;
  projectId?: string;
}
export interface ActivityDetailRecord {
  id: string;
  organization_id: string;
  project_id: string;
  project_name: string | null;
  activity_code: string;
  activity_name: string;
  activity_date: string;
  category: string;
  subcategory: string | null;
  activity_type: string;
  quantity: number;
  unit: string;
  normalized_quantity: number | null;
  normalized_unit: string | null;
  status: 'active' | 'voided' | 'archived';
  inclusion_status: 'included' | 'excluded' | 'pending';
  final_scope: 1 | 2 | 3 | null;
  suggested_scope: 1 | 2 | 3 | null;
  source_document_id: string | null;
  source_draft_id: string | null;
  exclusion_reason: string | null;
  review_note: string | null;
  data_quality: string | null;
  created_at: string | null;
  updated_at: string | null;
}
export interface ActivityDetailCalculation {
  id: string;
  status: 'calculated' | 'pending_factor' | 'error' | 'superseded';
  calc_version: number;
  co2e_kg: number | null;
  co2e_tonnes: number | null;
  calculated_at: string | null;
  formula_version: string | null;
  factor_snapshot: Record<string, unknown>;
  input_snapshot: Record<string, unknown>;
  warnings: unknown[];
  error_code: string | null;
}
export interface ActivityDetail {
  activity: ActivityDetailRecord;
  calculation: ActivityDetailCalculation | null;
  historicalCalculation?:ActivityDetailCalculation|null;
  lineage?:ActivityLineage;
  version?:ActivityVersion;
}
export const ACTIVITY_DETAIL_COLUMNS = [
  'id','organization_id','project_id','activity_code','activity_name','activity_date',
  'category','subcategory','activity_type','quantity','unit','normalized_quantity',
  'normalized_unit','status','inclusion_status','final_scope','suggested_scope',
  'source_document_id','source_draft_id','exclusion_reason','review_note','data_quality',
  'created_at','updated_at','project:projects(id,organization_id,name)',
].join(',');
export const ACTIVITY_CALCULATION_COLUMNS = [
  'id','organization_id','project_id','emission_activity_id','is_latest','status',
  'calc_version','co2e_kg','calculated_at','formula_version','factor_snapshot',
  'input_snapshot','warnings','error_code',
].join(',');
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const optionalText = (value: unknown): string | null => typeof value === 'string' && value ? value : null;
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function uuid(value: unknown): string {
  const result = canonicalUuid(value);
  if (!result) throw new Error('活動或組織／專案識別資料無效。');
  return result;
}
function scope(value: unknown): 1 | 2 | 3 | null {
  if (value == null) return null;
  if (value === 1 || value === 2 || value === 3) return value;
  throw new Error('活動範疇資料無效。');
}
/** Canonical and legacy URL aliases may agree, but never silently override each other. */
export function activityDetailSelection(activityId: string | undefined, search: string): ActivityDetailSelection {
  const id = uuid(activityId);
  const selected = resolveNavigationScope(`/admin/activities/${id}`, search);
  if (selected.kind === 'invalid') throw new Error('組織／專案範圍不明確，請重新選擇。');
  return {activityId:id,
    ...('organizationId' in selected && selected.organizationId ? {organizationId:selected.organizationId} : {}),
    ...('projectId' in selected && selected.projectId ? {projectId:selected.projectId} : {}),
  };
}
function normalizeSelection(value: ActivityDetailSelection): ActivityDetailSelection {
  return {activityId:uuid(value.activityId),
    ...(value.organizationId !== undefined ? {organizationId:uuid(value.organizationId)} : {}),
    ...(value.projectId !== undefined ? {projectId:uuid(value.projectId)} : {}),
  };
}
/** Scope validation is defense in depth; it never replaces database RLS. */
export function adaptActivityDetail(row: unknown, calculation: unknown, expected: ActivityDetailSelection): ActivityDetail {
  const selected = normalizeSelection(expected);
  if (!record(row) || uuid(row.id) !== selected.activityId ||
      (selected.organizationId && uuid(row.organization_id) !== selected.organizationId) ||
      (selected.projectId && uuid(row.project_id) !== selected.projectId)) throw new Error('活動資料與目前選取範圍不符。');
  const organizationId = uuid(row.organization_id);
  const projectId = uuid(row.project_id);
  if (!['active','voided','archived'].includes(String(row.status)) ||
      !['included','excluded','pending'].includes(String(row.inclusion_status)) ||
      !nonnegative(row.quantity) || !optionalText(row.unit) || !optionalText(row.activity_name) ||
      !optionalText(row.activity_date) || !optionalText(row.activity_code) ||
      !optionalText(row.category) || !optionalText(row.activity_type)) throw new Error('活動資料缺少有效欄位。');
  let projectName: string | null = null;
  if (row.project != null) {
    if (!record(row.project) || uuid(row.project.id) !== projectId || uuid(row.project.organization_id) !== organizationId) {
      throw new Error('專案資料與活動範圍不符。');
    }
    projectName = optionalText(row.project.name);
  }
  const activity: ActivityDetailRecord = {
    id:selected.activityId,organization_id:organizationId,project_id:projectId,project_name:projectName,
    activity_code:String(row.activity_code),activity_name:String(row.activity_name),activity_date:String(row.activity_date),
    category:String(row.category),subcategory:optionalText(row.subcategory),activity_type:String(row.activity_type),
    quantity:row.quantity,unit:String(row.unit),normalized_quantity:nonnegative(row.normalized_quantity) ? row.normalized_quantity : null,
    normalized_unit:optionalText(row.normalized_unit),status:row.status as ActivityDetailRecord['status'],
    inclusion_status:row.inclusion_status as ActivityDetailRecord['inclusion_status'],
    final_scope:scope(row.final_scope),suggested_scope:scope(row.suggested_scope),
    source_document_id:row.source_document_id == null ? null : uuid(row.source_document_id),
    source_draft_id:row.source_draft_id == null ? null : uuid(row.source_draft_id),
    exclusion_reason:optionalText(row.exclusion_reason),review_note:optionalText(row.review_note),data_quality:optionalText(row.data_quality),
    created_at:optionalText(row.created_at),updated_at:optionalText(row.updated_at),
  };
  if (calculation == null) return {activity,calculation:null};
  if (!record(calculation) || uuid(calculation.emission_activity_id) !== activity.id ||
      uuid(calculation.organization_id) !== organizationId || uuid(calculation.project_id) !== projectId ||
      calculation.is_latest !== true || !['calculated','pending_factor','error','superseded'].includes(String(calculation.status)) ||
      !Number.isInteger(calculation.calc_version) || Number(calculation.calc_version) < 1 ||
      !record(calculation.factor_snapshot) || !record(calculation.input_snapshot) || !Array.isArray(calculation.warnings)) {
    throw new Error('最新計算快照無效或與活動範圍不符。');
  }
  const kg = calculation.status === 'calculated' && nonnegative(calculation.co2e_kg) ? calculation.co2e_kg : null;
  return {activity,calculation:{
    id:uuid(calculation.id),status:calculation.status as ActivityDetailCalculation['status'],calc_version:Number(calculation.calc_version),
    co2e_kg:kg,co2e_tonnes:kg === null ? null : kg / 1000,calculated_at:optionalText(calculation.calculated_at),
    formula_version:optionalText(calculation.formula_version),factor_snapshot:calculation.factor_snapshot,input_snapshot:calculation.input_snapshot,
    warnings:calculation.warnings,error_code:optionalText(calculation.error_code),
  }};
}
/** Actual user-client read; injectable only so SDK serialization can be tested offline. */
export async function readActivityDetail(client: Pick<SupabaseClient, 'from'|'rpc'>, selection: ActivityDetailSelection): Promise<ActivityDetail | null> {
  const selected = normalizeSelection(selection);
  let query = client.from('emission_activities').select(ACTIVITY_DETAIL_COLUMNS).eq('id',selected.activityId);
  if (selected.organizationId) query = query.eq('organization_id',selected.organizationId);
  if (selected.projectId) query = query.eq('project_id',selected.projectId);
  const {data,error} = await query.maybeSingle();
  if (error) throw new Error('活動資料讀取失敗，請重試或確認存取權限。', {cause:error});
  if (data === null) return null;
  const {activity} = adaptActivityDetail(data,null,selected);
  const lineage=await readActivityLineage(client,{organizationId:activity.organization_id,projectId:activity.project_id},activity.id),version=lineage.versions.find(row=>row.activity_id===activity.id)!;
  // Retired rows remain readable, but their preserved calc is explicitly historical.
  const result = await client.from(version.is_effective?'effective_calculation_results':'calculation_results').select(ACTIVITY_CALCULATION_COLUMNS)
    .eq('emission_activity_id',activity.id).eq('organization_id',activity.organization_id)
    .eq('project_id',activity.project_id).eq('is_latest',true).maybeSingle();
  if (result.error) throw new Error('最新計算快照讀取失敗，請重試或確認存取權限。', {cause:result.error});
  const adapted=adaptActivityDetail(data,result.data,selected);
  return {...adapted,lineage,version,calculation:version.is_effective?adapted.calculation:null,historicalCalculation:version.is_effective?null:adapted.calculation};
}
/** Binding by request-context object blocks a previous activity/tenant/session frame. */
export function matchingActivityDetailState<T, K extends object>(state: {key: K;value: T} | null, key: K): T | null {
  return state?.key === key ? state.value : null;
}
export function formatActivityEmissions(kg: number | null | undefined,inclusionStatus?:string,calculationStatus?:string): string {
  if(inclusionStatus==='excluded'||calculationStatus==='superseded')return '已排除／不計入';
  return nonnegative(kg) ? `${kg} kgCO₂e / ${kg / 1000} tCO₂e` : '未知（沒有最新有效計算結果）';
}
