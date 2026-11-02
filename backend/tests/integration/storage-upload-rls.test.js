import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

if (!process.env.PGLITE_RUNTIME_ROOT) throw new Error('Set PGLITE_RUNTIME_ROOT to the isolated PGlite runtime.');
const require = createRequire(resolve(process.env.PGLITE_RUNTIME_ROOT, 'package.json'));
const { PGlite } = require('@electric-sql/pglite');
const { citext } = require('@electric-sql/pglite/contrib/citext');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const directory = new URL('../../supabase/migrations/', import.meta.url);
const target = '202611020001_secure_upload_storage.sql';
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A = uuid(1), B = uuid(2), READONLY = uuid(3), ARCHIVED = uuid(4), SUSPENDED = uuid(5);
const PA = uuid(11), PB = uuid(12), PA2 = uuid(13), PR = uuid(14), PX = uuid(15), PS = uuid(16);
const OWNER = uuid(101), ADMIN = uuid(102), EDITOR = uuid(103), VIEWER = uuid(104), INACTIVE = uuid(105);
const OUTSIDER = uuid(106), OWNER_B = uuid(107), DUAL = uuid(108), INVITED = uuid(109), OWNER_R = uuid(110);
const OWNER_X = uuid(111), OWNER_S = uuid(112);
const buckets = ['documents', 'staging-receipts', 'staging-attachments'];
const path = (bucket, project, filename) => `${bucket === 'documents' ? '' : 'staging/'}${project}/${filename}`;
let next = 1000;
const receipt = (bucket = 'staging-receipts', project = PA, org = A, user = OWNER) => {
  const n = ++next, id = uuid(n);
  return { id, organization_id: org, project_id: project, uploaded_by_user_id: user,
    storage_bucket: bucket, storage_path: path(bucket, project, `${id}.pdf`), original_filename: 'synthetic.pdf',
    mime_type: 'application/pdf', file_size_bytes: 16, sha256_hash: n.toString(16).padStart(64, '0'),
    document_type: 'other', ocr_status: 'pending', status: 'active', metadata: { upload_only: true },
    env: bucket === 'documents' ? 'production' : 'staging', is_test: bucket !== 'documents' };
};
const load = async (db, file) => db.exec(await readFile(new URL(file, directory), 'utf8'));
async function bootstrap(db) {
  // Explicit catalog/auth STUBS. No Storage API, object bytes, JWT verification or HTTP server.
  await db.exec(`create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create role authenticated nologin nosuperuser nobypassrls;
    create role anon nologin nosuperuser nobypassrls;
    create role service_role nologin nosuperuser bypassrls;
    create schema storage;
    create table storage.buckets(id text primary key,name text not null,public boolean not null default false);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),
      name text not null,owner uuid,owner_id text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
    grant usage on schema auth,public,storage to authenticated,anon,service_role;`);
  // Load the complete checked-in schema/policy chain, omitting only data-fixture SQL.
  // No policy, ACL, tenant-integrity or helper definition is replaced with a stub.
  const excludedFixtures = new Set(['202603160008_v1_frontend_fixture_seed.sql',
    '202603180007_v1_staging_fixture_alignment.sql', '202604070005_v1_adjustment_fixture_seed.sql']);
  const files = (await readdir(directory)).filter(f => f.endsWith('.sql') && f < target && !excludedFixtures.has(f)).sort();
  for (const file of files) await load(db, file);
  await db.exec(`grant select,insert,update,delete on all tables in schema public,storage to authenticated,anon,service_role;
    insert into storage.buckets(id,name,public) values('unrelated','unrelated',false);`);
  return files;
}
async function insert(db, table, row) {
  assert.match(table, /^(storage[.]objects|public[.]uploaded_documents)$/);
  const keys = Object.keys(row);
  return db.query(`insert into ${table}(${keys.join(',')}) values(${keys.map((_,i) => `$${i+1}`).join(',')}) returning *`, Object.values(row));
}
async function seed(db) {
  for (const [org, status] of [[A,'active'],[B,'active'],[READONLY,'active'],[ARCHIVED,'archived'],[SUSPENDED,'suspended']]) {
    await db.query(`insert into organizations(id,slug,legal_name,display_name,status,archived_at)
      values($1,$2,'Synthetic','Synthetic',$3::organization_status,case when $3='archived' then now() else null end)`, [org,`synthetic-${org}`,status]);
    await db.query(`insert into subscriptions(organization_id,plan_code,status,period_start,period_end)
      values($1,'synthetic',$2::subscription_status,now()-interval '1 day',now()+interval '1 day')`, [org,org===READONLY?'readonly':'active']);
  }
  for (const [org, user, role, status] of [[A,OWNER,'owner','active'],[A,ADMIN,'admin','active'],[A,EDITOR,'editor','active'],
    [A,VIEWER,'viewer','active'],[A,INACTIVE,'owner','inactive'],[A,INVITED,'editor','invited'],[B,OWNER_B,'owner','active'],
    [A,DUAL,'owner','active'],[B,DUAL,'editor','active'],[READONLY,OWNER_R,'owner','active'],[ARCHIVED,OWNER_X,'owner','active'],[SUSPENDED,OWNER_S,'owner','active']]) {
    await db.query('insert into organization_members(organization_id,user_id,role,status) values($1,$2,$3::member_role,$4::member_status)',[org,user,role,status]);
  }
  for (const [project, org] of [[PA,A],[PB,B],[PA2,A],[PR,READONLY],[PX,ARCHIVED],[PS,SUSPENDED]]) {
    await db.query(`insert into projects(id,organization_id,project_code,name,reporting_start_date,reporting_end_date)
      values($1::uuid,$2,($1::uuid)::text,'Synthetic','2026-01-01','2026-12-31')`,[project,org]);
  }
  await db.query("insert into storage.buckets(id,name,public) values('documents','documents',false)");
  for (const bucket of buckets) for (const project of [PA,PB,PR,PX,PS]) {
    await insert(db,'storage.objects',{bucket_id:bucket,name:path(bucket,project,'TEST_legacy bill.pdf'),owner_id:null});
  }
  // An intentionally legacy row/path/hash is retained and remains readable; no rewrite.
  await insert(db,'public.uploaded_documents',{...receipt(), id:uuid(900),storage_path:path('staging-receipts',PA,'TEST_legacy bill.pdf'),sha256_hash:'legacy-hash'});
}

test('secure upload Storage/receipt SQL with explicit catalog stubs', async t => {
  const db = new PGlite({ extensions:{citext,pgcrypto} });
  try {
    const applied = await bootstrap(db);
    await seed(db);
    await load(db,target);
    t.diagnostic(`Loaded ${applied.length} prerequisite migrations plus ${target}; ${(await db.query('select version()')).rows[0].version}`);
    // Worst-case permissive policy drift, including anon and receipt writes.
    await db.exec(`create policy synthetic_wide_storage on storage.objects for all to public using(true) with check(true);
      create policy synthetic_wide_receipts on uploaded_documents for all to public using(true) with check(true);`);
    async function as(role,user,callback) {
      assert.ok(['authenticated','anon','service_role'].includes(role));
      await db.exec(`set role ${role}`);
      try {
        await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);
        return await callback();
      } finally { await db.exec('reset role'); }
    }
    const app = (user,callback) => as('authenticated',user,callback);
    const object = (r,user=r.uploaded_by_user_id) => insert(db,'storage.objects',{bucket_id:r.storage_bucket,name:r.storage_path,owner_id:user});
    const save = r => insert(db,'public.uploaded_documents',r);
    const denied = callback => assert.rejects(callback, error => error.code === '42501');
    const objects = (user,bucket,project) => app(user,() => db.query('select name from storage.objects where bucket_id=$1 and name=$2',[bucket,path(bucket,project,'TEST_legacy bill.pdf')]));
    await t.test('app roles lack superuser/BYPASSRLS and private helpers are executable rather than ACL-denied', async()=>{
      const roles=(await db.query("select rolname,rolsuper,rolbypassrls from pg_roles where rolname in ('authenticated','anon')")).rows;
      assert.equal(roles.length,2); assert.ok(roles.every(r=>!r.rolsuper&&!r.rolbypassrls));
      assert.equal((await as('anon',null,()=>db.query('select cocal_storage_private.org_access($1,false) as allowed',[A]))).rows[0].allowed,false);
      assert.equal((await app(OWNER,()=>db.query('select cocal_storage_private.org_access($1,true) as allowed',[A]))).rows[0].allowed,true);
      for(const user of [OUTSIDER,OWNER_B])assert.equal((await app(user,()=>db.query('select cocal_storage_private.receipt_binding($1,$2,$3,$4) as allowed',[A,PA,'documents',path('documents',PA,'legacy.pdf')]))).rows[0].allowed,false);
      assert.equal((await as('anon',OWNER,()=>db.query('select cocal_storage_private.receipt_binding($1,$2,$3,$4) as allowed',[A,PA,'documents',path('documents',PA,'legacy.pdf')]))).rows[0].allowed,false);
      assert.equal((await db.query("select relrowsecurity from pg_class where oid='storage.objects'::regclass")).rows[0].relrowsecurity,true);
    });
    for(const bucket of buckets) {
      await t.test(`${bucket}: legacy paths readable to active owner/admin/editor/viewer, cross-tenant hidden`,async()=>{
        for(const user of [OWNER,ADMIN,EDITOR,VIEWER,DUAL]) assert.equal((await objects(user,bucket,PA)).rows.length,1);
        assert.equal((await objects(OWNER_B,bucket,PA)).rows.length,0);
        assert.equal((await objects(OWNER,bucket,PB)).rows.length,0);
        assert.equal((await objects(DUAL,bucket,PB)).rows.length,1);
        assert.equal((await objects(OWNER_R,bucket,PR)).rows.length,1);
        for(const user of [INACTIVE,INVITED,OUTSIDER,null]) assert.equal((await objects(user,bucket,PA)).rows.length,0);
        assert.equal((await objects(OWNER_X,bucket,PX)).rows.length,0);
        assert.equal((await objects(OWNER_S,bucket,PS)).rows.length,0);
      });
      await t.test(`${bucket}: same-tenant owner/admin/editor create real receipt metadata; viewer/inactive/readonly denied`,async()=>{
        for(const user of [OWNER,ADMIN,EDITOR]) {const r=receipt(bucket,PA,A,user);await app(user,async()=>{await object(r);assert.equal((await save(r)).rows[0].id,r.id);});}
        for(const [user,project,org] of [[VIEWER,PA,A],[INACTIVE,PA,A],[INVITED,PA,A],[OUTSIDER,PA,A],[OWNER,PB,B],[OWNER_R,PR,READONLY],[OWNER_X,PX,ARCHIVED],[OWNER_S,PS,SUSPENDED]]) {
          const r=receipt(bucket,project,org,user);await denied(()=>app(user,()=>object(r)));
        }
      });
      await t.test(`${bucket}: authenticated and anonymous path forgery fails despite permissive policies`,async()=>{
        for(const name of [path(bucket,PB,`${uuid(++next)}.pdf`),path(bucket,PA,'old-upload.pdf'),path(bucket,PA,'../bad.pdf'),
          path(bucket,PA,`${uuid(++next)}.exe`),path(bucket,PA,'00000000-0000-1000-8000-000000000001.pdf'),
          path(bucket,PA,'00000000-0000-4000-7000-000000000001.pdf'),
          path(bucket,PA,`${uuid(++next)}.pdf/extra`),'staging/fixtures/file.pdf','bad/path','']) {
          await denied(()=>app(OWNER,()=>insert(db,'storage.objects',{bucket_id:bucket,name,owner_id:OWNER})));
        }
        const r=receipt(bucket);
        for(const user of [null,OWNER]) await denied(()=>as('anon',user,()=>object(r,OWNER)));
        assert.equal((await as('anon',OWNER,()=>db.query('select * from storage.objects where bucket_id=$1',[bucket]))).rows.length,0);
      });
      await t.test(`${bucket}: overwrite/upsert/rename denied; writer DELETE supports new and legacy paths`,async()=>{
        const r=receipt(bucket);await app(OWNER,()=>object(r));
        assert.equal((await app(OWNER,()=>db.query('update storage.objects set metadata=$1 where bucket_id=$2 and name=$3 returning id',[{},bucket,r.storage_path]))).rows.length,0);
        assert.equal((await app(OWNER,()=>db.query('update storage.objects set name=$1 where bucket_id=$2 and name=$3 returning id',[path(bucket,PA,`${uuid(++next)}.pdf`),bucket,r.storage_path]))).rows.length,0);
        await denied(()=>app(OWNER,()=>db.query(`insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)
          on conflict(bucket_id,name) do update set metadata='{}' returning id`,[bucket,r.storage_path,OWNER])));
        for(const user of [VIEWER,INACTIVE,OUTSIDER,OWNER_B]) assert.equal((await app(user,()=>db.query('delete from storage.objects where bucket_id=$1 and name=$2 returning id',[bucket,r.storage_path]))).rows.length,0);
        assert.equal((await app(EDITOR,()=>db.query('delete from storage.objects where bucket_id=$1 and name=$2 returning id',[bucket,r.storage_path]))).rows.length,1);
        const legacy=path(bucket,PA,'additional legacy file.jpg');await insert(db,'storage.objects',{bucket_id:bucket,name:legacy});
        assert.equal((await app(ADMIN,()=>db.query('delete from storage.objects where bucket_id=$1 and name=$2 returning id',[bucket,legacy]))).rows.length,1);
        assert.equal((await app(OWNER_R,()=>db.query('delete from storage.objects where bucket_id=$1 and name=$2 returning id',[bucket,path(bucket,PR,'TEST_legacy bill.pdf')]))).rows.length,0);
      });
    }
    await t.test('malformed stored legacy paths are hidden; valid old receipt is unchanged and readable',async()=>{
      await insert(db,'storage.objects',{bucket_id:'documents',name:`${PA}/../forged.pdf`});
      assert.equal((await app(OWNER,()=>db.query('select name from storage.objects where name=$1',[`${PA}/../forged.pdf`]))).rows.length,0);
      const old=(await app(VIEWER,()=>db.query('select id,sha256_hash from uploaded_documents where id=$1',[uuid(900)]))).rows[0];
      assert.equal(old.sha256_hash,'legacy-hash');
    });
    await t.test('unvalidated historical receipt tenant/path mismatches remain hidden and undeletable without repairing history',async()=>{
      const base={...receipt(),sha256_hash:'historical-unknown-hash',env:'historical-unverified',is_test:false};
      const invalid=[
        {...base,id:uuid(910),organization_id:A,project_id:PB,storage_path:path('staging-receipts',PB,'legacy-other-tenant.pdf')},
        {...base,id:uuid(911),storage_path:path('staging-receipts',PB,'legacy-wrong-prefix.pdf')},
        {...base,id:uuid(912),storage_path:'staging/fixtures/historical.pdf'},
        {...base,id:uuid(913),storage_bucket:'unrelated',storage_path:path('documents',PA,'legacy-unknown-bucket.pdf')},
      ].map((row,index)=>({...row,sha256_hash:`historical-invalid-${index}`}));
      // Only this synthetic in-memory owner fixture bypasses FK triggers to model
      // rows that predate NOT VALID tenant constraints. Restore before app queries.
      await db.exec('set session_replication_role=replica');
      try {for(const row of invalid) await save(row);}
      finally {await db.exec('set session_replication_role=origin');}
      assert.equal((await db.query("select convalidated from pg_constraint where conname='uploaded_documents_project_tenant_fk'")).rows[0].convalidated,false);
      const ids=invalid.map(row=>row.id);
      for(const user of [OWNER,ADMIN,EDITOR,VIEWER,DUAL,OWNER_B]) {
        assert.equal((await app(user,()=>db.query('select id from uploaded_documents where id=any($1::uuid[])',[ids]))).rows.length,0);
        assert.equal((await app(user,()=>db.query('delete from uploaded_documents where id=any($1::uuid[]) returning id',[ids]))).rows.length,0);
      }
      const raw=(await db.query('select id,organization_id,project_id,storage_bucket,storage_path from uploaded_documents where id=any($1::uuid[]) order by id',[ids])).rows;
      assert.deepEqual(raw,invalid.map(({id,organization_id,project_id,storage_bucket,storage_path})=>({id,organization_id,project_id,storage_bucket,storage_path})));
      // Legal legacy path/tenant bindings do not require new filename/hash/env or
      // object owner validation merely to read/delete historical receipt rows.
      const legal={...base,id:uuid(914),storage_bucket:'documents',storage_path:path('documents',PA,'old legal original.pdf'),sha256_hash:'historical-legal-hash'};
      await save(legal);
      assert.equal((await app(VIEWER,()=>db.query('select id from uploaded_documents where id=$1',[legal.id]))).rows.length,1);
      assert.equal((await app(EDITOR,()=>db.query('delete from uploaded_documents where id=$1 returning id',[legal.id]))).rows.length,1);
      assert.equal((await db.query('select count(*)::int as count from uploaded_documents where id=any($1::uuid[])',[ids])).rows[0].count,invalid.length);
    });
    await t.test('receipt rejects forged identity/project/uploader/path/environment/OCR and absent object',async()=>{
      const r=receipt();await app(OWNER,()=>object(r));
      const mutations=[{id:uuid(++next)},{organization_id:B},{project_id:PA2},{project_id:PB,organization_id:B},
        {uploaded_by_user_id:ADMIN},{uploaded_by_user_id:null},{storage_path:path(r.storage_bucket,PA,`${uuid(++next)}.pdf`)},
        {storage_bucket:'documents'},{env:'production'},{is_test:false},{ocr_status:'succeeded'},{ocr_status:'processing'},
        {status:'archived',archived_at:new Date().toISOString()},{file_size_bytes:0},{sha256_hash:'fake'},{original_filename:''}];
      for(const patch of mutations) await denied(()=>app(OWNER,()=>save({...r,...patch})));
      await denied(()=>app(OWNER,()=>save(receipt())));
      const someoneElse=receipt();await app(ADMIN,()=>object(someoneElse,ADMIN));
      await denied(()=>app(OWNER,()=>save(someoneElse)));
      assert.equal((await app(OWNER,()=>save(r))).rows[0].id,r.id);
    });
    await t.test('production receipt must explicitly opt out of staging defaults',async()=>{
      const r=receipt('documents');await app(OWNER,()=>object(r));
      const {env,is_test,...withoutEnvironment}=r;
      await denied(()=>app(OWNER,()=>save(withoutEnvironment)));
      await denied(()=>app(OWNER,()=>save({...r,env:'staging',is_test:true})));
      assert.equal((await app(OWNER,()=>save(r))).rows[0].env,'production');
    });
    await t.test('all permitted new extensions work without accepting a legacy basename for new writes',async()=>{
      for(const extension of ['pdf','jpg','jpeg','png']) {
        const r=receipt('staging-attachments');r.storage_path=path(r.storage_bucket,PA,`${r.id}.${extension}`);
        await app(OWNER,async()=>{await object(r);assert.equal((await save(r)).rows[0].storage_path,r.storage_path);});
      }
    });
    await t.test('dual membership cannot forge a project-to-organization receipt binding',async()=>{
      const r=receipt('documents',PA,A,DUAL);await app(DUAL,()=>object(r));
      assert.equal((await app(DUAL,()=>db.query('select cocal_storage_private.org_access($1,true) as a,cocal_storage_private.org_access($2,true) as b',[A,B]))).rows[0].b,true);
      await denied(()=>app(DUAL,()=>save({...r,organization_id:B})));
      assert.equal((await app(DUAL,()=>save(r))).rows[0].organization_id,A);
    });
    await t.test('membership revoked after object INSERT prevents the later receipt INSERT',async()=>{
      const r=receipt('documents',PA,A,EDITOR);await app(EDITOR,()=>object(r));
      await db.query("update organization_members set status='inactive' where organization_id=$1 and user_id=$2",[A,EDITOR]);
      try {await denied(()=>app(EDITOR,()=>save(r)));}
      finally {await db.query("update organization_members set status='active' where organization_id=$1 and user_id=$2",[A,EDITOR]);}
    });
    await t.test('receipt INSERT still rejects viewer/inactive/readonly/anon after an object was saved by service',async()=>{
      for(const [user,project,org] of [[VIEWER,PA,A],[INACTIVE,PA,A],[OUTSIDER,PA,A],[OWNER_R,PR,READONLY],[OWNER,PB,B]]) {
        const r=receipt('staging-receipts',project,org,user);await object(r);
        await denied(()=>app(user,()=>save(r)));
      }
      const r=receipt();await object(r);await denied(()=>as('anon',OWNER,()=>save(r)));
    });
    await t.test('receipt identity and status cannot be updated by authenticated users; service maintenance retained',async()=>{
      const r=receipt();await app(OWNER,async()=>{await object(r);await save(r);});
      for(const patch of [{id:uuid(++next)},{organization_id:B},{project_id:PA2},{uploaded_by_user_id:ADMIN},
        {storage_path:'forged'},{storage_bucket:'documents'},{env:'production'},{is_test:false},{ocr_status:'succeeded'},{metadata:{fake:true}}]) {
        const [key,value]=Object.entries(patch)[0];
        assert.equal((await app(OWNER,()=>db.query(`update uploaded_documents set ${key}=$1 where id=$2 returning id`,[value,r.id]))).rows.length,0);
      }
      assert.equal((await as('service_role',null,()=>db.query("update uploaded_documents set ocr_status='processing' where id=$1 returning id",[r.id]))).rows.length,1);
      for(const user of [VIEWER,OWNER_B,INACTIVE]) assert.equal((await app(user,()=>db.query('delete from uploaded_documents where id=$1 returning id',[r.id]))).rows.length,0);
      assert.equal((await app(OWNER,()=>db.query('delete from uploaded_documents where id=$1 returning id',[r.id]))).rows.length,1);
    });
    await t.test('unrelated bucket behavior remains permitted; renaming INTO a protected bucket is rejected',async()=>{
      await app(OUTSIDER,()=>insert(db,'storage.objects',{bucket_id:'unrelated',name:'unchanged/file.bin'}));
      assert.equal((await as('anon',null,()=>db.query("select id from storage.objects where bucket_id='unrelated'"))).rows.length,1);
      assert.equal((await app(OUTSIDER,()=>db.query("update storage.objects set metadata='{}' where bucket_id='unrelated' returning id"))).rows.length,1);
      await denied(()=>app(OWNER,()=>db.query("update storage.objects set bucket_id='documents',name=$1 where bucket_id='unrelated'",[path('documents',PA,`${uuid(++next)}.pdf`)])));
      assert.equal((await app(OUTSIDER,()=>db.query("delete from storage.objects where bucket_id='unrelated' returning id"))).rows.length,1);
    });
    await t.test('versioned read-only capability RPC returns only the requested accessible project',async()=>{
      const probe=(user,project=PA)=>app(user,()=>db.query('select * from public.upload_intake_contract($1)',[project]));
      for(const user of [OWNER,ADMIN,EDITOR]) assert.deepEqual((await probe(user)).rows,[{project_id:PA,organization_id:A,contract_version:'20261102',can_write:true}]);
      assert.equal((await probe(VIEWER)).rows[0].can_write,false);
      assert.equal((await probe(OWNER_R,PR)).rows[0].can_write,false);
      assert.equal((await probe(DUAL,PB)).rows[0].can_write,true);
      for(const user of [OWNER_B,INACTIVE,INVITED,OUTSIDER,null]) assert.deepEqual((await probe(user)).rows,[]);
      assert.deepEqual((await probe(OWNER_X,PX)).rows,[]);
      assert.deepEqual((await probe(OWNER_S,PS)).rows,[]);
      assert.deepEqual((await probe(OWNER,uuid(999999))).rows,[]);
      await denied(()=>as('anon',OWNER,()=>db.query('select * from public.upload_intake_contract($1)',[PA])));
      const grants=(await db.query(`select
        has_function_privilege('authenticated','public.upload_intake_contract(uuid)','execute') as authenticated,
        has_function_privilege('anon','public.upload_intake_contract(uuid)','execute') as anon,
        has_function_privilege('authenticated','cocal_storage_private.deployment_ready()','execute') as private_probe`)).rows[0];
      assert.deepEqual(grants,{authenticated:true,anon:false,private_probe:false});
    });
    await t.test('capability RPC fails closed on missing/public buckets, disabled RLS or missing/disabled guards',async()=>{
      const probe=()=>app(OWNER,()=>db.query('select * from public.upload_intake_contract($1)',[PA]));
      const mutations=[];
      for(const bucket of buckets) {
        mutations.push(`delete from storage.objects where bucket_id='${bucket}';delete from storage.buckets where id='${bucket}'`);
        mutations.push(`update storage.buckets set public=true where id='${bucket}'`);
      }
      for(const table of ['storage.objects','public.uploaded_documents']) mutations.push(`alter table ${table} disable row level security`);
      for(const [table,prefix] of [['storage.objects','cocal_upload'],['public.uploaded_documents','cocal_receipt']]) {
        for(const command of ['select','insert','update','delete']) mutations.push(`drop policy ${prefix}_${command}_guard on ${table}`);
      }
      mutations.push('alter table public.uploaded_documents disable trigger cocal_receipt_write_guard');
      // A guard name alone is insufficient: permissive mode must also fail readiness.
      mutations.push('drop policy cocal_upload_select_guard on storage.objects;create policy cocal_upload_select_guard on storage.objects for select to public using(true)');
      for(const sql of mutations) {
        await db.exec('begin');
        try {
          await db.exec(sql);
          assert.deepEqual((await probe()).rows,[{project_id:PA,organization_id:A,contract_version:'20261102',can_write:false}],sql);
        } finally {await db.exec('rollback');}
        assert.equal((await probe()).rows[0].can_write,true);
      }
    });
    await t.test('all protected guards are restrictive PUBLIC policies and buckets remain private',async()=>{
      const guards=(await db.query("select policyname,permissive,roles from pg_policies where policyname like 'cocal_%_guard' order by policyname")).rows;
      assert.equal(guards.length,8);assert.ok(guards.every(p=>p.permissive==='RESTRICTIVE'&&p.roles.includes('public')));
      assert.ok((await db.query('select public from storage.buckets where id=any($1::text[])',[buckets])).rows.every(b=>b.public===false));
      assert.equal((await app(OWNER_B,()=>db.query('select id from uploaded_documents where organization_id=$1',[A]))).rows.length,0);
      assert.equal((await as('anon',OWNER,()=>db.query('select id from uploaded_documents'))).rows.length,0);
    });
  } finally { await db.close(); }
});

test('migration source creates absent documents privately and refuses existing public bucket drift atomically',async t=>{
  for(const publicBucket of [null,'documents','staging-receipts','staging-attachments']) await t.test(publicBucket||'missing documents',async()=>{
    const db=new PGlite({extensions:{citext,pgcrypto}});
    try {
      await bootstrap(db);
      if(publicBucket==='documents') await db.query("insert into storage.buckets(id,name,public) values('documents','documents',true)");
      else if(publicBucket) await db.query('update storage.buckets set public=true where id=$1',[publicBucket]);
      if(publicBucket) {
        await assert.rejects(load(db,target),error=>error.code==='42501'&&/public/.test(error.message));
        await db.exec('rollback');
        assert.equal((await db.query("select count(*)::int as n from pg_policies where policyname like 'cocal_upload_%'")).rows[0].n,0);
      } else {
        await load(db,target);
        assert.deepEqual((await db.query("select id,public from storage.buckets where id='documents'")).rows,[{id:'documents',public:false}]);
      }
    } finally {await db.close();}
  });
});
