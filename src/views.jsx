// views.jsx — list views + grouping
import React, { useState } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp, Sel } from './store.jsx';
import { TaskRow, Empty, Dot, Ring } from './ui.jsx';
import { InlineComposer, Popover } from './composer.jsx';
import { CalendarView } from './calendar.jsx';

// ── Animated task group (handles complete-and-leave) ─────────
export function TaskGroup({ tasks, density, showProject, dateMode, reorderable }) {
  const { toggleTask, setSelectedId, selectedId, reorderTasks } = useApp();
  const [exiting, setExiting] = useState({});
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggableId, setDraggableId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const handleToggle = (task) => {
    if (task.done) { toggleTask(task.id); return; }
    setExiting((e) => ({ ...e, [task.id]: true }));
    setTimeout(() => {
      toggleTask(task.id);
      setExiting((e) => { const n = { ...e }; delete n[task.id]; return n; });
    }, 400);
  };

  const handleDragStart = (e, idx) => {
    setDraggedIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === idx) return;
    
    reorderTasks(tasks[draggedIndex].id, tasks[idx].id);
    setDraggedIndex(idx);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDraggableId(null);
  };

  return (
    <div>
      {tasks.map((task, idx) => (
        <div
          className="exit-wrap"
          key={task.id}
          data-exit={exiting[task.id] ? '1' : undefined}
          draggable={reorderable && draggableId === task.id}
          onDragStart={reorderable ? (e) => handleDragStart(e, idx) : undefined}
          onDragOver={reorderable ? (e) => handleDragOver(e, idx) : undefined}
          onDragEnd={reorderable ? handleDragEnd : undefined}
          onMouseEnter={reorderable ? () => setHoveredId(task.id) : undefined}
          onMouseLeave={reorderable ? () => { if (draggableId !== task.id) setDraggableId(null); setHoveredId(null); } : undefined}
          style={{
            opacity: draggedIndex === idx ? 0.4 : 1,
            cursor: (reorderable && draggableId === task.id) ? 'grabbing' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          {reorderable && (
            <span
              onMouseDown={() => setDraggableId(task.id)}
              onMouseUp={() => setDraggableId(null)}
              style={{
                cursor: 'grab',
                color: 'var(--text-3)',
                opacity: hoveredId === task.id ? 0.6 : 0,
                transition: 'opacity .15s',
                display: 'flex',
                alignItems: 'center',
                padding: '0 4px',
                flexShrink: 0
              }}
              title="Drag to reorder"
            >
              <I.grip size={15} />
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <TaskRow task={task} density={density}
              showProject={dateMode ? 'inDate' : showProject}
              selected={selectedId === task.id}
              onToggle={() => handleToggle(task)}
              onOpen={(t) => setSelectedId(t.id)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Section header ──────────────────────────────────────────
export function SectionHeader({ title, count, color, icon, right, collapsible, collapsed, onToggle }) {
  return (
    <div onClick={collapsible ? onToggle : undefined} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '18px 8px 7px', borderBottom: '1px solid var(--border)', marginBottom: 4,
      cursor: collapsible ? 'pointer' : 'default', userSelect: 'none'
    }}>
      {collapsible && (
        <span style={{
          display: 'flex', color: 'var(--text-3)', transition: 'transform .15s',
          transform: collapsed ? 'rotate(-90deg)' : 'none'
        }}><I.chevD size={15} /></span>
      )}
      {icon}
      <span style={{ fontSize: 14.5, fontWeight: 800, color: color || 'var(--text)' }}>{title}</span>
      {count !== undefined && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)' }}>{count}</span>}
      {right && <div style={{ marginLeft: 'auto' }} onClick={(e) => e.stopPropagation()}>{right}</div>}
    </div>
  );
}

// ── View header (big title) ─────────────────────────────────
export function ViewHeader({ icon, title, color, subtitle, right }) {
  const { sidebarCollapsed, setSidebarCollapsed } = useApp();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 14 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {sidebarCollapsed && (
            <button
              className="icon-btn"
              onClick={() => setSidebarCollapsed(false)}
              style={{ marginRight: 4, flexShrink: 0 }}
              title="Expand sidebar"
            >
              <I.menu size={20} />
            </button>
          )}
          {icon}
          <h1 style={{ margin: 0, fontSize: 27, fontWeight: 800, letterSpacing: '-.02em', color: color || 'var(--text)' }}>{title}</h1>
        </div>
        {subtitle && <div style={{ marginTop: 4, marginLeft: (icon ? 34 : 0) + (sidebarCollapsed ? 38 : 0), fontSize: 13.5, fontWeight: 700, color: 'var(--text-3)' }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

export function dateString(off) {
  const d = H.dateFromOffset(off);
  return `${H.DOW_LONG[d.getDay()]}, ${H.MONTHS_LONG[d.getMonth()]} ${d.getDate()}`;
}

export function HeaderActions({ sortBy, setSortBy }) {
  const [menu, setMenu] = useState(false);
  const options = [
    { label: 'Default Order', value: 'default' },
    { label: 'Sort by Due Date', value: 'due' },
    { label: 'Sort by Priority', value: 'priority' },
    { label: 'Sort by Creation Date', value: 'created' }
  ];
  return (
    <div style={{ display: 'flex', gap: 2, position: 'relative' }}>
      <button className="icon-btn" title="Sort" onClick={() => setMenu(!menu)} style={{ background: sortBy && sortBy !== 'default' ? 'var(--hover-strong)' : undefined }}>
        <I.sliders size={18} style={{ color: sortBy && sortBy !== 'default' ? 'var(--accent)' : undefined }} />
      </button>
      {menu && (
        <Popover onClose={() => setMenu(false)} style={{ top: 34, right: 0, zIndex: 100, minWidth: 160 }}>
          <div style={{ padding: '6px 8px 4px', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>Sort Tasks</div>
          {options.map((opt) => (
            <div key={opt.value} className="pop-item" style={{
              fontWeight: sortBy === opt.value ? 800 : 600,
              color: sortBy === opt.value ? 'var(--accent)' : 'var(--text)',
              justifyContent: 'space-between'
            }} onClick={() => { setSortBy(opt.value); setMenu(false); }}>
              {opt.label}
              {sortBy === opt.value && <I.check size={14} style={{ color: 'var(--accent)' }} />}
            </div>
          ))}
        </Popover>
      )}
      <button className="icon-btn" title="More"><I.dots size={18} /></button>
    </div>
  );
}

export function sortTasks(items, sortBy) {
  const itemsCopy = [...items];
  if (sortBy === 'due') {
    return itemsCopy.sort((a, b) => {
      const aDue = a.dueOffset === 'someday' ? 99998 : (a.dueOffset === null ? 99999 : a.dueOffset);
      const bDue = b.dueOffset === 'someday' ? 99998 : (b.dueOffset === null ? 99999 : b.dueOffset);
      if (aDue !== bDue) return aDue - bDue;
      return (a.priority - b.priority) || (b.createdAt - a.createdAt);
    });
  }
  if (sortBy === 'priority') {
    return itemsCopy.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const aDue = a.dueOffset === 'someday' ? 99998 : (a.dueOffset === null ? 99999 : a.dueOffset);
      const bDue = b.dueOffset === 'someday' ? 99998 : (b.dueOffset === null ? 99999 : b.dueOffset);
      if (aDue !== bDue) return aDue - bDue;
      return b.createdAt - a.createdAt;
    });
  }
  if (sortBy === 'created') {
    return itemsCopy.sort((a, b) => b.createdAt - a.createdAt);
  }
  return itemsCopy;
}

// ── TODAY ───────────────────────────────────────────────────
export function TodayView({ density }) {
  const { tasks, sorts, setViewSort } = useApp();
  const sortBy = sorts.today || 'default';
  const overdue = Sel.overdue(tasks);
  const todayT = Sel.dueToday(tasks);
  const total = overdue.length + todayT.length;
  const [collapsed, setCollapsed] = useState({ overdue: false, today: false });

  const sortedOverdue = React.useMemo(() => sortTasks(overdue, sortBy), [overdue, sortBy]);
  const sortedToday = React.useMemo(() => sortTasks(todayT, sortBy), [todayT, sortBy]);
  
  const reorderable = sortBy === 'default';

  return (
    <div>
      <ViewHeader icon={<span style={{ color: 'var(--today)' }}><I.today size={26} /></span>}
        title="Today" subtitle={`${dateString(0)} · ${total} ${total === 1 ? 'task' : 'tasks'}`}
        right={<HeaderActions sortBy={sortBy} setSortBy={(val) => setViewSort('today', val)} />} />
      <InlineComposer defaultProject="inbox" defaultDue={0} />
      {total === 0 && (
        <Empty icon={<I.check size={30} />} title="You're all done for today" sub="Enjoy the calm. New tasks you add for today will show up here." />
      )}
      {overdue.length > 0 && (
        <>
          <SectionHeader title="Overdue" count={overdue.length} color="var(--p1)"
            collapsible collapsed={collapsed.overdue} onToggle={() => setCollapsed(prev => ({ ...prev, overdue: !prev.overdue }))}
            right={<button style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-text)' }}>Reschedule</button>} />
          {!collapsed.overdue && <TaskGroup tasks={sortedOverdue} density={density} showProject reorderable={reorderable} />}
        </>
      )}
      {todayT.length > 0 && (
        <>
          <SectionHeader title="Today" count={todayT.length} icon={<Dot color="var(--today)" size={8} />}
            collapsible collapsed={collapsed.today} onToggle={() => setCollapsed(prev => ({ ...prev, today: !prev.today }))} />
          {!collapsed.today && <TaskGroup tasks={sortedToday} density={density} showProject reorderable={reorderable} />}
        </>
      )}
    </div>
  );
}

// ── UPCOMING ────────────────────────────────────────────────
export function UpcomingView({ density }) {
  const { tasks, sorts, setViewSort } = useApp();
  const sortBy = sorts.upcoming || 'default';
  const up = Sel.upcoming(tasks);
  
  const sortedUp = React.useMemo(() => sortTasks(up, sortBy), [up, sortBy]);
  
  const groups = {};
  sortedUp.forEach((t) => { (groups[t.dueOffset] = groups[t.dueOffset] || []).push(t); });
  const offs = Object.keys(groups).map(Number).sort((a, b) => a - b);
  const [collapsedKeys, setCollapsedKeys] = useState({});
  
  const reorderable = sortBy === 'default';

  return (
    <div>
      <ViewHeader icon={<span style={{ color: 'var(--accent)' }}><I.upcoming size={26} /></span>}
        title="Upcoming" subtitle={`${up.length} scheduled`}
        right={<HeaderActions sortBy={sortBy} setSortBy={(val) => setViewSort('upcoming', val)} />} />
      {offs.length === 0 && <Empty icon={<I.upcoming size={30} />} title="Nothing scheduled" sub="Tasks with a future date will appear here, grouped by day." />}
      {offs.map((off) => {
        const d = H.dateFromOffset(off);
        const isCollapsed = !!collapsedKeys[off];
        return (
          <div key={off}>
            <SectionHeader
              title={`${off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : H.DOW_LONG[d.getDay()]}`}
              collapsible collapsed={isCollapsed} onToggle={() => setCollapsedKeys(prev => ({ ...prev, [off]: !prev[off] }))}
              right={<span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)' }}>{H.MONTHS[d.getMonth()]} {d.getDate()}</span>} />
            {!isCollapsed && (
              <>
                <InlineComposer defaultDue={off} />
                <TaskGroup tasks={groups[off]} density={density} dateMode showProject reorderable={reorderable} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── INBOX ───────────────────────────────────────────────────
export function InboxView({ density }) {
  const { tasks, sorts, setViewSort } = useApp();
  const sortBy = sorts.inbox || 'default';
  const items = Sel.inbox(tasks);
  const sortedItems = React.useMemo(() => sortTasks(items, sortBy), [items, sortBy]);
  const reorderable = sortBy === 'default';
  
  return (
    <div>
      <ViewHeader icon={<span style={{ color: 'var(--text-2)' }}><I.inbox size={25} /></span>}
        title="Inbox" subtitle={`${items.length} ${items.length === 1 ? 'task' : 'tasks'}`}
        right={<HeaderActions sortBy={sortBy} setSortBy={(val) => setViewSort('inbox', val)} />} />
      <InlineComposer defaultProject="inbox" />
      {items.length === 0
        ? <Empty icon={<I.inbox size={30} />} title="Inbox zero" sub="Capture anything here, then organize it into a project later." />
        : <TaskGroup tasks={sortedItems} density={density} showProject reorderable={reorderable} />}
    </div>
  );
}

// ── PROJECT ─────────────────────────────────────────────────
export function ProjectView({ projectId, density }) {
  const { tasks, projects, sorts, setViewSort } = useApp();
  const sortBy = sorts[`project-${projectId}`] || 'default';
  const proj = projects.find(p => p.id === projectId) || H.projectById(projectId);
  if (!proj) return null;

  const changeSort = (newSort) => {
    setViewSort(`project-${projectId}`, newSort);
  };

  const items = Sel.byProject(tasks, projectId);
  const sortedItems = React.useMemo(() => sortTasks(items, sortBy), [items, sortBy]);

  const scheduled = items.filter((t) => t.dueOffset !== null && t.dueOffset !== 'someday');
  const someday = items.filter((t) => t.dueOffset === 'someday');
  const anytime = items.filter((t) => t.dueOffset === null);
  const doneCount = tasks.filter((t) => t.done && t.projectId === projectId).length;
  const [collapsed, setCollapsed] = useState({ scheduled: false, anytime: false, someday: false });

  const sortLabel = {
    due: 'Due Date',
    priority: 'Priority',
    created: 'Date Added'
  }[sortBy];

  return (
    <div>
      <ViewHeader icon={<Dot color={proj.color} size={14} />} title={proj.name}
        subtitle={`${proj.group} · ${items.length} open · ${doneCount} done`}
        right={<HeaderActions sortBy={sortBy} setSortBy={changeSort} />} />
      <InlineComposer defaultProject={projectId} />
      {items.length === 0 && <Empty icon={<I.check size={30} />} title="No open tasks" sub="Everything here is done. Nice work." />}
      
      {sortBy === 'default' ? (
        <>
          {scheduled.length > 0 && (
            <>
              <SectionHeader title="Scheduled" count={scheduled.length}
                collapsible collapsed={collapsed.scheduled} onToggle={() => setCollapsed(prev => ({ ...prev, scheduled: !prev.scheduled }))} />
              {!collapsed.scheduled && <TaskGroup tasks={scheduled} density={density} showProject={false} reorderable />}
            </>
          )}
          {anytime.length > 0 && (
            <>
              <SectionHeader title="Anytime" count={anytime.length}
                collapsible collapsed={collapsed.anytime} onToggle={() => setCollapsed(prev => ({ ...prev, anytime: !prev.anytime }))} />
              {!collapsed.anytime && <TaskGroup tasks={anytime} density={density} showProject={false} reorderable />}
            </>
          )}
          {someday.length > 0 && (
            <>
              <SectionHeader title="Someday" count={someday.length}
                collapsible collapsed={collapsed.someday} onToggle={() => setCollapsed(prev => ({ ...prev, someday: !prev.someday }))} />
              {!collapsed.someday && <TaskGroup tasks={someday} density={density} showProject={false} reorderable />}
            </>
          )}
        </>
      ) : (
        items.length > 0 && (
          <>
            <SectionHeader title={`Sorted by ${sortLabel}`} count={sortedItems.length} />
            <TaskGroup tasks={sortedItems} density={density} showProject={false} />
          </>
        )
      )}
    </div>
  );
}

// ── LABEL ───────────────────────────────────────────────────
export function LabelView({ labelId, density }) {
  const { tasks, labels, sorts, setViewSort } = useApp();
  const sortBy = sorts[`label-${labelId}`] || 'default';
  const label = labels.find(l => l.id === labelId) || H.labelById(labelId);
  if (!label) return null;
  const items = Sel.byLabel(tasks, labelId);
  const sortedItems = React.useMemo(() => sortTasks(items, sortBy), [items, sortBy]);
  const reorderable = sortBy === 'default';
  
  return (
    <div>
      <ViewHeader icon={<span style={{ color: label.color }}><I.tag size={24} /></span>} title={label.name}
        color={label.color} subtitle={`${items.length} ${items.length === 1 ? 'task' : 'tasks'} labeled`}
        right={<HeaderActions sortBy={sortBy} setSortBy={(val) => setViewSort(`label-${labelId}`, val)} />} />
      {items.length === 0
        ? <Empty icon={<I.tag size={30} />} title="No tasks with this label" />
        : <TaskGroup tasks={sortedItems} density={density} showProject reorderable={reorderable} />}
    </div>
  );
}

// ── LABELS INDEX (filters) ──────────────────────────────────
export function FiltersView() {
  const { tasks, setView, labels } = useApp();
  return (
    <div>
      <ViewHeader icon={<span style={{ color: 'var(--accent)' }}><I.filter size={24} /></span>} title="Filters & Labels" subtitle="Slice your tasks any way you like" />
      <div className="section-title" style={{ padding: '8px 8px' }}>Labels</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
        {labels.map((l) => {
          const n = tasks.filter((t) => !t.done && (t.labels || []).includes(l.id)).length;
          return (
            <button key={l.id} onClick={() => setView({ type: 'label', id: l.id })} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--bg-elev)', boxShadow: 'var(--shadow-sm)', textAlign: 'left',
            }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 9, color: l.color, background: `color-mix(in srgb, ${l.color} 14%, transparent)` }}><I.tag size={17} /></span>
              <span style={{ fontWeight: 700, fontSize: 14.5, flex: 1 }}>{l.name}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-3)' }}>{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── LOGBOOK ─────────────────────────────────────────────────
export function LogbookView() {
  const { tasks, toggleTask, setSelectedId } = useApp();
  const done = Sel.done(tasks);
  const groups = {};
  done.forEach((t) => { const k = t.doneOffset || 0; (groups[k] = groups[k] || []).push(t); });
  const keys = Object.keys(groups).map(Number).sort((a, b) => b - a);
  const lbl = (k) => k === 0 ? 'Today' : k === -1 ? 'Yesterday' : `${Math.abs(k)} days ago`;
  const [collapsedKeys, setCollapsedKeys] = useState({});
  return (
    <div>
      <ViewHeader icon={<span style={{ color: 'var(--today)' }}><I.logbook size={24} /></span>} title="Completed" subtitle={`${done.length} tasks done recently`} right={<HeaderActions />} />
      {keys.map((k) => {
        const isCollapsed = !!collapsedKeys[k];
        return (
          <div key={k}>
            <SectionHeader title={lbl(k)} count={groups[k].length}
              collapsible collapsed={isCollapsed} onToggle={() => setCollapsedKeys(prev => ({ ...prev, [k]: !prev[k] }))} />
            {!isCollapsed && groups[k].map((t) => (
              <TaskRow key={t.id} task={t} density="comfortable" showProject
                onToggle={() => toggleTask(t.id)}
                onOpen={(x) => setSelectedId(x.id)} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export const Views = { TodayView, UpcomingView, InboxView, ProjectView, LabelView, FiltersView, LogbookView, ViewHeader, SectionHeader, TaskGroup, dateString };
