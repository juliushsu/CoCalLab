import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project, ProjectStatistics } from '../types/project.ts';
import { canonicalUuid, resolveNavigationScope } from './navigationScope.ts';

export interface ProjectSelection {projectId:string;organizationId?:string}
export interface ProjectOverview {project:Project;statistics:ProjectStatistics}
/** Keep tiny positive emissions visibly distinct from a true zero. */
export function formatProjectEmissionTonnes(value:number|null,locale='zh-TW',unknown='未知'):string {
 if(value===null||!Number.isFinite(value)||value<0)return unknown;
 if(value>0&&value<0.000001)return value.toExponential(4);
 return value.toLocaleString(locale,{maximumFractionDigits:6});
}
type Client = Pick<SupabaseClient,'from'>;
const record=(value:unknown):value is Record<string,unknown> => value!==null&&typeof value==='object'&&!Array.isArray(value);
const uuid=(value:unknown)=>{const id=canonicalUuid(value);if(!id)throw new Error('專案或組織識別資料無效。');return id;};
const nonnegative=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
function selection(value:ProjectSelection):ProjectSelection{return {projectId:uuid(value.projectId),...(value.organizationId!==undefined?{organizationId:uuid(value.organizationId)}:{})};}
export function projectOverviewSelection(projectId:string|undefined,search:string):ProjectSelection{
 const id=uuid(projectId),scope=resolveNavigationScope('/admin/projects/'+id,search);
 if(scope.kind==='invalid')throw new Error('組織／專案範圍不明確，請重新選擇。');
 return {projectId:id,...('organizationId' in scope&&scope.organizationId?{organizationId:scope.organizationId}:{})};
}
function scoped(row:unknown,selected:Required<ProjectSelection>):Record<string,unknown>{
 if(!record(row)||uuid(row.organization_id)!==selected.organizationId||uuid(row.project_id)!==selected.projectId)throw new Error('統計資料與目前專案／組織不符。');
 return row;
}
async function countRows(client:Client,table:string,selected:Required<ProjectSelection>,completed=false):Promise<number>{
 let query=client.from(table).select('id',{count:'exact',head:true}).eq('organization_id',selected.organizationId).eq('project_id',selected.projectId);
 if(completed)query=query.eq('status','completed');
 const {count,error}=await query;
 if(error||!Number.isSafeInteger(count)||Number(count)<0)throw new Error('專案統計讀取失敗，請重試或確認存取權限。',{cause:error});
 return Number(count);
}
/** Read all visible rows; never silently turn PostgREST's response cap into a complete total. */
async function allRows(client:Client,table:string,columns:string,selected:Required<ProjectSelection>,latest=false):Promise<Record<string,unknown>[]>{
 const rows:Record<string,unknown>[]=[],seen=new Set<string>();let expected:number|undefined;
 for(let page=0;page<100;page++){
  let query=client.from(table).select(columns,{count:'exact'}).eq('organization_id',selected.organizationId).eq('project_id',selected.projectId).order('id').range(rows.length,rows.length+499);
  if(latest)query=query.eq('is_latest',true);
  const {data,error,count}=await query;
  if(error||!Array.isArray(data)||!Number.isSafeInteger(count)||Number(count)<0)throw new Error('專案統計讀取失敗，請重試或確認存取權限。',{cause:error});
  if(expected!==undefined&&expected!==count)throw new Error('統計資料在讀取期間變動，請重新讀取。');
  expected=Number(count);
  for(const value of data){const row=scoped(value,selected),id=uuid(row.id);if(seen.has(id))throw new Error('統計資料重複或在讀取期間變動，請重新讀取。');seen.add(id);rows.push(row);}
  if(rows.length===expected)return rows;
  if(rows.length>expected||data.length===0)throw new Error('統計資料不完整，請重新讀取。');
 }
 throw new Error('統計資料超出本次完整讀取範圍，請聯絡管理員。');
}
export function summarizeProjectStatistics(activities:Record<string,unknown>[],calculations:Record<string,unknown>[],documents:number,reports:number):ProjectStatistics{
 const ids=new Set<string>(),included=new Set<string>();let active=0;
 for(const row of activities){
  const id=uuid(row.id);if(ids.has(id)||!['active','voided','archived'].includes(String(row.status))||!['included','excluded','pending'].includes(String(row.inclusion_status)))throw new Error('活動統計資料無效。');
  ids.add(id);if(row.status==='active'){active++;if(row.inclusion_status==='included')included.add(id);}
 }
 const current=new Map<string,Record<string,unknown>>();
 for(const row of calculations){
  const activityId=uuid(row.emission_activity_id);
  if(!ids.has(activityId)||current.has(activityId)||row.is_latest!==true||!['calculated','pending_factor','error','superseded'].includes(String(row.status)))throw new Error('最新計算統計無效或資料已變動，請重新讀取。');
  current.set(activityId,row);
 }
 let kg=0,calculated=0;
 for(const id of included){const row=current.get(id);if(row?.status==='calculated'&&nonnegative(row.co2e_kg)){kg+=row.co2e_kg;calculated++;}}
 const complete=included.size>0&&calculated===included.size;
 if(!Number.isFinite(kg))throw new Error('排放統計超出可顯示的數值範圍。');
 return {total_documents:documents,total_activities:activities.length,active_activities:active,included_activities:included.size,calculated_activities:calculated,
 total_emissions_kg:complete?kg:null,total_emissions:complete?kg/1000:null,
 inclusion_rate:active>0?Math.round(included.size/active*100):null,calculation_completed:complete,report_generated:reports>0};
}
/** User-JWT/RLS client only. A visible project anchors every subsequent tenant/project read. */
export async function readProjectOverview(client:Client,input:ProjectSelection):Promise<ProjectOverview|null>{
 const selected=selection(input);
 let query=client.from('projects').select('*,organization:organizations(display_name)').eq('id',selected.projectId);
 if(selected.organizationId)query=query.eq('organization_id',selected.organizationId);
 const {data,error}=await query.maybeSingle();
 if(error)throw new Error('專案讀取失敗，請重試或確認存取權限。',{cause:error});
 if(data===null)return null;
 if(!record(data)||uuid(data.id)!==selected.projectId||!canonicalUuid(data.organization_id)||
 (selected.organizationId&&uuid(data.organization_id)!==selected.organizationId)||typeof data.name!=='string'||!data.name)throw new Error('專案資料與目前範圍不符。');
 const bound={projectId:selected.projectId,organizationId:uuid(data.organization_id)};
 const project={...data,id:bound.projectId,organization_id:bound.organizationId,
 organization_name:record(data.organization)&&typeof data.organization.display_name==='string'?data.organization.display_name:undefined,
 code:data.project_code,start_date:data.reporting_start_date,end_date:data.reporting_end_date} as unknown as Project;
 const documents=await countRows(client,'uploaded_documents',bound);
 const activities=await allRows(client,'emission_activities','id,organization_id,project_id,status,inclusion_status',bound);
 const calculations=await allRows(client,'calculation_results','id,organization_id,project_id,emission_activity_id,is_latest,status,co2e_kg',bound,true);
 const reports=await countRows(client,'report_generations',bound,true);
 return {project,statistics:summarizeProjectStatistics(activities,calculations,documents,reports)};
}
/** Object identity makes stale project/session/URL/retry state unavailable before effects run. */
export function matchingProjectOverviewState<T,K extends object>(state:{key:K;value:T}|null,key:K):T|null{return state?.key===key?state.value:null;}

