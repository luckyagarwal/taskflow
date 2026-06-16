// composer.jsx — inline quick-add composer + popovers
import React, { useState, useRef, useEffect } from 'react';
import { Icons as I } from './icons.jsx';
import { H, parseTask } from './data.js';
import { useApp } from './store.jsx';
import { Dot } from './ui.jsx';

export const DUE_OPTIONS = [
  { label: 'Today', off: 0, color: 'var(--today)', icon: (p) => <I.today {...p} /> },
  { label: 'Tomorrow', off: 1, color: '#C9851F', icon: (p) => <I.arrowR {...p} /> },
  { label: 'This weekend', off: weekendOffset(), color: 'var(--p3)', icon: (p) => <I.calendar {...p} /> },
  { label: 'Next week', off: 7, color: '#7C5CFC', icon: (p) => <I.upcoming {...p} /> },
  { label: 'No date', off: null, color: 'var(--text-3)', icon: (p) => <I.x {...p} /> },
];

function weekendOffset() {
  const d = new Date().getDay();
  return ((6 - d) + 7) % 7 || 6;
}

export const PRIO = [
  { p: 1, label: 'Priority 1', color: '#E44332' },
  { p: 2, label: 'Priority 2', color: '#F5A623' },
  { p: 3, label: 'Priority 3', color: '#2D7FF9' },
  { p: 4, label: 'Priority 4', color: 'var(--text-3)' },
];

export function Popover({ children, onClose, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [onClose]);
  return <div className="pop" ref={ref} style={style}>{children}</div>;
}

export function MiniCalendar({ value, onChange }) {
  const today = H.startOfToday();
  const [monthShift, setMonthShift] = useState(0);

  const base = new Date(today.getFullYear(), today.getMonth() + monthShift, 1);
  const year = base.getFullYear(), month = base.getMonth();
  const day = base.getDay();
  const firstDow = day === 0 ? 6 : day - 1; // Monday-first

  const cells = [];
  const gridStart = new Date(year, month, 1 - firstDow);
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }

  const offOf = (d) => Math.round((new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / H.MS_DAY);

  return (
    <div style={{ padding: '6px 8px 4px', userSelect: 'none' }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>
          {H.MONTHS_LONG[month]} {year}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={(e) => { e.stopPropagation(); setMonthShift(m => m - 1); }}>
            <I.chevL size={13} />
          </button>
          <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={(e) => { e.stopPropagation(); setMonthShift(m => m + 1); }}>
            <I.chevR size={13} />
          </button>
        </div>
      </div>

      {/* Week days */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4, gap: 2 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, idx) => (
          <div key={idx} style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: 'var(--text-3)' }}>{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((d, idx) => {
          const off = offOf(d);
          const inMonth = d.getMonth() === month;
          const isToday = off === 0;
          const isSel = off === value;
          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(off); }}
              style={{
                width: 24, height: 24, borderRadius: 6, display: 'grid', placeItems: 'center',
                fontSize: 11, fontWeight: 700,
                background: isSel ? 'var(--accent)' : 'transparent',
                color: isSel ? '#fff' : (isToday ? 'var(--accent-text)' : 'var(--text)'),
                opacity: inMonth ? 1 : 0.35,
                border: isToday && !isSel ? '1.5px solid var(--accent)' : 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'var(--hover)'; }}
              onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WhenPicker({ value, time, onChange, onClose, showTimeField = true }) {
  const [timeVal, setTimeVal] = useState(time || '');

  const quickOpts = [
    { label: 'Today', off: 0, color: 'var(--today)', icon: <I.today size={14} /> },
    { label: 'This Evening', off: 0, time: '18:00', color: '#F5A623', icon: <I.moon size={14} /> },
    { label: 'Tomorrow', off: 1, color: '#C9851F', icon: <I.arrowR size={14} /> },
    { label: 'This Weekend', off: weekendOffset(), color: 'var(--p3)', icon: <I.calendar size={14} /> },
    { label: 'Next Week', off: (() => {
        const d = new Date().getDay();
        return ((1 - d + 7) % 7) || 7;
      })(), color: '#7C5CFC', icon: <I.upcoming size={14} /> },
    { label: 'Someday', off: 'someday', color: '#E8588A', icon: <I.star size={14} /> },
    { label: 'Clear', off: null, color: 'var(--text-3)', icon: <I.x size={14} /> },
  ];

  const handleTimeChange = (newVal) => {
    setTimeVal(newVal);
    onChange(value, newVal || null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 200, padding: '2px 0' }} onClick={(e) => e.stopPropagation()}>
      {/* Quick options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '2px 4px' }}>
        {quickOpts.map((opt) => (
          <button
            key={opt.label}
            type="button"
            className="pop-item"
            style={{ height: 28, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px' }}
            onClick={(e) => {
              e.stopPropagation();
              onChange(opt.off, opt.time !== undefined ? opt.time : (opt.off === null || opt.off === 'someday' ? null : time));
              onClose();
            }}
          >
            <span style={{ color: opt.color, display: 'grid', placeItems: 'center', width: 14 }}>{opt.icon}</span>
            <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>{opt.label}</span>
          </button>
        ))}
      </div>

      <div className="divider" style={{ margin: '4px 0' }} />

      {/* Mini calendar */}
      <MiniCalendar value={typeof value === 'number' ? value : null} onChange={(off) => { onChange(off, time); onClose(); }} />

      {showTimeField && (
        <>
          <div className="divider" style={{ margin: '4px 0' }} />
          {/* Time input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px 6px' }}>
            <span style={{ color: 'var(--text-3)', display: 'grid', placeItems: 'center' }}><I.clock size={13} /></span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>Time</span>
            <input
              type="time"
              value={timeVal}
              onChange={(e) => handleTimeChange(e.target.value)}
              style={{
                flex: 1,
                border: '1px solid var(--border-2)',
                background: 'var(--bg)',
                color: 'var(--text)',
                borderRadius: 5,
                padding: '1px 4px',
                fontSize: 11.5,
                outline: 'none',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function PillBtn({ icon, label, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px',
      borderRadius: 8, fontSize: 13, fontWeight: 700,
      border: `1.5px solid ${active ? 'transparent' : 'var(--border-2)'}`,
      background: active ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
      color: active ? color : 'var(--text-2)', whiteSpace: 'nowrap',
    }}>{icon}{label}</button>
  );
}

export function InlineComposer({ defaultProject = 'inbox', defaultDue = null, variant = 'inline', autoOpen = false, onDone }) {
  const { addTask, setView, projects, labels: storeLabels } = useApp();
  const [open, setOpen] = useState(autoOpen);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [due, setDue] = useState(defaultDue);
  const [time, setTime] = useState(null);
  const [prio, setPrio] = useState(4);
  const [project, setProject] = useState(defaultProject);
  const [labels, setLabels] = useState([]);
  const [menu, setMenu] = useState(null); // 'due' | 'prio' | 'proj' | 'label'
  const [parsed, setParsed] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  useEffect(() => {
    if (title.trim()) {
      setParsed(parseTask(title, projects, storeLabels));
    } else {
      setParsed(null);
    }
  }, [title, projects, storeLabels]);

  const reset = () => { setTitle(''); setNote(''); setDue(defaultDue); setTime(null); setPrio(4); setLabels([]); setProject(defaultProject); setParsed(null); };
  const submit = (keepOpen) => {
    if (!title.trim()) return;
    const taskData = parseTask(title, projects, storeLabels);
    addTask({
      title: taskData.content,
      note: note.trim(),
      dueOffset: taskData.dueOffset !== null ? taskData.dueOffset : due,
      time: taskData.time || time || null,
      priority: taskData.priority !== 4 ? taskData.priority : prio,
      projectId: taskData.projectId || project,
      labels: taskData.labels.length ? taskData.labels : labels,
      recurring: taskData.recurring
    });
    reset();
    if (keepOpen) { setTimeout(() => inputRef.current && inputRef.current.focus(), 0); }
    else { setOpen(false); onDone && onDone(); }
  };
  const close = () => { setOpen(false); reset(); setMenu(null); onDone && onDone(); };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="no-sel" style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 8px',
        color: 'var(--text-3)', fontSize: 15, fontWeight: 600, borderRadius: 10,
      }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-3)'}>
        <span style={{ display: 'grid', placeItems: 'center', width: 20, height: 20, borderRadius: 999, color: 'var(--accent)' }}>
          <I.plusSm size={18} />
        </span>
        Add task
      </button>
    );
  }

  const dueOpt = due === 'someday'
    ? { label: 'Someday', color: '#E8588A' }
    : (DUE_OPTIONS.find((d) => d.off === due) || (due !== null ? { label: H.dueLabel(due).text, color: 'var(--today)' } : null));
  const prioOpt = PRIO.find((p) => p.p === prio);
  const proj = project === 'inbox' ? { name: 'Inbox', color: 'var(--text-3)' } : (projects.find(p => p.id === project) || H.projectById(project));

  return (
    <div style={{
      border: '1.5px solid var(--border-2)', borderRadius: 14, background: 'var(--bg-elev)',
      boxShadow: 'var(--shadow-md)', padding: '12px 14px 10px', animation: 'slideUp .16s ease',
    }}>
      <input ref={inputRef} className="no-sel" value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(true); if (e.key === 'Escape') close(); }}
        placeholder="Task name"
        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontWeight: 700, color: 'var(--text)' }} />
      <input value={note} onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(true); if (e.key === 'Escape') close(); }}
        placeholder="Description"
        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, fontWeight: 500, color: 'var(--text-2)', marginTop: 4 }} />

      {parsed && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, padding: '4px 2px' }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center' }}>Preview:</span>
          {parsed.dueOffset !== null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--hover)', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'var(--today)' }}>
              <I.calendar size={11} />
              {H.dueLabel(parsed.dueOffset).text}
            </span>
          )}
          {parsed.time && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--hover)', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>
              <I.clock size={11} />
              {parsed.time}
            </span>
          )}
          {parsed.priority !== 4 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--hover)', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: PRIO.find(p => p.p === parsed.priority)?.color || 'var(--text-3)' }}>
              <I.flag size={11} />
              P{parsed.priority}
            </span>
          )}
          {parsed.projectId && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--hover)', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
              <Dot color={parsed.projectId.startsWith('__new__') ? '#7C5CFC' : (projects.find(p => p.id === parsed.projectId) || {color:'#7C5CFC'}).color} size={6} />
              {parsed.projectId.startsWith('__new__') ? parsed.projectId.replace('__new__', '') : (projects.find(p => p.id === parsed.projectId) || {name:''}).name}
            </span>
          )}
          {parsed.labels.map(lId => {
            const isNew = lId.startsWith('__new__');
            const name = isNew ? lId.replace('__new__', '') : (storeLabels.find(l => l.id === lId) || {name:''}).name;
            const color = isNew ? '#7C5CFC' : (storeLabels.find(l => l.id === lId) || {color:'#7C5CFC'}).color;
            return (
              <span key={lId} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--hover)', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, color }}>
                <span style={{ width: 4, height: 4, borderRadius: 99, background: color }} />
                {name}
              </span>
            );
          })}
          {parsed.recurring && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--hover)', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: 'var(--accent-text)' }}>
              <I.repeat size={11} />
              {parsed.recurring.type === 'weekday' ? `Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parsed.recurring.dow]}` : `Every ${parsed.recurring.type}`}
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <PillBtn icon={<I.calendar size={15} sw={2} />} label={due !== null && dueOpt ? dueOpt.label : 'Due date'} color={dueOpt ? dueOpt.color : 'var(--text-2)'} active={due !== null} onClick={() => setMenu(menu === 'due' ? null : 'due')} />
          {menu === 'due' && (
            <Popover onClose={() => setMenu(null)} style={{ top: 36, left: 0, minWidth: 200 }}>
              <WhenPicker value={due} time={time} onChange={(val, newTime) => {
                setDue(val);
                setTime(newTime);
              }} onClose={() => setMenu(null)} />
            </Popover>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <PillBtn icon={<I.flag size={15} sw={2} />} label={prio < 4 ? `P${prio}` : 'Priority'} color={prioOpt.color} active={prio < 4} onClick={() => setMenu(menu === 'prio' ? null : 'prio')} />
          {menu === 'prio' && (
            <Popover onClose={() => setMenu(null)} style={{ top: 36, left: 0, minWidth: 160 }}>
              {PRIO.map((p) => (
                <div key={p.p} className="pop-item" onClick={() => { setPrio(p.p); setMenu(null); }}>
                  <I.flag size={16} sw={2} style={{ color: p.color }} />{p.label}
                </div>
              ))}
            </Popover>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <PillBtn icon={<I.tag size={15} sw={2} />} label={labels.length ? `${labels.length} label${labels.length > 1 ? 's' : ''}` : 'Label'} color="#7C5CFC" active={labels.length > 0} onClick={() => setMenu(menu === 'label' ? null : 'label')} />
          {menu === 'label' && (
            <Popover onClose={() => setMenu(null)} style={{ top: 36, left: 0, minWidth: 180 }}>
              {storeLabels.map((l) => (
                <div key={l.id} className="pop-item" onClick={() => setLabels((ls) => ls.includes(l.id) ? ls.filter((x) => x !== l.id) : [...ls, l.id])}>
                  <span style={{ width: 9, height: 9, borderRadius: 99, background: l.color }} />{l.name}
                  {labels.includes(l.id) && <I.check size={15} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
                </div>
              ))}
            </Popover>
          )}
        </div>

        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button onClick={() => setMenu(menu === 'proj' ? null : 'proj')} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 10px', borderRadius: 8,
            fontSize: 13, fontWeight: 700, color: 'var(--text-2)', border: '1.5px solid var(--border-2)',
          }}>
            <Dot color={proj.color} />{proj.name}<I.chevD size={14} />
          </button>
          {menu === 'proj' && (
            <Popover onClose={() => setMenu(null)} style={{ top: 36, right: 0, minWidth: 200 }}>
              <div className="pop-item" onClick={() => { setProject('inbox'); setMenu(null); }}>
                <I.inbox size={16} style={{ color: 'var(--text-2)' }} />Inbox
              </div>
              <div className="divider" style={{ margin: '4px 8px' }} />
              {projects.map((p) => (
                <div key={p.id} className="pop-item" onClick={() => { setProject(p.id); setMenu(null); }}>
                  <Dot color={p.color} />{p.name}
                </div>
              ))}
            </Popover>
          )}
        </div>
      </div>

      <div className="divider" style={{ margin: '11px -14px 9px' }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-ghost" style={{ height: 33 }} onClick={close}>Cancel</button>
        <button className="btn btn-primary" style={{ height: 33, opacity: title.trim() ? 1 : .5, pointerEvents: title.trim() ? 'auto' : 'none' }} onClick={() => submit(false)}>Add task</button>
      </div>
    </div>
  );
}

export function QuickAddModal({ onClose, defaultProject = 'inbox', defaultDue = null }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="scrim" style={{ position: 'absolute', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10%', zIndex: 200 }} onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(580px,92vw)', animation: 'slideUp .16s ease' }}>
        <InlineComposer variant="modal" autoOpen defaultProject={defaultProject} defaultDue={defaultDue} onDone={onClose} />
      </div>
    </div>
  );
}
