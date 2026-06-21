// calendar.jsx — month grid calendar
import React, { useState, useRef, useEffect } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp } from './store.jsx';
import { TaskRow, Empty, Dot, useIsNarrow } from './ui.jsx';
import { ViewHeader } from './views.jsx';
import { layoutDayTasks, fmtHM, parseHM } from './timegrid.js';

const HOUR_H = 60; // matches --hour-height

export function CalendarView({ density, compact }) {
  const { tasks, setSelectedId, toggleTask, selectedId } = useApp();
  const narrow = useIsNarrow();
  const today = H.startOfToday();
  const [monthShift, setMonthShift] = useState(0);
  const [selOff, setSelOff] = useState(0);
  const [dayMode, setDayMode] = useState(false);

  const dayGridRef = useRef(null);
  useEffect(() => {
    if (dayMode && dayGridRef.current) {
      dayGridRef.current.scrollTop = 7 * HOUR_H;
    }
  }, [dayMode]);

  const base = new Date(today.getFullYear(), today.getMonth() + monthShift, 1);
  const year = base.getFullYear(), month = base.getMonth();
  const firstDow = base.getDay();
  // build 6x7 grid of date offsets
  const cells = [];
  const gridStart = new Date(year, month, 1 - firstDow);
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push(d);
  }

  const byOffset = {};
  tasks.forEach((t) => { if (!t.done && t.dueOffset !== null) (byOffset[t.dueOffset] = byOffset[t.dueOffset] || []).push(t); });
  const offOf = (d) => Math.round((new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / H.MS_DAY);

  const selTasks = byOffset[selOff] || [];
  const selDate = H.dateFromOffset(selOff);

  return (
    <div>
      <ViewHeader icon={<span style={{ color: 'var(--accent)' }}><I.calendar size={25} /></span>}
        title="Calendar" subtitle={`${H.MONTHS_LONG[month]} ${year}`}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button className="btn btn-ghost" style={{ height: 32, padding: '0 12px', borderRadius: 0, fontWeight: 800, background: !dayMode ? 'var(--active)' : 'transparent', color: !dayMode ? 'var(--accent-text)' : 'var(--text-2)' }} onClick={() => setDayMode(false)}>Month</button>
              <button className="btn btn-ghost" style={{ height: 32, padding: '0 12px', borderRadius: 0, fontWeight: 800, background: dayMode ? 'var(--active)' : 'transparent', color: dayMode ? 'var(--accent-text)' : 'var(--text-2)' }} onClick={() => setDayMode(true)}>Day</button>
            </div>
            {!dayMode && (
              <>
                <button className="icon-btn" onClick={() => setMonthShift((m) => m - 1)}><I.chevL size={18} /></button>
                <button className="btn btn-ghost" style={{ height: 32, padding: '0 12px' }} onClick={() => { setMonthShift(0); setSelOff(0); }}>Today</button>
                <button className="icon-btn" onClick={() => setMonthShift((m) => m + 1)}><I.chevR size={18} /></button>
              </>
            )}
          </div>
        } />

      {dayMode && (() => {
        const dayTasks = tasks.filter(t => !t.done && t.dueOffset === selOff);
        const unscheduled = dayTasks.filter(t => parseHM(t.time) == null);
        const layout = layoutDayTasks(dayTasks);
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 10px' }}>
              <button className="icon-btn" onClick={() => setSelOff(o => o - 1)}><I.chevL size={18} /></button>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{H.DOW_LONG[selDate.getDay()]}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-3)' }}>{H.MONTHS_LONG[selDate.getMonth()]} {selDate.getDate()}</span>
              <button className="icon-btn" onClick={() => setSelOff(o => o + 1)}><I.chevR size={18} /></button>
              <button className="btn btn-ghost" style={{ height: 30, padding: '0 12px', marginLeft: 'auto' }} onClick={() => setSelOff(0)}>Today</button>
            </div>
            {unscheduled.length > 0 && (
              <div className="day-unscheduled">
                {unscheduled.map(t => {
                  const proj = t.projectId !== 'inbox' ? H.projectById(t.projectId) : null;
                  const c = H.priorityColor(t.priority) || (proj ? proj.color : 'var(--text-3)');
                  return (
                    <button key={t.id} onClick={() => setSelectedId(t.id)} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', border: '1px solid var(--border)', fontWeight: 700, fontSize: 12.5 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 99, background: c, flex: 'none' }} />
                      {t.title}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="day-grid" ref={dayGridRef}>
              <div className="day-grid-track" style={{ height: 24 * HOUR_H }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="day-hour">{fmtHM(h * 60)}</div>
                ))}
                {layout.map(({ task, startMin, endMin, lane, lanes }) => {
                  const proj = task.projectId !== 'inbox' ? H.projectById(task.projectId) : null;
                  const bg = H.priorityColor(task.priority) || (proj ? proj.color : 'var(--accent-soft)');
                  return (
                    <div key={task.id} className="time-block" onClick={() => setSelectedId(task.id)} style={{
                      top: (startMin / 60) * HOUR_H,
                      height: Math.max(22, (endMin - startMin) / 60 * HOUR_H),
                      left: `calc(48px + (${lane} / ${lanes}) * (100% - 52px))`,
                      width: `calc((1 / ${lanes}) * (100% - 52px) - 4px)`,
                      background: bg,
                    }}>
                      <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
                      <div style={{ fontSize: 11, opacity: 0.9 }}>{fmtHM(startMin)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {!dayMode && (<>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-elev)' }}>
        {H.DOW.map((d) => (
          <div key={d} style={{ textAlign: 'center', padding: '9px 0', fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', color: 'var(--text-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          const off = offOf(d);
          const inMonth = d.getMonth() === month;
          const isToday = off === 0;
          const isSel = off === selOff;
          const dayTasks = byOffset[off] || [];
          return (
            <button key={i} onClick={() => setSelOff(off)} style={{
              position: 'relative', minHeight: narrow ? 52 : (compact ? 64 : 92), padding: narrow ? '6px 0 5px' : '6px 7px',
              textAlign: narrow ? 'center' : 'left',
              borderRight: (i % 7 !== 6) ? '1px solid var(--border)' : 'none',
              borderBottom: i < 35 ? '1px solid var(--border)' : 'none',
              background: isSel ? 'var(--active)' : 'transparent',
              opacity: inMonth ? 1 : 0.4, cursor: 'pointer',
              display: 'block', width: '100%',
            }}>
              <span style={{
                display: 'inline-grid', placeItems: 'center', minWidth: 22, height: 22, padding: '0 5px', borderRadius: 999,
                fontSize: 12.5, fontWeight: isToday ? 800 : 700,
                background: isToday ? 'var(--accent)' : 'transparent', color: isToday ? '#fff' : 'var(--text)',
              }}>{d.getDate()}</span>
              {narrow ? (
                // Mobile: dots only — cells are too narrow for titles. Tap a day to see its list below.
                <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 4, minHeight: 7 }}>
                  {dayTasks.slice(0, 4).map((t) => {
                    const proj = t.projectId !== 'inbox' ? H.projectById(t.projectId) : null;
                    const c = H.priorityColor(t.priority) || (proj ? proj.color : 'var(--text-3)');
                    return <span key={t.id} style={{ width: 5, height: 5, borderRadius: 99, background: c }} />;
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                  {dayTasks.slice(0, compact ? 2 : 3).map((t) => {
                    const proj = t.projectId !== 'inbox' ? H.projectById(t.projectId) : null;
                    const c = H.priorityColor(t.priority) || (proj ? proj.color : 'var(--text-3)');
                    return (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: c, flex: 'none' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                      </div>
                    );
                  })}
                  {dayTasks.length > (compact ? 2 : 3) && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)' }}>+{dayTasks.length - (compact ? 2 : 3)} more</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 4px 8px' }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{H.DOW_LONG[selDate.getDay()]}</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-3)' }}>{H.MONTHS_LONG[selDate.getMonth()]} {selDate.getDate()}</span>
        </div>
        {selTasks.length === 0
          ? <Empty icon={<I.calendar size={28} />} title="Nothing scheduled" sub="Pick another day or add a task for this date." />
          : selTasks.map((t) => (
            <TaskRow key={t.id} task={t} density={density} showProject onToggle={() => toggleTask(t.id)} onOpen={(x) => setSelectedId(x.id)} selected={selectedId === t.id} />
          ))}
      </div>
      </>)}
    </div>
  );
}
