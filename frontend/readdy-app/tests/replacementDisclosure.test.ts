import test from 'node:test';import assert from 'node:assert/strict';
import {savedReplacementDisclosure} from '../src/services/replacementDisclosure.ts';
import {formatActivityEmissions} from '../src/services/activityDetail.ts';
import {buildReportExport,prepareReportExportSnapshot} from '../src/services/reportExport.ts';
import {reportExportFixture} from './fixtures/reportExportFixture.ts';
test('historical snapshot without disclosure contract is explicit and never populated from current activities',()=>{
 assert.match(savedReplacementDisclosure({appendix_mappings:[{emission_activity_id:'old'}]}).message,/當時未記錄/);
});
test('excluded headline is not a real zero while an included calculated zero remains zero',()=>{
 assert.equal(formatActivityEmissions(0,'excluded','superseded'),'已排除／不計入');
 assert.equal(formatActivityEmissions(0,'included','calculated'),'0 kgCO₂e / 0 tCO₂e');
});
test('HTML/JSON exports disclose saved ancestor corrections with escaping and preserve old snapshots without live backfill',()=>{
 const row=reportExportFixture(),provenance={version:'20261108.replacement.1',source_usage:'historical_reference_only',receipt_verification_status:'server_verified',steps:[{predecessor_activity_id:'old',activity_id:'new',replacement_mode:'correct',reason:'<script>SYNTHETIC correction</script>',actor_user_id:'actor',occurred_at:'2026-11-08T00:00:00Z',changes:{quantity:{before:100,after:120}}}]};
 const payload={...row.payload,replacement_disclosure_version:'20261108.replacement.1',correction_disclosures:[{emission_activity_id:'new',replacement_provenance:provenance}]},snapshot=prepareReportExportSnapshot({...row,payload},{reportId:row.id,projectId:row.project_id});
 const before=structuredClone(snapshot),html=buildReportExport(snapshot,'html').content,json=JSON.parse(buildReportExport(snapshot,'json').content);
 assert.match(html,/原收據僅.*歷史來源.*不佐證/);assert.ok(html.includes('&lt;script&gt;SYNTHETIC correction&lt;/script&gt;'));assert.equal(html.includes('<script>'),false);assert.ok(html.includes('操作者'));assert.ok(html.includes('100'));assert.ok(html.includes('120'));
 assert.deepEqual(json.snapshot.payload.correction_disclosures,payload.correction_disclosures);assert.equal(json.replacement_disclosure.state,'recorded');
 assert.match(html,/報告產生時的原收據驗證狀態/);assert.match(json.replacement_disclosure.message,/報告產生時/);assert.deepEqual(snapshot,before);assert.deepEqual(json.snapshot.payload,before.payload);
 const old=prepareReportExportSnapshot(row,{reportId:row.id,projectId:row.project_id});assert.match(buildReportExport(old,'html').content,/當時未記錄/);assert.equal(Object.hasOwn(old.payload,'correction_disclosures'),false);
});
