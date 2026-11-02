import {test} from 'node:test';
import assert from 'node:assert/strict';
import {REPORT_EXPORT_FIELDS,prepareReportExportSnapshot,buildReportExport} from '../src/services/reportExport.ts';
const fixture = () => ({id:'report-1',organization_id:'org-1',project_id:'project-1',status:'completed',report_version:3,created_at:'2026-11-02T04:05:06Z',payload_hash:'synthetic-source-hash',payload:{project_metadata:{name:'Synthetic project'},data_gaps_and_warnings:['Pending review']},scope_totals:{scope_1:1500,scope_2:500,scope_3:0,unknown:250},category_totals:{electricity:500},included_activity_count:2,excluded_activity_count:0,pending_activity_count:1,warning_count:1,is_test:true,env:'staging',reporting_period_start:'2026-01-01',reporting_period_end:'2026-12-31'});
const expected = {reportId:'report-1',projectId:'project-1',organizationId:'org-1'};
test('only exact completed persisted report identity can export and private row fields are excluded', () => {
  const snapshot = prepareReportExportSnapshot({...fixture(),generated_by_user_id:'private-actor',error_message:'private-error',env:'private-env'},expected);
  const json = JSON.parse(buildReportExport(snapshot,'json').content);
  assert.deepEqual(Object.keys(json.snapshot).sort(),[...REPORT_EXPORT_FIELDS].sort());
  assert.equal(json.snapshot.scope_totals.scope_1,1500);
  assert.equal(json.snapshot.payload_hash,'synthetic-source-hash');
  assert.equal('generated_by_user_id' in json.snapshot,false);
  for (const patch of [{id:'other'},{project_id:'other'},{organization_id:'other'},{status:'generating'},{payload:null},{payload_hash:''},{report_version:0}]) {
    assert.throws(()=>prepareReportExportSnapshot({...fixture(),...patch},expected));
  }
  assert.throws(()=>prepareReportExportSnapshot(null,expected));
});
test('HTML includes source and readable stored summary with kg-to-tonnes once including unclassified emissions', () => {
  const html = buildReportExport(prepareReportExportSnapshot(fixture(),expected),'html').content;
  for (const value of ['report-1','2026-11-02T04:05:06Z','synthetic-source-hash','Synthetic project','2250 kgCO₂e / 2.25 tCO₂e','250 kgCO₂e / 0.25 tCO₂e','Pending review','測試資料','staging']) assert.ok(html.includes(value));
  const partial = {...fixture(),scope_totals:{scope_1:0,scope_2:0,scope_3:0},pending_activity_count:null};
  const partialHtml = buildReportExport(prepareReportExportSnapshot(partial,expected),'html').content;
  assert.ok(partialHtml.includes('總排放量（含未分類）</th><td>未知'));
  assert.ok(partialHtml.includes('0 kgCO₂e / 0 tCO₂e'));
  assert.ok(partialHtml.includes('pending_activity_count</th><td>未知'));
});
test('HTML escapes stored payload/category text, disables active content, and filenames stay deterministic and safe', () => {
  const malicious = {...fixture(),id:'../../report<script>',payload:{project_metadata:{name:'<img src=x onerror="alert(1)">'},note:'</pre><script>alert(1)</script>'},category_totals:{'<svg onload=alert(1)>':2000}};
  const snapshot = prepareReportExportSnapshot(malicious,{...expected,reportId:malicious.id});
  const first = buildReportExport(snapshot,'html');
  assert.equal(first.filename,buildReportExport(snapshot,'html').filename);
  assert.match(first.filename,/^[a-zA-Z0-9_-]+\.html$/);
  assert.ok(!first.content.includes('<script>'));
  assert.ok(!first.content.includes('<img'));
  assert.ok(!first.content.includes('<svg'));
  assert.ok(first.content.includes('&lt;script&gt;'));
  assert.ok(first.content.includes("default-src 'none'"));
});
test('unsupported formats cannot masquerade as downloads and null/invalid quantities remain unknown', () => {
  const snapshot = prepareReportExportSnapshot({...fixture(),scope_totals:{scope_1:'1500',scope_2:-1,scope_3:null,unknown:0}},expected);
  assert.throws(()=>buildReportExport(snapshot,'pdf' as 'html'));
  const html = buildReportExport(snapshot,'html').content;
  assert.ok(html.includes('Scope 1</th><td>未知'));
  assert.ok(html.includes('Scope 2</th><td>未知'));
});

test('uppercase UUID route identity can export while another report/project/tenant remains rejected', () => {
  const id = '00000000-0000-0000-0000-00000000000a';
  const projectId = '00000000-0000-0000-0000-00000000000b';
  const organizationId = '00000000-0000-0000-0000-00000000000c';
  const row = {...fixture(),id,project_id:projectId,organization_id:organizationId};
  const scope = {reportId:id.toUpperCase(),projectId:projectId.toUpperCase(),organizationId:organizationId.toUpperCase()};
  assert.equal(prepareReportExportSnapshot(row,scope).id,id);
  for (const patch of [{reportId:projectId},{projectId:id},{organizationId:id}]) {
    assert.throws(()=>prepareReportExportSnapshot(row,{...scope,...patch}));
  }
  assert.throws(()=>prepareReportExportSnapshot(fixture(),{...expected,reportId:'REPORT-1'}));
});
