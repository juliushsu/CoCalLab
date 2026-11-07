/** All historical versions matter; neither latest/status nor caller payload can erase provenance. */
export function isProtectedManualDraft(value){
 const raw=value?.raw_payload;
 // PostgreSQL jsonb ? tests top-level object keys, string array members and
 // scalar strings. Malformed historical shapes must fail before a provider too.
 const marker=typeof raw==='string'?raw==='manual_transcription':Array.isArray(raw)?raw.includes('manual_transcription'):raw!==null&&typeof raw==='object'&&Object.hasOwn(raw,'manual_transcription');
 return !!value&&(/(^|[_-])manual([_-]|$)/i.test(String(value.extraction_provider||''))||marker);
}
