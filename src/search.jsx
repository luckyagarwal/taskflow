// search.jsx — search / quick-jump overlay
import React, { useState, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp } from './store.jsx';
import { Dot, DueBadge, useIsNarrow } from './ui.jsx';

export function SearchOverlay({ onClose }) {
  const { tasks, setView, setSelectedId, projects } = useApp();
  const narrow = useIsNarrow();
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  
  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const ql = q.trim().toLowerCase();
  const matchTasks = ql ? tasks.filter((t) =>
    t.title.toLowerCase().includes(ql) ||
    (t.note || '').toLowerCase().includes(ql)
  ).slice(0, 8) : [];
  const matchProjects = ql ? projects.filter((p) => p.name.toLowerCase().includes(ql)) : projects.slice(0, 4);

  const NAV = [
    { label: 'Today', icon: <I.today size={17} />, view: { type: 'today' }, color: 'var(--today)' },
    { label: 'Upcoming', icon: <I.upcoming size={17} />, view: { type: 'upcoming' }, color: 'var(--accent)' },
    { label: 'Inbox', icon: <I.inbox size={17} />, view: { type: 'inbox' }, color: 'var(--text-2)' },
    { label: 'Calendar', icon: <I.calendar size={17} />, view: { type: 'calendar' }, color: 'var(--accent)' },
    { label: 'Completed', icon: <I.logbook size={17} />, view: { type: 'logbook' }, color: 'var(--today)' },
  ].filter((n) => !ql || n.label.toLowerCase().includes(ql));

  const go = (view) => { setView(view); onClose(); };
  const open = (t) => { setSelectedId(t.id); onClose(); };

  const Row = ({ children, onClick }) => (
    <button onClick={onClick} className="pop-item" style={{ width: '100%', height: 42, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>{children}</button>
  );

  const shouldReduceMotion = useReducedMotion();

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: narrow ? 'stretch' : 'flex-start', justifyContent: 'center', paddingTop: narrow ? 0 : '8%', zIndex: 200, overflow: 'hidden' }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="scrim"
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1 }}
        onMouseDown={onClose}
      />
      <motion.div
        initial={narrow ? { y: '100%' } : { y: -20, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={narrow ? { y: '100%' } : { y: -20, opacity: 0, scale: 0.96 }}
        transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 32 }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          ...(narrow ? {
            position: 'absolute', inset: 0, background: 'var(--bg)'
          } : {
            width: 'min(620px, 92vw)', maxHeight: '74vh', background: 'var(--bg-elev)', borderRadius: 16,
            boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', overflow: 'hidden'
          })
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: narrow ? 'max(env(safe-area-inset-top), 12px) 14px 12px' : '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <I.search size={20} style={{ color: 'var(--text-3)' }} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={narrow ? 'Search or jump to…' : 'Search tasks, projects, or jump to a view…'}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontWeight: 600, color: 'var(--text)' }} />
          {narrow
            ? <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 15, fontWeight: 500, padding: '4px 4px', cursor: 'pointer' }}>Cancel</button>
            : <kbd style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', border: '1px solid var(--border-2)', borderRadius: 6, padding: '2px 6px' }}>ESC</kbd>}
        </div>

        <div className="scroll" style={{ overflowY: 'auto', padding: 8 }}>
          {ql && matchTasks.length > 0 && (
            <Section title="Tasks">
              {matchTasks.map((t) => {
                const proj = t.projectId !== 'inbox' ? (projects.find(p => p.id === t.projectId) || H.projectById(t.projectId)) : null;
                return (
                  <Row key={t.id} onClick={() => open(t)}>
                    <span style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${H.priorityColor(t.priority) || 'var(--check-empty)'}`, flex: 'none' }} />
                    <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    {(t.dueOffset !== null || t.startOffset !== null) && <DueBadge offset={t.dueOffset} startOffset={t.startOffset} time={t.time} startTime={t.startTime} small />}
                    {proj && <Dot color={proj.color} />}
                  </Row>
                );
              })}
            </Section>
          )}

          {NAV.length > 0 && (
            <Section title="Go to">
              {NAV.map((n) => (
                <Row key={n.label} onClick={() => go(n.view)}>
                  <span style={{ color: n.color, display: 'grid', placeItems: 'center', width: 18 }}>{n.icon}</span>
                  <span style={{ fontWeight: 600 }}>{n.label}</span>
                </Row>
              ))}
            </Section>
          )}

          {matchProjects.length > 0 && (
            <Section title="Projects">
              {matchProjects.map((p) => (
                <Row key={p.id} onClick={() => go({ type: 'project', id: p.id })}>
                  <Dot color={p.color} />
                  <span style={{ fontWeight: 600, flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-3)' }}>{p.group}</span>
                </Row>
              ))}
            </Section>
          )}

          {ql && matchTasks.length === 0 && matchProjects.length === 0 && NAV.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontWeight: 500 }}>No results for “{q}”</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div className="section-title" style={{ padding: '8px 10px 4px' }}>{title}</div>
      {children}
    </div>
  );
}
