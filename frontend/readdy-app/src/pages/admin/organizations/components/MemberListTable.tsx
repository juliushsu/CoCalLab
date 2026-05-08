import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrganizationMember, MemberRole } from '../../../../types/organization';
import { updateMemberRole, removeMember } from '../../../../services/organizationService';
import ConfirmDialog from '../../../../components/base/ConfirmDialog';

interface MemberListTableProps {
  members: OrganizationMember[];
  organizationId: string;
  currentUserId: string | null;
  onRefresh: () => void;
}

const ROLE_OPTIONS: Exclude<MemberRole, 'owner'>[] = ['admin', 'editor', 'viewer'];

// ── Role badge ────────────────────────────────
function RoleBadge({ role }: { role: MemberRole }) {
  const { t } = useTranslation();
  const cfg: Record<MemberRole, { cls: string; icon: string }> = {
    owner:  { cls: 'bg-purple-100 text-purple-700', icon: 'ri-vip-crown-line' },
    admin:  { cls: 'bg-orange-100 text-orange-700', icon: 'ri-shield-star-line' },
    editor: { cls: 'bg-teal-100 text-teal-700',     icon: 'ri-edit-2-line' },
    viewer: { cls: 'bg-gray-100 text-gray-600',     icon: 'ri-eye-line' },
  };
  const { cls, icon } = cfg[role];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      <i className={icon}></i>
      {t(`organizations.members.roles.${role}`)}
    </span>
  );
}

// ── Testability badge — 封測狀態指示器 ──────────
function TestabilityBadge({ status }: { status: OrganizationMember['status'] }) {
  const { t } = useTranslation();

  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
        <i className="ri-checkbox-circle-fill text-green-500"></i>
        {t('organizations.members.testabilityActive')}
      </span>
    );
  }
  if (status === 'invited') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
        <i className="ri-time-line"></i>
        {t('organizations.members.testabilityInvited')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
      <i className="ri-forbid-line"></i>
      {t('organizations.members.testabilityInactive')}
    </span>
  );
}

export default function MemberListTable({
  members,
  organizationId,
  currentUserId,
  onRefresh,
}: MemberListTableProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<MemberRole>('viewer');
  const [savingId, setSavingId]     = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<OrganizationMember | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const handleEditRole = (member: OrganizationMember) => {
    setEditingId(member.id);
    setEditingRole(member.role);
    setError(null);
  };

  const handleSaveRole = async (member: OrganizationMember) => {
    setSavingId(member.id);
    setError(null);
    try {
      await updateMemberRole({ id: member.id, role: editingRole, organization_id: organizationId });
      setEditingId(null);
      onRefresh();
    } catch {
      setError(t('organizations.members.errors.updateFailed'));
    } finally {
      setSavingId(null);
    }
  };

  const handleRemoveConfirmed = async () => {
    if (!confirmRemove) return;
    setSavingId(confirmRemove.id);
    try {
      await removeMember(confirmRemove.id, organizationId);
      setConfirmRemove(null);
      onRefresh();
    } catch {
      setError(t('organizations.members.errors.removeFailed'));
    } finally {
      setSavingId(null);
    }
  };

  if (members.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        <div className="w-12 h-12 flex items-center justify-center mx-auto mb-3">
          <i className="ri-team-line text-4xl text-gray-200"></i>
        </div>
        <div>{t('organizations.members.empty')}</div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mx-4 mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <i className="ri-error-warning-line shrink-0"></i>{error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('organizations.members.fields.email')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('organizations.members.fields.role')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('organizations.members.fields.testability')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('organizations.members.fields.joinedAt')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('common.table_actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map(member => {
              const isOwner       = member.role === 'owner';
              const isCurrentUser = member.user_id === currentUserId;
              const isEditing     = editingId === member.id;
              const isSaving      = savingId === member.id;
              const displayEmail  = member.invited_email ?? `uid:${member.user_id?.slice(0, 8)}…`;

              return (
                <tr
                  key={member.id}
                  className={`hover:bg-gray-50/80 transition-colors ${member.status === 'inactive' ? 'opacity-40' : ''}`}
                >
                  {/* Email + uid hint */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-semibold shrink-0 ${
                        member.status === 'active'
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {(displayEmail[0] || '?').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{displayEmail}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {member.user_id && (
                            <span className="text-xs text-gray-400 font-mono">
                              {member.user_id.slice(0, 13)}…
                            </span>
                          )}
                          {isCurrentUser && (
                            <span className="text-xs font-medium text-teal-600">{t('organizations.members.you')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Role — editable for non-owner */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {isEditing && !isOwner ? (
                      <select
                        value={editingRole}
                        onChange={e => setEditingRole(e.target.value as MemberRole)}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        disabled={isSaving}
                        autoFocus
                      >
                        {ROLE_OPTIONS.map(r => (
                          <option key={r} value={r}>
                            {t(`organizations.members.roles.${r}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                  </td>

                  {/* Testability */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <TestabilityBadge status={member.status} />
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {member.status === 'active' && member.joined_at
                      ? new Date(member.joined_at).toLocaleDateString()
                      : member.invited_at
                        ? `${t('organizations.members.invitedOn')} ${new Date(member.invited_at).toLocaleDateString()}`
                        : '-'}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!isOwner && (
                        <>
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveRole(member)}
                                disabled={isSaving}
                                className="px-3 py-1 text-xs bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                              >
                                {isSaving ? t('common.loading') : t('common.save')}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                disabled={isSaving}
                                className="px-3 py-1 text-xs border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                              >
                                {t('common.cancel')}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleEditRole(member)}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                              title={t('organizations.members.editRole')}
                            >
                              <i className="ri-shield-user-line text-sm"></i>
                            </button>
                          )}

                          {!isCurrentUser && !isEditing && member.status !== 'inactive' && (
                            <button
                              onClick={() => setConfirmRemove(member)}
                              disabled={isSaving}
                              className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              title={t('organizations.members.remove')}
                            >
                              <i className="ri-user-unfollow-line text-sm"></i>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmRemove && (
        <ConfirmDialog
          isOpen
          title={t('organizations.members.confirmRemoveTitle')}
          message={t('organizations.members.confirmRemoveMessage', {
            email: confirmRemove.invited_email ?? confirmRemove.user_id,
          })}
          confirmLabel={t('organizations.members.remove')}
          onConfirm={handleRemoveConfirmed}
          onCancel={() => setConfirmRemove(null)}
          variant="danger"
          isLoading={!!savingId}
        />
      )}
    </>
  );
}
