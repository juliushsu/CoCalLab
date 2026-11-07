/** Independent source witness, never part of caller intent or a permission grant. */
export function draftConfirmationSourceSnapshot(draft){
 if(draft===null||typeof draft!=='object'||Array.isArray(draft))throw new Error('DRAFT_CONFIRMATION_SOURCE_REQUIRED');
 const ignored=new Set(['created_at','updated_at','reviewed_at','classified_at']);
 // Preserve nested source/provenance timestamps. Only these four top-level lifecycle clocks differ.
 return JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(draft).filter(([key])=>!ignored.has(key)))));
}
