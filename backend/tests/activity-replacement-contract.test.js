import test from 'node:test';import assert from 'node:assert/strict';
import {validateActivityReplacementInput} from '../src/contracts/activity-replacement.js';
const id='11111111-1111-4111-8111-111111111111',input={activity_name:'SYNTHETIC correction',activity_date:'2026-01-15',category:'energy',activity_type:'electricity',quantity:120,unit:'kWh',final_scope:2,inclusion_status:'included'};
const body={organization_id:id,project_id:id,predecessor_activity_id:id,request_id:id,mode:'correct',reason:'SYNTHETIC source correction',input,action:'replace'};
test('replacement accepts explicit correction or empty exclude input; never constructs a zero-quantity exclusion',()=>{
 assert.equal(validateActivityReplacementInput(body).input.quantity,120);
 const excluded=validateActivityReplacementInput({...body,mode:'exclude',input:{}});assert.deepEqual(excluded.input,{});assert.equal('quantity' in excluded.input,false);
 assert.equal(validateActivityReplacementInput({...body,action:undefined}).action,'lookup');
});
test('replacement rejects missing reasons, forged identities/sources/calculations and zeroing or editing exclusion payloads',()=>{
 for(const patch of [{reason:''},{mode:'archive'},{action:'reset'},{actor_user_id:id},{activity_id:id},{input:{...input,source_document_id:id}},{input:{...input,created_by_user_id:id}},{input:{...input,co2e_kg:0}},{input:{...input,status:'archived'}},{input:{...input,inclusion_status:'excluded',exclusion_reason:'x'}},{mode:'exclude',input:{quantity:0,unit:'kg'}}])assert.throws(()=>validateActivityReplacementInput({...body,...patch}));
});
