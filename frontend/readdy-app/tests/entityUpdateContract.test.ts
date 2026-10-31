import { test } from 'node:test';
import assert from 'node:assert/strict';
import { organizationUpdatePayload, projectUpdatePayload, requireUpdatedRow } from '../src/services/entityUpdateContract.ts';
const organization = { id:'org-1',legal_name:' Legal ',display_name:' Display ',tax_id:'',country_code:'tw',timezone:'Asia/Taipei' };
const project = { id:'p-1',organization_id:'org-1',project_code:' CODE ',name:' Name ',description:'',reporting_start_date:'2026-01-01',reporting_end_date:'2026-12-31',boundary_type:'operational_control' as const,base_currency:'twd' };
test('organization persists only actual profile fields, trims, and clears optional tax id', () => {
  assert.deepEqual(organizationUpdatePayload(organization), {legal_name:'Legal',display_name:'Display',tax_id:null,country_code:'TW',timezone:'Asia/Taipei'});
});
test('organization rejects lifecycle, identity, staging flags and imagined contact fields', () => {
  for (const field of ['slug','id2','status','archived_at','is_test','env','name','contact_email','description']) {
    assert.throws(() => organizationUpdatePayload({...organization,[field]:'forbidden'}));
  }
  assert.throws(() => organizationUpdatePayload({...organization, legal_name:' '}));
  assert.throws(() => organizationUpdatePayload({...organization, timezone:'Invalid/Zone'}));
  assert.throws(() => organizationUpdatePayload({...organization, country_code:'Taiwan'}));
});
test('project uses actual schema names and excludes tenant identity from payload', () => {
  const payload = projectUpdatePayload(project);
  assert.deepEqual(payload, {project_code:'CODE',name:'Name',description:null,reporting_start_date:'2026-01-01',reporting_end_date:'2026-12-31',boundary_type:'operational_control',base_currency:'TWD'});
  assert.equal('organization_id' in payload,false);
});
test('project rejects invalid/reversed dates, unsupported enums and silent UI-only field writes', () => {
  for (const patch of [{reporting_start_date:'2026-02-30'}, {reporting_end_date:'2025-12-31'}, {boundary_type:'other'}, {base_currency:'TWD$'}, {organization_id:''}, {status:'closed'}, {project_type:'product'}, {baseline_year:2026}, {reduction_target:10}, {is_test:true}]) {
    assert.throws(() => projectUpdatePayload({...project,...patch} as typeof project));
  }
});

test('denied and zero-row updates cannot be reported as successful saves', () => {
  const denial = { code: '42501', message: 'permission denied' };
  assert.throws(() => requireUpdatedRow({ data:null,error:denial }), error => error === denial);
  assert.throws(() => requireUpdatedRow({ data:null,error:null }), /no row/);
  const row = { id:'existing' };
  assert.equal(requireUpdatedRow({ data:row,error:null }),row);
});
