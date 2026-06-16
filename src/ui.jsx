// ui.jsx — shared presentational components
import React from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';

// ── Circular priority checkbox ───────────────────────────────
export function Checkbox({ done, priority = 4, onToggle, size = 20 }) {
  const pc = H.priorityColor(priority);
  const ring = pc || 'var(--check-empty)';
  const bg = done ? (pc || 'var(--accent)') : (pc ? `color-mix(in srgb, ${pc} 13%, transparent)` : 'transparent');
  return (
    <button
      className={'checkbox no-sel' + (done ? ' is-done' : '')}
      onClick={(e) => { e.stopPropagation(); onToggle && onToggle(); }}
      aria-label={done ? 'Mark incomplete' : 'Complete task'}
      style={{
        width: size, height: size,
        border: `2px solid ${done ? (pc || 'var(--accent)') : ring}`,
        background: bg,
      }}>
      <I.check size={size * 0.62} className="cb-check" />
    </button>
  );
}

// ── Project dot ─────────────────────────────────────────────
export function Dot({ color, size = 9 }) {
  return <span style={{ width: size, height: size, borderRadius: 999, background: color, flex: 'none', display: 'inline-block' }} />;
}

// ── Label chip ──────────────────────────────────────────────
export function LabelChip({ id, small }) {
  const l = H.labelById(id);
  if (!l) return null;
  return (
    <span className="chip" style={{
      color: l.color,
      background: `color-mix(in srgb, ${l.color} 13%, transparent)`,
      height: small ? 19 : 21, fontSize: small ? 11 : 12,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 99, background: l.color }} />
      {l.name}
    </span>
  );
}

// ── Due badge ───────────────────────────────────────────────
const TONE = { overdue: 'var(--p1)', today: 'var(--today)', soon: 'var(--p3)', future: 'var(--text-2)' };

export function DueBadge({ offset, time, small, startOffset }) {
  const label = H.dateRangeLabel(startOffset, offset, time);
  if (!label) return null;
  const d = H.dueLabel(offset) || H.dueLabel(startOffset);
  const c = TONE[d.tone] || 'var(--text-2)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: c, fontWeight: 700, fontSize: small ? 12 : 12.5 }}>
      <I.calendar size={13} sw={2} />
      {label}
    </span>
  );
}

function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

// ── Subtask progress mini ───────────────────────────────────
export function SubProgress({ subtasks }) {
  if (!subtasks || !subtasks.length) return null;
  const done = subtasks.filter((s) => s.done).length;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-2)', fontWeight: 700, fontSize: 12.5 }}>
      <I.logbook size={13} sw={2} />{done}/{subtasks.length}
    </span>
  );
}

// ── Segmented control ───────────────────────────────────────
export function Segmented({ value, onChange, options }) {
  return (
    <div className="seg no-sel">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

// ── Task row ────────────────────────────────────────────────
// density: 'comfortable' | 'compact' | 'card'
export function TaskRow({ task, onToggle, onOpen, selected, density = 'comfortable', showProject = true }) {
  const proj = task.projectId && task.projectId !== 'inbox' ? H.projectById(task.projectId) : null;
  const compact = density === 'compact';
  const card = density === 'card';
  const labels = task.labels || [];
  const hasMeta = (task.dueOffset !== null && task.dueOffset !== undefined && showProject !== 'inDate') ||
    (task.startOffset !== null && task.startOffset !== undefined && showProject !== 'inDate') ||
    labels.length || (task.subtasks && task.subtasks.length) || task.note;

  const pad = card ? '11px 13px' : compact ? '6px 8px' : '10px 8px';

  const meta = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: compact ? 1 : 4 }}>
      {showProject !== 'inDate' && <DueBadge offset={task.dueOffset} startOffset={task.startOffset} time={task.time} />}
      <SubProgress subtasks={task.subtasks} />
      {task.note ? <I.note size={13} style={{ color: 'var(--text-3)' }} /> : null}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {labels.map((id) => <LabelChip key={id} id={id} small />)}
      </div>
    </div>
  );

  return (
    <div
      className={'task-row no-sel' + (selected ? ' is-selected' : '') + (task.done ? ' is-done' : '') + (card ? ' task-card' : '')}
      style={{ padding: pad, marginBottom: card ? 8 : 0, display: 'flex', flexDirection: 'column' }}
      onClick={() => onOpen && onOpen(task)}>
      <div style={{ display: 'flex', width: '100%', alignItems: 'start', gap: 12 }}>
        <div style={{ paddingTop: compact ? 1 : 1.5, flexShrink: 0 }}>
          <Checkbox done={task.done} priority={task.priority} size={compact ? 18 : 20} onToggle={onToggle} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="task-title" style={{ fontSize: compact ? 14.5 : 15.5, fontWeight: 600, lineHeight: 1.34, color: 'var(--text)', wordBreak: 'break-word' }}>
            {task.title}
          </div>
          {hasMeta && (compact ? null : meta)}
          {compact && hasMeta && meta}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 1, paddingLeft: 4, flexShrink: 0 }}>
          {showProject && proj && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>
              {proj.name}<Dot color={proj.color} />
            </span>
          )}
          <button className="icon-btn row-hover" style={{ width: 28, height: 28 }} onClick={(e) => { e.stopPropagation(); onOpen && onOpen(task); }} aria-label="More">
            <I.dots size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────
export function Empty({ icon, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-3)' }}>
      <div style={{ display: 'inline-grid', placeItems: 'center', width: 64, height: 64, borderRadius: 18, background: 'var(--hover)', color: 'var(--text-3)', marginBottom: 16 }}>
        {icon}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-2)' }}>{title}</div>
      {sub && <div style={{ fontSize: 14, marginTop: 5, maxWidth: 320, marginInline: 'auto', lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

// ── Progress ring ───────────────────────────────────────────
export function Ring({ value, total, size = 22, color = 'var(--accent)' }) {
  const r = (size - 4) / 2, c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-2)" strokeWidth="2.5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .3s' }} />
    </svg>
  );
}
