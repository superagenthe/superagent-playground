import { describe, expect, it } from 'vitest';
import {
  buildView,
  compareBaseTasks,
  compareCompletedTasks,
  EMPTY_FILTERS,
  isOverdue,
  isTaskInViewScope,
  navCounts,
  taskMatchesFilters,
  viewTitle,
  viewsEqual,
} from '../../src/lib/tasks';
import type { Task } from '../../src/lib/types';
import { makeData, makeList, makeTask } from './helpers';

const TODAY = '2026-11-09';

function task(partial: Partial<Task>): Task {
  return makeTask(partial);
}

describe('task sorting', () => {
  it('sorts dated tasks first, then due date, priority, creation and id', () => {
    const tasks = [
      task({ id: 't1', dueDate: '2026-11-10', priority: 'high', createdAt: 3 }),
      task({ id: 't2', dueDate: '2026-11-10', priority: 'high', createdAt: 2 }),
      task({ id: 't3', dueDate: '2026-11-09', priority: 'low', createdAt: 1 }),
      task({ id: 't4', priority: 'high', createdAt: 1 }),
      task({ id: 't5', priority: 'high', createdAt: 2 }),
      task({ id: 't6', priority: 'medium', createdAt: 9 }),
    ];
    expect([...tasks].sort(compareBaseTasks).map((item) => item.id)).toEqual([
      't3',
      't1',
      't2',
      't5',
      't4',
      't6',
    ]);
  });

  it('uses the unique id as the final stable tie-breaker', () => {
    const a = task({ id: 'a', priority: 'medium', createdAt: 1 });
    const b = task({ id: 'b', priority: 'medium', createdAt: 1 });
    expect([b, a].sort(compareBaseTasks).map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('sorts completed tasks by completion time, then creation time', () => {
    const a = task({ id: 'a', status: 'done', completedAt: 100, createdAt: 1 });
    const b = task({ id: 'b', status: 'done', completedAt: 200, createdAt: 1 });
    const c = task({ id: 'c', status: 'done', completedAt: 200, createdAt: 2 });
    expect([a, b, c].sort(compareCompletedTasks).map((item) => item.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });
});

describe('views', () => {
  const work = makeList({ id: 'work', name: '工作', createdAt: 10 });
  const data = makeData(
    [
      task({ id: 'overdue', dueDate: '2026-11-08', priority: 'high' }),
      task({ id: 'today', dueDate: TODAY }),
      task({ id: 'tomorrow', dueDate: '2026-11-10' }),
      task({ id: 'day7', dueDate: '2026-11-16' }),
      task({ id: 'day8', dueDate: '2026-11-17' }),
      task({ id: 'no-date' }),
      task({ id: 'done', status: 'done', dueDate: '2026-11-08', completedAt: 5, createdAt: 5 }),
      task({ id: 'work-open', listId: 'work' }),
      task({ id: 'work-done', listId: 'work', status: 'done', completedAt: 6, createdAt: 6 }),
    ],
    [work],
  );

  it('shows overdue and today in separate groups and hides empty groups', () => {
    const result = buildView(data, { kind: 'today' }, 'open', TODAY, EMPTY_FILTERS);
    expect(result.tasks.map((item) => item.id).sort()).toEqual(['overdue', 'today']);
    expect(result.groups?.map((group) => group.key)).toEqual(['overdue', 'today']);
    expect(result.groups?.map((group) => group.tasks.length)).toEqual([1, 1]);
  });

  it('includes tomorrow through day 7, excluding day 8 and undated tasks', () => {
    const result = buildView(data, { kind: 'next7' }, 'open', TODAY, EMPTY_FILTERS);
    expect(result.tasks.map((item) => item.id).sort()).toEqual(['day7', 'tomorrow']);
    expect(result.groups?.map((group) => group.key)).toEqual(['2026-11-10', '2026-11-16']);
  });

  it('shows all open tasks in the all view and only completed in completed', () => {
    const all = buildView(data, { kind: 'all' }, 'open', TODAY, EMPTY_FILTERS);
    expect(all.tasks.map((item) => item.id)).not.toContain('done');
    expect(all.tasks.map((item) => item.id)).not.toContain('work-done');
    expect(all.tasks).toHaveLength(7);

    const completed = buildView(data, { kind: 'completed' }, 'open', TODAY, EMPTY_FILTERS);
    expect(completed.tasks.map((item) => item.id).sort()).toEqual(['done', 'work-done']);
  });

  it('switches list tabs and preserves list membership', () => {
    const open = buildView(
      data,
      { kind: 'list', listId: 'work' },
      'open',
      TODAY,
      EMPTY_FILTERS,
    );
    expect(open.tasks.map((item) => item.id)).toEqual(['work-open']);

    const done = buildView(
      data,
      { kind: 'list', listId: 'work' },
      'done',
      TODAY,
      EMPTY_FILTERS,
    );
    expect(done.tasks.map((item) => item.id)).toEqual(['work-done']);
  });

  it('counts navigation numbers from unfiltered data', () => {
    const counts = navCounts(data, TODAY);
    expect(counts.today).toBe(2);
    expect(counts.next7).toBe(2);
    expect(counts.all).toBe(7);
    expect(counts.completed).toBe(2);
    expect(counts.byList.inbox).toBe(6);
    expect(counts.byList.work).toBe(1);
  });

  it('identifies overdue only for open tasks', () => {
    const open = task({ dueDate: '2026-11-08' });
    const done = task({ status: 'done', dueDate: '2026-11-08', completedAt: 1 });
    expect(isOverdue(open, TODAY)).toBe(true);
    expect(isOverdue(done, TODAY)).toBe(false);
    expect(isOverdue(task({ dueDate: TODAY }), TODAY)).toBe(false);
  });

  it('checks view scope for save feedback', () => {
    expect(isTaskInViewScope(task({ dueDate: TODAY }), { kind: 'today' }, 'open', TODAY)).toBe(
      true,
    );
    expect(
      isTaskInViewScope(task({ dueDate: '2026-11-10' }), { kind: 'today' }, 'open', TODAY),
    ).toBe(false);
    expect(
      isTaskInViewScope(task({ dueDate: '2026-11-10' }), { kind: 'next7' }, 'open', TODAY),
    ).toBe(true);
    expect(
      isTaskInViewScope(task({ dueDate: '2026-11-10' }), { kind: 'list', listId: 'inbox' }, 'open', TODAY),
    ).toBe(true);
  });

  it('exposes view titles and equality', () => {
    expect(viewTitle(data, { kind: 'today' })).toBe('今日');
    expect(viewTitle(data, { kind: 'list', listId: 'work' })).toBe('工作');
    expect(viewsEqual({ kind: 'today' }, { kind: 'today' })).toBe(true);
    expect(
      viewsEqual({ kind: 'list', listId: 'a' }, { kind: 'list', listId: 'b' }),
    ).toBe(false);
  });
});

describe('search and priority filters', () => {
  const tasks = [
    task({ id: 'a', title: 'Weekly Meeting notes', description: '准备材料', dueDate: '2026-11-10' }),
    task({ id: 'b', title: '写周报', description: 'Weekly MEETING 总结', dueDate: '2026-11-09' }),
    task({ id: 'c', title: '买牛奶', priority: 'high' }),
  ];

  it('matches title or description case-insensitively after trimming', () => {
    expect(taskMatchesFilters(tasks[0], { query: '  meeting ', priority: 'all' })).toBe(true);
    expect(taskMatchesFilters(tasks[1], { query: 'meeting', priority: 'all' })).toBe(true);
    expect(taskMatchesFilters(tasks[2], { query: 'meeting', priority: 'all' })).toBe(false);
  });

  it('requires both search and priority to match', () => {
    expect(taskMatchesFilters(tasks[2], { query: '牛奶', priority: 'high' })).toBe(true);
    expect(taskMatchesFilters(tasks[2], { query: '牛奶', priority: 'low' })).toBe(false);
  });

  it('filters without changing view sorting', () => {
    const data = makeData(tasks);
    const result = buildView(
      data,
      { kind: 'all' },
      'open',
      TODAY,
      { query: 'weekly', priority: 'all' },
    );
    expect(result.tasks.map((item) => item.id)).toEqual(['b', 'a']);
  });
});
