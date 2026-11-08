export const REPLACEMENT_DISCLOSURE_VERSION='20261108.replacement.1';
export const REPLACEMENT_SOURCE_NOTICE='人工更正／排除：原收據僅為歷史來源，不佐證更正後的數值；版本理由與原件驗證不代表更正值已查證。';
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&Boolean(value.trim());
export interface ReplacementStep {predecessor_activity_id:string;activity_id:string;replacement_mode:'correct'|'exclude';reason:string;actor_user_id:string;occurred_at:string;changes:Record<string,{before:unknown;after:unknown}>}
export interface ReplacementProvenance {version:string;source_usage:'historical_reference_only';receipt_verification_status:string|null;steps:ReplacementStep[]}
export function parseReplacementProvenance(value:unknown):ReplacementProvenance|null{
 if(!record(value)||value.version!==REPLACEMENT_DISCLOSURE_VERSION||value.source_usage!=='historical_reference_only'||!(value.receipt_verification_status===null||text(value.receipt_verification_status))||!Array.isArray(value.steps)||!value.steps.length)return null;
 for(const step of value.steps){if(!record(step)||!text(step.predecessor_activity_id)||!text(step.activity_id)||!['correct','exclude'].includes(String(step.replacement_mode))||!text(step.reason)||!text(step.actor_user_id)||!text(step.occurred_at)||!Number.isFinite(Date.parse(step.occurred_at))||!record(step.changes)||Object.values(step.changes).some(change=>!record(change)||!Object.hasOwn(change,'before')||!Object.hasOwn(change,'after')))return null;}
 return value as unknown as ReplacementProvenance;
}
/** Saved payload only. Never consult current activities to populate an older report. */
export function savedReplacementDisclosure(payload:unknown){
 const disclosures:{emission_activity_id:string;replacement_provenance:ReplacementProvenance}[]=[];
 if(!record(payload)||!Object.hasOwn(payload,'replacement_disclosure_version'))return {state:'legacy' as const,message:'此報告保存當時未記錄更正揭露契約；不以目前活動或版本鏈回填，也不能推定沒有人工更正。',disclosures};
 if(payload.replacement_disclosure_version!==REPLACEMENT_DISCLOSURE_VERSION||!Array.isArray(payload.correction_disclosures))return {state:'invalid' as const,message:'保存的更正揭露契約無效，須核對該快照；不推定原收據佐證更正值。',disclosures};
 const seen=new Set<string>();for(const entry of payload.correction_disclosures){const p=record(entry)?parseReplacementProvenance(entry.replacement_provenance):null;if(!record(entry)||!text(entry.emission_activity_id)||seen.has(entry.emission_activity_id)||!p)return {state:'invalid' as const,message:'保存的更正揭露不完整或重複，須核對該快照。',disclosures:[]};seen.add(entry.emission_activity_id);disclosures.push({emission_activity_id:entry.emission_activity_id,replacement_provenance:p});}
 return {state:'recorded' as const,message:disclosures.length?REPLACEMENT_SOURCE_NOTICE:'此快照已保存更正揭露契約，當時未列有更正活動；不代表完成原件或人工查證。',disclosures};
}
