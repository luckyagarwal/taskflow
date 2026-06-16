# Sections, Subtasks, and Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement empty sections, inline subtask title/description editing, and local browser notification reminders.

**Architecture:** Extend store state and local database (Dexie) with support for subtask notes and reminders arrays. Periodically poll task reminders in a background hook, firing notifications, toast popups, and synthesized audio. Show empty sections in the sidebar and enable inline project creation inside each section.

**Tech Stack:** React, Dexie.js, Web Notification API, Web Audio API.

---

### Task 1: Store Actions and Reminders Background Poller

**Files:**
- Modify: `src/store.jsx`

- [ ] **Step 1: Add store actions for reminders**
Modify `src/store.jsx` around `addSection` to add `addReminder`, `deleteReminder`, `markReminderFired`, and a local toast state.
```javascript
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((msg) => {
    const id = 'toast_' + Date.now();
    setToasts((prev) => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const addReminder = useCallback((taskId, timestamp) => {
    setTasks((ts) => ts.map((t) => {
      if (t.id !== taskId) return t;
      const reminders = t.reminders || [];
      const newRem = { id: 'rem_' + Date.now(), time: timestamp, fired: false };
      const updated = { ...t, reminders: [...reminders, newRem] };
      db.tasks.put(updated).catch(() => {});
      return updated;
    }));
  }, []);

  const deleteReminder = useCallback((taskId, reminderId) => {
    setTasks((ts) => ts.map((t) => {
      if (t.id !== taskId) return t;
      const reminders = t.reminders || [];
      const updated = { ...t, reminders: reminders.filter(r => r.id !== reminderId) };
      db.tasks.put(updated).catch(() => {});
      return updated;
    }));
  }, []);

  const markReminderFired = useCallback((taskId, reminderId) => {
    setTasks((ts) => ts.map((t) => {
      if (t.id !== taskId) return t;
      const reminders = t.reminders || [];
      const updated = { ...t, reminders: reminders.map(r => r.id === reminderId ? { ...r, fired: true } : r) };
      db.tasks.put(updated).catch(() => {});
      return updated;
    }));
  }, []);
```

- [ ] **Step 2: Add background reminder poller effect**
Add `useEffect` to poll every 10 seconds inside `useStore()`.
```javascript
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      tasks.forEach((t) => {
        if (t.done) return;
        const activeRems = t.reminders || [];
        activeRems.forEach((r) => {
          if (!r.fired && r.time <= now) {
            markReminderFired(t.id, r.id);
            addToast(`Reminder: ${t.title}`);
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(t.title, { body: t.note || 'Task Reminder' });
            }
            try {
              const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.type = 'sine';
              osc.frequency.value = 880;
              gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.15);
            } catch (e) {}
          }
        });
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [tasks, markReminderFired, addToast]);
```
Expose `toasts`, `addReminder`, `deleteReminder`, `markReminderFired` in the returned object of `useStore`.

---

### Task 2: Toast UI Container

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/MobileApp.jsx`

- [ ] **Step 1: Add Toast container to Desktop App**
In `src/App.jsx`, render the toasts list fixed to the top right of the page:
```javascript
  const { toasts } = useApp();
  // ... inside return statement:
  <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
    {toasts.map(t => (
      <div key={t.id} style={{ background: 'var(--bg-elev)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '12px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13.5, color: 'var(--text)', animation: 'slideUp .2s ease-out' }}>
        {t.msg}
      </div>
    ))}
  </div>
```

- [ ] **Step 2: Add Toast container to Mobile App**
In `src/MobileApp.jsx`, render the same container inside the mobile wrapper.

---

### Task 3: Sidebar empty sections & inline project/section creation

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Render empty sections and add placeholder**
Modify `ProjectGroup` component to support empty list placeholder and inline "+ Add project" action.
```javascript
function ProjectGroup({ title, projects = [], view, setView }) {
  const { tasks, addProject } = useApp();
  const [open, setOpen] = useState(true);
  const [addingProj, setAddingProj] = useState(false);
  const [projName, setProjName] = useState('');

  const handleAdd = () => {
    if (projName.trim()) {
      addProject(projName.trim(), title);
      setProjName('');
      setAddingProj(false);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <button onClick={() => setOpen(!open)} className="nav-item" style={{ width: '100%', border: 'none', background: 'transparent', padding: '6px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', textAlign: 'left' }}>
        <I.chevronDown size={14} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s', flex: 'none' }} />
        <span className="section-title">{title}</span>
      </button>
      {open && projects.map((p) => {
        const n = Sel.byProject(tasks, p.id).length;
        return (
          <NavItem key={p.id} icon={<Dot color={p.color} size={11} />} label={p.name} count={n}
            active={view.type === 'project' && view.id === p.id} onClick={() => setView({ type: 'project', id: p.id })} />
        );
      })}
      {open && projects.length === 0 && (
        <div style={{ padding: '4px 8px 4px 28px', fontSize: 12.5, color: 'var(--text-3)', fontStyle: 'italic' }}>
          No projects
        </div>
      )}
      {open && (
        addingProj ? (
          <div style={{ padding: '4px 8px 4px 28px', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input autoFocus value={projName} onChange={(e) => setProjName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddingProj(false); }}
              placeholder="Project name..."
              style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', borderRadius: 4, padding: '3px 6px', fontSize: 12, outline: 'none' }} />
          </div>
        ) : (
          <button onClick={() => setAddingProj(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 8px 6px 28px', fontSize: 12.5, color: 'var(--text-3)', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
            <I.plusSm size={14} /> Add project
          </button>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update Sidebar to use sections array & add section inline**
Modify `Sidebar` in `src/App.jsx` to:
1. Destructure `sections` and `addSection` from `useApp()`.
2. Render groups by mapping over `sections` instead of `Object.keys(groups)`.
3. Render "+ Add Section" button and inline form at the bottom of the section list.
```javascript
  const [addingSec, setAddingSec] = useState(false);
  const [newSecName, setNewSecName] = useState('');

  const handleAddSection = () => {
    if (newSecName.trim()) {
      addSection(newSecName.trim());
      setNewSecName('');
      setAddingSec(false);
    }
  };
```

---

### Task 4: Subtask Inline Editor

**Files:**
- Modify: `src/detail.jsx`

- [ ] **Step 1: Implement inline editing inside `SubtaskItem`**
Modify `SubtaskItem` component to hold `isEditing`, `editTitle`, and `editNote` local state.
Replace the static subtask title span with the inline editor layout:
```javascript
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(s.title);
  const [editNote, setEditNote] = useState(s.note || '');

  const handleSave = () => {
    if (editTitle.trim()) {
      updateSubtask(taskId, s.id, { title: editTitle.trim(), note: editNote.trim() });
      setIsEditing(false);
    }
  };

  // Render logic:
  // If isEditing is true:
  // Show input for title, input/textarea for description, Save & Cancel buttons.
  // If isEditing is false:
  // Show title + description (if s.note exists) stacked. Clicking on them activates isEditing.
```

---

### Task 5: Reminders Picker UI

**Files:**
- Modify: `src/detail.jsx`

- [ ] **Step 1: Implement Reminders list and Popover form**
In `TaskEditor` component, update the Reminders `MetaRow` to show the active reminders.
Render a date and time picker popover when clicking "Add reminder". Save using `addReminder` and support deletion using `deleteReminder`.
```javascript
  // List active reminders with delete icons
  // Popover date selector + time input
```

---

### Task 6: Mobile App sections & empty states

**Files:**
- Modify: `src/MobileApp.jsx`

- [ ] **Step 1: Implement mobile BrowseView sections & empty placeholders**
Update `BrowseView` and `AddProjectModal` to fetch and render from the explicit `sections` array and support section inline creations.
