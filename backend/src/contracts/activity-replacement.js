import {validateManualActivityInput} from './manual-activity.js';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const invalid=message=>{throw new Error('ACTIVITY_REPLACEMENT_INPUT_INVALID: '+message);};
export function validateActivityReplacementInput(value){
 if(object(value)&&value.action==='recover'){
  const allowed=['organization_id','project_id','predecessor_activity_id','action'];
  if(Object.keys(value).some(key=>!allowed.includes(key))||allowed.some(key=>!Object.hasOwn(value,key)))invalid('Recovery accepts only scope and predecessor');
  const readId=key=>{if(typeof value[key]!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value[key]))invalid('UUID required');return value[key].toLowerCase();};
  return {organization_id:readId('organization_id'),project_id:readId('project_id'),predecessor_activity_id:readId('predecessor_activity_id'),action:'recover'};
 }
 const keys=['organization_id','project_id','predecessor_activity_id','request_id','mode','reason','input','action'];
 if(!object(value)||Object.keys(value).some(key=>!keys.includes(key)))invalid('Unsupported field');
 if(!['correct','exclude'].includes(value.mode)||typeof value.reason!=='string'||!value.reason.trim()||value.reason.trim().length>2000||!object(value.input))invalid('Explicit mode, reason and input required');
 const action=value.action??'lookup';if(!['lookup','replace'].includes(action))invalid('Invalid action');
 const uuid=field=>{const id=value[field];if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))invalid(field+' must be UUID');return id.toLowerCase();};
 const organization_id=uuid('organization_id'),project_id=uuid('project_id'),predecessor_activity_id=uuid('predecessor_activity_id');
 if(typeof value.request_id!=='string'||!value.request_id.trim()||value.request_id.length>200)invalid('Stable request_id required');
 // Reuse business validation only for correction; exclusion never creates substitute values.
 if(value.mode==='correct')validateManualActivityInput({organization_id,project_id,activity_id:predecessor_activity_id,request_id:value.request_id,input:value.input});
 if(value.mode==='exclude'&&Object.keys(value.input).length)invalid('Exclude inherits all predecessor values; input must be empty');
 if(value.mode==='correct'&&(value.input.inclusion_status==='excluded'||value.input.status!==undefined&&value.input.status!=='active'))invalid('Correction must create an active non-excluded version; use exclude mode');
 return {organization_id,project_id,predecessor_activity_id,request_id:value.request_id,mode:value.mode,reason:value.reason.trim(),input:value.input,action};
}
