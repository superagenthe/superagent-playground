import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  onCancel: () => void;
  labelledBy?: string;
  ariaLabel?: string;
  className?: string;
  closeOnBackdrop?: boolean;
  children: ReactNode;
}

let openDialogCount = 0;
let previousBodyOverflow = '';

export function Modal({
  onCancel,
  labelledBy,
  ariaLabel,
  className = '',
  closeOnBackdrop = true,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (openDialogCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openDialogCount += 1;

    if (!dialog.open) dialog.showModal();

    const handleCancel = (event: Event) => {
      event.preventDefault();
      cancelRef.current();
    };
    dialog.addEventListener('cancel', handleCancel);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const openDialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
      if (openDialogs[openDialogs.length - 1] !== dialog) return;

      const selector =
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => element.getClientRects().length > 0,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      document.removeEventListener('keydown', handleKeyDown, true);
      if (dialog.open) dialog.close();
      openDialogCount = Math.max(0, openDialogCount - 1);
      if (openDialogCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
      if (returnFocus && document.contains(returnFocus)) {
        requestAnimationFrame(() => returnFocus.focus());
      }
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className={className}
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === dialogRef.current) cancelRef.current();
      }}
    >
      {children}
    </dialog>,
    document.body,
  );
}
