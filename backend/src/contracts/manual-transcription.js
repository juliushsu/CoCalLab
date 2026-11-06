import {normalizeUnit} from '../services/unit-normalization.js';
export const MANUAL_PROVIDER='MANUAL_TRANSCRIPTION_NO_OCR';
const fields=['activity_name','quantity','unit','activity_date','category','subcategory','activity_type','final_scope','inclusion_status','exclusion_reason','review_note','period_start','period_end','source_locator'];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=message=>{throw Object.assign(new Error(message),{code:'INVALID_MANUAL_TRANSCRIPTION'});};
const string=(value,name,max=500)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max)fail(name+' must be explicit nonempty text');return value.trim();};
const nullable=(value,name,max)=>value===null?null:string(value,name,max);
const date=(value,name)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail(name+' must be a valid YYYY-MM-DD');return value;};
const uuid=(value,name)=>{if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))fail(name+' must be a UUID');return value.toLowerCase();};
export function canonicalManualTranscription(value){
  if(!object(value)||fields.some(key=>!Object.hasOwn(value,key))||Object.keys(value).some(key=>![...fields,'source_text'].includes(key)))fail('Explicit manual fields required; unsupported fields are denied');
  const q=value.quantity;
  if(typeof q!=='number'||!Number.isFinite(q)||q<0||q>=1e12||Number(q.toFixed(8))!==q)fail('quantity must be a nonnegative numeric(20,8) JSON number');
  const result={activity_name:string(value.activity_name,'activity_name'),quantity:q,unit:string(value.unit,'unit',32),activity_date:date(value.activity_date,'activity_date'),category:string(value.category,'category',100),subcategory:nullable(value.subcategory,'subcategory',100),activity_type:string(value.activity_type,'activity_type',100),final_scope:value.final_scope,inclusion_status:value.inclusion_status,exclusion_reason:nullable(value.exclusion_reason,'exclusion_reason',2000),review_note:nullable(value.review_note,'review_note',2000),period_start:value.period_start===null?null:date(value.period_start,'period_start'),period_end:value.period_end===null?null:date(value.period_end,'period_end'),source_locator:string(value.source_locator,'source_locator'),source_text:value.source_text===undefined||value.source_text===null?null:string(value.source_text,'source_text',10000)};
  if(!normalizeUnit(q,result.unit).ok)fail('Unsupported manual unit; correct the input before saving');
  if(!['pending','included','excluded'].includes(result.inclusion_status)||!(result.final_scope===null||[1,2,3].includes(result.final_scope)))fail('Explicit inclusion_status and final_scope required');
  if(result.inclusion_status==='included'&&result.final_scope===null)fail('Included activity requires explicit final_scope');
  if(result.inclusion_status==='excluded'&&!result.exclusion_reason)fail('Excluded activity requires exclusion_reason');
  if((result.period_start===null)!==(result.period_end===null)||result.period_start!==null&&result.period_start>result.period_end)fail('Period must be unknown or a complete ordered range');
  return result;
}
export function validateManualTranscriptionInput(input){
  const keys=['organization_id','project_id','document_id','draft_id','request_id','transcription'];
  if(!object(input)||Object.keys(input).some(key=>!keys.includes(key))||keys.some(key=>!Object.hasOwn(input,key)))fail('Manual request has missing or unsupported fields');
  return {organization_id:uuid(input.organization_id,'organization_id'),project_id:uuid(input.project_id,'project_id'),document_id:uuid(input.document_id,'document_id'),draft_id:uuid(input.draft_id,'draft_id'),request_id:string(input.request_id,'request_id',200),transcription:canonicalManualTranscription(input.transcription)};
}
export function manualConfirmationIntent(input,transcription){
  if(!object(input)||!['confirmed','rejected'].includes(input.decision))fail('Invalid manual decision');
  if(Object.keys(input).some(key=>!['organization_id','project_id','draft_id','decision','request_id','overrides'].includes(key)))fail('Unsupported manual confirmation field');
  const request_id=string(input.request_id,'request_id',200),overrides=input.overrides||{};
  if(!object(overrides))fail('Invalid manual overrides');
  for(const [key,value]of Object.entries(overrides))if(key!=='review_note'&&(!fields.includes(key)||value!==transcription[key]))fail('Manual canonical input is immutable; changed override '+key);
  return {decision:input.decision,request_id,review_note:overrides.review_note===undefined?transcription.review_note:nullable(overrides.review_note,'review_note',2000)};
}
