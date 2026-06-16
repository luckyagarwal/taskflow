// App.jsx — desktop app shell. Exposes DesktopApp
import React, { useState, useRef } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp, Sel } from './store.jsx';
import { Dot } from './ui.jsx';
import { Views as V } from './views.jsx';
import { CalendarView } from './calendar.jsx';
import { TaskDetail } from './detail.jsx';
import { SearchOverlay } from './search.jsx';
import { QuickAddModal } from './composer.jsx';

function NavItem({ icon, label, count, active, color, onClick }) {
  return (
    <button className={'nav-item' + (active ? ' is-active' : '')} onClick={onClick} style={{ border: 'none', background: 'transparent', width: '100%', textAlign: 'left' }}>
      <span className="nav-ico" style={{ color: active ? undefined : (color || 'var(--text-3)'), display: 'grid', placeItems: 'center', width: 20 }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count ? <span className="nav-count">{count}</span> : null}
    </button>
  );
}

function ProjectGroup({ title, projects, view, setView }) {
  const [open, setOpen] = useState(true);
  const { tasks } = useApp();
  return (
    <div style={{ marginTop: 14 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '4px 10px', color: 'var(--text-3)', border: 'none', background: 'transparent', cursor: 'pointer' }}>
        <span style={{ transition: 'transform .15s', transform: open ? 'none' : 'rotate(-90deg)' }}><I.chevD size={15} /></span>
        <span className="section-title">{title}</span>
      </button>
      {open && projects.map((p) => {
        const n = Sel.byProject(tasks, p.id).length;
        return (
          <NavItem key={p.id} icon={<Dot color={p.color} size={11} />} label={p.name} count={n}
            active={view.type === 'project' && view.id === p.id} onClick={() => setView({ type: 'project', id: p.id })} />
        );
      })}
    </div>
  );
}

function Sidebar({ theme, onToggleTheme, style }) {
  const { view, setView, setSearch, setQuickAdd, tasks, projects, addProject, setSidebarCollapsed } = useApp();
  const c = Sel.counts(tasks);
  const [addingProj, setAddingProj] = useState(false);
  const [newProjName, setNewProjName] = useState('');

  const groups = {};
  projects.forEach((p) => { (groups[p.group] = groups[p.group] || []).push(p); });

  const handleAddProject = () => {
    if (newProjName.trim()) {
      addProject(newProjName.trim());
      setNewProjName('');
      setAddingProj(false);
    }
  };

  return (
    <aside className="scroll" style={{ width: 280, flex: 'none', background: 'var(--bg-side)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '14px 12px 16px', ...style }}>
      {/* workspace header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 8px 12px' }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#2D7FF9,#7C5CFC)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flex: 'none' }}>M</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Maya Iyer</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Personal · Free</div>
        </div>
        <button className="icon-btn" style={{ flex: 'none' }} onClick={onToggleTheme} title="Toggle theme"><I.sun size={18} style={{ display: theme === 'dark' ? 'block' : 'none' }} /><I.moon size={18} style={{ display: theme !== 'dark' ? 'block' : 'none' }} /></button>
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

      {Object.keys(groups).map((g) => (
        <ProjectGroup key={g} title={g} projects={groups[g]} view={view} setView={setView} />
      ))}

      {addingProj ? (
        <div style={{ padding: '4px 10px', display: 'flex', gap: 4, marginTop: 8 }}>
          <input autoFocus value={newProjName} onChange={(e) => setNewProjName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddProject(); if (e.key === 'Escape') setAddingProj(false); }}
            placeholder="Project name..."
            style={{ flex: 1, border: '1.5px solid var(--accent)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 6, padding: '4px 8px', fontSize: 13, outline: 'none' }} />
        </div>
      ) : (
        <button onClick={() => setAddingProj(true)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '8px 10px', borderRadius: 9, color: 'var(--text-3)', fontWeight: 700, fontSize: 14, marginTop: 8, border: 'none', background: 'transparent', cursor: 'pointer' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <I.plusSm size={18} /> Add project
        </button>
      )}

      <div style={{ flex: 1 }} />
      <div className="divider" style={{ margin: '10px 8px' }} />
      <NavItem icon={<I.logbook size={19} />} label="Completed" color="var(--today)" active={view.type === 'logbook'} onClick={() => setView({ type: 'logbook' })} />
      <NavItem icon={<I.settings size={19} />} label="Settings" onClick={() => {}} />
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
    case 'label': content = <V.LabelView labelId={view.id} density={density} />; break;
    case 'filters': content = <V.FiltersView />; break;
    case 'calendar': content = <CalendarView density={density} />; break;
    case 'logbook': content = <V.LogbookView />; break;
    default: content = <V.TodayView density={density} />;
  }
  return (
    <div className="scroll" style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: narrow ? '30px 28px 80px' : '34px 40px 80px' }}>{content}</div>
    </div>
  );
}

export function DesktopApp({ density, theme, onToggleTheme, frameW = 1320 }) {
  const {
    selectedId, setSelectedId, search, setSearch, quickAdd, setQuickAdd,
    sidebarWidth, setSidebarWidth, sidebarCollapsed
  } = useApp();
  const narrow = frameW < 1080;
  const [detailWidth, setDetailWidth] = useState(372);
  const isResizingRef = useRef(false);
  const isSidebarResizingRef = useRef(false);

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
          <Sidebar theme={theme} onToggleTheme={onToggleTheme} style={{ width: sidebarWidth }} />
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
    </div>
  );
}

export default DesktopApp;
