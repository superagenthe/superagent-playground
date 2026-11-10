import { isValidISODate } from './date';
import { comparisonKey, graphemeLength, normalizeListName, normalizeTitle } from './text';
import {
  INBOX_NAME,
  isPriority,
  type TaskDraft,
  type TaskList,
} from './types';

export interface TaskDraftErrors {
  title?: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  listId?: string;
}

export type TaskValidation =
  | { ok: true; value: TaskDraft }
  | { ok: false; errors: TaskDraftErrors };

export function validateTaskDraft(draft: TaskDraft, lists: TaskList[]): TaskValidation {
  const errors: TaskDraftErrors = {};
  const title = normalizeTitle(draft.title);
  const titleLength = graphemeLength(title);
  if (titleLength === 0) {
    errors.title = '请输入任务标题';
  } else if (titleLength > 200) {
    errors.title = `标题不能超过 200 个字符（当前 ${titleLength} 个）`;
  }

  const descriptionLength = graphemeLength(draft.description);
  if (descriptionLength > 5000) {
    errors.description = `备注不能超过 5,000 个字符（当前 ${descriptionLength} 个）`;
  }

  if (!isPriority(draft.priority)) {
    errors.priority = '请选择优先级';
  }

  if (draft.dueDate !== null && !isValidISODate(draft.dueDate)) {
    errors.dueDate = '请选择有效的日期';
  }

  if (!lists.some((list) => list.id === draft.listId)) {
    errors.listId = '所属清单不存在，请重新选择';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      title,
      description: draft.description,
      priority: draft.priority,
      dueDate: draft.dueDate,
      listId: draft.listId,
    },
  };
}

export type ListNameValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validateListName(
  rawName: string,
  lists: TaskList[],
  currentListId?: string,
): ListNameValidation {
  const name = normalizeListName(rawName);
  const length = graphemeLength(name);
  if (length === 0) {
    return { ok: false, error: '请输入清单名称' };
  }
  if (length > 30) {
    return { ok: false, error: `清单名称不能超过 30 个字符（当前 ${length} 个）` };
  }
  const key = comparisonKey(name);
  if (key === comparisonKey(INBOX_NAME)) {
    return { ok: false, error: '清单名称不能与“收集箱”重名' };
  }
  const duplicate = lists.some(
    (list) => list.id !== currentListId && comparisonKey(list.name) === key,
  );
  if (duplicate) {
    return { ok: false, error: '已存在同名清单' };
  }
  return { ok: true, value: name };
}
