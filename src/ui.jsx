// ui.jsx — shared presentational components
import React from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp } from './store.jsx';
import { Popover, WhenPicker, PRIO } from './composer.jsx';

// ── Circular priority checkbox ───────────────────────────────
export function Checkbox({ done, priority = 4, onToggle, size = 20 }) {
  const pc = H.priorityColor(priority);
  const ring = pc || 'var(--check-empty)';
  const bg = done ? (pc || 'var(--accent)') : (pc ? `color-mix(in srgb, ${pc} 13%, transparent)` : 'transparent');
  return (
    <button
      className={'checkbox no-sel' + (done ? ' is-done' : '')}
      onClick={(e) => { e.stopPropagation(); onToggle && onToggle(e); }}
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
  const labelText = H.dateRangeLabel(startOffset, offset, time);
  if (!labelText) return null;

  const mainOffset = offset !== null && offset !== undefined ? offset : startOffset;
  const mainLbl = H.dueLabel(mainOffset);
  const color = mainLbl ? (TONE[mainLbl.tone] || 'var(--text-2)') : 'var(--text-2)';
  const fontSize = small ? 11.5 : 12.5;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize,
      fontWeight: 700,
      color,
      padding: small ? '2px 7px' : '2.5px 8.5px',
      borderRadius: 99,
      background: 'var(--hover)',
      border: '1px solid var(--border)',
      whiteSpace: 'nowrap'
    }}>
      <I.calendar size={small ? 12 : 13} sw={2} />
      <span>{labelText}</span>
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
  const { updateTask, deleteTask, labels: customLabels, multiSelectedIds = [], toggleMultiSelect } = useApp();
  const [menu, setMenu] = React.useState(null);
  const showActions = !!(selected || menu);

  const proj = task.projectId && task.projectId !== 'inbox' ? H.projectById(task.projectId) : null;
  const compact = density === 'compact';
  const card = density === 'card';
  const labels = task.labels || [];

  const statusChoices = {
    planned: { label: 'Planned', color: 'var(--text-3)' },
    inprogress: { label: 'In Progress', color: 'var(--p2)' },
    blocked: { label: 'Blocked', color: 'var(--p1)' },
    waiting: { label: 'Waiting', color: 'var(--p3)' },
    done: { label: 'Done', color: 'var(--today)' }
  };

  const STATUS_CHOICES = {
    planned: { label: 'Planned', icon: <span style={{ width: 14, height: 14, borderRadius: 99, border: '2.5px solid var(--text-3)', display: 'inline-block' }} /> },
    inprogress: { label: 'In Progress', icon: <span style={{ width: 14, height: 14, borderRadius: 99, border: '2.5px solid var(--p2)', position: 'relative', overflow: 'hidden', display: 'inline-block' }}><span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', background: 'var(--p2)' }} /></span> },
    blocked: { label: 'Blocked', icon: <I.x size={14} style={{ color: 'var(--p1)' }} /> },
    waiting: { label: 'Waiting', icon: <I.repeat size={14} style={{ color: 'var(--p3)' }} /> },
    done: { label: 'Done', icon: <I.check size={14} style={{ color: 'var(--today)' }} /> }
  };

  const hasMeta = (task.dueOffset !== null && task.dueOffset !== undefined && showProject !== 'inDate') ||
    (task.startOffset !== null && task.startOffset !== undefined && showProject !== 'inDate') ||
    labels.length || (task.subtasks && task.subtasks.length) || task.note ||
    (task.status && statusChoices[task.status]);

  const pad = card ? '11px 13px' : compact ? '6px 8px' : '10px 8px';

  const meta = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: compact ? 1 : 4 }}>
      {task.status && statusChoices[task.status] && (
        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setMenu(menu === 'status' ? null : 'status')} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, color: statusChoices[task.status].color, fontWeight: 700, fontSize: 12 }}>
            {task.status === 'inprogress' && <span style={{ width: 10, height: 10, borderRadius: 99, border: '2px solid var(--p2)', position: 'relative', overflow: 'hidden', display: 'inline-block', flexShrink: 0 }}><span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', background: 'var(--p2)' }} /></span>}
            {task.status === 'blocked' && <I.x size={10} style={{ color: 'var(--p1)', flexShrink: 0 }} />}
            {task.status === 'waiting' && <I.repeat size={10} style={{ color: 'var(--p3)', flexShrink: 0 }} />}
            {statusChoices[task.status].label}
          </button>
          {menu === 'status' && (
            <Popover onClose={() => setMenu(null)} style={{ top: 24, left: 0, zIndex: 100, minWidth: 160 }}>
              {Object.entries(STATUS_CHOICES).map(([k, v]) => (
                <div key={k} className="pop-item" style={{ height: 32, fontSize: 13, gap: 8 }} onClick={() => { updateTask(task.id, { status: k }); setMenu(null); }}>
                  {v.icon}{v.label}
                </div>
              ))}
            </Popover>
          )}
        </div>
      )}
      {showProject !== 'inDate' && (
        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setMenu(menu === 'due' ? null : 'due')} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex' }}>
            <DueBadge offset={task.dueOffset} startOffset={task.startOffset} time={task.time} />
          </button>
          {menu === 'due' && (
            <Popover onClose={() => setMenu(null)} style={{ top: 24, left: 0, zIndex: 100, minWidth: 200 }}>
              <WhenPicker startOffset={task.startOffset} dueOffset={task.dueOffset} time={task.time} onChange={(startVal, dueVal, newTime) => {
                updateTask(task.id, { startOffset: startVal, dueOffset: dueVal, time: newTime });
              }} onClose={() => setMenu(null)} />
            </Popover>
          )}
        </div>
      )}
      <SubProgress subtasks={task.subtasks} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {labels.map((id) => (
          <div key={id} style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMenu(menu === `label_${id}` ? null : `label_${id}`)} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
              <LabelChip id={id} small />
            </button>
            {menu === `label_${id}` && (
              <Popover onClose={() => setMenu(null)} style={{ top: 20, left: 0, zIndex: 100, minWidth: 180 }}>
                {customLabels.map((l) => {
                  const on = task.labels.includes(l.id);
                  return (
                    <div key={l.id} className="pop-item" style={{ height: 32, fontSize: 13 }} onClick={() => updateTask(task.id, { labels: on ? task.labels.filter((x) => x !== l.id) : [...task.labels, l.id] })}>
                      <span style={{ width: 9, height: 9, borderRadius: 99, background: l.color }} />{l.name}
                      {on && <I.check size={15} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
                    </div>
                  );
                })}
              </Popover>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const isMultiSelected = multiSelectedIds.includes(task.id);
  const anyMultiSelected = multiSelectedIds.length > 0;

  return (
    <div
      data-task-id={task.id}
      className={'task-row no-sel' + ((selected || isMultiSelected) ? ' is-selected' : '') + (task.done ? ' is-done' : '') + (card ? ' task-card' : '')}
      style={{ padding: pad, marginBottom: card ? 8 : 0, display: 'flex', flexDirection: 'column' }}
      onClick={() => onOpen && onOpen(task)}>
      <div style={{ display: 'flex', width: '100%', alignItems: 'start', gap: 12 }}>
        <div style={{ paddingTop: compact ? 1 : 1.5, flexShrink: 0 }}>
          <Checkbox done={task.done} priority={task.priority} size={compact ? 18 : 20} onToggle={onToggle} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <textarea
            value={task.title}
            readOnly={!selected}
            onChange={(e) => updateTask(task.id, { title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
              }
            }}
            onClick={selected ? (e) => e.stopPropagation() : undefined}
            placeholder="Task title..."
            rows={1}
            ref={(el) => {
              if (el) {
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }
            }}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              resize: 'none',
              background: 'transparent',
              fontSize: compact ? '14.5px' : '15.5px',
              fontWeight: 600,
              lineHeight: 1.34,
              color: 'var(--text)',
              fontFamily: 'inherit',
              padding: 0,
              margin: 0,
              pointerEvents: selected ? 'auto' : 'none',
              cursor: selected ? 'text' : 'pointer',
            }}
          />
          {(task.note || selected) && (
            <textarea
              value={task.note || ''}
              onChange={(e) => updateTask(task.id, { note: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="Add note..."
              rows={1}
              ref={(el) => {
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = el.scrollHeight + 'px';
                }
              }}
              onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                resize: 'none',
                background: 'transparent',
                fontSize: '12.5px',
                color: 'var(--text-3)',
                fontFamily: 'inherit',
                padding: 0,
                marginTop: 2,
              }}
            />
          )}
          {hasMeta && (compact ? null : meta)}
          {compact && hasMeta && meta}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 1, paddingLeft: 4, flexShrink: 0, position: 'relative' }}>
          {showProject && proj && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-2)',
              fontWeight: 700,
              fontSize: 12.5,
              whiteSpace: 'nowrap',
              opacity: showActions ? 0 : 1,
              transform: showActions ? 'translateX(-8px)' : 'translateX(0)',
              transition: 'opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1), transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
              {proj.name}<Dot color={proj.color} />
            </span>
          )}

          {/* Hover Action Bar */}
          <div style={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            position: 'absolute',
            right: 36,
            opacity: showActions ? 1 : 0,
            transform: showActions ? 'translateX(0)' : 'translateX(8px)',
            transition: 'opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1), transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: showActions ? 'auto' : 'none',
            background: selected ? 'var(--active)' : 'var(--hover)',
            boxShadow: `-8px 0 8px -4px ${selected ? 'var(--active)' : 'var(--hover)'}`,
            paddingLeft: 8,
            zIndex: 10
          }} onClick={(e) => e.stopPropagation()}>
            {/* Due Date Trigger */}
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setMenu(menu === 'due_btn' ? null : 'due_btn')} title="Set due date">
                <I.calendar size={15} />
              </button>
              {menu === 'due_btn' && (
                <Popover onClose={() => setMenu(null)} style={{ top: 28, right: 0, zIndex: 100, minWidth: 200 }}>
                  <WhenPicker startOffset={task.startOffset} dueOffset={task.dueOffset} time={task.time} onChange={(startVal, dueVal, newTime) => {
                    updateTask(task.id, { startOffset: startVal, dueOffset: dueVal, time: newTime });
                  }} onClose={() => setMenu(null)} />
                </Popover>
              )}
            </div>

            {/* Priority Trigger */}
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setMenu(menu === 'prio_btn' ? null : 'prio_btn')} title="Set priority">
                <I.flag size={15} />
              </button>
              {menu === 'prio_btn' && (
                <Popover onClose={() => setMenu(null)} style={{ top: 28, right: 0, zIndex: 100, minWidth: 140 }}>
                  {PRIO.map((p) => (
                    <div key={p.p} className="pop-item" style={{ height: 32, fontSize: 13 }} onClick={() => { updateTask(task.id, { priority: p.p }); setMenu(null); }}>
                      <I.flag size={14} sw={2} style={{ color: p.color }} />{p.label}
                    </div>
                  ))}
                </Popover>
              )}
            </div>

            {/* Labels Trigger */}
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setMenu(menu === 'label_btn' ? null : 'label_btn')} title="Add labels">
                <I.tag size={15} />
              </button>
              {menu === 'label_btn' && (
                <Popover onClose={() => setMenu(null)} style={{ top: 28, right: 0, zIndex: 100, minWidth: 180 }}>
                  {customLabels.map((l) => {
                    const on = task.labels.includes(l.id);
                    return (
                      <div key={l.id} className="pop-item" style={{ height: 32, fontSize: 13 }} onClick={() => updateTask(task.id, { labels: on ? task.labels.filter((x) => x !== l.id) : [...task.labels, l.id] })}>
                        <span style={{ width: 9, height: 9, borderRadius: 99, background: l.color }} />{l.name}
                        {on && <I.check size={15} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
                      </div>
                    );
                  })}
                </Popover>
              )}
            </div>

            {/* Status Trigger */}
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setMenu(menu === 'status_btn' ? null : 'status_btn')} title="Set status">
                <I.repeat size={15} />
              </button>
              {menu === 'status_btn' && (
                <Popover onClose={() => setMenu(null)} style={{ top: 28, right: 0, zIndex: 100, minWidth: 160 }}>
                  {Object.entries(STATUS_CHOICES).map(([k, v]) => (
                    <div key={k} className="pop-item" style={{ height: 32, fontSize: 13, gap: 8 }} onClick={() => { updateTask(task.id, { status: k }); setMenu(null); }}>
                      {v.icon}{v.label}
                    </div>
                  ))}
                </Popover>
              )}
            </div>

            {/* Delete Trigger */}
            <button className="icon-btn" style={{ width: 28, height: 28, color: 'var(--p1)' }} onClick={() => {
              if (window.confirm("Are you sure you want to delete this task?")) {
                deleteTask(task.id);
              }
            }} title="Delete task">
              <I.trash size={15} />
            </button>
          </div>

          {toggleMultiSelect && (
            <button
              className="icon-btn row-hover"
              style={{
                width: 28,
                height: 28,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                color: isMultiSelected ? 'var(--accent)' : 'var(--text-3)',
                opacity: (isMultiSelected || anyMultiSelected) ? 1 : undefined,
                pointerEvents: 'auto',
                zIndex: 11
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleMultiSelect(task.id);
              }}
              title={isMultiSelected ? "Deselect task" : "Select task"}
            >
              <div style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                border: `2px solid ${isMultiSelected ? 'var(--accent)' : 'var(--border-2)'}`,
                background: isMultiSelected ? 'var(--accent)' : 'transparent',
                display: 'grid',
                placeItems: 'center',
                transition: 'all .15s'
              }}>
                {isMultiSelected && <I.check size={11} sw={3} style={{ color: '#fff' }} />}
              </div>
            </button>
          )}
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

// ── Bulk actions bar ────────────────────────────────────────
export function BulkActionBar() {
  const { multiSelectedIds, clearMultiSelect, bulkComplete, bulkDelete } = useApp();

  if (!multiSelectedIds || multiSelectedIds.length === 0) return null;

  const count = multiSelectedIds.length;

  return (
    <div className="bulk-bar" onClick={(e) => e.stopPropagation()}>
      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
        {count} task{count > 1 ? 's' : ''} selected
      </span>

      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="btn"
          onClick={() => bulkComplete()}
          style={{
            height: 32,
            padding: '0 12px',
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <I.check size={14} sw={2.5} style={{ color: '#fff' }} /> Mark Completed
        </button>

        <button
          className="btn"
          onClick={() => {
            if (window.confirm(`Are you sure you want to delete these ${count} tasks?`)) {
              bulkDelete();
            }
          }}
          style={{
            height: 32,
            padding: '0 12px',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--p1)',
            background: 'color-mix(in srgb, var(--p1) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--p1) 20%, transparent)',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <I.trash size={14} /> Delete Selected
        </button>

        <button
          className="btn btn-ghost"
          onClick={clearMultiSelect}
          style={{
            height: 32,
            padding: '0 12px',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
