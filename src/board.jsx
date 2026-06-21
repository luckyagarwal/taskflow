// board.jsx — Kanban board view with drag-to-change-status
import React, { useState } from 'react';
import { Icons as I } from './icons.jsx';
import { useApp } from './store.jsx';
import { TaskRow } from './ui.jsx';
import { ViewHeader } from './views.jsx';
import { STATUS_ORDER, STATUS_LABELS, statusPatch, columnOf, groupTasksByStatus } from './status.js';

export function BoardView() {
  const { tasks, projects, updateTask, toggleTask, setSelectedId, selectedId } = useApp();
  const [projectFilter, setProjectFilter] = useState(null);
  const [draggedId, setDraggedId] = useState(null);

  const cols = groupTasksByStatus(tasks, { projectId: projectFilter });

  return (
    <div>
      <ViewHeader
        icon={<span style={{ color: 'var(--accent)' }}><I.grid size={24} /></span>}
        title="Board"
        subtitle="Drag cards between columns to change status"
        right={
          <select
            value={projectFilter || ''}
            onChange={(e) => setProjectFilter(e.target.value || null)}
            style={{
              border: '1px solid var(--border)', background: 'var(--bg-elev)',
              color: 'var(--text)', borderRadius: 8, padding: '8px 12px',
              fontSize: 13.5, fontWeight: 700, outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        }
      />

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
    </div>
  );
}
