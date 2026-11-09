import { useEffect, useRef, useState } from 'react';
import { INBOX_ID, type AppData, type TaskList, type View } from '../lib/types';
import type { NavCounts } from '../lib/tasks';
import { viewsEqual } from '../lib/tasks';
import {
  IconCalendar,
  IconCheckCircle,
  IconClose,
  IconInfo,
  IconInbox,
  IconLayers,
  IconList,
  IconMore,
  IconPlus,
  IconSun,
} from './Icons';

interface SidebarProps {
  data: AppData;
  view: View;
  counts: NavCounts;
  open: boolean;
  onClose: () => void;
  onSelect: (view: View) => void;
  onNewList: () => void;
  onRenameList: (list: TaskList) => void;
  onDeleteList: (list: TaskList) => void;
  onDataNote: () => void;
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="count-badge" aria-hidden="true">
      {value}
    </span>
  );
}

interface NavButtonProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}

function NavButton({ active, icon, label, count, onClick }: NavButtonProps) {
  return (
    <button
      type="button"
      className={`nav-item${active ? ' is-active' : ''}`}
      aria-label={`${label}，${count} 项`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      <CountBadge value={count} />
    </button>
  );
}

interface ListRowProps {
  list: TaskList;
  active: boolean;
  count: number;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function ListRow({ list, active, count, onSelect, onRename, onDelete }: ListRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className={`list-row-wrap${menuOpen ? ' menu-open' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className={`nav-item list-nav${active ? ' is-active' : ''}`}
        aria-label={`${list.name}，${count} 项`}
        aria-current={active ? 'page' : undefined}
        onClick={onSelect}
      >
        <span className="nav-icon">
          <IconList size={18} />
        </span>
        <span className="nav-label">{list.name}</span>
        <CountBadge value={count} />
      </button>
      <button
        type="button"
        className="icon-btn list-menu-trigger"
        aria-label={`管理清单「${list.name}」`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((value) => !value)}
      >
        <IconMore size={18} />
      </button>
      {menuOpen ? (
        <div className="list-menu" role="menu" aria-label={`清单「${list.name}」操作`}>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setMenuOpen(false);
              onRename();
            }}
          >
            重命名
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item is-danger"
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
          >
            删除清单
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({
  data,
  view,
  counts,
  open,
  onClose,
  onSelect,
  onNewList,
  onRenameList,
  onDeleteList,
  onDataNote,
}: SidebarProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
    } else if (wasOpen.current) {
      document.getElementById('mobile-menu-button')?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const customLists = [...data.lists]
    .filter((list) => !list.system)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

  return (
    <>
      <button
        type="button"
        className={`scrim${open ? ' is-open' : ''}`}
        aria-label="关闭导航"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside className={`sidebar${open ? ' is-open' : ''}`} aria-label="主导航">
        <div className="sidebar-head">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <IconCheckCircle size={22} />
            </span>
            <span className="brand-name">Todo</span>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn sidebar-close"
            aria-label="关闭导航"
            onClick={onClose}
          >
            <IconClose size={20} />
          </button>
        </div>

        <nav className="nav-group" aria-label="任务视图">
          <NavButton
            active={viewsEqual(view, { kind: 'today' })}
            icon={<IconSun size={18} />}
            label="今日"
            count={counts.today}
            onClick={() => onSelect({ kind: 'today' })}
          />
          <NavButton
            active={viewsEqual(view, { kind: 'next7' })}
            icon={<IconCalendar size={18} />}
            label="未来 7 天"
            count={counts.next7}
            onClick={() => onSelect({ kind: 'next7' })}
          />
          <NavButton
            active={viewsEqual(view, { kind: 'all' })}
            icon={<IconLayers size={18} />}
            label="全部待办"
            count={counts.all}
            onClick={() => onSelect({ kind: 'all' })}
          />
          <NavButton
            active={viewsEqual(view, { kind: 'completed' })}
            icon={<IconCheckCircle size={18} />}
            label="已完成"
            count={counts.completed}
            onClick={() => onSelect({ kind: 'completed' })}
          />
        </nav>

        <div className="nav-section">
          <div className="nav-section-head">
            <span>清单</span>
            <button
              type="button"
              className="icon-btn new-list-btn"
              aria-label="新建清单"
              title="新建清单"
              onClick={onNewList}
            >
              <IconPlus size={18} />
            </button>
          </div>
          <nav className="nav-group" aria-label="清单">
            <NavButton
              active={view.kind === 'list' && view.listId === INBOX_ID}
              icon={<IconInbox size={18} />}
              label="收集箱"
              count={counts.byList.inbox ?? 0}
              onClick={() => onSelect({ kind: 'list', listId: INBOX_ID })}
            />
            {customLists.map((list) => (
              <ListRow
                key={list.id}
                list={list}
                active={view.kind === 'list' && view.listId === list.id}
                count={counts.byList[list.id] ?? 0}
                onSelect={() => onSelect({ kind: 'list', listId: list.id })}
                onRename={() => onRenameList(list)}
                onDelete={() => onDeleteList(list)}
              />
            ))}
          </nav>
        </div>

        <div className="sidebar-foot">
          <button type="button" className="data-note-link" onClick={onDataNote}>
            <IconInfo size={17} />
            <span>数据仅保存在本浏览器</span>
          </button>
        </div>
      </aside>
    </>
  );
}
