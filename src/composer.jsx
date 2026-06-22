// composer.jsx — inline quick-add composer + popovers
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icons as I } from './icons.jsx';
import { H, parseTask } from './data.js';
import { useApp } from './store.jsx';
import { Dot, DueBadge } from './ui.jsx';
import { DateSelectorModal } from './detail.jsx';

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

// Web Speech API feature detection — used to conditionally render the dictation mic.
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const PRIO = [
  { p: 1, label: 'Priority 1', color: '#E44332' },
  { p: 2, label: 'Priority 2', color: '#F5A623' },
  { p: 3, label: 'Priority 3', color: '#2D7FF9' },
  { p: 4, label: 'Priority 4', color: 'var(--text-3)' },
];

// True on phone-width viewports (kept local to avoid a circular import with ui.jsx).
function usePopoverNarrow() {
  const q = '(max-width: 767px)';
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = (e) => setN(e.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return n;
}

export function Popover({ children, onClose, style }) {
  const ref = useRef(null);
  const narrow = usePopoverNarrow();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h, true);
    return () => document.removeEventListener('mousedown', h, true);
  }, [onClose]);

  // On mobile, present every picker as a bottom sheet instead of a desktop-anchored
  // popover — native app feel for editing due date, priority, labels, project, etc.
  // Portal up to .app-root so the fixed sheet escapes any ancestor overflow/
  // transform/stacking context (the scroll container or a swiped row) and always
  // sits above the tab bar — while staying inside the [data-theme] variable scope
  // (portaling to <body> would drop --bg-elev/--scrim and render unstyled).
  if (narrow) {
    const host = (typeof document !== 'undefined' && document.querySelector('.app-root')) || document.body;
    return createPortal(
      <>
        <div className="sheet-scrim" onMouseDown={onClose} />
        <div className="pop-sheet" ref={ref} onMouseDown={(e) => e.stopPropagation()}>
          <div className="sheet-handle" />
          {children}
        </div>
      </>,
      host
    );
  }
  return <div className="pop" ref={ref} style={style}>{children}</div>;
}

export function MiniCalendar({ startValue, dueValue, activeField, onChange }) {
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
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
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
          <div key={idx} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-3)' }}>{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((d, idx) => {
          const off = offOf(d);
          const inMonth = d.getMonth() === month;
          const isToday = off === 0;

          const isStart = startValue !== null && off === startValue;
          const isDue = dueValue !== null && off === dueValue;
          const inRange = startValue !== null && dueValue !== null && off > startValue && off < dueValue;

          let bg = 'transparent';
          let color = isToday ? 'var(--accent-text)' : 'var(--text)';
          let borderRadius = '6px';

          if (isStart || isDue) {
            bg = 'var(--accent)';
            color = '#fff';
            if (isStart && dueValue !== null && dueValue > startValue) {
              borderRadius = '6px 0 0 6px';
            } else if (isDue && startValue !== null && dueValue > startValue) {
              borderRadius = '0 6px 6px 0';
            }
          } else if (inRange) {
            bg = 'var(--active)';
            color = 'var(--accent-text)';
            borderRadius = '0';
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(off); }}
              style={{
                width: 24, height: 24, borderRadius, display: 'grid', placeItems: 'center',
                fontSize: 11, fontWeight: 500,
                background: bg,
                color,
                opacity: inMonth ? 1 : 0.35,
                border: isToday && !isStart && !isDue ? '1.5px solid var(--accent)' : 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { if (!isStart && !isDue && !inRange) e.currentTarget.style.background = 'var(--hover)'; }}
              onMouseLeave={(e) => { if (!isStart && !isDue && !inRange) e.currentTarget.style.background = 'transparent'; }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const Switch = ({ checked, onChange, label }) => {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', cursor: 'pointer', userSelect: 'none' }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-2)' }}>{label}</span>
      <div style={{ position: 'relative', width: 32, height: 18, background: checked ? 'var(--accent)' : 'var(--border-2)', borderRadius: 999, transition: 'background-color 0.2s' }}>
        <input type="checkbox" checked={checked} onChange={onChange} style={{ opacity: 0, width: 0, height: 0 }} />
        <div style={{
          position: 'absolute', top: 2, left: checked ? 16 : 2, width: 14, height: 14,
          borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }} />
      </div>
    </label>
  );
};

export function WhenPicker({ startOffset, dueOffset, value, time, onChange, onClose, showTimeField = true }) {
  const narrow = usePopoverNarrow();
  const initStart = startOffset !== undefined ? startOffset : null;
  const initDue = dueOffset !== undefined ? dueOffset : (value !== undefined ? value : null);

  const [start, setStart] = useState(initStart);
  const [due, setDue] = useState(initDue);
  const [timeVal, setTimeVal] = useState(time || '');
  const [hasEnd, setHasEnd] = useState(initStart !== null && initDue !== null && initStart !== initDue);
  const [includeTime, setIncludeTime] = useState(!!time);
  const [activeField, setActiveField] = useState(initStart !== null && initStart !== initDue ? 'due' : 'start');

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

  const updateDates = (newStart, newDue, newTime, nextHasEnd, nextIncludeTime) => {
    let finalStart = newStart;
    let finalDue = newDue;
    let finalTime = nextIncludeTime ? (newTime || timeVal || '12:00') : null;

    if (nextHasEnd) {
      if (finalStart === null && finalDue !== null) {
        finalStart = finalDue;
      } else if (finalStart !== null && finalDue === null) {
        finalDue = finalStart;
      } else if (finalStart === null && finalDue === null) {
        finalStart = 0;
        finalDue = 1;
      }
      if (typeof finalStart === 'number' && typeof finalDue === 'number') {
        if (finalStart > finalDue) {
          const temp = finalStart;
          finalStart = finalDue;
          finalDue = temp;
        }
      }
    } else {
      finalStart = null;
      if (finalDue === null && finalStart !== null) {
        finalDue = finalStart;
      }
    }

    setStart(finalStart);
    setDue(finalDue);
    setTimeVal(finalTime || '');
    onChange(finalStart, finalDue, finalTime);
  };

  const handleEndToggle = (e) => {
    const nextHasEnd = e.target.checked;
    setHasEnd(nextHasEnd);
    if (nextHasEnd) {
      const currentStart = start !== null ? start : (due !== null ? due : 0);
      const currentDue = due !== null ? (due > currentStart ? due : currentStart + 1) : currentStart + 1;
      setActiveField('due');
      updateDates(currentStart, currentDue, timeVal, true, includeTime);
    } else {
      updateDates(null, due !== null ? due : start, timeVal, false, includeTime);
    }
  };

  const handleTimeToggle = (e) => {
    const nextIncludeTime = e.target.checked;
    setIncludeTime(nextIncludeTime);
    updateDates(start, due, nextIncludeTime ? (timeVal || '12:00') : null, hasEnd, nextIncludeTime);
  };

  const handleQuickOpt = (opt) => {
    if (opt.off === null || opt.off === 'someday') {
      updateDates(null, opt.off, null, false, false);
      setHasEnd(false);
      setIncludeTime(false);
      onClose();
      return;
    }

    const targetTime = opt.time !== undefined ? opt.time : (includeTime ? timeVal : null);

    if (hasEnd) {
      if (activeField === 'start') {
        updateDates(opt.off, due, targetTime, true, includeTime || !!opt.time);
        setActiveField('due');
      } else {
        updateDates(start, opt.off, targetTime, true, includeTime || !!opt.time);
      }
      if (opt.time !== undefined) {
        setIncludeTime(true);
      }
    } else {
      updateDates(null, opt.off, targetTime, false, includeTime || !!opt.time);
      if (opt.time !== undefined) {
        setIncludeTime(true);
      }
      onClose();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: narrow ? '100%' : 230, padding: narrow ? '0 4px' : '2px 0' }} onClick={(e) => e.stopPropagation()}>
      {/* Date display buttons */}
      <div style={{ display: 'flex', gap: 8, padding: narrow ? '4px 8px 8px' : '8px 12px 4px' }}>
        <button
          type="button"
          onClick={() => setActiveField('start')}
          style={{
            flex: 1, padding: narrow ? '10px 10px' : '5px 8px', borderRadius: narrow ? 10 : 6, fontSize: narrow ? 14 : 12, fontWeight: 500,
            border: `1.5px solid ${activeField === 'start' ? 'var(--accent)' : 'var(--border)'}`,
            background: activeField === 'start' ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--bg)',
            color: activeField === 'start' ? 'var(--accent-text)' : 'var(--text-2)',
            textAlign: 'center',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: 9, opacity: 0.6, textTransform: 'uppercase', marginBottom: 2 }}>Start Date</div>
          {start !== null ? H.dueLabel(start).text : (due !== null && !hasEnd ? H.dueLabel(due).text : 'Select date')}
        </button>

        {hasEnd && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-3)' }}><I.arrowR size={14} /></div>
            <button
              type="button"
              onClick={() => setActiveField('due')}
              style={{
                flex: 1, padding: narrow ? '10px 10px' : '5px 8px', borderRadius: narrow ? 10 : 6, fontSize: narrow ? 14 : 12, fontWeight: 500,
                border: `1.5px solid ${activeField === 'due' ? 'var(--accent)' : 'var(--border)'}`,
                background: activeField === 'due' ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--bg)',
                color: activeField === 'due' ? 'var(--accent-text)' : 'var(--text-2)',
                textAlign: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ fontSize: 9, opacity: 0.6, textTransform: 'uppercase', marginBottom: 2 }}>End Date</div>
              {due !== null ? H.dueLabel(due).text : 'Select date'}
            </button>
          </>
        )}
      </div>

      <div className="divider" style={{ margin: '4px 0' }} />

      {/* Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Switch checked={hasEnd} onChange={handleEndToggle} label="End date" />
        {showTimeField && <Switch checked={includeTime} onChange={handleTimeToggle} label="Include time" />}
      </div>

      <div className="divider" style={{ margin: '4px 0' }} />

      {/* Quick options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '2px 4px' }}>
        {quickOpts.map((opt) => (
          <button
            key={opt.label}
            type="button"
            className="pop-item"
            style={{ height: narrow ? 48 : 28, fontSize: narrow ? 16 : 13, display: 'flex', alignItems: 'center', gap: narrow ? 12 : 8, padding: narrow ? '0 10px' : '0 8px' }}
            onClick={(e) => {
              e.stopPropagation();
              handleQuickOpt(opt);
            }}
          >
            <span style={{ color: opt.color, display: 'grid', placeItems: 'center', width: narrow ? 20 : 14 }}>{narrow ? React.cloneElement(opt.icon, { size: 18 }) : opt.icon}</span>
            <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>{opt.label}</span>
          </button>
        ))}
      </div>

      <div className="divider" style={{ margin: '4px 0' }} />

      {/* Mini calendar */}
      <MiniCalendar
        startValue={start}
        dueValue={hasEnd ? due : null}
        activeField={activeField}
        onChange={(off) => {
          if (hasEnd) {
            if (activeField === 'start') {
              updateDates(off, due, timeVal, true, includeTime);
              setActiveField('due');
            } else {
              updateDates(start, off, timeVal, true, includeTime);
            }
          } else {
            updateDates(null, off, timeVal, false, includeTime);
            onClose();
          }
        }}
      />

      {includeTime && showTimeField && (
        <>
          <div className="divider" style={{ margin: '4px 0' }} />
          {/* Time input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px 6px' }}>
            <span style={{ color: 'var(--text-3)', display: 'grid', placeItems: 'center' }}><I.clock size={13} /></span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Time</span>
            <input
              type="time"
              value={timeVal}
              onChange={(e) => updateDates(start, due, e.target.value, hasEnd, includeTime)}
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

      {(hasEnd || includeTime) && (
        <div style={{ padding: '4px 12px 6px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '4px 12px', borderRadius: 6, background: 'var(--accent)', color: '#fff',
              fontSize: 12, fontWeight: 500, transition: 'opacity 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = 0.85}
            onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function PillBtn({ icon, label, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px',
      borderRadius: 8, fontSize: 13, fontWeight: 500,
      border: `1.5px solid ${active ? 'transparent' : 'var(--border-2)'}`,
      background: active ? `color-mix(in srgb, ${color} 14%, transparent)` : 'transparent',
      color: active ? color : 'var(--text-2)', whiteSpace: 'nowrap',
    }}>{icon}{label}</button>
  );
}

export function InlineComposer({ defaultProject = 'inbox', defaultStart = null, defaultDue = null, defaultTime = null, defaultDuration = null, variant = 'inline', autoOpen = false, onDone }) {
  const { addTask, setView, projects, labels: storeLabels } = useApp();
  const [open, setOpen] = useState(autoOpen);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [start, setStart] = useState(defaultStart);
  const [due, setDue] = useState(defaultDue);
  const [time, setTime] = useState(defaultTime);
  const [duration, setDuration] = useState(defaultDuration);
  const [prio, setPrio] = useState(4);
  const [project, setProject] = useState(defaultProject);
  const [labels, setLabels] = useState([]);
  const [menu, setMenu] = useState(null); // 'due' | 'prio' | 'proj' | 'label'
  const [parsed, setParsed] = useState(null);
  const inputRef = useRef(null);
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);

  const startDictation = () => {
    if (!SR) return;
    if (listening && recogRef.current) {
      recogRef.current.stop();
      return;
    }
    const r = new SR();
    recogRef.current = r;
    r.lang = navigator.language || 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setTitle((prev) => (prev ? prev + ' ' + t : t));
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start();
    setListening(true);
  };

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  useEffect(() => {
    if (title.trim()) {
      setParsed(parseTask(title, projects, storeLabels));
    } else {
      setParsed(null);
    }
  }, [title, projects, storeLabels]);

  const reset = () => { setTitle(''); setNote(''); setStart(defaultStart); setDue(defaultDue); setTime(defaultTime); setDuration(defaultDuration); setPrio(4); setLabels([]); setProject(defaultProject); setParsed(null); };
  const submit = (keepOpen) => {
    if (!title.trim()) return;
    const taskData = parseTask(title, projects, storeLabels);
    addTask({
      title: taskData.content,
      note: note.trim(),
      startOffset: start,
      dueOffset: taskData.dueOffset !== null ? taskData.dueOffset : due,
      time: taskData.time || time || null,
      duration: duration || null,
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
    const defaultDueOpt = defaultDue === 'someday'
      ? { label: 'Someday', color: '#E8588A' }
      : (defaultDue !== null ? { label: H.dueLabel(defaultDue)?.text, color: 'var(--text-2)' } : null);

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
        <span style={{ flex: 1, textAlign: 'left' }}>Add task</span>
        {defaultDueOpt && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 500, color: defaultDueOpt.color,
            padding: '2px 8px', borderRadius: 99, background: 'var(--hover)',
            marginRight: 4
          }}>
            <I.calendar size={12} />
            {defaultDueOpt.label}
          </span>
        )}
      </button>
    );
  }

  const dueOpt = due === 'someday'
    ? { label: 'Someday', color: '#E8588A' }
    : (DUE_OPTIONS.find((d) => d.off === due) || (due !== null ? { label: H.dueLabel(due).text, color: 'var(--today)' } : null));
  const prioOpt = PRIO.find((p) => p.p === prio);
  const proj = project === 'inbox' ? { id: 'inbox', name: 'Inbox', color: 'var(--text-3)' } : (projects.find(p => p.id === project) || H.projectById(project));

  const finalDue = (parsed && parsed.dueOffset !== null) ? parsed.dueOffset : due;
  const finalTime = (parsed && parsed.time) ? parsed.time : time;
  const finalLabels = (parsed && parsed.labels.length) ? parsed.labels : labels;
  const finalPrio = (parsed && parsed.priority !== 4) ? parsed.priority : prio;
  const finalProj = (parsed && parsed.projectId) ? (parsed.projectId.startsWith('__new__') ? { name: parsed.projectId.replace('__new__', ''), color: '#7C5CFC' } : (projects.find(p => p.id === parsed.projectId) || H.projectById(parsed.projectId))) : proj;
  const finalRecurring = parsed?.recurring;

  const finalDueOpt = finalDue === 'someday'
    ? { label: 'Someday', color: '#E8588A' }
    : (DUE_OPTIONS.find((d) => d.off === finalDue) || (finalDue !== null ? { label: H.dueLabel(finalDue)?.text, color: 'var(--today)' } : null));
  const finalPrioOpt = PRIO.find((p) => p.p === finalPrio) || prioOpt;

  return (
    <div style={{
      border: '1.5px solid var(--border-2)', borderRadius: 14, background: 'var(--bg-elev)',
      boxShadow: 'var(--shadow-md)', padding: '12px 14px 10px', animation: 'slideUp .16s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input ref={inputRef} className="no-sel" value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(true); if (e.key === 'Escape') close(); }}
          placeholder="Task name"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, fontWeight: 500, color: 'var(--text)' }} />
        {SR && (
          <button
            type="button"
            onClick={startDictation}
            title={listening ? 'Stop dictation' : 'Dictate task'}
            aria-label={listening ? 'Stop dictation' : 'Dictate task'}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              border: 'none', cursor: 'pointer',
              background: listening ? 'var(--p1)' : 'transparent',
              color: listening ? '#fff' : 'var(--text-3)',
              transition: 'background .15s, color .15s',
            }}
          >
            <I.mic size={17} />
          </button>
        )}
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(true); if (e.key === 'Escape') close(); }}
        placeholder="Description"
        style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, fontWeight: 500, color: 'var(--text-2)', marginTop: 4 }} />



      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <PillBtn
            icon={<I.calendar size={15} sw={2} />}
            label={(start !== null || finalDue !== null) ? H.dateRangeLabel(start, finalDue, finalTime) : 'Date'}
            color={(finalDueOpt || (start !== null ? { color: 'var(--today)' } : null))?.color || 'var(--text-2)'}
            active={start !== null || finalDue !== null}
            onClick={() => setMenu(menu === 'due' ? null : 'due')}
          />
          {menu === 'due' && (
            <DateSelectorModal
              startOffset={start}
              dueOffset={due}
              time={time}
              onChange={(startVal, dueVal, newTime) => {
                setStart(startVal);
                setDue(dueVal);
                setTime(newTime);
              }}
              onClose={() => setMenu(null)}
            />
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <PillBtn icon={<I.flag size={15} sw={2} />} label={finalPrio < 4 ? `P${finalPrio}` : 'Priority'} color={finalPrioOpt.color} active={finalPrio < 4} onClick={() => setMenu(menu === 'prio' ? null : 'prio')} />
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
          <PillBtn icon={<I.tag size={15} sw={2} />} label={finalLabels.length ? `${finalLabels.length} label${finalLabels.length > 1 ? 's' : ''}` : 'Label'} color="#7C5CFC" active={finalLabels.length > 0} onClick={() => setMenu(menu === 'label' ? null : 'label')} />
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
            fontSize: 13, fontWeight: 500, color: 'var(--text-2)', border: '1.5px solid var(--border-2)',
          }}>
            <Dot color={finalProj.color} />{finalProj.name}<I.chevD size={14} />
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

export function QuickAddModal({ onClose, defaultProject = 'inbox', defaultDue = null, prefill = null }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="scrim" style={{ position: 'absolute', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10%', zIndex: 200 }} onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(580px,92vw)', animation: 'slideUp .16s ease' }}>
        <InlineComposer
          variant="modal"
          autoOpen
          defaultProject={defaultProject}
          defaultDue={prefill && prefill.dueOffset != null ? prefill.dueOffset : defaultDue}
          defaultTime={prefill ? prefill.time : null}
          defaultDuration={prefill ? prefill.duration : null}
          onDone={onClose}
        />
      </div>
    </div>
  );
}
