import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import {getSupabaseClient} from '../../../lib/supabase';
import {useAuth} from '../../../hooks/useAuth';
import {useTenantNavigation} from '../../../hooks/useTenantNavigation';
import {useSubscriptionStatus} from '../../../hooks/useSubscriptionStatus';
import {readPrivateOriginal} from '../../../services/documentLibrary';
import {manualScope,manualFormValues,requireMatchingManualAttempt,readManualAttempt,writeManualAttempt,abandonManualAttempt,readManualDraft,submitManualTranscription,confirmManualTranscription,type ManualAttempt,type ManualValues} from '../../../services/manualTranscription';
import type {ExtractedDocumentDraft} from '../../../types/document';
const blank:Record<string,string>={activity_name:'',quantity:'',unit:'',activity_date:'',category:'',activity_type:'',final_scope:'',inclusion_status:'pending',exclusion_reason:'',review_note:'',period_start:'',period_end:'',source_locator:'',source_text:''};
const labels:Record<string,string>={activity_name:'活動名稱',quantity:'數量（可填0，不可空白）',unit:'原單位',activity_date:'活動日期',category:'類別',activity_type:'活動型態（例如 electricity）',final_scope:'Scope',inclusion_status:'納入狀態',exclusion_reason:'排除原因',review_note:'轉錄備註',period_start:'文件期間起日（未知可空白）',period_end:'文件期間迄日（未知可空白）',source_locator:'原件位置（頁／表格／列）',source_text:'原文摘錄（人工選填，非OCR）'};
function formOf(value:ManualValues){return Object.fromEntries(Object.keys(blank).map(key=>[key,value[key as keyof ManualValues]===null?'':String(value[key as keyof ManualValues]??'')]));}
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
export default function ManualTranscriptionPage(){
 const {documentId=''}=useParams(),[params]=useSearchParams();const search=params.toString();
 const selected=useMemo(()=>{try{return {scope:manualScope(documentId,search),error:''};}catch(e){return {scope:null,error:e instanceof Error?e.message:'範圍無效。'};}},[documentId,search]);
 const {user,authEpoch,loading:authLoading,isAuthenticationCurrent}=useAuth();const userId=user?.id||'';
 const context=useMemo(()=>({selected,userId,authEpoch}),[selected,userId,authEpoch]);const active=useRef<typeof context|null>(context);
 const navigation=useTenantNavigation(),subscription=useSubscriptionStatus(selected.scope?.organizationId,{failClosed:true,scopeKey:search});
 const isCurrent=useCallback(()=>active.current===context&&isAuthenticationCurrent(authEpoch,userId),[context,authEpoch,userId,isAuthenticationCurrent]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const [original,setOriginal]=useState<{url:string;name:string;mime:string;hashChecked:boolean}|null>(null),[draft,setDraft]=useState<ExtractedDocumentDraft|null>(null),[attempt,setAttempt]=useState<ManualAttempt|null>(null),[form,setForm]=useState<Record<string,string>>(blank),[reviewNote,setReviewNote]=useState('');
 const resource=useRef<string|null>(null);
 useLayoutEffect(()=>{active.current=context;return()=>{if(active.current===context)active.current=null;if(resource.current)URL.revokeObjectURL(resource.current);resource.current=null;};},[context]);
 useEffect(()=>{
  if(authLoading||!selected.scope||!userId){setLoading(false);return;}
  const scope=selected.scope;let cancelled=false;const current=()=>!cancelled&&isCurrent();
  setLoading(true);setError('');setDraft(null);setOriginal(null);
  void (async()=>{
   const loaded=await readPrivateOriginal(getSupabaseClient(),scope.documentId,scope,userId,current);
   if(!loaded.previewable)throw new Error('原件類型或簽章無法安全預覽，先核對原件，未啟用轉錄。');
   const saved=await readManualDraft(getSupabaseClient(),scope,current);if(!current())return;
   const pending=readManualAttempt(sessionStorage,scope,userId);requireMatchingManualAttempt(pending,saved);if(pending){setAttempt(pending);setForm(formOf(pending.transcription));}
   else{setAttempt(null);setForm(blank);}
   const url=URL.createObjectURL(loaded.blob);if(resource.current)URL.revokeObjectURL(resource.current);resource.current=url;
   setOriginal({url,name:loaded.document.original_filename,mime:loaded.previewMime||'',hashChecked:/^[a-f0-9]{64}$/.test(loaded.document.sha256_hash)});setDraft(saved);
   if(saved){const p=saved.raw_payload.manual_transcription;const confirmation=object(p)&&object(p.confirmation)?p.confirmation:null;setReviewNote(pending?.confirmation?.reviewNote||saved.review_note||'');if(confirmation)setNotice('已讀回伺服器確認紀錄；不重建活動。本次尚未重讀計算狀態，請至活動查看，不以缺少警示當作計算完成。');}
  })().catch(e=>{if(current())setError(e instanceof Error?e.message:'讀取失敗，未啟用轉錄。');}).finally(()=>{if(current())setLoading(false);});
  return()=>{cancelled=true;};
 },[authLoading,selected,userId,isCurrent,retry]);
 const canWrite=Boolean(original&&!error&&!loading&&!busy&&navigation.status==='ready'&&['owner','admin','editor'].includes(navigation.role||'')&&!subscription.loading&&!subscription.error&&!subscription.isReadonly);
 async function create(){
  if(!canWrite||!selected.scope||draft)return;const scope=selected.scope;
  setBusy(true);setNotice('');try{
   const next=attempt||{draftId:crypto.randomUUID(),requestId:crypto.randomUUID(),transcription:manualFormValues(form)};
   if(!isCurrent())return;writeManualAttempt(sessionStorage,scope,userId,next);setAttempt(next);
   await submitManualTranscription(getSupabaseClient(),scope,next,isCurrent);
   const saved=await readManualDraft(getSupabaseClient(),scope,isCurrent);if(!saved||saved.id!==next.draftId)throw new Error('尚未讀回保存轉錄；保留原ID後重試，不建立新ID。');
   if(isCurrent()){setDraft(saved);setNotice('人工轉錄已保存；尚待確認，不代表OCR或雙人覆核。');}
  }catch(e){if(isCurrent())setNotice('未確認保存／失敗：'+(e instanceof Error?e.message:String(e))+'。保留原ID，可重新核對或以原請求重試。');}finally{if(isCurrent())setBusy(false);}
 }
 async function confirm(decision:'confirmed'|'rejected'){
  if(!canWrite||!selected.scope||!draft)return;const scope=selected.scope;setBusy(true);setNotice('');
  try{
   requireMatchingManualAttempt(attempt,draft);
   const next=attempt||{draftId:draft.id,requestId:crypto.randomUUID(),transcription:draft.normalized_payload as unknown as ManualValues};
   if(next.confirmation&&next.confirmation.decision!==decision)throw new Error('已有尚未核對的相反決定；請先重讀確認紀錄。');
   next.confirmation??={requestId:crypto.randomUUID(),decision,reviewNote:reviewNote.trim()||null};
   writeManualAttempt(sessionStorage,scope,userId,next);setAttempt({...next});
   const result=await confirmManualTranscription(getSupabaseClient(),scope,draft,next.confirmation,isCurrent);
   const saved=await readManualDraft(getSupabaseClient(),scope,isCurrent);if(!saved||saved.status!==decision)throw new Error('確認尚未讀回，保留原確認請求重試。');
   if(isCurrent()){setDraft(saved);setNotice('已保存人工'+(decision==='confirmed'?'確認及活動':'駁回')+'；計算狀態：'+String(result.data.calculation_status??'無計算')+'；排放量：'+(typeof result.data.co2e_kg==='number'?result.data.co2e_kg+' kgCO₂e':'未知／未計算')+'；保存警示：'+JSON.stringify(result.data.calculation_warnings??'無計算結果')+'。缺係數或錯誤不代表排放量為0。');}
  }catch(e){if(isCurrent())setNotice('確認未完成／未核對：'+(e instanceof Error?e.message:String(e)));}finally{if(isCurrent())setBusy(false);}
 }
 function abandon(){if(!selected.scope||busy)return;try{abandonManualAttempt(sessionStorage,selected.scope,userId);setAttempt(null);setNotice('只清除此使用者／單位／專案／文件的本機恢復參考；未刪除伺服器原件或草稿。');setRetry(n=>n+1);}catch{setNotice('無法清除本機參考；未變更伺服器資料。');}}
 const provenance=draft&&object(draft.raw_payload.manual_transcription)?draft.raw_payload.manual_transcription:null;
 const link=selected.scope?'?'+new URLSearchParams({organization_id:selected.scope.organizationId,projectId:selected.scope.projectId}):'';
 return <AdminLayout><div className="mx-auto max-w-6xl space-y-4"><h1 className="text-2xl font-semibold">人工轉錄與確認（非OCR）</h1>
 <p className="rounded bg-amber-50 p-3">由人核對原件並填值；允許同人轉錄／確認，並非雙人覆核。不自動跨期分攤、不指定係數釘選；來源SHA仍未由伺服器驗真。確認後依既有resolver計算，缺係數／歧義保留未知。</p>
 {(selected.error||error)&&<p role="alert" className="rounded bg-red-50 p-3">{selected.error||error}</p>}
 <p role="status">{loading?'正在讀取私有原件與既有人工轉錄…':notice||(!canWrite?'目前唯讀或權限／訂閱尚未確認。':'請先核對原件，再保存人工轉錄。')}</p>
 <div className="flex flex-wrap gap-3"><button disabled={busy||loading} onClick={()=>setRetry(n=>n+1)} className="rounded border p-2">重新核對收件／草稿</button><button disabled={busy} onClick={abandon} className="rounded border p-2">放棄本機恢復參考（不刪伺服器資料）</button><Link className="p-2 text-teal-800 underline" to={'/admin/documents/list'+link}>返回文件清單</Link><Link className="p-2 text-teal-800 underline" to={'/admin/activities'+link}>活動／計算與報告</Link></div>
 {original&&<section className="rounded border bg-white p-4"><h2 className="font-semibold">已授權原件：{original.name}</h2><p className="text-sm">本機大小／簽章已核對；hash：{original.hashChecked?'已在本機比對':'未提供有效hash，未比對'}。不是伺服器內容驗真。</p>{original.mime==='application/pdf'?<iframe title="人工轉錄原件" src={original.url} className="mt-3 h-72 w-full border"/>:<img src={original.url} alt="人工轉錄原件" className="max-h-96"/>}</section>}
 {original&&!draft&&<form onSubmit={e=>{e.preventDefault();void create();}} className="grid gap-4 rounded border bg-white p-4 md:grid-cols-2">
 {Object.entries(blank).map(([key])=><label key={key} className="text-sm">{labels[key]}{key==='inclusion_status'||key==='final_scope'?<select aria-label={labels[key]} value={form[key]} disabled={!canWrite||Boolean(attempt)} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-1 block w-full rounded border p-2">{(key==='inclusion_status'?[['pending','待確認'],['included','納入'],['excluded','排除']]:[['','未指定'],['1','Scope 1'],['2','Scope 2'],['3','Scope 3']]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>:<input aria-label={labels[key]} type="text" placeholder={key.includes('date')||key.startsWith('period_')?'YYYY-MM-DD':undefined} value={form[key]} disabled={!canWrite||Boolean(attempt)} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-1 block w-full rounded border p-2"/>}</label>)}
 <p className="text-sm md:col-span-2">保存後canonical轉錄唯讀；未確認回覆時使用同一ID與原輸入重試，不重傳原件。若需修訂，先走人工釐清，本版不覆寫既有草稿。</p><button disabled={!canWrite} type="submit" className="rounded bg-teal-700 p-3 text-white disabled:opacity-40">{attempt?'以原ID重試保存轉錄':'保存人工轉錄（尚未確認）'}</button></form>}
 {draft&&<section className="space-y-3 rounded border bg-white p-4"><h2 className="font-semibold">已保存人工轉錄：{draft.status}</h2><p className="break-all">草稿：{draft.id}；轉錄者（server）：{String(provenance?.user_id||'未知')}；轉錄時間：{String(provenance?.transcribed_at||'未知')}；確認者（server）：{draft.reviewed_by_user_id||'尚未確認'}</p><p>{provenance?.user_id===userId?'目前登入者也是轉錄者；同人確認將明示紀錄。':'確認者與轉錄者會各自記錄。'}</p><dl className="grid gap-2 text-sm md:grid-cols-2">{Object.entries(draft.normalized_payload).map(([key,value])=><div key={key}><dt>{labels[key]||key}</dt><dd className="whitespace-pre-wrap break-all rounded bg-gray-50 p-2">{value===null?'未提供':String(value)}</dd></div>)}</dl>
 {['pending_review','needs_clarification'].includes(draft.status)&&<><label className="block text-sm">確認備註<input aria-label="確認備註" value={reviewNote} disabled={!canWrite||Boolean(attempt?.confirmation)} onChange={e=>setReviewNote(e.target.value)} className="mt-1 block w-full border p-2"/></label><button disabled={!canWrite} onClick={()=>void confirm('confirmed')} className="mr-3 rounded bg-teal-700 p-3 text-white disabled:opacity-40">確認並保存活動（非雙人覆核）</button><button disabled={!canWrite} onClick={()=>void confirm('rejected')} className="rounded border p-3 disabled:opacity-40">駁回人工轉錄</button></>}
 {object(provenance?.confirmation)&&<pre className="overflow-auto bg-gray-50 p-3 text-xs">{JSON.stringify(provenance.confirmation,null,2)}</pre>}
 </section>}
 </div></AdminLayout>;
}
