import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { graphemeLength } from '../lib/text';
import { Modal } from './Modal';

interface ListNameDialogProps {
  mode: 'create' | 'rename';
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string) => { ok: true } | { ok: false; message: string };
}

function composing(event: KeyboardEvent<HTMLInputElement>): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

export function ListNameDialog({
  mode,
  initialName = '',
  onClose,
  onSubmit,
}: ListNameDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const errorId = useId();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      if (mode === 'rename') inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const result = onSubmit(name);
    if (result.ok) onClose();
    else setError(result.message);
  };

  return (
    <Modal
      onCancel={onClose}
      labelledBy={titleId}
      className="dialog dialog--form"
      closeOnBackdrop={false}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="dialog-head">
          <h2 id={titleId}>{mode === 'create' ? '新建清单' : '重命名清单'}</h2>
        </div>
        <div className="dialog-body">
          <label className="field">
            <span className="field-label">清单名称</span>
            <input
              ref={inputRef}
              className="input"
              type="text"
              value={name}
              autoFocus
              onFocus={(event) => {
                if (mode === 'rename') event.currentTarget.select();
              }}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && composing(event)) event.preventDefault();
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
          </label>
          <div className="field-hint-row">
            <span id={errorId} className="field-error" role={error ? 'alert' : undefined}>
              {error}
            </span>
            <span className="char-count">{graphemeLength(name.trim())}/30</span>
          </div>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary">
            {mode === 'create' ? '创建清单' : '保存名称'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
