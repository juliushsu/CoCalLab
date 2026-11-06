import {Link,useLocation} from 'react-router-dom';
import {workflowDestinations,workflowStage,workflowHref} from '../../services/workflowNavigation';
export default function ValueChainProgress({organizationId}:{organizationId:string|null}){
 const location=useLocation(),stage=workflowStage(location.pathname);if(!stage)return null;
 const href=(path:string)=>workflowHref(path,location.pathname,location.search,organizationId);
 const shortcuts=stage==='report'?[['碳調整','/admin/carbon-adjustments'],['報告歷史','/admin/reports/history']]:stage==='documents'?[['收件清單','/admin/documents/list'],['待審清單','/admin/documents/drafts']]:stage==='draft'||stage==='activity'?[['前往排放分析','/admin/analytics'],['前往報告中心','/admin/reports']]:[['前往報告中心','/admin/reports']];
 return <section aria-label="盤查流程導覽" className="mb-5 rounded-xl border border-teal-200 bg-white p-4">
 <nav aria-label="五階段流程" className="flex flex-wrap gap-2">{workflowDestinations.map((d,i)=>{const to=href(d.path);return to?<Link key={d.id} to={to} aria-current={stage===d.id?'step':undefined} className={'rounded px-3 py-2 text-sm '+(stage===d.id?'bg-teal-700 text-white':'bg-gray-100 text-gray-800')}>{i+1}. {d.label}</Link>:<span key={d.id} className="rounded bg-gray-100 px-3 py-2 text-sm text-gray-500">{i+1}. {d.label}</span>;})}</nav>
 <p className="mt-2 text-xs text-gray-600">僅標示目前頁面，不代表其他階段已完成。{organizationId?'導覽沿用目前單位／專案範圍。':'請先選擇可存取的單位／專案；正在確認範圍時暫停跳頁。'}</p>
 <div aria-label="下一步捷徑" className="mt-3 flex flex-wrap gap-4 text-sm text-teal-800">{shortcuts.map(([label,path])=>{const to=href(path);return to?<Link key={path} to={to} className="underline">{label}</Link>:null;})}</div>
 </section>;
}
