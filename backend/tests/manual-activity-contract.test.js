import test from 'node:test';import assert from 'node:assert/strict';
import {validateManualActivityInput} from '../src/contracts/manual-activity.js';
import {isProtectedManualDraft} from '../src/services/manual-source-guard.js';
const id='11111111-1111-4111-8111-111111111111';
const input={activity_name:'SYNTHETIC manual',activity_date:'2026-01-15',category:'energy',activity_type:'electricity',quantity:100,unit:'kWh',final_scope:2,inclusion_status:'included'};
const body={organization_id:id,project_id:id,activity_id:id,request_id:id,input};
test('manual endpoint admits explicit editable data and rejects identity/source/calculation authority forgery',()=>{
 assert.equal(validateManualActivityInput(body).input.quantity,100);
 for(const patch of [{quantity:''},{quantity:NaN},{quantity:null},{quantity:-1},{quantity:1e20},{unit:''},{activity_date:'2026-02-30'},{final_scope:null},{source_document_id:id},{created_by_user_id:id},{calculated_co2e_kg:1},{factor_id:id}])assert.throws(()=>validateManualActivityInput({...body,input:{...input,...patch}}),/ACTIVITY_INPUT_INVALID/);
 assert.throws(()=>validateManualActivityInput({...body,actor_user_id:id}),/ACTIVITY_INPUT_INVALID/);
 assert.equal(validateManualActivityInput({...body,input:{...input,quantity:0}}).input.quantity,0);
});
test('manual provider guard retains all historical provenance, including raw marker with empty/null payload',()=>{
 for(const row of [{extraction_provider:'MANUAL_TRANSCRIPTION_NO_OCR',status:'rejected',is_latest:false},{extraction_provider:'manual-other'},{extraction_provider:'ocr_manual_import',raw_payload:{}},{extraction_provider:'OCR-MANUAL-IMPORT',raw_payload:{}},{extraction_provider:'ocr',raw_payload:{manual_transcription:null}},{raw_payload:{manual_transcription:{user_id:id}}}])assert.equal(isProtectedManualDraft(row),true,JSON.stringify(row));
 for(const row of [null,{}, {extraction_provider:'manuality'},{extraction_provider:'ocrmanual_import'},{extraction_provider:'mock',raw_payload:{}}])assert.equal(isProtectedManualDraft(row),false);
});
