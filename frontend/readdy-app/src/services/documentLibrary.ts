import type {SupabaseClient} from '@supabase/supabase-js';
import {canonicalUuid,resolveNavigationScope} from './navigationScope.ts';
import {getIntakeAccess,listIntakeProjects,type IntakeProject,type IntakeScope} from './documentIntake.ts';
import type {UploadedDocument,DocumentType,OcrStatus,UploadStatus} from '../types/document.ts';

export interface LibrarySelection {organizationId:string;projectId?:string;documentId?:string}
export interface LibraryDocument extends UploadedDocument {privatePathSupported:boolean}
export class DocumentLibraryError extends Error {
  code:'scope'|'auth'|'read'|'context'|'missing'|'path'|'download'|'integrity';
  constructor(code:DocumentLibraryError['code'],options?:ErrorOptions){super(code,options);this.name='DocumentLibraryError';this.code=code;}
}
const current=(test:()=>boolean)=>{if(!test())throw new DocumentLibraryError('context');};
function uuid(value:unknown){const id=canonicalUuid(value);if(!id)throw new DocumentLibraryError('scope');return id;}
export function parseLibrarySelection(search:string):Partial<LibrarySelection>{
  const scope=resolveNavigationScope('/admin/documents/list',search);
  if(scope.kind==='invalid')throw new DocumentLibraryError('scope');
  const params=new URLSearchParams(search),doc=params.getAll('document');
  if(doc.length>1)throw new DocumentLibraryError('scope');
  return {...('organizationId'in scope?{organizationId:scope.organizationId}:{}),...('projectId'in scope?{projectId:scope.projectId}:{}),...(doc.length?{documentId:uuid(doc[0])}:{})};
}
function selection(value:LibrarySelection):LibrarySelection{return {organizationId:uuid(value.organizationId),...(value.projectId?{projectId:uuid(value.projectId)}:{}),...(value.documentId?{documentId:uuid(value.documentId)}:{})};}
async function identity(client:SupabaseClient,userId:string,isCurrent:()=>boolean){
  current(isCurrent);
  const response=await client.auth.getUser();current(isCurrent);
  if(response.error||!response.data.user||uuid(response.data.user.id)!==uuid(userId))throw new DocumentLibraryError('auth');
}
export function privatePathSupported(bucket:string,path:string,projectId:string){
  if(path.endsWith(' '))return false;
  const parts=path.split('/');
  if(parts.some(part=>!part||part==='.'||part==='..'||/[\\%?#]/.test(part)||Array.from(part).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)))return false;
  return bucket==='documents'?parts.length===2&&canonicalUuid(parts[0])===projectId:
    ['staging-receipts','staging-attachments'].includes(bucket)&&parts.length===3&&parts[0]==='staging'&&canonicalUuid(parts[1])===projectId;
}
const columns='id,organization_id,project_id,uploaded_by_user_id,storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,sha256_hash,document_type,ocr_status,status,metadata,received_date,archived_at,created_at,updated_at';
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function documentRow(value:unknown,scope:LibrarySelection,projects?:IntakeProject[]):LibraryDocument{
  if(!object(value))throw new DocumentLibraryError('read');
  const id=uuid(value.id),org=uuid(value.organization_id),project=uuid(value.project_id);
  if(org!==scope.organizationId||(scope.projectId&&project!==scope.projectId)||(scope.documentId&&id!==scope.documentId))throw new DocumentLibraryError('scope');
  if(projects&&!projects.some(p=>p.id===project&&p.organization_id===org))throw new DocumentLibraryError('scope');
  if(typeof value.storage_bucket!=='string'||typeof value.storage_path!=='string'||typeof value.original_filename!=='string'||!value.original_filename||
    (value.mime_type!==null&&typeof value.mime_type!=='string')||typeof value.file_size_bytes!=='number'||!Number.isSafeInteger(value.file_size_bytes)||value.file_size_bytes<0||
    typeof value.sha256_hash!=='string'||!['pending','processing','succeeded','failed'].includes(String(value.ocr_status))||
    !['receipt','invoice','bill','utility_bill','contract','report','other'].includes(String(value.document_type))||!['active','archived'].includes(String(value.status))||
    typeof value.created_at!=='string'||typeof value.updated_at!=='string'||!object(value.metadata))throw new DocumentLibraryError('read');
  return {id,organization_id:org,project_id:project,project_name:projects?.find(p=>p.id===project)?.name,uploaded_by_user_id:value.uploaded_by_user_id===null?null:uuid(value.uploaded_by_user_id),
    storage_bucket:value.storage_bucket,storage_path:value.storage_path,original_filename:value.original_filename,mime_type:value.mime_type as string|null,file_size_bytes:value.file_size_bytes,
    sha256_hash:value.sha256_hash,document_type:value.document_type as DocumentType,ocr_status:value.ocr_status as OcrStatus,status:value.status as UploadStatus,
    metadata:value.metadata,received_date:typeof value.received_date==='string'?value.received_date:null,archived_at:typeof value.archived_at==='string'?value.archived_at:null,
    created_at:value.created_at,updated_at:value.updated_at,uploaded_at:value.created_at,privatePathSupported:privatePathSupported(value.storage_bucket,value.storage_path,project)};
}
export async function readLibraryProjects(client:SupabaseClient,organizationId:string|undefined,userId:string,isCurrent=()=>true){
  await identity(client,userId,isCurrent);const projects=await listIntakeProjects(client,organizationId);current(isCurrent);return projects;
}
export async function readDocumentLibrary(client:SupabaseClient,input:LibrarySelection,userId:string,isCurrent=()=>true):Promise<LibraryDocument[]>{
  const scope=selection(input);await identity(client,userId,isCurrent);
  const projects=await listIntakeProjects(client,scope.organizationId);current(isCurrent);
  if(scope.projectId&&!projects.some(p=>p.id===scope.projectId))throw new DocumentLibraryError('scope');
  const result:LibraryDocument[]=[],seen=new Set<string>();let total:number|undefined;
  for(let start=0;;){
    let query=client.from('uploaded_documents').select(columns,{count:'exact'}).eq('organization_id',scope.organizationId);
    if(scope.projectId)query=query.eq('project_id',scope.projectId);
    if(scope.documentId)query=query.eq('id',scope.documentId);
    const response=await query.order('created_at',{ascending:false}).order('id').range(start,start+199);current(isCurrent);
    if(response.error||!Array.isArray(response.data)||response.count===null||response.count<0||!Number.isSafeInteger(response.count)||response.data.length>200)throw new DocumentLibraryError('read');
    if(total!==undefined&&total!==response.count)throw new DocumentLibraryError('read');total=response.count;
    for(const value of response.data){const row=documentRow(value,scope,projects);if(seen.has(row.id))throw new DocumentLibraryError('read');seen.add(row.id);result.push(row);}
    if(result.length===total)return result;
    if(!response.data.length||result.length>total)throw new DocumentLibraryError('read');start+=response.data.length;
  }
}
export async function readScopedDocument(client:SupabaseClient,documentId:string,input:IntakeScope,userId:string,isCurrent=()=>true):Promise<LibraryDocument>{
  const scope=selection({...input,projectId:uuid(input.projectId),documentId});await identity(client,userId,isCurrent);
  const response=await client.from('uploaded_documents').select(columns).eq('id',scope.documentId!).eq('organization_id',scope.organizationId).eq('project_id',scope.projectId!).maybeSingle();current(isCurrent);
  if(response.error)throw new DocumentLibraryError('read',{cause:response.error});
  if(!response.data)throw new DocumentLibraryError('missing');
  return documentRow(response.data,scope);
}
/** Authenticated byte read. No public/signed URL or cross-scope fallback. */
export async function readPrivateOriginal(client:SupabaseClient,documentId:string,scope:IntakeScope,userId:string,isCurrent=()=>true){
  const row=await readScopedDocument(client,documentId,scope,userId,isCurrent);
  if(!row.privatePathSupported)throw new DocumentLibraryError('path');
  const response=await client.storage.from(row.storage_bucket).download(row.storage_path);current(isCurrent);
  if(response.error||!response.data)throw new DocumentLibraryError('download',{cause:response.error});
  const blob=response.data;
  if(blob.size!==row.file_size_bytes)throw new DocumentLibraryError('integrity');
  if(/^[a-f0-9]{64}$/.test(row.sha256_hash)){
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),byte=>byte.toString(16).padStart(2,'0')).join('');
    current(isCurrent);if(hash!==row.sha256_hash)throw new DocumentLibraryError('integrity');
  }
  const canonical=(v:string|null)=>v==='image/jpg'?'image/jpeg':v;
  const mime=canonical(row.mime_type),actual=canonical(blob.type),signature=new Uint8Array(await blob.slice(0,8).arrayBuffer());current(isCurrent);
  const previewable=mime===actual&&(
    mime==='application/pdf'&&new TextDecoder().decode(signature.slice(0,5))==='%PDF-'||
    mime==='image/png'&&[137,80,78,71,13,10,26,10].every((b,i)=>signature[i]===b)||
    mime==='image/jpeg'&&signature[0]===255&&signature[1]===216&&signature[2]===255);
  return {document:row,blob,previewable:Boolean(previewable),previewMime:previewable?mime:null};
}

/** Preserve the existing delete action. Storage + receipt are NOT atomic. */
export async function removeScopedDocument(client:SupabaseClient,documentId:string,scope:IntakeScope,userId:string,isCurrent=()=>true){
  const row=await readScopedDocument(client,documentId,scope,userId,isCurrent);
  if(!row.privatePathSupported)throw new DocumentLibraryError('path');
  await getIntakeAccess(client,scope,userId,isCurrent);current(isCurrent);
  const references=await client.from('emission_activities').select('id',{count:'exact',head:true}).eq('organization_id',row.organization_id).eq('source_document_id',row.id);current(isCurrent);
  if(references.error||!Number.isSafeInteger(references.count)||references.count!==0)throw new Error('Document references could not be ruled out; no file was removed.');
  // A legitimate activity may refer through source_draft_id while leaving
  // source_document_id NULL. Check all visible draft versions, not only latest.
  const drafts=await client.from('extracted_document_drafts').select('id',{count:'exact'}).eq('organization_id',row.organization_id).eq('uploaded_document_id',row.id);current(isCurrent);
  if(drafts.error||!Array.isArray(drafts.data)||drafts.count!==drafts.data.length)throw new Error('Draft references could not be ruled out; no file was removed.');
  const draftIds=drafts.data.map(draft=>uuid(draft.id));
  if(new Set(draftIds).size!==draftIds.length)throw new Error('Draft references are incomplete; no file was removed.');
  if(draftIds.length){
    const linked=await client.from('emission_activities').select('id',{count:'exact',head:true}).eq('organization_id',row.organization_id).in('source_draft_id',draftIds);current(isCurrent);
    if(linked.error||!Number.isSafeInteger(linked.count)||linked.count!==0)throw new Error('The document has activity references through drafts; no file was removed.');
  }
  const removed=await client.storage.from(row.storage_bucket).remove([row.storage_path]);current(isCurrent);
  if(removed.error)throw removed.error;
  if(!removed.data?.some(item=>item.name===row.storage_path))throw new Error('File removal was not confirmed; intake record retained.');
  const deleted=await client.from('uploaded_documents').delete().eq('id',row.id).eq('organization_id',row.organization_id).eq('project_id',row.project_id).select('id').maybeSingle();current(isCurrent);
  if(deleted.error||deleted.data?.id!==row.id)throw new Error('The file may have been removed but the intake record was not confirmed deleted. Keep its ID and check before retrying.',{cause:deleted.error});
}
