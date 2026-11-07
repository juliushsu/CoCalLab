import type {SupabaseClient} from '@supabase/supabase-js';
import type {IntakeScope} from './documentIntake.ts';
import {canonicalUuid} from './navigationScope.ts';
export interface ActivityVersion {activity_id:string;predecessor_activity_id:string|null;successor_activity_id:string|null;version_index:number;is_effective:boolean;mode:'original'|'correct'|'exclude';reason:string|null;actor_user_id:string|null;created_at:string|null}
export interface ActivityLineage {organization_id:string;project_id:string;activity_id:string;versions:ActivityVersion[]}
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const uuid=(value:unknown)=>{const result=canonicalUuid(value);if(!result)throw new Error('活動版本識別無效。');return result;};
const nullableUuid=(value:unknown)=>value===null?null:uuid(value);
export function adaptActivityLineage(value:unknown,scope:IntakeScope,id:string):ActivityLineage{
 if(!object(value)||uuid(value.organization_id)!==uuid(scope.organizationId)||uuid(value.project_id)!==uuid(scope.projectId)||uuid(value.activity_id)!==uuid(id)||!Array.isArray(value.versions)||!value.versions.length)throw new Error('活動版本鏈與目前範圍不符。');
 const versions=value.versions.map((raw,index)=>{
  if(!object(raw)||raw.version_index!==index+1||typeof raw.is_effective!=='boolean'||!['original','correct','exclude'].includes(String(raw.mode))||!(raw.reason===null||typeof raw.reason==='string')||!(raw.created_at===null||typeof raw.created_at==='string'&&Number.isFinite(Date.parse(raw.created_at))))throw new Error('活動版本鏈資料不完整。');
  return {...raw,activity_id:uuid(raw.activity_id),predecessor_activity_id:nullableUuid(raw.predecessor_activity_id),successor_activity_id:nullableUuid(raw.successor_activity_id),actor_user_id:nullableUuid(raw.actor_user_id)} as ActivityVersion;
 });
 const seen=new Set<string>();for(let i=0;i<versions.length;i++){const row=versions[i];if(seen.has(row.activity_id)||row.predecessor_activity_id!==(i?versions[i-1].activity_id:null)||row.successor_activity_id!==(i+1<versions.length?versions[i+1].activity_id:null)||row.is_effective&&i!==versions.length-1)throw new Error('活動版本鏈重複、分支或次序不一致。');seen.add(row.activity_id);}
 if(!seen.has(uuid(id)))throw new Error('版本鏈沒有目前活動。');
 return {organization_id:uuid(value.organization_id),project_id:uuid(value.project_id),activity_id:uuid(value.activity_id),versions};
}
export async function readActivityLineage(client:Pick<SupabaseClient,'rpc'>,scope:IntakeScope,id:string,isCurrent=()=>true):Promise<ActivityLineage>{
 if(!isCurrent())throw new Error('活動或登入狀態已切換。');const result=await client.rpc('activity_version_lineage',{p_organization_id:uuid(scope.organizationId),p_project_id:uuid(scope.projectId),p_activity_id:uuid(id)});
 if(!isCurrent())throw new Error('活動或登入狀態已切換，舊版本鏈不採用。');if(result.error||!Array.isArray(result.data)||result.data.length!==1)throw new Error('無法核對活動版本鏈；未將缺少資料當成目前版本。');return adaptActivityLineage(result.data[0]?.result,scope,id);
}
