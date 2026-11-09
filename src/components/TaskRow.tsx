import { memo } from 'react';
import { formatDueDate } from '../lib/date';
import { isOverdue, priorityLabel } from '../lib/tasks';
import type { Task } from '../lib/types';
import { IconCheck } from './Icons';

interface TaskRowProps {
  task: Task;
  today: string;
  listLabel: string;
  showList: boolean;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}

export const TaskRow = memo(function TaskRow({
  task,
  today,
  listLabel,
  showList,
  onToggle,
  onOpen,
}: TaskRowProps) {
  const done = task.status === 'done';
  const overdue = isOverdue(task, today);

  return (
    <li className={`task-row${done ? ' is-done' : ''}`}>
      <button
        type="button"
        className={`task-check${done ? ' is-done' : ''}`}
        aria-label={`${done ? '重新打开任务' : '完成任务'}：${task.title}`}
        aria-pressed={done}
        onClick={() => onToggle(task)}
      >
        <span className="check-box">{done ? <IconCheck size={15} /> : null}</span>
      </button>

      <div className="task-main">
        <button type="button" className="task-title" onClick={() => onOpen(task)}>
          {task.title}
        </button>
        <div className="task-meta">
          {task.dueDate ? (
            <span className={`chip chip-date${overdue ? ' is-overdue' : ''}`}>
              {overdue ? '已逾期 · ' : ''}
              {formatDueDate(task.dueDate, today)}
            </span>
          ) : null}
          <span className={`chip chip-priority priority-${task.priority}`}>
            {priorityLabel(task.priority)}
          </span>
          {showList ? <span className="chip chip-list">{listLabel}</span> : null}
        </div>
      </div>
    </li>
  );
});
