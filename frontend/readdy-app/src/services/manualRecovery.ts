import type {IntakeScope} from './documentIntake.ts';
import {canonicalUuid} from './navigationScope.ts';
interface Store {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export function manualReferenceKey(scope:IntakeScope,userId:string,kind:'activity'|'report'){
 const values=[scope.organizationId,scope.projectId,userId].map(canonicalUuid);if(values.some(v=>!v))throw new Error('恢復參考範圍無效。');return 'CoCalLab:manual-v1:'+values.join(':')+':'+kind;
}
export function activityReference(store:Store,scope:IntakeScope,userId:string){
 const key=manualReferenceKey(scope,userId,'activity'),prior=store.getItem(key);if(prior){if(!canonicalUuid(prior))throw new Error('此專案建檔恢復參考損壞；請保留資訊交管理員核對。');return prior;}
 const id=crypto.randomUUID();store.setItem(key,id);return id;
}
export function reportReference(store:Store,scope:IntakeScope,userId:string){const raw=store.getItem(manualReferenceKey(scope,userId,'report'));if(!raw)return null;let value;try{value=JSON.parse(raw);}catch{throw new Error('報告恢復參考損壞。');}if(!canonicalUuid(value?.requestId)||!Number.isSafeInteger(value.version)||value.version<1)throw new Error('報告恢復參考無效。');return value as {requestId:string;version:number};}
export function saveReportReference(store:Store,scope:IntakeScope,userId:string,value:{requestId:string;version:number}){store.setItem(manualReferenceKey(scope,userId,'report'),JSON.stringify(value));}
export function clearManualReference(store:Store,scope:IntakeScope,userId:string,kind:'activity'|'report',expected:string){
 const key=manualReferenceKey(scope,userId,kind),raw=store.getItem(key);if(!raw)return;
 const id=kind==='activity'?raw:reportReference(store,scope,userId)?.requestId;if(id===expected)store.removeItem(key);
}
