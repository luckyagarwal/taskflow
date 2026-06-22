// store.jsx — app state + actions via context. Exposes AppContext, AppProvider, useApp, useStore, Sel
import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { DATA, advanceRecurring } from './data.js';
import { saveChanges, startOnlineSync, fullSync, getSyncHeaders, setOnAuthStatusChange, fetchAllData, isLocalHostname } from './sync.js';
import * as repo from './repo.js';
import { childrenOf, canSetParent, promoteChildrenOnDelete } from './projects.js';
import { moveTask as applyMove } from './move.js';

export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// Globally-unique id generator. Task/subtask ids must be unique ACROSS app
// instances: the server upserts by id, so a deterministic per-session counter
// would make two devices generate the same id and silently overwrite each
// other's records. Combine a timestamp with randomness to avoid collisions.
function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function AppProvider({ children, value }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useStore() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [customLabels, setCustomLabels] = useState([]);
  const [sections, setSections] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [wipingDb, setWipingDb] = useState(false);
  const [barsVisible, setBarsVisible] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(true);

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('todo-proto-theme');
      return saved || 'light';
    } catch {
      return 'light';
    }
  });

  const [density, setDensity] = useState(() => {
    try {
      const saved = localStorage.getItem('todo-proto-density');
      return saved || 'card';
    } catch {
      return 'card';
    }
  });

  const [weekStartDay, setWeekStartDay] = useState(() => {
    try {
      const saved = localStorage.getItem('todo-proto-week-start');
      return saved !== null ? parseInt(saved) : 1; // 0=Sun, 1=Mon (default)
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    try { localStorage.setItem('todo-proto-week-start', weekStartDay); } catch (e) { console.error(e); }
  }, [weekStartDay]);

  // Opacity for tasks with no scheduled time (orphans in unscheduled strip)
  const [noTimeOpacity, setNoTimeOpacity] = useState(() => {
    try { const s = localStorage.getItem('todo-proto-no-time-opacity'); return s !== null ? parseFloat(s) : 0.5; } catch { return 0.5; }
  });
  useEffect(() => {
    try { localStorage.setItem('todo-proto-no-time-opacity', noTimeOpacity); } catch (e) { console.error(e); }
  }, [noTimeOpacity]);

  // Opacity for blocks with no end time / duration (open-ended on timeline)
  const [noDurOpacity, setNoDurOpacity] = useState(() => {
    try { const s = localStorage.getItem('todo-proto-no-dur-opacity'); return s !== null ? parseFloat(s) : 0.7; } catch { return 0.7; }
  });
  useEffect(() => {
    try { localStorage.setItem('todo-proto-no-dur-opacity', noDurOpacity); } catch (e) { console.error(e); }
  }, [noDurOpacity]);

  useEffect(() => {
    try {
      localStorage.setItem('todo-proto-theme', theme);
    } catch (e) {
      console.error(e);
    }
    // Keep the browser status bar / chrome in sync with the theme.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#242427' : '#ffffff');
    const sb = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (sb) sb.setAttribute('content', theme === 'dark' ? 'black' : 'default');
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('todo-proto-density', density);
    } catch (e) {
      console.error(e);
    }
  }, [density]);

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

  const [view, setView] = useState({ type: 'today' });
  const [selectedId, setSelectedId] = useState(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState([]);
  const [quickAdd, setQuickAdd] = useState(false);
  const [search, setSearch] = useState(false);
  const [expandedIds, setExpandedIds] = useState([]);
  const [collapsedSections, setCollapsedSections] = useState([]);

  // Per-task debounce timers for text edits (title/note), so typing coalesces
  // into a single local write instead of one per keystroke.
  const textDebounce = useRef({});

  // Apply a {tasks,projects,labels,sections} snapshot (from the local store) to
  // React state. This is the single render path — the sync engine calls it after
  // every local load and every server merge.
  const applyToState = useCallback((data) => {
    if (!data) return;
    const t = (data.tasks || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const p = (data.projects || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const l = data.labels || [];
    const s = (data.sections || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    setTasks(t);
    setProjects(p);
    setCustomLabels(l);
    setSections(s);
  }, []);

  // One-time migration of legacy localStorage task data into the local store.
  // Runs only when both the local store and the server are empty.
  const migrateLegacyLocalStorage = useCallback(async (local) => {
    const KEY_TASKS = 'todo-proto-tasks';
    const KEY_PROJECTS = 'todo-proto-projects';
    const KEY_LABELS = 'todo-proto-labels';

    const empty = (local.tasks || []).length === 0 && (local.projects || []).length === 0 &&
                  (local.labels || []).length === 0 && (local.sections || []).length === 0;
    if (!empty) return false;

    const localTasks = localStorage.getItem(KEY_TASKS);
    const localProjects = localStorage.getItem(KEY_PROJECTS);
    const localLabels = localStorage.getItem(KEY_LABELS);
    if (!localTasks && !localProjects && !localLabels) return false;

    const normalize = (list) => list.map((tItem, idx) => {
      const subtasks = (tItem.subtasks || []).map((sub, sIdx) => ({
        priority: 4, status: 'planned', startOffset: null, dueOffset: null,
        createdAt: sub.createdAt || (Date.now() - (100 - sIdx) * 1000),
        ...sub
      }));
      return {
        createdAt: tItem.createdAt || (Date.now() - (1000 - idx) * 60000),
        subtaskSort: tItem.subtaskSort || 'manual',
        position: tItem.position !== undefined ? tItem.position : idx,
        ...tItem,
        subtasks
      };
    });

    const t = localTasks ? normalize(JSON.parse(localTasks)) : [];
    const p = localProjects ? JSON.parse(localProjects).map((proj, idx) => ({ position: idx, ...proj })) : [];
    const l = localLabels ? JSON.parse(localLabels) : [];

    localStorage.removeItem(KEY_TASKS);
    localStorage.removeItem(KEY_PROJECTS);
    localStorage.removeItem(KEY_LABELS);

    let s = [];
    const uniqueProjGroups = Array.from(new Set(p.map((proj) => proj.group))).filter(Boolean);
    if (uniqueProjGroups.length) {
      s = uniqueProjGroups.map((g, idx) => ({ id: `sec_${idx}_${Date.now()}`, name: g, position: idx }));
    }

    // Write durably into the local store + outbox (syncs in the background).
    await repo.enqueue({ tasks: t, projects: p, labels: l, sections: s }, {});
    return true;
  }, []);

  // First-run seeding of the sample dataset (DATA). Runs once per device for a
  // brand-new profile so the app isn't empty on first open. We persist a
  // 'taskflow-seeded' flag so a user who intentionally clears everything (or
  // whose data later syncs in) is never re-seeded.
  const seedFirstRun = useCallback(async (local) => {
    if (localStorage.getItem('taskflow-seeded')) return false;

    const empty = (local.tasks || []).length === 0 && (local.projects || []).length === 0 &&
                  (local.labels || []).length === 0 && (local.sections || []).length === 0;
    if (!empty) {
      // Already have local data (migrated legacy, or this profile has run
      // before). Remember that, and never seed on top of real data.
      localStorage.setItem('taskflow-seeded', 'true');
      return false;
    }

    // Don't seed onto an account that already has server data — e.g. a returning
    // user opening the app in a fresh browser profile. That would duplicate
    // everything and push sample rows back to their real account. Check the
    // server snapshot first; if it has any records, let background sync pull
    // them instead of seeding. Only seed when the server is reachably empty, or
    // when there's no backend at all (local dev with no Cloudflare Functions) —
    // a transient fetch failure on a real backend returns null and must NOT seed.
    const snapshot = await fetchAllData();
    const serverHasData = snapshot && (
      (snapshot.tasks || []).length || (snapshot.projects || []).length ||
      (snapshot.labels || []).length || (snapshot.sections || []).length
    );
    const serverEmpty = snapshot && !serverHasData;
    if (!serverEmpty && !isLocalHostname()) {
      // Server has data, or it's unreachable on a non-local host — don't risk it.
      if (serverHasData) localStorage.setItem('taskflow-seeded', 'true');
      return false;
    }

    // Fresh everywhere (or local dev with no backend): seed the sample dataset
    // through the same durable path the legacy migration uses. It writes to the
    // local store + outbox, so background sync flushes it to the server once.
    await repo.enqueue({ tasks: DATA.tasks, projects: DATA.projects, labels: DATA.labels, sections: [] }, {});
    localStorage.setItem('taskflow-seeded', 'true');
    return true;
  }, []);

  const addToast = useCallback((msg) => {
    const id = 'toast_' + Date.now();
    setToasts((prev) => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Durable, non-blocking save: writes to the local store + outbox immediately
  // and lets the sync engine flush to the server with retry. No await, no
  // reload-on-failure — failed network writes stay queued, never lost.
  const queueSave = useCallback((upserts = {}, deletes = {}) => {
    repo.enqueue(upserts, deletes);
  }, []);

  useEffect(() => {
    setOnAuthStatusChange((status) => {
      setIsAuthorized(status);
    });
    return () => setOnAuthStatusChange(null);
  }, []);

  // Boot: render from the local store instantly (offline-capable), run the
  // one-time legacy migration, then start background sync with the server.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await repo.loadAll();
      if (cancelled) return;
      applyToState(local);
      setLoaded(true);

      let current = local;
      const migrated = await migrateLegacyLocalStorage(current);
      if (migrated) {
        current = await repo.loadAll();
        if (!cancelled) applyToState(current);
      }

      const seeded = await seedFirstRun(current);
      if (seeded && !cancelled) applyToState(await repo.loadAll());

      startOnlineSync((data) => { if (!cancelled) applyToState(data); });
    })();
    return () => { cancelled = true; };
  }, [applyToState, migrateLegacyLocalStorage, seedFirstRun]);

  useEffect(() => {
    localStorage.setItem(KEY_SIDEBAR_COLLAPSED, JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem(KEY_SIDEBAR_WIDTH, JSON.stringify(sidebarWidth));
  }, [sidebarWidth]);

  const toggleExpand = useCallback((id) => {
    setExpandedIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const toggleSection = useCallback((id) => {
    setCollapsedSections((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const toggleTask = useCallback((id) => {
    setTasks((ts) => ts.map((t) => {
      if (t.id !== id) return t;
      let updated;
      if (!t.done && t.recurring) {
        const nextDue = advanceRecurring(t.dueOffset, t.recurring);
        updated = { ...t, dueOffset: nextDue, done: false, status: 'planned' };
      } else {
        const nextDone = !t.done;
        updated = { ...t, done: nextDone, doneOffset: nextDone ? 0 : null, status: nextDone ? 'done' : 'planned' };
      }
      queueSave({ tasks: [updated] });
      return updated;
    }));
  }, [queueSave]);

  const updateTask = useCallback((id, patch) => {
    setTasks((ts) => ts.map((t) => {
      if (t.id === id) {
        const updated = { ...t, ...patch };
        if (typeof updated.startOffset === 'number' && typeof updated.dueOffset === 'number') {
          if (updated.dueOffset < updated.startOffset) {
            if (patch.startOffset !== undefined) {
              updated.dueOffset = updated.startOffset;
            } else {
              updated.startOffset = updated.dueOffset;
            }
          }
        }
        // Debounce pure text edits; persist everything else immediately. Either
        // way, cancel any pending text timer so a stale write can't land late.
        clearTimeout(textDebounce.current[id]);
        const isTextOnly = Object.keys(patch).every((k) => k === 'title' || k === 'note');
        if (isTextOnly) {
          textDebounce.current[id] = setTimeout(() => {
            repo.putRecord('tasks', updated);
            delete textDebounce.current[id];
          }, 350);
        } else {
          queueSave({ tasks: [updated] });
        }
        return updated;
      }
      return t;
    }));
  }, [queueSave]);

  const addTask = useCallback((partial) => {
    const id = uid('task_');
    let targetProjectId = partial.projectId || 'inbox';
    
    let npToSave = null;
    if (typeof targetProjectId === 'string' && targetProjectId.startsWith('__new__')) {
      const newProjName = targetProjectId.replace('__new__', '');
      const newProjId = uid('p_');
      const np = {
        id: newProjId,
        name: newProjName,
        color: ['#2D7FF9', '#7C5CFC', '#14B8C4', '#1F9D55', '#E8588A', '#F5A623'][(projects.length + 1) % 6],
        group: 'Personal',
        parent: null
      };
      setProjects((prev) => [...prev, np]);
      npToSave = np;
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
        setCustomLabels((prev) => {
          const next = [...prev, newTag];
          queueSave({ labels: [newTag] });
          return next;
        });
        return newTagId;
      }
      return lId;
    });

    const minPos = tasks.length > 0 ? Math.min(...tasks.map(t => t.position ?? 0)) : 0;
    const task = Object.assign({
      id, title: 'Untitled', note: '', projectId: targetProjectId, startOffset: null, dueOffset: null,
      time: null, duration: null, priority: 4, labels: finalLabels, subtasks: [], done: false, doneOffset: null,
      recurring: null, createdAt: Date.now(), subtaskSort: 'manual',
      position: minPos - 1, status: 'planned'
    }, partial, { projectId: targetProjectId, labels: finalLabels });

    if (typeof task.startOffset === 'number' && typeof task.dueOffset === 'number') {
      if (task.dueOffset < task.startOffset) {
        task.dueOffset = task.startOffset;
      }
    }
    
    setTasks((ts) => [task, ...ts]);
    const upserts = { tasks: [task] };
    if (npToSave) upserts.projects = [npToSave];
    queueSave(upserts);
    return id;
  }, [projects, tasks, queueSave]);

  const deleteTask = useCallback((id) => {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    queueSave({}, { tasks: [id] });
    setSelectedId((s) => (s === id ? null : s));
  }, [queueSave]);

  const toggleMultiSelect = useCallback((id) => {
    setMultiSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const clearMultiSelect = useCallback(() => {
    setMultiSelectedIds([]);
  }, []);

  const bulkDelete = useCallback((idsToDelete) => {
    const ids = idsToDelete || multiSelectedIds;
    if (!ids.length) return;
    setTasks((ts) => ts.filter((t) => !ids.includes(t.id)));
    queueSave({}, { tasks: ids });
    setMultiSelectedIds((prev) => prev.filter((x) => !ids.includes(x)));
    setSelectedId((s) => (ids.includes(s) ? null : s));
  }, [multiSelectedIds, queueSave]);

  const bulkComplete = useCallback((idsToComplete) => {
    const ids = idsToComplete || multiSelectedIds;
    if (!ids.length) return;
    const completedTasks = [];
    setTasks((ts) =>
      ts.map((t) => {
        if (!ids.includes(t.id)) return t;
        if (t.done) return t;
        let updated;
        if (t.recurring) {
          const nextDue = advanceRecurring(t.dueOffset, t.recurring);
          updated = { ...t, dueOffset: nextDue, done: false, status: 'planned' };
        } else {
          updated = { ...t, done: true, doneOffset: 0, status: 'done' };
        }
        completedTasks.push(updated);
        return updated;
      })
    );
    if (completedTasks.length) {
      queueSave({ tasks: completedTasks });
    }
    setMultiSelectedIds((prev) => prev.filter((x) => !ids.includes(x)));
  }, [multiSelectedIds, queueSave]);

  const toggleSubtask = useCallback((taskId, subId) => {
    setTasks((ts) => ts.map((t) => {
      if (t.id !== taskId) return t;
      const updated = { ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done, status: !s.done ? 'done' : 'planned' } : s)) };
      queueSave({ tasks: [updated] });
      return updated;
    }));
  }, [queueSave]);

  const addSubtask = useCallback((taskId, title) => {
    setTasks((ts) => ts.map((t) => {
      if (t.id !== taskId) return t;
      const updated = { ...t, subtasks: [...t.subtasks, { id: uid('s_'), title, done: false, priority: 4, status: 'planned', startOffset: null, dueOffset: null, createdAt: Date.now() }] };
      queueSave({ tasks: [updated] });
      return updated;
    }));
  }, [queueSave]);

  const updateSubtask = useCallback((taskId, subId, patch) => {
    setTasks((ts) => ts.map((t) => {
      if (t.id !== taskId) return t;
      const updated = {
        ...t,
        subtasks: t.subtasks.map((s) => {
          if (s.id !== subId) return s;
          const updatedSub = { ...s, ...patch };
          if (patch.status !== undefined) {
            updatedSub.done = patch.status === 'done';
          }
          if (patch.done !== undefined) {
            updatedSub.status = patch.done ? 'done' : 'planned';
          }
          if (typeof updatedSub.startOffset === 'number' && typeof updatedSub.dueOffset === 'number') {
            if (updatedSub.dueOffset < updatedSub.startOffset) {
              if (patch.startOffset !== undefined) {
                updatedSub.dueOffset = updatedSub.startOffset;
              } else {
                updatedSub.startOffset = updatedSub.dueOffset;
              }
            }
          }
          return updatedSub;
        })
      };
      queueSave({ tasks: [updated] });
      return updated;
    }));
  }, [queueSave]);

  const deleteSubtask = useCallback((taskId, subId) => {
    setTasks((ts) => ts.map((t) => {
      if (t.id !== taskId) return t;
      const updated = { ...t, subtasks: t.subtasks.filter((s) => s.id !== subId) };
      queueSave({ tasks: [updated] });
      return updated;
    }));
  }, [queueSave]);

  const addProject = useCallback((name, group = 'Personal', parent = null) => {
    if (!name || !name.trim()) return;
    let resolvedGroup = (group && group.trim()) || 'Personal';
    if (parent) {
      const parentProj = projects.find((p) => p.id === parent);
      if (parentProj) resolvedGroup = parentProj.group;
    }
    const np = {
      id: uid('p_'),
      name: name.trim(),
      color: ['#2D7FF9', '#7C5CFC', '#14B8C4', '#1F9D55', '#E8588A', '#F5A623'][projects.length % 6],
      group: resolvedGroup,
      parent: parent || null,
      position: projects.length
    };
    setProjects((prev) => [...prev, np]);
    queueSave({ projects: [np] });
    setView({ type: 'project', id: np.id });
  }, [projects, queueSave]);

  const deleteProject = useCallback((id) => {
    const promotedChildren = promoteChildrenOnDelete(projects, id);
    setProjects((prev) => {
      const patched = prev.map((p) => {
        const promo = promotedChildren.find((c) => c.id === p.id);
        return promo ? promo : p;
      });
      return patched.filter((p) => p.id !== id);
    });
    if (promotedChildren.length) {
      queueSave({ projects: promotedChildren });
    }
    const tasksToUpdate = [];
    setTasks((prev) => {
      const next = prev.map((t) => {
        if (t.projectId === id) {
          const updated = { ...t, projectId: 'inbox' };
          tasksToUpdate.push(updated);
          return updated;
        }
        return t;
      });
      return next;
    });
    queueSave({ tasks: tasksToUpdate }, { projects: [id] });
    setView((v) => v.type === 'project' && v.id === id ? { type: 'inbox' } : v);
  }, [projects, queueSave]);

  // Propagate a top-level project's new group to all of its children, so a
  // child's section always follows its parent (decision #2 in the spec).
  const cascadeGroupToChildren = useCallback((projectId, newGroup) => {
    setProjects((prev) => {
      const kids = childrenOf(prev, projectId);
      if (!kids.length) return prev;
      const patched = kids.map((c) => ({ ...c, group: newGroup }));
      queueSave({ projects: patched });
      return prev.map((p) => {
        const patch = patched.find((c) => c.id === p.id);
        return patch ? patch : p;
      });
    });
  }, [queueSave]);

  const updateProject = useCallback((id, patch) => {
    setProjects((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const updated = { ...p, ...patch };
      queueSave({ projects: [updated] });
      if (patch.group !== undefined && patch.group !== p.group) {
        cascadeGroupToChildren(id, patch.group);
      }
      return updated;
    }));
  }, [queueSave, cascadeGroupToChildren]);

  // Move a project to sit immediately before (placeBefore) or after the target.
  // Deterministic regardless of original positions, so the drop lands exactly
  // where the insertion line was shown.
  const reorderProjects = useCallback((draggedId, targetId, placeBefore = true) => {
    setProjects((prev) => {
      const next = [...prev];
      const dragIdx = next.findIndex(p => p.id === draggedId);
      const tIdx0 = next.findIndex(p => p.id === targetId);
      if (dragIdx === -1 || tIdx0 === -1 || draggedId === targetId) return prev;

      const targetGroup = next[tIdx0].group;
      const [removed] = next.splice(dragIdx, 1);
      const targetIdx = next.findIndex(p => p.id === targetId);
      const insertIdx = placeBefore ? targetIdx : targetIdx + 1;
      next.splice(insertIdx, 0, removed);

      // Dropping next to a target adopts that target's section.
      let groupChanged = false;
      if (removed.group !== targetGroup) {
        removed.group = targetGroup;
        groupChanged = true;
      }
      // A moved parent drags its children's section with it (decision #2).
      if (groupChanged) {
        for (const item of next) {
          if (item.parent === removed.id) item.group = removed.group;
        }
      }

      const updated = next.map((p, idx) => ({ ...p, position: idx }));
      queueSave({ projects: updated });
      return updated;
    });
  }, [queueSave]);

  // Nest a child project under a parent (or detach when parentId is null).
  // No-ops on an invalid request (cycle, self, grandchild) per canSetParent.
  const setProjectParent = useCallback((childId, parentId) => {
    if (!canSetParent(projects, childId, parentId)) {
      addToast("Can't nest that project there");
      return;
    }
    setProjects((prev) => prev.map((p) => {
      if (p.id !== childId) return p;
      const updated = { ...p, parent: parentId || null };
      if (parentId) {
        const parentProj = prev.find((pp) => pp.id === parentId);
        if (parentProj) updated.group = parentProj.group;
      }
      queueSave({ projects: [updated] });
      return updated;
    }));
  }, [projects, queueSave, addToast]);

  const [sorts, setSorts] = useState(() => {
    try {
      const saved = localStorage.getItem('todo-proto-view-sorts');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const setViewSort = useCallback((viewKey, val) => {
    setSorts((prev) => {
      const next = { ...prev, [viewKey]: val };
      localStorage.setItem('todo-proto-view-sorts', JSON.stringify(next));
      return next;
    });
  }, []);

  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('todo-proto-view-filters');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const setViewFilter = useCallback((viewKey, val) => {
    setFilters((prev) => {
      const next = { ...prev, [viewKey]: val };
      localStorage.setItem('todo-proto-view-filters', JSON.stringify(next));
      return next;
    });
  }, []);

  const [savedFilters, setSavedFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('todo-proto-saved-filters');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('todo-proto-saved-filters', JSON.stringify(savedFilters));
    } catch (e) {
      console.error(e);
    }
  }, [savedFilters]);

  const addSavedFilter = useCallback((name, query) => {
    if (!name || !name.trim() || !query || !query.trim()) return;
    setSavedFilters((prev) => [...prev, { id: uid('sf_'), name: name.trim(), query: query.trim() }]);
  }, []);

  const deleteSavedFilter = useCallback((id) => {
    setSavedFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Pointer-drag move: reorder + optional field patch (new day or status),
  // inserting the dragged task before `beforeId` (or at the end when null).
  const moveTask = useCallback((draggedId, patch = {}, beforeId = null) => {
    setTasks((prev) => {
      const updated = applyMove(prev, draggedId, patch, beforeId);
      if (updated === prev) return prev;
      queueSave({ tasks: updated });
      return updated;
    });
  }, [queueSave]);

  // Reorder (no field change): insert the dragged task before `targetId`.
  // Same operation as moveTask with an empty patch.
  const reorderTasks = useCallback((draggedId, targetId) => {
    moveTask(draggedId, {}, targetId);
  }, [moveTask]);

  const addLabel = useCallback((name) => {
    if (!name || !name.trim()) return null;
    const newTagId = 'l_' + Date.now() + Math.random().toString(36).substr(2, 4);
    const newTag = {
      id: newTagId,
      name: name.trim(),
      color: ['#7C5CFC', '#1F9D55', '#F5A623', '#9AA0A6', '#2D7FF9', '#E8588A'][Math.floor(Math.random() * 6)]
    };
    setCustomLabels((prev) => {
      const next = [...prev, newTag];
      queueSave({ labels: [newTag] });
      return next;
    });
    return newTagId;
  }, [queueSave]);

  const updateLabel = useCallback((id, patch) => {
    setCustomLabels((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const updated = { ...l, ...patch };
      queueSave({ labels: [updated] });
      return updated;
    }));
  }, [queueSave]);

  const deleteLabel = useCallback((id) => {
    setCustomLabels((prev) => prev.filter((l) => l.id !== id));
    const tasksToUpdate = [];
    setTasks((prev) => {
      const next = prev.map((t) => {
        if ((t.labels || []).includes(id)) {
          const updated = { ...t, labels: t.labels.filter((x) => x !== id) };
          tasksToUpdate.push(updated);
          return updated;
        }
        return t;
      });
      return next;
    });
    queueSave({ tasks: tasksToUpdate }, { labels: [id] });
  }, [queueSave]);

  const addSection = useCallback((name) => {
    if (!name || !name.trim()) return null;
    const cleanName = name.trim();
    if (sections.some(s => s.name.toLowerCase() === cleanName.toLowerCase())) return null;
    
    const newSec = {
      id: uid('sec_'),
      name: cleanName,
      position: sections.length
    };
    setSections((prev) => [...prev, newSec]);
    queueSave({ sections: [newSec] });
    return newSec;
  }, [sections, queueSave]);

  const deleteSection = useCallback((id) => {
    setSections((prev) => {
      const secToDelete = prev.find((s) => s.id === id);
      if (!secToDelete) return prev;
      
      const newSecs = prev.filter((s) => s.id !== id);
      
      const projectsToDelete = [];
      const tasksToUpdate = [];
      
      setProjects((pPrev) => {
        const projsInSec = pPrev.filter((p) => p.group === secToDelete.name);
        const nextProjs = pPrev.filter((p) => p.group !== secToDelete.name);
        
        projsInSec.forEach((p) => {
          projectsToDelete.push(p.id);
        });
        
        setTasks((tPrev) => {
          const nextTasks = tPrev.map((t) => {
            const isTaskInDeletedProject = projsInSec.some((p) => p.id === t.projectId);
            if (isTaskInDeletedProject) {
              const updated = { ...t, projectId: 'inbox' };
              tasksToUpdate.push(updated);
              return updated;
            }
            return t;
          });
          return nextTasks;
        });

        return nextProjs;
      });

      queueSave({ tasks: tasksToUpdate }, { sections: [id], projects: projectsToDelete });
      return newSecs;
    });
  }, [queueSave]);

  const updateSection = useCallback((id, patch) => {
    setSections((prev) => {
      const sec = prev.find((s) => s.id === id);
      if (!sec) return prev;

      const updatedSecs = prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...patch };
        queueSave({ sections: [updated] });
        return updated;
      });

      if (patch.name && patch.name !== sec.name) {
        setProjects((pPrev) => {
          const projectsToUpdate = [];
          const nextProjs = pPrev.map((p) => {
            if (p.group === sec.name) {
              const updatedProj = { ...p, group: patch.name };
              projectsToUpdate.push(updatedProj);
              return updatedProj;
            }
            return p;
          });
          if (projectsToUpdate.length) {
            queueSave({ projects: projectsToUpdate });
          }
          return nextProjs;
        });
      }

      return updatedSecs;
    });
  }, [queueSave]);

  const reorderSections = useCallback((draggedId, targetId) => {
    setSections((prev) => {
      const next = [...prev];
      const dragIdx = next.findIndex(s => s.id === draggedId);
      const targetIdx = next.findIndex(s => s.id === targetId);
      if (dragIdx !== -1 && targetIdx !== -1) {
        const [removed] = next.splice(dragIdx, 1);
        next.splice(targetIdx, 0, removed);
        
        const updated = next.map((s, idx) => ({ ...s, position: idx }));
        queueSave({ sections: updated });
        return updated;
      }
      return prev;
    });
  }, [queueSave]);


  const resetDatabase = useCallback(async () => {
    setTasks([]);
    setProjects([]);
    setCustomLabels([]);
    setSections([]);
    setSelectedId(null);
    setMultiSelectedIds([]);

    setWipingDb(true);
    try {
      const res = await fetch('/api/save', {
        method: 'DELETE',
        headers: getSyncHeaders(null),
        cache: 'no-store'
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`Failed to clear server database: ${res.status} ${text}`);
      }
    } catch (e) {
      console.error("Failed to delete remote sync database", e);
    }

    try {
      await repo.clearAll();
      localStorage.clear();
      localStorage.setItem('taskflow-seeded', 'true');

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
    } catch (e) {
      console.error("Failed to clear local database", e);
    } finally {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('t', Date.now().toString());
        window.location.href = url.toString();
      } catch {
        window.location.reload();
      }
    }
  }, []);

  const exportDatabase = useCallback(async () => {
    try {
      const backup = {
        version: 3,
        tasks,
        projects,
        labels: customLabels,
        sections,
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", url);
      downloadAnchor.setAttribute("download", `taskflow-backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);

      addToast("Backup exported successfully!");
    } catch (err) {
      console.error("Failed to export backup", err);
      addToast("Failed to export backup!");
    }
  }, [tasks, projects, customLabels, sections, addToast]);

  const importDatabase = useCallback(async (jsonData) => {
    try {
      const backup = JSON.parse(jsonData);
      
      if (!backup || typeof backup !== 'object') throw new Error("Invalid backup format");
      if (!Array.isArray(backup.tasks) || !Array.isArray(backup.projects)) {
        throw new Error("Missing required tables: tasks or projects");
      }

      await saveChanges({
        tasks: backup.tasks,
        projects: backup.projects,
        labels: backup.labels || [],
        sections: backup.sections || []
      }, {});

      // Wipe the local store so the post-reload full sync rebuilds it cleanly
      // from the server (the import replaced server state).
      await repo.clearAll();

      addToast("Backup imported successfully! Reloading...");
      setTimeout(() => {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('t', Date.now().toString());
          window.location.href = url.toString();
        } catch {
          window.location.reload();
        }
      }, 1500);
    } catch (err) {
      console.error("Failed to import backup", err);
      alert("Failed to import backup: " + err.message);
    }
  }, [addToast]);

  const forceSync = useCallback(async () => {
    try {
      const data = await fullSync();
      if (data) {
        addToast("Force sync completed!");
      } else {
        throw new Error("Force sync returned no data");
      }
    } catch (e) {
      console.error(e);
      addToast("Force sync failed!");
    }
  }, [addToast]);

  return {
    tasks, projects, labels: customLabels, sections, view, selectedId, quickAdd, search, expandedIds,
    collapsedSections, setCollapsedSections, toggleSection,
    multiSelectedIds, toggleMultiSelect, clearMultiSelect, bulkDelete, bulkComplete,
    sidebarWidth, setSidebarWidth, sidebarCollapsed, setSidebarCollapsed, loaded, wipingDb,
    sorts, setViewSort, reorderTasks, moveTask,
    setView: (v) => { setView(v); setSelectedId(null); setMultiSelectedIds([]); },
    setSelectedId, setQuickAdd, setSearch,
    toggleTask, updateTask, addTask, deleteTask, toggleSubtask, addSubtask, updateSubtask, deleteSubtask,
    addProject, deleteProject, updateProject, setProjectParent, reorderProjects, toggleExpand, resetDatabase,
    addLabel, updateLabel, deleteLabel,
    addSection, deleteSection, updateSection, reorderSections,
    savedFilters, addSavedFilter, deleteSavedFilter,
    toasts,
    theme,
    setTheme,
    density,
    setDensity,
    weekStartDay,
    setWeekStartDay,
    noTimeOpacity,
    setNoTimeOpacity,
    noDurOpacity,
    setNoDurOpacity,
    exportDatabase,
    importDatabase,
    barsVisible,
    setBarsVisible,
    forceSync,
    addToast,
    isAuthorized,
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
