import { useState } from 'react';
import type { StoreState } from '../hooks/useTodoStore';
import type { SimpleResult } from '../hooks/useTodoStore';
import { ConfirmDialog } from './ConfirmDialog';
import { IconAlert } from './Icons';

interface DataErrorScreenProps {
  state: Extract<StoreState, { status: 'error' }>;
  onRetry: () => void;
  onReset: () => SimpleResult;
}

export function DataErrorScreen({ state, onRetry, onReset }: DataErrorScreenProps) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [attempted, setAttempted] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const incompatible = state.kind === 'incompatible';

  return (
    <main className="fatal-screen">
      <div className="fatal-card">
        <div className="fatal-icon" aria-hidden="true">
          <IconAlert size={28} />
        </div>
        <p className="eyebrow">本地数据</p>
        <h1>{incompatible ? '数据版本不兼容' : '数据无法读取'}</h1>
        <p>
          {incompatible
            ? `本地数据的版本为 ${String(state.version)}，当前应用无法安全读取。为避免覆盖，应用没有修改原始数据。`
            : '本地保存的数据格式已损坏。为避免覆盖，应用没有修改原始数据。'}
        </p>
        <p className="muted">
          可以先重新读取；如果仍然失败，重置会清空当前浏览器中的任务和清单，并重新初始化。
        </p>
        {attempted ? (
          <p className="field-error" role="alert">
            仍未读取成功，请检查本地数据或选择重置。
          </p>
        ) : null}
        {resetError ? (
          <p className="field-error" role="alert">
            {resetError}
          </p>
        ) : null}
        <div className="fatal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setAttempted(true);
              onRetry();
            }}
          >
            重新读取
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setStep(1)}>
            重置数据
          </button>
        </div>
      </div>

      {step === 1 ? (
        <ConfirmDialog
          title="重置本地数据？"
          description="这会清空所有任务和清单，且无法恢复。建议先确认数据是否仍有其他副本。"
          confirmLabel="继续重置"
          danger
          onCancel={() => setStep(0)}
          onConfirm={() => setStep(2)}
        />
      ) : null}

      {step === 2 ? (
        <ConfirmDialog
          title="再次确认重置"
          description="原始数据将被清空并重新初始化。此操作不可撤销，确定继续吗？"
          confirmLabel="确认重置"
          danger
          onCancel={() => setStep(0)}
          onConfirm={() => {
            const result = onReset();
            if (!result.ok) {
              setResetError(result.message);
              setStep(0);
            }
          }}
        />
      ) : null}
    </main>
  );
}
