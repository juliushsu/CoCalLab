import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubscriptionFence} from '../src/services/subscriptionFence.ts';
test('obsolete refresh cannot cancel the current unit request; A-B-A requires a fresh scope',()=>{
 const fence=createSubscriptionFence<object>(),a={},b={},a2={};
 fence.select(a);const first=fence.begin(a)!;
 fence.select(b);const second=fence.begin(b)!;
 assert.equal(first(),false);assert.equal(fence.begin(a),null);assert.equal(second(),true);
 fence.cancel(a);assert.equal(second(),true);
 fence.select(a2);assert.equal(second(),false);assert.equal(fence.begin(a),null);assert.equal(fence.begin(a2)!(),true);
});
test('latest same-scope refresh wins; unmount rejects pending and later callbacks; StrictMode remount can load',()=>{
 const fence=createSubscriptionFence<object>(),scope={};fence.select(scope);
 const first=fence.begin(scope)!,second=fence.begin(scope)!;
 assert.equal(first(),false);assert.equal(second(),true);
 fence.cancel(scope);assert.equal(second(),false);assert.equal(fence.begin(scope),null);
 fence.select(scope);assert.equal(fence.begin(scope)!(),true);
});
