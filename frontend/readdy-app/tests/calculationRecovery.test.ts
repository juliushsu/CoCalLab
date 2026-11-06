import test from 'node:test';
import assert from 'node:assert/strict';
import {calculationReference,readCalculationReference,clearCalculationReference,calculationReferenceKey,calculationRawReference,abandonCalculationReference} from '../src/services/calculationRecovery.ts';
const O='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222',U='33333333-3333-4333-8333-333333333333',OTHER='44444444-4444-4444-8444-444444444444',scope={organizationId:O,projectId:P};
function memory(){const data=new Map<string,string>();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);},removeItem:k=>{data.delete(k);}};}
test('calculation keeps the same operation UUID across retry/reload and binds product/user/unit/project',()=>{
 const store=memory(),first=calculationReference(store,scope,U);assert.equal(first.forceRecalculate,true);assert.ok(first.requestId);assert.deepEqual(calculationReference(store,scope,U),first);assert.deepEqual(readCalculationReference(store,scope,U),first);
 assert.notEqual(calculationReference(store,{...scope,organizationId:OTHER},U).requestId,first.requestId);assert.notEqual(calculationReference(store,{...scope,projectId:OTHER},U).requestId,first.requestId);assert.notEqual(calculationReference(store,scope,OTHER).requestId,first.requestId);
 assert.match(calculationReferenceKey(scope,U),/^CoCalLab:/);assert.throws(()=>calculationReference(store,{...scope,projectId:'invalid'},U));
});
test('clearing only the observed operation leaves a newer pending operation and all other scopes intact',()=>{
 const store=memory(),first=calculationReference(store,scope,U),other=calculationReference(store,scope,OTHER);clearCalculationReference(store,scope,U,OTHER);assert.deepEqual(readCalculationReference(store,scope,U),first);clearCalculationReference(store,scope,U,first.requestId);assert.equal(readCalculationReference(store,scope,U),null);assert.deepEqual(readCalculationReference(store,scope,OTHER),other);const next=calculationReference(store,scope,U);assert.notEqual(next.requestId,first.requestId);clearCalculationReference(store,scope,U,first.requestId);assert.deepEqual(readCalculationReference(store,scope,U),next);
});
test('unavailable, non-persisting or corrupted calculation journal cannot authorize a new write',()=>{
 const store=memory();assert.throws(()=>calculationReference({...store,setItem(){throw new Error('unavailable');}},scope,U));assert.throws(()=>calculationReference({...store,setItem(){}},scope,U));store.data.set(calculationReferenceKey(scope,U),'corrupted');assert.throws(()=>readCalculationReference(store,scope,U));assert.throws(()=>calculationReference(store,scope,U));
});

test('explicit abandonment recovers exactly one corrupt scope and cannot clear a concurrently replaced reference or claim failed removal',()=>{
 const store=memory(),other=calculationReference(store,scope,OTHER),key=calculationReferenceKey(scope,U);store.setItem(key,'{bad');const captured=calculationRawReference(store,scope,U);assert.throws(()=>calculationReference(store,scope,U));
 store.setItem(key,'newer-observed-reference');assert.throws(()=>abandonCalculationReference(store,scope,U,captured),/已改變/);assert.equal(store.getItem(key),'newer-observed-reference');
 assert.throws(()=>abandonCalculationReference({...store,removeItem(){}},scope,U,calculationRawReference(store,scope,U)),/尚未清除/);
 abandonCalculationReference(store,scope,U,calculationRawReference(store,scope,U));assert.equal(store.getItem(key),null);assert.deepEqual(readCalculationReference(store,scope,OTHER),other);assert.ok(calculationReference(store,scope,U).requestId);
});
