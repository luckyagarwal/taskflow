// store.jsx — app state + actions via context. Exposes AppContext, AppProvider, useApp, useStore, Sel
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { DATA, advanceRecurring } from './data.js';

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

let _n = 10000;

export function AppProvider({ children, value }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useStore() {
  // Persistence keys
  const KEY_TASKS = 'todo-proto-tasks';
  const KEY_PROJECTS = 'todo-proto-projects';
  const KEY_LABELS = 'todo-proto-labels';

  const [tasks, setTasks] = useState(() => {
    const normalize = (list) => list.map((t, idx) => {
      const subtasks = (t.subtasks || []).map((sub, sIdx) => ({
        priority: 4,
        status: 'planned',
        startOffset: null,
        dueOffset: null,
        createdAt: sub.createdAt || (Date.now() - (100 - sIdx) * 1000),
        ...sub
      }));
      return {
        createdAt: t.createdAt || (Date.now() - (1000 - idx) * 60000),
        subtaskSort: t.subtaskSort || 'manual',
        ...t,
        subtasks
      };
    });

    try {
      const saved = localStorage.getItem(KEY_TASKS);
      return saved ? normalize(JSON.parse(saved)) : normalize(DATA.tasks);
    } catch (e) {
      return normalize(DATA.tasks);
    }
  });

  const KEY_SIDEBAR_COLLAPSED = 'todo-proto-sidebar-collapsed';
  const KEY_SIDEBAR_WIDTH = 'todo-proto-sidebar-width';

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY_SIDEBAR_COLLAPSED);
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY_SIDEBAR_WIDTH);
      const val = saved ? JSON.parse(saved) : 280;
      return Math.max(240, Math.min(450, val));
    } catch {
      return 280;
    }
  });

  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY_PROJECTS);
      return saved ? JSON.parse(saved) : DATA.projects.map((p) => ({ ...p }));
    } catch (e) {
      return DATA.projects.map((p) => ({ ...p }));
    }
  });

  const [customLabels, setCustomLabels] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY_LABELS);
      return saved ? JSON.parse(saved) : DATA.labels.map((l) => ({ ...l }));
    } catch (e) {
      return DATA.labels.map((l) => ({ ...l }));
    }
  });

  const [view, setView] = useState({ type: 'today' });
  const [selectedId, setSelectedId] = useState(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [search, setSearch] = useState(false);
  const [expandedIds, setExpandedIds] = useState([]);

  // Sync state changes back to localStorage
  useEffect(() => {
    localStorage.setItem(KEY_TASKS, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(KEY_PROJECTS, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(KEY_LABELS, JSON.stringify(customLabels));
  }, [customLabels]);

  useEffect(() => {
    localStorage.setItem(KEY_SIDEBAR_COLLAPSED, JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem(KEY_SIDEBAR_WIDTH, JSON.stringify(sidebarWidth));
  }, [sidebarWidth]);

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const toggleTask = useCallback((id) => {
    setTasks((ts) => ts.map((t) => {
      if (t.id !== id) return t;
      if (!t.done && t.recurring) {
        const nextDue = advanceRecurring(t.dueOffset, t.recurring);
        return { ...t, dueOffset: nextDue, done: false };
      }
      return { ...t, done: !t.done, doneOffset: !t.done ? 0 : null };
    }));
  }, []);

  const updateTask = useCallback((id, patch) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const addTask = useCallback((partial) => {
    const id = 'task_n' + (++_n);
    let targetProjectId = partial.projectId || 'inbox';
    
    if (typeof targetProjectId === 'string' && targetProjectId.startsWith('__new__')) {
      const newProjName = targetProjectId.replace('__new__', '');
      const newProjId = 'p_' + Date.now();
      const np = {
        id: newProjId,
        name: newProjName,
        color: ['#2D7FF9', '#7C5CFC', '#14B8C4', '#1F9D55', '#E8588A', '#F5A623'][(projects.length + 1) % 6],
        group: 'Personal',
        parent: null
      };
      setProjects((prev) => [...prev, np]);
      targetProjectId = newProjId;
    }

    const finalLabels = (partial.labels || []).map(lId => {
      if (typeof lId === 'string' && lId.startsWith('__new__')) {
        const newTagName = lId.replace('__new__', '');
        const newTagId = 'l_' + Date.now() + Math.random().toString(36).substr(2, 4);
        const newTag = {
          id: newTagId,
          name: newTagName,
          color: ['#7C5CFC', '#1F9D55', '#F5A623', '#9AA0A6', '#2D7FF9', '#E8588A'][Math.floor(Math.random() * 6)]
        };
        setCustomLabels(prev => [...prev, newTag]);
        return newTagId;
      }
      return lId;
    });

    const task = Object.assign({
      id, title: 'Untitled', note: '', projectId: targetProjectId, startOffset: null, dueOffset: null,
      time: null, priority: 4, labels: finalLabels, subtasks: [], done: false, doneOffset: null,
      recurring: null, createdAt: Date.now(), subtaskSort: 'manual'
    }, partial, { projectId: targetProjectId, labels: finalLabels });
    
    setTasks((ts) => [task, ...ts]);
    return id;
  }, [projects]);

  const deleteTask = useCallback((id) => {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const toggleSubtask = useCallback((taskId, subId) => {
    setTasks((ts) => ts.map((t) => t.id === taskId
      ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done, status: !s.done ? 'done' : 'planned' } : s)) } : t));
  }, []);

  const addSubtask = useCallback((taskId, title) => {
    setTasks((ts) => ts.map((t) => t.id === taskId
      ? { ...t, subtasks: [...t.subtasks, { id: 's' + (++_n), title, done: false, priority: 4, status: 'planned', startOffset: null, dueOffset: null, createdAt: Date.now() }] } : t));
  }, []);

  const updateSubtask = useCallback((taskId, subId, patch) => {
    setTasks((ts) => ts.map((t) => t.id === taskId
      ? {
          ...t,
          subtasks: t.subtasks.map((s) => {
            if (s.id !== subId) return s;
            const updated = { ...s, ...patch };
            if (patch.status !== undefined) {
              updated.done = patch.status === 'done';
            }
            if (patch.done !== undefined) {
              updated.status = patch.done ? 'done' : 'planned';
            }
            return updated;
          })
        }
      : t));
  }, []);

  const deleteSubtask = useCallback((taskId, subId) => {
    setTasks((ts) => ts.map((t) => t.id === taskId
      ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subId) } : t));
  }, []);

  const addProject = useCallback((name) => {
    if (!name || !name.trim()) return;
    const np = {
      id: 'p_' + Date.now(),
      name: name.trim(),
      color: ['#2D7FF9', '#7C5CFC', '#14B8C4', '#1F9D55', '#E8588A', '#F5A623'][projects.length % 6],
      group: 'Personal',
      parent: null
    };
    setProjects((prev) => [...prev, np]);
    setView({ type: 'project', id: np.id });
  }, [projects]);

  const deleteProject = useCallback((id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setTasks((prev) => prev.map((t) => t.projectId === id ? { ...t, projectId: 'inbox' } : t));
    setView((v) => v.type === 'project' && v.id === id ? { type: 'inbox' } : v);
  }, []);

  return {
    tasks, projects, labels: customLabels, view, selectedId, quickAdd, search, expandedIds,
    sidebarWidth, setSidebarWidth, sidebarCollapsed, setSidebarCollapsed,
    setView: (v) => { setView(v); setSelectedId(null); },
    setSelectedId, setQuickAdd, setSearch,
    toggleTask, updateTask, addTask, deleteTask, toggleSubtask, addSubtask, updateSubtask, deleteSubtask,
    addProject, deleteProject, toggleExpand,
  };
}

// ── Selectors ───────────────────────────────────────────────
export const Sel = {
  active: (tasks) => tasks.filter((t) => !t.done),
  today: (tasks) => tasks.filter((t) => !t.done && t.dueOffset !== null && t.dueOffset <= 0),
  overdue: (tasks) => tasks.filter((t) => !t.done && t.dueOffset !== null && t.dueOffset < 0),
  dueToday: (tasks) => tasks.filter((t) => !t.done && t.dueOffset === 0),
  upcoming: (tasks) => tasks.filter((t) => !t.done && t.dueOffset !== null && t.dueOffset >= 0),
  inbox: (tasks) => tasks.filter((t) => !t.done && t.projectId === 'inbox'),
  byProject: (tasks, pid) => tasks.filter((t) => !t.done && t.projectId === pid),
  byLabel: (tasks, lid) => tasks.filter((t) => !t.done && (t.labels || []).includes(lid)),
  done: (tasks) => tasks.filter((t) => t.done).sort((a, b) => (b.doneOffset || 0) - (a.doneOffset || 0)),
  counts: (tasks) => ({
    today: tasks.filter((t) => !t.done && t.dueOffset !== null && t.dueOffset <= 0).length,
    inbox: tasks.filter((t) => !t.done && t.projectId === 'inbox').length,
    upcoming: tasks.filter((t) => !t.done && t.dueOffset !== null && t.dueOffset >= 0).length,
  }),
};
