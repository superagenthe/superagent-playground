import { useId, useMemo, type ReactNode } from 'react';
import type { ViewResult } from '../lib/tasks';
import type { AppData, Task } from '../lib/types';
import { TaskRow } from './TaskRow';

interface TaskListProps {
  result: ViewResult;
  data: AppData;
  today: string;
  showList: boolean;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  empty: ReactNode;
}

export function TaskList({
  result,
  data,
  today,
  showList,
  onToggle,
  onOpen,
  empty,
}: TaskListProps) {
  const prefix = useId();
  const listNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const list of data.lists) names[list.id] = list.name;
    return names;
  }, [data.lists]);

  if (result.tasks.length === 0) return <>{empty}</>;

  const renderTasks = (tasks: Task[]) => (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          today={today}
          listLabel={listNames[task.listId] ?? '未知清单'}
          showList={showList}
          onToggle={onToggle}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );

  if (!result.groups) {
    return <div className="task-list-wrap">{renderTasks(result.tasks)}</div>;
  }

  return (
    <div className="task-groups">
      {result.groups.map((group, index) => {
        const headingId = `${prefix}-group-${index}`;
        return (
          <section className="task-group" key={group.key} aria-labelledby={headingId}>
            <div className="group-head">
              <h2 id={headingId}>{group.label}</h2>
              <span className="group-count">{group.tasks.length} 项</span>
            </div>
            {renderTasks(group.tasks)}
          </section>
        );
      })}
    </div>
  );
}
