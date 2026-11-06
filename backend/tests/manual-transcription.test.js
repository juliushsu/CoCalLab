import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validateManualTranscriptionInput,manualConfirmationIntent} from '../src/contracts/manual-transcription.js';
import {calculate_emission_activity} from '../src/services/calculate-emission-activity.js';
const fixture=()=>({organization_id:randomUUID(),project_id:randomUUID(),document_id:randomUUID(),draft_id:randomUUID(),request_id:randomUUID(),transcription:{activity_name:'SYNTHETIC electricity',quantity:100,unit:'kWh',activity_date:'2026-01-15',category:'energy',subcategory:null,activity_type:'electricity',final_scope:2,inclusion_status:'included',exclusion_reason:null,review_note:null,period_start:'2026-01-01',period_end:'2026-01-31',source_locator:'Page 1 electricity row'}});
test('manual contract keeps explicit valid zero/unit/date/source and rejects missing/defaulted/actor/provider input',()=>{
  const source=fixture();assert.equal(validateManualTranscriptionInput(source).transcription.quantity,100);assert.equal(validateManualTranscriptionInput({...source,transcription:{...source.transcription,quantity:0}}).transcription.quantity,0);
  for(const key of ['quantity','unit','activity_date','final_scope','inclusion_status','category','activity_type','source_locator']){const transcription={...source.transcription};delete transcription[key];assert.throws(()=>validateManualTranscriptionInput({...source,transcription}),undefined,key);}
  for(const patch of [{actor_user_id:randomUUID()},{extraction_provider:'MANUAL_TRANSCRIPTION_NO_OCR'},{status:'confirmed'}])assert.throws(()=>validateManualTranscriptionInput({...source,...patch}));
  for(const quantity of ['100',null,-1,Infinity,1e20,0.000000001])assert.throws(()=>validateManualTranscriptionInput({...source,transcription:{...source.transcription,quantity}}));
});
test('equal-ranked eligible factors stay pending with a clear ambiguity warning and NULL amount',()=>{
  const org=randomUUID(),factor={organization_id:org,activity_type:'electricity',category:'energy',unit:'kWh',valid_from:'2026-01-01',valid_to:null,status:'active',quality_tier:'custom',version:1,co2e_kg_per_unit:0.5};
  const result=calculate_emission_activity({activity:{organization_id:org,activity_date:'2026-01-15',activity_type:'electricity',category:'energy',quantity:100,unit:'kWh',inclusion_status:'included'},factors:[{...factor,id:randomUUID()},{...factor,id:randomUUID(),co2e_kg_per_unit:9}]});
  assert.equal(result.status,'pending_factor');assert.equal(result.co2e_kg,null);assert.equal(result.error_code,'FACTOR_AMBIGUOUS');assert.match(result.warnings[0].zh_tw,/同順位/);
});
test('manual contract refuses invalid/partial/crossed periods and unsupported units, included unknown Scope or excluded reason',()=>{
  const source=fixture();for(const patch of [{activity_date:'2026-02-30'},{unit:'unknown-unit'},{period_start:null},{period_start:'2026-02-01',period_end:'2026-01-01'},{final_scope:null},{inclusion_status:'excluded',exclusion_reason:null}])assert.throws(()=>validateManualTranscriptionInput({...source,transcription:{...source.transcription,...patch}}));
  const unknown=validateManualTranscriptionInput({...source,transcription:{...source.transcription,period_start:null,period_end:null,inclusion_status:'pending',final_scope:null}});assert.equal(unknown.transcription.period_start,null);
});
test('manual confirmation permits review note but refuses changed canonical fields or forged provider/actor',()=>{
  const source=validateManualTranscriptionInput(fixture()).transcription;
  assert.deepEqual(manualConfirmationIntent({decision:'confirmed',request_id:'same-request',overrides:{review_note:' checked '}},source),{decision:'confirmed',request_id:'same-request',review_note:'checked'});
  assert.throws(()=>manualConfirmationIntent({decision:'confirmed',request_id:'r',overrides:{quantity:101}},source));
  assert.throws(()=>manualConfirmationIntent({decision:'confirmed',request_id:'r',overrides:{actor_user_id:randomUUID()}},source));
  assert.throws(()=>manualConfirmationIntent({decision:'confirmed'},source));
});
