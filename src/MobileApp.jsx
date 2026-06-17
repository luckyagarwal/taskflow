// MobileApp.jsx — mobile app shell (inside iOS frame). Exposes MobileApp
import React, { useState } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp, Sel } from './store.jsx';
import { Dot, BulkActionBar } from './ui.jsx';
import { Views as V } from './views.jsx';
import { CalendarView } from './calendar.jsx';
import { TaskDetail } from './detail.jsx';
import { SearchOverlay } from './search.jsx';
import { InlineComposer } from './composer.jsx';

const STATUS_PAD = 50; // clear the iOS status bar / island

function MobileHeader() {
  const { setSearch, theme, setTheme } = useApp();
  return (
    <div style={{
      flex: 'none',
      padding: `${STATUS_PAD}px 16px 12px`,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'var(--bg-elev)',
      borderBottom: '1px solid var(--border-2)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
      zIndex: 50
    }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#2D7FF9,#7C5CFC)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 13, flex: 'none' }}>C</span>
      <span style={{ fontWeight: 800, fontSize: 15, flex: 1 }}>Casex Tasks</span>
      <button className="icon-btn" style={{ border: 'none', background: 'transparent' }} onClick={() => setSearch(true)}><I.search size={20} /></button>
      <button className="icon-btn" style={{ border: 'none', background: 'transparent' }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><I.sun size={19} style={{ display: theme === 'dark' ? 'block' : 'none' }} /><I.moon size={19} style={{ display: theme !== 'dark' ? 'block' : 'none' }} /></button>
    </div>
  );
}

function Tab({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '7px 0', border: 'none', background: 'transparent', color: active ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer' }}>
      {icon}
      <span style={{ fontSize: 10.5, fontWeight: 700 }}>{label}</span>
    </button>
  );
}

function TabBar() {
  const { view, setView, setSearch } = useApp();
  const browseActive = ['browse', 'project', 'inbox', 'calendar', 'logbook', 'filters', 'label', 'settings'].includes(view.type);
  return (
    <div style={{
      flex: 'none',
      display: 'flex',
      alignItems: 'center',
      borderTop: '1px solid var(--border-2)',
      background: 'var(--bg-elev)',
      paddingBottom: 22,
      boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.05)',
      zIndex: 50
    }}>
      <Tab icon={<I.today size={22} />} label="Today" active={view.type === 'today'} onClick={() => setView({ type: 'today' })} />
      <Tab icon={<I.upcoming size={22} />} label="Upcoming" active={view.type === 'upcoming'} onClick={() => setView({ type: 'upcoming' })} />
      <Tab icon={<I.grid size={22} />} label="Browse" active={browseActive} onClick={() => setView({ type: 'browse' })} />
      <Tab icon={<I.search size={22} />} label="Search" active={false} onClick={() => setSearch(true)} />
    </div>
  );
}

function BrowseView({ onAddProject, onAddSection }) {
  const { setView, tasks, projects, sections, resetDatabase } = useApp();
  const c = Sel.counts(tasks);

  const Item = ({ icon, label, count, color, onClick }) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: '12px 6px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}>
      <span style={{ color: color || 'var(--text-2)', display: 'grid', placeItems: 'center', width: 22 }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: 15.5, flex: 1, textAlign: 'left', color: 'var(--text)' }}>{label}</span>
      {count ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)' }}>{count}</span> : null}
      <I.chevR size={17} style={{ color: 'var(--text-3)' }} />
    </button>
  );

  return (
    <div>
      <V.ViewHeader icon={<span style={{ color: 'var(--accent)' }}><I.grid size={24} /></span>} title="Browse" subtitle="Jump to any list" />
      <Item icon={<I.inbox size={20} />} label="Inbox" count={c.inbox} onClick={() => setView({ type: 'inbox' })} />
      <Item icon={<I.calendar size={20} />} label="Calendar" color="var(--accent)" onClick={() => setView({ type: 'calendar' })} />
      <Item icon={<I.filter size={20} />} label="Filters & Labels" color="var(--text-2)" onClick={() => setView({ type: 'filters' })} />
      <Item icon={<I.logbook size={20} />} label="Completed" color="var(--today)" onClick={() => setView({ type: 'logbook' })} />
      <Item icon={<I.settings size={20} />} label="Settings" color="var(--text-3)" onClick={() => setView({ type: 'settings' })} />
      {sections.map((sec) => {
        const secProjects = projects.filter(p => p.group === sec.name);
        return (
          <div key={sec.id}>
            <div className="section-title" style={{ padding: '20px 6px 6px' }}>{sec.name}</div>
            {secProjects.length === 0 ? (
              <div style={{ padding: '10px 6px', fontSize: 13.5, color: 'var(--text-3)', fontStyle: 'italic' }}>
                No projects
              </div>
            ) : (
              secProjects.map((p) => (
                <Item key={p.id} icon={<Dot color={p.color} size={12} />} label={p.name} count={Sel.byProject(tasks, p.id).length} onClick={() => setView({ type: 'project', id: p.id })} />
              ))
            )}
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
        <button onClick={onAddProject} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'var(--hover)', color: 'var(--accent)', fontWeight: 800, fontSize: 13.5,
          border: 'none', cursor: 'pointer', transition: 'background .12s'
        }}>
          <I.plusSm size={18} /> Add Project
        </button>
        <button onClick={onAddSection} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'var(--hover)', color: 'var(--accent)', fontWeight: 800, fontSize: 13.5,
          border: 'none', cursor: 'pointer', transition: 'background .12s'
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
    case 'label': return <V.LabelView labelId={view.id} density={density} />;
    case 'filters': return <V.FiltersView />;
    case 'calendar': return <CalendarView density={density} compact />;
    case 'logbook': return <V.LogbookView />;
    case 'settings': return <V.SettingsView />;
    case 'browse': return <BrowseView onAddProject={onAddProject} onAddSection={onAddSection} />;
    default: return <V.TodayView density={density} />;
  }
}

function BackBar() {
  const { view, setView } = useApp();
  const showBack = ['project', 'inbox', 'calendar', 'logbook', 'filters', 'label', 'settings'].includes(view.type);
  if (!showBack) return null;
  return (
    <button onClick={() => setView({ type: 'browse' })} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px 0', color: 'var(--accent)', fontWeight: 700, fontSize: 14.5, border: 'none', background: 'transparent', cursor: 'pointer' }}>
      <I.chevL size={18} /> Browse
    </button>
  );
}

function QuickAddSheet({ onClose }) {
  return (
    <div className="scrim" style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', zIndex: 200 }} onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', animation: 'slideUp .2s ease-out' }}>
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
    <div className="scrim" style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', zIndex: 200 }} onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 300, background: 'var(--bg-elev)', borderRadius: 14, border: '1px solid var(--border)', padding: 18, boxShadow: 'var(--shadow)', animation: 'slideUp .2s ease-out' }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14, color: 'var(--text)' }}>New Section</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Section name..."
            style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 8, padding: '10px 12px', fontSize: 14.5, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 14, fontWeight: 700, padding: '6px 12px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleAdd} style={{ border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 800, padding: '6px 16px', borderRadius: 8, cursor: 'pointer' }}>Add</button>
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
      addProject(name.trim(), finalGroup || 'Personal');
      onClose();
    }
  };

  return (
    <div className="scrim" style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', zIndex: 200 }} onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 300, background: 'var(--bg-elev)', borderRadius: 14, border: '1px solid var(--border)', padding: 18, boxShadow: 'var(--shadow)', animation: 'slideUp .2s ease-out' }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 14, color: 'var(--text)' }}>New Project</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name..."
            style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 8, padding: '10px 12px', fontSize: 14.5, outline: 'none' }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Section</span>
            <select value={group} onChange={(e) => {
              setGroup(e.target.value);
              setIsCustom(e.target.value === '__new__');
            }} style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 8, padding: '8px 10px', fontSize: 14, outline: 'none', cursor: 'pointer' }}>
              {sections.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              <option value="__new__">+ New Section...</option>
            </select>
          </div>

          {isCustom && (
            <input value={customGroup} onChange={(e) => setCustomGroup(e.target.value)} placeholder="New section name..."
              style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none' }} />
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 14, fontWeight: 700, padding: '6px 12px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleAdd} style={{ border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 800, padding: '6px 16px', borderRadius: 8, cursor: 'pointer' }}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileApp() {
  const { selectedId, setSelectedId, quickAdd, setQuickAdd, search, setSearch, toasts, density } = useApp();
  const [addingProj, setAddingProj] = useState(false);
  const [addingSec, setAddingSec] = useState(false);
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <MobileHeader />
      <BackBar />
      <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '6px 16px 24px' }}>
          <MobileContent density={density} onAddProject={() => setAddingProj(true)} onAddSection={() => setAddingSec(true)} />
        </div>
      </div>

      {/* FAB */}
      <button onClick={() => setQuickAdd(true)} style={{
        position: 'absolute', right: 18, bottom: 96, width: 56, height: 56, borderRadius: 18,
        background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center',
        boxShadow: '0 10px 26px color-mix(in srgb, var(--accent) 45%, transparent)', zIndex: 50,
        border: 'none', cursor: 'pointer',
      }}><I.plus size={26} /></button>

      <TabBar />

      {selectedId && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 150, background: 'var(--bg)', animation: 'panelIn .2s ease' }}>
          <div style={{ height: STATUS_PAD - 8 }} />
          <div style={{ height: `calc(100% - ${STATUS_PAD - 8}px)` }}>
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

