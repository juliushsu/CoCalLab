import type {IntakeScope} from './documentIntake.ts';
import {canonicalUuid} from './navigationScope.ts';
interface Store {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export interface CalculationAttempt {requestId:string;forceRecalculate:true;createdAt:string}
export function calculationReferenceKey(scope:IntakeScope,userId:string){const ids=[scope.organizationId,scope.projectId,userId].map(canonicalUuid);if(ids.some(v=>!v))throw new Error('計算恢復參考範圍無效。');return 'CoCalLab:calculation-v1:'+ids.join(':');}
export function readCalculationReference(store:Store,scope:IntakeScope,userId:string):CalculationAttempt|null {
 const raw=store.getItem(calculationReferenceKey(scope,userId));if(raw===null)return null;
 let row;try{row=JSON.parse(raw);}catch{throw new Error('此使用者／專案的計算恢復參考損壞；請保留資訊交管理員核對。');}
 if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).length!==3||!canonicalUuid(row.requestId)||row.forceRecalculate!==true||typeof row.createdAt!=='string'||!Number.isFinite(Date.parse(row.createdAt)))throw new Error('計算恢復參考無效；未建立新操作。');
 return {requestId:row.requestId,forceRecalculate:true,createdAt:row.createdAt};
}
/** Persist/readback BEFORE a calculate request. It is a reference, never server authority. */
export function calculationReference(store:Store,scope:IntakeScope,userId:string):CalculationAttempt {
 const prior=readCalculationReference(store,scope,userId);if(prior)return prior;
 const value:CalculationAttempt={requestId:crypto.randomUUID(),forceRecalculate:true,createdAt:new Date().toISOString()},key=calculationReferenceKey(scope,userId),raw=JSON.stringify(value);store.setItem(key,raw);if(store.getItem(key)!==raw)throw new Error('無法保存計算恢復參考，尚未發出計算。');return value;
}
/** Forget only this captured reference. Never cancels or deletes server calculations. */
export function clearCalculationReference(store:Store,scope:IntakeScope,userId:string,expectedRequestId:string){const prior=readCalculationReference(store,scope,userId);if(prior?.requestId===expectedRequestId){const key=calculationReferenceKey(scope,userId);store.removeItem(key);if(store.getItem(key)!==null)throw new Error('本機參考尚未清除，未宣稱放棄成功。');}}

/** Explicit user action for one exact scope, including malformed JSON; no automatic replacement. */
export function calculationRawReference(store:Store,scope:IntakeScope,userId:string){return store.getItem(calculationReferenceKey(scope,userId));}
export function abandonCalculationReference(store:Store,scope:IntakeScope,userId:string,capturedRaw:string|null){
 const key=calculationReferenceKey(scope,userId);if(store.getItem(key)!==capturedRaw)throw new Error('計算參考已改變，未清除較新的操作；請重新核對。');
 if(capturedRaw!==null){store.removeItem(key);if(store.getItem(key)!==null)throw new Error('本機參考尚未清除，未宣稱放棄成功。');}
}
