import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import EmptyState from '../../../components/base/EmptyState';
import ConfirmDialog from '../../../components/base/ConfirmDialog';
import { useAuth } from '../../../hooks/useAuth';
import { currentSession, resolveNavigationScope } from '../../../services/navigationScope';
import { getUploadProjects, getUploadAccess, uploadDocument, recheckUploadReceipt, getIntakeRecovery, completeUploadReceipt, discardUploadReference, intakeQuarantinedCount,cleanupUploadOriginal,forgetUploadDeletionReference } from '../../../services/documentService';
import { IntakeError, intakeReference, type IntakeAttempt, type IntakeProject, type IntakeReceipt, type IntakeStage } from '../../../services/documentIntake';
import type {DocumentDeletionResult} from '../../../services/documentDeletion';
import { IS_STAGING } from '../../../utils/staging';
import type { DocumentType } from '../../../types/document';
interface QueueFile {
    id: string;
    file?: File;
    status: 'pending' | 'working' | 'received' | 'existing' | 'failed' | 'unknown' | 'cleaned';
    stage?: IntakeStage;
    error?: string;
    attempt?: IntakeAttempt;
    receipt?: IntakeReceipt;
    deletion?:DocumentDeletionResult;
}
function saveReference(value: unknown, id: string) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cocallab-intake-${id}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function DocumentUploadPage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { session, loading: authLoading, authEpoch, isAuthenticationCurrent } = useAuth();
    const userId=session?.user.id??'';
    const search = params.toString();
    const route = useMemo(() => ({ search, userId, authEpoch }), [search, userId, authEpoch]);
    const [projectId, setProjectId] = useState('');
    const [documentType, setDocumentType] = useState<DocumentType>('receipt');
    const [projects, setProjects] = useState<IntakeProject[]>([]);
    const [loadedRoute, setLoadedRoute] = useState<typeof route | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [retry, setRetry] = useState(0);
    const [files, setFiles] = useState<QueueFile[]>([]);
    const [processing, setProcessing] = useState(false);
    const view = useMemo(() => ({ route, projectId }), [route, projectId]);
    const currentView = useRef<typeof view | null>(view);
    const busy = useRef(false);
    const [access, setAccess] = useState<{
        view: typeof view;
        allowed: boolean;
        error?: string;
    } | null>(null);
    const [accessRetry, setAccessRetry] = useState(0);
    const [recoveryError, setRecoveryError] = useState(false);
    const [quarantined,setQuarantined]=useState(0);
    const [cleaning,setCleaning]=useState<QueueFile|null>(null);
    const [discarding,setDiscarding]=useState<QueueFile|null>(null);
    const project = projects.find(row => row.id === projectId);
    const canUpload = loadedRoute === route && !authLoading && currentSession(session) && access?.view === view && access.allowed && !recoveryError;
    useLayoutEffect(() => {
        currentView.current = view;
        busy.current = false;
        setFiles([]);
        setProcessing(false);
        setRecoveryError(false);
        setQuarantined(0);setDiscarding(null);setCleaning(null);
        return () => { if (currentView.current === view)
            currentView.current = null; };
    }, [view]);
    useEffect(() => {
        let active = true;
        if (authLoading)
            return () => { active = false; };
        setLoadError(false);
        if (!isAuthenticationCurrent(route.authEpoch,route.userId)) {
            setLoadError(true);
            setLoadedRoute(route);
            return () => { active = false; };
        }
        const scope = resolveNavigationScope('/admin/documents/upload', route.search);
        if (scope.kind === 'invalid') {
            setLoadError(true);
            setLoadedRoute(route);
            return () => { active = false; };
        }
        const organizationId = 'organizationId' in scope ? scope.organizationId : undefined;
        const selectedProject = 'projectId' in scope ? scope.projectId : undefined;
        void getUploadProjects(organizationId).then(rows => {
            if (!active)
                return;
            if (selectedProject && !rows.some(row => row.id === selectedProject))
                throw new IntakeError('scope');
            setProjects(rows);
            setProjectId(selectedProject || '');
            setLoadedRoute(route);
        }).catch(() => { if (active) {
            setProjects([]);
            setLoadError(true);
            setLoadedRoute(route);
        } });
        return () => { active = false; };
    }, [route, authLoading, retry, isAuthenticationCurrent]);
    useEffect(() => {
        let active = true;
        if (!project || loadedRoute !== route || !isAuthenticationCurrent(route.authEpoch,route.userId))
            return () => { active = false; };
        const isCurrent = () => active && currentView.current === view && isAuthenticationCurrent(route.authEpoch,route.userId);
        void getUploadAccess({ projectId: project.id, organizationId: project.organization_id }, route.userId, isCurrent)
            .then(() => { if (isCurrent())
            setAccess({ view, allowed: true }); })
            .catch(cause => { if (isCurrent())
            setAccess({ view, allowed: false, error: cause instanceof IntakeError ? cause.code : 'read' }); });
        return () => { active = false; };
    }, [project, loadedRoute, route, view, accessRetry, isAuthenticationCurrent]);
    useEffect(() => {
        if (!project || loadedRoute !== route || !isAuthenticationCurrent(route.authEpoch,route.userId))
            return;
        try {
            const pending = getIntakeRecovery(route.userId, { projectId: project.id, organizationId: project.organization_id });
            setQuarantined(intakeQuarantinedCount(route.userId));
            if (currentView.current === view)
                setFiles(rows => [...rows, ...pending.filter(attempt => !rows.some(row => row.attempt?.documentId === attempt.documentId)).map(attempt => ({ id: attempt.documentId, status: 'unknown' as const, attempt, error: 'uncertain' }))]);
        }
        catch {
            if (currentView.current === view)
                setRecoveryError(true);
        }
    }, [project, loadedRoute, route, view, isAuthenticationCurrent]);
    const addFiles = useCallback((incoming: File[]) => {
        if (busy.current)
            return;
        setFiles(previous => [...previous, ...incoming.map(file => ({ id: crypto.randomUUID(), file, status: 'pending' as const }))]);
    }, []);
    const upload = async () => {
        if (!canUpload || !project || busy.current)
            return;
        const captured = view;
        const isCurrent = () => currentView.current === captured && isAuthenticationCurrent(captured.route.authEpoch,captured.route.userId);
        busy.current = true;
        setProcessing(true);
        try {
            for (const item of files.filter(row => row.status === 'pending')) {
                if (!isCurrent())
                    break;
                setFiles(rows => rows.map(row => row.id === item.id ? { ...row, status: 'working', stage: 'checking' } : row));
                try {
                    if (!item.file)
                        throw new IntakeError('file');
                    const receipt = await uploadDocument(item.file, project.id, project.organization_id, documentType, captured.route.userId, isCurrent, stage => {
                        if (isCurrent())
                            setFiles(rows => rows.map(row => row.id === item.id ? { ...row, stage } : row));
                    });
                    if (isCurrent())
                        setFiles(rows => rows.map(row => row.id === item.id ? { ...row, status: receipt.existing ? 'existing' : 'received', receipt, attempt: receipt.recoveryReference ?? receipt.attempt, stage: undefined } : row));
                }
                catch (cause) {
                    if (!isCurrent())
                        break;
                    const attempt = cause instanceof IntakeError ? cause.attempt : undefined;
                    setFiles(rows => rows.map(row => row.id === item.id ? { ...row, status: attempt ? 'unknown' : 'failed', error: cause instanceof IntakeError ? cause.code : 'read', attempt, stage: undefined } : row));
                }
            }
        }
        finally {
            if (currentView.current === captured) {
                busy.current = false;
                setProcessing(false);
            }
        }
    };
    const recheck = async (item: QueueFile,complete=false) => {
        if (!item.attempt || busy.current || !project)
            return;
        const captured = view, isCurrent = () => currentView.current === captured && isAuthenticationCurrent(captured.route.authEpoch,captured.route.userId);
        busy.current = true;
        setProcessing(true);
        try {
            const receipt = complete?await completeUploadReceipt(item.attempt,captured.route.userId,isCurrent):await recheckUploadReceipt(item.attempt, isCurrent);
            if (isCurrent())
                setFiles(rows => rows.map(row => row.id !== item.id ? row : receipt ? { ...row, status: receipt.existing?'existing':'received', receipt,attempt:receipt.recoveryReference??receipt.attempt, error: undefined } : { ...row, error: 'unconfirmed' }));
        }
        catch (cause) {
            if (isCurrent())
                setFiles(rows => rows.map(row => row.id === item.id ? { ...row, error: cause instanceof IntakeError ? cause.code : 'read' } : row));
        }
        finally {
            if (currentView.current === captured) {
                busy.current = false;
                setProcessing(false);
            }
        }
    };
    const cleanOriginal=async(item:QueueFile,lookupOnly=false)=>{
        if(!item.attempt||!project||busy.current||!canUpload)return;const captured=view,isCurrent=()=>currentView.current===captured&&isAuthenticationCurrent(captured.route.authEpoch,captured.route.userId);
        busy.current=true;setProcessing(true);
        try{const result=await cleanupUploadOriginal(item.attempt,captured.route.userId,isCurrent,lookupOnly);if(!isCurrent())return;
          setFiles(rows=>rows.map(row=>row.id!==item.id?row:result?.operation_status==='deleted'?{...row,status:'cleaned',deletion:result,error:undefined}:{...row,deletion:result??undefined,error:'deleteUnconfirmed'}));
        }catch(cause){if(!isCurrent())return;
          if(cause&&typeof cause==='object'&&'code' in cause&&cause.code==='RECEIPT_ALREADY_REGISTERED'){
            try{const receipt=await recheckUploadReceipt(item.attempt,isCurrent);if(isCurrent()&&receipt&&!receipt.recoveryReference){setFiles(rows=>rows.map(row=>row.id===item.id?{...row,status:receipt.existing?'existing':'received',receipt,attempt:receipt.attempt,error:undefined}:row));return;}}catch{/* keep uncertain, never use a mock receipt */}
          }
          if(isCurrent())setFiles(rows=>rows.map(row=>row.id===item.id?{...row,error:'deleteUnconfirmed'}:row));
        }finally{if(currentView.current===captured){busy.current=false;setProcessing(false);setCleaning(null);}}
    };
    const discard=()=>{
        if(!discarding?.attempt||!project||busy.current||!isAuthenticationCurrent(route.authEpoch,route.userId))return;
        try{
            discardUploadReference(route.userId,{organizationId:project.organization_id,projectId:project.id},discarding.attempt.documentId);
            setFiles(rows=>rows.filter(row=>row.id!==discarding.id));setDiscarding(null);
        }catch{setFiles(rows=>rows.map(row=>row.id===discarding.id?{...row,error:'recovery'}:row));setDiscarding(null);}
    };
    const listHref = project ? `/admin/documents/list?${new URLSearchParams({ organization_id: project.organization_id, projectId: project.id })}` : '/admin/documents/list';
    if (authLoading || loadedRoute !== route)
        return <AdminLayout><LoadingState message={t('documents.intake.loading')}/></AdminLayout>;
    if (!currentSession(session))
        return <AdminLayout><ErrorState message={t('documents.intake.errors.auth')}/></AdminLayout>;
    if (loadError)
        return <AdminLayout><ErrorState message={t('documents.intake.errors.read')} onRetry={() => { setLoadedRoute(null); setRetry(value => value + 1); }}/></AdminLayout>;
    if (!projects.length)
        return <AdminLayout><EmptyState title={t('documents.intake.empty')} description={t('documents.intake.emptyDescription')} actionLabel={t('common.retry')} onAction={() => { setLoadedRoute(null); setRetry(value => value + 1); }}/></AdminLayout>;
    const received = files.filter(row => row.status === 'received' || row.status === 'existing').length;
    return <AdminLayout>
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-2xl font-semibold">{t('documents.uploadPage')}</h1>
      <button type="button" onClick={() => navigate(listHref)} className="underline">{t('documents.list')}</button>
    </div>
    <p role="status" className="mb-4 rounded border border-amber-200 bg-amber-50 p-4">{t('documents.intake.uploadOnly')}</p>
    <p className="mb-4 text-sm text-gray-600">{t(IS_STAGING ? 'documents.intake.staging' : 'documents.intake.production')}</p>
    {recoveryError && <p role="alert" className="mb-4 text-red-700">{t('documents.intake.errors.recovery')}</p>}
    {quarantined>0&&<p role="status" className="mb-4 text-amber-800">{t('documents.intake.quarantined',{count:quarantined})}</p>}
    <div className="mb-6 grid gap-4 rounded border bg-white p-6 md:grid-cols-2">
      <label>{t('documents.fields.project')}
        <select aria-label={t('documents.fields.project')} value={projectId} onChange={event => {currentView.current=null;setProjectId(event.target.value);const next=projects.find(row=>row.id===event.target.value);navigate(next?'/admin/documents/upload?'+new URLSearchParams({organization_id:next.organization_id,project_id:next.id}):'/admin/documents/upload');}} disabled={processing} className="mt-1 block w-full rounded border p-2">
          <option value="">{t('documents.selectProject')}</option>
          {projects.map(row => <option key={row.id} value={row.id}>{row.name} ({row.project_code})</option>)}
        </select>
      </label>
      <label>{t('documents.fields.documentType')}
        <select aria-label={t('documents.fields.documentType')} value={documentType} onChange={event => setDocumentType(event.target.value as DocumentType)} disabled={processing} className="mt-1 block w-full rounded border p-2">
          {['receipt', 'invoice', 'bill', 'contract', 'report', 'other'].map(type => <option key={type} value={type}>{t(`documents.types.${type}`)}</option>)}
        </select>
      </label>
    </div>
    {project && !canUpload && <div role="status" className="mb-4 rounded border p-4">
      <p>{access?.view === view && access.error ? t(`documents.intake.errors.${access.error}`) : t('documents.intake.checkingAccess')}</p>
      {access?.view === view && access.error && <button type="button" onClick={() => { setAccess(null); setAccessRetry(value => value + 1); }} className="mt-2 underline">{t('common.retry')}</button>}
    </div>}
    <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (canUpload && !processing)
        addFiles(Array.from(event.dataTransfer.files)); }} className="mb-6 rounded border-2 border-dashed p-6">
      <label className="block">{t('documents.intake.chooseFiles')}
        <input type="file" multiple accept="application/pdf,image/jpeg,image/png" disabled={!canUpload || processing} onChange={event => { if (event.target.files)
        addFiles(Array.from(event.target.files)); event.target.value = ''; }} className="mt-2 block"/>
      </label>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label>{t('documents.uploadMethods.camera')}
          <input type="file" accept="image/jpeg,image/png" capture="environment" disabled={!canUpload||processing} onChange={event=>{if(event.target.files)addFiles(Array.from(event.target.files));event.target.value='';}} className="mt-2 block" />
        </label>
        <label>{t('documents.uploadMethods.gallery')}
          <input type="file" multiple accept="image/jpeg,image/png" disabled={!canUpload||processing} onChange={event=>{if(event.target.files)addFiles(Array.from(event.target.files));event.target.value='';}} className="mt-2 block" />
        </label>
      </div>
      <p className="mt-2 text-sm text-gray-600">{t('documents.intake.formats')}</p>
    </div>
    <div className="mb-4 text-sm">
      <button type="button" disabled={!project||processing} onClick={()=>project&&navigate(`/admin/activities?${new URLSearchParams({create:'true',projectId:project.id,organizationId:project.organization_id})}`)} className="underline disabled:opacity-50">{t('documents.uploadMethods.manual')}</button>
      <p className="mt-2 text-gray-500">{t('documents.uploadMethods.excel')} — {t('documents.uploadMethods.excelBadge')}</p>
    </div>
    {!files.length ? <p>{t('documents.intake.noFiles')}</p> : <div className="rounded border bg-white p-4">
      <p role="status">{t('documents.intake.summary', { received, total: files.length })}</p>
      <ul className="divide-y">{files.map(item => <li key={item.id} className="py-4">
        <p className="font-medium">{item.file?.name || item.attempt?.originalFilename} ({(item.file?.size ?? item.attempt?.fileSize ?? 0).toLocaleString(i18n.resolvedLanguage || i18n.language)} bytes)</p>
        <p role="status">{item.status==='cleaned'?t('documents.deletion.cleaned'):t(`documents.intake.states.${item.stage || item.status}`)}</p>
        {item.error && <p role="alert" className="text-red-700">{t(`documents.intake.errors.${item.error}`)}</p>}
        {item.attempt && <div className="mt-2 break-all text-sm">
          <p>{t('documents.intake.reference')}: {(item.receipt?.attempt??item.attempt).documentId}</p>
          <p>{(item.receipt?.attempt??item.attempt).storageBucket}/{(item.receipt?.attempt??item.attempt).storagePath}</p>
          {item.receipt?.verification&&<p className="mt-2 text-teal-800">{t('documents.intake.serverHashVerified')}</p>}
          {item.receipt?.recoveryReference&&<p>{t('documents.intake.alternateReceipt')}: {item.attempt.documentId} — {item.attempt.storagePath}</p>}
          <button type="button" onClick={() => saveReference(intakeReference(item.attempt!,item.receipt),item.attempt!.documentId)} className="mr-4 underline">{t('documents.intake.saveReference')}</button>
        </div>}
        {item.status === 'unknown' && <button type="button" onClick={() => void recheck(item)} disabled={processing} className="mt-2 underline disabled:opacity-50">{t('documents.intake.recheck')}</button>}
        {item.status==='unknown'&&<button type="button" onClick={()=>void recheck(item,true)} disabled={processing||!canUpload} className="ml-4 mt-2 underline disabled:opacity-50">{t('documents.intake.completeRegistration')}</button>}
        {(item.status==='unknown'||item.receipt?.recoveryReference)&&<button type="button" onClick={()=>setDiscarding(item)} disabled={processing} className="ml-4 mt-2 underline">{t('documents.intake.discardReference')}</button>}
        {(item.status==='unknown'||item.receipt?.recoveryReference)&&<><button type="button" onClick={()=>setCleaning(item)} disabled={processing||!canUpload} className="ml-4 mt-2 underline">{t('documents.deletion.orphanCleanup')}</button><button type="button" onClick={()=>void cleanOriginal(item,true)} disabled={processing||!canUpload} className="ml-4 mt-2 underline">{t('documents.deletion.orphanLookup')}</button><button type="button" onClick={()=>{if(!item.attempt||processing||!isAuthenticationCurrent(route.authEpoch,route.userId))return;try{forgetUploadDeletionReference(item.attempt,route.userId);setFiles(rows=>rows.map(row=>row.id===item.id?{...row,error:undefined}:row));}catch{setFiles(rows=>rows.map(row=>row.id===item.id?{...row,error:'deleteUnconfirmed'}:row));}}} disabled={processing} title={t('documents.deletion.clearMessage')} className="ml-4 mt-2 underline">{t('documents.deletion.clearReference')}</button><p className="mt-2 text-sm text-gray-600">{t('documents.deletion.clearMessage')} {t('documents.deletion.locateHint')}</p></>}
        {item.deletion&&<p role="status" className="mt-2 break-all">{t(item.deletion.operation_status==='deleted'?(item.deletion.receipt_present?'documents.deletion.completed':'documents.deletion.completedWithoutReceipt'):item.deletion.operation_status==='pending'?'documents.deletion.pending':'documents.deletion.notFound')} · {item.deletion.request_id}</p>}
        {['pending', 'failed'].includes(item.status) && <button type="button" onClick={() => setFiles(rows => rows.filter(row => row.id !== item.id))} disabled={processing} className="mt-2 underline">{t('common.cancel')}</button>}
      </li>)}</ul>
      <button type="button" onClick={() => void upload()} disabled={!canUpload || processing || !files.some(row => row.status === 'pending')} className="mt-4 rounded bg-teal-700 px-4 py-2 text-white disabled:bg-gray-400">{processing ? t('documents.intake.working') : t('common.upload')}</button>
    </div>}
    {cleaning&&<ConfirmDialog open title={t('documents.deletion.orphanCleanup')} message={t('documents.deletion.orphanConfirm')} confirmLabel={t('documents.deletion.orphanCleanup')} onConfirm={()=>void cleanOriginal(cleaning)} onCancel={()=>setCleaning(null)} isProcessing={processing}/>}
    {discarding&&<ConfirmDialog open title={t('documents.intake.discardReference')} message={t('documents.intake.discardMessage')} confirmLabel={t('documents.intake.discardConfirm')} onConfirm={discard} onCancel={()=>setDiscarding(null)}><button type="button" onClick={()=>discarding.attempt&&saveReference(intakeReference(discarding.attempt,discarding.receipt),discarding.attempt.documentId)} className="underline">{t('documents.intake.saveReference')}</button></ConfirmDialog>}
  </AdminLayout>;
}
