import { useState, useEffect } from 'react';
import {saveManualActivity,manualContext,type ManualInput,type ManualProject} from '@/services/manualWorkflow';
import {activityReference,clearManualReference} from '@/services/manualRecovery';
import {replacementFormIntent,replacementOperation,replacementReferenceForm} from '@/services/activityReplacement';
import {replacementReference,readReplacementReferences,clearReplacementReference,captureReplacementReferences,abandonCapturedReplacementReference,type ReplacementReference} from '@/services/activityReplacementRecovery';
import {readActivityLineage} from '@/services/activityLineage';
import type {EmissionActivity} from '@/types/activity';
import { useTranslation } from 'react-i18next';
import { getSupabaseClient } from '@/lib/supabase';
import { IS_STAGING } from '@/utils/staging';
import { getSuggestedScope } from '@/utils/categoryScope';

interface CreateActivityModalProps {
  activity?: EmissionActivity;
  projectId?: string;
  organizationId?: string;
  userId: string;
  isCurrent: () => boolean;
  onClose: () => void;
  onCreated: (replacement?:{activityId:string;historical:boolean}) => void;
}

interface FormData extends ManualInput {
  activity_name: string;
  category: string;
  final_scope: string;
  quantity: string;
  unit: string;
  activity_date: string;
  notes: string;
}

const SCOPE_OPTIONS = ['1', '2', '3'];

const CATEGORY_OPTIONS = [
  'energy',
  'transport',
  'waste',
  'water',
  'materials',
  'refrigerants',
  'business_travel',
  'employee_commuting',
  'other',
];

export default function CreateActivityModal({ activity,projectId, organizationId, userId, isCurrent, onClose, onCreated }: CreateActivityModalProps) {
  const { t } = useTranslation();

  const [form, setForm] = useState<FormData>({
    activity_name: '',
    activity_type: '',
    inclusion_status: 'pending',
    exclusion_reason: '',
    category: '',
    final_scope: '',
    quantity: '',
    unit: '',
    activity_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [attemptId,setAttemptId] = useState('');
  const [requestId,setRequestId] = useState('');
  const [projectData,setProjectData]=useState<ManualProject|null>(null);
  const [canReplace,setCanReplace]=useState(false),[mode,setMode]=useState<'correct'|'exclude'>('correct'),[reason,setReason]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0);
  const [reference,setReference]=useState<ReplacementReference|null>(null),[references,setReferences]=useState<ReplacementReference[]>([]),[captures,setCaptures]=useState<{key:string;raw:string}[]>([]);
  const [restoring,setRestoring] = useState(true);
  useEffect(()=>{
    let mounted=true;
    setRestoring(true);setError(null);setNotice('');setReference(null);setReferences([]);setCanReplace(false);
    void(async()=>{try{
      if(!projectId||!organizationId)throw new Error('請先選擇組織與專案。');
      const scope={organizationId,projectId},id=activity?.id??activityReference(sessionStorage,scope,userId);
      const project=await manualContext(getSupabaseClient(),scope,userId,isCurrent);
      const r=await getSupabaseClient().from('emission_activities').select('*').eq('id',id).eq('organization_id',organizationId).eq('project_id',projectId).maybeSingle();
      if(!mounted||!isCurrent())return;
      if(r.error)throw new Error('無法核對先前的建檔識別，未開始新的建檔。');
      setAttemptId(id);
      setRequestId(id);setProjectData(project);
      if(r.data){const row=r.data;setForm({activity_name:row.activity_name,category:row.category,subcategory:row.subcategory??null,data_quality:row.data_quality,status:row.status,activity_type:row.activity_type,quantity:String(row.quantity),unit:row.unit,activity_date:row.activity_date,notes:row.review_note??'',final_scope:row.final_scope===null?'':String(row.final_scope),inclusion_status:row.inclusion_status,exclusion_reason:row.exclusion_reason??''});}
      if(activity){
        if(!r.data)throw new Error('原活動不可存取，未建立取代。');
        setCaptures(captureReplacementReferences(sessionStorage,scope,userId,id));
        const refs=readReplacementReferences(sessionStorage,scope,userId,id),family=await readActivityLineage(getSupabaseClient(),scope,id,isCurrent);
        if(!mounted||!isCurrent())return;
        setCanReplace(family.versions.find(row=>row.activity_id===id)?.is_effective===true);setReferences(refs);
        if(refs.length===1){const ref=refs[0];setReference(ref);setMode(ref.intent.mode);setReason(ref.intent.reason);setForm(prior=>replacementReferenceForm(ref.intent,prior));}
      }
    }catch(cause){if(mounted&&isCurrent())setError(cause instanceof Error?cause.message:'恢復建檔參考失敗。');}
    finally{if(mounted&&isCurrent())setRestoring(false);}})();
    return()=>{mounted=false;};
  },[activity,projectId,organizationId,userId,isCurrent,reload]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track whether user has manually overridden the auto-suggested scope
  const [scopeOverridden, setScopeOverridden] = useState(false);
  // Track the last auto-suggested scope so we can detect manual changes
  const [suggestedScope, setSuggestedScope] = useState<string | null>(null);

  const handleChange = (field: keyof FormData, value: string) => {
    if (field === 'category') {
      const suggested = getSuggestedScope(value);
      if (suggested && !scopeOverridden) {
        // Auto-fill scope only if user hasn't manually overridden it
        setSuggestedScope(suggested);
        setForm(prev => ({ ...prev, category: value, final_scope: suggested }));
      } else if (!value) {
        // Category cleared — reset scope suggestion state
        setSuggestedScope(null);
        setScopeOverridden(false);
        setForm(prev => ({ ...prev, category: value, final_scope: '' }));
      } else {
        setSuggestedScope(suggested);
        setForm(prev => ({ ...prev, category: value }));
      }
      return;
    }

    if (field === 'final_scope') {
      // User manually changed scope — mark as overridden
      if (suggestedScope && value !== suggestedScope) {
        setScopeOverridden(true);
      } else if (value === suggestedScope) {
        // User changed back to suggested value — clear override flag
        setScopeOverridden(false);
      }
    }

    setForm(prev => ({ ...prev, [field]: value }));
  };

  const validate = (): string | null => {
    if (!form.activity_name.trim()) return t('activities.create.errors.nameRequired');
    if (!form.activity_date) return t('activities.create.errors.dateRequired');
    if (form.quantity && isNaN(Number(form.quantity))) return t('activities.create.errors.quantityInvalid');
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (!projectId || !organizationId) throw new Error('請先選擇明確組織與專案。');
      if(activity){
        if(!projectData||!canReplace&&!reference)throw new Error('此活動不是目前有效末端，只能讀取歷史或核對原請求。');
        const scope={organizationId,projectId},ref=reference??replacementReference(sessionStorage,scope,userId,activity.id,replacementFormIntent(mode,reason,form,scope,userId,activity.id,projectData));
        setReference(ref);setReferences(readReplacementReferences(sessionStorage,scope,userId,activity.id));setCaptures(captureReplacementReferences(sessionStorage,scope,userId,activity.id));
        const result=await replacementOperation(getSupabaseClient(),scope,userId,ref,'replace',isCurrent);if(!isCurrent())return;
        if(!result.activity_id||result.operation_status==='not_found')throw new Error('尚未確認取代保存；保留原ID核對。');
        clearReplacementReference(sessionStorage,scope,userId,ref);onCreated({activityId:result.activity_id,historical:result.operation_status==='historical'});return;
      }
      await saveManualActivity(getSupabaseClient(),{organizationId,projectId},userId,attemptId,{...form,activity_name:IS_STAGING&&!activity&&!form.activity_name.trim().startsWith('[TEST]')?'[TEST] '+form.activity_name.trim():form.activity_name},isCurrent,requestId);
      if (!isCurrent()) return;
      clearManualReference(sessionStorage,{organizationId,projectId},userId,'activity',attemptId);
      onCreated();
    } catch (err) {
      console.error('Create activity failed:', err);
      if(isCurrent()) setError(err instanceof Error?err.message:t('errors.generic'));
    } finally {
      if(isCurrent()) setSubmitting(false);
    }
  };
  async function lookupReplacement(){
    if(!activity||!reference||!projectId||!organizationId||submitting||!isCurrent())return;setSubmitting(true);setError(null);
    try{const result=await replacementOperation(getSupabaseClient(),{organizationId,projectId},userId,reference,'lookup',isCurrent);if(!isCurrent())return;if(result.operation_status==='not_found')setNotice('服務端尚未找到此請求的已保存取代；不代表零排放。原ID與意圖保留，可按原請求重試。');else{setNotice('已查回原後繼 '+result.activity_id+'；'+(result.is_effective?'目前有效':'已是歷史版本')+'。原資料保留，未重建版本。');clearReplacementReference(sessionStorage,{organizationId,projectId},userId,reference);onCreated({activityId:result.activity_id!,historical:result.operation_status==='historical'});}}
    catch(cause){if(isCurrent())setError(cause instanceof Error?cause.message:'核對未完成，原參考保留。');}finally{if(isCurrent())setSubmitting(false);}
  }

  const getCategoryLabel = (cat: string) => {
    return t(`activities.categoryLabels.${cat}`, cat);
  };

  const getScopeHelperText = (): { text: string; type: 'suggested' | 'overridden' | 'none' | 'no-suggestion' } => {
    if (!form.category) return { text: '', type: 'none' };
    if (suggestedScope === null) return { text: t('activities.create.scopeNoSuggestion'), type: 'no-suggestion' };
    if (scopeOverridden) return { text: t('activities.create.scopeOverridden'), type: 'overridden' };
    if (form.final_scope === suggestedScope) return { text: t('activities.create.scopeSuggested'), type: 'suggested' };
    return { text: '', type: 'none' };
  };

  const scopeHelper = getScopeHelperText();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center bg-teal-100 rounded-lg flex-shrink-0">
              <i className="ri-add-circle-line text-teal-600 text-lg"></i>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{activity?'更正／排除活動（保留原版）':t('activities.create.title')}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{activity?'新增可追溯的更正／排除版本，原活動及歷史報告保留。':t('activities.create.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose} disabled={submitting} aria-label={t('common.close')}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>
        {activity&&<div className="mx-6 mt-3 space-y-2 text-sm"><p>新增可追溯版本；原活動、原計算、來源草稿及歷史報告保持原值。只有目前有效末端可取代。保存後須明確重算，再保存新報告；不冒稱重新OCR或雙人覆核。</p><button disabled={submitting||restoring} type="button" className="underline" onClick={()=>setReload(n=>n+1)}>重新核對原活動／取代參考</button>{!restoring&&!canReplace&&<p>此列已非目前有效末端；只能查看歷史或核對既有取代請求。</p>}{notice&&<p role="status">{notice}</p>}{references.length>1&&!reference&&<div><p>有多筆原請求，請明確選擇一筆核對，不會覆寫其他分頁參考。</p>{references.map(ref=><button type="button" className="block underline" key={ref.requestId} onClick={()=>{setReference(ref);setMode(ref.intent.mode);setReason(ref.intent.reason);setForm(prior=>replacementReferenceForm(ref.intent,prior));setNotice('已選擇原請求；下方顯示此請求保存的原意圖，重試不改值。');}}>{ref.requestId} · {ref.intent.mode} · {ref.intent.reason}</button>)}</div>}{reference&&<><p>原請求：{reference.requestId}；意圖已持久保存，失回覆仍沿用此ID。</p><details><summary>原請求保存的欄位（唯讀）</summary><pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(reference.intent,null,2)}</pre></details><button disabled={submitting||restoring} type="button" className="underline" onClick={()=>void lookupReplacement()}>核對原取代請求（不建立新版）</button></>}{captures.map(captured=><button key={captured.key} disabled={submitting} type="button" className="block underline" onClick={()=>{if(!projectId||!organizationId||!isCurrent())return;try{abandonCapturedReplacementReference(sessionStorage,{organizationId,projectId},userId,activity.id,captured);setReload(n=>n+1);}catch(cause){setError(cause instanceof Error?cause.message:'參考未清除。');}}}>放棄此本機參考 {captured.key.slice(-8)}（不取消伺服器操作、不刪資料）</button>)}</div>}

        {/* Staging notice */}
        {IS_STAGING && !activity && (
          <div className="mx-6 mt-4 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <i className="ri-test-tube-line text-amber-500 text-sm flex-shrink-0"></i>
            <p className="text-xs text-amber-700">{t('activities.create.stagingNotice')}</p>
          </div>
        )}

        {/* Pending write API notice */}
        <div className="mx-6 mt-4 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <i className="ri-information-line text-blue-500 text-sm flex-shrink-0"></i>
          <p className="text-xs text-blue-700">{activity?'取代會建立新的服務端活動ID，不覆寫前版；前版識別：':'人工輸入保存為新活動，須明確確認納入狀態與Scope。識別：'}{attemptId}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {activity&&<div className="space-y-3"><label className="block text-sm">版本操作<select aria-label="版本操作" value={mode} disabled={submitting||restoring||Boolean(reference)||!canReplace||references.length>1} onChange={e=>setMode(e.target.value as 'correct'|'exclude')} className="block w-full rounded border p-2"><option value="correct">更正：新增目前有效版本</option><option value="exclude">排除：保留原數量與單位</option></select></label><label className="block text-sm">更正／排除理由<input aria-label="更正／排除理由" required value={reason} disabled={submitting||restoring||Boolean(reference)||!canReplace||references.length>1} onChange={e=>setReason(e.target.value)} className="block w-full rounded border p-2"/></label>{mode==='exclude'&&<p>下方為原活動用量；新版沿用原 quantity／unit，不改成零，只明確記錄 excluded 與本次排除理由。</p>}</div>}
          <fieldset className="space-y-4" disabled={Boolean(activity&&(reference||mode==='exclude'||!canReplace||references.length>1))}>
          {/* Activity Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('activities.fields.activity_name')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              value={form.activity_name}
              onChange={e => handleChange('activity_name', e.target.value)}
              placeholder={t('activities.create.placeholders.name')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled={submitting||restoring||!attemptId}
            />
          </div>

          {/* Category + Scope row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('activities.fields.category')}
              </label>
              <select
                value={form.category}
                onChange={e => handleChange('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={submitting||restoring||!attemptId}
              >
                <option value="">{t('activities.create.placeholders.selectCategory')}</option>
                {CATEGORY_OPTIONS.map(cat => (
                  <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('activities.fields.scope')}
                {suggestedScope && !scopeOverridden && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-normal text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">
                    <i className="ri-magic-line text-xs"></i>
                    Auto
                  </span>
                )}
                {scopeOverridden && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-normal text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                    <i className="ri-edit-line text-xs"></i>
                    Manual
                  </span>
                )}
              </label>
              <select
                value={form.final_scope}
                onChange={e => handleChange('final_scope', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-colors ${
                  suggestedScope && !scopeOverridden && form.final_scope
                    ? 'border-teal-300 bg-teal-50/30'
                    : scopeOverridden
                    ? 'border-orange-300 bg-orange-50/20'
                    : 'border-gray-300'
                }`}
                disabled={submitting||restoring||!attemptId}
              >
                <option value="">{t('activities.create.placeholders.selectScope')}</option>
                {SCOPE_OPTIONS.map(s => (
                  <option key={s} value={s}>Scope {s}</option>
                ))}
              </select>
              {/* Scope helper text */}
              {scopeHelper.type !== 'none' && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${
                  scopeHelper.type === 'suggested' ? 'text-teal-600' :
                  scopeHelper.type === 'overridden' ? 'text-orange-600' :
                  'text-gray-400'
                }`}>
                  <i className={`${
                    scopeHelper.type === 'suggested' ? 'ri-magic-line' :
                    scopeHelper.type === 'overridden' ? 'ri-edit-line' :
                    'ri-information-line'
                  } text-xs`}></i>
                  {scopeHelper.text}
                </p>
              )}
            </div>
          </div>

          <div><label className="block text-sm">活動類型（係數匹配鍵，例如 electricity）<input aria-label="活動類型" value={form.activity_type} onChange={e=>handleChange('activity_type',e.target.value)} disabled={submitting||restoring||!attemptId} required className="block w-full border rounded p-2"/></label></div>
          <div><label className="block text-sm">納入狀態<select aria-label="納入狀態" value={form.inclusion_status} onChange={e=>handleChange('inclusion_status',e.target.value)} disabled={submitting||restoring||!attemptId} className="block w-full border rounded p-2"><option value="pending">待確認</option><option value="included">已人工確認納入</option><option value="excluded">排除</option></select></label><p className="text-xs">大類 Scope 建議僅供參考；請依實際活動與邊界明確確認，不能將所有 energy 視為購入電力。</p></div>
          {form.inclusion_status==='excluded'&&<label className="block text-sm">排除原因<input aria-label="排除原因" required value={form.exclusion_reason} disabled={submitting||restoring||!attemptId} onChange={e=>handleChange('exclusion_reason',e.target.value)} className="block w-full border rounded p-2"/></label>}
          {/* Quantity + Unit row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('activities.fields.quantity')}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.quantity}
                onChange={e => handleChange('quantity', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={submitting||restoring||!attemptId}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('activities.fields.unit')}
              </label>
              <input
                type="text"
                value={form.unit}
                onChange={e => handleChange('unit', e.target.value)}
                placeholder={t('activities.create.placeholders.unit')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={submitting||restoring||!attemptId}
              />
            </div>
          </div>

          {/* Activity Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('activities.fields.activity_date')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="date"
              value={form.activity_date}
              onChange={e => handleChange('activity_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled={submitting||restoring||!attemptId}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('activities.create.fields.notes')}
              <span className="text-gray-400 text-xs ml-1">({t('common.optional')})</span>
            </label>
            <textarea
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              placeholder={t('activities.create.placeholders.notes')}
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              disabled={submitting||restoring||!attemptId}
            />
            <p className="text-xs text-gray-400 text-right mt-0.5">{form.notes.length}/500</p>
          </div>

          <p className="text-xs">重新開啟可核對同一使用者／專案的建檔識別。關閉視窗不會撤回已送出的伺服器寫入。{restoring?'正在核對…':''}</p>
          </fieldset>
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <i className="ri-error-warning-line text-red-500 text-sm flex-shrink-0"></i>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting||restoring||!attemptId||Boolean(activity&&(!canReplace&&!reference||references.length>1&&!reference))}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <i className="ri-loader-4-line animate-spin"></i>}
              {submitting ? t('activities.create.submitting') : activity?reference?'以原請求重試取代':mode==='exclude'?'保存排除新版（原用量保留）':'保存更正新版（原版保留）':t('activities.create.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
