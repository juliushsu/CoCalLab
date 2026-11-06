import type {ReportSavedSnapshot} from '../../../../types/report';
import {buildReportOutline} from '../../../../services/reportOutline';

export default function ReportOutlinePanel({snapshot}:{snapshot?:ReportSavedSnapshot|null}){
  const outline=buildReportOutline(snapshot);
  return <section className="rounded-xl border border-gray-200 bg-white p-5" aria-label="十章報告資料導引">
    <h2 className="text-lg font-semibold text-gray-900">十章報告結構與保存資料來源</h2>
    <p className="mt-2 text-sm text-gray-600">這是資料導引，並未產生十章正式報告，不計算完成度，也不代表商用、申報或查證通過。</p>
    {!outline.selected?<>
      <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">尚未選取保存快照。請至報告歷史選擇報告，再查看該版本的真實欄位、來源與缺件。</p>
      <ol className="mt-4 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">{outline.chapters.map(chapter=><li key={chapter.key}>{chapter.order}. {chapter.title}</li>)}</ol>
    </>:<>
      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{outline.provenance}；保存環境：{outline.environment}。內容依保存資料呈現，不回填示範值。</p>
      {outline.notes.length>0&&<ul role="alert" className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-700">{outline.notes.map(note=><li key={note}>{note}</li>)}</ul>}
      <div className="mt-4 space-y-3">{outline.chapters.map(chapter=><details key={chapter.key} open={chapter.order===1||chapter.order===4} className="rounded-lg border border-gray-200 p-4">
        <summary className="cursor-pointer font-medium text-gray-900">{chapter.order}. {chapter.title}<span className="ml-3 text-xs font-normal text-gray-500">保存欄位與缺件（非章節完成狀態）</span></summary>
        <dl className="mt-3 space-y-3">{chapter.fields.map(item=><div key={item.source+'-'+item.label}>
          <dt className="text-sm font-medium text-gray-800">{item.label}{item.state==='missing'||item.state==='invalid'?<span className="ml-2 text-xs text-amber-800">{item.state==='missing'?'缺少保存值':'需核對'}</span>:item.state==='empty'?<span className="ml-2 text-xs text-gray-500">未附列內容</span>:null}</dt>
          <dd className="mt-1 whitespace-pre-wrap break-all rounded bg-gray-50 p-2 text-sm text-gray-700">{item.value}</dd>
          <dd className="mt-1 break-all text-xs text-gray-500">來源：{item.source}</dd>
        </div>)}</dl>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-gray-600">{chapter.notes.map(note=><li key={note}>{note}</li>)}</ul>
      </details>)}</div>
    </>}
  </section>;
}
