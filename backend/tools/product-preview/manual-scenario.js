// Explicit SYNTHETIC original/catalog/receipt setup only. No draft/activity/result.
import {createHash,randomUUID} from 'node:crypto';
import {syntheticPdf} from './showcase.js';
export async function seedManualScenario({db,scope,originals}){
  async function document(org,project,actor,label){
    const id=randomUUID(),bucket='staging-receipts',path=`staging/${project}/${id}.pdf`,bytes=syntheticPdf(label+' manual entry 100 kWh'),sha256=createHash('sha256').update(bytes).digest('hex');
    await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',[bucket,path,actor,{size:bytes.length,mimetype:'application/pdf'}]);
    await db.query(`insert into uploaded_documents(id,organization_id,project_id,uploaded_by_user_id,storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,sha256_hash,ocr_status,status,env,is_test,metadata) values($1,$2,$3,$4,$5,$6,$7,'application/pdf',$8,$9,'pending','active','staging',true,'{"synthetic":true,"intake_mode":"manual_preview_fixture_not_upload"}')`,[id,org,project,actor,bucket,path,'SYNTHETIC-'+label+'.pdf',bytes.length,sha256]);
    originals.set(bucket+'/'+path,{bytes,mime:'application/pdf'});return {documentId:id,bucket,path,sha256,bytes:bytes.length};
  }
  return {synthetic:true,scenario:'manual-transcription',fixtures:{a:{organizationId:scope.organizationId,projectId:scope.projectId,document:await document(scope.organizationId,scope.projectId,scope.aOwnerId,'A')},b:{organizationId:scope.otherOrganizationId,projectId:scope.otherProjectId,document:await document(scope.otherOrganizationId,scope.otherProjectId,scope.otherOwnerId,'B')}},cases:['Synthetic source originals/receipts only; no seeded drafts or activities','MANUAL provider is produced only by the real manual-transcription handler/RPC','OCR remains pending; same person may transcribe and confirm with server actor/time','Unknown factor remains pending_factor/NULL; no factor pinning or period allocation'],notRun:['real Supabase Auth/JWT/Storage HTTP','server byte/hash attestation','cloud migration/restore/deploy']};
}
