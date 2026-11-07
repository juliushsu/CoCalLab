/** Mirrors PostgreSQL jsonb ? at the top level; has no application/tenant state. */
export function hasManualProvenance(provider,rawPayload){
 const marker=typeof rawPayload==='string'?rawPayload==='manual_transcription':Array.isArray(rawPayload)?rawPayload.includes('manual_transcription'):rawPayload!==null&&typeof rawPayload==='object'&&Object.hasOwn(rawPayload,'manual_transcription');
 return /(^|[_-])manual([_-]|$)/i.test(typeof provider==='string'?provider:'')||marker;
}
