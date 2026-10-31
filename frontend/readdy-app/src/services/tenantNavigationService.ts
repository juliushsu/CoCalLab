import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import { activeMembershipRole, type NavigationScope, type TenantRole } from './navigationScope';

export async function getTenantNavigationRole(scope: NavigationScope, userId: string): Promise<{organizationId:string;role:TenantRole} | null> {
  if (!userId || !isSupabaseConnected() || scope.kind === 'none' || scope.kind === 'invalid') return null;
  const client = getSupabaseClient();
  let organizationId = scope.organizationId;
  if (scope.projectId) {
    const {data,error} = await client.from('projects').select('organization_id').eq('id',scope.projectId).maybeSingle();
    if (error) throw error;
    if (!data || typeof data.organization_id !== 'string') return null;
    if (organizationId && organizationId !== data.organization_id) return null;
    organizationId = data.organization_id;
  }
  if (!organizationId) return null;
  const {data,error} = await client.from('organization_members').select('organization_id,user_id,status,role')
    .eq('organization_id',organizationId).eq('user_id',userId).eq('status','active').maybeSingle();
  if (error) throw error;
  const role = activeMembershipRole(data,organizationId,userId);
  return role ? {organizationId,role} : null;
}
