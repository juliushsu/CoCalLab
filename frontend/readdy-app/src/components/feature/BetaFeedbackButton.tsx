import {useState} from 'react';
import {useLocation} from 'react-router-dom';
import {resolveNavigationScope} from '../../services/navigationScope';
/** In-memory draft only. No receiving endpoint, telemetry or cross-product storage. */
export default function BetaFeedbackButton(){
 const location=useLocation(),scope=resolveNavigationScope(location.pathname,location.search);
 const [open,setOpen]=useState(false),[text,setText]=useState(''),[status,setStatus]=useState('');
 const org='organizationId' in scope?scope.organizationId:undefined,project='projectId' in scope?scope.projectId:undefined;
 async function copy(){if(!text.trim())return;try{await navigator.clipboard.writeText('CoCalLab 本機回饋草稿（尚未送出）\n單位：'+(org||'未選擇')+'\n專案：'+(project||'未選擇')+'\n'+text.trim());setStatus('已複製到剪貼簿；尚未送出，沒有傳給任何收件服務。');}catch{setStatus('複製失敗；請自行選取下方文字複製。尚未送出。');}}
 return <aside className="mt-6 rounded border bg-white p-3 text-sm" aria-label="本機封測回饋">
 <button type="button" onClick={()=>setOpen(!open)} className="text-teal-800 underline">封測回饋（尚未送出）</button>
 {open&&<div className="mt-3 space-y-2"><p>僅在目前頁面編寫／複製，切換頁面或單位會清除草稿。沒有接收服務，請勿填入憑證或企業敏感資料。</p><label className="block">本機回饋草稿<textarea aria-label="本機回饋草稿" maxLength={4000} value={text} onChange={e=>{setText(e.target.value);setStatus('尚未送出');}} className="mt-1 block w-full border p-2" /></label><button type="button" disabled={!text.trim()} onClick={()=>void copy()} className="rounded bg-teal-700 px-3 py-2 text-white disabled:opacity-40">複製草稿（不送出）</button><p role="status">{status||'尚未送出'}</p></div>}
 </aside>;
}
