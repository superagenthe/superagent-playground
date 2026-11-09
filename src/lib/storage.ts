import { isValidISODate } from './date';
import {
  DATA_VERSION,
  INBOX_ID,
  INBOX_NAME,
  isPriority,
  isTaskStatus,
  type AppData,
  type Task,
  type TaskList,
} from './types';

export const STORAGE_KEY = 'todo.app.v1';

export type LoadResult =
  | { status: 'ok'; data: AppData }
  | { status: 'empty' }
  | { status: 'corrupt'; raw: string }
  | { status: 'incompatible'; raw: string; version: unknown }
  | { status: 'unavailable'; error: unknown };

export interface WriteSuccess {
  ok: true;
}

export interface WriteFailure {
  ok: false;
  message: string;
}

export type WriteResult = WriteSuccess | WriteFailure;

export function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createInitialData(now: number = Date.now()): AppData {
  return {
    version: DATA_VERSION,
    tasks: [],
    lists: [
      {
        id: INBOX_ID,
        name: INBOX_NAME,
        system: true,
        createdAt: now,
        revision: 1,
      },
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function isTask(value: unknown, listIds: Set<string>): value is Task {
  if (!isRecord(value)) return false;
  if (!isNonEmptyString(value.id)) return false;
  if (!isNonEmptyString(value.title)) return false;
  if (typeof value.description !== 'string') return false;
  if (!isTaskStatus(value.status)) return false;
  if (!isPriority(value.priority)) return false;
  if (value.dueDate !== null && !(typeof value.dueDate === 'string' && isValidISODate(value.dueDate))) {
    return false;
  }
  if (!isNonEmptyString(value.listId) || !listIds.has(value.listId)) return false;
  if (!isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt)) return false;
  if (!isRevision(value.revision)) return false;
  if (value.status === 'done') {
    if (!isTimestamp(value.completedAt)) return false;
  } else if (value.completedAt !== null) {
    return false;
  }
  return true;
}

function isTaskList(value: unknown): value is TaskList {
  if (!isRecord(value)) return false;
  if (!isNonEmptyString(value.id)) return false;
  if (!isNonEmptyString(value.name)) return false;
  if (typeof value.system !== 'boolean') return false;
  if (!isTimestamp(value.createdAt)) return false;
  if (!isRevision(value.revision)) return false;
  return true;
}

export function parseStoredData(
  raw: string,
):
  | { ok: true; data: AppData }
  | { ok: false; kind: 'corrupt' }
  | { ok: false; kind: 'incompatible'; version: unknown } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, kind: 'corrupt' };
  }
  if (!isRecord(parsed)) return { ok: false, kind: 'corrupt' };
  if (parsed.version !== DATA_VERSION) {
    return { ok: false, kind: 'incompatible', version: parsed.version };
  }
  if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.lists)) {
    return { ok: false, kind: 'corrupt' };
  }

  const lists: TaskList[] = [];
  const listIds = new Set<string>();
  for (const candidate of parsed.lists) {
    if (!isTaskList(candidate)) return { ok: false, kind: 'corrupt' };
    if (listIds.has(candidate.id)) return { ok: false, kind: 'corrupt' };
    lists.push(candidate);
    listIds.add(candidate.id);
  }

  const inbox = lists.find((list) => list.id === INBOX_ID);
  if (!inbox || !inbox.system) return { ok: false, kind: 'corrupt' };
  if (lists.some((list) => list.id !== INBOX_ID && list.system)) {
    return { ok: false, kind: 'corrupt' };
  }

  const tasks: Task[] = [];
  const taskIds = new Set<string>();
  for (const candidate of parsed.tasks) {
    if (!isTask(candidate, listIds)) return { ok: false, kind: 'corrupt' };
    if (taskIds.has(candidate.id)) return { ok: false, kind: 'corrupt' };
    tasks.push(candidate);
    taskIds.add(candidate.id);
  }

  return { ok: true, data: { version: DATA_VERSION, tasks, lists } };
}

export function loadFrom(storage: Storage | null): LoadResult {
  if (!storage) {
    return { status: 'unavailable', error: new Error('localStorage is unavailable') };
  }
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error) {
    return { status: 'unavailable', error };
  }
  if (raw === null || raw === '') return { status: 'empty' };

  const parsed = parseStoredData(raw);
  if (parsed.ok) return { status: 'ok', data: parsed.data };
  if (parsed.kind === 'incompatible') {
    return { status: 'incompatible', raw, version: parsed.version };
  }
  return { status: 'corrupt', raw };
}

export function saveTo(storage: Storage | null, data: AppData): WriteResult {
  if (!storage) {
    return { ok: false, message: '无法访问浏览器本地存储，修改不会被保存。' };
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (error) {
    const name = isRecord(error) && typeof error.name === 'string' ? error.name : '';
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return { ok: false, message: '浏览器存储空间不足，保存失败，请清理空间后重试。' };
    }
    return { ok: false, message: '保存失败，请重试。' };
  }
}
