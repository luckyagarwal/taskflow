// detail.jsx — task detail / edit panel
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp } from './store.jsx';
import { Checkbox, Dot, LabelChip, Ring, useIsNarrow } from './ui.jsx';
import { Popover, DUE_OPTIONS, PRIO, WhenPicker } from './composer.jsx';

const STATUS_CHOICES = {
  planned: { label: 'Planned', icon: <span style={{ width: 14, height: 14, borderRadius: 99, border: '2.5px solid var(--text-3)', display: 'inline-block' }} />, color: 'var(--text-3)' },
  inprogress: { label: 'In Progress', icon: <span style={{ width: 14, height: 14, borderRadius: 99, border: '2.5px solid var(--p2)', position: 'relative', overflow: 'hidden', display: 'inline-block' }}><span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', background: 'var(--p2)' }} /></span>, color: 'var(--p2)' },
  blocked: { label: 'Blocked', icon: <I.x size={14} style={{ color: 'var(--p1)' }} />, color: 'var(--p1)' },
  waiting: { label: 'Waiting', icon: <I.repeat size={14} style={{ color: 'var(--p3)' }} />, color: 'var(--p3)' },
  done: { label: 'Done', icon: <I.check size={14} style={{ color: 'var(--today)' }} />, color: 'var(--today)' },
};

function StatusIcon({ status, priority, size = 18 }) {
  const pc = H.priorityColor(priority) || 'var(--check-empty)';
  if (status === 'done') {
    return (
      <div className="checkbox is-done no-sel" style={{ width: size, height: size, border: `2px solid var(--today)`, background: 'var(--today)', borderRadius: 999, display: 'grid', placeItems: 'center' }}>
        <I.check size={size * 0.62} style={{ color: '#fff' }} />
      </div>
    );
  }
  if (status === 'inprogress') {
    return (
      <div style={{ width: size, height: size, borderRadius: 999, border: `2px solid var(--p2)`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', background: 'var(--p2)' }} />
      </div>
    );
  }
  if (status === 'blocked') {
    return (
      <div style={{ color: 'var(--p1)', display: 'flex', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}><I.x size={size - 2} /></div>
    );
  }
  if (status === 'waiting') {
    return (
      <div style={{ color: 'var(--p3)', display: 'flex', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}><I.repeat size={size - 2} /></div>
    );
  }
  // Planned / Default
  return (
    <div style={{ width: size, height: size, borderRadius: 999, border: `2px solid ${pc}`, flexShrink: 0 }} />
  );
}

function SubtaskItem({
  taskId, s, index,
  draggedIndex, draggableId, setDraggableId,
  handleDragStart, handleDragOver, handleDragEnd,
  sortMode
}) {
  const { updateSubtask, deleteSubtask, tasks } = useApp();
  const [menu, setMenu] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [localTitle, setLocalTitle] = useState(s.title);

  useEffect(() => {
    setLocalTitle(s.title);
  }, [s.title]);

  const saveTitle = () => {
    const trimmed = localTitle.trim();
    if (trimmed && trimmed !== s.title) {
      updateSubtask(taskId, s.id, { title: trimmed });
    } else {
      setLocalTitle(s.title);
    }
  };

  const dueLbl = H.dueLabel(s.dueOffset);
  const startLbl = H.dueLabel(s.startOffset);
  const prioOpt = PRIO.find((p) => p.p === s.priority) || PRIO[3];
  const TONE = { overdue: 'var(--p1)', today: 'var(--today)', soon: 'var(--p3)', future: 'var(--text-2)' };

  return (
    <div
      draggable={!sortMode && draggableId === s.id}
      onDragStart={sortMode ? undefined : (e) => handleDragStart(e, index)}
      onDragOver={sortMode ? undefined : (e) => handleDragOver(e, index)}
      onDragEnd={sortMode ? undefined : handleDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setDraggableId(null); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '7px 0',
        borderBottom: '1px solid var(--border)',
        opacity: draggedIndex === index ? 0.4 : 1,
        cursor: (!sortMode && draggableId === s.id) ? 'grabbing' : 'default',
      }}
    >
      {/* Drag Handle */}
      {!sortMode ? (
        <span
          onMouseDown={() => setDraggableId(s.id)}
          onMouseUp={() => setDraggableId(null)}
          style={{
            cursor: 'grab',
            color: 'var(--text-3)',
            opacity: hovered ? 0.6 : 0,
            transition: 'opacity .15s',
            display: 'flex',
            alignItems: 'center',
            padding: '0 2px'
          }}
        >
          <I.grip size={14} />
        </span>
      ) : (
        <div style={{ width: 18 }} />
      )}

      {/* 1. Status Dropdown / Checkbox */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button onClick={(e) => {
          if (e.altKey) {
            e.preventDefault();
            e.stopPropagation();
            const nextDone = !s.done;
            const parentTask = tasks.find(t => t.id === taskId);
            if (parentTask && parentTask.subtasks) {
              parentTask.subtasks.forEach(sub => {
                if (sub.done !== nextDone) {
                  updateSubtask(taskId, sub.id, { done: nextDone });
                }
              });
            }
          } else {
            setMenu(menu === 'status' ? null : 'status');
          }
        }} style={{ border: 'none', background: 'transparent', padding: 0, display: 'flex', cursor: 'pointer' }}>
          <StatusIcon status={s.status || 'planned'} priority={s.priority} size={18} />
        </button>
        {menu === 'status' && (
          <Popover onClose={() => setMenu(null)} style={{ top: 24, left: 0, zIndex: 100, minWidth: 160 }}>
            {Object.entries(STATUS_CHOICES).map(([k, v]) => (
              <div key={k} className="pop-item" style={{ height: 32, fontSize: 13, gap: 8 }} onClick={() => { updateSubtask(taskId, s.id, { status: k }); setMenu(null); }}>
                {v.icon}{v.label}
              </div>
            ))}
          </Popover>
        )}
      </div>

      {/* 2. Subtask Title (Editable Inline) */}
      <textarea
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
          }
        }}
        placeholder="Subtask title..."
        rows={1}
        ref={(el) => {
          if (el) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
          }
        }}
        onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          resize: 'none',
          background: 'transparent',
          fontSize: 14,
          fontWeight: 600,
          color: s.done ? 'var(--text-3)' : 'var(--text)',
          textDecoration: s.done ? 'line-through' : 'none',
          fontFamily: 'inherit',
          padding: 0,
          margin: 0,
        }}
      />

      {/* 3. Priority Popover */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button onClick={() => setMenu(menu === 'prio' ? null : 'prio')} style={{ border: 'none', background: 'transparent', padding: 4, display: 'flex', cursor: 'pointer', color: s.priority < 4 ? prioOpt.color : 'var(--text-3)' }}>
          <I.flag size={14} sw={2} />
        </button>
        {menu === 'prio' && (
          <Popover onClose={() => setMenu(null)} style={{ top: 24, right: 0, zIndex: 100, minWidth: 140 }}>
            {PRIO.map((p) => (
              <div key={p.p} className="pop-item" style={{ height: 32, fontSize: 13 }} onClick={() => { updateSubtask(taskId, s.id, { priority: p.p }); setMenu(null); }}>
                <I.flag size={14} sw={2} style={{ color: p.color }} />{p.label}
              </div>
            ))}
          </Popover>
        )}
      </div>

      {/* 4. Date Popover */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button onClick={() => setMenu(menu === 'date' ? null : 'date')} style={{ border: 'none', background: 'transparent', padding: 4, display: 'flex', cursor: 'pointer', color: (dueLbl || startLbl) ? TONE[dueLbl?.tone || startLbl?.tone] : 'var(--text-3)' }} title="Date">
          <I.calendar size={14} />
        </button>
        {(startLbl || dueLbl) && (
          <span style={{ fontSize: 11, fontWeight: 750, color: (dueLbl || startLbl) ? TONE[dueLbl?.tone || startLbl?.tone] : 'var(--text-3)', marginLeft: 2, marginRight: 2 }}>
            {H.dateRangeLabel(s.startOffset, s.dueOffset, null)}
          </span>
        )}
        {menu === 'date' && (
          <Popover onClose={() => setMenu(null)} style={{ top: 24, right: 0, zIndex: 100, minWidth: 200 }}>
            <WhenPicker
              startOffset={s.startOffset}
              dueOffset={s.dueOffset}
              onChange={(startVal, dueVal, newTime) => {
                updateSubtask(taskId, s.id, { startOffset: startVal, dueOffset: dueVal });
              }}
              onClose={() => setMenu(null)}
              showTimeField={false}
            />
          </Popover>
        )}
      </div>

      {/* 6. Delete Button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); deleteSubtask(taskId, s.id); }}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 4,
          display: 'flex',
          cursor: 'pointer',
          color: 'var(--text-3)',
          opacity: hovered ? 0.7 : 0,
          transition: 'opacity .15s'
        }}
        title="Delete subtask"
      >
        <I.x size={14} />
      </button>
    </div>
  );
}

function MetaRow({ icon, label, children, onClick, accent }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 12px', borderRadius: 10,
      textAlign: 'left', transition: 'background .12s', border: 'none', background: 'transparent', cursor: 'pointer'
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <span style={{ color: accent || 'var(--text-3)', display: 'grid', placeItems: 'center', width: 20 }}>{icon}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)', width: 76, flex: 'none' }}>{label}</span>
      <span style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>{children}</span>
    </button>
  );
}

export function TaskEditor({ taskId, inline, mobile }) {
  const { tasks, updateTask, toggleTask, addSubtask, projects, labels: customLabels, addLabel } = useApp();
  const task = tasks.find((t) => t.id === taskId);
  const [menu, setMenu] = useState(null);
  const [newSub, setNewSub] = useState('');
  const [subtasksCollapsed, setSubtasksCollapsed] = useState(false);
  const [doneSubsCollapsed, setDoneSubsCollapsed] = useState(true);
  const [aiState, setAiState] = useState('idle'); // 'idle' | 'loading' | error message string
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');

  const [localTitle, setLocalTitle] = useState(task ? task.title : '');
  const [localNote, setLocalNote] = useState(task ? (task.note || '') : '');

  useEffect(() => {
    if (task) {
      setLocalTitle(task.title);
    }
  }, [task?.title]);

  useEffect(() => {
    if (task) {
      setLocalNote(task.note || '');
    }
  }, [task?.note]);

  const saveTitle = () => {
    if (!task) return;
    const trimmed = localTitle.trim();
    if (trimmed && trimmed !== task.title) {
      updateTask(task.id, { title: trimmed });
    } else {
      setLocalTitle(task.title);
    }
  };

  const saveNote = () => {
    if (!task) return;
    if (localNote !== (task.note || '')) {
      updateTask(task.id, { note: localNote });
    }
  };

  const handleCreateLabel = () => {
    if (newLabelName.trim()) {
      const newId = addLabel(newLabelName.trim());
      if (newId) {
        updateTask(task.id, { labels: [...(task.labels || []), newId] });
      }
      setNewLabelName('');
      setCreatingLabel(false);
    }
  };

  const suggestSubtasks = async () => {
    if (!task || aiState === 'loading') return;
    setAiState('loading');
    try {
      const res = await fetch('/api/ai-subtasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: task.title, note: task.note || '' }),
      });
      if (res.status === 503) {
        setAiState("AI isn't set up yet");
        return;
      }
      if (!res.ok) {
        setAiState("Couldn't generate subtasks.");
        return;
      }
      const { subtasks } = await res.json();
      (subtasks || []).forEach((str) => {
        if (typeof str === 'string' && str.trim()) addSubtask(task.id, str.trim());
      });
      setAiState('idle');
    } catch {
      setAiState("Couldn't generate subtasks.");
    }
  };

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggableId, setDraggableId] = useState(null);

  const handleDragStart = (e, idx) => {
    setDraggedIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === idx) return;

    const newSubtasks = [...task.subtasks];
    const draggedItem = newSubtasks[draggedIndex];
    newSubtasks.splice(draggedIndex, 1);
    newSubtasks.splice(idx, 0, draggedItem);

    setDraggedIndex(idx);
    updateTask(task.id, { subtasks: newSubtasks });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDraggableId(null);
  };

  if (!task) return null;

  const dueLbl = H.dueLabel(task.dueOffset);
  const startLbl = H.dueLabel(task.startOffset);
  const prioOpt = PRIO.find((p) => p.p === task.priority) || PRIO[3];
  const proj = task.projectId !== 'inbox' ? (projects.find(p => p.id === task.projectId) || H.projectById(task.projectId)) : null;
  const subDone = task.subtasks.filter((s) => s.done).length;

  const TONE = { overdue: 'var(--p1)', today: 'var(--today)', soon: 'var(--p3)', future: 'var(--text-2)' };

  const sortedSubtasks = React.useMemo(() => {
    const subtasksCopy = [...task.subtasks];
    const sSort = task.subtaskSort || 'manual';
    if (sSort === 'due') {
      return subtasksCopy.sort((a, b) => {
        const aDue = a.dueOffset === null ? 99999 : a.dueOffset;
        const bDue = b.dueOffset === null ? 99999 : b.dueOffset;
        if (aDue !== bDue) return aDue - bDue;
        return (a.priority - b.priority) || (b.createdAt - a.createdAt);
      });
    }
    if (sSort === 'priority') {
      return subtasksCopy.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const aDue = a.dueOffset === null ? 99999 : a.dueOffset;
        const bDue = b.dueOffset === null ? 99999 : b.dueOffset;
        if (aDue !== bDue) return aDue - bDue;
        return b.createdAt - a.createdAt;
      });
    }
    if (sSort === 'created') {
      return subtasksCopy.sort((a, b) => b.createdAt - a.createdAt);
    }
    return subtasksCopy;
  }, [task.subtasks, task.subtaskSort]);

  return (
    <div>
      {/* title block */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ paddingTop: 3 }}>
          <Checkbox done={task.done} priority={task.priority} size={22} onToggle={() => toggleTask(task.id)} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <textarea value={localTitle} onChange={(e) => setLocalTitle(e.target.value)} onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
              }
            }}
            rows={1}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontSize: 19, fontWeight: 800, lineHeight: 1.3, color: task.done ? 'var(--text-3)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none', fontFamily: 'inherit' }} />
          <textarea value={localNote} onChange={(e) => setLocalNote(e.target.value)} onBlur={saveNote} placeholder="Add a description…" rows={1}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: 'var(--text-2)', marginTop: 6, fontFamily: 'inherit', minHeight: 24 }} />
        </div>
      </div>

      {/* labels inline */}
      {task.labels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0 4px', paddingLeft: 34 }}>
          {task.labels.map((id) => <LabelChip key={id} id={id} />)}
        </div>
      )}

      {/* subtasks */}
      <div style={{ marginTop: 18, marginLeft: (mobile || inline) ? 0 : 34 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button onClick={() => setSubtasksCollapsed(c => !c)} style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
            <span style={{ transition: 'transform .15s', transform: subtasksCollapsed ? 'rotate(-90deg)' : 'none', display: 'flex', color: 'var(--text-3)' }}><I.chevD size={15} /></span>
            {task.subtasks.length > 0 && <Ring value={subDone} total={task.subtasks.length} size={20} />}
            <span className="section-title" style={{ margin: 0 }}>Sub-tasks{task.subtasks.length ? ` · ${subDone}/${task.subtasks.length}` : ''}</span>
          </button>
          
          {task.subtasks.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button onClick={(e) => { e.stopPropagation(); setMenu(menu === 'subtaskSort' ? null : 'subtaskSort'); }} className="icon-btn" style={{ width: 24, height: 24, borderRadius: 6, background: (task.subtaskSort && task.subtaskSort !== 'manual') ? 'var(--hover-strong)' : undefined }} title="Sort subtasks">
                <I.sliders size={14} style={{ color: (task.subtaskSort && task.subtaskSort !== 'manual') ? 'var(--accent)' : 'var(--text-3)' }} />
              </button>
              {menu === 'subtaskSort' && (
                <Popover onClose={() => setMenu(null)} style={{ top: 26, right: 0, minWidth: 150, zIndex: 100 }}>
                  <div style={{ padding: '6px 8px 4px', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>Sort Subtasks</div>
                  {[
                    { value: 'manual', label: 'Manual' },
                    { value: 'due', label: 'Due Date' },
                    { value: 'priority', label: 'Priority' },
                    { value: 'created', label: 'Date Added' }
                  ].map((opt) => (
                    <div key={opt.value} className="pop-item" style={{
                      fontWeight: (task.subtaskSort || 'manual') === opt.value ? 800 : 600,
                      color: (task.subtaskSort || 'manual') === opt.value ? 'var(--accent)' : 'var(--text)',
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      justifyContent: 'space-between',
                      height: 28,
                      fontSize: 12.5
                    }} onClick={() => { updateTask(task.id, { subtaskSort: opt.value }); setMenu(null); }}>
                      <span>{opt.label}</span>
                      {(task.subtaskSort || 'manual') === opt.value && <I.check size={13} style={{ color: 'var(--accent)' }} />}
                    </div>
                  ))}
                </Popover>
              )}
            </div>
          )}
        </div>
        
        {!subtasksCollapsed && (
          <div>
            {sortedSubtasks.map((s, idx) => !s.done && (
              <SubtaskItem
                key={s.id}
                taskId={task.id}
                s={s}
                index={idx}
                draggedIndex={draggedIndex}
                draggableId={draggableId}
                setDraggableId={setDraggableId}
                handleDragStart={handleDragStart}
                handleDragOver={handleDragOver}
                handleDragEnd={handleDragEnd}
                sortMode={task.subtaskSort && task.subtaskSort !== 'manual'}
              />
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '6px 0' }}>
              <span style={{ color: 'var(--accent)' }}><I.plusSm size={18} /></span>
              <input value={newSub} onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newSub.trim()) { addSubtask(task.id, newSub.trim()); setNewSub(''); } }}
                placeholder="Add sub-task" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 2px' }}>
              <button
                type="button"
                onClick={suggestSubtasks}
                disabled={aiState === 'loading'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px',
                  borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                  border: '1.5px solid var(--border-2)', background: 'transparent',
                  color: aiState === 'loading' ? 'var(--text-3)' : 'var(--accent)',
                  cursor: aiState === 'loading' ? 'default' : 'pointer', whiteSpace: 'nowrap',
                }}
                title="Suggest subtasks with AI"
              >
                <I.sparkle size={14} />
                {aiState === 'loading' ? 'Generating…' : 'Suggest subtasks'}
              </button>
              {aiState !== 'idle' && aiState !== 'loading' && (
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-3)' }}>{aiState}</span>
              )}
            </div>

            {subDone > 0 && (
              <div style={{ marginTop: 4 }}>
                <button onClick={() => setDoneSubsCollapsed(c => !c)} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 0', color: 'var(--text-3)' }}>
                  <span style={{ transition: 'transform .15s', transform: doneSubsCollapsed ? 'rotate(-90deg)' : 'none', display: 'flex' }}><I.chevD size={14} /></span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>Completed · {subDone}</span>
                </button>
                {!doneSubsCollapsed && sortedSubtasks.map((s, idx) => s.done && (
                  <SubtaskItem
                    key={s.id}
                    taskId={task.id}
                    s={s}
                    index={idx}
                    draggedIndex={draggedIndex}
                    draggableId={draggableId}
                    setDraggableId={setDraggableId}
                    handleDragStart={handleDragStart}
                    handleDragOver={handleDragOver}
                    handleDragEnd={handleDragEnd}
                    sortMode={task.subtaskSort && task.subtaskSort !== 'manual'}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* meta */}
      <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
        {/* Status */}
        <div style={{ position: 'relative' }}>
          <MetaRow icon={<StatusIcon status={task.status || 'planned'} priority={task.priority} size={18} />} label="Status" onClick={() => setMenu(menu === 'status' ? null : 'status')}>
            <span style={{ fontWeight: 800, fontSize: 14, color: STATUS_CHOICES[task.status || 'planned'].color }}>
              {STATUS_CHOICES[task.status || 'planned'].label}
            </span>
          </MetaRow>
          {menu === 'status' && (
            <Popover onClose={() => setMenu(null)} style={{ top: 44, right: 12, minWidth: 160, zIndex: 100 }}>
              <div style={{ padding: '6px 8px 4px', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>Set Status</div>
              {Object.entries(STATUS_CHOICES).map(([k, v]) => (
                <div key={k} className="pop-item" style={{ gap: 8 }} onClick={() => {
                  updateTask(task.id, {
                    status: k,
                    done: k === 'done',
                    doneOffset: k === 'done' ? 0 : null
                  });
                  setMenu(null);
                }}>
                  <StatusIcon status={k} priority={task.priority} size={16} />
                  <span>{v.label}</span>
                </div>
              ))}
            </Popover>
          )}
        </div>

        {/* Date / Date Range */}
        <div style={{ position: 'relative' }}>
          <MetaRow
            icon={<I.calendar size={18} />}
            label="Date"
            accent={dueLbl ? TONE[dueLbl.tone] : (startLbl ? TONE[startLbl.tone] : null)}
            onClick={() => setMenu(menu === 'date' ? null : 'date')}
          >
            {(task.startOffset !== null || task.dueOffset !== null) ? (
              <span style={{ fontWeight: 800, fontSize: 14, color: dueLbl ? TONE[dueLbl.tone] : TONE[startLbl.tone] }}>
                {H.dateRangeLabel(task.startOffset, task.dueOffset, task.time)}
              </span>
            ) : (
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-3)' }}>Empty</span>
            )}
          </MetaRow>

        </div>

        {/* Priority */}
        <div style={{ position: 'relative' }}>
          <MetaRow icon={<I.flag size={18} />} label="Priority" accent={prioOpt.color} onClick={() => setMenu(menu === 'prio' ? null : 'prio')}>
            <span style={{ fontWeight: 800, fontSize: 14, color: task.priority < 4 ? prioOpt.color : 'var(--text-3)' }}>{task.priority < 4 ? prioOpt.label : 'None'}</span>
          </MetaRow>
          {menu === 'prio' && (
            <Popover onClose={() => setMenu(null)} style={{ top: 44, right: 12, minWidth: 160, zIndex: 100 }}>
              {PRIO.map((p) => (
                <div key={p.p} className="pop-item" onClick={() => { updateTask(task.id, { priority: p.p }); setMenu(null); }}>
                  <I.flag size={16} sw={2} style={{ color: p.color }} />{p.label}
                </div>
              ))}
            </Popover>
          )}
        </div>

        {/* Project */}
        <div style={{ position: 'relative' }}>
          <MetaRow icon={proj ? <Dot color={proj.color} size={10} /> : <I.inbox size={18} />} label="Project" onClick={() => setMenu(menu === 'project' ? null : 'project')}>
            <span style={{ fontWeight: 800, fontSize: 14, color: proj ? 'var(--text)' : 'var(--text-3)' }}>
              {proj ? proj.name : 'Inbox'}
            </span>
          </MetaRow>
          {menu === 'project' && (
            <Popover onClose={() => setMenu(null)} style={{ top: 44, right: 12, minWidth: 180, zIndex: 100 }}>
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

        {/* Labels */}
        <div style={{ position: 'relative' }}>
          <MetaRow icon={<I.tag size={18} />} label="Labels" onClick={() => setMenu(menu === 'label' ? null : 'label')}>
            {task.labels.length ? <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{task.labels.map((id) => <LabelChip key={id} id={id} small />)}</span>
              : <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-3)' }}>Add labels</span>}
          </MetaRow>
          {menu === 'label' && (
            <Popover onClose={() => { setMenu(null); setCreatingLabel(false); }} style={{ top: 44, right: 12, minWidth: 180, zIndex: 100 }}>
              {customLabels.map((l) => {
                const on = task.labels.includes(l.id);
                return (
                  <div key={l.id} className="pop-item" onClick={() => updateTask(task.id, { labels: on ? task.labels.filter((x) => x !== l.id) : [...task.labels, l.id] })}>
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: l.color }} />{l.name}
                    {on && <I.check size={15} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
                  </div>
                );
              })}
              <div className="divider" style={{ margin: '4px 0' }} />
              {creatingLabel ? (
                <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  <input autoFocus value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="Label name..."
                    style={{ width: '100%', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 4, padding: '4px 6px', fontSize: 12, outline: 'none' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateLabel();
                      if (e.key === 'Escape') setCreatingLabel(false);
                    }} />
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <button onClick={() => setCreatingLabel(false)} style={{ border: 'none', background: 'transparent', color: 'var(--text-3)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleCreateLabel} style={{ border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}>Create</button>
                  </div>
                </div>
              ) : (
                <div className="pop-item" style={{ color: 'var(--accent)', fontWeight: 700 }} onClick={(e) => { e.stopPropagation(); setCreatingLabel(true); }}>
                  <I.plusSm size={14} /> Create label...
                </div>
              )}
            </Popover>
          )}
        </div>



        {/* Recurrence / Repeat */}
        <div style={{ position: 'relative' }}>
          <MetaRow icon={<I.repeat size={18} />} label="Repeat" onClick={() => setMenu(menu === 'repeat' ? null : 'repeat')}>
            <span style={{ fontWeight: 700, fontSize: 14, color: task.recurring ? 'var(--accent-text)' : 'var(--text-3)' }}>
              {task.recurring ? (
                task.recurring.type === 'weekday' ? `Every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][task.recurring.dow]}` : `Every ${task.recurring.type}`
              ) : 'None'}
            </span>
          </MetaRow>
          {menu === 'repeat' && (
            <Popover onClose={() => setMenu(null)} style={{ top: 44, right: 12, minWidth: 180 }}>
              <div className="pop-item" onClick={() => { updateTask(task.id, { recurring: null }); setMenu(null); }}>None</div>
              <div className="pop-item" onClick={() => { updateTask(task.id, { recurring: { type: 'day' } }); setMenu(null); }}>Every day</div>
              <div className="pop-item" onClick={() => { updateTask(task.id, { recurring: { type: 'week' } }); setMenu(null); }}>Every week</div>
              <div className="pop-item" onClick={() => { updateTask(task.id, { recurring: { type: 'month' } }); setMenu(null); }}>Every month</div>
              <div className="pop-item" onClick={() => { updateTask(task.id, { recurring: { type: 'year' } }); setMenu(null); }}>Every year</div>
              <div className="divider" style={{ margin: '4px 8px' }} />
              {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
                <div key={dow} className="pop-item" onClick={() => { updateTask(task.id, { recurring: { type: 'weekday', dow } }); setMenu(null); }}>
                  Every {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow]}
                </div>
              ))}
            </Popover>
          )}
        </div>
      </div>
      {menu === 'date' && (
        <DatePage task={task} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}

export function TaskDetail({ taskId, onClose, mobile }) {
  const { tasks, deleteTask, projects } = useApp();
  const task = tasks.find((t) => t.id === taskId);

  if (!task) return null;

  const proj = task.projectId !== 'inbox' ? (projects.find(p => p.id === task.projectId) || H.projectById(task.projectId)) : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative' }}>
      {/* top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: mobile ? '8px 10px' : '12px 14px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
        <button className="icon-btn" onClick={onClose} aria-label="Close">{mobile ? <I.chevL size={20} /> : <I.x size={18} />}</button>
        {proj ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)' }}>
            <Dot color={proj.color} />{proj.name}
          </span>
        ) : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: 'var(--text-2)' }}><I.inbox size={16} />Inbox</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
          <button className="icon-btn" title="Delete" onClick={() => { deleteTask(task.id); onClose(); }}><I.trash size={17} /></button>
          <button className="icon-btn" title="More"><I.dots size={18} /></button>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: mobile ? '14px 16px 40px' : '18px 18px 40px' }}>
        <TaskEditor taskId={taskId} mobile={mobile} />
      </div>
    </div>
  );
}

function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

function fmtDate(off) {
  if (off === null || off === undefined) return '';
  const d = H.dateFromOffset(off);
  if (!d) return '';
  return `${H.DOW[d.getDay()]}, ${H.MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function IOSToggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} className="ios-toggle" style={{
      background: value ? 'var(--accent)' : 'var(--border-2)',
      justifyContent: value ? 'flex-end' : 'flex-start',
    }}>
      <div className="ios-toggle-thumb" />
    </div>
  );
}

const DURATION_PRESETS = [
  { label: 'None', value: null },
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '1h', value: 60 },
  { label: '1.5h', value: 90 },
  { label: '2h', value: 120 },
  { label: '3h', value: 180 },
];

export function DatePage({ task, startOffset, dueOffset, time, onChange, onClose }) {
  const { updateTask } = useApp();

  const initialStart = task ? task.startOffset : startOffset;
  const initialDue = task ? task.dueOffset : dueOffset;
  const initialStartTime = task ? task.startTime : null;
  const initialTime = task ? task.time : time;

  const hasRange = initialStart !== null && initialStart !== undefined;
  const [rangeOn, setRangeOn] = useState(hasRange);
  const [startTimeOn, setStartTimeOn] = useState(!!initialStartTime);
  const [timeOn, setTimeOn] = useState(!!initialTime);
  const [picking, setPicking] = useState('start'); // 'start' | 'end'
  const today = H.startOfToday();
  const initial = initialDue != null ? initialDue : 0;
  
  const [monthShift, setMonthShift] = useState(() => {
    const d = H.dateFromOffset(initial);
    return d ? (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth()) : 0;
  });

  const start = rangeOn ? (initialStart ?? initialDue) : null;
  const end = initialDue;

  const triggerChange = (newStart, newDue, newStartTime, newTime) => {
    let s = newStart;
    let d = newDue;
    if (typeof s === 'number' && typeof d === 'number' && d < s) {
      d = s;
    }
    if (task) {
      updateTask(task.id, { startOffset: s, dueOffset: d, startTime: newStartTime, time: newTime });
    }
    if (onChange) {
      onChange(s, d, newStartTime, newTime);
    }
  };

  const setSingle = (off) => triggerChange(null, off, null, timeOn ? initialTime : null);
  const setNoDate = () => {
    triggerChange(null, null, null, null);
    setTimeOn(false);
    setStartTimeOn(false);
    setRangeOn(false);
  };

  const tapDay = (off) => {
    if (!rangeOn) {
      setSingle(off);
      return;
    }
    if (picking === 'start') {
      const e = end == null ? off : end;
      const lo = Math.min(off, e), hi = Math.max(off, e);
      triggerChange(lo, hi, startTimeOn ? initialStartTime : null, timeOn ? initialTime : null);
      setPicking('end');
    } else {
      const s = start == null ? off : start;
      const lo = Math.min(off, s), hi = Math.max(off, s);
      triggerChange(lo, hi, startTimeOn ? initialStartTime : null, timeOn ? initialTime : null);
      setPicking('start');
    }
  };

  const toggleRange = () => {
    if (rangeOn) {
      triggerChange(null, end, null, timeOn ? initialTime : null);
      setRangeOn(false);
      setStartTimeOn(false);
    } else {
      const base = end == null ? 0 : end;
      triggerChange(base, base, startTimeOn ? initialStartTime : null, timeOn ? initialTime : null);
      setRangeOn(true);
      setPicking('end');
    }
  };

  const toggleStartTime = () => {
    if (startTimeOn) {
      triggerChange(start, end, null, timeOn ? initialTime : null);
      setStartTimeOn(false);
    } else {
      triggerChange(start, end, initialStartTime || '09:00', timeOn ? initialTime : null);
      setStartTimeOn(true);
    }
  };

  const toggleTime = () => {
    if (timeOn) {
      triggerChange(start, end, startTimeOn ? initialStartTime : null, null);
      setTimeOn(false);
    } else {
      triggerChange(start, end, startTimeOn ? initialStartTime : null, initialTime || '09:00');
      setTimeOn(true);
    }
  };

  const monthShiftFor = (off, today) => {
    if (off === null || off === undefined) return 0;
    const d = H.dateFromOffset(off);
    if (!d) return 0;
    return (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth());
  };

  const handleQuickChip = (off) => {
    if (rangeOn) {
      if (picking === 'start') {
        const e = end == null ? off : end;
        const lo = Math.min(off, e), hi = Math.max(off, e);
        triggerChange(lo, hi, startTimeOn ? initialStartTime : null, timeOn ? initialTime : null);
        setPicking('end');
      } else {
        const s = start == null ? off : start;
        const lo = Math.min(off, s), hi = Math.max(off, s);
        triggerChange(lo, hi, startTimeOn ? initialStartTime : null, timeOn ? initialTime : null);
      }
    } else {
      setSingle(off);
    }
    setMonthShift(monthShiftFor(off, today));
  };

  // Month grid
  const base = new Date(today.getFullYear(), today.getMonth() + monthShift, 1);
  const year = base.getFullYear(), month = base.getMonth();
  const firstDow = base.getDay(); // Sunday-first (0 is Sunday)
  const gridStart = new Date(year, month, 1 - firstDow);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }

  const offOf = (d) => {
    const tToday = new Date(today).setHours(0,0,0,0);
    const tD = new Date(d).setHours(0,0,0,0);
    return Math.round((tD - tToday) / H.MS_DAY);
  };

  const QUICK = [
    { label: 'Today', off: 0 },
    { label: 'Tomorrow', off: 1 },
    { label: 'Next week', off: 7 },
  ];

  return (
    <div className="push-screen" style={{ zIndex: 160 }}>
      {/* Header bar */}
      <div className="m-navbar">
        <button type="button" className="m-navback" onClick={onClose}>
          <I.chevL size={22} /><span>Task</span>
        </button>
        <span className="m-navtitle">Date</span>
        <div className="m-navright">
          {end != null && (
            <button type="button" onClick={setNoDate} style={{ color: 'var(--p1)', fontWeight: 800, fontSize: 14.5 }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 120px' }}>
        {/* Horizontal presets scroll */}
        <div className="scroll-x" style={{ marginBottom: 18 }}>
          {QUICK.map(q => {
            const on = !rangeOn && end === q.off;
            return (
              <button key={q.label} type="button" onClick={() => handleQuickChip(q.off)} style={{
                height: 36, padding: '0 16px', borderRadius: 99, fontSize: 14, fontWeight: 800,
                border: `1.5px solid ${on ? 'transparent' : 'var(--border-2)'}`,
                background: on ? 'var(--accent)' : 'var(--bg-elev)',
                color: on ? '#fff' : 'var(--text-2)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}>{q.label}</button>
            );
          })}
        </div>

        {/* Selected Start/End summary display card */}
        <div className="m-group" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12, cursor: 'pointer' }} onClick={() => setPicking('start')}>
            <span style={{ color: (picking === 'start' || !rangeOn) ? 'var(--accent)' : 'var(--text-3)', display: 'flex' }}>
              <I.calendar size={20} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {rangeOn ? 'Start' : 'Date'}
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: (picking === 'start' || !rangeOn) ? 'var(--accent-text)' : 'var(--text)' }}>
                {rangeOn ? (start != null ? `${fmtDate(start)}${startTimeOn && initialStartTime ? ` at ${fmtTime(initialStartTime)}` : ''}` : 'Pick start') : (end != null ? `${fmtDate(end)}${timeOn && initialTime ? ` at ${fmtTime(initialTime)}` : ''}` : 'No date')}
              </div>
            </div>
          </div>
          {rangeOn && (
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12, borderTop: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setPicking('end')}>
              <span style={{ color: picking === 'end' ? 'var(--accent)' : 'var(--text-3)', display: 'flex' }}>
                <I.arrowR size={20} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>End</div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: picking === 'end' ? 'var(--accent-text)' : 'var(--text)' }}>
                  {end != null ? `${fmtDate(end)}${timeOn && initialTime ? ` at ${fmtTime(initialTime)}` : ''}` : 'Pick end'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Calendar grid card */}
        <div className="m-group" style={{ padding: '12px 12px 14px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', padding: '2px 6px 10px' }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>{H.MONTHS_LONG[month]} {year}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setMonthShift(m => m - 1)}>
                <I.chevL size={18} />
              </button>
              <button type="button" className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setMonthShift(m => m + 1)}>
                <I.chevR size={18} />
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
            {H.DOW.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-3)', padding: '4px 0' }}>
                {d[0]}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', rowGap: 4 }}>
            {cells.map((d, i) => {
              const off = offOf(d);
              const inMonth = d.getMonth() === month;
              const isToday = off === 0;
              const isStart = rangeOn && off === start;
              const isEnd = off === end;
              const isSel = isEnd || isStart;
              const inRange = rangeOn && start != null && end != null && off > start && off < end;
              return (
                <div key={i} style={{ display: 'grid', placeItems: 'center', position: 'relative', height: 42 }}>
                  {inRange && <div style={{ position: 'absolute', inset: '4px -1px', background: 'var(--accent-soft)' }} />}
                  {(isStart && end > start) && <div style={{ position: 'absolute', top: 4, bottom: 4, left: '50%', right: -1, background: 'var(--accent-soft)' }} />}
                  {(isEnd && rangeOn && end > start) && <div style={{ position: 'absolute', top: 4, bottom: 4, right: '50%', left: -1, background: 'var(--accent-soft)' }} />}
                  <button type="button" onClick={() => tapDay(off)} style={{
                    position: 'relative', width: 34, height: 34, borderRadius: 999,
                    fontSize: 14, fontWeight: isSel ? 800 : 700,
                    background: isSel ? 'var(--accent)' : 'transparent',
                    color: isSel ? '#fff' : (inMonth ? 'var(--text)' : 'var(--text-3)'),
                    border: isToday && !isSel ? '1.5px solid var(--accent)' : 'none',
                    opacity: inMonth ? 1 : 0.4,
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center'
                  }}>
                    {d.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Toggles settings card */}
        <div className="m-group">
          <div className="m-toggle-row" style={{ borderBottom: (rangeOn || timeOn || startTimeOn) ? '1px solid var(--border)' : 'none' }}>
            <span style={{ color: 'var(--text-2)', display: 'flex' }}><I.calendar size={19} /></span>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 15.5 }}>End date</span>
            <IOSToggle value={rangeOn} onChange={toggleRange} />
          </div>
          {rangeOn && (
            <>
              <div className="m-toggle-row" style={{ borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-2)', display: 'flex' }}><I.clock size={19} /></span>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 15.5 }}>Start time</span>
                <IOSToggle value={startTimeOn} onChange={toggleStartTime} />
              </div>
              {startTimeOn && (
                <div className="m-toggle-row" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-2)', display: 'flex' }}><I.clock size={19} /></span>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 15.5 }}>Time (Start)</span>
                  <input type="time" value={initialStartTime || '09:00'} onChange={e => triggerChange(start, end, e.target.value, timeOn ? initialTime : null)}
                    className="m-timeinput" />
                </div>
              )}
            </>
          )}
          <div className="m-toggle-row" style={{ borderBottom: timeOn ? '1px solid var(--border)' : 'none' }}>
            <span style={{ color: 'var(--text-2)', display: 'flex' }}><I.clock size={19} /></span>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 15.5 }}>{rangeOn ? 'End time' : 'Include time'}</span>
            <IOSToggle value={timeOn} onChange={toggleTime} />
          </div>
          {timeOn && (
            <div className="m-toggle-row">
              <span style={{ color: 'var(--text-2)', display: 'flex' }}><I.clock size={19} /></span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: 15.5 }}>Time {rangeOn ? '(End)' : ''}</span>
              <input type="time" value={initialTime || '09:00'} onChange={e => triggerChange(start, end, startTimeOn ? initialStartTime : null, e.target.value)}
                className="m-timeinput" />
            </div>
          )}
        </div>

        {/* Duration preset chips — only when a time is set */}
        {timeOn && (
          <div className="m-group" style={{ marginTop: 16, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>Duration</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DURATION_PRESETS.map(p => {
                const cur = task ? (task.duration ?? null) : null;
                const on = (cur || null) === p.value;
                return (
                  <button key={p.label} type="button" onClick={() => { if (task) updateTask(task.id, { duration: p.value }); }} style={{
                    height: 34, padding: '0 14px', borderRadius: 99, fontSize: 13.5, fontWeight: 800,
                    border: `1.5px solid ${on ? 'transparent' : 'var(--border-2)'}`,
                    background: on ? 'var(--accent)' : 'var(--bg-elev)',
                    color: on ? '#fff' : 'var(--text-2)',
                    cursor: 'pointer', whiteSpace: 'nowrap'
                  }}>{p.label}</button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DateSelectorModal({ task, startOffset, dueOffset, time, onChange, onClose }) {
  const { theme } = useApp();
  const narrow = useIsNarrow();
  const initStart = task ? task.startOffset : startOffset;
  const initDue = task ? task.dueOffset : dueOffset;
  const initTime = task ? task.time : time;

  const content = (
    <DatePage
      task={task}
      startOffset={initStart}
      dueOffset={initDue}
      time={initTime}
      onChange={onChange}
      onClose={onClose}
    />
  );

  const host = (typeof document !== 'undefined' && document.querySelector('.app-root')) || document.body;

  if (narrow) {
    return createPortal(
      <div data-theme={theme} style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
        {content}
      </div>,
      host
    );
  } else {
    return createPortal(
      <div className="scrim" data-theme={theme} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onMouseDown={onClose}>
        <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 380, height: 600, borderRadius: 16, background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden', position: 'relative' }}>
          {content}
        </div>
      </div>,
      host
    );
  }
}
