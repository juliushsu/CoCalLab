// 對齊 DB schema: organizations 表
// 注意：DB 無 name 欄位，只有 legal_name 和 display_name
export type OrganizationStatus = 'active' | 'archived' | 'suspended';

export interface Organization {
  id: string;
  slug: string;
  legal_name: string;
  display_name: string;
  tax_id?: string | null;
  country_code: string;
  timezone: string;
  status: OrganizationStatus;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;

  // 前端相容別名
  name?: string;        // alias for display_name，供舊有 UI 使用
  description?: string; // DB 無此欄位，前端 UI 顯示用
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  industry?: string | null;
  address?: string | null;
}

export interface CreateOrganizationInput {
  slug: string;
  legal_name: string;
  display_name: string;
  tax_id?: string;
  country_code?: string;
  timezone?: string;
}

export interface UpdateOrganizationInput extends Partial<CreateOrganizationInput> {
  id: string;
  name?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  industry?: string;
  address?: string;
  description?: string;
  status?: OrganizationStatus;
}

// ── Member types ───────────────────────────────────────────────
export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type MemberStatus = 'active' | 'invited' | 'inactive';

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: MemberRole;
  status: MemberStatus;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AddMemberInput {
  organization_id: string;
  invited_email: string;
  role: Exclude<MemberRole, 'owner'>;
  /**
   * Active 模式：必填，對應已存在的 auth user_id。
   * 有 user_id → status='active'；無 user_id → status='invited'
   */
  user_id?: string;
}

export interface UpdateMemberRoleInput {
  id: string;
  role: MemberRole;
}
