import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import EmptyState from '../../../components/base/EmptyState';
import { useAuth } from '../../../hooks/useAuth';
import { currentSession } from '../../../services/navigationScope';
import { getEmissionActivityDetail } from '../../../services/activityService';
import { activityDetailSelection, matchingActivityDetailState, formatActivityEmissions, type ActivityDetail } from '../../../services/activityDetail';

type ReadState = {status:'success';detail:ActivityDetail|null} | {status:'error';message:string};
const activityStatuses = {active:'使用中',voided:'作廢',archived:'已封存'};
const inclusionStatuses = {included:'納入',excluded:'排除',pending:'待確認'};
const calculationStatuses = {calculated:'已計算',pending_factor:'等待係數',error:'計算失敗',superseded:'已被取代／不計入'};
function Field({label,children}: {label:string;children:ReactNode}) {
  return <div><dt className="text-sm font-medium text-gray-500">{label}</dt><dd className="mt-1 break-words text-sm text-gray-900">{children ?? '未知'}</dd></div>;
}
function timestamp(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return '未知';
  return new Date(value).toLocaleString('zh-TW');
}
function json(value: unknown) { return JSON.stringify(value,null,2); }

export default function EmissionActivityDetailPage() {
  const { t } = useTranslation();
  const { activityId } = useParams<{activityId:string}>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session,loading:authLoading } = useAuth();
  const [retry,setRetry] = useState(0);
  const search = searchParams.toString();
  // Bind rendered data before effects run; previous activity/tenant/session data cannot flash.
  const key = useMemo(() => ({activityId,search,session,retry}),[activityId,search,session,retry]);
  const [result,setResult] = useState<{key:typeof key;value:ReadState}|null>(null);
  const state = matchingActivityDetailState(result,key);
  useEffect(() => {
    let active = true;
    if (authLoading) return () => { active = false; };
    if (!currentSession(key.session)) {
      setResult({key,value:{status:'error',message:'請先登入有效的工作階段。'}});
      return () => { active = false; };
    }
    try {
      const selected = activityDetailSelection(key.activityId,key.search);
      void getEmissionActivityDetail(selected).then(detail => {
        if (!active) return;
        setResult({key,value:currentSession(key.session)
          ? {status:'success',detail}
          : {status:'error',message:'工作階段已失效，請重新登入。'}});
      }).catch(cause => {
        if (active) setResult({key,value:{status:'error',message:cause instanceof Error ? cause.message : '活動資料讀取失敗。'}});
      });
    } catch (cause) {
      setResult({key,value:{status:'error',message:cause instanceof Error ? cause.message : '活動識別或選取範圍無效。'}});
    }
    return () => { active = false; };
  },[key,authLoading]);
  const reload = () => setRetry(value => value + 1);
  if (authLoading || !state) return <AdminLayout><div role="status" aria-label="正在讀取活動資料"><LoadingState /></div></AdminLayout>;
  if (!currentSession(session)) return <AdminLayout><ErrorState message="工作階段已失效，請重新登入。" /></AdminLayout>;
  if (state.status === 'error') return <AdminLayout><ErrorState message={state.message} onRetry={reload} /></AdminLayout>;
  if (!state.detail) return <AdminLayout><EmptyState title="找不到可存取的活動" description="此活動不存在，或不在目前組織／專案的可存取範圍。" actionLabel="重新讀取" onAction={reload} /></AdminLayout>;
  const {activity,calculation} = state.detail;
  const backQuery = new URLSearchParams({organizationId:activity.organization_id,projectId:activity.project_id});
  return <AdminLayout><div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <button onClick={() => navigate(`/admin/activities?${backQuery}`)} className="mb-2 flex items-center text-sm text-gray-600 hover:text-gray-900"><i className="ri-arrow-left-line mr-1" />{t('common.back')}</button>
        <h1 className="text-3xl font-bold text-gray-900">{activity.activity_name}</h1>
        <p className="mt-2 text-sm text-gray-600">{activity.project_name ?? '專案名稱未提供'} · {activity.activity_code}</p>
      </div>
      <button onClick={reload} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">重新讀取</button>
    </div>
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
      <p>目前提供已保存活動與最新計算快照的唯讀查看。活動狀態、計算完成與人工驗證是不同事項。</p>
      <div className="mt-3 flex flex-wrap gap-2">{['人工驗證','編輯','重新計算'].map(label => <button key={label} disabled className="cursor-not-allowed rounded-lg border border-gray-300 px-3 py-2 text-gray-500">{label}（尚未提供）</button>)}</div>
    </div>
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">活動資料</h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="活動日期">{activity.activity_date}</Field><Field label="活動狀態">{activityStatuses[activity.status]}</Field>
        <Field label="分類">{activity.category}</Field><Field label="子分類">{activity.subcategory}</Field>
        <Field label="活動類型">{activity.activity_type}</Field><Field label="納入狀態">{inclusionStatuses[activity.inclusion_status]}</Field>
        <Field label="原始數量與單位">{`${activity.quantity} ${activity.unit}`}</Field>
        <Field label="標準化數量與單位">{activity.normalized_quantity !== null && activity.normalized_unit ? `${activity.normalized_quantity} ${activity.normalized_unit}` : '未知'}</Field>
        <Field label="已確定範疇">{activity.final_scope === null ? '尚未確認' : `Scope ${activity.final_scope}`}</Field>
        <Field label="建議範疇（不代表已確認）">{activity.suggested_scope === null ? '未提供' : `Scope ${activity.suggested_scope}`}</Field>
        <Field label="資料品質">{activity.data_quality}</Field><Field label="排除原因">{activity.exclusion_reason}</Field><Field label="審查備註">{activity.review_note}</Field>
      </dl>
    </section>
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">最新計算快照</h2>
      <p className="mb-4 text-xl font-bold text-teal-700">{formatActivityEmissions(calculation?.co2e_kg)}</p>
      {calculation ? <>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="計算狀態">{calculationStatuses[calculation.status]}</Field><Field label="計算版本">{calculation.calc_version}</Field>
          <Field label="公式版本">{calculation.formula_version}</Field><Field label="計算時間">{timestamp(calculation.calculated_at)}</Field>
          <Field label="計算記錄 ID">{calculation.id}</Field><Field label="錯誤代碼">{calculation.error_code ?? '未提供'}</Field>
        </dl>
        {calculation.warnings.length > 0 && <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3"><h3 className="text-sm font-medium">保存的計算警告</h3><pre className="mt-2 whitespace-pre-wrap break-words text-xs">{json(calculation.warnings)}</pre></div>}
        <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-gray-700">保存的係數與輸入（保留來源單位）</summary>
          <p className="mt-2 text-sm text-gray-500">以下為這次計算保存的快照，不是目前的係數庫內容。計算完成不等於人工驗證通過。</p>
          <h3 className="mt-3 text-sm font-medium">factor_snapshot</h3><pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded bg-gray-50 p-3 text-xs">{json(calculation.factor_snapshot)}</pre>
          <h3 className="mt-3 text-sm font-medium">input_snapshot</h3><pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded bg-gray-50 p-3 text-xs">{json(calculation.input_snapshot)}</pre>
        </details>
      </> : <p className="text-sm text-gray-600">尚無可存取的最新計算快照；不使用舊版本或測試值代替。</p>}
    </section>
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">來源與資料識別</h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="活動 ID">{activity.id}</Field><Field label="組織 ID">{activity.organization_id}</Field><Field label="專案 ID">{activity.project_id}</Field>
        <Field label="來源文件 ID">{activity.source_document_id?<button type="button" className="text-teal-700 underline" onClick={()=>navigate('/admin/documents/list?'+new URLSearchParams({organization_id:activity.organization_id,projectId:activity.project_id,document:activity.source_document_id!}))}>{activity.source_document_id} — 查看來源文件</button>:'未提供'}</Field>
        <Field label="來源草稿 ID">{activity.source_draft_id??'未提供'}{activity.source_draft_id&&<button type="button" className="mt-2 block text-teal-700 underline" onClick={()=>navigate('/admin/documents/drafts?'+new URLSearchParams({organization_id:activity.organization_id,project_id:activity.project_id,...(activity.source_document_id?{document:activity.source_document_id}:{})}))}>開啟待審清單（已確認來源草稿不列於待審）</button>}</Field>
        <Field label="建立時間">{timestamp(activity.created_at)}</Field><Field label="更新時間">{timestamp(activity.updated_at)}</Field>
      </dl>
    </section>
  </div></AdminLayout>;
}
