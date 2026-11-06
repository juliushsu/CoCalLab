import {canonicalUuid} from './navigationScope.ts';
import type {IntakeScope} from './documentIntake.ts';
export interface DeletionStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export interface DeletionTarget {documentId:string;storageBucket?:string;storagePath?:string;expectedReceiptAbsent?:true}
export interface DeletionAttempt extends DeletionTarget {requestId:string}
export function deletionReferenceKey(scope:IntakeScope,userId:string,documentId:string){const ids=[scope.organizationId,scope.projectId,userId,documentId].map(canonicalUuid);if(ids.some(id=>!id))throw new Error('刪除恢復參考範圍無效。');return 'CoCalLab:document-delete-v1:'+ids.join(':');}
export function readDeletionReference(store:DeletionStorage,scope:IntakeScope,userId:string,target:DeletionTarget):DeletionAttempt|null {
 const raw=store.getItem(deletionReferenceKey(scope,userId,target.documentId));if(raw===null)return null;let row;try{row=JSON.parse(raw);}catch{throw new Error('此原件刪除參考損壞；未建立新刪除，請保留原ID核對。');}
 if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(key=>!['requestId','documentId','storageBucket','storagePath','expectedReceiptAbsent'].includes(key))||!canonicalUuid(row.requestId)||row.documentId!==target.documentId||row.storageBucket!==target.storageBucket||row.storagePath!==target.storagePath||row.expectedReceiptAbsent!==target.expectedReceiptAbsent)throw new Error('刪除參考與目前原件不一致，未換ID或覆寫參考。');return row as DeletionAttempt;
}
/** Persist exact original descriptor BEFORE any delete side effect. Not server authority. */
export function deletionReference(store:DeletionStorage,scope:IntakeScope,userId:string,target:DeletionTarget,serverRequestId?:string):DeletionAttempt{
 const prior=readDeletionReference(store,scope,userId,target);if(prior){if(serverRequestId&&prior.requestId!==serverRequestId)throw new Error('本機與服務端刪除操作ID不同，請保留兩者核對；未自動換ID。');return prior;}
 if(serverRequestId&&!canonicalUuid(serverRequestId))throw new Error('服務端刪除操作ID無效。');const value={...target,requestId:serverRequestId??crypto.randomUUID()},key=deletionReferenceKey(scope,userId,target.documentId),raw=JSON.stringify(value);store.setItem(key,raw);if(store.getItem(key)!==raw)throw new Error('刪除參考無法持久保存，尚未發出刪除。');return value;
}
export function clearDeletionReference(store:DeletionStorage,scope:IntakeScope,userId:string,attempt:DeletionAttempt){const current=readDeletionReference(store,scope,userId,attempt);if(current?.requestId===attempt.requestId){const key=deletionReferenceKey(scope,userId,attempt.documentId);store.removeItem(key);if(store.getItem(key)!==null)throw new Error('本機刪除參考尚未清除；服務端結果須保留核對。');}}
export function rawDeletionReference(store:DeletionStorage,scope:IntakeScope,userId:string,documentId:string){return store.getItem(deletionReferenceKey(scope,userId,documentId));}
/** Explicit one-key repair only; never cancels server work or removes an original. */
export function abandonDeletionReference(store:DeletionStorage,scope:IntakeScope,userId:string,documentId:string,capturedRaw:string|null){const key=deletionReferenceKey(scope,userId,documentId);if(store.getItem(key)!==capturedRaw)throw new Error('刪除參考已改變，未清掉較新的操作。');if(capturedRaw!==null){store.removeItem(key);if(store.getItem(key)!==null)throw new Error('刪除參考仍在；未宣稱清除成功。');}}
