import test from 'node:test';
import assert from 'node:assert/strict';
import { mapAdjustmentItem } from '../src/services/adjustmentItemAdapter.ts';
import type { AdjustmentItemRow } from '../src/services/adjustmentService.ts';
const row: AdjustmentItemRow = {
  id:'item-1', organization_id:'org-1', project_id:null, adjustment_type:'offset_credit', name:'Credit',
  description:null, claim_purpose:'voluntary_claim', quantity_total_tco2e:12.5, quantity_available_tco2e:10,
  quantity_reserved_tco2e:0, quantity_consumed_tco2e:2.5, usage_lock_status:'available', target_type:'organization',
  target_id:null, jurisdiction_code:'TW', vintage_year:2025, effective_from:'2026-01-01', effective_to:'2026-12-31',
  certificate_verification_status:'unverified', approval_status:'draft', double_counting_status:'unchecked',
  proof_document_status:'missing', status:'active', metadata:{}, is_test:true, env:'staging', created_at:'2026-01-01', updated_at:'2026-01-01',
};
test('active draft and pending items never acquire approval through lifecycle alone', () => {
  const draft = mapAdjustmentItem(row);
  assert.equal(draft.status, 'draft');
  assert.equal(draft.approval_status, 'draft');
  const pending = mapAdjustmentItem({ ...row, approval_status:'pending' });
  assert.equal(pending.status, 'pending_review');
  assert.equal(pending.approval_status, 'submitted');
  assert.notEqual(mapAdjustmentItem({ ...row, approval_status:'unknown' }).status, 'approved');
});
test('approval and operational lifecycle remain independent including inactive/revoked', () => {
  assert.equal(mapAdjustmentItem({ ...row, approval_status:'approved' }).status, 'approved');
  for (const status of ['inactive', 'revoked', 'expired', 'unknown']) {
    assert.notEqual(mapAdjustmentItem({ ...row, status, approval_status:'approved' }).status, 'approved');
  }
  assert.equal(mapAdjustmentItem({ ...row, approval_status:'rejected' }).status, 'rejected');
});
test('suspected and blocked double counting remain flagged and missing proof is not uploaded', () => {
  for (const double_counting_status of ['suspected', 'blocked']) {
    assert.equal(mapAdjustmentItem({ ...row, double_counting_status }).double_counting_check, 'flagged');
  }
  assert.equal(mapAdjustmentItem(row).double_counting_check, 'unknown');
  assert.equal(mapAdjustmentItem(row).proof_document_status, 'not_uploaded');
  assert.equal(mapAdjustmentItem({ ...row, proof_document_status:'unknown' }).proof_document_status, null);
});
test('validity dates cannot masquerade as certificate dates and numeric corruption is rejected', () => {
  assert.equal(mapAdjustmentItem(row).issue_date, null);
  assert.equal(mapAdjustmentItem(row).retirement_date, null);
  assert.throws(() => mapAdjustmentItem({ ...row, quantity_total_tco2e:null as unknown as number }));
  assert.throws(() => mapAdjustmentItem({ ...row, quantity_total_tco2e:NaN }));
  assert.equal(mapAdjustmentItem({ ...row, quantity_available_tco2e:0 }).quantity_available_tco2e, 0);
});
test('renewable attribute aliases and regulatory deduction retain their actual categories', () => {
  assert.equal(mapAdjustmentItem({ ...row, adjustment_type:'renewable_electricity_attribute' }).adjustment_type, 'renewable_electricity');
  assert.equal(mapAdjustmentItem({ ...row, adjustment_type:'regulatory_deduction' }).adjustment_type, 'regulatory_deduction');
  assert.throws(() => mapAdjustmentItem({ ...row, adjustment_type:'unknown' }));
});
