import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { graphemeLength, normalizeTitle } from '../lib/text';
import type { AppData, Priority, Task, TaskDraft } from '../lib/types';
import type { SaveTaskResult, SimpleResult } from '../hooks/useTodoStore';
import { validateTaskDraft, type TaskDraftErrors } from '../lib/validation';
import { ConfirmDialog } from './ConfirmDialog';
import { IconClose, IconTrash } from './Icons';
import { Modal } from './Modal';

interface TaskDetailProps {
  mode: 'create' | 'edit';
  task?: Task;
  data: AppData;
  defaults: { listId: string; dueDate: string | null };
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDeleted: (message: string) => void;
  onSave: (draft: TaskDraft, base?: { id: string; revision: number }) => SaveTaskResult;
  onDelete: (id: string) => SimpleResult;
}

function taskToDraft(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate,
    listId: task.listId,
  };
}

type Conflict = null | 'changed' | 'deleted';

export function TaskDetail({
  mode,
  task,
  data,
  defaults,
  onClose,
  onSaved,
  onDeleted,
  onSave,
  onDelete,
}: TaskDetailProps) {
  const initialDraft: TaskDraft =
    mode === 'edit' && task
      ? taskToDraft(task)
      : {
          title: '',
          description: '',
          priority: 'medium',
          dueDate: defaults.dueDate,
          listId: defaults.listId,
        };

  const [draft, setDraft] = useState<TaskDraft>(initialDraft);
  const [baseline, setBaseline] = useState<TaskDraft>(initialDraft);
  const [errors, setErrors] = useState<TaskDraftErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict>(null);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const savingRef = useRef(false);
  const compositionRef = useRef(false);
  const baseRevisionRef = useRef<number | null>(task?.revision ?? null);

  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const taskId = task?.id;

  useEffect(() => {
    const frame = requestAnimationFrame(() => titleRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (mode !== 'edit' || !taskId) return;
    const current = data.tasks.find((item) => item.id === taskId);
    if (!current) {
      setConflict('deleted');
      return;
    }
    if (current.revision !== baseRevisionRef.current) {
      setConflict('changed');
    }
  }, [data, mode, taskId]);

  const updateDraft = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (errors[key as keyof TaskDraftErrors]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
    if (saveError) setSaveError(null);
  };

  const attemptClose = () => {
    if (savingRef.current) return;
    if (dirty) setDiscardConfirm(true);
    else onClose();
  };

  const focusFirstError = (nextErrors: TaskDraftErrors) => {
    window.setTimeout(() => {
      if (nextErrors.title) titleRef.current?.focus();
      else if (nextErrors.description) descriptionRef.current?.focus();
      else if (nextErrors.dueDate) dueDateRef.current?.focus();
      else if (nextErrors.listId) listRef.current?.focus();
    }, 0);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    if (conflict === 'changed' || conflict === 'deleted') return;

    const validation = validateTaskDraft(draft, data.lists);
    if (!validation.ok) {
      setErrors(validation.errors);
      focusFirstError(validation.errors);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setSaveError(null);

    const base =
      mode === 'edit' && task && baseRevisionRef.current !== null
        ? { id: task.id, revision: baseRevisionRef.current }
        : undefined;
    const result = onSave(validation.value, base);
    if (result.ok) {
      // Keep the re-entrancy guard until the sheet unmounts so a second
      // submit in the same tick cannot create a duplicate.
      onSaved(result.task);
      return;
    }
    savingRef.current = false;
    setSaving(false);

    if (result.reason === 'conflict-changed') setConflict('changed');
    else if (result.reason === 'conflict-deleted') setConflict('deleted');
    else if (result.reason === 'conflict-list') {
      setErrors((current) => ({ ...current, listId: result.message }));
      listRef.current?.focus();
    } else {
      setSaveError(result.message);
    }
  };

  const handleDelete = () => {
    if (!task || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const result = onDelete(task.id);
    savingRef.current = false;
    setSaving(false);
    setDeleteConfirm(false);
    if (result.ok) {
      onDeleted('任务已删除');
    } else if (result.reason === 'not-found') {
      onDeleted(result.message);
    } else if (result.reason === 'storage') {
      setSaveError(result.message);
    } else {
      setSaveError(result.message);
    }
  };

  const reloadLatest = () => {
    if (!taskId) return;
    const current = data.tasks.find((item) => item.id === taskId);
    if (!current) {
      setConflict('deleted');
      return;
    }
    const next = taskToDraft(current);
    setDraft(next);
    setBaseline(next);
    baseRevisionRef.current = current.revision;
    setErrors({});
    setSaveError(null);
    setConflict(null);
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  const onTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key === 'Enter' &&
      (event.nativeEvent.isComposing || compositionRef.current || event.keyCode === 229)
    ) {
      event.preventDefault();
    }
  };

  const listMissing = !data.lists.some((list) => list.id === draft.listId);
  const titleLength = graphemeLength(normalizeTitle(draft.title));
  const descriptionLength = graphemeLength(draft.description);
  const saveDisabled = saving || conflict === 'changed' || conflict === 'deleted';

  return (
    <Modal onCancel={attemptClose} labelledBy={titleId} className="sheet" closeOnBackdrop>
      <form className="detail-form" onSubmit={handleSubmit} noValidate>
        <header className="detail-head">
          <button
            type="button"
            className="icon-btn"
            aria-label="关闭任务详情"
            onClick={attemptClose}
          >
            <IconClose size={20} />
          </button>
          <div>
            <p className="eyebrow">{mode === 'create' ? '新任务' : '任务详情'}</p>
            <h2 id={titleId}>{mode === 'create' ? '新增任务' : '编辑任务'}</h2>
          </div>
        </header>

        <div className="detail-body">
          {conflict === 'changed' ? (
            <div className="banner banner--conflict" role="alert">
              <p>该任务已在其他页面被修改。为避免覆盖，请先重新载入最新记录。</p>
              <button type="button" className="btn btn-small" onClick={reloadLatest}>
                重新载入最新记录
              </button>
            </div>
          ) : null}

          {conflict === 'deleted' ? (
            <div className="banner banner--conflict" role="alert">
              <p>该任务已在其他页面被删除。当前输入不会保存，也不会重新创建该任务。</p>
              <button type="button" className="btn btn-small" onClick={attemptClose}>
                关闭详情
              </button>
            </div>
          ) : null}

          {saveError ? (
            <div className="banner banner--error" role="alert">
              <p>{saveError}</p>
            </div>
          ) : null}

          <div className="field">
            <label className="field-label" htmlFor="task-title">
              任务标题 <span className="required">必填</span>
            </label>
            <input
              ref={titleRef}
              id="task-title"
              className={`input${errors.title ? ' has-error' : ''}`}
              type="text"
              value={draft.title}
              autoFocus
              placeholder="要做什么？"
              maxLength={400}
              onChange={(event) => updateDraft('title', event.target.value)}
              onKeyDown={onTitleKeyDown}
              onCompositionStart={() => {
                compositionRef.current = true;
              }}
              onCompositionEnd={() => {
                window.setTimeout(() => {
                  compositionRef.current = false;
                }, 0);
              }}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? 'task-title-error' : undefined}
            />
            <div className="field-hint-row">
              <span id="task-title-error" className="field-error" role={errors.title ? 'alert' : undefined}>
                {errors.title}
              </span>
              <span className="char-count">{titleLength}/200</span>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="task-description">
              备注 <span className="optional">可选</span>
            </label>
            <textarea
              ref={descriptionRef}
              id="task-description"
              className={`textarea${errors.description ? ' has-error' : ''}`}
              value={draft.description}
              placeholder="补充说明、链接或下一步行动"
              rows={5}
              onChange={(event) => updateDraft('description', event.target.value)}
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={errors.description ? 'task-description-error' : undefined}
            />
            <div className="field-hint-row">
              <span
                id="task-description-error"
                className="field-error"
                role={errors.description ? 'alert' : undefined}
              >
                {errors.description}
              </span>
              <span className="char-count">{descriptionLength}/5,000</span>
            </div>
          </div>

          <div className="field-grid">
            <div className="field">
              <label className="field-label" htmlFor="task-due-date">
                到期日期 <span className="optional">可选</span>
              </label>
              <input
                ref={dueDateRef}
                id="task-due-date"
                className={`input${errors.dueDate ? ' has-error' : ''}`}
                type="date"
                value={draft.dueDate ?? ''}
                onChange={(event) =>
                  updateDraft('dueDate', event.target.value ? event.target.value : null)
                }
                aria-invalid={errors.dueDate ? true : undefined}
                aria-describedby={errors.dueDate ? 'task-due-error' : undefined}
              />
              <span id="task-due-error" className="field-error" role={errors.dueDate ? 'alert' : undefined}>
                {errors.dueDate}
              </span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="task-list">
                所属清单
              </label>
              <select
                ref={listRef}
                id="task-list"
                className={`select${errors.listId ? ' has-error' : ''}`}
                value={draft.listId}
                onChange={(event) => updateDraft('listId', event.target.value)}
                aria-invalid={errors.listId ? true : undefined}
                aria-describedby={errors.listId ? 'task-list-error' : undefined}
              >
                {listMissing ? (
                  <option value={draft.listId} disabled>
                    清单已被删除
                  </option>
                ) : null}
                {data.lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
              <span id="task-list-error" className="field-error" role={errors.listId ? 'alert' : undefined}>
                {errors.listId}
              </span>
            </div>
          </div>

          <fieldset className="field">
            <legend className="field-label">优先级</legend>
            <div className="segmented">
              {(['high', 'medium', 'low'] as Priority[]).map((value) => (
                <label
                  key={value}
                  className={`segment${draft.priority === value ? ' is-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={value}
                    checked={draft.priority === value}
                    onChange={() => updateDraft('priority', value)}
                  />
                  <span>{value === 'high' ? '高' : value === 'medium' ? '中' : '低'}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {mode === 'edit' && task?.status === 'done' ? (
            <p className="detail-hint">这是已完成任务，仍可编辑；保存后保持已完成状态。</p>
          ) : null}
        </div>

        <footer className="detail-foot">
          {mode === 'edit' ? (
            <button
              type="button"
              className="btn btn-danger-ghost"
              onClick={() => setDeleteConfirm(true)}
              disabled={saving || conflict !== null}
            >
              <IconTrash size={17} />
              删除任务
            </button>
          ) : null}
          <div className="foot-spacer" />
          <button type="button" className="btn btn-ghost" onClick={attemptClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={saveDisabled}>
            {saving ? '保存中…' : '保存'}
          </button>
        </footer>
      </form>

      {discardConfirm ? (
        <ConfirmDialog
          title="放弃未保存的修改？"
          description="关闭后，本次修改将丢失。"
          confirmLabel="放弃修改"
          cancelLabel="继续编辑"
          danger
          onCancel={() => setDiscardConfirm(false)}
          onConfirm={() => {
            setDiscardConfirm(false);
            onClose();
          }}
        />
      ) : null}

      {deleteConfirm && task ? (
        <ConfirmDialog
          title="删除任务？"
          description={`「${task.title}」删除后无法恢复，确定删除吗？`}
          confirmLabel="删除"
          danger
          onCancel={() => setDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      ) : null}
    </Modal>
  );
}
