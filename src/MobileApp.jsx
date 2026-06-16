// MobileApp.jsx — mobile app shell (inside iOS frame). Exposes MobileApp
import React, { useState } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp, Sel } from './store.jsx';
import { Dot } from './ui.jsx';
import { Views as V } from './views.jsx';
import { CalendarView } from './calendar.jsx';
import { TaskDetail } from './detail.jsx';
import { SearchOverlay } from './search.jsx';
import { InlineComposer } from './composer.jsx';

const STATUS_PAD = 50; // clear the iOS status bar / island

function MobileHeader({ theme, onToggleTheme }) {
  const { setSearch } = useApp();
  return (
    <div style={{ flex: 'none', padding: `${STATUS_PAD}px 16px 8px`, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)' }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg,#2D7FF9,#7C5CFC)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 13, flex: 'none' }}>M</span>
      <span style={{ fontWeight: 800, fontSize: 15, flex: 1 }}>Maya Iyer</span>
      <button className="icon-btn" style={{ border: 'none', background: 'transparent' }} onClick={() => setSearch(true)}><I.search size={20} /></button>
      <button className="icon-btn" style={{ border: 'none', background: 'transparent' }} onClick={onToggleTheme}><I.sun size={19} style={{ display: theme === 'dark' ? 'block' : 'none' }} /><I.moon size={19} style={{ display: theme !== 'dark' ? 'block' : 'none' }} /></button>
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
  const browseActive = ['browse', 'project', 'inbox', 'calendar', 'logbook', 'filters', 'label'].includes(view.type);
  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', borderTop: '1px solid var(--border)', background: 'var(--bg)', paddingBottom: 22 }}>
      <Tab icon={<I.today size={22} />} label="Today" active={view.type === 'today'} onClick={() => setView({ type: 'today' })} />
      <Tab icon={<I.upcoming size={22} />} label="Upcoming" active={view.type === 'upcoming'} onClick={() => setView({ type: 'upcoming' })} />
      <Tab icon={<I.grid size={22} />} label="Browse" active={browseActive} onClick={() => setView({ type: 'browse' })} />
      <Tab icon={<I.search size={22} />} label="Search" active={false} onClick={() => setSearch(true)} />
    </div>
  );
}

function BrowseView() {
  const { setView, tasks, projects } = useApp();
  const c = Sel.counts(tasks);
  
  const groups = {};
  projects.forEach((p) => { (groups[p.group] = groups[p.group] || []).push(p); });

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
      {Object.keys(groups).map((g) => (
        <div key={g}>
          <div className="section-title" style={{ padding: '20px 6px 6px' }}>{g}</div>
          {groups[g].map((p) => (
            <Item key={p.id} icon={<Dot color={p.color} size={12} />} label={p.name} count={Sel.byProject(tasks, p.id).length} onClick={() => setView({ type: 'project', id: p.id })} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MobileContent({ density }) {
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
    case 'browse': return <BrowseView />;
    default: return <V.TodayView density={density} />;
  }
}

function BackBar() {
  const { view, setView } = useApp();
  const showBack = ['project', 'inbox', 'calendar', 'logbook', 'filters', 'label'].includes(view.type);
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

export function MobileApp({ density, theme, onToggleTheme }) {
  const { selectedId, setSelectedId, quickAdd, setQuickAdd, search, setSearch } = useApp();
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <MobileHeader theme={theme} onToggleTheme={onToggleTheme} />
      <BackBar />
      <div className="scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '6px 16px 24px' }}><MobileContent density={density} /></div>
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
      {search && <SearchOverlay onClose={() => setSearch(false)} />}
    </div>
  );
}

export default MobileApp;
