import type { AppData, Task, TaskList } from '../../src/lib/types';
import { createInitialData } from '../../src/lib/storage';

let sequence = 0;

export function makeList(partial: Partial<TaskList> = {}): TaskList {
  sequence += 1;
  return {
    id: `list_${sequence}`,
    name: `清单 ${sequence}`,
    system: false,
    createdAt: 1_700_000_000_000 + sequence,
    revision: 1,
    ...partial,
  };
}

export function makeTask(partial: Partial<Task> = {}): Task {
  sequence += 1;
  return {
    id: `task_${sequence}`,
    title: `任务 ${sequence}`,
    description: '',
    status: 'open',
    priority: 'medium',
    dueDate: null,
    listId: 'inbox',
    createdAt: 1_700_000_000_000 + sequence,
    updatedAt: 1_700_000_000_000 + sequence,
    completedAt: null,
    revision: 1,
    ...partial,
  };
}

export function makeData(tasks: Task[] = [], extraLists: TaskList[] = []): AppData {
  const base = createInitialData(1_700_000_000_000);
  return {
    ...base,
    lists: [...base.lists, ...extraLists],
    tasks,
  };
}

export function resetSequence() {
  sequence = 0;
}
