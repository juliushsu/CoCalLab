import {useState,useEffect,useCallback,useMemo,useRef,useLayoutEffect} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate,useSearchParams} from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import EmptyState from '../../../components/base/EmptyState';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import ConfirmDialog from '../../../components/base/ConfirmDialog';
import StatusBadge from '../../../components/base/StatusBadge';
import ReadonlyBanner from '../../../components/feature/ReadonlyBanner';
import {useSubscriptionStatus} from '../../../hooks/useSubscriptionStatus';
import {useAuth} from '../../../hooks/useAuth';
import {useTenantNavigation} from '../../../hooks/useTenantNavigation';
import {getUploadedDocuments,deleteDocument,lookupDocumentDeletion,forgetLocalDeletionReference,getDocumentProjects,getPrivateDocument} from '../../../services/documentService';
import {attachmentVerificationView} from '../../../services/attachmentVerificationView';
import {parseLibrarySelection,DocumentLibraryError,type LibraryDocument} from '../../../services/documentLibrary';
import type {IntakeProject} from '../../../services/documentIntake';
import type {OcrStatus,DocumentType} from '../../../types/document';

export default function UploadedDocumentListPage(){
  const {t,i18n}=useTranslation(),navigate=useNavigate(),[params]=useSearchParams();
  const search=params.toString();
  const selected=useMemo(()=>{try{return {scope:parseLibrarySelection(search),error:false};}catch{return {scope:{organizationId:undefined,projectId:undefined,documentId:undefined},error:true};}},[search]);
  const {session,loading:authLoading,authEpoch,isAuthenticationCurrent}=useAuth();
  const navigation=useTenantNavigation();
  const [retry,setRetry]=useState(0);
  const context=useMemo(()=>({search,userId:session?.user.id??'',authEpoch,retry}),[search,session?.user.id,authEpoch,retry]);
  const current=useRef<typeof context|null>(context);
  const [loaded,setLoaded]=useState<typeof context|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
  const [documents,setDocuments]=useState<LibraryDocument[]>([]),[projects,setProjects]=useState<IntakeProject[]>([]);
  const [organizationId,setOrganizationId]=useState<string|undefined>(),[projectId,setProjectId]=useState('');
  const subscription=useSubscriptionStatus(loaded===context?organizationId:undefined,{failClosed:true,scopeKey:context});
  const isReadonly=subscription.isReadonly||subscription.loading||Boolean(subscription.error);
  const [searchQuery,setSearchQuery]=useState(''),[status,setStatus]=useState<OcrStatus|''>(''),[type,setType]=useState<DocumentType|''>('');
  const [target,setTarget]=useState<LibraryDocument|null>(null),[deleting,setDeleting]=useState(false);
  const [deletionNotice,setDeletionNotice]=useState('');
  const [toast,setToast]=useState<{type:'success'|'error';message:string}|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),urls=useRef(new Set<string>());
  const [preview,setPreview]=useState<{url:string;name:string}|null>(null),[originalBusy,setOriginalBusy]=useState<string|null>(null);
  const isCurrent=useCallback((captured:typeof context)=>current.current===captured&&isAuthenticationCurrent(captured.authEpoch,captured.userId),[isAuthenticationCurrent]);
  useLayoutEffect(()=>{
    current.current=context;setTarget(null);setDeleting(false);setPreview(null);setOriginalBusy(null);setToast(null);setDeletionNotice('');
    const capturedUrls=urls.current;
    return()=>{if(current.current===context)current.current=null;capturedUrls.forEach(url=>URL.revokeObjectURL(url));capturedUrls.clear();clearTimeout(timer.current);};
  },[context]);
  const reload=()=>setRetry(value=>value+1);
  useEffect(()=>{
    if(authLoading)return;
    let active=true;setLoading(true);setError(null);
    void(async()=>{
      try{
        if(!isCurrent(context))throw new DocumentLibraryError('auth');
        if(selected.error)throw new DocumentLibraryError('scope');
        const options=await getDocumentProjects(selected.scope.organizationId,context.userId,()=>isCurrent(context));
        let org=selected.scope.organizationId;
        if(selected.scope.projectId){const project=options.find(row=>row.id===selected.scope.projectId);if(!project)throw new DocumentLibraryError('scope');org=project.organization_id;}
        const rows=org?await getUploadedDocuments({organizationId:org,projectId:selected.scope.projectId,documentId:selected.scope.documentId},context.userId,()=>isCurrent(context)):[];
        if(!active||!isCurrent(context))return;
        setDocuments(rows);setProjects(options);setOrganizationId(org);setProjectId(selected.scope.projectId??'');
      }catch(cause){if(active&&current.current===context){setDocuments([]);setProjects([]);setOrganizationId(undefined);setError(cause instanceof DocumentLibraryError?cause.code:'read');}}
      finally{if(active&&current.current===context){setLoading(false);setLoaded(context);}}
    })();
    return()=>{active=false;};
  },[authLoading,context,selected,isCurrent]);
  const showToast=(kind:'success'|'error',message:string)=>{clearTimeout(timer.current);setToast({type:kind,message});timer.current=setTimeout(()=>setToast(null),5000);};
  const href=(path:string)=>{const query=new URLSearchParams();if(organizationId)query.set('organization_id',organizationId);if(projectId)query.set('project_id',projectId);return query.size?path+'?'+query:path;};
  const closePreview=()=>{if(preview){URL.revokeObjectURL(preview.url);urls.current.delete(preview.url);}setPreview(null);};
  const original=async(doc:LibraryDocument,view:boolean)=>{
    const captured=context;if(!isCurrent(captured)||originalBusy||deleting)return;setOriginalBusy(doc.id);
    try{
      const result=await getPrivateDocument(doc.id,{organizationId:doc.organization_id,projectId:doc.project_id},captured.userId,()=>isCurrent(captured));
      if(!isCurrent(captured))return;
      if(view&&!result.previewable){showToast('error',t('documents.library.unsupportedPreview'));return;}
      const url=URL.createObjectURL(new Blob([result.blob],{type:view?result.previewMime!:'application/octet-stream'}));urls.current.add(url);
      if(view){closePreview();setPreview({url,name:result.document.original_filename});}
      else{const anchor=document.createElement('a');anchor.href=url;anchor.download=result.document.original_filename;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>{URL.revokeObjectURL(url);urls.current.delete(url);},1000);}
    }catch(cause){if(isCurrent(captured))showToast('error',t('documents.library.errors.'+(cause instanceof DocumentLibraryError?cause.code:'read')));}
    finally{if(isCurrent(captured))setOriginalBusy(null);}
  };
  const applyDeletion=(doc:LibraryDocument,result:Awaited<ReturnType<typeof deleteDocument>>)=>{
    setDeletionNotice(t(result.operation_status==='deleted'?(result.receipt_present?'documents.deletion.completed':'documents.deletion.completedWithoutReceipt'):result.operation_status==='pending'?'documents.deletion.pending':'documents.deletion.notFound')+' · '+result.request_id);
    if(result.operation_status==='deleted'&&!result.receipt_present){setDocuments(rows=>rows.filter(row=>row.id!==doc.id));return;}
    if(result.operation_status!=='not_found')setDocuments(rows=>rows.map(row=>row.id!==doc.id?row:{...row,deletion_state:result.deletion_state??row.deletion_state,deletion_request_id:result.request_id,deleted_at:result.deleted_at,status:result.operation_status==='deleted'?'archived':row.status}));
  };
  const remove=async()=>{
    const captured=context,doc=target;if(!doc||!isCurrent(captured)||deleting||originalBusy)return;
    if(isReadonly||!['owner','admin','editor'].includes(navigation.role??'')){showToast('error',t('subscription.readonlyBanner.message'));return;}
    setDeleting(true);setDeletionNotice('');closePreview();
    try{const result=await deleteDocument(doc.id,{organizationId:doc.organization_id,projectId:doc.project_id},captured.userId,()=>isCurrent(captured),doc);if(!isCurrent(captured))return;applyDeletion(doc,result);setTarget(null);showToast(result.operation_status==='deleted'?'success':'error',t(result.operation_status==='deleted'?(result.receipt_present?'documents.deletion.completed':'documents.deletion.completedWithoutReceipt'):'documents.deletion.pending'));}
    catch(cause){if(isCurrent(captured)){setDeletionNotice(cause instanceof Error?cause.message:t('documents.library.deleteUnconfirmed'));showToast('error',t('documents.library.deleteUnconfirmed'));setTarget(null);}}
    finally{if(isCurrent(captured))setDeleting(false);}
  };
  const checkDeletion=async(doc:LibraryDocument)=>{
    const captured=context;if(!isCurrent(captured)||deleting||originalBusy)return;setDeleting(true);setDeletionNotice('');
    try{const result=await lookupDocumentDeletion(doc,captured.userId,()=>isCurrent(captured));if(!isCurrent(captured))return;if(result)applyDeletion(doc,result);else setDeletionNotice(t('documents.deletion.noReference'));}
    catch(cause){if(isCurrent(captured))setDeletionNotice(cause instanceof Error?cause.message:t('documents.library.deleteUnconfirmed'));}
    finally{if(isCurrent(captured))setDeleting(false);}
  };
  if(authLoading||loading||loaded!==context)return <AdminLayout><LoadingState/></AdminLayout>;
  if(error)return <AdminLayout><ErrorState message={t('documents.library.errors.'+error)} onRetry={reload}/></AdminLayout>;
  const filtered=documents.filter(doc=>(!searchQuery||doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase()))&&(!status||doc.ocr_status===status)&&(!type||doc.document_type===type));
  const size=(bytes:number)=>bytes<1024?bytes+' B':bytes<1048576?(bytes/1024).toFixed(1)+' KB':(bytes/1048576).toFixed(1)+' MB';
  const colors={pending:'gray',processing:'blue',succeeded:'green',failed:'red'};
  return <AdminLayout>
    {isReadonly&&<ReadonlyBanner onRenew={()=>navigate(href('/admin/subscription'))} onContact={()=>window.open('mailto:support@cocallab.com','_blank')}/>}
    {toast&&<div role={toast.type==='error'?'alert':'status'} className={'fixed right-4 top-4 z-50 flex gap-4 rounded border p-4 shadow '+(toast.type==='error'?'bg-red-50 text-red-900':'bg-green-50 text-green-900')}><p>{toast.message}</p><button type="button" onClick={()=>setToast(null)} aria-label={t('common.close')}>×</button></div>}
    <div className="mb-6 flex items-center justify-between"><div><h1 className="text-2xl font-semibold text-gray-900">{t('documents.listPage')}</h1><p className="mt-1 text-sm text-gray-500">{t('documents.listDescription')}</p></div><div className="flex gap-3"><button type="button" onClick={reload} className="rounded border px-4 py-2">{t('common.retry')}</button><button type="button" onClick={()=>navigate(href('/admin/documents/upload'))} className="rounded bg-teal-600 px-4 py-2 text-white"><i className="ri-upload-line mr-2"/>{t('documents.upload')}</button></div></div>
    <div className="mb-6 grid gap-4 rounded border bg-white p-4 md:grid-cols-4">
      <input aria-label={t('documents.searchPlaceholder')} placeholder={t('documents.searchPlaceholder')} value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} className="rounded border p-2"/>
      <select aria-label={t('documents.filterByProject')} value={projectId} onChange={event=>{const project=projects.find(row=>row.id===event.target.value);const query=new URLSearchParams();if(project){query.set('organization_id',project.organization_id);query.set('projectId',project.id);}else if(organizationId)query.set('organization_id',organizationId);current.current=null;navigate('/admin/documents/list'+(query.size?'?'+query:''));}} className="rounded border p-2"><option value="">{t('documents.filterByProject')}</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select>
      <select aria-label={t('documents.filterByStatus')} value={status} onChange={event=>setStatus(event.target.value as OcrStatus|'')} className="rounded border p-2"><option value="">{t('documents.filterByStatus')}</option>{(['pending','processing','succeeded','failed'] as const).map(state=><option key={state} value={state}>{t('documents.processingStatus.'+(state==='succeeded'?'completed':state))}</option>)}</select>
      <select aria-label={t('documents.filterByType')} value={type} onChange={event=>setType(event.target.value as DocumentType|'')} className="rounded border p-2"><option value="">{t('documents.filterByType')}</option>{['receipt','invoice','bill','utility_bill','contract','report','other'].map(kind=><option key={kind} value={kind}>{t('documents.types.'+kind)}</option>)}</select>
    </div>
    {!organizationId?<EmptyState title={t('documents.library.selectScope')} description={t('documents.library.selectScopeDescription')}/>:!filtered.length?<EmptyState icon="ri-file-text-line" title={t('documents.emptyTitle')} description={t('documents.emptyDescription')} actionLabel={t('documents.uploadButton')} onAction={()=>navigate(href('/admin/documents/upload'))}/>:<div className="overflow-hidden rounded border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full"><thead className="border-b bg-gray-50"><tr>{['fileName','project','documentType','fileSize','processingStatus','uploadedAt'].map(field=><th key={field} className="px-6 py-3 text-left text-xs uppercase text-gray-500">{t('documents.fields.'+field)}</th>)}<th className="px-6 py-3 text-right">{t('common.table_actions')}</th></tr></thead><tbody className="divide-y">{filtered.map(doc=><tr key={doc.id} className="hover:bg-gray-50"><td className="px-6 py-4"><div className="font-medium"><i className="ri-file-text-line mr-3"/>{doc.original_filename}</div><div className="text-xs text-gray-500">{doc.mime_type??'-'}</div><p className="mt-1 text-xs text-gray-600">{attachmentVerificationView(doc).label}</p><p className="mt-1 text-xs">{t('documents.deletion.states.'+(doc.deletion_state??'active'))}</p>{doc.deletion_request_id&&<p className="break-all text-xs">{doc.deletion_request_id}</p>}</td><td className="px-6 py-4">{doc.project_name??'-'}</td><td className="px-6 py-4">{t('documents.types.'+doc.document_type)}</td><td className="px-6 py-4">{size(doc.file_size_bytes)}</td><td className="px-6 py-4"><StatusBadge status={doc.ocr_status} label={t('documents.processingStatus.'+(doc.ocr_status==='succeeded'?'completed':doc.ocr_status))} color={colors[doc.ocr_status]}/></td><td className="px-6 py-4">{new Date(doc.created_at).toLocaleString(i18n.resolvedLanguage||i18n.language)}</td><td className="px-6 py-4"><div className="flex max-w-sm flex-wrap justify-end gap-3">
      <button type="button" onClick={()=>void original(doc,true)} disabled={!doc.privatePathSupported||Boolean(originalBusy)||deleting||doc.deletion_state==='pending'||doc.deletion_state==='deleted'} title={t('documents.library.viewOriginal')} aria-label={t('documents.library.viewOriginal')} className="text-teal-600 disabled:opacity-50"><span>{t('documents.library.viewOriginal')}</span></button>
      <button type="button" onClick={()=>void original(doc,false)} disabled={!doc.privatePathSupported||Boolean(originalBusy)||deleting||doc.deletion_state==='pending'||doc.deletion_state==='deleted'} title={t('documents.library.downloadOriginal')} aria-label={t('documents.library.downloadOriginal')} className="text-teal-600 disabled:opacity-50"><span>{t('documents.library.downloadOriginal')}</span></button>
      <button type="button" disabled={isReadonly||!['owner','admin','editor'].includes(navigation.role??'')||!doc.privatePathSupported||doc.deletion_state==='pending'||doc.deletion_state==='deleted'} onClick={()=>navigate('/admin/documents/'+doc.id+'/transcribe?'+new URLSearchParams({organization_id:doc.organization_id,projectId:doc.project_id}))} className="text-teal-700 disabled:opacity-40">人工轉錄／確認（非OCR）</button>
      {doc.ocr_status==='succeeded'&&<button type="button" onClick={()=>navigate('/admin/documents/drafts?'+new URLSearchParams({document:doc.id,organization_id:doc.organization_id,project_id:doc.project_id}))} title={t('documents.draftReview')} aria-label={t('documents.draftReview')} className="text-teal-600"><span>{t('documents.draftReview')}</span></button>}
      <button type="button" onClick={()=>setTarget(doc)} disabled={doc.deletion_state==='deleted'||isReadonly||!['owner','admin','editor'].includes(navigation.role??'')||Boolean(originalBusy)||deleting} title={t('documents.deletion.action')} aria-label={t('documents.deletion.action')} className="text-red-600 disabled:opacity-50"><span>{t(doc.deletion_state==='pending'?'documents.deletion.retry':'documents.deletion.action')}</span></button>
      <button type="button" onClick={()=>void checkDeletion(doc)} disabled={deleting||isReadonly||!['owner','admin','editor'].includes(navigation.role??'')} className="text-teal-700">{t('documents.deletion.lookup')}</button>
      <button type="button" onClick={()=>{if(!isCurrent(context)||deleting)return;try{forgetLocalDeletionReference(doc,context.userId);setDeletionNotice(t('documents.deletion.clearMessage'));}catch(cause){setDeletionNotice(String(cause));}}} disabled={deleting} className="text-gray-600">{t('documents.deletion.clearReference')}</button>
    </div></td></tr>)}</tbody></table></div></div>}
    {deletionNotice&&<p role="status" className="mt-4 break-all rounded border p-3">{deletionNotice}</p>}
    {originalBusy&&<p role="status">{t('documents.library.loadingOriginal')}</p>}
    {preview&&<div role="dialog" aria-modal="true" aria-label={t('documents.library.viewOriginal')} className="fixed inset-0 z-50 flex flex-col bg-white p-4"><div className="mb-3 flex justify-between"><h2>{preview.name}</h2><button type="button" onClick={closePreview} className="rounded border px-4 py-2">{t('common.close')}</button></div><iframe title={preview.name} src={preview.url} className="min-h-0 flex-1 border"/></div>}
    <ConfirmDialog open={Boolean(target)} title={t('documents.deletion.action')} message={t('documents.deletion.confirm')} confirmLabel={t('documents.deletion.action')} cancelLabel={t('common.cancel')} onConfirm={()=>void remove()} onCancel={()=>setTarget(null)} isProcessing={deleting} type="danger"/>
  </AdminLayout>;
}
