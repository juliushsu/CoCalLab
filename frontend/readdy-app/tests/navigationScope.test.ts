import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activeMembershipRole,currentSession,matchingNavigationMembership,navigationItemAllowed,resolveNavigationScope} from '../src/services/navigationScope.ts';
const orgA = '00000000-0000-0000-0000-00000000000a';
const orgB = '00000000-0000-0000-0000-00000000000b';
const project = '00000000-0000-0000-0000-000000000001';
test('no scope does not infer a first organization or role', () => {
  assert.equal(resolveNavigationScope('/admin/projects','').kind,'none');
  assert.equal(resolveNavigationScope('/admin/projects/create','').kind,'none');
});
test('canonical and legacy organization/project aliases select the same scope', () => {
  for (const orgKey of ['organization_id','organizationId']) for (const projectKey of ['project_id','projectId']) {
    const scope = resolveNavigationScope('/admin/carbon-adjustments',`?${orgKey}=${orgA}&${projectKey}=${project}`);
    assert.equal(scope.kind,'project');
    if (scope.kind === 'project') { assert.equal(scope.organizationId,orgA); assert.equal(scope.projectId,project); }
  }
});
test('conflicting/duplicate query scope and malformed ids fail closed', () => {
  for (const query of [`?organization_id=${orgA}&organizationId=${orgB}`,`?project_id=${project}&projectId=${orgA}`,`?organization_id=${orgA}&organization_id=${orgA}`,`?projectId=${project}&projectId=${project}`,'?organization_id=','?organizationId=not-a-uuid']) {
    assert.equal(resolveNavigationScope('/admin/analytics',query).kind,'invalid');
  }
});
test('organization and project detail/edit routes are scoped, conflicts reject', () => {
  for (const action of ['edit','members']) {
    assert.equal(resolveNavigationScope(`/admin/organizations/${orgA}/${action}`,'').kind,'organization');
    assert.equal(resolveNavigationScope(`/admin/organizations/${orgA}/${action}`,`?organization_id=${orgB}`).kind,'invalid');
  }
  for (const suffix of ['','/edit']) {
    const scope = resolveNavigationScope(`/admin/projects/${project}${suffix}`,`?organization_id=${orgA}`);
    assert.equal(scope.kind,'project');
    if (scope.kind === 'project') assert.equal(scope.projectId,project);
  }
  assert.equal(resolveNavigationScope(`/admin/projects/${project}`,`?projectId=${orgA}`).kind,'invalid');
});
test('membership must match active user and original organization exactly; platform role never accepted', () => {
  const member = {organization_id:orgA,user_id:'user-a',status:'active',role:'admin'};
  assert.equal(activeMembershipRole(member,orgA,'user-a'),'admin');
  for (const patch of [{organization_id:orgB},{user_id:'user-b'},{status:'inactive'},{status:'invited'},{role:'platform_admin'}]) {
    assert.equal(activeMembershipRole({...member,...patch},orgA,'user-a'),null);
  }
});
test('unknown role retains selection entries only; tenant admin cannot see platform navigation', () => {
  assert.equal(navigationItemAllowed('/admin/organizations',null,['owner','admin']),true);
  assert.equal(navigationItemAllowed('/admin/projects',null),true);
  assert.equal(navigationItemAllowed('/admin/analytics',null),false);
  assert.equal(navigationItemAllowed(`/admin/organizations/${orgA}/members`,'viewer',['owner','admin']),false);
  assert.equal(navigationItemAllowed(`/admin/organizations/${orgA}/members`,'admin',['owner','admin']),true);
  assert.equal(navigationItemAllowed('/admin/ai-governance','admin',['platform_admin']),false);
  assert.equal(navigationItemAllowed('/admin/ai-governance','owner',['platform_admin']),false);
});
test('expiry, missing expiry and signed-out session carry no authority', () => {
  const session = {access_token:'test-token',expires_at:200,user:{id:'user-a'}};
  assert.equal(currentSession(session,199_999),true);
  assert.equal(currentSession(session,200_000),false);
  assert.equal(currentSession({...session,expires_at:undefined},1),false);
  assert.equal(currentSession(null,1),false);
  assert.equal(currentSession({...session,user:{id:''}},1),false);
});
test('late results cannot cross scope/session boundaries or restore a logged-out role', () => {
  const session = {access_token:'a'};
  const scope = resolveNavigationScope('/admin/analytics',`?organization_id=${orgA}`);
  const result = {session,scope,membership:{organizationId:orgA,role:'owner' as const}};
  assert.equal(matchingNavigationMembership(result,session,scope)?.role,'owner');
  assert.equal(matchingNavigationMembership(result,session,resolveNavigationScope('/admin/analytics',`?organization_id=${orgB}`)),null);
  assert.equal(matchingNavigationMembership(result,{access_token:'a'},scope),null);
  assert.equal(matchingNavigationMembership(result,null,scope),null);
  assert.equal(matchingNavigationMembership(null,session,scope),null);
});
test('A to B to A visit requires fresh membership even when session and URL match', () => {
  const session = {access_token:'same-session'};
  const firstA = resolveNavigationScope('/admin/analytics',`?organization_id=${orgA}`);
  const result = {session,scope:firstA,membership:{organizationId:orgA,role:'owner' as const}};
  const B = resolveNavigationScope('/admin/analytics',`?organization_id=${orgB}`);
  assert.equal(matchingNavigationMembership(result,session,B),null);
  const secondA = resolveNavigationScope('/admin/analytics',`?organization_id=${orgA}`);
  assert.equal(firstA.key,secondA.key);
  assert.equal(matchingNavigationMembership(result,session,secondA),null);
  assert.equal(matchingNavigationMembership({...result,scope:secondA,membership:null},session,secondA),null);
});
