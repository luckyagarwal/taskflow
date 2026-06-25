// daygrid.jsx — shared hour-by-hour day timeline grid.
// Renders the Calendar's Day mode (calendar.jsx): 24 hour rows, time-positioned task
// blocks, lane layout for overlaps, a live "now" marker, and create-on-grid
// (drag-to-create on desktop, tap-to-create on mobile). Callers own their own header;
// this renders only the unscheduled chips + grid.
// See docs/adr/0003-shared-day-timeline-component.md.
import React, { useState, useRef, useEffect } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp } from './store.jsx';
import { layoutDayTasks, fmtHM, parseHM, yToMin, makeRange } from './timegrid.js';

const HOUR_H = 60; // matches --hour-height

// `compact` doubles as the platform flag: mobile (tap-to-create, capped height) vs
// desktop (drag-to-create). Same convention as the old DayView prop.
export function DayTimeline({ selOff, compact }) {
  const { tasks, setSelectedId, setQuickAdd, noTimeOpacity = 0.5, noDurOpacity = 0.7 } = useApp();
  const [drag, setDrag] = useState(null); // { startMin, curMin } while dragging (desktop)
  const trackRef = useRef(null);
  const gridRef = useRef(null);

  const isToday = selOff === 0;

  // tick every 60s so the "now" marker stays live
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const dayTasks = tasks.filter((t) => !t.done && t.dueOffset === selOff);
  const unscheduled = dayTasks.filter((t) => parseHM(t.time) == null);
  const layout = layoutDayTasks(dayTasks);

  // scroll so the relevant part of the day is in view (now, else first task, else 7am)
  useEffect(() => {
    if (!gridRef.current) return;
    const focusMin = isToday ? nowMin : (layout.length ? layout[0].startMin : 7 * 60);
    gridRef.current.scrollTop = Math.max(0, (focusMin / 60) * HOUR_H - 120);
    // only re-focus when the day changes, not on every minute tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selOff]);

  // Convert a pointer/click event's clientY to a minute within the track.
  const eventToMin = (clientY) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return yToMin(clientY - rect.top, HOUR_H);
  };

  // True when the event landed on an existing task block (do not start create).
  const onBlock = (target) => !!(target.closest && target.closest('.tl-block'));

  // Mobile: a tap on empty space creates a default 1-hour block.
  const handleTap = (e) => {
    if (onBlock(e.target)) return;
    const m = eventToMin(e.clientY);
    const { startMin, durationMin } = makeRange(m, m + 60, { step: 5, minDur: 60 });
    setQuickAdd({ dueOffset: selOff, time: fmtHM(startMin), duration: durationMin });
  };

  // Desktop drag.
  const handleDown = (e) => {
    if (onBlock(e.target)) return;
    if (e.button !== undefined && e.button !== 0) return; // left button only
    const m = eventToMin(e.clientY);
    setDrag({ startMin: m, curMin: m });
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleMove = (e) => {
    if (!drag) return;
    setDrag((d) => (d ? { ...d, curMin: eventToMin(e.clientY) } : d));
  };
  const handleUp = () => {
    if (!drag) return;
    const moved = Math.abs(drag.curMin - drag.startMin);
    const d = drag;
    setDrag(null);
    if (moved < 6) return; // plain click, not a drag — ignore
    const { startMin, durationMin } = makeRange(d.startMin, d.curMin, { step: 5, minDur: 5 });
    setQuickAdd({ dueOffset: selOff, time: fmtHM(startMin), duration: durationMin });
  };

  return (
    <>
      {unscheduled.length > 0 && (
        <div className="day-unscheduled">
          {unscheduled.map((t) => {
            const proj = t.projectId !== 'inbox' ? H.projectById(t.projectId) : null;
            const c = H.priorityColor(t.priority) || (proj ? proj.color : 'var(--text-3)');
            return (
              <button key={t.id} onClick={() => setSelectedId(t.id)} className="btn btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', border: `1px dashed var(--border-2)`, fontWeight: 500, fontSize: 12.5, opacity: noTimeOpacity, color: 'var(--text-2)' }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: c, flex: 'none' }} />
                {t.title}
                <I.clock size={11} style={{ marginLeft: 2, color: 'var(--text-3)', flex: 'none' }} />
              </button>
            );
          })}
        </div>
      )}

      <div className="tl-grid" ref={gridRef} style={compact ? { maxHeight: 'calc(100vh - 240px)' } : undefined}>
        <div
          className="tl-track"
          ref={trackRef}
          style={{ height: 24 * HOUR_H }}
          {...(compact
            ? { onClick: handleTap }
            : { onPointerDown: handleDown, onPointerMove: handleMove, onPointerUp: handleUp })}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="tl-hour"><span className="tl-hour-label">{fmtHM(h * 60)}</span></div>
          ))}
          <div className="tl-spine" />
          {layout.length === 0 && unscheduled.length === 0 && (
            <div className="tl-empty-hint">{compact ? 'Tap a time to add a task' : 'Drag across a time range to add a task'}</div>
          )}

          {layout.map(({ task, startMin, endMin, lane, lanes }) => {
            const proj = task.projectId !== 'inbox' ? H.projectById(task.projectId) : null;
            const bg = H.priorityColor(task.priority) || (proj ? proj.color : 'var(--accent)');
            const top = (startMin / 60) * HOUR_H;
            const height = Math.max(24, ((endMin - startMin) / 60) * HOUR_H - 3);
            const hasDur = task.duration > 0;
            const timeLbl = hasDur
              ? `${fmtHM(startMin)} – ${fmtHM(endMin)} · ${H.fmtDuration(task.duration)}`
              : fmtHM(startMin);
            return (
              <React.Fragment key={task.id}>
                {lane === 0 && <span className="tl-dot" style={{ top: top - 1, background: bg }} />}
                <button type="button" className="tl-block" onClick={() => setSelectedId(task.id)} style={{
                  top,
                  height,
                  left: `calc(72px + (${lane} / ${lanes}) * (100% - 80px))`,
                  width: `calc((1 / ${lanes}) * (100% - 80px) - 6px)`,
                  ...(hasDur
                    ? { background: bg }
                    : {
                        background: 'transparent',
                        border: `2px solid ${bg}`,
                        borderBottom: `2px dashed ${bg}`,
                        color: bg,
                        opacity: noDurOpacity,
                      }
                  ),
                }}>
                  <div className="tl-block-title">{task.title}</div>
                  {height >= 36 && <div className="tl-block-time">{timeLbl}</div>}
                </button>
              </React.Fragment>
            );
          })}

          {isToday && (
            <div className="tl-now" style={{ top: (nowMin / 60) * HOUR_H }}>
              <span className="tl-now-label">{fmtHM(nowMin)}</span>
              <span className="tl-now-line" />
              <span className="tl-now-dot" />
            </div>
          )}

          {drag && (() => {
            const { startMin, durationMin } = makeRange(drag.startMin, drag.curMin, { step: 5, minDur: 5 });
            const moved = Math.abs(drag.curMin - drag.startMin) >= 6;
            if (!moved) return null;
            return (
              <div className="tl-ghost" style={{
                top: (startMin / 60) * HOUR_H,
                height: Math.max(20, (durationMin / 60) * HOUR_H - 3),
                left: 72,
                width: 'calc(100% - 80px)',
              }}>
                {fmtHM(startMin)} – {fmtHM(startMin + durationMin)} · {H.fmtDuration(durationMin)}
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}
