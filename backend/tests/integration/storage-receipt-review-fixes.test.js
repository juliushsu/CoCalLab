import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
if (!process.env.PGLITE_RUNTIME_ROOT) throw new Error('PGLITE_RUNTIME_ROOT is required.');
const require=createRequire(resolve(process.env.PGLITE_RUNTIME_ROOT,'package.json'));
const {PGlite}=require('@electric-sql/pglite');
const {citext}=require('@electric-sql/pglite/contrib/citext');
const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
const directory=new URL('../../supabase/migrations/',import.meta.url);
const original='202611020001_secure_upload_storage.sql',fix='202611020002_storage_receipt_review_fixes.sql';
const baseline=process.env.STORAGE_REVIEW_BASELINE==='1';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const O=id(1),P='abcdefab-1234-4000-8000-000000000011',U=id(101);
let sequence=1000;
const make=()=>{const document=id(++sequence);return {id:document,organization_id:O,project_id:P,uploaded_by_user_id:U,
  storage_bucket:'staging-receipts',storage_path:`staging/${P}/${document}.pdf`,original_filename:'synthetic.pdf',
  mime_type:'application/pdf',file_size_bytes:16,sha256_hash:sequence.toString(16).padStart(64,'0'),document_type:'other',
  ocr_status:'pending',status:'active',metadata:{intake_mode:'upload_only'},env:'staging',is_test:true};};
async function setup(){
  const db=new PGlite({extensions:{citext,pgcrypto}});
  await db.exec(`create schema auth;create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create role authenticated nologin nosuperuser nobypassrls;create role anon nologin nosuperuser nobypassrls;
    create role service_role nologin nosuperuser bypassrls;create schema storage;
    create table storage.buckets(id text primary key,name text not null,public boolean not null default false);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),
      name text not null,owner uuid,owner_id text,metadata jsonb,unique(bucket_id,name));alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
    grant usage on schema auth,public,storage to authenticated,anon,service_role;`);
  const excluded=new Set(['202603160008_v1_frontend_fixture_seed.sql','202603180007_v1_staging_fixture_alignment.sql','202604070005_v1_adjustment_fixture_seed.sql']);
  for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')&&f<=original&&!excluded.has(f)).sort())await db.exec(await readFile(new URL(file,directory),'utf8'));
  if(!baseline)await db.exec(await readFile(new URL(fix,directory),'utf8'));
  // Only ordinary table fixture grants, never private baseline/helper grants.
  await db.exec('grant select,insert,update,delete on all tables in schema public,storage to authenticated,anon,service_role');
  await db.query("insert into organizations(id,slug,legal_name,display_name) values($1,'synthetic-review','Synthetic','Synthetic')",[O]);
  await db.query("insert into organization_members(organization_id,user_id,role,status) values($1,$2,'editor','active')",[O,U]);
  await db.query("insert into subscriptions(organization_id,plan_code,status,period_start,period_end) values($1,'synthetic','active',now()-interval '1 day',now()+interval '1 day')",[O]);
  await db.query("insert into projects(id,organization_id,project_code,name,reporting_start_date,reporting_end_date) values($1,$2,'TEST','Synthetic','2026-01-01','2026-12-31')",[P,O]);
  await db.exec(`create policy synthetic_review_wide_storage on storage.objects for all to public using(true) with check(true);
    create policy synthetic_review_wide_receipts on uploaded_documents for all to public using(true) with check(true)`);
  return db;
}
async function as(db,callback){await db.exec('set role authenticated');try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[U]);return await callback();}finally{await db.exec('reset role');}}
const denied=callback=>assert.rejects(callback,error=>error.code==='42501');
async function save(db,row){const keys=Object.keys(row);return db.query(`insert into uploaded_documents(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning id`,Object.values(row));}
const object=(db,r,metadata={size:16,mimetype:'application/pdf'})=>db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',[r.storage_bucket,r.storage_path,U,metadata]);
const probe=db=>as(db,()=>db.query('select * from public.upload_intake_contract($1)',[P]));

test('review defects: direct-role metadata, canonical write path, deployment drift',async t=>{
  const db=await setup();
  try{
    t.diagnostic(baseline?'RED mode: original 001 only; no corrective migration loaded':'GREEN mode: full prerequisite policy chain plus 001 and 002; synthetic catalog/auth only');
    await t.test('P2-S3 rejects object/receipt size mismatch with 42501',async()=>{const r=make();await as(db,()=>object(db,r));await denied(()=>as(db,()=>save(db,{...r,file_size_bytes:1})));});
    await t.test('P2-S3 rejects object/receipt MIME mismatch with 42501',async()=>{const r=make();await as(db,()=>object(db,r,{size:16,mimetype:'image/png'}));await denied(()=>as(db,()=>save(db,r)));});
    await t.test('P2-S3 rejects missing object metadata with 42501',async()=>{const r=make();await as(db,()=>object(db,r,null));await denied(()=>as(db,()=>save(db,r)));});
    await t.test('P3-a uppercase project INSERT is rejected before an object catalog row exists',async()=>{const r=make();r.storage_path=r.storage_path.replace(P,P.toUpperCase());await denied(()=>as(db,()=>object(db,r)));});
    for(const [name,sql] of [
      ['same-name restrictive policy weakened to true','alter policy cocal_upload_insert_guard on storage.objects with check(true)'],
      ['trigger recreated AFTER UPDATE only',`drop trigger cocal_receipt_write_guard on uploaded_documents;create trigger cocal_receipt_write_guard after update on uploaded_documents for each row execute function cocal_storage_private.guard_receipt_write()`],
      ['helper body replaced',`create or replace function cocal_storage_private.project_access(project uuid,writing boolean) returns boolean language sql stable security definer set search_path='' as 'select true'`],
      ['helper search_path changed','alter function cocal_storage_private.org_access(uuid,boolean) set search_path=public'],
      ['helper execute ACL expanded','grant execute on function cocal_storage_private.guard_receipt_write() to authenticated'],
    ])await t.test(`P3-f readiness rejects ${name}`,async()=>{await db.exec('begin');try{await db.exec(sql);assert.equal((await probe(db)).rows[0].can_write,false);}finally{await db.exec('rollback');}});
    if(!baseline){
      await t.test('healthy 002 compatibility is true with exact new version; private baseline is not app-readable/writable',async()=>{
        assert.deepEqual((await probe(db)).rows,[{project_id:P,organization_id:O,contract_version:'20261102.2',can_write:true}]);
        for(const sql of ['select * from cocal_storage_private.deployment_baseline',"update cocal_storage_private.deployment_baseline set fingerprint='fake'",'select * from cocal_storage_private.catalog_state()'])await denied(()=>as(db,()=>db.query(sql)));
        const role=(await as(db,()=>db.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user'))).rows[0];
        assert.deepEqual(role,{rolsuper:false,rolbypassrls:false});
      });
      const invalidMetadata=[null,[],true,16,'"not an object"',{},
        {mimetype:'application/pdf'},{size:16},{size:null,mimetype:'application/pdf'},
        ...['16','1e1','NaN','9223372036854775808','',true,[],{},0,-1,1.5].map(size=>({size,mimetype:'application/pdf'})),
        ...[null,16,[],{},'',' APPLICATION/PDF','application/PDF','application/octet-stream','image/jpg'].map(mimetype=>({size:16,mimetype}))];
      for(const [index,metadata] of invalidMetadata.entries())await t.test(`metadata invalid case ${index}: missing/type/range/MIME rejects exactly 42501`,async()=>{
        const r=make();await as(db,()=>object(db,r,metadata));await denied(()=>as(db,()=>save(db,r)));
      });
      for(const raw of ['{"size":16.0,"mimetype":"application/pdf"}','{"size":9223372036854775808,"mimetype":"application/pdf"}','{"size":1e100,"mimetype":"application/pdf"}'])await t.test(`raw JSON size ${raw}: no unsafe cast error escapes`,async()=>{
        const r=make();await as(db,()=>db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4::jsonb)',[r.storage_bucket,r.storage_path,U,raw]));
        await denied(()=>as(db,()=>save(db,r)));
      });
      for(const bucket of ['documents','staging-receipts','staging-attachments'])await t.test(`${bucket}: matching canonical metadata saves; uppercase legacy still reads/deletes`,async()=>{
        for(const mime of ['application/pdf','image/jpeg','image/png']){
          const r={...make(),storage_bucket:bucket,env:bucket==='documents'?'production':'staging',is_test:bucket!=='documents',mime_type:mime};
          r.storage_path=`${bucket==='documents'?'':'staging/'}${P}/${r.id}.${mime==='application/pdf'?'pdf':mime==='image/png'?'png':'jpg'}`;
          await as(db,async()=>{await object(db,r,{size:16,mimetype:mime});assert.equal((await save(db,r)).rows[0].id,r.id);});
        }
        const fresh=make(),upperPath=`${bucket==='documents'?'':'staging/'}${P.toUpperCase()}/${fresh.id}.pdf`;
        await denied(()=>as(db,()=>object(db,{...fresh,storage_bucket:bucket,storage_path:upperPath})));
        assert.equal((await db.query('select id from storage.objects where bucket_id=$1 and name=$2',[bucket,upperPath])).rows.length,0);
        const old={...make(),storage_bucket:bucket,storage_path:`${bucket==='documents'?'':'staging/'}${P.toUpperCase()}/LEGACY old filename.pdf`,sha256_hash:'legacy-hash-'+bucket,env:'historical-unknown'};
        await object(db,old,null);await save(db,old); // Explicit synthetic owner history, not app writes.
        assert.equal((await as(db,()=>db.query('select id from uploaded_documents where id=$1',[old.id]))).rows.length,1);
        assert.equal((await as(db,()=>db.query('select id from storage.objects where bucket_id=$1 and name=$2',[bucket,old.storage_path]))).rows.length,1);
        assert.equal((await as(db,()=>db.query('delete from uploaded_documents where id=$1 returning id',[old.id]))).rows.length,1);
        assert.equal((await as(db,()=>db.query('delete from storage.objects where bucket_id=$1 and name=$2 returning id',[bucket,old.storage_path]))).rows.length,1);
      });
      await t.test('additional metadata trigger preserves anonymous refusal and explicit service maintenance',async()=>{
        const r=make();await object(db,r,{size:16,mimetype:'application/pdf'});
        await db.exec('set role anon');
        try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[U]);await denied(()=>save(db,r));}
        finally{await db.exec('reset role');}
        await db.exec('set role service_role');
        try{assert.equal((await save(db,{...r,mime_type:null,file_size_bytes:1})).rows[0].id,r.id);}
        finally{await db.exec('reset role');}
      });
      for(const [name,sql] of [
        ['policy USING content','alter policy cocal_upload_select_guard on storage.objects using(true)'],
        ['policy CHECK NULL','alter policy cocal_upload_insert_guard on storage.objects with check(NULL)'],
        ['trigger WHEN clause',`drop trigger cocal_receipt_write_guard on uploaded_documents;create trigger cocal_receipt_write_guard before insert or update on uploaded_documents for each row when(false) execute function cocal_storage_private.guard_receipt_write()`],
        ['metadata trigger disabled','alter table uploaded_documents disable trigger cocal_receipt_metadata_guard'],
        ['metadata guard body',`create or replace function cocal_storage_private.guard_receipt_metadata() returns trigger language plpgsql security invoker set search_path='' as 'begin return new;end'`],
        ['helper search_path reset to NULL','alter function cocal_storage_private.org_access(uuid,boolean) reset all'],
        ['helper definer changed','alter function cocal_storage_private.org_access(uuid,boolean) security invoker'],
        ['helper ACL revoked','revoke execute on function cocal_storage_private.org_access(uuid,boolean) from authenticated'],
        ['helper owner changed','alter function cocal_storage_private.project_access(uuid,boolean) owner to service_role'],
        ['related membership helper body',`create or replace function public.is_active_org_member(target_org_id uuid,allowed_roles public.member_role[] default null) returns boolean language sql stable security definer set search_path=public as 'select true'`],
        ['schema ACL expanded','grant create on schema cocal_storage_private to authenticated'],
        ['baseline ACL expanded','grant select,update on cocal_storage_private.deployment_baseline to authenticated'],
        ['baseline row missing',"delete from cocal_storage_private.deployment_baseline where kind='policy' and object_key like '%insert_guard'"],
      ])await t.test(`fingerprint rejects ${name} and resumes after disposable rollback`,async()=>{
        await db.exec('begin');try{await db.exec(sql);assert.equal((await probe(db)).rows[0].can_write,false);}finally{await db.exec('rollback');}
        assert.equal((await probe(db)).rows[0].can_write,true);
      });
      await t.test('OPEN: format-valid forged SHA still reserves the project/hash unique key; no server-byte attestation',async()=>{
        const first={...make(),sha256_hash:'f'.repeat(64)};await as(db,async()=>{await object(db,first);await save(db,first);});
        const second={...make(),sha256_hash:first.sha256_hash};await as(db,()=>object(db,second));
        await assert.rejects(()=>as(db,()=>save(db,second)),error=>error.code==='23505'&&error.constraint==='uploaded_documents_project_hash_uniq');
        assert.equal((await as(db,()=>db.query('select id from uploaded_documents where project_id=$1 and sha256_hash=$2',[P,first.sha256_hash]))).rows[0].id,first.id);
      });
    }
  }finally{await db.close();}
});
