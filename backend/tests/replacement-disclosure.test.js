import test from 'node:test';import assert from 'node:assert/strict';
import {build_report_payload} from '../src/services/build-report-payload.js';
const provenance={version:'20261108.replacement.1',source_usage:'historical_reference_only',receipt_verification_status:'server_verified',steps:[{predecessor_activity_id:'old',activity_id:'new',replacement_mode:'correct',reason:'SYNTHETIC meter correction',actor_user_id:'actor',occurred_at:'2026-11-08T00:00:00Z',changes:{quantity:{before:100,after:120}}}]};
test('saved replacement report discloses authoritative correction lineage instead of implying original receipt supports changed values',()=>{
 const payload=build_report_payload({project:{id:'p',organization_id:'o'},activities:[{id:'new',source_document_id:'receipt',source_draft_id:'draft',quantity:120,unit:'kWh',inclusion_status:'included',final_scope:2,replacement_provenance:provenance}],calculation_results:[{id:'calc',emission_activity_id:'new',status:'calculated',is_latest:true,co2e_kg:60}]});
 assert.equal(payload.replacement_disclosure_version,'20261108.replacement.1');
 assert.deepEqual(payload.appendix_mappings[0].replacement_provenance,provenance);
 assert.deepEqual(payload.correction_disclosures,[{emission_activity_id:'new',replacement_provenance:provenance}]);
 assert.equal(payload.scope_totals.scope_2,60);
});
