// App.jsx — desktop app shell. Exposes DesktopApp
import React, { useState, useRef } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp, Sel } from './store.jsx';
import { Dot, BulkActionBar } from './ui.jsx';
import { Views as V } from './views.jsx';
import { CalendarView } from './calendar.jsx';
import { TaskDetail } from './detail.jsx';
import { SearchOverlay } from './search.jsx';
import { QuickAddModal } from './composer.jsx';

function NavItem({ icon, label, count, active, color, onClick, onDelete, onRename }) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);

  const startEdit = (e) => {
    if (e) e.stopPropagation();
    setEditValue(label);
    setEditing(true);
  };

  const commitEdit = () => {
    if (editValue.trim() && editValue.trim() !== label && onRename) {
      onRename(editValue.trim());
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={'nav-item' + (active ? ' is-active' : '')} style={{ display: 'flex', alignItems: 'center' }}>
        <span className="nav-ico" style={{ color: active ? undefined : (color || 'var(--text-3)'), display: 'grid', placeItems: 'center', width: 20 }}>{icon}</span>
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={commitEdit}
          style={{
            flex: 1, border: '1px solid var(--accent)', background: 'var(--bg)',
            color: 'var(--text)', borderRadius: 4, padding: '2px 6px',
            fontSize: 13, fontWeight: 700, outline: 'none', minWidth: 0
          }}
        />
      </div>
    );
  }

  return (
    <button 
      className={'nav-item' + (active ? ' is-active' : '')} 
      onClick={onClick} 
      onDoubleClick={onRename ? startEdit : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ border: 'none', background: 'transparent', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center' }}
    >
      <span className="nav-ico" style={{ color: active ? undefined : (color || 'var(--text-3)'), display: 'grid', placeItems: 'center', width: 20 }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {onRename && hovered && (
        <span 
          onClick={startEdit}
          style={{ display: 'grid', placeItems: 'center', padding: '2px 4px', color: 'var(--text-3)', cursor: 'pointer', transition: 'color .1s', marginRight: 4 }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-3)'}
          title="Rename (or double-click)"
        >
          <I.edit size={14} />
        </span>
      )}
      {onDelete && hovered ? (
        <span 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{ display: 'grid', placeItems: 'center', padding: '2px 4px', color: 'var(--text-3)', cursor: 'pointer', transition: 'color .1s' }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--p1)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-3)'}
          title="Delete"
        >
          <I.trash size={14} />
        </span>
      ) : count ? (
        <span className="nav-count">{count}</span>
      ) : null}
    </button>
  );
}

function ProjectGroup({ title, projects = [], view, setView }) {
  const [open, setOpen] = useState(true);
  const { tasks, addProject, deleteProject, updateProject, deleteSection, updateSection, sections, reorderProjects } = useApp();
  const [addingProj, setAddingProj] = useState(false);
  const [projName, setProjName] = useState('');
  const [headerHovered, setHeaderHovered] = useState(false);
  const [draggedProjIdx, setDraggedProjIdx] = useState(null);
  const [editingSection, setEditingSection] = useState(false);
  const [sectionEditName, setSectionEditName] = useState(title);

  const handleAdd = () => {
    if (projName.trim()) {
      addProject(projName.trim(), title);
      setProjName('');
      setAddingProj(false);
    }
  };

  const handleSectionDelete = () => {
    const sec = sections.find(s => s.name === title);
    if (!sec) return;
    if (window.confirm(`Are you sure you want to delete the section "${title}" and all its projects? Tasks will be moved to Inbox.`)) {
      deleteSection(sec.id);
    }
  };

  const startSectionEdit = () => {
    setSectionEditName(title);
    setEditingSection(true);
  };

  const commitSectionEdit = () => {
    const sec = sections.find(s => s.name === title);
    if (!sec) { setEditingSection(false); return; }
    const trimmed = sectionEditName.trim();
    if (trimmed && trimmed !== title) {
      if (sections.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
        setEditingSection(false);
        return;
      }
      updateSection(sec.id, { name: trimmed });
    }
    setEditingSection(false);
  };

  const handleProjDragStart = (e, idx) => {
    setDraggedProjIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleProjDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedProjIdx === null || draggedProjIdx === idx) return;
    reorderProjects(projects[draggedProjIdx].id, projects[idx].id);
    setDraggedProjIdx(idx);
  };

  const handleProjDragEnd = () => {
    setDraggedProjIdx(null);
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div 
        onMouseEnter={() => setHeaderHovered(true)} 
        onMouseLeave={() => setHeaderHovered(false)} 
        style={{ display: 'flex', alignItems: 'center', width: '100%', paddingRight: 10 }}
      >
        {editingSection ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, padding: '4px 10px' }}>
            <span style={{ transition: 'transform .15s', transform: open ? 'none' : 'rotate(-90deg)', color: 'var(--text-3)' }}><I.chevD size={15} /></span>
            <input
              autoFocus
              value={sectionEditName}
              onChange={(e) => setSectionEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitSectionEdit(); if (e.key === 'Escape') setEditingSection(false); }}
              onBlur={commitSectionEdit}
              style={{
                flex: 1, border: '1px solid var(--accent)', background: 'var(--bg)',
                color: 'var(--text)', borderRadius: 4, padding: '2px 6px',
                fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '.06em', outline: 'none', minWidth: 0
              }}
            />
          </div>
        ) : (
          <button onClick={() => setOpen((o) => !o)} onDoubleClick={(e) => { e.stopPropagation(); startSectionEdit(); }} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, padding: '4px 10px', color: 'var(--text-3)', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ transition: 'transform .15s', transform: open ? 'none' : 'rotate(-90deg)' }}><I.chevD size={15} /></span>
            <span className="section-title">{title}</span>
          </button>
        )}
        {headerHovered && !editingSection && (
          <div style={{ display: 'flex', gap: 2 }}>
            <span 
              onClick={(e) => { e.stopPropagation(); startSectionEdit(); }}
              style={{ display: 'grid', placeItems: 'center', color: 'var(--text-3)', cursor: 'pointer', transition: 'color .1s', padding: 4 }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-3)'}
              title="Rename section (or double-click)"
            >
              <I.edit size={14} />
            </span>
            <span 
              onClick={(e) => { e.stopPropagation(); handleSectionDelete(); }}
              style={{ display: 'grid', placeItems: 'center', color: 'var(--text-3)', cursor: 'pointer', transition: 'color .1s', padding: 4 }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--p1)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-3)'}
              title="Delete section"
            >
              <I.trash size={14} />
            </span>
          </div>
        )}
      </div>
      {open && projects.map((p, idx) => {
        const n = Sel.byProject(tasks, p.id).length;
        const handleProjDelete = () => {
          if (window.confirm(`Are you sure you want to delete the project "${p.name}"? Tasks will be moved to Inbox.`)) {
            deleteProject(p.id);
          }
        };
        const handleProjRename = (newName) => {
          if (newName && newName !== p.name) {
            updateProject(p.id, { name: newName });
          }
        };
        return (
          <div
            key={p.id}
            draggable
            onDragStart={(e) => handleProjDragStart(e, idx)}
            onDragOver={(e) => handleProjDragOver(e, idx)}
            onDragEnd={handleProjDragEnd}
            style={{ opacity: draggedProjIdx === idx ? 0.4 : 1 }}
          >
            <NavItem icon={<Dot color={p.color} size={11} />} label={p.name} count={n}
              active={(view.type === 'project' || view.type === 'project-settings') && view.id === p.id} onClick={() => setView({ type: 'project', id: p.id })}
              onDelete={handleProjDelete} onRename={handleProjRename} />
          </div>
        );
      })}
      {open && projects.length === 0 && (
        <div style={{ padding: '4px 8px 4px 28px', fontSize: 12.5, color: 'var(--text-3)', fontStyle: 'italic' }}>
          No projects
        </div>
      )}
      {open && (
        addingProj ? (
          <div style={{ padding: '4px 8px 4px 28px', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input autoFocus value={projName} onChange={(e) => setProjName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAddingProj(false); setProjName(''); } }}
              placeholder="Project name..."
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 4, padding: '3px 6px', fontSize: 12, outline: 'none' }} />
          </div>
        ) : (
          <button onClick={() => setAddingProj(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 8px 6px 28px', fontSize: 12.5, color: 'var(--text-3)', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
            <I.plusSm size={14} /> Add project
          </button>
        )
      )}
    </div>
  );
}

function Sidebar({ style }) {
  const { view, setView, setSearch, setQuickAdd, tasks, projects, sections, addSection, setSidebarCollapsed, theme, setTheme, reorderSections } = useApp();
  const c = Sel.counts(tasks);
  const [addingSec, setAddingSec] = useState(false);
  const [newSecName, setNewSecName] = useState('');
  const [draggedSecIdx, setDraggedSecIdx] = useState(null);

  const handleAddSection = () => {
    if (newSecName.trim()) {
      addSection(newSecName.trim());
      setNewSecName('');
      setAddingSec(false);
    }
  };

  const handleSecDragStart = (e, idx) => {
    setDraggedSecIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSecDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedSecIdx === null || draggedSecIdx === idx) return;
    reorderSections(sections[draggedSecIdx].id, sections[idx].id);
    setDraggedSecIdx(idx);
  };

  const handleSecDragEnd = () => {
    setDraggedSecIdx(null);
  };

  return (
    <aside className="scroll" style={{
      width: 280,
      flex: 'none',
      background: 'var(--bg-side)',
      borderRight: '1px solid var(--border-2)',
      boxShadow: '4px 0 16px rgba(0, 0, 0, 0.03)',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      padding: '14px 12px 16px',
      ...style
    }}>
      {/* workspace header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 8px 12px' }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#2D7FF9,#7C5CFC)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flex: 'none' }}>C</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Casex Tasks</div>
        </div>
        <button className="icon-btn" style={{ flex: 'none' }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme"><I.sun size={18} style={{ display: theme === 'dark' ? 'block' : 'none' }} /><I.moon size={18} style={{ display: theme !== 'dark' ? 'block' : 'none' }} /></button>
        <button className="icon-btn" style={{ flex: 'none' }} onClick={() => setSidebarCollapsed(true)} title="Collapse sidebar"><I.menu size={18} /></button>
      </div>

      {/* add + search */}
      <button onClick={() => setQuickAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 9, color: 'var(--accent)', fontWeight: 800, fontSize: 14.5, border: 'none', background: 'transparent', cursor: 'pointer' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 999, background: 'var(--accent)', color: '#fff' }}><I.plusSm size={17} /></span>
        Add task
      </button>
      <button onClick={() => setSearch(true)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '8px 12px', borderRadius: 9, color: 'var(--text-3)', fontWeight: 600, fontSize: 14.5, border: 'none', background: 'transparent', cursor: 'pointer' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
        <I.search size={19} /> Search <kbd style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, border: '1px solid var(--border-2)', borderRadius: 5, padding: '1px 6px' }}>⌘K</kbd>
      </button>

      {/* primary nav */}
      <nav style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavItem icon={<I.inbox size={19} />} label="Inbox" count={c.inbox} active={view.type === 'inbox'} onClick={() => setView({ type: 'inbox' })} />
        <NavItem icon={<I.today size={19} />} label="Today" count={c.today} color="var(--today)" active={view.type === 'today'} onClick={() => setView({ type: 'today' })} />
        <NavItem icon={<I.upcoming size={19} />} label="Upcoming" active={view.type === 'upcoming'} color="var(--accent)" onClick={() => setView({ type: 'upcoming' })} />
        <NavItem icon={<I.calendar size={19} />} label="Calendar" active={view.type === 'calendar'} color="var(--text-2)" onClick={() => setView({ type: 'calendar' })} />
        <NavItem icon={<I.filter size={19} />} label="Filters & Labels" active={view.type === 'filters' || view.type === 'label'} color="var(--text-2)" onClick={() => setView({ type: 'filters' })} />
      </nav>

      {sections.map((sec, idx) => {
        const secProjects = projects.filter(p => p.group === sec.name);
        return (
          <div
            key={sec.id}
            draggable
            onDragStart={(e) => handleSecDragStart(e, idx)}
            onDragOver={(e) => handleSecDragOver(e, idx)}
            onDragEnd={handleSecDragEnd}
            style={{ opacity: draggedSecIdx === idx ? 0.4 : 1 }}
          >
            <ProjectGroup title={sec.name} projects={secProjects} view={view} setView={setView} />
          </div>
        );
      })}

      {addingSec ? (
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-elev)', borderRadius: 8, border: '1px solid var(--border)', marginTop: 8 }}>
          <input autoFocus value={newSecName} onChange={(e) => setNewSecName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddSection(); if (e.key === 'Escape') { setAddingSec(false); setNewSecName(''); } }}
            placeholder="Section name..."
            style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 6, padding: '6px 8px', fontSize: 13, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={() => { setAddingSec(false); setNewSecName(''); }} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 12.5, fontWeight: 700, padding: '4px 8px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleAddSection} style={{ border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12.5, fontWeight: 800, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>Add</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingSec(true)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '8px 10px', borderRadius: 9, color: 'var(--text-3)', fontWeight: 700, fontSize: 14, marginTop: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <I.plusSm size={18} /> Add section
        </button>
      )}

      <div style={{ flex: 1 }} />
      <div className="divider" style={{ margin: '10px 8px' }} />
      <NavItem icon={<I.logbook size={19} />} label="Completed" color="var(--today)" active={view.type === 'logbook'} onClick={() => setView({ type: 'logbook' })} />
      <NavItem icon={<I.settings size={19} />} label="Settings" active={view.type === 'settings'} onClick={() => setView({ type: 'settings' })} />
    </aside>
  );
}

function MainContent({ density, narrow }) {
  const { view } = useApp();
  let content;
  switch (view.type) {
    case 'today': content = <V.TodayView density={density} />; break;
    case 'upcoming': content = <V.UpcomingView density={density} />; break;
    case 'inbox': content = <V.InboxView density={density} />; break;
    case 'project': content = <V.ProjectView projectId={view.id} density={density} />; break;
    case 'project-settings': content = <V.ProjectSettingsView projectId={view.id} />; break;
    case 'label': content = <V.LabelView labelId={view.id} density={density} />; break;
    case 'filters': content = <V.FiltersView />; break;
    case 'calendar': content = <CalendarView density={density} />; break;
    case 'logbook': content = <V.LogbookView />; break;
    case 'settings': content = <V.SettingsView />; break;
    default: content = <V.TodayView density={density} />;
  }
  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: narrow ? '30px 28px 80px' : '34px 40px 80px' }}>{content}</div>
    </div>
  );
}

const getSelectedTaskSectionId = (task, view) => {
  if (!task) return null;
  if (view.type === 'today') {
    const isOverdue = task.dueOffset !== null && task.dueOffset < 0 && !task.done;
    return isOverdue ? 'today-overdue' : 'today-today';
  }
  if (view.type === 'upcoming') {
    return `upcoming-${task.dueOffset}`;
  }
  if (view.type === 'project') {
    if (task.dueOffset === 'someday') return 'project-someday';
    if (task.dueOffset !== null) return 'project-scheduled';
    return 'project-anytime';
  }
  if (view.type === 'logbook') {
    return `logbook-${task.doneOffset || 0}`;
  }
  return null;
};

export function DesktopApp({ frameW = 1320 }) {
  const {
    selectedId, setSelectedId, search, setSearch, quickAdd, setQuickAdd,
    sidebarWidth, setSidebarWidth, sidebarCollapsed, toasts,
    view, setView, tasks, updateTask, deleteTask, density,
    toggleTask, updateSubtask, collapsedSections, setCollapsedSections, toggleSection
  } = useApp();
  const narrow = frameW < 1080;
  const [detailWidth, setDetailWidth] = useState(372);
  const isResizingRef = useRef(false);
  const isSidebarResizingRef = useRef(false);

  React.useEffect(() => {
    let lastKeyG = false;
    let lastKeyGTimeout = null;

    const handleKeyDown = (e) => {
      const isEditing = document.activeElement && (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable
      );

      // 1. Command/Search Menu (Cmd/Ctrl + K)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch(prev => !prev);
        return;
      }

      if (e.key === 'Escape') {
        if (search) {
          setSearch(false);
          return;
        }
        if (quickAdd) {
          setQuickAdd(false);
          return;
        }
        if (document.activeElement && document.activeElement !== document.body) {
          document.activeElement.blur();
          return;
        }
        if (selectedId) {
          setSelectedId(null);
          return;
        }
      }

      // Block single-character/nav shortcuts while typing in inputs
      if (isEditing) return;

      // Notion-style section collapse/expand: Cmd+Enter or Cmd+Option+T
      if ((e.metaKey && e.key === 'Enter') || (e.metaKey && e.altKey && e.code === 'KeyT')) {
        e.preventDefault();
        if (selectedId) {
          const task = tasks.find(t => t.id === selectedId);
          const secId = getSelectedTaskSectionId(task, view);
          if (secId) {
            toggleSection(secId);
            return;
          }
        } else if (e.metaKey && e.altKey && e.code === 'KeyT') {
          // Toggle all sections in the active view
          let viewSections = [];
          if (view.type === 'today') {
            viewSections = ['today-overdue', 'today-today'];
          } else if (view.type === 'upcoming') {
            const offsets = Array.from(new Set(tasks.map(t => t.dueOffset).filter(off => off !== null && off !== 'someday')));
            viewSections = offsets.map(off => `upcoming-${off}`);
          } else if (view.type === 'project') {
            viewSections = ['project-scheduled', 'project-anytime', 'project-someday'];
          } else if (view.type === 'logbook') {
            const doneOffsets = Array.from(new Set(tasks.filter(t => t.done).map(t => t.doneOffset || 0)));
            viewSections = doneOffsets.map(off => `logbook-${off}`);
          }

          if (viewSections.length > 0) {
            const anyExpanded = viewSections.some(secId => !collapsedSections.includes(secId));
            if (anyExpanded) {
              setCollapsedSections(prev => Array.from(new Set([...prev, ...viewSections])));
            } else {
              setCollapsedSections(prev => prev.filter(secId => !viewSections.includes(secId)));
            }
          }
          return;
        }
      }

      // Mac-style complete all / untoggle all: Cmd + Option + C / U
      if (e.metaKey && e.altKey && (e.code === 'KeyC' || e.code === 'KeyU')) {
        e.preventDefault();
        const nextDone = e.code === 'KeyC';
        
        if (selectedId) {
          const task = tasks.find(t => t.id === selectedId);
          if (task && task.subtasks) {
            task.subtasks.forEach(sub => {
              if (sub.done !== nextDone) {
                updateSubtask(selectedId, sub.id, { done: nextDone });
              }
            });
          }
        } else {
          // Toggle all visible tasks
          const visibleIds = Array.from(document.querySelectorAll('.task-row'))
            .map(row => row.getAttribute('data-task-id'))
            .filter(Boolean);
          
          if (visibleIds.length > 0) {
            visibleIds.forEach(id => {
              const t = tasks.find(item => item.id === id);
              if (t && t.done !== nextDone) {
                toggleTask(t.id);
              }
            });
          }
        }
        return;
      }

      // 2. Navigation via Cmd + 1..6
      if (e.metaKey || e.ctrlKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 6) {
          e.preventDefault();
          const routes = ['inbox', 'today', 'upcoming', 'calendar', 'filters', 'logbook'];
          setView({ type: routes[num - 1] });
          return;
        }
      }

      // 3. Quick Add Task modal (q)
      if (e.key === 'q' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setQuickAdd(true);
        return;
      }

      // 4. "g" sequence shortcuts (g i, g t, g u, g c, g f, g l)
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        lastKeyG = true;
        if (lastKeyGTimeout) clearTimeout(lastKeyGTimeout);
        lastKeyGTimeout = setTimeout(() => { lastKeyG = false; }, 1000);
        return;
      }

      if (lastKeyG && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const key = e.key.toLowerCase();
        const routes = {
          i: 'inbox',
          t: 'today',
          u: 'upcoming',
          c: 'calendar',
          f: 'filters',
          l: 'logbook'
        };
        if (routes[key]) {
          e.preventDefault();
          setView({ type: routes[key] });
          lastKeyG = false;
          return;
        }
      }

      // 5. Arrow Up / Down selection
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const rows = Array.from(document.querySelectorAll('.task-row'));
        if (rows.length === 0) return;

        e.preventDefault();
        const selectedIndex = rows.findIndex(row => row.classList.contains('is-selected'));
        let nextIndex = 0;

        if (selectedIndex !== -1) {
          if (e.key === 'ArrowDown') {
            nextIndex = (selectedIndex + 1) % rows.length;
          } else {
            nextIndex = (selectedIndex - 1 + rows.length) % rows.length;
          }
        } else {
          nextIndex = e.key === 'ArrowDown' ? 0 : rows.length - 1;
        }

        const targetRow = rows[nextIndex];
        if (targetRow) {
          targetRow.click();
          targetRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        return;
      }

      // 6. Selected Task Operations
      if (selectedId) {
        // Space to toggle completion
        if (e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          const task = tasks.find(t => t.id === selectedId);
          if (task) {
            updateTask(task.id, { done: !task.done });
          }
          return;
        }

        // Delete/Backspace to remove
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          if (window.confirm("Are you sure you want to delete this task?")) {
            deleteTask(selectedId);
            setSelectedId(null);
          }
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (lastKeyGTimeout) clearTimeout(lastKeyGTimeout);
    };
  }, [selectedId, search, quickAdd, view, tasks, setView, setSearch, setQuickAdd, setSelectedId, updateTask, deleteTask, toggleTask, updateSubtask, collapsedSections, setCollapsedSections, toggleSection]);

  const startResize = (e) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', endResize);
  };

  const handleResize = (e) => {
    if (!isResizingRef.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 300 && newWidth <= 600) {
      setDetailWidth(newWidth);
    }
  };

  const endResize = () => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', endResize);
  };

  const startSidebarResize = (e) => {
    e.preventDefault();
    isSidebarResizingRef.current = true;
    document.addEventListener('mousemove', handleSidebarResize);
    document.addEventListener('mouseup', endSidebarResize);
  };

  const handleSidebarResize = (e) => {
    if (!isSidebarResizingRef.current) return;
    const newWidth = Math.max(240, Math.min(450, e.clientX));
    setSidebarWidth(newWidth);
  };

  const endSidebarResize = () => {
    isSidebarResizingRef.current = false;
    document.removeEventListener('mousemove', handleSidebarResize);
    document.removeEventListener('mouseup', endSidebarResize);
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', position: 'relative' }}>
      {!sidebarCollapsed && (
        <>
          <Sidebar style={{ width: sidebarWidth }} />
          {/* Sidebar Resize Handle */}
          <div
            onMouseDown={startSidebarResize}
            style={{
              position: 'relative',
              width: 5,
              cursor: 'col-resize',
              zIndex: 100,
              background: 'transparent',
              transition: 'background .15s',
              flexShrink: 0,
              marginLeft: -2.5,
              marginRight: -2.5
            }}
            onMouseEnter={(e) => { e.target.style.background = 'rgba(45, 127, 249, 0.3)'; }}
            onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
          />
        </>
      )}
      <MainContent density={density} narrow={narrow} />
      {selectedId && !narrow && (
        <div style={{ width: detailWidth, flex: 'none', position: 'relative', borderLeft: '1px solid var(--border)', background: 'var(--bg)' }}>
          {/* Resize Handle */}
          <div
            onMouseDown={startResize}
            style={{
              position: 'absolute',
              left: -3,
              top: 0,
              bottom: 0,
              width: 6,
              cursor: 'col-resize',
              zIndex: 100,
            }}
            onMouseEnter={(e) => { e.target.style.background = 'rgba(45, 127, 249, 0.3)'; }}
            onMouseLeave={(e) => { e.target.style.background = 'transparent'; }}
          />
          <div style={{ height: '100%', animation: 'panelIn .2s ease' }}>
            <TaskDetail taskId={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        </div>
      )}
      {selectedId && narrow && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 120, display: 'flex', justifyContent: 'flex-end' }}>
          <div className="scrim" onMouseDown={() => setSelectedId(null)} />
          <div style={{ position: 'relative', width: 'min(440px, 92%)', background: 'var(--bg)', borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', animation: 'panelIn .2s ease' }}>
            <TaskDetail taskId={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        </div>
      )}
      {search && <SearchOverlay onClose={() => setSearch(false)} />}
      {quickAdd && <QuickAddModal onClose={() => setQuickAdd(false)} />}
      <BulkActionBar />
      {toasts && toasts.length > 0 && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toasts.map(t => (
            <div key={t.id} style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '12px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13.5, color: 'var(--text)', animation: 'slideUp .2s ease-out' }}>
              {t.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DesktopApp;
