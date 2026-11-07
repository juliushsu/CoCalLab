const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=message=>{throw new Error('ACTIVITY_INPUT_INVALID: '+message);};
const uuid=value=>{if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))fail('UUID required');return value.toLowerCase();};
const fields=['activity_name','activity_date','category','subcategory','activity_type','quantity','unit','data_quality','inclusion_status','exclusion_reason','review_note','final_scope','status'];
export function validateManualActivityInput(value){
 const keys=['organization_id','project_id','activity_id','request_id','input'];
 if(!object(value)||Object.keys(value).some(key=>!keys.includes(key))||keys.some(key=>!Object.hasOwn(value,key)))fail('Explicit scoped request required');
 if(typeof value.request_id!=='string'||!value.request_id.trim()||value.request_id.length>200)fail('Stable request_id required');
 const input=value.input;
 if(!object(input)||Object.keys(input).some(key=>!fields.includes(key)))fail('Unsupported activity field');
 for(const key of ['activity_name','activity_date','category','activity_type','unit','inclusion_status'])if(typeof input[key]!=='string'||!input[key].trim())fail(key+' required');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.activity_date)||!Number.isFinite(Date.parse(input.activity_date))||new Date(input.activity_date).toISOString().slice(0,10)!==input.activity_date)fail('Valid activity_date required');
 if(typeof input.quantity!=='number'||!Number.isFinite(input.quantity)||input.quantity<0||input.quantity>=1e12||Number(input.quantity.toFixed(8))!==input.quantity)fail('Explicit numeric(20,8) quantity required');
 if(!Object.hasOwn(input,'final_scope')||!(input.final_scope===null||[1,2,3].includes(input.final_scope))||!['pending','included','excluded'].includes(input.inclusion_status)||input.inclusion_status==='included'&&input.final_scope===null)fail('Explicit inclusion and scope required');
 if(input.inclusion_status==='excluded'&&(typeof input.exclusion_reason!=='string'||!input.exclusion_reason.trim()))fail('Exclusion reason required');
 return {organization_id:uuid(value.organization_id),project_id:uuid(value.project_id),activity_id:uuid(value.activity_id),request_id:value.request_id,input};
}
