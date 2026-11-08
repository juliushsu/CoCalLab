import type {IntakeScope} from './documentIntake.ts';
import {canonicalUuid} from './navigationScope.ts';
import {canonicalReplacementIntent,type ReplacementIntent} from './activityReplacement.ts';
interface Store {readonly length:number;key(index:number):string|null;getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export interface ReplacementReference {requestId:string;predecessorId:string;intent:ReplacementIntent}
const uuid=(value:unknown)=>{const result=canonicalUuid(value);if(!result)throw new Error('取代恢復範圍無效。');return result;};
export function replacementReferencePrefix(scope:IntakeScope,user:string,predecessorId:string){return ['CoCalLab:activity-replacement:v1',uuid(user),uuid(scope.organizationId),uuid(scope.projectId),uuid(predecessorId),''].join(':');}
export function replacementReferenceKey(scope:IntakeScope,user:string,reference:ReplacementReference){return replacementReferencePrefix(scope,user,reference.predecessorId)+uuid(reference.requestId);}
export function captureReplacementReferences(storage:Store,scope:IntakeScope,user:string,predecessorId:string){const prefix=replacementReferencePrefix(scope,user,predecessorId),out:{key:string;raw:string}[]=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(prefix)){const raw=storage.getItem(key);if(raw!==null)out.push({key,raw});}}return out;}
export function abandonCapturedReplacementReference(storage:Store,scope:IntakeScope,user:string,predecessorId:string,captured:{key:string;raw:string}){if(!captured.key.startsWith(replacementReferencePrefix(scope,user,predecessorId))||storage.getItem(captured.key)!==captured.raw)throw new Error('本機參考已變更，未清除其他操作。');storage.removeItem(captured.key);if(storage.getItem(captured.key)!==null)throw new Error('本機參考未清除；伺服器操作未取消。');}
export function readReplacementReferences(storage:Store,scope:IntakeScope,user:string,predecessorId:string):ReplacementReference[]{
 const prefix=replacementReferencePrefix(scope,user,predecessorId),values:ReplacementReference[]=[];
 for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(prefix))continue;const raw=storage.getItem(key);if(raw===null)throw new Error('取代恢復參考正在變動，請重新核對。');try{const v=JSON.parse(raw);if(Object.keys(v).some(k=>!['requestId','predecessorId','intent'].includes(k))||uuid(v.predecessorId)!==uuid(predecessorId)||key!==prefix+uuid(v.requestId))throw new Error('mismatch');values.push({requestId:uuid(v.requestId),predecessorId:uuid(v.predecessorId),intent:canonicalReplacementIntent(v.intent)});}catch{throw new Error('此活動有損壞的取代恢復參考；保留原資料，請先核對或明確放棄該本機參考。');}}
 return values.sort((a,b)=>a.requestId.localeCompare(b.requestId));
}
export function replacementReference(storage:Store,scope:IntakeScope,user:string,predecessorId:string,intent:ReplacementIntent):ReplacementReference{
 const canonical=canonicalReplacementIntent(intent),prior=readReplacementReferences(storage,scope,user,predecessorId);
 if(prior.length){if(prior.length!==1||JSON.stringify(prior[0].intent)!==JSON.stringify(canonical))throw new Error('此活動已有待核對取代請求，先選擇原請求核對；不換ID或覆寫意圖。');return prior[0];}
 const ref={requestId:crypto.randomUUID(),predecessorId:uuid(predecessorId),intent:canonical},key=replacementReferenceKey(scope,user,ref),raw=JSON.stringify(ref);storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw new Error('無法持久保存取代參考，尚未送出。');return ref;
}
export function clearReplacementReference(storage:Store,scope:IntakeScope,user:string,reference:ReplacementReference){const key=replacementReferenceKey(scope,user,reference),raw=storage.getItem(key);if(raw===null)return;if(raw!==JSON.stringify(reference))throw new Error('取代參考已變更，未清除其他操作。');storage.removeItem(key);if(storage.getItem(key)!==null)throw new Error('無法清除本機取代參考；伺服器資料未變更。');}
export function retainRecoveredReplacementReference(storage:Store,scope:IntakeScope,user:string,reference:ReplacementReference){
 const ref={requestId:uuid(reference.requestId),predecessorId:uuid(reference.predecessorId),intent:canonicalReplacementIntent(reference.intent)};
 const key=replacementReferenceKey(scope,user,ref),raw=JSON.stringify(ref),prior=storage.getItem(key);
 if(prior!==null&&prior!==raw)throw new Error('本機同ID參考不同，保留原資料；須明確核對，不以伺服器恢復覆寫。');
 if(prior===null)storage.setItem(key,raw);
 if(storage.getItem(key)!==raw)throw new Error('無法持久保存恢復的原請求，尚不可重試。');
 return ref;
}
