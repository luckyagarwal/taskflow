// timeline.jsx — full-day, to-scale vertical timeline ("Day" view).
// A spine with a dot per task, blocks sized by duration, and a live "now" marker.
import React, { useState, useRef, useEffect } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp } from './store.jsx';
import { Empty } from './ui.jsx';
import { ViewHeader } from './views.jsx';
import { layoutDayTasks, fmtHM, parseHM } from './timegrid.js';

const HOUR_H = 60; // matches --hour-height

export function DayView({ compact }) {
  const { tasks, setSelectedId } = useApp();
  const today = H.startOfToday();
  const [selOff, setSelOff] = useState(0);

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

  const isToday = selOff === 0;
  const selDate = H.dateFromOffset(selOff);

  const dayTasks = tasks.filter((t) => !t.done && t.dueOffset === selOff);
  const unscheduled = dayTasks.filter((t) => parseHM(t.time) == null);
  const layout = layoutDayTasks(dayTasks);

  // scroll so the relevant part of the day is in view (now, else first task, else 7am)
  const gridRef = useRef(null);
  useEffect(() => {
    if (!gridRef.current) return;
    const focusMin = isToday ? nowMin : (layout.length ? layout[0].startMin : 7 * 60);
    gridRef.current.scrollTop = Math.max(0, (focusMin / 60) * HOUR_H - 120);
    // only re-focus when the day changes, not on every minute tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selOff]);

  return (
    <div>
      <ViewHeader
        icon={<span style={{ color: 'var(--accent)' }}><I.clock size={25} /></span>}
        title="Day"
        subtitle={`${H.DOW_LONG[selDate.getDay()]}, ${H.MONTHS_LONG[selDate.getMonth()]} ${selDate.getDate()}`}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="icon-btn" onClick={() => setSelOff((o) => o - 1)} aria-label="Previous day"><I.chevL size={18} /></button>
            <button className="btn btn-ghost" style={{ height: 32, padding: '0 12px', fontWeight: 600 }} onClick={() => setSelOff(0)}>Today</button>
            <button className="icon-btn" onClick={() => setSelOff((o) => o + 1)} aria-label="Next day"><I.chevR size={18} /></button>
          </div>
        }
      />

      {unscheduled.length > 0 && (
        <div className="day-unscheduled">
          {unscheduled.map((t) => {
            const proj = t.projectId !== 'inbox' ? H.projectById(t.projectId) : null;
            const c = H.priorityColor(t.priority) || (proj ? proj.color : 'var(--text-3)');
            return (
              <button key={t.id} onClick={() => setSelectedId(t.id)} className="btn btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', border: '1px solid var(--border)', fontWeight: 500, fontSize: 12.5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: c, flex: 'none' }} />
                {t.title}
              </button>
            );
          })}
        </div>
      )}

      {layout.length === 0 && unscheduled.length === 0 ? (
        <Empty icon={<I.clock size={28} />} title="Nothing scheduled" sub="Add a task with a time to see it on the timeline." />
      ) : (
        <div className="tl-grid" ref={gridRef} style={compact ? { maxHeight: 'calc(100vh - 240px)' } : undefined}>
          <div className="tl-track" style={{ height: 24 * HOUR_H }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="tl-hour"><span className="tl-hour-label">{fmtHM(h * 60)}</span></div>
            ))}
            <div className="tl-spine" />

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
                  <div className="tl-block" onClick={() => setSelectedId(task.id)} style={{
                    top,
                    height,
                    left: `calc(72px + (${lane} / ${lanes}) * (100% - 80px))`,
                    width: `calc((1 / ${lanes}) * (100% - 80px) - 6px)`,
                    background: bg,
                  }}>
                    <div className="tl-block-title">{task.title}</div>
                    {height >= 36 && <div className="tl-block-time">{timeLbl}</div>}
                  </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
