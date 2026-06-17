// ui.jsx — shared presentational components
import React from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp } from './store.jsx';
import { Popover, WhenPicker, PRIO } from './composer.jsx';

// True on phone-width viewports — used to reflow task rows so the project
// label drops below the title instead of stealing a fixed right column.
export function useIsNarrow() {
  const q = '(max-width: 767px)';
  const [narrow, setNarrow] = React.useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  React.useEffect(() => {
    const mq = window.matchMedia(q);
    const fn = (e) => setNarrow(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return narrow;
}

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
  const { updateTask, deleteTask, labels: customLabels, multiSelectedIds = [], toggleMultiSelect, projects } = useApp();
  const [menu, setMenu] = React.useState(null);

  const proj = task.projectId && task.projectId !== 'inbox' ? (projects.find(p => p.id === task.projectId) || H.projectById(task.projectId)) : null;
  const narrow = useIsNarrow();
  // On touch/mobile we never reveal the desktop hover CTA bar — a tap opens the
  // task detail instead. The popover menus (opened from meta chips) still work.
  const showActions = !narrow && !!(selected || menu);
  const compact = density === 'compact';
  // On phone widths a "card" list becomes flat full-width rows with dividers
  // (native list feel) instead of separated bordered boxes.
  const card = density === 'card' && !narrow;
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

  const projInMeta = narrow && showProject && showProject !== 'inDate' && !!proj;
  const hasMeta = (task.dueOffset !== null && task.dueOffset !== undefined && showProject !== 'inDate') ||
    (task.startOffset !== null && task.startOffset !== undefined && showProject !== 'inDate') ||
    labels.length || (task.subtasks && task.subtasks.length) || task.note ||
    (task.status && statusChoices[task.status]) || projInMeta;

  const pad = card ? '11px 13px' : compact ? '6px 8px' : (narrow ? '13px 6px' : '10px 8px');

  const meta = (
    <div style={{ display: 'flex', alignItems: 'center', gap: narrow ? 10 : 12, flexWrap: 'wrap', marginTop: compact ? 1 : (narrow ? 8 : 4) }}>
      {projInMeta && (
        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setMenu(menu === 'proj_badge' ? null : 'proj_badge')}
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontWeight: 700, fontSize: 13 }}>
            <Dot color={proj.color} size={8} />{proj.name}
          </button>
        </div>
      )}
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

  // Touch gestures: long-press → multi-select; horizontal swipe → quick actions
  // (swipe right = complete, swipe left = schedule). Vertical drag stays a scroll.
  const lpTimer = React.useRef(null);
  const lpFired = React.useRef(false);
  const sw = React.useRef({ x: 0, y: 0, mode: null, swallow: false });
  const [dragX, setDragX] = React.useState(0);
  const swipeEnabled = narrow && !anyMultiSelected && !selected;

  const startLongPress = () => {
    if (!toggleMultiSelect) return;
    lpFired.current = false;
    lpTimer.current = setTimeout(() => {
      lpFired.current = true;
      toggleMultiSelect(task.id);
      if (navigator.vibrate) navigator.vibrate(12);
    }, 420);
  };
  const cancelLongPress = () => { if (lpTimer.current) clearTimeout(lpTimer.current); };

  const onRowTouchStart = (e) => {
    startLongPress();
    const t = e.touches[0];
    sw.current = { x: t.clientX, y: t.clientY, mode: null, swallow: false };
  };
  const onRowTouchMove = (e) => {
    const t = e.touches[0];
    const dx = t.clientX - sw.current.x;
    const dy = t.clientY - sw.current.y;
    if (sw.current.mode === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      sw.current.mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      cancelLongPress();
    }
    if (sw.current.mode === 'h' && swipeEnabled) {
      cancelLongPress();
      setDragX(Math.max(-110, Math.min(110, dx)));
    } else if (sw.current.mode === 'v') {
      cancelLongPress();
    }
  };
  const onRowTouchEnd = () => {
    cancelLongPress();
    if (sw.current.mode === 'h' && swipeEnabled) {
      const TH = 66;
      const x = dragX;
      if (Math.abs(x) > 10) sw.current.swallow = true;
      setDragX(0);
      if (x > TH) { onToggle && onToggle(); if (navigator.vibrate) navigator.vibrate(10); }
      else if (x < -TH) { setMenu('due'); }
    }
    sw.current.mode = null;
  };

  const handleRowClick = () => {
    if (sw.current.swallow) { sw.current.swallow = false; return; } // swallow click after a swipe
    if (lpFired.current) { lpFired.current = false; return; } // swallow click that ends a long-press
    if (anyMultiSelected && toggleMultiSelect) { toggleMultiSelect(task.id); return; }
    if (onOpen) onOpen(task);
  };

  return (
    <div
      data-task-id={task.id}
      className={'task-row no-sel' + ((selected || isMultiSelected) ? ' is-selected' : '') + (task.done ? ' is-done' : '') + (card ? ' task-card' : '')}
      style={{ marginBottom: card ? 8 : 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: narrow ? 'hidden' : undefined, padding: narrow ? 0 : pad }}
      onClick={handleRowClick}
      onTouchStart={onRowTouchStart}
      onTouchMove={onRowTouchMove}
      onTouchEnd={onRowTouchEnd}
      onContextMenu={(e) => { if (narrow) e.preventDefault(); }}>
      {narrow && dragX !== 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: dragX > 0 ? 'flex-start' : 'flex-end', padding: '0 24px', background: dragX > 0 ? 'var(--today)' : 'var(--accent)', color: '#fff' }}>
          {dragX > 0 ? <I.check size={22} sw={2.5} /> : <I.calendar size={20} />}
        </div>
      )}
      <div style={{
        padding: narrow ? pad : 0,
        background: narrow ? ((selected || isMultiSelected) ? 'var(--active)' : (card ? 'var(--bg-elev)' : 'var(--bg)')) : undefined,
        transform: (narrow && dragX) ? `translateX(${dragX}px)` : undefined,
        transition: dragX === 0 ? 'transform .22s cubic-bezier(.2,0,.2,1)' : 'none',
      }}>
      <div style={{ display: 'flex', width: '100%', alignItems: 'start', gap: 12 }}>
        <div style={{ paddingTop: compact ? 1 : 1.5, flexShrink: 0 }}>
          <Checkbox done={task.done} priority={task.priority} size={compact ? 18 : (narrow ? 24 : 20)} onToggle={onToggle} />
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
              fontSize: compact ? '14.5px' : (narrow ? '16.5px' : '15.5px'),
              fontWeight: narrow ? 500 : 600,
              lineHeight: 1.34,
              color: 'var(--text)',
              fontFamily: 'inherit',
              padding: 0,
              margin: 0,
              pointerEvents: selected ? 'auto' : 'none',
              cursor: selected ? 'text' : 'pointer',
            }}
          />
          {selected ? (
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
                fontSize: narrow ? '14px' : '12.5px',
                color: 'var(--text-3)',
                fontFamily: 'inherit',
                padding: 0,
                marginTop: narrow ? 3 : 2,
              }}
            />
          ) : task.note ? (
            <div className="task-note-clamp" style={{ fontSize: narrow ? '14px' : '12.5px', color: 'var(--text-3)', lineHeight: 1.4, marginTop: narrow ? 3 : 2 }}>{task.note}</div>
          ) : null}
          {hasMeta && (compact ? null : meta)}
          {compact && hasMeta && meta}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 1, paddingLeft: 4, flexShrink: 0, position: 'relative' }}>
          {showProject && proj && (
            <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              {!narrow && (
              <span
                onClick={() => setMenu(menu === 'proj_badge' ? null : 'proj_badge')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--text-2)',
                  fontWeight: 700,
                  fontSize: 12.5,
                  whiteSpace: 'nowrap',
                  opacity: showActions ? 0 : 1,
                  transform: showActions ? 'translateX(-8px)' : 'translateX(0)',
                  transition: 'opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1), transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: 'pointer'
                }}
                title="Change project"
              >
                {proj.name}<Dot color={proj.color} />
              </span>
              )}
              {menu === 'proj_badge' && (
                <Popover onClose={() => setMenu(null)} style={{ top: 22, right: 0, zIndex: 100, minWidth: 180 }}>
                  <div style={{ padding: '6px 8px 4px', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>Set Project</div>
                  
                  {/* Inbox */}
                  <div className="pop-item" style={{ gap: 8, height: 32, fontSize: 13 }} onClick={() => { updateTask(task.id, { projectId: 'inbox' }); setMenu(null); }}>
                    <I.inbox size={14} />
                    <span>Inbox</span>
                    {(!task.projectId || task.projectId === 'inbox') && <I.check size={13} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
                  </div>
                  
                  {/* Projects */}
                  {projects.map((p) => (
                    <div key={p.id} className="pop-item" style={{ gap: 8, height: 32, fontSize: 13 }} onClick={() => { updateTask(task.id, { projectId: p.id }); setMenu(null); }}>
                      <Dot color={p.color} size={8} />
                      <span>{p.name}</span>
                      {task.projectId === p.id && <I.check size={13} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
                    </div>
                  ))}
                </Popover>
              )}
            </div>
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

            {/* Project Trigger */}
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setMenu(menu === 'proj_btn' ? null : 'proj_btn')} title="Set project">
                <I.folder size={15} />
              </button>
              {menu === 'proj_btn' && (
                <Popover onClose={() => setMenu(null)} style={{ top: 28, right: 0, zIndex: 100, minWidth: 180 }}>
                  <div style={{ padding: '6px 8px 4px', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>Set Project</div>
                  
                  {/* Inbox */}
                  <div className="pop-item" style={{ gap: 8, height: 32, fontSize: 13 }} onClick={() => { updateTask(task.id, { projectId: 'inbox' }); setMenu(null); }}>
                    <I.inbox size={14} />
                    <span>Inbox</span>
                    {(!task.projectId || task.projectId === 'inbox') && <I.check size={13} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
                  </div>
                  
                  {/* Projects */}
                  {projects.map((p) => (
                    <div key={p.id} className="pop-item" style={{ gap: 8, height: 32, fontSize: 13 }} onClick={() => { updateTask(task.id, { projectId: p.id }); setMenu(null); }}>
                      <Dot color={p.color} size={8} />
                      <span>{p.name}</span>
                      {task.projectId === p.id && <I.check size={13} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
                    </div>
                  ))}
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
  const narrow = useIsNarrow();

  if (!multiSelectedIds || multiSelectedIds.length === 0) return null;

  const count = multiSelectedIds.length;

  const confirmDelete = () => {
    if (window.confirm(`Are you sure you want to delete these ${count} tasks?`)) bulkDelete();
  };

  // Mobile: a full-width contextual action bar over the tab bar (native pattern).
  if (narrow) {
    return (
      <div className="bulk-bar-mobile" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
            {count} task{count > 1 ? 's' : ''} selected
          </span>
          <button onClick={clearMultiSelect} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 15, fontWeight: 700, padding: '4px 4px', cursor: 'pointer' }}>Cancel</button>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => bulkComplete()} style={{
            flex: 1, height: 48, fontSize: 15, fontWeight: 800, color: '#fff', background: 'var(--accent)',
            border: 'none', borderRadius: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <I.check size={17} sw={2.5} style={{ color: '#fff' }} /> Complete
          </button>
          <button onClick={confirmDelete} style={{
            flex: 1, height: 48, fontSize: 15, fontWeight: 800, color: 'var(--p1)',
            background: 'color-mix(in srgb, var(--p1) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--p1) 26%, transparent)',
            borderRadius: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <I.trash size={16} /> Delete
          </button>
        </div>
      </div>
    );
  }

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
