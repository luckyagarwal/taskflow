// detail.jsx — task detail / edit panel
import React, { useState } from 'react';
import { Icons as I } from './icons.jsx';
import { H } from './data.js';
import { useApp } from './store.jsx';
import { Checkbox, Dot, LabelChip, Ring } from './ui.jsx';
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
  const { updateSubtask, deleteSubtask } = useApp();
  const [menu, setMenu] = useState(null); // 'due' | 'prio' | 'status' | 'start'
  const [hovered, setHovered] = useState(false);
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
        <button onClick={() => setMenu(menu === 'status' ? null : 'status')} style={{ border: 'none', background: 'transparent', padding: 0, display: 'flex', cursor: 'pointer' }}>
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

      {/* 2. Subtask Title */}
      <span style={{ fontSize: 14, fontWeight: 600, color: s.done ? 'var(--text-3)' : 'var(--text)', textDecoration: s.done ? 'line-through' : 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {s.title}
      </span>

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

      {/* 4. Start Date Popover */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button onClick={() => setMenu(menu === 'start' ? null : 'start')} style={{ border: 'none', background: 'transparent', padding: 4, display: 'flex', cursor: 'pointer', color: startLbl ? TONE[startLbl.tone] : 'var(--text-3)' }} title="Start Date">
          <I.calendar size={14} style={{ opacity: startLbl ? 1 : 0.6 }} />
        </button>
        {startLbl && (
          <span style={{ fontSize: 11, fontWeight: 750, color: TONE[startLbl.tone], marginLeft: 2, marginRight: 2 }}>
            S: {startLbl.text}
          </span>
        )}
        {menu === 'start' && (
          <Popover onClose={() => setMenu(null)} style={{ top: 24, right: 0, zIndex: 100, minWidth: 200 }}>
            <WhenPicker value={s.startOffset} onChange={(val) => {
              updateSubtask(taskId, s.id, { startOffset: val });
            }} onClose={() => setMenu(null)} showTimeField={false} />
          </Popover>
        )}
      </div>

      {/* 5. Due Date Popover */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button onClick={() => setMenu(menu === 'due' ? null : 'due')} style={{ border: 'none', background: 'transparent', padding: 4, display: 'flex', cursor: 'pointer', color: dueLbl ? TONE[dueLbl.tone] : 'var(--text-3)' }} title="Due Date">
          <I.calendar size={14} />
        </button>
        {dueLbl && (
          <span style={{ fontSize: 11, fontWeight: 750, color: TONE[dueLbl.tone], marginLeft: 2, marginRight: 2 }}>
            D: {dueLbl.text}
          </span>
        )}
        {menu === 'due' && (
          <Popover onClose={() => setMenu(null)} style={{ top: 24, right: 0, zIndex: 100, minWidth: 200 }}>
            <WhenPicker value={s.dueOffset} onChange={(val) => {
              updateSubtask(taskId, s.id, { dueOffset: val });
            }} onClose={() => setMenu(null)} showTimeField={false} />
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
  const { tasks, updateTask, toggleTask, addSubtask, projects, labels: customLabels } = useApp();
  const task = tasks.find((t) => t.id === taskId);
  const [menu, setMenu] = useState(null);
  const [newSub, setNewSub] = useState('');
  const [subtasksCollapsed, setSubtasksCollapsed] = useState(false);

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
          <textarea value={task.title} onChange={(e) => updateTask(task.id, { title: e.target.value })} rows={1}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent', fontSize: 19, fontWeight: 800, lineHeight: 1.3, color: task.done ? 'var(--text-3)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none', fontFamily: 'inherit' }} />
          <textarea value={task.note} onChange={(e) => updateTask(task.id, { note: e.target.value })} placeholder="Add a description…" rows={1}
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
            {sortedSubtasks.map((s, idx) => (
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
          </div>
        )}
      </div>

      {/* meta */}
      <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
        {/* Start Date */}
        <div style={{ position: 'relative' }}>
          <MetaRow icon={<I.calendar size={18} />} label="Start date" accent={startLbl ? TONE[startLbl.tone] : null} onClick={() => setMenu(menu === 'start' ? null : 'start')}>
            {startLbl ? <span style={{ fontWeight: 800, fontSize: 14, color: TONE[startLbl.tone] }}>{startLbl.text}</span>
              : <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-3)' }}>Set start date</span>}
          </MetaRow>
          {menu === 'start' && (
            <Popover onClose={() => setMenu(null)} style={{ top: 44, right: 12, minWidth: 200 }}>
              <WhenPicker value={task.startOffset} onChange={(val) => {
                updateTask(task.id, { startOffset: val });
              }} onClose={() => setMenu(null)} showTimeField={false} />
            </Popover>
          )}
        </div>

        {/* Due Date */}
        <div style={{ position: 'relative' }}>
          <MetaRow icon={<I.calendar size={18} />} label="Due date" accent={dueLbl ? TONE[dueLbl.tone] : null} onClick={() => setMenu(menu === 'due' ? null : 'due')}>
            {dueLbl ? <span style={{ fontWeight: 800, fontSize: 14, color: TONE[dueLbl.tone] }}>{dueLbl.text}{task.time ? ` · ${fmtTime(task.time)}` : ''}</span>
              : <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-3)' }}>Set date</span>}
          </MetaRow>
          {menu === 'due' && (
            <Popover onClose={() => setMenu(null)} style={{ top: 44, right: 12, minWidth: 200 }}>
              <WhenPicker value={task.dueOffset} time={task.time} onChange={(val, newTime) => {
                updateTask(task.id, { dueOffset: val, time: newTime });
              }} onClose={() => setMenu(null)} />
            </Popover>
          )}
        </div>

        {/* Priority */}
        <div style={{ position: 'relative' }}>
          <MetaRow icon={<I.flag size={18} />} label="Priority" accent={prioOpt.color} onClick={() => setMenu(menu === 'prio' ? null : 'prio')}>
            <span style={{ fontWeight: 800, fontSize: 14, color: task.priority < 4 ? prioOpt.color : 'var(--text-3)' }}>{task.priority < 4 ? prioOpt.label : 'None'}</span>
          </MetaRow>
          {menu === 'prio' && (
            <Popover onClose={() => setMenu(null)} style={{ top: 44, right: 12, minWidth: 160 }}>
              {PRIO.map((p) => (
                <div key={p.p} className="pop-item" onClick={() => { updateTask(task.id, { priority: p.p }); setMenu(null); }}>
                  <I.flag size={16} sw={2} style={{ color: p.color }} />{p.label}
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
            <Popover onClose={() => setMenu(null)} style={{ top: 44, right: 12, minWidth: 180 }}>
              {customLabels.map((l) => {
                const on = task.labels.includes(l.id);
                return (
                  <div key={l.id} className="pop-item" onClick={() => updateTask(task.id, { labels: on ? task.labels.filter((x) => x !== l.id) : [...task.labels, l.id] })}>
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: l.color }} />{l.name}
                    {on && <I.check size={15} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
                  </div>
                );
              })}
            </Popover>
          )}
        </div>

        <MetaRow icon={<I.bell size={18} />} label="Reminders" onClick={() => {}}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-3)' }}>Add reminder</span>
        </MetaRow>

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
    </div>
  );
}

export function TaskDetail({ taskId, onClose, mobile }) {
  const { tasks, deleteTask, projects } = useApp();
  const task = tasks.find((t) => t.id === taskId);

  if (!task) return null;

  const proj = task.projectId !== 'inbox' ? (projects.find(p => p.id === task.projectId) || H.projectById(task.projectId)) : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
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
