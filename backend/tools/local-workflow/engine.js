// TEST/LAB ONLY. No cloud client, credentials, OCR provider or production adapter.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFile,readdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {confirm_draft_to_emission_activity} from '../../src/services/confirm-draft.js';
import {calculate_emission_activity} from '../../src/services/calculate-emission-activity.js';
import {recalculate_project} from '../../src/services/recalculate-project.js';
import {build_report_payload} from '../../src/services/build-report-payload.js';
import {validateConfirmDraftInput} from '../../src/contracts/contracts.js';
import {verifyStoredFile} from '../../../modules/file-verification/index.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function input(value,keys) {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw new Error('UNKNOWN_FIELD: local run scope is fixed');
}
function manual(value) {
  input(value,['quantity','unit','activityDate','finalScope']);
  const out={quantity:100,unit:'kWh',activityDate:'2026-01-15',finalScope:2,...value};
  if(typeof out.quantity!=='number'||!Number.isFinite(out.quantity)||out.quantity<0||out.unit!=='kWh'||out.finalScope!==2||
    !/^\d{4}-\d{2}-\d{2}$/.test(out.activityDate)||Number.isNaN(Date.parse(out.activityDate))||
    new Date(out.activityDate).toISOString().slice(0,10)!==out.activityDate||!out.activityDate.startsWith('2026-'))throw new Error('INVALID_MANUAL_INPUT');
  return out;
}
export async function createLocalWorkflow({fault=async()=>{}}={}) {
  if(!process.env.PGLITE_RUNTIME_ROOT)throw new Error('PGLITE_RUNTIME_ROOT must point to the installed local @electric-sql/pglite@0.5.13 runtime');
  const require=createRequire(resolve(process.env.PGLITE_RUNTIME_ROOT,'package.json'));
  const {PGlite}=require('@electric-sql/pglite');
  const {citext}=require('@electric-sql/pglite/contrib/citext');
  const {pgcrypto}=require('@electric-sql/pglite/contrib/pgcrypto');
  const db=new PGlite({extensions:{citext,pgcrypto}});
  const scope=Object.freeze({organizationId:randomUUID(),projectId:randomUUID(),userId:randomUUID(),documentId:randomUUID(),draftId:randomUUID(),factorId:randomUUID()});
  const bytes=Buffer.from('%PDF-1.7\nSYNTHETIC LOCAL WORKFLOW ONLY\nManual transcription: 100 kWh, 2026-01-15\n%%EOF\n');
  const bucket='staging-receipts',path='staging/'+scope.projectId+'/'+scope.documentId+'.pdf';
  const objects=new Map(),metrics={objectWrites:0},migrations=[],omitted=[];
  let queue=Promise.resolve(),closed=false;
  const serial=fn=>{const next=queue.then(()=>{if(closed)throw new Error('RUN_CLOSED');return fn();});queue=next.catch(()=>{});return next;};
  const rows=async(sql,params=[]) => (await db.query(sql,params)).rows;
  async function as(role,fn){
    if(!['authenticated','anon','service_role'].includes(role))throw new Error('INVALID_LOCAL_ROLE');
    await db.exec('set role '+role);
    let failed=false;
    try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[scope.userId]);return await fn();}
    catch(error){failed=true;throw error;}
    finally{
      // An aborted SQL transaction rejects RESET ROLE with 25P02. Preserve the
      // original database error; the surrounding rollback also restores role.
      try{await db.exec('reset role');}catch(error){if(!failed)throw error;}
    }
  }
  async function transaction(fn){await db.exec('begin');try{const value=await fn();await db.exec('commit');return value;}catch(error){await db.exec('rollback');throw error;}}
  async function insert(table,row){const keys=Object.keys(row);return rows('insert into '+table+'('+keys.join(',')+') values('+keys.map((_,i)=>'$'+(i+1)).join(',')+') returning *',Object.values(row));}
  async function own(table){return rows('select * from '+table+' where organization_id=$1 and project_id=$2 order by created_at,id',[scope.organizationId,scope.projectId]);}
  async function state(){
    const receipt=await own('uploaded_documents'),draft=await own('extracted_document_drafts'),activity=await own('emission_activities'),calculation=await own('calculation_results'),report=await own('report_generations');
    const reportCurrent=Boolean(report[0]&&report[0].payload.appendix_mappings?.length===activity.length&&activity.length>0&&report[0].payload.appendix_mappings.every(mapping=>calculation.some(row=>row.id===mapping.calculation_result_id&&row.is_latest&&row.status==='calculated')));
    return {synthetic:true,scope,metrics:{...metrics},receipt:receipt[0]??null,draft:draft[0]??null,activity:activity[0]??null,activities:activity,calculations:calculation,report:report[0]??null,reportCurrent,
      counts:{objects:objects.size,receipts:receipt.length,drafts:draft.length,activities:activity.length,calculations:calculation.length,reports:report.length},
      migrations,omittedMigrations:omitted,gaps:[
        'MISSING: production non-Mock document-to-draft entry; this lab uses explicit human transcription into a local draft. OCR stays pending.',
        'NOT_RUN: real Supabase Auth/JWT/Storage HTTP, Edge handlers, production report second-phase patch, cloud migration/restore.',
        'OPEN: production RPC retry/idempotency, server byte/hash attestation and hash uniqueness poisoning.',
      ]};
  }
  async function calculationInputs(){
    const activities=await own('emission_activities');
    const calculations=(await own('calculation_results')).filter(r=>r.is_latest);
    if(activities.length!==1||activities[0].status!=='active'||activities[0].inclusion_status!=='included')throw new Error('REPORT_NOT_READY: exactly one confirmed active included activity is required');
    const activity=activities[0],latest=calculations.filter(r=>r.emission_activity_id===activity.id);
    if(latest.length!==1||latest[0].status!=='calculated'||latest[0].co2e_kg===null||!Number.isFinite(Number(latest[0].co2e_kg))||Number(latest[0].co2e_kg)<0)throw new Error('REPORT_NOT_READY: a real latest calculated value is required, never a zero fallback');
    const receipt=(await own('uploaded_documents'))[0],draft=(await own('extracted_document_drafts'))[0];
    if(!receipt||!draft||draft.status!=='confirmed'||activity.source_document_id!==receipt.id||activity.source_draft_id!==draft.id||draft.uploaded_document_id!==receipt.id)throw new Error('LINEAGE_MISMATCH');
    const original=objects.get(path);
    if(!original||hash(original)!==receipt.sha256_hash||original.length!==Number(receipt.file_size_bytes))throw new Error('ORIGINAL_MISMATCH');
    return {activities,calculations};
  }
  try{
    await db.exec("create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create role authenticated nologin nosuperuser nobypassrls;create role anon nologin nosuperuser nobypassrls;create role service_role nologin nosuperuser bypassrls;create schema storage;create table storage.buckets(id text primary key,name text not null,public boolean not null default false);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,owner uuid,owner_id text,metadata jsonb,unique(bucket_id,name));alter table storage.objects enable row level security;create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;grant usage on schema auth,public,storage to authenticated,anon,service_role;");
    const directory=new URL('../../supabase/migrations/',import.meta.url);
    const excluded=new Set(['202603160008_v1_frontend_fixture_seed.sql','202603180007_v1_staging_fixture_alignment.sql','202604070005_v1_adjustment_fixture_seed.sql']);
    for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')).sort()){
      if(excluded.has(file)){omitted.push(file);continue;}
      const source=await readFile(new URL(file,directory),'utf8');await db.exec(source);migrations.push({file,sha256:hash(source)});
    }
    await db.exec('grant select,insert,update,delete on all tables in schema public,storage to authenticated,anon,service_role');
    // Test catalog grants must not override the operational ledger migration ACL.
    await db.exec('revoke all on report_snapshot_requests_v2 from authenticated,anon');
    await insert('organizations',{id:scope.organizationId,slug:'synthetic-local-'+scope.organizationId,legal_name:'SYNTHETIC LOCAL ONLY',display_name:'SYNTHETIC LOCAL ONLY'});
    await insert('organization_members',{organization_id:scope.organizationId,user_id:scope.userId,role:'editor',status:'active'});
    await insert('subscriptions',{organization_id:scope.organizationId,plan_code:'SYNTHETIC',status:'active',period_start:'2020-01-01',period_end:'2099-01-01'});
    await insert('projects',{id:scope.projectId,organization_id:scope.organizationId,project_code:'SYNTHETIC-LOCAL',name:'SYNTHETIC local workflow',reporting_start_date:'2026-01-01',reporting_end_date:'2026-12-31'});
  }catch(error){await db.close();throw error;}
  return {
    db,scope,
    receive: (value={})=>serial(async()=>{
      input(value,[]);
      if(objects.has(path)){if(hash(objects.get(path))!==hash(bytes))throw new Error('ORIGINAL_MISMATCH');}
      else{
        await as('authenticated',()=>transaction(async()=>{
          const probe=await rows('select * from upload_verification_contract($1)',[scope.projectId]);
          if(probe[0]?.contract_version!=='20261106.hash.1'||!probe[0]?.can_verify)throw new Error('INTAKE_NOT_READY');
          await insert('storage.objects',{bucket_id:bucket,name:path,owner_id:scope.userId,metadata:{size:bytes.length,mimetype:'application/pdf'}});
        }));
        objects.set(path,Buffer.from(bytes));metrics.objectWrites++;
      }
      await fault('receipt-after-object');
      if(!(await own('uploaded_documents')).length){
        // Explicit lab server adapter: hash the actual synthetic in-memory bytes,
        // then execute the same service-only reservation/completion SQL. No HTTP
        // or real Storage/Auth verification is implied by this lab operation.
        const intent={organization_id:scope.organizationId,project_id:scope.projectId,document_id:scope.documentId,request_id:scope.documentId,storage_bucket:bucket,storage_path:path,original_filename:'SYNTHETIC-LOCAL-ONLY.pdf',document_type:'receipt',file_size_bytes:bytes.length,mime_type:'application/pdf'};
        await as('service_role',()=>rows('select * from begin_upload_verification($1,$2)',[scope.userId,intent]));
        const actual=await verifyStoredFile({storage:{read:async()=>({body:objects.get(path),mimeType:'application/pdf',contentLength:bytes.length})},reference:{path},expected:{size:bytes.length,mimeType:'application/pdf'}});
        await as('service_role',()=>rows('select * from complete_upload_verification($1,$2,$3,$4,$5,$6)',[scope.userId,scope.documentId,scope.documentId,actual.sha256,actual.size,actual.mimeType]));
      }
      return state();
    }),
    review:(value={})=>serial(async()=>{
      const entered=manual(value),receipt=(await own('uploaded_documents'))[0];
      if(!receipt)throw new Error('RECEIPT_REQUIRED');
      let draft=(await own('extracted_document_drafts'))[0];
      if(draft&&JSON.stringify(draft.normalized_payload)!==JSON.stringify(JSON.parse(JSON.stringify(entered)))){
        if(Object.keys(entered).some(k=>draft.normalized_payload[k]!==entered[k]))throw new Error('REVIEW_CONFLICT: keep the existing confirmed input');
      }
      if(draft?.status==='confirmed')return state();
      await transaction(async()=>{await as('service_role',async()=>{
        if(!draft)[draft]=await insert('extracted_document_drafts',{id:scope.draftId,organization_id:scope.organizationId,project_id:scope.projectId,uploaded_document_id:receipt.id,extraction_version:1,extraction_provider:'LOCAL_MANUAL_TRANSCRIPTION_NO_OCR',raw_payload:{synthetic:true,mode:'human_entry',no_ocr:true},normalized_payload:entered,status:'pending_review',is_latest:true,env:'staging',is_test:true});
        const overrides={quantity:entered.quantity,unit:entered.unit,activity_date:entered.activityDate,final_scope:entered.finalScope,activity_name:'SYNTHETIC manually transcribed electricity',category:'energy',subcategory:'purchased_electricity',activity_type:'electricity',inclusion_status:'included',review_note:'SYNTHETIC local human confirmation; no OCR/classification'};
        validateConfirmDraftInput({organization_id:scope.organizationId,project_id:scope.projectId,draft_id:draft.id,decision:'confirmed',overrides});
        const transformed=confirm_draft_to_emission_activity({draft,decision:'confirmed',overrides,next_activity_code:'SYNTHETIC-EA-000001'});
        const factors=await rows('select * from emission_factors where organization_id=$1 and status=$2',[scope.organizationId,'active']);
        const calculation=calculate_emission_activity({activity:transformed.emission_activity,factors});
        await rows('select * from confirm_draft_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[scope.organizationId,scope.projectId,draft.id,'confirmed',transformed.draft_status,overrides.review_note,new Date().toISOString(),transformed.emission_activity,calculation,scope.userId,'SYNTHETIC-LOCAL-REVIEW']);
        await fault('review-after-rpc');
      });});
      await fault('review-response');
      return state();
    }),
    calculate:(value={})=>serial(async()=>{
      input(value,['withFactor']);const withFactor=value.withFactor??true;
      if(typeof withFactor!=='boolean')throw new Error('INVALID_FACTOR_OPTION');
      const activities=await own('emission_activities');
      if(activities.length!==1)throw new Error('CONFIRMED_ACTIVITY_REQUIRED');
      const previous=await own('calculation_results');
      if(previous.some(r=>r.is_latest&&r.status==='calculated')&&withFactor)return state();
      await transaction(async()=>{await as('service_role',async()=>{
        if(withFactor&&!(await rows('select id from emission_factors where id=$1',[scope.factorId])).length)await insert('emission_factors',{id:scope.factorId,organization_id:scope.organizationId,factor_key:'SYNTHETIC-ONLY-0.5',factor_name:'SYNTHETIC ONLY, NOT AN OFFICIAL FACTOR',source_name:'LOCAL TEST INPUT',category:'energy',subcategory:'purchased_electricity',activity_type:'electricity',unit:'kWh',co2e_kg_per_unit:0.5,valid_from:'2026-01-01',version:1,quality_tier:'custom',status:'active',env:'staging',is_test:true,metadata:{synthetic:true}});
        const factors=withFactor?await rows('select * from emission_factors where organization_id=$1',[scope.organizationId]):[];
        // PGlite returns PostgreSQL numeric as text; adapt the read boundary,
        // never feed a fabricated fallback into the existing calculation service.
        const numericActivities=activities.map(row=>{
          if(row.quantity===null||!Number.isFinite(Number(row.quantity)))throw new Error('INVALID_STORED_QUANTITY');
          return {...row,quantity:Number(row.quantity)};
        });
        const result=recalculate_project({organization_id:scope.organizationId,project_id:scope.projectId,activities:numericActivities,factors,previous_calculation_results:previous});
        await rows('select * from recalculate_project_atomic($1,$2,$3,$4,$5)',[scope.organizationId,scope.projectId,scope.userId,result.calculation_results,'SYNTHETIC-LOCAL-CALCULATE']);
        await fault('calculate-after-rpc');
      });});
      return state();
    }),
    snapshot:(value={})=>serial(async()=>{
      input(value,[]);
      const {activities,calculations}=await calculationInputs();
      const project=(await rows('select * from projects where id=$1',[scope.projectId]))[0];
      const workspace=(await rows('select * from organizations where id=$1',[scope.organizationId]))[0];
      const payload=build_report_payload({project,workspace,activities,calculation_results:calculations});
      const payloadHash=hash(JSON.stringify(payload)),existing=(await own('report_generations'))[0];
      if(existing){if(existing.payload_hash!==payloadHash)throw new Error('SNAPSHOT_STALE: existing version is immutable');return state();}
      const gross=Object.values(payload.scope_totals).reduce((sum,n)=>sum+n,0);
      await transaction(async()=>{await as('service_role',async()=>{
        const [saved]=await rows('select * from generate_report_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',[scope.organizationId,scope.projectId,scope.userId,1,payload,payloadHash,project.reporting_start_date,project.reporting_end_date,payload.boundary_summary.included_count,payload.boundary_summary.excluded_count,payload.boundary_summary.pending_count,payload.scope_totals,payload.category_totals,payload.factor_sources_used,payload.data_gaps_and_warnings.length,calculations[0].calculated_at,'SYNTHETIC-LOCAL-REPORT']);
        // Lab-only transaction wrapper; production Edge RPC+patch is two-phase.
        await db.query('update report_generations set claim_purpose=$1,gross_emissions_snapshot=$2,adjustment_summary=$3,claim_results=$4,adjustment_manifest=$5,env=$6,is_test=$7 where id=$8',[
          'internal_management',{gross_total_co2e_kg:gross,scope_totals:payload.scope_totals,category_totals:payload.category_totals},{claim_purpose:'internal_management',application_count:0,requested_total_tco2e:0,eligible_total_tco2e:0,disallowed_total_tco2e:0},{claim_purpose:'internal_management',inventory_impact_mode:'claim_only',gross_co2e_kg:gross,eligible_deduction_tco2e:0,eligible_deduction_kg:0,claim_net_co2e_kg:gross},[],'staging',true,saved.report_generation_id]);
        await fault('report-after-rpc');
      });});
      return state();
    }),
    inspect:()=>serial(state),
    close:()=>serial(async()=>{closed=true;await db.close();}),
  };
}
