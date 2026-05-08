import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../../components/layout/AdminLayout';
import LoadingState from '../../../components/base/LoadingState';
import ErrorState from '../../../components/base/ErrorState';
import MemberListTable from './components/MemberListTable';
import AddMemberModal from './components/AddMemberModal';
import { getOrganizationById, getOrganizationMembers } from '../../../services/organizationService';
import { getSupabaseClient, isSupabaseConnected } from '../../../lib/supabase';
import type { Organization, OrganizationMember } from '../../../types/organization';

export default function OrganizationMembersPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      const [org, memberList] = await Promise.all([
        getOrganizationById(id),
        getOrganizationMembers(id),
      ]);

      setOrganization(org);
      setMembers(memberList);

      // 取得當前 user id
      if (isSupabaseConnected()) {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id ?? null);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
      setError(t('common.errors.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeMembers = members.filter(m => m.status !== 'inactive');
  const ownerCount = activeMembers.filter(m => m.role === 'owner').length;

  const isCurrentUserOwnerOrAdmin = members.some(
    m => m.user_id === currentUserId && (m.role === 'owner' || m.role === 'admin') && m.status === 'active'
  );

  return (
    <AdminLayout>
      <div className="w-full h-full flex flex-col">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-5">
          <button
            onClick={() => navigate('/admin/organizations')}
            className="hover:text-gray-700 cursor-pointer"
          >
            {t('organizations.title')}
          </button>
          <i className="ri-arrow-right-s-line"></i>
          <span className="text-gray-400 truncate max-w-xs">
            {organization?.display_name || organization?.legal_name || id}
          </span>
          <i className="ri-arrow-right-s-line"></i>
          <span className="text-gray-700 font-medium">{t('organizations.members.title')}</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {t('organizations.members.title')}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {organization
                ? t('organizations.members.subtitle', { name: organization.display_name || organization.legal_name })
                : t('organizations.members.subtitleDefault')}
            </p>
          </div>
          {isCurrentUserOwnerOrAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
            >
              <i className="ri-user-add-line"></i>
              {t('organizations.members.addButton')}
            </button>
          )}
        </div>

        {/* Stats bar */}
        {!loading && !error && (
          <div className="flex items-center gap-6 mb-5 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-team-line text-teal-600"></i>
              </div>
              <span className="text-gray-600">{t('organizations.members.totalMembers')}:</span>
              <span className="font-semibold text-gray-900">{activeMembers.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-mail-line text-yellow-500"></i>
              </div>
              <span className="text-gray-600">{t('organizations.members.pendingInvites')}:</span>
              <span className="font-semibold text-gray-900">
                {members.filter(m => m.status === 'invited').length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-shield-star-line text-purple-500"></i>
              </div>
              <span className="text-gray-600">{t('organizations.members.roles.owner')}:</span>
              <span className="font-semibold text-gray-900">{ownerCount}</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="bg-white rounded-lg border border-gray-200 flex-1 overflow-hidden">
          {loading ? (
            <div className="py-12">
              <LoadingState />
            </div>
          ) : error ? (
            <div className="py-12">
              <ErrorState message={error} onRetry={loadData} />
            </div>
          ) : (
            <MemberListTable
              members={activeMembers}
              organizationId={id!}
              currentUserId={currentUserId}
              onRefresh={loadData}
            />
          )}
        </div>
      </div>

      {showAddModal && id && (
        <AddMemberModal
          organizationId={id}
          onSuccess={() => {
            setShowAddModal(false);
            loadData();
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </AdminLayout>
  );
}
