import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: string | ReactNode;
  title: string;
  description?: string;
  action?: ReactNode | { label: string; onClick: () => void };
  // 支援多種 action 寫法
  actionLabel?: string;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, action, actionLabel, actionText, onAction }: EmptyStateProps) {
  const renderIcon = () => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      return (
        <div className="w-16 h-16 flex items-center justify-center mb-4 text-gray-300">
          <i className={`${icon} text-5xl`}></i>
        </div>
      );
    }
    return (
      <div className="w-16 h-16 flex items-center justify-center mb-4 text-gray-300">
        {icon}
      </div>
    );
  };

  const renderAction = () => {
    // 支援 action 物件 { label, onClick }
    if (action && typeof action === 'object' && 'label' in (action as object) && 'onClick' in (action as object)) {
      const actionObj = action as { label: string; onClick: () => void };
      return (
        <button
          onClick={actionObj.onClick}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
        >
          {actionObj.label}
        </button>
      );
    }
    // 支援 action 為 ReactNode
    if (action) return <div>{action as ReactNode}</div>;
    // 支援 actionLabel / actionText + onAction
    const btnLabel = actionLabel ?? actionText;
    if (btnLabel && onAction) {
      return (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
        >
          {btnLabel}
        </button>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {renderIcon()}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 text-center max-w-md mb-6">{description}</p>
      )}
      {renderAction()}
    </div>
  );
}

export default EmptyState;
