import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReportOutline} from '../src/services/reportOutline.ts';
import {adaptReportData,type ReportRow} from '../src/services/reportAdapter.ts';
import type {ReportSavedSnapshot} from '../src/types/report.ts';
// SYNTHETIC saved-row fixture only; never imported by an application route.
const row=():ReportRow=>({id:'synthetic-report',organization_id:'synthetic-org',project_id:'synthetic-project',report_version:3,status:'completed',created_at:'2026-11-06T06:00:00Z',updated_at:'2026-11-06T06:00:00Z',reporting_period_start:'2026-01-01',reporting_period_end:'2026-12-31',payload_hash:'synthetic-unverified-hash',is_test:true,env:'staging',claim_purpose:'internal_management',scope_totals:{scope_1:0,scope_2:50,scope_3:0,unknown:0},category_totals:{energy:50},included_activity_count:1,excluded_activity_count:0,pending_activity_count:0,warning_count:0,based_on_calculated_at:'2026-11-06T06:00:00Z',factor_sources:[{factor_id:'synthetic-factor',source_name:'SYNTHETIC TEST ONLY',version:2}],legal_entity_snapshot:{},site_snapshot:{},boundary_snapshot:{workspace_id:'synthetic-org',boundary_type:'operational_control'},gross_emissions_snapshot:{gross_total_co2e_kg:50},adjustment_summary:{eligible_total_tco2e:0},claim_results:{gross_co2e_kg:50,claim_net_co2e_kg:50},adjustment_manifest:[],payload:{project_metadata:{project_id:'synthetic-project',organization_id:'synthetic-org',name:'SYNTHETIC saved name'},workspace_snapshot:{workspace_id:'synthetic-org',workspace_label:'SYNTHETIC ONLY'},reporting_period:{start_date:'2026-01-01',end_date:'2026-12-31'},boundary_summary:{included_count:1,excluded_count:0,pending_count:0},included_activities_summary:[{emission_activity_id:'synthetic-activity',co2e_kg:50}],excluded_items_summary:[],appendix_mappings:[{emission_activity_id:'synthetic-activity',source_document_id:null,source_draft_id:null,calculation_result_id:'synthetic-calculation'}],data_gaps_and_warnings:[],ai_summary_placeholder:'THIS MUST NOT BE A GENERATED CHAPTER'}});
const chapter=(snapshot:ReportSavedSnapshot,order:number)=>buildReportOutline(snapshot).chapters[order-1];

test('adapter preserves actual saved JSON/identity evidence without inventing report sections or substituting a live join',()=>{
  const input={...row(),project:{name:'LIVE RENAMED PROJECT'}};const result=adaptReportData(input);
  assert.equal(result.report.project_name,'SYNTHETIC saved name');assert.deepEqual(result.report.saved_snapshot.payload,input.payload);assert.deepEqual(result.report.saved_snapshot.adjustment_manifest,[]);assert.equal(result.report.saved_snapshot.organization_id,input.organization_id);
  assert.equal('project' in result.report.saved_snapshot,false);assert.deepEqual(result.sections,[]);assert.equal(result.report.total_sections,0);assert.equal(result.report.completed_sections,0);
});
test('ten chapters render saved version/period/factor/appendix provenance, kg/t once, and synthetic marking without scores',()=>{
  const outline=buildReportOutline(row());assert.equal(outline.chapters.length,10);assert.deepEqual(outline.chapters.map(c=>c.order),[1,2,3,4,5,6,7,8,9,10]);
  assert.equal(outline.provenance,'保存資料已標記為測試資料');assert.equal(outline.environment,'staging');assert.equal('completeness' in outline,false);
  assert.ok(chapter(row(),1).fields.some(f=>f.label==='報告版本'&&f.value==='3'));assert.equal(chapter(row(),4).fields[0].value,'2026-01-01');
  assert.equal(chapter(row(),6).fields.find(f=>f.source.endsWith('scope_2')).value,'50 kgCO₂e / 0.05 tCO₂e');
  const factor=chapter(row(),8).fields[0];assert.equal(factor.source,'report_generations.factor_sources');assert.ok(factor.value.includes('SYNTHETIC TEST ONLY'));assert.ok(factor.value.includes('"version": 2'));
  assert.ok(chapter(row(),7).fields[0].value.includes('synthetic-calculation'));assert.ok(chapter(row(),7).notes.some(n=>n.includes('未連結來源文件')));
  assert.equal(JSON.stringify(outline).includes('THIS MUST NOT BE A GENERATED CHAPTER'),false);
});
test('absent snapshot is guidance, and missing/empty/malformed values remain distinguishable',()=>{
  const guide=buildReportOutline(null);assert.equal(guide.selected,false);assert.equal(guide.chapters.length,10);
  assert.equal(chapter({},8).fields[0].state,'missing');assert.equal(chapter({factor_sources:[]},8).fields[0].state,'empty');assert.equal(chapter({factor_sources:{}},8).fields[0].state,'invalid');
  assert.equal(chapter({boundary_snapshot:{}},3).fields[0].state,'empty');assert.equal(chapter({},5).fields[0].state,'missing');
  assert.equal(chapter({warning_count:0,payload:{data_gaps_and_warnings:[]}},9).fields[0].value,'0');assert.equal(chapter({warning_count:0,payload:{data_gaps_and_warnings:[]}},9).fields[1].state,'empty');
});
test('zero is a real saved amount; strings/negative/nonfinite/partial amounts never become zero',()=>{
  assert.equal(chapter({scope_totals:{scope_1:0}},6).fields[0].value,'0 kgCO₂e / 0 tCO₂e');assert.equal(chapter({scope_totals:{scope_1:0}},6).fields[1].state,'missing');
  for(const value of ['50',-1,Infinity,NaN])assert.equal(chapter({scope_totals:{scope_1:value}},6).fields[0].state,'invalid');
  for(const value of [-1,0.1,'1',Infinity])assert.equal(chapter({included_activity_count:value},5).fields[0].state,'invalid');
});
test('legacy saved payload fallback has explicit source and does not mask an invalid canonical column',()=>{
  const legacy={payload:{reporting_period:{start_date:'2026-01-01',end_date:'2026-12-31'},factor_sources_used:[{factor_id:'f',source_name:'old saved source',version:1}],boundary_snapshot:{boundary_type:'equity_share'}}};
  assert.equal(chapter(legacy,4).fields[0].source,'report_generations.payload.reporting_period.start_date');assert.equal(chapter(legacy,8).fields[0].source,'report_generations.payload.factor_sources_used');
  assert.equal(chapter({...legacy,factor_sources:'invalid'},8).fields[0].state,'invalid');assert.equal(chapter({...legacy,boundary_snapshot:{}},3).fields[0].state,'empty');
});
test('invalid periods, inconsistent saved identities/periods and partial factor sources are explicit issues',()=>{
  assert.equal(chapter({reporting_period_start:'2026-02-30'},4).fields[0].state,'invalid');
  const invalid=buildReportOutline({...row(),reporting_period_start:'2026-12-31',reporting_period_end:'2026-01-01',factor_sources:[{}],payload:{project_metadata:{organization_id:'OTHER',project_id:'OTHER'},reporting_period:{start_date:'2025-01-01'}}});
  assert.ok(invalid.notes.some(n=>n.includes('organization_id')));assert.ok(invalid.notes.some(n=>n.includes('project_id')));assert.ok(invalid.notes.some(n=>n.includes('起日晚於')));assert.ok(invalid.notes.some(n=>n.includes('版本')));
});
test('malformed scope containers and inconsistent saved totals/warning counts stay explicit rather than choosing a success value',()=>{
  const malformed=buildReportOutline({scope_totals:'invalid'});assert.ok(malformed.notes.some(n=>n.includes('scope_totals')));assert.ok(malformed.chapters[5].fields.slice(0,4).every(field=>field.state==='invalid'));
  const mismatched=buildReportOutline({...row(),gross_emissions_snapshot:{gross_total_co2e_kg:60},category_totals:{energy:'50'},warning_count:1});
  assert.ok(mismatched.notes.some(n=>n.includes('Scope 合計')));assert.ok(mismatched.notes.some(n=>n.includes('分類總量')));assert.ok(mismatched.notes.some(n=>n.includes('warning_count')));
});
