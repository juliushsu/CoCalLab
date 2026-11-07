import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { readPersistedReportSnapshot } from '../src/services/reportExportRead.ts';
import { buildReportExport, prepareReportExportSnapshot } from '../src/services/reportExport.ts';
import { exportCurrentSnapshot, reportExportBlockReason, REPORT_EXPORT_AUTHORIZATION_PENDING,reportExportIsBusy,releaseReportExportAttempt,type ReportExportAttempt } from '../src/services/reportDownload.ts';
import { reportExportFixture } from './fixtures/reportExportFixture.ts';

const row = reportExportFixture();
const expected = {reportId:row.id,projectId:row.project_id,organizationId:row.organization_id};
const snapshot = () => prepareReportExportSnapshot(reportExportFixture(), expected);
function transport(body:unknown, status=200) {
  const requests: { url:URL; headers:Headers }[]=[];
  const client=createClient('https://example.invalid','synthetic-public-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:{Authorization:'Bearer synthetic-user-jwt'},fetch:async(input,init)=>{
      requests.push({url:new URL(String(input)),headers:new Headers(init?.headers)});
      return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
    }},
  });
  return {client,requests};
}
test('real SDK request scopes persisted snapshots and retains user JWT; no private row allowlist leak', async()=>{
  const {client,requests}=transport(row);
  const result=await readPersistedReportSnapshot(client,row.id,row.project_id,row.organization_id);
  assert.equal(result.id,row.id);assert.equal(requests.length,1);
  const request=requests[0];assert.equal(request.url.pathname,'/rest/v1/report_generations');
  for(const [key,value] of Object.entries({id:row.id,project_id:row.project_id,organization_id:row.organization_id,status:'completed'}))assert.equal(request.url.searchParams.get(key),'eq.'+value);
  assert.equal(request.headers.get('Authorization'),'Bearer synthetic-user-jwt');
  assert.ok(!request.url.searchParams.get('select')!.includes('*'));
});
test('empty report, permission denial and read failure never produce a file or a fixture fallback', async()=>{
  for(const [body,status]of [[null,200],[{code:'42501',message:'permission denied'},403],[{message:'database unavailable'},503]]as const){
    const {client}=transport(body,status);let saves=0;
    await assert.rejects(exportCurrentSnapshot(()=>readPersistedReportSnapshot(client,row.id,row.project_id,row.organization_id),'json',()=>true,()=>{saves++;}));
    assert.equal(saves,0);
  }
});
test('different report/project/tenant response is rejected even when transport returns a row',async()=>{
  for(const changed of [{id:row.project_id},{project_id:row.organization_id},{organization_id:row.id}]){
    const {client}=transport({...row,...changed});
    await assert.rejects(readPersistedReportSnapshot(client,row.id,row.project_id,row.organization_id));
  }
});
test('route, session or subscription invalidation during a read prevents a stale download',async()=>{
  for(const invalidation of ['report switch','session switch','subscription denied']){
    let current=true;let finish!:(v:ReturnType<typeof snapshot>)=>void;let saves=0;
    const pending=exportCurrentSnapshot(()=>new Promise(resolve=>{finish=resolve;}),'html',()=>current,()=>{saves++;});
    current=false;finish(snapshot());assert.equal(await pending,false,invalidation);assert.equal(saves,0);
  }
  let reads=0;assert.equal(await exportCurrentSnapshot(async()=>{reads++;return snapshot();},'json',()=>false,()=>assert.fail()),false);assert.equal(reads,0);
});
test('report/session/preflight visit changes release visible busy immediately; an obsolete finally cannot clear a newer export',async()=>{
 for(const change of ['report switch','logout/re-login','subscription refresh','A-B-A visit']){
  const firstContext={change,visit:1};let context=firstContext;
  const first={context:firstContext};let active:ReportExportAttempt<typeof context>|null=first;
  let finish!:(value:ReturnType<typeof snapshot>)=>void;let saves=0;
  const pending=exportCurrentSnapshot(()=>new Promise(resolve=>{finish=resolve;}),'json',()=>context===firstContext,()=>{saves++;}).finally(()=>{active=releaseReportExportAttempt(active,first);});
  assert.equal(reportExportIsBusy(active,context),true);
  context={change,visit:2};assert.equal(reportExportIsBusy(active,context),false,'obsolete pending request cannot strand this visit');
  const newer={context};active=newer;assert.equal(reportExportIsBusy(active,context),true);
  finish(snapshot());assert.equal(await pending,false);assert.equal(saves,0);assert.equal(active,newer,'old completion must preserve the newer busy owner');
  active=releaseReportExportAttempt(active,newer);assert.equal(reportExportIsBusy(active,context),false);
 }
});
test('a rejected export releases its own busy state so same-context retry can download normally',async()=>{
 const context={},first={context};let active:ReportExportAttempt<typeof context>|null=first;
 await assert.rejects(exportCurrentSnapshot(async()=>{throw new Error('SYNTHETIC server unavailable');},'html',()=>true,()=>assert.fail()).finally(()=>{active=releaseReportExportAttempt(active,first);}));
 assert.equal(reportExportIsBusy(active,context),false);
 const retry={context};active=retry;let saves=0;
 assert.equal(await exportCurrentSnapshot(async()=>snapshot(),'html',()=>true,()=>{saves++;}).finally(()=>{active=releaseReportExportAttempt(active,retry);}),true);
 assert.equal(saves,1);assert.equal(reportExportIsBusy(active,context),false);
});
test('HTML and JSON actually write readable files with correct units and explicit synthetic provenance',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'cocallab-export-test-'));
  try{
    for(const format of ['html','json']as const){
      const exported=buildReportExport(snapshot(),format);const path=join(dir,exported.filename);
      await writeFile(path,exported.content,'utf8');const actual=await readFile(path,'utf8');
      assert.equal(actual,exported.content);assert.ok(actual.includes('SYNTHETIC TEST ONLY'));
      if(format==='json'){const data=JSON.parse(actual);assert.equal(data.snapshot.scope_totals.scope_1,1500);assert.equal(data.snapshot.is_test,true);}
      else assert.ok(actual.includes('2250 kgCO₂e / 2.25 tCO₂e'));
    }
    const empty=prepareReportExportSnapshot({...row,payload:{},scope_totals:{},category_totals:{}},expected);
    const html=buildReportExport(empty,'html').content;assert.ok(html.includes('總排放量（含未分類）</th><td>未知'));assert.ok(html.includes('未知：未提供分類明細。'));
  }finally{assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(dir.includes('cocallab-export-test-'));await rm(dir,{recursive:true,force:true});}
});
test('loading, unavailable subscription, readonly and absent server export authority all fail closed',()=>{
  assert.match(reportExportBlockReason({loading:true,error:null,isReadonly:false}),/確認訂閱/);
  assert.match(reportExportBlockReason({loading:false,error:'offline',isReadonly:false}),/無法確認/);
  assert.match(reportExportBlockReason({loading:false,error:null,isReadonly:true}),/唯讀/);
  assert.equal(reportExportBlockReason({loading:false,error:null,isReadonly:false}),REPORT_EXPORT_AUTHORIZATION_PENDING);
});
