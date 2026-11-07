import test from 'node:test';import assert from 'node:assert/strict';
import {draftConfirmationSourceSnapshot} from '../src/services/draft-confirmation-source.js';
test('confirmation witness retains every source/identity/status field and nested clocks, excluding only four top-level lifecycle clocks',()=>{
 const draft={id:'SYNTHETIC',uploaded_document_id:'SYNTHETIC-DOC',organization_id:'SYNTHETIC-ORG',project_id:'SYNTHETIC-PROJECT',status:'pending_review',is_latest:true,extraction_version:1,extraction_provider:'OCR-LEGACY',normalized_payload:{quantity:100,unit:'kWh'},raw_payload:{source_timestamp:'2026-01-15T00:00:00Z'},classification_status:'classified',suggested_category:'energy',suggested_scope:2,confidence_score:0.5,created_at:'first',updated_at:'first',reviewed_at:null,classified_at:null};
 const snapshot=draftConfirmationSourceSnapshot(draft);assert.deepEqual(snapshot,draftConfirmationSourceSnapshot({...draft,created_at:'later',updated_at:'later',reviewed_at:'later',classified_at:'later'}));
 for(const patch of [{normalized_payload:{quantity:200,unit:'kWh'}},{raw_payload:{source_timestamp:'changed'}},{status:'rejected'},{is_latest:false},{uploaded_document_id:'OTHER'},{classification_status:'unclassified'},{suggested_category:'materials'},{suggested_scope:3},{confidence_score:0.2}])assert.notDeepEqual(snapshot,draftConfirmationSourceSnapshot({...draft,...patch}),JSON.stringify(patch));
 draft.normalized_payload.quantity=999;assert.equal(snapshot.normalized_payload.quantity,100,'witness captures the actual initial read, not a later mutable reference');
 for(const value of [null,[],42])assert.throws(()=>draftConfirmationSourceSnapshot(value),/SOURCE_REQUIRED/);
});
