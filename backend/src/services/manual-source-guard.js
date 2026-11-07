import {hasManualProvenance} from '../../../modules/document-provenance/manual.js';
/** Row adapter only; all historical versions matter. */
export function isProtectedManualDraft(value){
 return hasManualProvenance(value?.extraction_provider,value?.raw_payload);
}
