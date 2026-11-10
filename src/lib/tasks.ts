import { addDaysISO, formatGroupDate } from './date';
import {
  INBOX_ID,
  type AppData,
  type Filters,
  type Priority,
  type Tab,
  type Task,
  type View,
} from './types';

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export interface ViewGroup {
  key: string;
  label: string;
  tasks: Task[];
}

export interface ViewResult {
  tasks: Task[];
  groups: ViewGroup[] | null;
}

export const EMPTY_FILTERS: Filters = { query: '', priority: 'all' };

export function isFilterActive(filters: Filters): boolean {
  return filters.query.trim().length > 0 || filters.priority !== 'all';
}

export function isOverdue(task: Task, today: string): boolean {
  return task.status === 'open' && task.dueDate !== null && task.dueDate < today;
}

export function compareBaseTasks(a: Task, b: Task): number {
  if (a.dueDate && b.dueDate) {
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  } else if (a.dueDate) {
    return -1;
  } else if (b.dueDate) {
    return 1;
  }

  const priorityDelta = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (priorityDelta !== 0) return priorityDelta;

  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return a.id.localeCompare(b.id);
}

export function compareCompletedTasks(a: Task, b: Task): number {
  const aCompleted = a.completedAt ?? 0;
  const bCompleted = b.completedAt ?? 0;
  if (aCompleted !== bCompleted) return bCompleted - aCompleted;
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return a.id.localeCompare(b.id);
}

export function taskMatchesFilters(task: Task, filters: Filters): boolean {
  if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
  const query = filters.query.trim().toLocaleLowerCase('en-US');
  if (!query) return true;
  return (
    task.title.toLocaleLowerCase('en-US').includes(query) ||
    task.description.toLocaleLowerCase('en-US').includes(query)
  );
}

export function isTaskInViewScope(
  task: Task,
  view: View,
  tab: Tab,
  today: string,
): boolean {
  if (view.kind === 'completed') return task.status === 'done';

  const statusMatches =
    view.kind === 'list'
      ? tab === 'open'
        ? task.status === 'open'
        : task.status === 'done'
      : task.status === 'open';
  if (!statusMatches) return false;

  if (view.kind === 'today') {
    return task.dueDate !== null && task.dueDate <= today;
  }
  if (view.kind === 'next7') {
    return (
      task.dueDate !== null &&
      task.dueDate > today &&
      task.dueDate <= addDaysISO(today, 7)
    );
  }
  if (view.kind === 'list') {
    return task.listId === view.listId;
  }
  return true;
}

export function selectViewTasks(
  data: AppData,
  view: View,
  tab: Tab,
  today: string,
): Task[] {
  const comparator = view.kind === 'completed' ? compareCompletedTasks : compareBaseTasks;
  return data.tasks.filter((task) => isTaskInViewScope(task, view, tab, today)).sort(comparator);
}

export function buildView(
  data: AppData,
  view: View,
  tab: Tab,
  today: string,
  filters: Filters,
): ViewResult {
  const scoped = selectViewTasks(data, view, tab, today);
  const tasks = scoped.filter((task) => taskMatchesFilters(task, filters));

  if (view.kind === 'today') {
    const overdue = tasks.filter((task) => task.dueDate !== null && task.dueDate < today);
    const dueToday = tasks.filter((task) => task.dueDate === today);
    const groups: ViewGroup[] = [];
    if (overdue.length > 0) groups.push({ key: 'overdue', label: '已逾期', tasks: overdue });
    if (dueToday.length > 0) groups.push({ key: 'today', label: '今天', tasks: dueToday });
    return { tasks, groups };
  }

  if (view.kind === 'next7') {
    const byDate = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const group = byDate.get(task.dueDate);
      if (group) group.push(task);
      else byDate.set(task.dueDate, [task]);
    }
    const groups: ViewGroup[] = [...byDate.keys()].sort().map((date) => ({
      key: date,
      label: formatGroupDate(date, today),
      tasks: byDate.get(date) ?? [],
    }));
    return { tasks, groups };
  }

  return { tasks, groups: null };
}

export interface NavCounts {
  today: number;
  next7: number;
  all: number;
  completed: number;
  byList: Record<string, number>;
}

export function navCounts(data: AppData, today: string): NavCounts {
  const counts: NavCounts = {
    today: 0,
    next7: 0,
    all: 0,
    completed: 0,
    byList: {},
  };
  const end = addDaysISO(today, 7);
  for (const task of data.tasks) {
    if (task.status === 'done') {
      counts.completed += 1;
      continue;
    }
    counts.all += 1;
    counts.byList[task.listId] = (counts.byList[task.listId] ?? 0) + 1;
    if (task.dueDate !== null) {
      if (task.dueDate <= today) counts.today += 1;
      else if (task.dueDate <= end) counts.next7 += 1;
    }
  }
  return counts;
}

export function listName(data: AppData, listId: string): string {
  return data.lists.find((list) => list.id === listId)?.name ?? '未知清单';
}

export function inboxName(data: AppData): string {
  return data.lists.find((list) => list.id === INBOX_ID)?.name ?? '收集箱';
}

export function viewTitle(data: AppData, view: View): string {
  switch (view.kind) {
    case 'today':
      return '今日';
    case 'next7':
      return '未来 7 天';
    case 'all':
      return '全部待办';
    case 'completed':
      return '已完成';
    case 'list':
      return data.lists.find((list) => list.id === view.listId)?.name ?? '清单';
  }
}

export function viewKey(view: View): string {
  return view.kind === 'list' ? `list:${view.listId ?? ''}` : view.kind;
}

export function viewsEqual(a: View, b: View): boolean {
  return viewKey(a) === viewKey(b);
}

export function priorityLabel(priority: Priority): string {
  return priority === 'high' ? '高优先级' : priority === 'medium' ? '中优先级' : '低优先级';
}
