import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedSubscriptionStatus,isReadonly} from '../src/utils/subscription.ts';
import {enforce_subscription_readonly} from '../../../backend/src/services/enforce-subscription-readonly.js';
test('strict subscription presentation accepts the real backend grace-period contract and refuses unknown/missing',()=>{
 const response=enforce_subscription_readonly({organization_id:'SYNTHETIC',as_of:'2026-11-04T00:00:00Z',subscriptions:[{status:'active',period_end:'2026-11-01T00:00:00Z',grace_until:'2026-11-10T00:00:00Z'}]});
 assert.equal(response.effective_status,'grace_period');assert.equal(response.can_write_formal_data,true);
 assert.equal(isReadonly(verifiedSubscriptionStatus({status:response.effective_status})),false);
 for(const status of ['readonly','expired','suspended'] as const)assert.equal(isReadonly(verifiedSubscriptionStatus({status})),true);
 assert.throws(()=>verifiedSubscriptionStatus(undefined));assert.throws(()=>verifiedSubscriptionStatus({}));assert.throws(()=>verifiedSubscriptionStatus({status:'invented'} as never));
 for(const status of [['readonly'],['active'],{},null,42])assert.throws(()=>verifiedSubscriptionStatus({status} as never));
});
