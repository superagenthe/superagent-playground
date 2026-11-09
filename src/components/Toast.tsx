import { IconClose } from './Icons';

interface ToastProps {
  message: string;
  kind: 'success' | 'error';
  onDismiss: () => void;
}

export function Toast({ message, kind, onDismiss }: ToastProps) {
  return (
    <div className={`toast toast--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      <button type="button" className="toast-close" aria-label="关闭提示" onClick={onDismiss}>
        <IconClose size={15} />
      </button>
    </div>
  );
}
