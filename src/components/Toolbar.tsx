import type { Filters, PriorityFilter } from '../lib/types';
import { isFilterActive } from '../lib/tasks';
import { IconPlus, IconSearch, IconClose } from './Icons';

interface ToolbarProps {
  title: string;
  count: number;
  filters: Filters;
  onQueryChange: (query: string) => void;
  onPriorityChange: (priority: PriorityFilter) => void;
  onClearFilters: () => void;
  onAdd: () => void;
  onOpenMenu: () => void;
}

export function Toolbar({
  title,
  count,
  filters,
  onQueryChange,
  onPriorityChange,
  onClearFilters,
  onAdd,
  onOpenMenu,
}: ToolbarProps) {
  const filtersActive = isFilterActive(filters);

  return (
    <div className="toolbar">
      <div className="toolbar-heading">
        <button
          id="mobile-menu-button"
          type="button"
          className="icon-btn menu-btn"
          aria-label="打开导航"
          onClick={onOpenMenu}
        >
          <span className="menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <h1>{title}</h1>
        <span className="view-count" aria-live="polite">
          {count} 项
        </span>
        <button type="button" className="btn btn-primary add-btn" aria-label="新增任务" onClick={onAdd}>
          <IconPlus size={18} />
          <span>新增任务</span>
        </button>
      </div>

      <div className="toolbar-controls">
        <div className="search-box">
          <IconSearch size={18} className="search-icon" />
          <input
            type="search"
            className="search-input"
            value={filters.query}
            placeholder="搜索当前视图"
            aria-label="搜索当前视图"
            onChange={(event) => onQueryChange(event.target.value)}
          />
          {filters.query ? (
            <button
              type="button"
              className="search-clear"
              aria-label="清空搜索"
              onClick={() => onQueryChange('')}
            >
              <IconClose size={16} />
            </button>
          ) : null}
        </div>

        <label className="priority-filter">
          <span className="sr-only">按优先级筛选</span>
          <select
            className="select"
            value={filters.priority}
            onChange={(event) => onPriorityChange(event.target.value as PriorityFilter)}
          >
            <option value="all">全部优先级</option>
            <option value="high">高优先级</option>
            <option value="medium">中优先级</option>
            <option value="low">低优先级</option>
          </select>
        </label>

        {filtersActive ? (
          <button type="button" className="btn btn-ghost clear-filters" onClick={onClearFilters}>
            清空筛选
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface ViewTabsProps {
  tab: 'open' | 'done';
  openCount: number;
  doneCount: number;
  onChange: (tab: 'open' | 'done') => void;
}

export function ViewTabs({ tab, openCount, doneCount, onChange }: ViewTabsProps) {
  return (
    <div className="view-tabs" role="tablist" aria-label="清单任务状态">
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'open'}
        aria-controls="task-content"
        className={`view-tab${tab === 'open' ? ' is-active' : ''}`}
        onClick={() => onChange('open')}
      >
        待完成
        <span className="tab-count">{openCount}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === 'done'}
        aria-controls="task-content"
        className={`view-tab${tab === 'done' ? ' is-active' : ''}`}
        onClick={() => onChange('done')}
      >
        已完成
        <span className="tab-count">{doneCount}</span>
      </button>
    </div>
  );
}
