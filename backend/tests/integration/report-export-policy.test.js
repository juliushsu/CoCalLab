import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createProductRuntime} from '../../tools/product-preview/runtime.js';
import {readAuthorizedReportSnapshot} from '../../../frontend/readdy-app/src/services/reportExportRead.ts';
import {REPORT_EXPORT_FIELDS as frontendFields,buildReportExport} from '../../../frontend/readdy-app/src/services/reportExport.ts';
import {REPORT_EXPORT_FIELDS} from '../../src/services/report-export.js';
const require=createRequire(new URL('../../../frontend/readdy-app/package.json',import.meta.url)),{createClient}=require('@supabase/supabase-js');
const client=(r,token)=>createClient(r.baseUrl,r.publicKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}});
async function login(r,name){const response=await fetch(r.baseUrl+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r.accounts[name])});assert.equal(response.status,200);return (await response.json()).access_token;}
async function request(r,token,body){const response=await fetch(r.baseUrl+'/functions/v1/export-report-snapshot',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
const input=s=>({organization_id:s.organizationId,project_id:s.projectId,report_id:s.reportId});
test('policy A returns exact persisted allowlist through actual handler and SDK, preserves kg and test provenance',async()=>{
 assert.deepEqual(REPORT_EXPORT_FIELDS,frontendFields);
 const r=await createProductRuntime({port:0,scenario:'showcase'});try{
 const token=await login(r,'aOwner'),a=r.config.manifest.fixtures.a;
 const saved=await readAuthorizedReportSnapshot(client(r,token),a.reportId,a.projectId,a.organizationId);
 assert.equal(saved.id,a.reportId);assert.equal(saved.scope_totals.scope_2,50);assert.equal(saved.is_test,true);assert.equal('generated_by_user_id' in saved,false);assert.equal('error_message' in saved,false);
 assert.ok(buildReportExport(saved,'html').content.includes('50 kgCO₂e / 0.05 tCO₂e'));assert.equal(JSON.parse(buildReportExport(saved,'json').content).snapshot.scope_totals.scope_2,50);
 const repeated=await request(r,token,input(a));assert.equal(repeated.status,200);assert.deepEqual(repeated.body.data.snapshot,saved);
 }finally{await r.close();}
});
test('server refuses unauthenticated, forged token, viewer, cross-tenant and caller-supplied actor or entitlement',async()=>{
 const r=await createProductRuntime({port:0,scenario:'showcase'});try{
 const f=r.config.manifest.fixtures,a=await login(r,'aOwner'),viewer=await login(r,'viewer'),shared=await login(r,'owner');
 for(const token of [undefined,'forged-token'])assert.equal((await request(r,token,input(f.a))).status,401);
 assert.equal((await request(r,viewer,input(f.a))).status,403);assert.equal((await request(r,a,input(f.b))).status,403);assert.equal((await request(r,shared,input(f.b))).status,403);
 assert.equal((await request(r,a,{...input(f.a),actor_user_id:r.scope.aOwnerId})).status,400);assert.equal((await request(r,a,{...input(f.a),policy:'tenant_write_v1'})).status,400);
 assert.equal((await request(r,a,{...input(f.a),report_id:f.b.reportId})).status,404);
 }finally{await r.close();}
});
test('server rechecks subscription and completed snapshot; readonly and missing report never yield a file',async()=>{
 const r=await createProductRuntime({port:0,scenario:'showcase'});try{
 const a=r.config.manifest.fixtures.a,token=await login(r,'aOwner');
 const changed=await fetch(r.baseUrl+'/rest/v1/subscriptions?organization_id=eq.'+a.organizationId,{method:'PATCH',headers:{Authorization:'Bearer SYNTHETIC-PRODUCT-SERVICE-KEY','Content-Type':'application/json'},body:JSON.stringify({status:'readonly'})});assert.ok(changed.ok);
 const denied=await request(r,token,input(a));assert.equal(denied.status,403);assert.equal(denied.body.error.code,'EXPORT_READONLY');
 await assert.rejects(readAuthorizedReportSnapshot(client(r,token),a.reportId,a.projectId,a.organizationId));
 }finally{await r.close();}
});

test('missing server policy stays disabled instead of treating report SELECT as export permission',async()=>{
 const r=await createProductRuntime({port:0,scenario:'showcase',exportPolicy:null});try{const token=await login(r,'aOwner'),a=r.config.manifest.fixtures.a;const response=await request(r,token,input(a));assert.equal(response.status,403);assert.equal(response.body.error.code,'EXPORT_NOT_ENABLED');}finally{await r.close();}
});
