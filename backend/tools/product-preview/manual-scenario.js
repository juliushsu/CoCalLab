// Explicit SYNTHETIC original/catalog/receipt setup only. No draft/activity/result.
import {createHash,randomUUID} from 'node:crypto';
import {syntheticPdf} from './showcase.js';
export async function seedManualScenario({db,scope,originals}){
  async function document(org,project,actor,label){
    const id=randomUUID(),bucket='staging-receipts',path=`staging/${project}/${id}.pdf`,bytes=syntheticPdf(label+' manual entry 100 kWh'),sha256=createHash('sha256').update(bytes).digest('hex');
    await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',[bucket,path,actor,{size:bytes.length,mimetype:'application/pdf'}]);
    // Receipt is created only by the checked-in verifier after it reads these bytes.
    originals.set(bucket+'/'+path,{bytes,mime:'application/pdf'});return {documentId:id,bucket,path,sha256,bytes:bytes.length,originalFilename:'SYNTHETIC-'+label+'.pdf'};
  }
  return {synthetic:true,scenario:'manual-transcription',fixtures:{a:{organizationId:scope.organizationId,projectId:scope.projectId,document:await document(scope.organizationId,scope.projectId,scope.aOwnerId,'A')},b:{organizationId:scope.otherOrganizationId,projectId:scope.otherProjectId,document:await document(scope.otherOrganizationId,scope.otherProjectId,scope.otherOwnerId,'B')}},cases:['Synthetic source originals only; receipts created by the actual local verifier, no seeded drafts or activities','MANUAL provider is produced only by the real manual-transcription handler/RPC','OCR remains pending; same person may transcribe and confirm with server actor/time','Unknown factor remains pending_factor/NULL; no factor pinning or period allocation'],notRun:['real Supabase Auth/JWT/Storage HTTP','server byte/hash attestation','cloud migration/restore/deploy']};
}
