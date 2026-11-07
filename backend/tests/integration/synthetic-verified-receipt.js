// SQL catalog fixture only; synthetic bytes/hash, not a real Storage HTTP upload.
import {randomUUID,createHash} from 'node:crypto';
export async function syntheticVerifiedReceipt({db,scope,doc=randomUUID(),path=`staging/${scope.projectId}/${doc}.pdf`,size=20}){
 const bytes=Buffer.alloc(size,83),sha=createHash('sha256').update(bytes).digest('hex'),request=doc;
 const exists=(await db.query("select id from storage.objects where bucket_id='staging-receipts' and name=$1",[path])).rows.length;
 if(!exists)await db.query("insert into storage.objects(bucket_id,name,owner_id,metadata) values('staging-receipts',$1,$2,$3)",[path,scope.userId,{size,mimetype:'application/pdf'}]);
 const intent={organization_id:scope.organizationId,project_id:scope.projectId,document_id:doc,request_id:request,storage_bucket:'staging-receipts',storage_path:path,original_filename:'SYNTHETIC.sql.pdf',document_type:'receipt',file_size_bytes:size,mime_type:'application/pdf'};
 await db.exec('begin');try{await db.exec('set local role service_role');await db.query('select * from begin_upload_verification($1,$2)',[scope.userId,intent]);await db.query("select * from complete_upload_verification($1,$2,$3,$4,$5,'application/pdf')",[scope.userId,doc,request,sha,size]);await db.exec('commit');}catch(e){await db.exec('rollback');throw e;}return {doc,path,sha,bytes};
}
