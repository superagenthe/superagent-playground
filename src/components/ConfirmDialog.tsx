import { useId } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  return (
    <Modal
      onCancel={onCancel}
      labelledBy={titleId}
      className="dialog dialog--confirm"
      closeOnBackdrop={false}
    >
      <div className="dialog-head">
        <h2 id={titleId}>{title}</h2>
      </div>
      <div className="dialog-body">
        <p>{description}</p>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" autoFocus onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={danger ? 'btn btn-danger' : 'btn btn-primary'}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
