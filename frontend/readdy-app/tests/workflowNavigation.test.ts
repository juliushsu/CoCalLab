import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowStage,workflowHref,workflowDestinations,pageVisitKey} from '../src/services/workflowNavigation.ts';
const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002',p='00000000-0000-4000-8000-000000000003';
test('all five stages and contextual shortcuts preserve verified org and explicit project with compatible aliases',()=>{
 const search='?organizationId='+a+'&projectId='+p+'&document=stale&create=true';
 for(const d of workflowDestinations){const href=workflowHref(d.path,'/admin/activities',search,a);assert.ok(href);const q=new URL(href!,'http://local').searchParams;assert.equal(q.get('organization_id'),a);assert.equal(q.get('organizationId'),a);assert.equal(q.get('project_id'),p);assert.equal(q.get('projectId'),p);assert.equal(q.has('document'),false);assert.equal(q.has('create'),false);}
 assert.equal(workflowStage('/admin/reports/history'),'report');assert.equal(workflowStage('/admin/documents/drafts'),'draft');assert.equal(workflowStage('/admin/organizations'),null);
});
test('malformed or conflicting scope, unresolved membership and stale org cannot create workflow links',()=>{
 for(const q of ['?organization_id='+a+'&organizationId='+b,'?projectId=bad','?projectId='+p+'&projectId='+p])assert.equal(workflowHref('/admin/analytics','/admin/activities',q,a),null);
 assert.equal(workflowHref('/admin/analytics','/admin/activities','?organization_id='+a,b),null);
 assert.equal(workflowHref('/admin/analytics','/admin/activities','?organization_id='+a,null),null);
 assert.equal(workflowHref('https://external.invalid','/admin/activities','',a),null);
});
test('organization-only selection never inherits project and query/auth visits have separate page state',()=>{
 const href=workflowHref('/admin/reports','/admin/analytics','?organization_id='+b,b)!;assert.equal(new URL(href,'http://local').searchParams.has('projectId'),false);
 assert.notEqual(pageVisitKey(1,'u','/admin/analytics','?organization_id='+a),pageVisitKey(1,'u','/admin/analytics','?organization_id='+b));
 assert.notEqual(pageVisitKey(1,'u','/admin/analytics',''),pageVisitKey(2,'u','/admin/analytics',''));
});
