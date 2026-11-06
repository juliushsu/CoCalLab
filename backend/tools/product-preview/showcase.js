// SYNTHETIC showcase initialization only. Business writes use HTTP/product handlers.
import {createHash,randomUUID} from 'node:crypto';

export function syntheticPdf(label){
  const content=`BT /F1 15 Tf 40 760 Td (SYNTHETIC LOCAL SHOWCASE ONLY) Tj 0 -30 Td (${label}) Tj 0 -30 Td (Not an invoice. OCR pending. No real company data.) Tj ET`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
  let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(pdf);
}
export async function seedShowcase({db,baseUrl,scope,accounts,originals}){
  async function request(path,token,body,method='POST'){
    const response=await fetch(baseUrl+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const text=await response.text(),data=text?JSON.parse(text):null;
    if(!response.ok||data?.success===false)throw new Error('Synthetic showcase setup failed at '+path+': '+JSON.stringify(data));return data;
  }
  const aToken=(await request('/auth/v1/token?grant_type=password',null,accounts.aOwner)).access_token;
  const bToken=(await request('/auth/v1/token?grant_type=password',null,accounts.otherOwner)).access_token;
  async function project(name,token){return (await request('/rest/v1/projects',token,{organization_id:scope.organizationId,project_code:'SYNTHETIC-'+randomUUID(),name,reporting_start_date:'2026-01-01',reporting_end_date:'2026-12-31',env:'staging',is_test:true}))[0].id;}
  async function activity(org,project,user,token,quantity,unit='kWh',activityType='electricity'){
    return (await request('/rest/v1/emission_activities',token,{id:randomUUID(),organization_id:org,project_id:project,created_by_user_id:user,activity_code:'SYNTHETIC-'+randomUUID(),activity_name:'SYNTHETIC '+activityType,activity_date:'2026-01-15',category:'energy',activity_type:activityType,quantity,unit,final_scope:2,inclusion_status:'included',status:'active',env:'staging',is_test:true}))[0].id;
  }
  async function calculate(org,project,user,token){await request('/functions/v1/recalculate-project',token,{organization_id:org,project_id:project,actor_user_id:user,force_recalculate:true,request_id:randomUUID()});}
  async function report(org,project,token){return (await request('/functions/v1/generate-report',token,{organization_id:org,project_id:project,report_version:1,claim_purpose:'internal_management',request_id:randomUUID()})).data.report_generation_id;}
  const aActivity=await activity(scope.organizationId,scope.projectId,scope.aOwnerId,aToken,100);await calculate(scope.organizationId,scope.projectId,scope.aOwnerId,aToken);const aReport=await report(scope.organizationId,scope.projectId,aToken);
  const bActivity=await activity(scope.otherOrganizationId,scope.otherProjectId,scope.otherOwnerId,bToken,20);await calculate(scope.otherOrganizationId,scope.otherProjectId,scope.otherOwnerId,bToken);const bReport=await report(scope.otherOrganizationId,scope.otherProjectId,bToken);
  const emptyProjectId=await project('SYNTHETIC EMPTY - no activities or report',aToken);
  const pendingProjectId=await project('SYNTHETIC PENDING FACTOR - not zero',aToken);
  const pendingActivityId=await activity(scope.organizationId,pendingProjectId,scope.aOwnerId,aToken,30,'kWh','SYNTHETIC_NO_FACTOR');await calculate(scope.organizationId,pendingProjectId,scope.aOwnerId,aToken);
  const errorProjectId=await project('SYNTHETIC UNSUPPORTED UNIT - error',aToken);
  const errorActivityId=await activity(scope.organizationId,errorProjectId,scope.aOwnerId,aToken,10,'SYNTHETIC_UNSUPPORTED_UNIT');await calculate(scope.organizationId,errorProjectId,scope.aOwnerId,aToken);
  async function receipt(org,project,user,label){
    const id=randomUUID(),draftId=randomUUID(),bucket='staging-receipts',path=`staging/${project}/${id}.pdf`,bytes=syntheticPdf(label),sha=createHash('sha256').update(bytes).digest('hex');
    // Explicit setup catalog/receipt/draft fixtures, never an OCR or upload result.
    await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)',[bucket,path,user,{size:bytes.length,mimetype:'application/pdf'}]);
    await db.query(`insert into uploaded_documents(id,organization_id,project_id,uploaded_by_user_id,storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,sha256_hash,document_type,ocr_status,status,env,is_test,metadata) values($1,$2,$3,$4,$5,$6,$7,'application/pdf',$8,$9,'other','pending','active','staging',true,'{"synthetic":true,"intake_mode":"showcase_fixture_not_upload"}')`,[id,org,project,user,bucket,path,'SYNTHETIC-'+label+'.pdf',bytes.length,sha]);
    await db.query(`insert into extracted_document_drafts(id,organization_id,project_id,uploaded_document_id,extraction_provider,raw_payload,normalized_payload,status,classification_status,suggested_category,suggested_scope,is_latest,env,is_test) values($1,$2,$3,$4,'SYNTHETIC-REVIEW-FIXTURE','{"synthetic":true,"no_ocr":true}', $5,'pending_review','unclassified','energy',2,true,'staging',true)`,[draftId,org,project,id,{quantity:100,unit:'kWh',activity_date:'2026-01-15'}]);
    originals.set(bucket+'/'+path,{bytes,mime:'application/pdf'});return {documentId:id,draftId,bucket,path,sha256:sha,bytes:bytes.length};
  }
  const aDocument=await receipt(scope.organizationId,scope.projectId,scope.aOwnerId,'A-review-only');
  const bDocument=await receipt(scope.otherOrganizationId,scope.otherProjectId,scope.otherOwnerId,'B-review-only');
  return {synthetic:true,scenario:'showcase',fixtures:{a:{organizationId:scope.organizationId,projectId:scope.projectId,activityId:aActivity,reportId:aReport,document:aDocument},b:{organizationId:scope.otherOrganizationId,projectId:scope.otherProjectId,activityId:bActivity,reportId:bReport,document:bDocument},empty:{organizationId:scope.organizationId,projectId:emptyProjectId},pendingFactor:{organizationId:scope.organizationId,projectId:pendingProjectId,activityId:pendingActivityId},error:{organizationId:scope.organizationId,projectId:errorProjectId,activityId:errorActivityId}},cases:['A-only owner: A data only','B-only owner: B data only','shared owner: A owner / B viewer','viewer: A read-only','outsider: no tenant data','A 100kWh -> 50kg / B 20kWh -> 10kg via actual handlers','empty project has no fabricated activity/report','pending_factor and unsupported-unit error remain NULL, no report','synthetic pending draft: UI confirm blocked; actual handler reject available','private synthetic PDF GET checks storage.objects RLS'],notRun:['real Supabase Auth/JWT/Storage HTTP','production OCR/document-to-draft','Storage upload/delete in this adapter','cloud migration/restore/deploy']};
}
