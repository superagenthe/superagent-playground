import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondary?: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondary,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      <div className="empty-actions">
        {actionLabel && onAction ? (
          <button type="button" className="btn btn-primary" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
        {secondary}
      </div>
    </div>
  );
}
