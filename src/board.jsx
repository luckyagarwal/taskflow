// board.jsx — Kanban board (status columns) + Week board (day columns)
import React, { useState } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp } from './store.jsx';
import { TaskRow } from './ui.jsx';
import { ViewHeader } from './views.jsx';
import { InlineComposer } from './composer.jsx';
import { STATUS_ORDER, STATUS_LABELS, statusPatch, columnOf, groupTasksByStatus } from './status.js';

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekRangeLabel(days) {
  const s = days[0].date;
  const e = days[6].date;
  const sMonth = H.MONTHS[s.getMonth()];
  const eMonth = H.MONTHS[e.getMonth()];
  const year = e.getFullYear();
  if (s.getMonth() === e.getMonth()) {
    return `${sMonth} ${s.getDate()} – ${e.getDate()}, ${year}`;
  }
  return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}, ${year}`;
}

function WeekBoard({ tasks, setSelectedId, weekStartDay }) {
  const [weekOff, setWeekOff] = useState(0);

  const todayDow = new Date().getDay(); // 0=Sun
  // days to go back from today to reach the week-start day
  const daysToStart = -((todayDow - weekStartDay + 7) % 7);
  const weekStart = daysToStart + weekOff * 7;

  const days = Array.from({ length: 7 }, (_, i) => {
    const off = weekStart + i;
    return { off, date: H.dateFromOffset(off) };
  });

  const isCurrentWeek = weekOff === 0;

  return (
    <div>
      {/* week navigation bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 8px', borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={() => setWeekOff((w) => w - 1)}
          style={{ border: 'none', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', padding: 6, display: 'grid', placeItems: 'center' }}
        >
          <I.chevL size={18} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {weekRangeLabel(days)}
          </div>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeekOff(0)}
              style={{ border: 'none', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '2px 0' }}
            >
              Back to this week
            </button>
          )}
        </div>

        <button
          onClick={() => setWeekOff((w) => w + 1)}
          style={{ border: 'none', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', padding: 6, display: 'grid', placeItems: 'center' }}
        >
          <I.chevR size={18} />
        </button>
      </div>

      <div className="board-scroll">
        {days.map(({ off, date }) => {
          const isToday = off === 0;
          const dayTasks = tasks.filter((t) => !t.done && t.dueOffset === off);
          return (
            <div key={off} className="board-column">
              <div className="board-column-head" style={isToday ? { color: 'var(--accent)' } : undefined}>
                <span style={{ fontWeight: 700 }}>{DOW_SHORT[date.getDay()]}</span>
                <span style={{
                  fontSize: 18, fontWeight: 700, lineHeight: 1,
                  ...(isToday && {
                    background: 'var(--accent)', color: '#fff',
                    borderRadius: 99, width: 28, height: 28,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }),
                }}>
                  {date.getDate()}
                </span>
              </div>
              {dayTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  density="card"
                  showProject
                  onOpen={(task) => setSelectedId(task.id)}
                />
              ))}
              <InlineComposer key={`add-${off}`} defaultDue={off} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BoardView() {
  const { tasks, projects, updateTask, toggleTask, setSelectedId, selectedId, weekStartDay = 1 } = useApp();
  const [projectFilter, setProjectFilter] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [mode, setMode] = useState('status'); // 'status' | 'week'

  const cols = groupTasksByStatus(tasks, { projectId: projectFilter });

  const ModeTab = ({ id, label }) => (
    <button
      onClick={() => setMode(id)}
      style={{
        border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 8,
        fontWeight: 600, fontSize: 13, transition: 'background .12s, color .12s',
        background: mode === id ? 'var(--accent)' : 'transparent',
        color: mode === id ? '#fff' : 'var(--text-3)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <ViewHeader
        icon={<span style={{ color: 'var(--accent)' }}><I.grid size={24} /></span>}
        title="Board"
        subtitle={mode === 'status' ? 'Drag cards between columns to change status' : 'Tasks by day of the week'}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', background: 'var(--hover)', borderRadius: 10, padding: 3 }}>
              <ModeTab id="status" label="Status" />
              <ModeTab id="week" label="Week" />
            </div>
            {mode === 'status' && (
              <select
                value={projectFilter || ''}
                onChange={(e) => setProjectFilter(e.target.value || null)}
                style={{
                  border: '1px solid var(--border)', background: 'var(--bg-elev)',
                  color: 'var(--text)', borderRadius: 8, padding: '8px 12px',
                  fontSize: 13.5, fontWeight: 500, outline: 'none', cursor: 'pointer'
                }}
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
        }
      />

      {mode === 'week' ? (
        <WeekBoard tasks={tasks} setSelectedId={setSelectedId} weekStartDay={weekStartDay} />
      ) : (
        <div className="board-scroll">
          {STATUS_ORDER.map((status) => (
            <div
              key={status}
              className="board-column"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedId) {
                  const task = tasks.find((t) => t.id === draggedId);
                  if (task && columnOf(task) !== status) {
                    updateTask(draggedId, statusPatch(status));
                  }
                  setDraggedId(null);
                }
              }}
            >
              <div className="board-column-head">
                <span>{STATUS_LABELS[status]}</span>
                <span>{cols[status].length}</span>
              </div>
              {cols[status].map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => { setDraggedId(t.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => setDraggedId(null)}
                  style={{ opacity: draggedId === t.id ? 0.4 : 1, cursor: 'grab' }}
                >
                  <TaskRow
                    task={t}
                    density="card"
                    showProject={true}
                    selected={selectedId === t.id}
                    onToggle={() => toggleTask(t.id)}
                    onOpen={(task) => setSelectedId(task.id)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
