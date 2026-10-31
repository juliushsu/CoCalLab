import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import { activeMembershipRole, canonicalUuid, type NavigationScope, type TenantRole } from './navigationScope';

export async function getTenantNavigationRole(scope: NavigationScope, userId: string): Promise<{organizationId:string;role:TenantRole} | null> {
  const canonicalUserId = canonicalUuid(userId);
  if (!canonicalUserId || !isSupabaseConnected() || scope.kind === 'none' || scope.kind === 'invalid') return null;
  const client = getSupabaseClient();
  let organizationId = scope.organizationId ? canonicalUuid(scope.organizationId) : null;
  if (scope.organizationId && !organizationId) return null;
  if (scope.projectId) {
    const projectId = canonicalUuid(scope.projectId);
    if (!projectId) return null;
    const {data,error} = await client.from('projects').select('organization_id').eq('id',projectId).maybeSingle();
    if (error) throw error;
    const projectOrganizationId = data ? canonicalUuid(data.organization_id) : null;
    if (!projectOrganizationId || (organizationId && organizationId !== projectOrganizationId)) return null;
    organizationId = projectOrganizationId;
  }
  if (!organizationId) return null;
  const {data,error} = await client.from('organization_members').select('organization_id,user_id,status,role')
    .eq('organization_id',organizationId).eq('user_id',canonicalUserId).eq('status','active').maybeSingle();
  if (error) throw error;
  const role = activeMembershipRole(data,organizationId,canonicalUserId);
  return role ? {organizationId,role} : null;
}
