/** Tenant navigation is presentation only. Server authorization remains mandatory. */
export type TenantRole = 'viewer' | 'editor' | 'admin' | 'owner';
export type NavigationScope =
  | { kind: 'none'; key: string }
  | { kind: 'invalid'; key: string }
  | { kind: 'organization'; key: string; organizationId: string; projectId?: string }
  | { kind: 'project'; key: string; projectId: string; organizationId?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function canonicalUuid(value: unknown): string | null {
  return typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : null;
}
export function resolveNavigationScope(pathname: string, search: string): NavigationScope {
  const key = `${pathname}${search}`;
  const invalid: NavigationScope = {kind:'invalid',key};
  const query = new URLSearchParams(search);
  const canonical = query.getAll('organization_id').map(value => value.toLowerCase());
  const legacy = query.getAll('organizationId').map(value => value.toLowerCase());
  const projects = query.getAll('project_id').map(value => value.toLowerCase());
  const legacyProjects = query.getAll('projectId').map(value => value.toLowerCase());
  if (canonical.length > 1 || legacy.length > 1 || projects.length > 1 || legacyProjects.length > 1) return invalid;
  if (canonical.length && legacy.length && canonical[0] !== legacy[0]) return invalid;
  const organizationId = canonical[0] ?? legacy[0];
  if (projects.length && legacyProjects.length && projects[0] !== legacyProjects[0]) return invalid;
  const projectId = projects[0] ?? legacyProjects[0];
  if ((organizationId !== undefined && !UUID.test(organizationId)) || (projectId !== undefined && !UUID.test(projectId))) return invalid;
  const orgRoute = pathname.toLowerCase().match(/^\/admin\/organizations\/([^/]+)\/(?:edit|members)\/?$/);
  if (orgRoute) {
    if (!UUID.test(orgRoute[1]) || (organizationId && orgRoute[1] !== organizationId)) return invalid;
    return {kind:'organization',key,organizationId:orgRoute[1],...(projectId ? {projectId} : {})};
  }
  const projectRoute = pathname.toLowerCase().match(/^\/admin\/projects\/([^/]+)(?:\/edit)?\/?$/);
  if (projectRoute && projectRoute[1] !== 'create') {
    if (!UUID.test(projectRoute[1]) || (projectId && projectRoute[1] !== projectId)) return invalid;
    return {kind:'project',key,projectId:projectRoute[1],...(organizationId ? {organizationId} : {})};
  }
  if (projectId) return {kind:'project',key,projectId,...(organizationId ? {organizationId} : {})};
  if (organizationId) return {kind:'organization',key,organizationId};
  return {kind:'none',key};
}
export function activeMembershipRole(value: unknown, organizationId: string, userId: string): TenantRole | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const org = canonicalUuid(organizationId);
  const user = canonicalUuid(userId);
  if (!org || !user || canonicalUuid(row.organization_id) !== org || canonicalUuid(row.user_id) !== user || row.status !== 'active') return null;
  return ['viewer','editor','admin','owner'].includes(String(row.role)) ? row.role as TenantRole : null;
}
export function currentSession(session: {access_token?: string; expires_at?: number; user?: {id?: string}} | null, now = Date.now()): boolean {
  return Boolean(session?.access_token && session.user?.id && Number.isFinite(session.expires_at) && session.expires_at! * 1000 > now);
}
export function navigationItemAllowed(path: string, role: TenantRole | null, required?: readonly string[]): boolean {
  // Preserve entry points to select a tenant/project even before role lookup.
  if (path === '/admin/organizations' || path === '/admin/projects') return true;
  if (!role) return false;
  return !required?.length || required.includes(role);
}

export interface NavigationMembership { organizationId: string; role: TenantRole }
export function matchingNavigationMembership<T extends object>(
  result: {session:T;scope:object;membership:NavigationMembership | null} | null,
  session: T | null,
  scope: object,
): NavigationMembership | null {
  return session && result?.session === session && result.scope === scope ? result.membership : null;
}
