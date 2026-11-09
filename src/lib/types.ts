export type Priority = 'high' | 'medium' | 'low';
export type PriorityFilter = 'all' | Priority;
export type TaskStatus = 'open' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  listId: string;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  revision: number;
}

export interface TaskList {
  id: string;
  name: string;
  system: boolean;
  createdAt: number;
  revision: number;
}

export interface AppData {
  version: 1;
  tasks: Task[];
  lists: TaskList[];
}

export type ViewKind = 'today' | 'next7' | 'all' | 'completed' | 'list';

export interface View {
  kind: ViewKind;
  listId?: string;
}

export type Tab = 'open' | 'done';

export interface Filters {
  query: string;
  priority: PriorityFilter;
}

export interface TaskDraft {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string | null;
  listId: string;
}

export const DATA_VERSION = 1 as const;
export const INBOX_ID = 'inbox';
export const INBOX_NAME = '收集箱';

export const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low'];

export function isPriority(value: unknown): value is Priority {
  return value === 'high' || value === 'medium' || value === 'low';
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return value === 'open' || value === 'done';
}
