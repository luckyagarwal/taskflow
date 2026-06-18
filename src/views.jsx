// views.jsx — list views + grouping
import React, { useState } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp, Sel } from './store.jsx';
import { TaskRow, Empty, Dot, Ring, useIsNarrow } from './ui.jsx';
import { InlineComposer, Popover } from './composer.jsx';
import { CalendarView } from './calendar.jsx';

// ── Animated task group (handles complete-and-leave) ─────────
export function TaskGroup({ tasks, density, showProject, dateMode, reorderable }) {
  const { toggleTask, setSelectedId, selectedId, reorderTasks } = useApp();
  const narrow = useIsNarrow();
  const [exiting, setExiting] = useState({});
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggableId, setDraggableId] = useState(null);

  const handleToggle = (task, e) => {
    if (e && e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      const nextDone = !task.done;
      if (nextDone) {
        const toToggle = tasks.filter(t => !t.done);
        if (toToggle.length === 0) return;
        const newExiting = {};
        toToggle.forEach(t => { newExiting[t.id] = true; });
        setExiting(prev => ({ ...prev, ...newExiting }));
        setTimeout(() => {
          toToggle.forEach(t => toggleTask(t.id));
          setExiting(prev => {
            const next = { ...prev };
            toToggle.forEach(t => { delete next[t.id]; });
            return next;
          });
        }, 400);
      } else {
        const toToggle = tasks.filter(t => t.done);
        toToggle.forEach(t => toggleTask(t.id));
      }
      return;
    }
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
          style={{
            opacity: draggedIndex === idx ? 0.4 : 1,
            cursor: (reorderable && draggableId === task.id) ? 'grabbing' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            position: 'relative'
          }}
        >
          {reorderable && !narrow && (
            <span
              onMouseDown={() => setDraggableId(task.id)}
              onMouseUp={() => setDraggableId(null)}
              style={{
                cursor: 'grab',
                color: 'var(--text-3)',
                opacity: (selectedId === task.id || draggableId === task.id) ? 0.6 : 0,
                transition: 'opacity .15s',
                display: 'flex',
                alignItems: 'center',
                padding: '0 4px',
                flexShrink: 0,
                position: 'absolute',
                left: -20,
                height: '100%',
                zIndex: 10
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
              onToggle={(e) => handleToggle(task, e)}
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
      cursor: collapsible ? 'pointer' : 'default', userSelect: 'none',
      background: 'var(--bg)'
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

export function HeaderActions({ 
  sortBy, 
  setSortBy, 
  filterBy, 
  setFilterBy, 
  items = [], 
  onDeleteProject, 
  onRenameProject, 
  onProjectSettings 
}) {
  const { multiSelectedIds = [], toggleMultiSelect, clearMultiSelect, bulkDelete, bulkComplete } = useApp();
  const [sortMenu, setSortMenu] = useState(false);
  const [filterMenu, setFilterMenu] = useState(false);
  const [selectMenu, setSelectMenu] = useState(false);

  const sortOptions = [
    { label: 'Default Order', value: 'default' },
    { label: 'Sort by Due Date', value: 'due' },
    { label: 'Sort by Priority', value: 'priority' },
    { label: 'Sort by Creation Date', value: 'created' }
  ];

  const filterOptions = [
    { label: 'All Tasks', value: 'all' },
    { label: 'High Priority (P1)', value: 'prio-1' },
    { label: 'Medium Priority (P2)', value: 'prio-2' },
    { label: 'Low Priority (P3)', value: 'prio-3' },
    { label: 'No Priority (P4)', value: 'prio-4' },
    { label: 'In Progress', value: 'status-inprogress' },
    { label: 'Planned', value: 'status-planned' },
    { label: 'Blocked', value: 'status-blocked' },
    { label: 'Waiting', value: 'status-waiting' }
  ];

  const targetItems = items.filter(t => !t.done).length > 0 ? items.filter(t => !t.done) : items;
  const allSelected = targetItems.length > 0 && targetItems.every(t => multiSelectedIds.includes(t.id));
  const hasSelection = multiSelectedIds.length > 0;

  const handleSelectAll = () => {
    if (allSelected) {
      const itemIds = targetItems.map(t => t.id);
      itemIds.forEach(id => {
        if (multiSelectedIds.includes(id)) {
          toggleMultiSelect(id);
        }
      });
    } else {
      targetItems.forEach(t => {
        if (!multiSelectedIds.includes(t.id)) {
          toggleMultiSelect(t.id);
        }
      });
    }
    setSelectMenu(false);
  };

  return (
    <div style={{ display: 'flex', gap: 2, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      {/* Filter CTA */}
      {setFilterBy && (
        <button className="icon-btn" title="Filter" onClick={() => { setFilterMenu(!filterMenu); setSortMenu(false); setSelectMenu(false); }} style={{ background: filterBy && filterBy !== 'all' ? 'var(--hover-strong)' : undefined }}>
          <I.sliders size={18} style={{ color: filterBy && filterBy !== 'all' ? 'var(--accent)' : undefined }} />
        </button>
      )}
      {filterMenu && setFilterBy && (
        <Popover onClose={() => setFilterMenu(false)} style={{ top: 34, right: 80, zIndex: 100, minWidth: 180 }}>
          <div style={{ padding: '6px 8px 4px', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>Filter Tasks</div>
          {filterOptions.map((opt) => (
            <div key={opt.value} className="pop-item" style={{
              fontWeight: filterBy === opt.value ? 800 : 600,
              color: filterBy === opt.value ? 'var(--accent)' : 'var(--text)',
              justifyContent: 'space-between'
            }} onClick={() => { setFilterBy(opt.value); setFilterMenu(false); }}>
              {opt.label}
              {filterBy === opt.value && <I.check size={14} style={{ color: 'var(--accent)' }} />}
            </div>
          ))}
        </Popover>
      )}

      {/* Sort CTA */}
      {setSortBy && (
        <button className="icon-btn" title="Sort" onClick={() => { setSortMenu(!sortMenu); setFilterMenu(false); setSelectMenu(false); }} style={{ background: sortBy && sortBy !== 'default' ? 'var(--hover-strong)' : undefined }}>
          <I.sort size={18} style={{ color: sortBy && sortBy !== 'default' ? 'var(--accent)' : undefined }} />
        </button>
      )}
      {sortMenu && setSortBy && (
        <Popover onClose={() => setSortMenu(false)} style={{ top: 34, right: 40, zIndex: 100, minWidth: 160 }}>
          <div style={{ padding: '6px 8px 4px', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>Sort Tasks</div>
          {sortOptions.map((opt) => (
            <div key={opt.value} className="pop-item" style={{
              fontWeight: sortBy === opt.value ? 800 : 600,
              color: sortBy === opt.value ? 'var(--accent)' : 'var(--text)',
              justifyContent: 'space-between'
            }} onClick={() => { setSortBy(opt.value); setSortMenu(false); }}>
              {opt.label}
              {sortBy === opt.value && <I.check size={14} style={{ color: 'var(--accent)' }} />}
            </div>
          ))}
        </Popover>
      )}

      {/* Select / Multiple Actions */}
      <button
        className="icon-btn"
        title="Selection options"
        onClick={() => { setSelectMenu(!selectMenu); setSortMenu(false); }}
        style={{
          background: hasSelection ? 'var(--accent-soft)' : undefined,
          color: hasSelection ? 'var(--accent)' : undefined,
        }}
      >
        <I.dots size={18} />
      </button>

      {selectMenu && (
        <Popover onClose={() => setSelectMenu(false)} style={{ top: 34, right: 0, zIndex: 100, minWidth: 180 }}>
          <div style={{ padding: '6px 8px 4px', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>Select & Edit</div>

          {!hasSelection && targetItems.length > 0 && (
            <div className="pop-item" onClick={() => { toggleMultiSelect(targetItems[0].id); setSelectMenu(false); }} style={{ fontWeight: 600, gap: 8 }}>
              <span style={{ display: 'flex', color: 'var(--accent)' }}><I.check size={15} /></span>
              <span>Select Tasks</span>
            </div>
          )}

          <div className="pop-item" onClick={handleSelectAll} style={{ fontWeight: 600, gap: 8 }}>
            <span style={{ display: 'flex', color: 'var(--accent)' }}>
              {allSelected ? <I.x size={15} /> : <I.check size={15} />}
            </span>
            <span>{allSelected ? 'Deselect All' : 'Select All Tasks'}</span>
          </div>

          {hasSelection && (
            <>
              <div className="divider" style={{ margin: '4px 0' }} />
              <div className="pop-item" onClick={() => { bulkComplete(); setSelectMenu(false); }} style={{ fontWeight: 600, gap: 8 }}>
                <span style={{ display: 'flex', color: 'var(--today)' }}><I.check size={15} /></span>
                <span>Mark Completed</span>
              </div>
              <div className="pop-item" onClick={() => {
                if (window.confirm(`Are you sure you want to delete these ${multiSelectedIds.length} tasks?`)) {
                  bulkDelete();
                }
                setSelectMenu(false);
              }} style={{ fontWeight: 600, color: 'var(--p1)', gap: 8 }}>
                <span style={{ display: 'flex', color: 'var(--p1)' }}><I.trash size={15} /></span>
                <span>Delete Selected</span>
              </div>
            </>
          )}

          {onProjectSettings && (
            <>
              <div className="divider" style={{ margin: '4px 0' }} />
              <div className="pop-item" onClick={() => { onProjectSettings(); setSelectMenu(false); }} style={{ fontWeight: 600, gap: 8 }}>
                <span style={{ display: 'flex', color: 'var(--accent)' }}><I.settings size={15} /></span>
                <span>Project Settings</span>
              </div>
            </>
          )}

          {onRenameProject && (
            <>
              <div className="pop-item" onClick={() => { onRenameProject(); setSelectMenu(false); }} style={{ fontWeight: 600, gap: 8 }}>
                <span style={{ display: 'flex', color: 'var(--accent)' }}><I.edit size={15} /></span>
                <span>Rename Project</span>
              </div>
            </>
          )}

          {onDeleteProject && (
            <>
              <div className="divider" style={{ margin: '4px 0' }} />
              <div className="pop-item" onClick={() => { onDeleteProject(); setSelectMenu(false); }} style={{ fontWeight: 600, color: 'var(--p1)', gap: 8 }}>
                <span style={{ display: 'flex', color: 'var(--p1)' }}><I.trash size={15} /></span>
                <span>Delete Project</span>
              </div>
            </>
          )}
        </Popover>
      )}
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
  const { tasks, sorts, setViewSort, collapsedSections, toggleSection } = useApp();
  const sortBy = sorts.today || 'default';
  const overdue = Sel.overdue(tasks);
  const todayT = Sel.dueToday(tasks);
  const completedToday = React.useMemo(() => tasks.filter(t => t.done && t.doneOffset === 0), [tasks]);
  const total = overdue.length + todayT.length;

  const sortedOverdue = React.useMemo(() => sortTasks(overdue, sortBy), [overdue, sortBy]);
  const sortedToday = React.useMemo(() => sortTasks(todayT, sortBy), [todayT, sortBy]);
  const sortedCompleted = React.useMemo(() => sortTasks(completedToday, sortBy), [completedToday, sortBy]);
  
  const reorderable = sortBy === 'default';

  const handleToggle = (key, e) => {
    if (e.altKey) {
      // Toggle all sections
      const sections = ['today-overdue', 'today-today', 'today-completed'];
      const allCollapsed = sections.every(s => collapsedSections.includes(s));
      sections.forEach(s => toggleSection(s, !allCollapsed));
    } else {
      toggleSection(key);
    }
  };

  return (
    <div>
      <ViewHeader icon={<span style={{ color: 'var(--today)' }}><I.today size={26} /></span>}
        title="Today" subtitle={`${dateString(0)} · ${total} ${total === 1 ? 'task' : 'tasks'}`}
        right={<HeaderActions sortBy={sortBy} setSortBy={(val) => setViewSort('today', val)} items={[...overdue, ...todayT]} />} />
      <InlineComposer defaultProject="inbox" defaultDue={0} />
      {total === 0 && completedToday.length === 0 && (
        <Empty icon={<I.check size={30} />} title="You're all done for today" sub="Enjoy the calm. New tasks you add for today will show up here." />
      )}
      {overdue.length > 0 && (
        <>
          <SectionHeader title="Overdue" count={overdue.length} color="var(--p1)"
            collapsible collapsed={collapsedSections.includes('today-overdue')} onToggle={(e) => handleToggle('today-overdue', e)}
            right={<button style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-text)' }}>Reschedule</button>} />
          {!collapsedSections.includes('today-overdue') && <TaskGroup tasks={sortedOverdue} density={density} showProject reorderable={reorderable} />}
        </>
      )}
      {todayT.length > 0 && (
        <>
          <SectionHeader title="Today" count={todayT.length} icon={<Dot color="var(--today)" size={8} />}
            collapsible collapsed={collapsedSections.includes('today-today')} onToggle={(e) => handleToggle('today-today', e)} />
          {!collapsedSections.includes('today-today') && <TaskGroup tasks={sortedToday} density={density} showProject reorderable={reorderable} />}
        </>
      )}
      {completedToday.length > 0 && (
        <>
          <SectionHeader title="Completed" count={completedToday.length}
            collapsible collapsed={collapsedSections.includes('today-completed')} onToggle={(e) => handleToggle('today-completed', e)} />
          {!collapsedSections.includes('today-completed') && <TaskGroup tasks={sortedCompleted} density={density} showProject />}
        </>
      )}
    </div>
  );
}

// ── UPCOMING ────────────────────────────────────────────────
export function UpcomingView({ density }) {
  const { tasks, sorts, setViewSort, collapsedSections, toggleSection } = useApp();
  const sortBy = sorts.upcoming || 'default';
  
  const activeUp = React.useMemo(() => tasks.filter(t => !t.done && t.dueOffset !== null && t.dueOffset >= 0), [tasks]);
  const completedUp = React.useMemo(() => tasks.filter(t => t.done && t.dueOffset !== null && t.dueOffset >= 0), [tasks]);
  
  const sortedActive = React.useMemo(() => sortTasks(activeUp, sortBy), [activeUp, sortBy]);
  const sortedCompleted = React.useMemo(() => sortTasks(completedUp, sortBy), [completedUp, sortBy]);
  
  const activeGroups = {};
  sortedActive.forEach((t) => { (activeGroups[t.dueOffset] = activeGroups[t.dueOffset] || []).push(t); });

  const completedGroups = {};
  sortedCompleted.forEach((t) => { (completedGroups[t.dueOffset] = completedGroups[t.dueOffset] || []).push(t); });
  
  const offs = React.useMemo(() => {
    const activeOffs = Object.keys(activeGroups).map(Number);
    const completedOffs = Object.keys(completedGroups).map(Number);
    return Array.from(new Set([...activeOffs, ...completedOffs])).sort((a, b) => a - b);
  }, [activeGroups, completedGroups]);
  
  const reorderable = sortBy === 'default';

  const handleToggle = (off, e) => {
    if (e.altKey) {
      const allCollapsed = offs.every(o => collapsedSections.includes(`upcoming-${o}`));
      offs.forEach(o => toggleSection(`upcoming-${o}`, !allCollapsed));
    } else {
      toggleSection(`upcoming-${off}`);
    }
  };

  return (
    <div>
      <ViewHeader icon={<span style={{ color: 'var(--accent)' }}><I.upcoming size={26} /></span>}
        title="Upcoming" subtitle={`${activeUp.length} scheduled`}
        right={<HeaderActions sortBy={sortBy} setSortBy={(val) => setViewSort('upcoming', val)} items={activeUp} />} />
      {offs.length === 0 && <Empty icon={<I.upcoming size={30} />} title="Nothing scheduled" sub="Tasks with a future date will appear here, grouped by day." />}
      {offs.map((off) => {
        const d = H.dateFromOffset(off);
        const isCollapsed = collapsedSections.includes(`upcoming-${off}`);
        const activeForDay = activeGroups[off] || [];
        const completedForDay = completedGroups[off] || [];
        
        return (
          <div key={off}>
            <SectionHeader
              title={`${off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : H.DOW_LONG[d.getDay()]}`}
              collapsible collapsed={isCollapsed} onToggle={(e) => handleToggle(off, e)}
              right={<span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)' }}>{H.MONTHS[d.getMonth()]} {d.getDate()}</span>} />
            {!isCollapsed && (
              <>
                <InlineComposer defaultDue={off} />
                {activeForDay.length > 0 && (
                  <TaskGroup tasks={activeForDay} density={density} dateMode showProject reorderable={reorderable} />
                )}
                {completedForDay.length > 0 && (
                  <div style={{ marginTop: activeForDay.length > 0 ? 6 : 0, borderTop: activeForDay.length > 0 ? '1px dashed var(--border)' : 'none', paddingTop: activeForDay.length > 0 ? 6 : 0 }}>
                    <TaskGroup tasks={completedForDay} density={density} dateMode showProject />
                  </div>
                )}
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
        right={<HeaderActions sortBy={sortBy} setSortBy={(val) => setViewSort('inbox', val)} items={items} />} />
      <InlineComposer defaultProject="inbox" />
      {items.length === 0
        ? <Empty icon={<I.inbox size={30} />} title="Inbox zero" sub="Capture anything here, then organize it into a project later." />
        : <TaskGroup tasks={sortedItems} density={density} showProject reorderable={reorderable} />}
    </div>
  );
}

// ── PROJECT ─────────────────────────────────────────────────
export function ProjectView({ projectId, density }) {
  const { tasks, projects, sorts, setViewSort, collapsedSections, toggleSection, deleteProject, updateProject, setView } = useApp();
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
  const completed = React.useMemo(
    () => tasks.filter((t) => t.done && t.projectId === projectId).sort((a, b) => (b.doneOffset || 0) - (a.doneOffset || 0)),
    [tasks, projectId]
  );
  const doneCount = completed.length;
  const [collapsed, setCollapsed] = useState({ scheduled: false, anytime: false, someday: false });
  const [completedCollapsed, setCompletedCollapsed] = useState(true);

  const sortLabel = {
    due: 'Due Date',
    priority: 'Priority',
    created: 'Date Added'
  }[sortBy];

  const handleDeleteProject = () => {
    if (window.confirm(`Are you sure you want to delete the project "${proj.name}"? Tasks will be moved to Inbox.`)) {
      deleteProject(projectId);
    }
  };

  const handleRenameProject = () => {
    const newName = window.prompt("Rename Project:", proj.name);
    if (newName && newName.trim() && newName.trim() !== proj.name) {
      updateProject(projectId, { name: newName.trim() });
    }
  };

  return (
    <div>
      <ViewHeader icon={<Dot color={proj.color} size={14} />} title={proj.name}
        subtitle={`${proj.group} · ${items.length} open · ${doneCount} done`}
        right={<HeaderActions sortBy={sortBy} setSortBy={changeSort} items={items} onDeleteProject={handleDeleteProject} onRenameProject={handleRenameProject} onProjectSettings={() => setView({ type: 'project-settings', id: projectId })} />} />
      <InlineComposer defaultProject={projectId} />
      {items.length === 0 && <Empty icon={<I.check size={30} />} title="No open tasks" sub="Everything here is done. Nice work." />}
      
      {sortBy === 'default' ? (
        <>
          {scheduled.length > 0 && (
            <>
              <SectionHeader title="Scheduled" count={scheduled.length}
                collapsible collapsed={collapsedSections.includes('project-scheduled')} onToggle={() => toggleSection('project-scheduled')} />
              {!collapsedSections.includes('project-scheduled') && <TaskGroup tasks={scheduled} density={density} showProject={false} reorderable />}
            </>
          )}
          {anytime.length > 0 && (
            <>
              <SectionHeader title="Anytime" count={anytime.length}
                collapsible collapsed={collapsedSections.includes('project-anytime')} onToggle={() => toggleSection('project-anytime')} />
              {!collapsedSections.includes('project-anytime') && <TaskGroup tasks={anytime} density={density} showProject={false} reorderable />}
            </>
          )}
          {someday.length > 0 && (
            <>
              <SectionHeader title="Someday" count={someday.length}
                collapsible collapsed={collapsedSections.includes('project-someday')} onToggle={() => toggleSection('project-someday')} />
              {!collapsedSections.includes('project-someday') && <TaskGroup tasks={someday} density={density} showProject={false} reorderable />}
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

      {completed.length > 0 && (
        <>
          <SectionHeader title="Completed" count={completed.length}
            collapsible collapsed={completedCollapsed} onToggle={() => setCompletedCollapsed((v) => !v)} />
          {!completedCollapsed && <TaskGroup tasks={completed} density={density} showProject={false} />}
        </>
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
        right={<HeaderActions sortBy={sortBy} setSortBy={(val) => setViewSort(`label-${labelId}`, val)} items={items} />} />
      {items.length === 0
        ? <Empty icon={<I.tag size={30} />} title="No tasks with this label" />
        : <TaskGroup tasks={sortedItems} density={density} showProject reorderable={reorderable} />}
    </div>
  );
}

// ── LABELS INDEX (filters) ──────────────────────────────────
export function FiltersView() {
  const { tasks, setView, labels, updateLabel, deleteLabel } = useApp();
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const colors = ['#7C5CFC', '#1F9D55', '#F5A623', '#9AA0A6', '#2D7FF9', '#E8588A'];

  const startEdit = (l) => {
    setEditingId(l.id);
    setEditName(l.name);
    setEditColor(l.color);
  };

  const handleSave = (id) => {
    if (editName.trim()) {
      updateLabel(id, { name: editName.trim(), color: editColor });
      setEditingId(null);
    }
  };

  return (
    <div>
      <ViewHeader icon={<span style={{ color: 'var(--accent)' }}><I.filter size={24} /></span>} title="Filters & Labels" subtitle="Slice your tasks any way you like" />
      <div className="section-title" style={{ padding: '8px 8px' }}>Labels</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12 }}>
        {labels.map((l) => {
          const n = tasks.filter((t) => !t.done && (t.labels || []).includes(l.id)).length;
          const isEditing = editingId === l.id;

          if (isEditing) {
            return (
              <div key={l.id} style={{
                display: 'flex', flexDirection: 'column', gap: 8, padding: '14px', borderRadius: 12,
                border: '1.5px solid var(--accent)', background: 'var(--bg-elev)', boxShadow: 'var(--shadow-sm)'
              }}>
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                  placeholder="Label name..."
                  style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 6, padding: '6px 8px', fontSize: 13, outline: 'none' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave(l.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }} />
                
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {colors.map(c => (
                    <button key={c} onClick={() => setEditColor(c)} style={{
                      width: 18, height: 18, borderRadius: 999, background: c, border: editColor === c ? '2px solid var(--text)' : 'none', cursor: 'pointer', padding: 0
                    }} />
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button onClick={() => setEditingId(null)} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => handleSave(l.id)} style={{ border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>Save</button>
                </div>
              </div>
            );
          }

          return (
            <div key={l.id} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderRadius: 12,
              border: '1px solid var(--border)', background: 'var(--bg-elev)', boxShadow: 'var(--shadow-sm)',
            }}>
              <button onClick={() => setView({ type: 'label', id: l.id })} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 11, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', padding: 0, overflow: 'hidden'
              }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 9, color: l.color, background: `color-mix(in srgb, ${l.color} 14%, transparent)`, flexShrink: 0 }}><I.tag size={17} /></span>
                <span style={{ fontWeight: 700, fontSize: 14.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{l.name}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-3)', paddingRight: 4 }}>{n}</span>
              </button>
              
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button className="icon-btn row-hover" title="Edit Label" onClick={() => startEdit(l)} style={{ width: 26, height: 26 }}>
                  <I.edit size={14} style={{ color: 'var(--text-3)' }} />
                </button>
                <button className="icon-btn row-hover" title="Delete Label" onClick={() => {
                  if (window.confirm(`Are you sure you want to delete the label "${l.name}"? It will be removed from all tasks.`)) {
                    deleteLabel(l.id);
                  }
                }} style={{ width: 26, height: 26 }}>
                  <I.trash size={14} style={{ color: 'var(--p1)' }} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── LOGBOOK ─────────────────────────────────────────────────
export function LogbookView() {
  const { tasks, toggleTask, setSelectedId, selectedId, collapsedSections, toggleSection } = useApp();
  const done = Sel.done(tasks);
  const groups = {};
  done.forEach((t) => { const k = t.doneOffset || 0; (groups[k] = groups[k] || []).push(t); });
  const keys = Object.keys(groups).map(Number).sort((a, b) => b - a);
  const lbl = (k) => k === 0 ? 'Today' : k === -1 ? 'Yesterday' : `${Math.abs(k)} days ago`;
  return (
    <div>
      <ViewHeader icon={<span style={{ color: 'var(--today)' }}><I.logbook size={24} /></span>} title="Completed" subtitle={`${done.length} tasks done recently`} right={<HeaderActions items={done} />} />
      {keys.map((k) => {
        const isCollapsed = collapsedSections.includes(`logbook-${k}`);
        return (
          <div key={k}>
            <SectionHeader title={lbl(k)} count={groups[k].length}
              collapsible collapsed={isCollapsed} onToggle={() => toggleSection(`logbook-${k}`)} />
            {!isCollapsed && groups[k].map((t) => (
              <TaskRow key={t.id} task={t} density="comfortable" showProject
                onToggle={() => toggleTask(t.id)}
                onOpen={(x) => setSelectedId(x.id)}
                selected={selectedId === t.id} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── SETTINGS ────────────────────────────────────────────────
export function SettingsView() {
  const { theme, setTheme, density, setDensity, resetDatabase, exportDatabase, importDatabase } = useApp();
  const narrow = useIsNarrow();
  const fileInputRef = React.useRef(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        await importDatabase(text);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const currentTheme = theme || 'light';
  const currentDensity = density || 'card';

  return (
    <div>
      <ViewHeader
        icon={<span style={{ color: 'var(--text-2)' }}><I.settings size={24} /></span>}
        title="Settings"
        subtitle="Manage your app preferences and data backups"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 12 }}>
        
        {/* Appearance Section */}
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <I.sun size={16} /> Appearance
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['light', 'dark'].map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 700,
                  border: `2px solid ${currentTheme === t ? 'var(--accent)' : 'var(--border-2)'}`,
                  background: currentTheme === t ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-elev))' : 'transparent',
                  color: currentTheme === t ? 'var(--accent)' : 'var(--text-2)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all .15s'
                }}
              >
                {t} Mode
              </button>
            ))}
          </div>
        </div>

        {/* Layout Density Section — desktop only (mobile uses a fixed native list density) */}
        {!narrow && (
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <I.grid size={16} /> Layout Density
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { id: 'comfortable', label: 'Comfortable' },
              { id: 'compact', label: 'Compact' },
              { id: 'card', label: 'Card' }
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => setDensity(d.id)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 700,
                  border: `2px solid ${currentDensity === d.id ? 'var(--accent)' : 'var(--border-2)'}`,
                  background: currentDensity === d.id ? 'color-mix(in srgb, var(--accent) 8%, var(--bg-elev))' : 'transparent',
                  color: currentDensity === d.id ? 'var(--accent)' : 'var(--text-2)',
                  cursor: 'pointer',
                  transition: 'all .15s'
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Backup & Recovery Section */}
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <I.logbook size={16} /> Backup & Data Management
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button
              onClick={exportDatabase}
              style={{
                flex: '1 1 140px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 700,
                border: '1px solid var(--border-2)',
                background: 'var(--bg)',
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'background .15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg)'}
            >
              <I.arrowR size={14} style={{ transform: 'rotate(90deg)' }} /> Export Backup
            </button>

            <button
              onClick={handleImportClick}
              style={{
                flex: '1 1 140px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 700,
                border: '1px solid var(--border-2)',
                background: 'var(--bg)',
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'background .15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg)'}
            >
              <I.arrowR size={14} style={{ transform: 'rotate(-90deg)' }} /> Import Backup
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              style={{ display: 'none' }}
            />

            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to reset the database? This clears all tasks, projects, and labels, and reloads seed data.")) {
                  resetDatabase();
                }
              }}
              style={{
                flex: '1 1 100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 750,
                border: '1px solid var(--p1)',
                background: 'color-mix(in srgb, var(--p1) 8%, transparent)',
                color: 'var(--p1)',
                cursor: 'pointer',
                transition: 'background .15s',
                marginTop: 6
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--p1) 15%, transparent)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--p1) 8%, transparent)'}
            >
              <I.trash size={14} /> Reset Database (Wipe & Seed)
            </button>
          </div>
        </div>

        {/* Keyboard Shortcuts Reference — desktop only (no physical keyboard on mobile) */}
        {!narrow && (
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <I.keyboard size={16} /> Keyboard Shortcuts Reference
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13.5 }}>
            {[
              { keys: ['Cmd + K'], desc: 'Toggle Search overlay' },
              { keys: ['q'], desc: 'Quick Add new task modal' },
              { keys: ['Escape'], desc: 'Blur text editor / close popovers & drawers / deselect task' },
              { keys: ['Cmd + 1..6'], desc: 'Switch Views (Inbox, Today, Upcoming, Calendar, Filters, Logbook)' },
              { keys: ['g', 'followed by', 'i / t / u / c / f / l'], desc: 'Quick navigate to Inbox, Today, Upcoming, Calendar, Filters, Logbook' },
              { keys: ['ArrowUp / ArrowDown'], desc: 'Navigate through active tasks list' },
              { keys: ['Spacebar'], desc: 'Toggle completion of selected task' },
              { keys: ['Cmd + Option + C'], desc: 'Toggle all tasks/subtasks complete' },
              { keys: ['Cmd + Option + U'], desc: 'Untoggle all tasks/subtasks (mark active)' },
              { keys: ['Cmd + Enter', 'Cmd + Option + T'], desc: 'Toggle collapse/expand task sections' },
              { keys: ['Backspace', 'Delete'], desc: 'Delete selected task (requires confirmation)' }
            ].map((sh, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', borderBottom: idx < 10 ? '1px solid var(--border)' : 'none', paddingBottom: idx < 10 ? 8 : 0 }}>
                <span style={{ color: 'var(--text-2)', fontWeight: 600, maxWidth: '60%' }}>{sh.desc}</span>
                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {sh.keys.map((key, kIdx) => (
                    <kbd
                      key={kIdx}
                      style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border-2)',
                        borderRadius: 4,
                        padding: '1px 5px',
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'var(--text-3)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {key}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
        )}

      </div>
    </div>
  );
}

// ── PROJECT SETTINGS ────────────────────────────────────────
const PROJECT_COLORS = [
  '#2D7FF9', '#7C5CFC', '#14B8C4', '#1F9D55',
  '#E8588A', '#F5A623', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#9AA0A6',
];

export function ProjectSettingsView({ projectId }) {
  const { projects, sections, updateProject, deleteProject, setView } = useApp();
  const proj = projects.find(p => p.id === projectId);
  if (!proj) return null;

  const [name, setName] = React.useState(proj.name);
  const [color, setColor] = React.useState(proj.color);
  const [group, setGroup] = React.useState(proj.group);
  const [saved, setSaved] = React.useState(false);

  // Sync if project changes externally
  React.useEffect(() => {
    setName(proj.name);
    setColor(proj.color);
    setGroup(proj.group);
  }, [proj.name, proj.color, proj.group]);

  const hasChanges = name !== proj.name || color !== proj.color || group !== proj.group;

  const handleSave = () => {
    if (!name.trim()) return;
    const patch = {};
    if (name.trim() !== proj.name) patch.name = name.trim();
    if (color !== proj.color) patch.color = color;
    if (group !== proj.group) patch.group = group;
    if (Object.keys(patch).length > 0) {
      updateProject(projectId, patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Delete project "${proj.name}"? Tasks will be moved to Inbox.`)) {
      deleteProject(projectId);
    }
  };

  const cardStyle = {
    background: 'var(--bg-elev)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16
  };

  const labelStyle = {
    fontSize: 12.5,
    fontWeight: 800,
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    marginBottom: 10
  };

  return (
    <div>
      <ViewHeader
        icon={<span style={{ color: color }}><I.settings size={24} /></span>}
        title="Project Settings"
        subtitle={proj.name}
        right={
          <button
            onClick={() => setView({ type: 'project', id: projectId })}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg-elev)',
              color: 'var(--text)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
              transition: 'background .12s'
            }}
          >
            <I.chevL size={16} /> Back to Project
          </button>
        }
      />

      {/* Project Name */}
      <div style={cardStyle}>
        <div style={labelStyle}>Project Name</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Dot color={color} size={12} />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            placeholder="Project name..."
            style={{
              flex: 1, border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)', borderRadius: 8, padding: '10px 12px',
              fontSize: 15, fontWeight: 700, outline: 'none',
              transition: 'border-color .15s'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          />
        </div>
      </div>

      {/* Color */}
      <div style={cardStyle}>
        <div style={labelStyle}>Color</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {PROJECT_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: '100%',
                aspectRatio: '1',
                maxWidth: 44,
                borderRadius: 10,
                background: c,
                border: color === c ? '3px solid var(--text)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'transform .12s, border-color .12s',
                display: 'grid',
                placeItems: 'center',
                boxShadow: color === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${c}` : 'none'
              }}
              onMouseEnter={(e) => { if (color !== c) e.currentTarget.style.transform = 'scale(1.12)'; }}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {color === c && <I.check size={18} style={{ color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.3))' }} />}
            </button>
          ))}
        </div>
      </div>

      {/* Section */}
      <div style={cardStyle}>
        <div style={labelStyle}>Section</div>
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          style={{
            width: '100%', border: '1px solid var(--border)', background: 'var(--bg)',
            color: 'var(--text)', borderRadius: 8, padding: '10px 12px',
            fontSize: 14.5, fontWeight: 700, outline: 'none', cursor: 'pointer'
          }}
        >
          {sections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 8, fontWeight: 600 }}>
          Move this project to a different section.
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || !name.trim()}
          style={{
            flex: 1, padding: '12px 20px', borderRadius: 10,
            background: hasChanges ? 'var(--accent)' : 'var(--hover)',
            color: hasChanges ? '#fff' : 'var(--text-3)',
            fontSize: 14.5, fontWeight: 800, border: 'none', cursor: hasChanges ? 'pointer' : 'default',
            transition: 'all .15s',
            boxShadow: hasChanges ? '0 4px 12px color-mix(in srgb, var(--accent) 35%, transparent)' : 'none'
          }}
        >
          {saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Danger Zone */}
      <div style={{ ...cardStyle, borderColor: 'color-mix(in srgb, var(--p1) 30%, var(--border))' }}>
        <div style={{ ...labelStyle, color: 'var(--p1)' }}>Danger Zone</div>
        <button
          onClick={handleDelete}
          style={{
            width: '100%', padding: '10px 16px', borderRadius: 8,
            background: 'color-mix(in srgb, var(--p1) 8%, transparent)',
            color: 'var(--p1)', fontSize: 14, fontWeight: 750,
            border: '1px solid var(--p1)', cursor: 'pointer',
            transition: 'background .15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--p1) 15%, transparent)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--p1) 8%, transparent)'}
        >
          <I.trash size={15} /> Delete Project
        </button>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 8, fontWeight: 600 }}>
          All tasks will be moved to Inbox. This cannot be undone.
        </div>
      </div>
    </div>
  );
}

export const Views = { TodayView, UpcomingView, InboxView, ProjectView, ProjectSettingsView, LabelView, FiltersView, LogbookView, SettingsView, ViewHeader, SectionHeader, TaskGroup, dateString };
