// Test-only synthetic fixture through the real controlled handler. Negative
// direct REST cases stay direct REST; no service key or privileged row insert.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function saveSyntheticManualActivity(runtime, token, values = {}) {
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(runtime.baseUrl).hostname));
  const fields = ['activity_name','activity_date','category','subcategory','activity_type','quantity','unit','data_quality','inclusion_status','exclusion_reason','review_note','final_scope','status'];
  const defaults = {activity_name:'SYNTHETIC test electricity',activity_date:'2026-01-15',category:'energy',subcategory:'purchased_electricity',activity_type:'electricity',quantity:100,unit:'kWh',data_quality:'primary',inclusion_status:'included',exclusion_reason:null,review_note:'SYNTHETIC TEST ONLY',final_scope:2,status:'active'};
  const body = {organization_id:values.organization_id??runtime.scope.organizationId,project_id:values.project_id??runtime.scope.projectId,activity_id:values.id??randomUUID(),request_id:randomUUID(),input:Object.fromEntries(fields.map(name=>[name,Object.hasOwn(values,name)?values[name]:defaults[name]]))};
  const response = await fetch(runtime.baseUrl+'/functions/v1/save-manual-activity',{method:'POST',headers:{apikey:runtime.publicKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result = await response.json();
  assert.equal(response.status,200,JSON.stringify(result));assert.equal(result.success,true);
  return result.data.activity;
}
