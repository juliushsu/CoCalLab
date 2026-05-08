import { getSupabaseClient, isSupabaseConnected } from '../lib/supabase';
import type { Organization, OrganizationMember, AddMemberInput, UpdateMemberRoleInput } from '../types/organization';
import { getIsTest, getEnv } from '../utils/staging';

function mapOrg(item: Record<string, unknown>): Organization {
  return {
    ...(item as unknown as Organization),
    // DB 無 name 欄位，用 display_name 作為 name 別名供舊有 UI 使用
    name: (item.display_name as string) || (item.legal_name as string),
  };
}

/**
 * 取得目前登入使用者所屬的所有組織
 * 透過 organization_members 過濾，確保 RLS 通過
 */
export async function getOrganizations(): Promise<Organization[]> {
  if (!isSupabaseConnected()) {
    console.warn('Supabase not connected, returning empty array');
    return [];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch organizations:', error);
    throw error;
  }

  return (data || []).map(mapOrg);
}

/**
 * 根據 ID 取得單一組織
 */
export async function getOrganizationById(id: string): Promise<Organization | null> {
  if (!isSupabaseConnected()) {
    console.warn('Supabase not connected');
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch organization:', error);
    throw error;
  }

  return data ? mapOrg(data as Record<string, unknown>) : null;
}

/**
 * 取得目前登入使用者的第一個 active 組織 ID
 * 用於需要 organization_id 但 URL 未帶入的場景
 */
export async function getCurrentUserOrganizationId(): Promise<string | null> {
  if (!isSupabaseConnected()) return null;

  const supabase = getSupabaseClient();

  // 先取得目前登入 user id
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user organization:', error);
    return null;
  }

  return data?.organization_id ?? null;
}

// ─────────────────────────────────────────────
// Member CRUD — 全面改走 Codex RPC
// ─────────────────────────────────────────────

/**
 * 取得指定組織的所有成員
 */
export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  if (!isSupabaseConnected()) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('organization_members')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch members:', error);
    throw error;
  }

  return (data || []) as OrganizationMember[];
}

/**
 * 新增成員 → 走 RPC add_organization_member
 *
 * Active 模式（封測可立即使用）：user_id 必填 → status = 'active'
 * Invited 模式（待後端流程完成）：無 user_id   → status = 'invited'
 *
 * RPC 簽名：
 *   add_organization_member(
 *     p_organization_id uuid,
 *     p_role            member_role,
 *     p_status          member_status,
 *     p_user_id         uuid  DEFAULT NULL,
 *     p_invited_email   citext DEFAULT NULL
 *   )
 */
export async function addOrganizationMember(input: AddMemberInput): Promise<OrganizationMember> {
  if (!isSupabaseConnected()) throw new Error('Supabase not connected');

  const supabase = getSupabaseClient();
  const isActive = !!input.user_id;

  const params: Record<string, unknown> = {
    p_organization_id: input.organization_id,
    p_role:            input.role,
    p_status:          isActive ? 'active' : 'invited',
    p_invited_email:   input.invited_email.toLowerCase().trim(),
  };

  if (input.user_id) {
    params.p_user_id = input.user_id.trim();
  }

  const { data, error } = await supabase.rpc('add_organization_member', params);

  if (error) {
    console.error('add_organization_member RPC error:', error);
    // 辨別常見錯誤類型
    if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('already')) {
      throw new Error('DUPLICATE_MEMBER');
    }
    throw error;
  }

  // RPC 回傳 TABLE，取第一筆並轉換為 OrganizationMember
  const row = Array.isArray(data) ? data[0] : data;
  return {
    id:              row.member_id,
    organization_id: row.organization_id,
    user_id:         row.user_id ?? null,
    invited_email:   row.invited_email ?? null,
    role:            row.role,
    status:          row.status,
    invited_at:      isActive ? null : new Date().toISOString(),
    joined_at:       isActive ? new Date().toISOString() : null,
    created_at:      new Date().toISOString(),
    updated_at:      new Date().toISOString(),
  } as OrganizationMember;
}

/**
 * 更新成員角色 → 走 RPC update_organization_member_role
 *
 * RPC 簽名：
 *   update_organization_member_role(
 *     p_organization_id uuid,
 *     p_member_id       uuid,
 *     p_new_role        member_role
 *   )
 */
export async function updateMemberRole(input: UpdateMemberRoleInput & { organization_id: string }): Promise<void> {
  if (!isSupabaseConnected()) throw new Error('Supabase not connected');

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('update_organization_member_role', {
    p_organization_id: input.organization_id,
    p_member_id:       input.id,
    p_new_role:        input.role,
  });

  if (error) {
    console.error('update_organization_member_role RPC error:', error);
    throw error;
  }
}

/**
 * 停用成員 → 走 RPC deactivate_organization_member
 *
 * RPC 簽名：
 *   deactivate_organization_member(
 *     p_organization_id uuid,
 *     p_member_id       uuid
 *   )
 */
export async function removeMember(memberId: string, organizationId: string): Promise<void> {
  if (!isSupabaseConnected()) throw new Error('Supabase not connected');

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('deactivate_organization_member', {
    p_organization_id: organizationId,
    p_member_id:       memberId,
  });

  if (error) {
    console.error('deactivate_organization_member RPC error:', error);
    throw error;
  }
}
