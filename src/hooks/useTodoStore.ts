import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newId } from '../lib/id';
import {
  createInitialData,
  getLocalStorage,
  loadFrom,
  saveTo,
  STORAGE_KEY,
} from '../lib/storage';
import { INBOX_ID, type AppData, type Task, type TaskDraft, type TaskList } from '../lib/types';
import { validateListName } from '../lib/validation';

export type StoreState =
  | { status: 'loading' }
  | { status: 'ready'; data: AppData }
  | {
      status: 'error';
      kind: 'corrupt' | 'incompatible';
      raw: string;
      version?: unknown;
    };

export type FailureReason =
  | 'storage'
  | 'conflict-changed'
  | 'conflict-deleted'
  | 'conflict-list'
  | 'not-found'
  | 'validation'
  | 'data';

export interface OperationFailure {
  ok: false;
  reason: FailureReason;
  message: string;
}

export type SimpleResult = { ok: true } | OperationFailure;
export type SaveTaskResult = { ok: true; task: Task; data: AppData } | OperationFailure;
export type DeleteListResult = { ok: true; affected: number } | OperationFailure;
export type ListResult = { ok: true; list: TaskList } | OperationFailure;

interface TaskBase {
  id: string;
  revision: number;
}

function fail(reason: FailureReason, message: string): OperationFailure {
  return { ok: false, reason, message };
}

export function useTodoStore() {
  const [state, setState] = useState<StoreState>({ status: 'loading' });
  const stateRef = useRef(state);
  const [persistIssue, setPersistIssue] = useState<string | null>(null);
  const [externalNotice, setExternalNotice] = useState<string | null>(null);

  const apply = useCallback((next: StoreState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const load = useCallback(() => {
    const storage = getLocalStorage();
    if (!storage) {
      apply({ status: 'ready', data: createInitialData() });
      setPersistIssue('浏览器本地存储不可用，当前修改不会被保存。');
      return;
    }

    const result = loadFrom(storage);
    if (result.status === 'ok') {
      setPersistIssue(null);
      apply({ status: 'ready', data: result.data });
      return;
    }
    if (result.status === 'empty') {
      const data = createInitialData();
      const write = saveTo(storage, data);
      if (!write.ok) setPersistIssue(write.message);
      else setPersistIssue(null);
      apply({ status: 'ready', data });
      return;
    }
    if (result.status === 'unavailable') {
      apply({ status: 'ready', data: createInitialData() });
      setPersistIssue('浏览器本地存储不可用，当前修改不会被保存。');
      return;
    }
    if (result.status === 'incompatible') {
      apply({
        status: 'error',
        kind: 'incompatible',
        raw: result.raw,
        version: result.version,
      });
      return;
    }
    apply({ status: 'error', kind: 'corrupt', raw: result.raw });
  }, [apply]);

  useEffect(() => {
    load();
  }, [load]);

  const commit = useCallback(
    (next: AppData): { ok: true } | OperationFailure => {
      const storage = getLocalStorage();
      const write = saveTo(storage, next);
      if (!write.ok) {
        setPersistIssue(write.message);
        return fail('storage', write.message);
      }
      setPersistIssue(null);
      apply({ status: 'ready', data: next });
      return { ok: true };
    },
    [apply],
  );

  const readLatestForWrite = useCallback(():
    | { ok: true; data: AppData }
    | { ok: false; failure: OperationFailure } => {
    const current = stateRef.current.status === 'ready' ? stateRef.current.data : null;
    const storage = getLocalStorage();
    if (!storage) {
      return {
        ok: false,
        failure: fail('storage', '无法访问浏览器本地存储，修改不会被保存。'),
      };
    }
    const result = loadFrom(storage);
    if (result.status === 'ok') return { ok: true, data: result.data };
    if (result.status === 'empty' && current) return { ok: true, data: current };
    if (result.status === 'unavailable') {
      return {
        ok: false,
        failure: fail('storage', '无法访问浏览器本地存储，修改不会被保存。'),
      };
    }
    return {
      ok: false,
      failure: fail('data', '本地数据已损坏或版本不兼容，为避免覆盖，修改未保存。'),
    };
  }, []);

  const saveTask = useCallback(
    (draft: TaskDraft, base?: TaskBase): SaveTaskResult => {
      const latestResult = readLatestForWrite();
      if (!latestResult.ok) return latestResult.failure;
      const latest = latestResult.data;

      if (!latest.lists.some((list) => list.id === draft.listId)) {
        apply({ status: 'ready', data: latest });
        return fail('conflict-list', '所属清单已被删除，请重新选择清单。');
      }

      const now = Date.now();
      if (base) {
        const existing = latest.tasks.find((task) => task.id === base.id);
        if (!existing) {
          apply({ status: 'ready', data: latest });
          return fail('conflict-deleted', '该任务已在其他页面被删除。');
        }
        if (existing.revision !== base.revision) {
          apply({ status: 'ready', data: latest });
          return fail(
            'conflict-changed',
            '该任务已在其他页面被修改，请重新载入最新记录后再编辑。',
          );
        }
        const updated: Task = {
          ...existing,
          title: draft.title,
          description: draft.description,
          priority: draft.priority,
          dueDate: draft.dueDate,
          listId: draft.listId,
          updatedAt: Math.max(now, existing.updatedAt + 1),
          revision: existing.revision + 1,
        };
        const next: AppData = {
          ...latest,
          tasks: latest.tasks.map((task) => (task.id === updated.id ? updated : task)),
        };
        const written = commit(next);
        if (!written.ok) return written;
        return { ok: true, task: updated, data: next };
      }

      const task: Task = {
        id: newId('task_'),
        title: draft.title,
        description: draft.description,
        status: 'open',
        priority: draft.priority,
        dueDate: draft.dueDate,
        listId: draft.listId,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        revision: 1,
      };
      const next: AppData = { ...latest, tasks: [...latest.tasks, task] };
      const written = commit(next);
      if (!written.ok) return written;
      return { ok: true, task, data: next };
    },
    [apply, commit, readLatestForWrite],
  );

  const toggleTask = useCallback(
    (id: string): SimpleResult => {
      const latestResult = readLatestForWrite();
      if (!latestResult.ok) return latestResult.failure;
      const latest = latestResult.data;
      const existing = latest.tasks.find((task) => task.id === id);
      if (!existing) {
        apply({ status: 'ready', data: latest });
        return fail('not-found', '任务已不存在，列表已刷新。');
      }
      const now = Date.now();
      const updated: Task = {
        ...existing,
        status: existing.status === 'open' ? 'done' : 'open',
        completedAt: existing.status === 'open' ? now : null,
        updatedAt: Math.max(now, existing.updatedAt + 1),
        revision: existing.revision + 1,
      };
      return commit({
        ...latest,
        tasks: latest.tasks.map((task) => (task.id === id ? updated : task)),
      });
    },
    [apply, commit, readLatestForWrite],
  );

  const deleteTask = useCallback(
    (id: string): SimpleResult => {
      const latestResult = readLatestForWrite();
      if (!latestResult.ok) return latestResult.failure;
      const latest = latestResult.data;
      if (!latest.tasks.some((task) => task.id === id)) {
        apply({ status: 'ready', data: latest });
        return fail('not-found', '任务已不存在，列表已刷新。');
      }
      return commit({ ...latest, tasks: latest.tasks.filter((task) => task.id !== id) });
    },
    [apply, commit, readLatestForWrite],
  );

  const createList = useCallback(
    (rawName: string): ListResult => {
      const latestResult = readLatestForWrite();
      if (!latestResult.ok) return latestResult.failure;
      const latest = latestResult.data;
      const validation = validateListName(rawName, latest.lists);
      if (!validation.ok) return fail('validation', validation.error);
      const list: TaskList = {
        id: newId('list_'),
        name: validation.value,
        system: false,
        createdAt: Date.now(),
        revision: 1,
      };
      const written = commit({ ...latest, lists: [...latest.lists, list] });
      if (!written.ok) return written;
      return { ok: true, list };
    },
    [commit, readLatestForWrite],
  );

  const renameList = useCallback(
    (id: string, rawName: string): ListResult => {
      const latestResult = readLatestForWrite();
      if (!latestResult.ok) return latestResult.failure;
      const latest = latestResult.data;
      const existing = latest.lists.find((list) => list.id === id);
      if (!existing) {
        apply({ status: 'ready', data: latest });
        return fail('not-found', '清单已不存在，列表已刷新。');
      }
      if (existing.system) return fail('validation', '系统清单不可重命名。');
      const validation = validateListName(rawName, latest.lists, id);
      if (!validation.ok) return fail('validation', validation.error);
      const updated: TaskList = {
        ...existing,
        name: validation.value,
        revision: existing.revision + 1,
      };
      const written = commit({
        ...latest,
        lists: latest.lists.map((list) => (list.id === id ? updated : list)),
      });
      if (!written.ok) return written;
      return { ok: true, list: updated };
    },
    [apply, commit, readLatestForWrite],
  );

  const deleteList = useCallback(
    (id: string): DeleteListResult => {
      const latestResult = readLatestForWrite();
      if (!latestResult.ok) return latestResult.failure;
      const latest = latestResult.data;
      const existing = latest.lists.find((list) => list.id === id);
      if (!existing) {
        apply({ status: 'ready', data: latest });
        return fail('not-found', '清单已不存在，列表已刷新。');
      }
      if (existing.system) return fail('validation', '系统清单不可删除。');
      if (!latest.lists.some((list) => list.id === INBOX_ID)) {
        return fail('data', '本地数据缺少收集箱，无法移动任务。');
      }
      const now = Date.now();
      const affected = latest.tasks.filter((task) => task.listId === id).length;
      const tasks = latest.tasks.map((task) =>
        task.listId === id
          ? {
              ...task,
              listId: INBOX_ID,
              updatedAt: Math.max(now, task.updatedAt + 1),
              revision: task.revision + 1,
            }
          : task,
      );
      const written = commit({
        ...latest,
        tasks,
        lists: latest.lists.filter((list) => list.id !== id),
      });
      if (!written.ok) return written;
      return { ok: true, affected };
    },
    [apply, commit, readLatestForWrite],
  );

  const resetData = useCallback((): SimpleResult => {
    const storage = getLocalStorage();
    const data = createInitialData();
    const write = saveTo(storage, data);
    if (!write.ok) {
      setPersistIssue(write.message);
      return fail('storage', write.message);
    }
    setPersistIssue(null);
    apply({ status: 'ready', data });
    return { ok: true };
  }, [apply]);

  const retryStorage = useCallback((): boolean => {
    const storage = getLocalStorage();
    const current = stateRef.current.status === 'ready' ? stateRef.current.data : null;
    if (!storage || !current) {
      setPersistIssue('浏览器本地存储不可用，当前修改不会被保存。');
      return false;
    }
    const write = saveTo(storage, current);
    if (!write.ok) {
      setPersistIssue(write.message);
      return false;
    }
    setPersistIssue(null);
    return true;
  }, []);

  const refreshFromStorage = useCallback(() => {
    const storage = getLocalStorage();
    if (!storage) return;
    const result = loadFrom(storage);
    if (result.status === 'ok') {
      const current = stateRef.current;
      if (current.status !== 'ready') return;
      if (JSON.stringify(current.data) !== JSON.stringify(result.data)) {
        apply({ status: 'ready', data: result.data });
      }
      setExternalNotice(null);
      return;
    }
    if (result.status === 'corrupt' || result.status === 'incompatible') {
      setExternalNotice('其他页面写入的数据无法读取，当前页面未覆盖该数据。');
    }
  }, [apply]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_KEY) refreshFromStorage();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshFromStorage]);

  return useMemo(
    () => ({
      state,
      persistIssue,
      externalNotice,
      clearExternalNotice: () => setExternalNotice(null),
      retryLoad: load,
      retryStorage,
      resetData,
      saveTask,
      toggleTask,
      deleteTask,
      createList,
      renameList,
      deleteList,
    }),
    [
      state,
      persistIssue,
      externalNotice,
      load,
      retryStorage,
      resetData,
      saveTask,
      toggleTask,
      deleteTask,
      createList,
      renameList,
      deleteList,
    ],
  );
}

export type TodoStore = ReturnType<typeof useTodoStore>;
