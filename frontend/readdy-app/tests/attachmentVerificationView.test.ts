import test from 'node:test';
import assert from 'node:assert/strict';
import {attachmentVerificationView} from '../src/services/attachmentVerificationView.ts';
const proof={sha256_hash:'a'.repeat(64),hash_verification_status:'server_verified',server_verified_at:'2026-11-06T01:00:00Z',verified_storage_object_id:'00000000-0000-4000-8000-000000000001'};
test('a valid client or legacy hash does not imply server proof',()=>{assert.equal(attachmentVerificationView({sha256_hash:proof.sha256_hash}).state,'legacy_unverified');assert.equal(attachmentVerificationView({...proof,hash_verification_status:'legacy_unverified'}).state,'legacy_unverified');});
test('server proof must include valid timestamp, Storage generation and SHA; incomplete fields remain invalid',()=>{assert.equal(attachmentVerificationView(proof).state,'server_verified');for(const patch of [{server_verified_at:null},{verified_storage_object_id:'invalid'},{sha256_hash:'claimed'},{hash_verification_status:'claimed'}])assert.equal(attachmentVerificationView({...proof,...patch}).state,'invalid');});

test('a historical server hash does not describe pending/deleted original bytes as available',()=>{const row={hash_verification_status:'server_verified',server_verified_at:'2026-11-06T00:00:00Z',verified_storage_object_id:'11111111-1111-4111-8111-111111111111',sha256_hash:'a'.repeat(64)};assert.match(attachmentVerificationView({...row,deletion_state:'deleted'}).label,/曾驗證.*原件已移除/);assert.match(attachmentVerificationView({...row,deletion_state:'pending'}).label,/不能視為原件仍可用/);});
