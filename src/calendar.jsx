// calendar.jsx — month grid calendar
import React, { useState } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp } from './store.jsx';
import { TaskRow, Empty, useIsNarrow } from './ui.jsx';
import { ViewHeader } from './views.jsx';
import { InlineComposer } from './composer.jsx';
import { DayTimeline } from './daygrid.jsx';

export function CalendarView({ density, compact }) {
  const { tasks, setSelectedId, toggleTask, selectedId } = useApp();
  const narrow = useIsNarrow();
  const today = H.startOfToday();
  const [monthShift, setMonthShift] = useState(0);
  const [selOff, setSelOff] = useState(0);
  const [dayMode, setDayMode] = useState(false);

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
              <button className="btn btn-ghost" style={{ height: 32, padding: '0 12px', borderRadius: 0, fontWeight: 600, background: !dayMode ? 'var(--active)' : 'transparent', color: !dayMode ? 'var(--accent-text)' : 'var(--text-2)' }} onClick={() => setDayMode(false)}>Month</button>
              <button className="btn btn-ghost" style={{ height: 32, padding: '0 12px', borderRadius: 0, fontWeight: 600, background: dayMode ? 'var(--active)' : 'transparent', color: dayMode ? 'var(--accent-text)' : 'var(--text-2)' }} onClick={() => setDayMode(true)}>Day</button>
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

      {dayMode && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 10px' }}>
            <button className="icon-btn" onClick={() => setSelOff(o => o - 1)}><I.chevL size={18} /></button>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{H.DOW_LONG[selDate.getDay()]}</span>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-3)' }}>{H.MONTHS_LONG[selDate.getMonth()]} {selDate.getDate()}</span>
            <button className="icon-btn" onClick={() => setSelOff(o => o + 1)}><I.chevR size={18} /></button>
            <button className="btn btn-ghost" style={{ height: 30, padding: '0 12px', marginLeft: 'auto' }} onClick={() => setSelOff(0)}>Today</button>
          </div>
          <DayTimeline selOff={selOff} compact={compact} />
        </div>
      )}

      {!dayMode && (<>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-elev)' }}>
        {H.DOW.map((d) => (
          <div key={d} style={{ textAlign: 'center', padding: '9px 0', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', color: 'var(--text-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{d}</div>
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
                fontSize: 12.5, fontWeight: isToday ? 600 : 500,
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
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 500, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: c, flex: 'none' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
                      </div>
                    );
                  })}
                  {dayTasks.length > (compact ? 2 : 3) && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>+{dayTasks.length - (compact ? 2 : 3)} more</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 4px 8px' }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{H.DOW_LONG[selDate.getDay()]}</span>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-3)' }}>{H.MONTHS_LONG[selDate.getMonth()]} {selDate.getDate()}</span>
        </div>
        {/* Add a task with this date pre-filled — same inline composer as the Upcoming view.
            key={selOff} remounts it per selected day so its internal due-state always
            matches the picked date (InlineComposer seeds state from defaultDue only at mount).
            When the day is empty, the composer sits ABOVE the placeholder so "Add task" is the
            first thing in reach; with tasks present it stays at the bottom of the list. */}
        {selTasks.length === 0 ? (
          <>
            <div style={{ marginTop: 8 }}>
              <InlineComposer key={selOff} defaultDue={selOff} />
            </div>
            <Empty icon={<I.calendar size={28} />} title="Nothing scheduled" sub="Pick another day or add a task for this date." />
          </>
        ) : (
          <>
            {selTasks.map((t) => (
              <TaskRow key={t.id} task={t} density={density} showProject onToggle={() => toggleTask(t.id)} onOpen={(x) => setSelectedId(x.id)} selected={selectedId === t.id} />
            ))}
            <div style={{ marginTop: 8 }}>
              <InlineComposer key={selOff} defaultDue={selOff} />
            </div>
          </>
        )}
      </div>
      </>)}
    </div>
  );
}
