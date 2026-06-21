// MobileApp.jsx — mobile app shell (inside iOS frame). Exposes MobileApp
import React, { useState, useEffect } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp, Sel } from './store.jsx';
import { orderedProjectsForSection, hasChildren, eligibleParents } from './projects.js';
import { Dot, BulkActionBar } from './ui.jsx';
import { Views as V } from './views.jsx';
import { BoardView } from './board.jsx';
import { CalendarView } from './calendar.jsx';
import { TaskDetail } from './detail.jsx';
import { SearchOverlay } from './search.jsx';
import { InlineComposer } from './composer.jsx';

const STATUS_PAD = 12; // floor for top inset; env(safe-area-inset-top) covers the notch/island in standalone mode

function MobileHeader({ visible }) {
  const { view } = useApp();
  const showBack = ['project', 'project-settings', 'inbox', 'calendar', 'logbook', 'filters', 'label', 'settings', 'saved-filter'].includes(view.type);

  if (showBack) return null;

  return (
    <div className="frosted-glass" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      padding: `calc(max(env(safe-area-inset-top), ${STATUS_PAD}px) + 4px) 18px 14px`,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: '1px solid var(--border)',
      zIndex: 50,
      transform: visible ? 'none' : 'translateY(-100%)',
      transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: 'linear-gradient(135deg, #2563EB, #8B5CF6)',
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        fontWeight: 800,
        fontSize: 14,
        flex: 'none',
        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
      }}>
        T
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em', color: 'var(--text)' }}>TaskFlow</span>
      </div>
    </div>
  );
}

function Tab({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="active-scale"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '10px 0 6px',
        border: 'none',
        background: 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-3)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'color 0.2s ease'
      }}
    >
      <div style={{
        transform: active ? 'scale(1.08)' : 'scale(1)',
        transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
        color: active ? 'var(--accent)' : 'var(--text-3)'
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: 10,
        fontWeight: active ? 800 : 600,
        letterSpacing: '0.01em',
        opacity: active ? 1 : 0.8
      }}>
        {label}
      </span>
      {active && (
        <div style={{
          position: 'absolute',
          top: 0,
          width: 20,
          height: 3,
          background: 'var(--accent)',
          borderRadius: '0 0 4px 4px',
          animation: 'fadeIn 0.15s ease-out'
        }} />
      )}
    </button>
  );
}

function TabBar({ visible }) {
  const { view, setView, setSearch } = useApp();
  const browseActive = ['browse', 'project', 'project-settings', 'inbox', 'calendar', 'logbook', 'filters', 'label', 'settings', 'saved-filter'].includes(view.type);
  return (
    <div className="frosted-glass" style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      alignItems: 'center',
      borderTop: '1px solid var(--border)',
      paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
      zIndex: 50,
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.02)',
      transform: visible ? 'none' : 'translateY(100%)',
      transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <Tab icon={<I.today size={20} />} label="Today" active={view.type === 'today'} onClick={() => setView({ type: 'today' })} />
      <Tab icon={<I.upcoming size={20} />} label="Upcoming" active={view.type === 'upcoming'} onClick={() => setView({ type: 'upcoming' })} />
      <Tab icon={<I.grid size={20} />} label="Browse" active={browseActive} onClick={() => setView({ type: 'browse' })} />
      <Tab icon={<I.search size={20} />} label="Search" active={false} onClick={() => setSearch(true)} />
    </div>
  );
}

function BrowseView({ onAddProject, onAddSection }) {
  const { setView, tasks, projects, sections, resetDatabase, deleteSection, updateSection, expandedIds, toggleExpand, savedFilters } = useApp();
  // A parent id present in expandedIds means COLLAPSED (reuses the store's
  // existing client-side toggle state; shared with desktop).
  const isCollapsed = (id) => expandedIds.includes(id);
  const c = Sel.counts(tasks);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editingSectionName, setEditingSectionName] = useState('');

  const Item = ({ icon, label, count, onClick }) => (
    <button onClick={onClick} className="active-scale" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, color: 'var(--text-2)' }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: 15, flex: 1, textAlign: 'left', color: 'var(--text)' }}>{label}</span>
      {count ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginRight: 4 }}>{count}</span> : null}
      <I.chevR size={15} style={{ color: 'var(--text-3)', opacity: 0.7 }} />
    </button>
  );

  const GridCard = ({ icon, label, count, color, onClick }) => (
    <button 
      onClick={onClick} 
      className="scandinavian-card active-scale"
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'flex-start', 
        gap: 12, 
        padding: '16px', 
        width: '100%', 
        cursor: 'pointer',
        textAlign: 'left',
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)'
      }}
    >
      <div style={{ 
        color: color || 'var(--accent)', 
        background: `color-mix(in srgb, ${color || 'var(--accent)'} 10%, var(--bg))` ,
        display: 'grid', 
        placeItems: 'center', 
        width: 38, 
        height: 38, 
        borderRadius: 10,
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <span style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--text)', letterSpacing: '-0.01em' }}>{label}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-3)', marginTop: 2 }}>
          {count !== undefined ? `${count} ${count === 1 ? 'task' : 'tasks'}` : 'Open view'}
        </span>
      </div>
    </button>
  );

  const startSectionEdit = (sec) => {
    setEditingSectionId(sec.id);
    setEditingSectionName(sec.name);
  };

  const commitSectionEdit = () => {
    if (!editingSectionId) return;
    const trimmed = editingSectionName.trim();
    const sec = sections.find(s => s.id === editingSectionId);
    if (sec && trimmed && trimmed !== sec.name) {
      if (!sections.some(s => s.id !== editingSectionId && s.name.toLowerCase() === trimmed.toLowerCase())) {
        updateSection(editingSectionId, { name: trimmed });
      }
    }
    setEditingSectionId(null);
  };

  return (
    <div>
      <V.ViewHeader icon={<span style={{ color: 'var(--accent)' }}><I.grid size={24} /></span>} title="Browse" subtitle="Jump to any list" />
      
      {/* 2x2 Grid of primary lists */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24, marginTop: 8 }}>
        <GridCard icon={<I.inbox size={20} />} label="Inbox" count={c.inbox} color="var(--text-2)" onClick={() => setView({ type: 'inbox' })} />
        <GridCard icon={<I.calendar size={20} />} label="Calendar" color="var(--accent)" onClick={() => setView({ type: 'calendar' })} />
        <GridCard icon={<I.grid size={20} />} label="Board" color="var(--text-2)" onClick={() => setView({ type: 'board' })} />
        <GridCard icon={<I.filter size={20} />} label="Filters & Labels" color="#8B5CF6" onClick={() => setView({ type: 'filters' })} />
        <GridCard icon={<I.logbook size={20} />} label="Completed" count={tasks.filter(t => t.done).length} color="var(--today)" onClick={() => setView({ type: 'logbook' })} />
      </div>

      {savedFilters.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-title" style={{ padding: '0 6px 8px', fontSize: 12, fontWeight: 800, color: 'var(--text-3)', letterSpacing: '0.05em' }}>Saved Filters</div>
          <div className="scandinavian-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
            {savedFilters.map((f, idx) => (
              <div key={f.id} style={{ borderBottom: idx < savedFilters.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <Item icon={<I.search size={16} />} label={f.name} onClick={() => setView({ type: 'saved-filter', id: f.id })} />
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.map((sec) => {
        const rows = orderedProjectsForSection(projects, sec.name)
          .filter(({ project, depth }) => !(depth === 1 && project.parent && isCollapsed(project.parent)));
        const isEditing = editingSectionId === sec.id;
        return (
          <div key={sec.id} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 6px 8px' }}>
              {isEditing ? (
                <input
                  autoFocus
                  value={editingSectionName}
                  onChange={(e) => setEditingSectionName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitSectionEdit(); if (e.key === 'Escape') setEditingSectionId(null); }}
                  onBlur={commitSectionEdit}
                  style={{
                    flex: 1, border: '1px solid var(--accent)', background: 'var(--bg)',
                    color: 'var(--text)', borderRadius: 8, padding: '6px 10px',
                    fontSize: 12, fontWeight: 800, textTransform: 'uppercase',
                    letterSpacing: '.06em', outline: 'none', minWidth: 0, marginRight: 8
                  }}
                />
              ) : (
                <div className="section-title" style={{ padding: 0, fontSize: 12, fontWeight: 800, color: 'var(--text-3)', letterSpacing: '0.05em' }}>{sec.name}</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isEditing) { commitSectionEdit(); } else { startSectionEdit(sec); }
                  }}
                  className="active-scale"
                  style={{ border: 'none', background: 'transparent', color: isEditing ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}
                  title="Rename section"
                >
                  <I.edit size={14} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Are you sure you want to delete the section "${sec.name}" and all its projects? Tasks will be moved to Inbox.`)) {
                      deleteSection(sec.id);
                    }
                  }}
                  className="active-scale"
                  style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}
                  title="Delete section"
                >
                  <I.trash size={14} />
                </button>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="scandinavian-card" style={{ padding: '16px', fontSize: 13.5, color: 'var(--text-3)', fontStyle: 'italic', background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
                No projects in this section
              </div>
            ) : (
              <div className="scandinavian-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-elev)', border: '1px solid var(--border)' }}>
                {rows.map(({ project: p, depth }, idx) => {
                  const parentHasKids = depth === 0 && hasChildren(projects, p.id);
                  const collapsed = isCollapsed(p.id);
                  return (
                    <div key={p.id} style={{ borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', paddingLeft: depth === 1 ? 24 : 0 }}>
                      {parentHasKids ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(p.id); }}
                          className="active-scale"
                          title={collapsed ? 'Expand' : 'Collapse'}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0 0 0 12px', display: 'grid', placeItems: 'center', color: 'var(--text-3)', transition: 'transform .15s', transform: collapsed ? 'rotate(-90deg)' : 'none', flex: 'none' }}
                        >
                          <I.chevD size={14} />
                        </button>
                      ) : null}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Item icon={<Dot color={p.color} size={10} />} label={p.name} count={Sel.byProject(tasks, p.id).length} onClick={() => setView({ type: 'project', id: p.id })} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Settings Row */}
      <div className="scandinavian-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-elev)', border: '1px solid var(--border)', marginTop: 24 }}>
        <Item icon={<I.settings size={16} />} label="Settings" onClick={() => setView({ type: 'settings' })} />
      </div>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28 }}>
        <button onClick={onAddProject} className="active-scale" style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 12,
          background: 'var(--hover)', color: 'var(--text)', fontWeight: 800, fontSize: 13.5,
          border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-sm)'
        }}>
          <I.plusSm size={18} /> Add Project
        </button>
        <button onClick={onAddSection} className="active-scale" style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 12,
          background: 'var(--hover)', color: 'var(--text)', fontWeight: 800, fontSize: 13.5,
          border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-sm)'
        }}>
          <I.plusSm size={18} /> Add Section
        </button>
      </div>
    </div>
  );
}

function MobileContent({ density, onAddProject, onAddSection }) {
  const { view } = useApp();
  switch (view.type) {
    case 'today': return <V.TodayView density={density} />;
    case 'upcoming': return <V.UpcomingView density={density} />;
    case 'inbox': return <V.InboxView density={density} />;
    case 'project': return <V.ProjectView projectId={view.id} density={density} />;
    case 'project-settings': return <V.ProjectSettingsView projectId={view.id} />;
    case 'label': return <V.LabelView labelId={view.id} density={density} />;
    case 'filters': return <V.FiltersView density={density} />;
    case 'saved-filter': return <V.SavedFilterView filterId={view.id} density={density} />;
    case 'calendar': return <CalendarView density={density} compact />;
    case 'board': return <BoardView />;
    case 'logbook': return <V.LogbookView />;
    case 'settings': return <V.SettingsView />;
    case 'browse': return <BrowseView onAddProject={onAddProject} onAddSection={onAddSection} />;
    default: return <V.TodayView density={density} />;
  }
}

function BackBar({ visible }) {
  const { view, setView } = useApp();
  const showBack = ['project', 'project-settings', 'inbox', 'calendar', 'logbook', 'filters', 'label', 'settings', 'saved-filter'].includes(view.type);
  if (!showBack) return null;
  return (
    <div className="frosted-glass" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      padding: `calc(max(env(safe-area-inset-top), ${STATUS_PAD}px) + 4px) 18px 14px`,
      display: 'flex',
      alignItems: 'center',
      borderBottom: '1px solid var(--border)',
      zIndex: 50,
      transform: visible ? 'none' : 'translateY(-100%)',
      transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <button 
        onClick={() => setView({ type: 'browse' })} 
        className="active-scale" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6, 
          color: 'var(--accent)', 
          fontWeight: 800, 
          fontSize: 18, 
          border: 'none', 
          background: 'transparent', 
          cursor: 'pointer',
          padding: '4px 0',
          margin: 0
        }}
      >
        <I.chevL size={22} style={{ strokeWidth: 3 }} /> Browse
      </button>
    </div>
  );
}

function QuickAddSheet({ onClose }) {
  // The iOS keyboard covers the lower part of the screen without shrinking the
  // layout viewport, so a vertically-centered sheet hides behind it. Track the
  // visualViewport and pin the composer just above the keyboard's top edge.
  const [bottomGap, setBottomGap] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      // How much of the layout viewport the keyboard (and bottom inset) occludes.
      const occluded = window.innerHeight - vv.height - vv.offsetTop;
      setBottomGap(Math.max(0, occluded));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);
  return (
    <div className="sheet-scrim" onMouseDown={onClose} style={{ display: 'flex', alignItems: 'flex-end' }}>
      <div 
        className="bottom-sheet" 
        onMouseDown={(e) => e.stopPropagation()} 
        style={{ width: '100%', padding: `20px 16px ${28 + bottomGap}px` }}
      >
        <div style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--border-2)', margin: '-10px auto 16px' }} />
        <InlineComposer variant="modal" autoOpen defaultDue={0} onDone={onClose} />
      </div>
    </div>
  );
}

function AddSectionModal({ onClose }) {
  const { addSection } = useApp();
  const [name, setName] = useState('');

  const handleAdd = () => {
    if (name.trim()) {
      addSection(name.trim());
      onClose();
    }
  };

  return (
    <div className="sheet-scrim" onMouseDown={onClose} style={{ display: 'flex', alignItems: 'flex-end' }}>
      <div 
        className="bottom-sheet"
        onMouseDown={(e) => e.stopPropagation()} 
        style={{ width: '100%' }}
      >
        {/* Grab Handle for Bottom Sheet */}
        <div style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--border-2)', margin: '-12px auto 20px' }} />
        
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16, color: 'var(--text)', letterSpacing: '-0.02em' }}>New Section</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input 
            autoFocus 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Section name (e.g. Work, Personal)..."
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            style={{ 
              width: '100%', 
              border: '1.5px solid var(--border)', 
              background: 'var(--bg)', 
              color: 'var(--text)', 
              borderRadius: 12, 
              padding: '12px 14px', 
              fontSize: 15, 
              outline: 'none',
              transition: 'border-color 0.2s'
            }} 
          />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={onClose} className="active-scale" style={{ border: 'none', background: 'transparent', color: 'var(--text-2)', fontSize: 14.5, fontWeight: 700, padding: '10px 16px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleAdd} className="active-scale" style={{ border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14.5, fontWeight: 800, padding: '10px 22px', borderRadius: 12, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>Add Section</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddProjectModal({ onClose }) {
  const { projects, sections, addSection, addProject } = useApp();
  const [name, setName] = useState('');
  const [group, setGroup] = useState(() => (sections && sections.length > 0 ? sections[0].name : 'Personal'));
  const [customGroup, setCustomGroup] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [parent, setParent] = useState('');

  // Eligible parents are top-level projects in the selected section. Choosing a
  // parent forces the new project's group to the parent's group (addProject).
  const parentOptions = isCustom ? [] : eligibleParents(projects, null).filter((p) => p.group === group);

  const handleAdd = () => {
    if (name.trim()) {
      let finalGroup = group;
      if (isCustom) {
        const cleaned = customGroup.trim();
        if (cleaned) {
          addSection(cleaned);
          finalGroup = cleaned;
        } else {
          finalGroup = 'Personal';
        }
      }
      addProject(name.trim(), finalGroup || 'Personal', parent || null);
      onClose();
    }
  };

  return (
    <div className="sheet-scrim" onMouseDown={onClose} style={{ display: 'flex', alignItems: 'flex-end' }}>
      <div 
        className="bottom-sheet"
        onMouseDown={(e) => e.stopPropagation()} 
        style={{ width: '100%' }}
      >
        {/* Grab Handle for Bottom Sheet */}
        <div style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--border-2)', margin: '-12px auto 20px' }} />

        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16, color: 'var(--text)', letterSpacing: '-0.02em' }}>New Project</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input 
            autoFocus 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Project name (e.g. Website, Groceries)..."
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            style={{ 
              width: '100%', 
              border: '1.5px solid var(--border)', 
              background: 'var(--bg)', 
              color: 'var(--text)', 
              borderRadius: 12, 
              padding: '12px 14px', 
              fontSize: 15, 
              outline: 'none',
              transition: 'border-color 0.2s'
            }} 
          />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-3)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Assign to Section</span>
            <select 
              value={group} 
              onChange={(e) => {
                setGroup(e.target.value);
                setIsCustom(e.target.value === '__new__');
                setParent('');
              }}
              style={{ 
                width: '100%', 
                border: '1.5px solid var(--border)', 
                background: 'var(--bg)', 
                color: 'var(--text)', 
                borderRadius: 12, 
                padding: '12px 14px', 
                fontSize: 14.5, 
                outline: 'none', 
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2395938E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 14px center',
                backgroundSize: '16px'
              }}
            >
              {sections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              <option value="__new__">+ Create New Section...</option>
            </select>
          </div>

          {isCustom && (
            <input
              value={customGroup}
              onChange={(e) => setCustomGroup(e.target.value)}
              placeholder="New section name..."
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              style={{
                width: '100%',
                border: '1.5px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 14.5,
                outline: 'none'
              }}
            />
          )}

          {!isCustom && parentOptions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-3)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Nest Under (optional)</span>
              <select
                value={parent}
                onChange={(e) => setParent(e.target.value)}
                style={{
                  width: '100%',
                  border: '1.5px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontSize: 14.5,
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2395938E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 14px center',
                  backgroundSize: '16px'
                }}
              >
                <option value="">None (top-level)</option>
                {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={onClose} className="active-scale" style={{ border: 'none', background: 'transparent', color: 'var(--text-2)', fontSize: 14.5, fontWeight: 700, padding: '10px 16px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleAdd} className="active-scale" style={{ border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14.5, fontWeight: 800, padding: '10px 22px', borderRadius: 12, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>Add Project</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileApp() {
  const { selectedId, setSelectedId, quickAdd, setQuickAdd, search, setSearch, toasts, density, multiSelectedIds, barsVisible, setBarsVisible } = useApp();
  const [addingProj, setAddingProj] = useState(false);
  const [addingSec, setAddingSec] = useState(false);
  const lastScrollTopRef = React.useRef(0);

  const handleScroll = (e) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop < 20) {
      if (!barsVisible) setBarsVisible(true);
    } else {
      const diff = scrollTop - lastScrollTopRef.current;
      if (diff > 5) {
        if (barsVisible) setBarsVisible(false);
      } else if (diff < -5) {
        if (!barsVisible) setBarsVisible(true);
      }
    }
    lastScrollTopRef.current = scrollTop;
  };

  const selecting = !!(multiSelectedIds && multiSelectedIds.length > 0);
  return (
    <div style={{
      position: 'relative',
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)'
    }}>
      <MobileHeader visible={barsVisible} />
      <BackBar visible={barsVisible} />
      <div 
        className="scroll" 
        onScroll={handleScroll}
        style={{ 
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          paddingTop: `calc(max(env(safe-area-inset-top), ${STATUS_PAD}px) + 56px)`,
          paddingBottom: `calc(max(env(safe-area-inset-bottom), 24px) + 56px)`
        }}
      >
        <div style={{ padding: '6px 12px 24px' }}>
          <MobileContent density={density} onAddProject={() => setAddingProj(true)} onAddSection={() => setAddingSec(true)} />
        </div>
      </div>

      {/* FAB — hidden during multi-select (contextual action bar takes over) */}
      {!selecting && (
        <button
          onClick={() => setQuickAdd(true)}
          className="active-scale"
          aria-label="Add task"
          style={{
            position: 'absolute', right: 20, bottom: 100, width: 56, height: 56, borderRadius: 18,
            background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center',
            boxShadow: '0 8px 24px color-mix(in srgb, var(--accent) 30%, transparent)', zIndex: 50,
            border: 'none', cursor: 'pointer',
            transform: barsVisible ? 'none' : 'translateY(68px)',
            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <I.plus size={26} />
        </button>
      )}

      <TabBar visible={barsVisible} />

      {selectedId && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 150, background: 'var(--bg)', animation: 'panelIn .2s ease' }}>
          <div style={{ height: `max(env(safe-area-inset-top), ${STATUS_PAD - 8}px)` }} />
          <div style={{ height: `calc(100% - max(env(safe-area-inset-top), ${STATUS_PAD - 8}px))` }}>
            <TaskDetail taskId={selectedId} onClose={() => setSelectedId(null)} mobile />
          </div>
        </div>
      )}
      {quickAdd && <QuickAddSheet onClose={() => setQuickAdd(false)} />}
      <BulkActionBar />
      {addingProj && <AddProjectModal onClose={() => setAddingProj(false)} />}
      {addingSec && <AddSectionModal onClose={() => setAddingSec(false)} />}
      {search && <SearchOverlay onClose={() => setSearch(false)} />}
      {toasts && toasts.length > 0 && (
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toasts.map(t => (
            <div key={t.id} style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '10px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13, color: 'var(--text)', animation: 'slideUp .2s ease-out' }}>
              {t.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MobileApp;

