import { describe, expect, it } from 'vitest';
import {
  createInitialData,
  loadFrom,
  parseStoredData,
  saveTo,
  STORAGE_KEY,
} from '../../src/lib/storage';
import type { AppData, Task } from '../../src/lib/types';

class FakeStorage implements Storage {
  private values = new Map<string, string>();
  failWrites: Error | null = null;
  failReads = false;

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    if (this.failReads) throw new Error('denied');
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw this.failWrites;
    this.values.set(key, value);
  }

  raw(key = STORAGE_KEY): string | null {
    return this.values.get(key) ?? null;
  }
}

function sampleData(): AppData {
  const base = createInitialData(1000);
  const task: Task = {
    id: 'task_1',
    title: '买牛奶',
    description: '低脂',
    status: 'open',
    priority: 'high',
    dueDate: '2026-11-09',
    listId: 'inbox',
    createdAt: 1000,
    updatedAt: 1000,
    completedAt: null,
    revision: 1,
  };
  return { ...base, tasks: [task] };
}

describe('storage load', () => {
  it('creates an inbox-only initial data set', () => {
    const data = createInitialData(42);
    expect(data).toEqual({
      version: 1,
      tasks: [],
      lists: [{ id: 'inbox', name: '收集箱', system: true, createdAt: 42, revision: 1 }],
    });
  });

  it('reports empty storage without writing anything', () => {
    const storage = new FakeStorage();
    expect(loadFrom(storage)).toEqual({ status: 'empty' });
    expect(storage.raw()).toBeNull();
  });

  it('round-trips valid data', () => {
    const storage = new FakeStorage();
    const data = sampleData();
    expect(saveTo(storage, data).ok).toBe(true);
    expect(loadFrom(storage)).toEqual({ status: 'ok', data });
  });

  it('detects malformed JSON and preserves the raw value', () => {
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, '{"version":1,"tasks":[');
    const result = loadFrom(storage);
    expect(result.status).toBe('corrupt');
    if (result.status === 'corrupt') expect(result.raw).toBe('{"version":1,"tasks":[');
    expect(storage.raw()).toBe('{"version":1,"tasks":[');
  });

  it('detects incompatible versions without rewriting them', () => {
    const storage = new FakeStorage();
    const raw = JSON.stringify({ version: 99, tasks: [], lists: [] });
    storage.setItem(STORAGE_KEY, raw);
    const result = loadFrom(storage);
    expect(result.status).toBe('incompatible');
    if (result.status === 'incompatible') {
      expect(result.version).toBe(99);
      expect(result.raw).toBe(raw);
    }
    expect(storage.raw()).toBe(raw);
  });

  it('rejects structurally invalid data', () => {
    const valid = sampleData();
    const cases: unknown[] = [
      { version: 1, tasks: [], lists: [] },
      { version: 1, tasks: [], lists: [{ ...valid.lists[0], id: 'other' }] },
      { ...valid, tasks: [{ ...valid.tasks[0], listId: 'missing' }] },
      { ...valid, tasks: [{ ...valid.tasks[0], status: 'done', completedAt: null }] },
      { ...valid, tasks: [{ ...valid.tasks[0], status: 'open', completedAt: 1 }] },
      { ...valid, tasks: [valid.tasks[0], { ...valid.tasks[0] }] },
      { ...valid, tasks: [{ ...valid.tasks[0], dueDate: '2026-02-30' }] },
      { ...valid, tasks: [{ ...valid.tasks[0], revision: 0 }] },
      { ...valid, tasks: [{ ...valid.tasks[0], title: '   ' }] },
      { ...valid, lists: [...valid.lists, { ...valid.lists[0], id: 'list_2', system: true }] },
    ];
    for (const value of cases) {
      const parsed = parseStoredData(JSON.stringify(value));
      expect(parsed.ok).toBe(false);
    }
  });

  it('reports unavailable storage and read failures', () => {
    expect(loadFrom(null).status).toBe('unavailable');
    const storage = new FakeStorage();
    storage.failReads = true;
    expect(loadFrom(storage).status).toBe('unavailable');
  });
});

describe('storage write', () => {
  it('reports unavailable storage', () => {
    const result = saveTo(null, sampleData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('无法访问');
  });

  it('reports quota failures distinctly', () => {
    const storage = new FakeStorage();
    storage.failWrites = new DOMException('quota', 'QuotaExceededError');
    const result = saveTo(storage, sampleData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('空间不足');
  });

  it('reports generic write failures', () => {
    const storage = new FakeStorage();
    storage.failWrites = new Error('boom');
    const result = saveTo(storage, sampleData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('保存失败');
  });

  it('leaves the previous value in place when a write fails', () => {
    const storage = new FakeStorage();
    const original = sampleData();
    expect(saveTo(storage, original).ok).toBe(true);
    const before = storage.raw();
    storage.failWrites = new DOMException('quota', 'QuotaExceededError');
    expect(saveTo(storage, createInitialData(2000)).ok).toBe(false);
    expect(storage.raw()).toBe(before);
  });
});
