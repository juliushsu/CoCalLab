import {resolveNavigationScope,canonicalUuid} from './navigationScope.ts';
export const workflowDestinations=[
 {id:'documents',label:'文件收件',path:'/admin/documents/upload'},
 {id:'draft',label:'人工審核',path:'/admin/documents/drafts'},
 {id:'activity',label:'活動明細',path:'/admin/activities'},
 {id:'analytics',label:'排放分析',path:'/admin/analytics'},
 {id:'report',label:'報告',path:'/admin/reports'},
] as const;
export type WorkflowStage=typeof workflowDestinations[number]['id'];
export function workflowStage(path:string):WorkflowStage|null{
 if(path.startsWith('/admin/documents/drafts'))return 'draft';
 if(path.startsWith('/admin/documents/'))return 'documents';
 if(path.startsWith('/admin/activities'))return 'activity';
 if(path==='/admin/analytics')return 'analytics';
 if(path.startsWith('/admin/reports'))return 'report';return null;
}
const allowed=new Set<string>([...workflowDestinations.map(d=>d.path),'/admin/reports/history','/admin/documents/list','/admin/carbon-adjustments']);
/** UI links never establish authorization. Only propagate the currently verified membership scope. */
export function workflowHref(target:string,pathname:string,search:string,verifiedOrg:string|null):string|null{
 if(!allowed.has(target)||!canonicalUuid(verifiedOrg))return null;
 const scope=resolveNavigationScope(pathname,search);if(scope.kind==='invalid')return null;
 if('organizationId' in scope&&scope.organizationId&&scope.organizationId!==verifiedOrg)return null;
 const q=new URLSearchParams({organization_id:verifiedOrg!,organizationId:verifiedOrg!});
 if('projectId' in scope&&scope.projectId){q.set('project_id',scope.projectId);q.set('projectId',scope.projectId);}
 return target+'?'+q;
}
export function pageVisitKey(epoch:number,user:string,path:string,search:string){return JSON.stringify([epoch,user,path,search]);}
