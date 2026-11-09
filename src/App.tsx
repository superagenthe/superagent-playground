import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataErrorScreen } from './components/DataErrorScreen';
import { DataNoteDialog } from './components/DataNoteDialog';
import { EmptyState } from './components/EmptyState';
import { ConfirmDialog } from './components/ConfirmDialog';
import {
  IconCalendar,
  IconCheckCircle,
  IconInbox,
  IconLayers,
  IconSearch,
  IconSun,
} from './components/Icons';
import { ListNameDialog } from './components/ListNameDialog';
import { LoadingScreen } from './components/LoadingScreen';
import { Sidebar } from './components/Sidebar';
import { TaskDetail } from './components/TaskDetail';
import { TaskList } from './components/TaskList';
import { Toast } from './components/Toast';
import { Toolbar, ViewTabs } from './components/Toolbar';
import { useToday } from './hooks/useToday';
import { useTodoStore, type TodoStore } from './hooks/useTodoStore';
import { buildView, EMPTY_FILTERS, isFilterActive, isTaskInViewScope, listName, navCounts, viewTitle, viewsEqual } from './lib/tasks';
import {
  INBOX_ID,
  type AppData,
  type Filters,
  type Task,
  type TaskList as TaskListModel,
  type View,
  type Tab,
} from './lib/types';

type DetailState =
  | { mode: 'create'; defaults: { listId: string; dueDate: string | null } }
  | { mode: 'edit'; taskId: string; snapshot: Task };

type ListDialogState =
  | { mode: 'create' }
  | { mode: 'rename'; list: TaskListModel };

type ToastState = { id: number; message: string; kind: 'success' | 'error' };

export default function App() {
  const store = useTodoStore();
  const today = useToday();
  const state = store.state;

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'error') {
    return <DataErrorScreen state={state} onRetry={store.retryLoad} onReset={store.resetData} />;
  }
  return <TodoApp store={store} data={state.data} today={today} />;
}

interface TodoAppProps {
  store: TodoStore;
  data: AppData;
  today: string;
}

function TodoApp({ store, data, today }: TodoAppProps) {
  const [view, setView] = useState<View>({ kind: 'today' });
  const [tab, setTab] = useState<Tab>('open');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [listDialog, setListDialog] = useState<ListDialogState | null>(null);
  const [deleteListTarget, setDeleteListTarget] = useState<TaskListModel | null>(null);
  const [dataNoteOpen, setDataNoteOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), message, kind });
    toastTimer.current = setTimeout(() => setToast(null), kind === 'error' ? 6000 : 3600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!store.externalNotice) return;
    notify(store.externalNotice, 'error');
    store.clearExternalNotice();
  }, [store, notify]);

  const currentListExists =
    view.kind !== 'list' || data.lists.some((list) => list.id === view.listId);
  const safeView: View =
    view.kind === 'list' && !currentListExists ? { kind: 'list', listId: INBOX_ID } : view;

  useEffect(() => {
    if (view.kind === 'list' && !data.lists.some((list) => list.id === view.listId)) {
      setView({ kind: 'list', listId: INBOX_ID });
      setTab('open');
      setFilters(EMPTY_FILTERS);
    }
  }, [data.lists, view]);

  const counts = useMemo(() => navCounts(data, today), [data, today]);
  const result = useMemo(
    () => buildView(data, safeView, tab, today, filters),
    [data, safeView.kind, safeView.listId, tab, today, filters],
  );
  const title = viewTitle(data, safeView);
  const showList = safeView.kind !== 'list';
  const filtersActive = isFilterActive(filters);

  const listOpenCount =
    safeView.kind === 'list'
      ? data.tasks.filter((task) => task.listId === safeView.listId && task.status === 'open')
          .length
      : 0;
  const listDoneCount =
    safeView.kind === 'list'
      ? data.tasks.filter((task) => task.listId === safeView.listId && task.status === 'done')
          .length
      : 0;

  const selectView = (next: View) => {
    const changed = !viewsEqual(safeView, next);
    setView(next);
    setSidebarOpen(false);
    const resetTab = next.kind === 'list' && tab !== 'open';
    if (next.kind === 'list') setTab('open');
    if (changed || resetTab) setFilters(EMPTY_FILTERS);
  };

  const changeTab = (next: Tab) => {
    if (next === tab) return;
    setTab(next);
    setFilters(EMPTY_FILTERS);
  };

  const openCreate = () => {
    const listId =
      safeView.kind === 'list' && safeView.listId ? safeView.listId : INBOX_ID;
    setDetail({
      mode: 'create',
      defaults: { listId, dueDate: safeView.kind === 'today' ? today : null },
    });
  };

  const openEdit = useCallback((task: Task) => {
    setDetail({ mode: 'edit', taskId: task.id, snapshot: task });
  }, []);

  const handleToggle = useCallback(
    (task: Task) => {
      const result = store.toggleTask(task.id);
      if (result.ok) {
        notify(task.status === 'open' ? '任务已完成' : '任务已重新打开');
      } else {
        notify(result.message, 'error');
      }
    },
    [store, notify],
  );

  const handleSaved = (task: Task, mode: 'create' | 'edit') => {
    setDetail(null);
    const visible = isTaskInViewScope(task, safeView, tab, today);
    if (!visible) {
      notify(`已保存到「${listName(data, task.listId)}」，当前视图不显示该任务`);
    } else {
      notify(mode === 'create' ? '任务已创建' : '任务已保存');
    }
  };

  const handleDeleted = (message: string) => {
    setDetail(null);
    notify(message);
  };

  const handleListDialogSubmit = (
    name: string,
  ): { ok: true } | { ok: false; message: string } => {
    if (!listDialog) return { ok: false, message: '操作已取消' };
    const result =
      listDialog.mode === 'create'
        ? store.createList(name)
        : store.renameList(listDialog.list.id, name);
    if (!result.ok) return { ok: false, message: result.message };
    notify(listDialog.mode === 'create' ? '清单已创建' : '清单已重命名');
    return { ok: true };
  };

  const handleDeleteList = () => {
    if (!deleteListTarget) return;
    const target = deleteListTarget;
    const result = store.deleteList(target.id);
    setDeleteListTarget(null);
    if (!result.ok) {
      notify(result.message, 'error');
      return;
    }
    if (safeView.kind === 'list' && safeView.listId === target.id) {
      setView({ kind: 'list', listId: INBOX_ID });
      setTab('open');
      setFilters(EMPTY_FILTERS);
    }
    notify(`清单已删除，${result.affected} 个任务已移至收集箱`);
  };

  const retryStorage = () => {
    const ok = store.retryStorage();
    notify(
      ok ? '本地存储已恢复，可以继续保存' : '重试失败，请检查浏览器存储空间',
      ok ? 'success' : 'error',
    );
  };

  const emptyState = (() => {
    if (filtersActive) {
      return (
        <EmptyState
          icon={<IconSearch size={28} />}
          title="没有符合条件的任务"
          description="试试清空搜索或优先级筛选。"
          actionLabel="清空筛选"
          onAction={() => setFilters(EMPTY_FILTERS)}
        />
      );
    }
    if (safeView.kind === 'today' && data.tasks.length === 0 && data.lists.length === 1) {
      return (
        <EmptyState
          icon={<IconSun size={28} />}
          title="今天从一条任务开始"
          description="输入标题即可创建。任务和清单只保存在当前浏览器。"
          actionLabel="新增任务"
          onAction={openCreate}
          secondary={
            <button type="button" className="btn btn-ghost" onClick={() => setDataNoteOpen(true)}>
              数据说明
            </button>
          }
        />
      );
    }
    if (safeView.kind === 'next7') {
      return (
        <EmptyState
          icon={<IconCalendar size={28} />}
          title="未来 7 天暂无安排"
          description="给任务设置到期日期后，会出现在这里。"
          actionLabel="新增任务"
          onAction={openCreate}
        />
      );
    }
    if (safeView.kind === 'all') {
      return (
        <EmptyState
          icon={<IconLayers size={28} />}
          title="还没有任务"
          description="从任意视图都可以创建第一条任务。"
          actionLabel="新增任务"
          onAction={openCreate}
        />
      );
    }
    if (safeView.kind === 'completed') {
      return (
        <EmptyState
          icon={<IconCheckCircle size={28} />}
          title="还没有已完成的任务"
          description="完成任务后，会集中显示在这里。"
        />
      );
    }
    if (safeView.kind === 'list') {
      return (
        <EmptyState
          icon={<IconInbox size={28} />}
          title={tab === 'done' ? '这个清单还没有已完成的任务' : '这个清单还没有任务'}
          description={tab === 'done' ? undefined : '在这个清单中新增的任务会自动归入这里。'}
          actionLabel={tab === 'done' ? undefined : '新增任务'}
          onAction={tab === 'done' ? undefined : openCreate}
          secondary={
            tab === 'done' ? undefined : (
              <button type="button" className="btn btn-ghost" onClick={() => setDataNoteOpen(true)}>
                数据说明
              </button>
            )
          }
        />
      );
    }
    return (
      <EmptyState
        icon={<IconSun size={28} />}
        title="今天没有待办事项"
        description="可以添加一条今天要做的任务，或去收集箱看看。"
        actionLabel="新增任务"
        onAction={openCreate}
      />
    );
  })();

  const detailTask =
    detail?.mode === 'edit' ? data.tasks.find((task) => task.id === detail.taskId) : undefined;

  return (
    <div className="app">
      <Sidebar
        data={data}
        view={safeView}
        counts={counts}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={selectView}
        onNewList={() => {
          setSidebarOpen(false);
          setListDialog({ mode: 'create' });
        }}
        onRenameList={(list) => {
          setSidebarOpen(false);
          setListDialog({ mode: 'rename', list });
        }}
        onDeleteList={(list) => {
          setSidebarOpen(false);
          setDeleteListTarget(list);
        }}
        onDataNote={() => {
          setSidebarOpen(false);
          setDataNoteOpen(true);
        }}
      />

      <main className="main">
        <div className="main-inner">
          {store.persistIssue ? (
            <div className="banner banner--error banner--global" role="alert">
              <div>
                <strong>保存异常</strong>
                <p>{store.persistIssue}</p>
              </div>
              <button type="button" className="btn btn-small" onClick={retryStorage}>
                重试
              </button>
            </div>
          ) : null}

          <Toolbar
            title={title}
            count={result.tasks.length}
            filters={filters}
            onQueryChange={(query) => setFilters((current) => ({ ...current, query }))}
            onPriorityChange={(priority) => setFilters((current) => ({ ...current, priority }))}
            onClearFilters={() => setFilters(EMPTY_FILTERS)}
            onAdd={openCreate}
            onOpenMenu={() => setSidebarOpen(true)}
          />

          {safeView.kind === 'list' ? (
            <ViewTabs
              tab={tab}
              openCount={listOpenCount}
              doneCount={listDoneCount}
              onChange={changeTab}
            />
          ) : null}

          <div
            className="content"
            id="task-content"
            role={safeView.kind === 'list' ? 'tabpanel' : undefined}
          >
            <TaskList
              result={result}
              data={data}
              today={today}
              showList={showList}
              onToggle={handleToggle}
              onOpen={openEdit}
              empty={emptyState}
            />
          </div>
        </div>
      </main>

      {detail?.mode === 'create' ? (
        <TaskDetail
          key="create"
          mode="create"
          data={data}
          defaults={detail.defaults}
          onClose={() => setDetail(null)}
          onSaved={(task) => handleSaved(task, 'create')}
          onDeleted={handleDeleted}
          onSave={store.saveTask}
          onDelete={store.deleteTask}
        />
      ) : null}

      {detail?.mode === 'edit' ? (
        <TaskDetail
          key={`edit-${detail.taskId}`}
          mode="edit"
          task={detailTask ?? detail.snapshot}
          data={data}
          defaults={{ listId: INBOX_ID, dueDate: null }}
          onClose={() => setDetail(null)}
          onSaved={(task) => handleSaved(task, 'edit')}
          onDeleted={handleDeleted}
          onSave={store.saveTask}
          onDelete={store.deleteTask}
        />
      ) : null}

      {listDialog ? (
        <ListNameDialog
          mode={listDialog.mode}
          initialName={listDialog.mode === 'rename' ? listDialog.list.name : ''}
          onClose={() => setListDialog(null)}
          onSubmit={handleListDialogSubmit}
        />
      ) : null}

      {deleteListTarget ? (
        <ConfirmDialog
          title={`删除清单「${deleteListTarget.name}」？`}
          description={`清单内的全部任务将移至收集箱，任务会保留。共 ${
            data.tasks.filter((task) => task.listId === deleteListTarget.id).length
          } 个任务（包含已完成）。`}
          confirmLabel="删除清单"
          danger
          onCancel={() => setDeleteListTarget(null)}
          onConfirm={handleDeleteList}
        />
      ) : null}

      {dataNoteOpen ? <DataNoteDialog onClose={() => setDataNoteOpen(false)} /> : null}

      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          kind={toast.kind}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
