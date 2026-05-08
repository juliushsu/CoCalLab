import { useTranslation } from 'react-i18next';

interface StatusBadgeProps {
  status: string;
  type?: 'project' | 'document' | 'draft' | 'activity' | 'report' | 'subscription';
  label?: string;
  color?: string;
}

export function StatusBadge({ status, type = 'project', label, color }: StatusBadgeProps) {
  const { t } = useTranslation();

  const getStatusColor = () => {
    if (color) {
      const colorMap: Record<string, string> = {
        gray: 'bg-gray-100 text-gray-700',
        blue: 'bg-blue-100 text-blue-700',
        green: 'bg-green-100 text-green-700',
        yellow: 'bg-yellow-100 text-yellow-700',
        red: 'bg-red-100 text-red-700',
        teal: 'bg-teal-100 text-teal-700',
        purple: 'bg-purple-100 text-purple-700',
        orange: 'bg-orange-100 text-orange-700',
      };
      return colorMap[color] || 'bg-gray-100 text-gray-700';
    }

    if (type === 'report') {
      switch (status) {
        case 'draft': return 'bg-gray-100 text-gray-700';
        case 'generating': return 'bg-blue-100 text-blue-700';
        case 'completed': return 'bg-teal-100 text-teal-700';
        case 'failed': return 'bg-red-100 text-red-700';
        default: return 'bg-gray-100 text-gray-700';
      }
    }

    if (type === 'subscription') {
      switch (status) {
        case 'active': return 'bg-teal-100 text-teal-700';
        case 'expired': return 'bg-red-100 text-red-700';
        case 'cancelled': return 'bg-gray-100 text-gray-700';
        case 'suspended': return 'bg-orange-100 text-orange-700';
        default: return 'bg-gray-100 text-gray-700';
      }
    }

    if (type === 'project') {
      switch (status) {
        case 'draft': return 'bg-gray-100 text-gray-700';
        case 'in_progress': return 'bg-blue-100 text-blue-700';
        case 'completed': return 'bg-teal-100 text-teal-700';
        case 'archived': return 'bg-gray-100 text-gray-700';
        default: return 'bg-gray-100 text-gray-700';
      }
    }

    if (type === 'document') {
      switch (status) {
        case 'uploaded': return 'bg-blue-100 text-blue-700';
        case 'processing': return 'bg-yellow-100 text-yellow-700';
        case 'extracted': return 'bg-teal-100 text-teal-700';
        case 'failed': return 'bg-red-100 text-red-700';
        case 'reviewed': return 'bg-green-100 text-green-700';
        default: return 'bg-gray-100 text-gray-700';
      }
    }

    if (type === 'draft') {
      switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-700';
        case 'confirmed': return 'bg-teal-100 text-teal-700';
        case 'rejected': return 'bg-red-100 text-red-700';
        case 'modified': return 'bg-blue-100 text-blue-700';
        default: return 'bg-gray-100 text-gray-700';
      }
    }

    if (type === 'activity') {
      switch (status) {
        case 'draft': return 'bg-gray-100 text-gray-700';
        case 'confirmed': return 'bg-blue-100 text-blue-700';
        case 'calculated': return 'bg-purple-100 text-purple-700';
        case 'verified': return 'bg-teal-100 text-teal-700';
        default: return 'bg-gray-100 text-gray-700';
      }
    }

    return 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = () => {
    if (label) return label;
    if (type === 'report') return t(`reports.status.${status}`, { defaultValue: status });
    if (type === 'subscription') return t(`subscription.status_types.${status}`, { defaultValue: status });
    if (type === 'project') return t(`projects.status.${status}`, { defaultValue: status });
    if (type === 'document') return t(`documents.status.${status}`, { defaultValue: status });
    if (type === 'draft') return t(`drafts.status.${status}`, { defaultValue: status });
    if (type === 'activity') return t(`activities.fields.${status}`, { defaultValue: status });
    return t(`common.status_${status}`, { defaultValue: status });
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
      {getStatusLabel()}
    </span>
  );
}

export default StatusBadge;