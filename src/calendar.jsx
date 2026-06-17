// calendar.jsx — month grid calendar
import React, { useState } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp } from './store.jsx';
import { TaskRow, Empty, Dot } from './ui.jsx';
import { ViewHeader } from './views.jsx';

export function CalendarView({ density, compact }) {
  const { tasks, setSelectedId, toggleTask, selectedId } = useApp();
  const today = H.startOfToday();
  const [monthShift, setMonthShift] = useState(0);
  const [selOff, setSelOff] = useState(0);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="icon-btn" onClick={() => setMonthShift((m) => m - 1)}><I.chevL size={18} /></button>
            <button className="btn btn-ghost" style={{ height: 32, padding: '0 12px' }} onClick={() => { setMonthShift(0); setSelOff(0); }}>Today</button>
            <button className="icon-btn" onClick={() => setMonthShift((m) => m + 1)}><I.chevR size={18} /></button>
          </div>
        } />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-elev)' }}>
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
              position: 'relative', minHeight: compact ? 64 : 92, padding: '6px 7px', textAlign: 'left',
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
    </div>
  );
}
