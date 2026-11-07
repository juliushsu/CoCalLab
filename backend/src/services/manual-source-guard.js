/** All historical versions matter; neither latest/status nor caller payload can erase provenance. */
export function isProtectedManualDraft(value){
 return !!value&&(/(^|[_-])manual([_-]|$)/i.test(String(value.extraction_provider||''))||value.raw_payload!==null&&typeof value.raw_payload==='object'&&Object.hasOwn(value.raw_payload,'manual_transcription'));
}
