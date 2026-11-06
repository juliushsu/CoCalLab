import test from 'node:test';
import assert from 'node:assert/strict';
import {build_report_payload} from '../src/services/build-report-payload.js';
const project={id:'SYNTHETIC-P',organization_id:'SYNTHETIC-O',boundary_type:'operational_control',reporting_start_date:'2026-01-01',reporting_end_date:'2026-12-31'};
const activity={id:'SYNTHETIC-A',inclusion_status:'included',final_scope:2,category:'energy'};
const calculation={emission_activity_id:activity.id,status:'calculated',is_latest:true,co2e_kg:50};
test('formal report payload refuses missing/pending/error/duplicate latest and invalid totals rather than manufacturing zero',()=>{
 const build=calculation_results=>build_report_payload({project,activities:[activity],calculation_results});
 for(const value of [[],[{...calculation,status:'pending_factor',co2e_kg:null}],[{...calculation,status:'error'}],[{...calculation,is_latest:false}],[calculation,calculation],...[null,'',false,{},NaN,Infinity,-1,'NaN'].map(co2e_kg=>[{...calculation,co2e_kg}])])assert.throws(()=>build(value),/REPORT_CALCULATION_INCOMPLETE/);
 assert.equal(build([calculation]).scope_totals.scope_2,50);
 assert.equal(build([{...calculation,co2e_kg:0}]).scope_totals.scope_2,0);
 assert.equal(build([{...calculation,co2e_kg:'50.00000000'}]).scope_totals.scope_2,50);
});
