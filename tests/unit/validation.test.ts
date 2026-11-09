import { describe, expect, it } from 'vitest';
import { createInitialData } from '../../src/lib/storage';
import type { TaskDraft } from '../../src/lib/types';
import { validateListName, validateTaskDraft } from '../../src/lib/validation';

const lists = createInitialData(1).lists;

function draft(partial: Partial<TaskDraft> = {}): TaskDraft {
  return {
    title: '买牛奶',
    description: '',
    priority: 'medium',
    dueDate: null,
    listId: 'inbox',
    ...partial,
  };
}

describe('task validation', () => {
  it('requires a non-blank title', () => {
    expect(validateTaskDraft(draft({ title: '' }), lists).ok).toBe(false);
    expect(validateTaskDraft(draft({ title: '   \n ' }), lists).ok).toBe(false);
  });

  it('counts 200 visible characters and rejects 201', () => {
    const title200 = '😀'.repeat(200);
    const result = validateTaskDraft(draft({ title: title200 }), lists);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title).toBe(title200);

    const result201 = validateTaskDraft(draft({ title: '😀'.repeat(201) }), lists);
    expect(result201.ok).toBe(false);
    if (!result201.ok) expect(result201.errors.title).toContain('200');
  });

  it('trims and joins line breaks in titles', () => {
    const result = validateTaskDraft(draft({ title: '  第一行\n第二行  ' }), lists);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title).toBe('第一行 第二行');
  });

  it('limits descriptions to 5,000 visible characters', () => {
    expect(validateTaskDraft(draft({ description: '字'.repeat(5000) }), lists).ok).toBe(true);
    const tooLong = validateTaskDraft(draft({ description: '字'.repeat(5001) }), lists);
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.errors.description).toContain('5,000');
  });

  it('validates dates and list references', () => {
    const badDate = validateTaskDraft(draft({ dueDate: '2026-02-30' }), lists);
    expect(badDate.ok).toBe(false);
    if (!badDate.ok) expect(badDate.errors.dueDate).toBeTruthy();

    const badList = validateTaskDraft(draft({ listId: 'missing' }), lists);
    expect(badList.ok).toBe(false);
    if (!badList.ok) expect(badList.errors.listId).toBeTruthy();
  });

  it('allows past dates and medium defaults', () => {
    const result = validateTaskDraft(draft({ dueDate: '2020-01-01' }), lists);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.priority).toBe('medium');
  });
});

describe('list name validation', () => {
  const custom = { id: 'list_1', name: '工作', system: false, createdAt: 1, revision: 1 };
  const english = { id: 'list_2', name: 'Work', system: false, createdAt: 2, revision: 1 };

  it('requires 1-30 visible characters', () => {
    expect(validateListName('', lists).ok).toBe(false);
    expect(validateListName('   ', lists).ok).toBe(false);
    expect(validateListName('清'.repeat(30), lists).ok).toBe(true);
    expect(validateListName('清'.repeat(31), lists).ok).toBe(false);
  });

  it('reserves 收集箱 and detects duplicate names case-insensitively', () => {
    expect(validateListName('收集箱', lists).ok).toBe(false);
    expect(validateListName(' 收集箱 ', lists).ok).toBe(false);
    expect(validateListName('Study', [...lists, custom, english]).ok).toBe(true);
    expect(validateListName('work', [...lists, custom, english]).ok).toBe(false);
    expect(validateListName('WORK', [...lists, custom, english]).ok).toBe(false);
  });

  it('allows a list to keep its current name and preserves internal spaces', () => {
    expect(validateListName('工作', [...lists, custom], custom.id).ok).toBe(true);
    expect(validateListName('工作', [...lists, custom]).ok).toBe(false);
    expect(validateListName('工 作', [...lists, custom]).ok).toBe(true);
  });
});
